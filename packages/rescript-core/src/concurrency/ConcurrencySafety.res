// ============================================================================
// ConcurrencySafety.res - Type-safe concurrency primitives
// ============================================================================
//
// PREVENTS: BUG #4 (race condition in cache)
//
// TypeScript problem: Race conditions in concurrent cache access
// ReScript solution: Mutex-protected operations, atomic updates, sequential execution
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// MUTEX TYPE (Exclusive access control)
// ============================================================================

// Mutex state
type mutexState =
  | @as("Unlocked") Unlocked
  | @as("Locked") Locked(int)  // Locked with timestamp

// Mutex for exclusive access to shared resources
@genType
type mutex<'a> = {
  value: ref<'a>,
  state: ref<mutexState>,
  waitQueue: ref<array<unit => unit>>,
}

// ============================================================================
// MUTEX OPERATIONS
// ============================================================================

// Create a new mutex
@genType
let createMutex = (initialValue: 'a): mutex<'a> => {
  {
    value: ref(initialValue),
    state: ref(Unlocked),
    waitQueue: ref([]),
  }
}

// Try to acquire lock (non-blocking)
@genType
let tryLock = (mutex: mutex<'a>): bool => {
  switch mutex.state.contents {
  | Unlocked => {
      mutex.state := Locked(Js.Date.now()->Belt.Float.toInt)
      true
    }
  | Locked(_) => false
  }
}

// Acquire lock (blocking with timeout)
@genType
let lock = (mutex: mutex<'a>, ~timeoutMs: int = 5000): Js.Promise.t<result<unit, string>> => {
  let startTime = Js.Date.now()->Belt.Float.toInt

  let rec tryAcquire = () => {
    if tryLock(mutex) {
      Js.Promise.resolve(Ok())
    } else {
      let elapsed = Js.Date.now()->Belt.Float.toInt - startTime
      if elapsed >= timeoutMs {
        Js.Promise.resolve(Error(`Lock timeout after ${Belt.Int.toString(timeoutMs)}ms`))
      } else {
        // Wait 10ms and retry
        Js.Promise.make((~resolve, ~reject as _) => {
          let _ = Js.Global.setTimeout(() => {
            tryAcquire()
            ->Js.Promise.then_(result => {
              resolve(. result)
              Js.Promise.resolve()
            }, _)
            ->ignore
          }, 10)
        })
      }
    }
  }

  tryAcquire()
}

// Release lock
@genType
let unlock = (mutex: mutex<'a>): unit => {
  switch mutex.state.contents {
  | Locked(_) => {
      mutex.state := Unlocked
      // Process wait queue
      if Belt.Array.length(mutex.waitQueue.contents) > 0 {
        switch Belt.Array.get(mutex.waitQueue.contents, 0) {
        | Some(callback) => {
            mutex.waitQueue := Belt.Array.sliceToEnd(mutex.waitQueue.contents, 1)
            callback()
          }
        | None => ()
        }
      }
    }
  | Unlocked => ()  // Already unlocked
  }
}

// Check if mutex is locked
@genType
let isLocked = (mutex: mutex<'a>): bool => {
  switch mutex.state.contents {
  | Locked(_) => true
  | Unlocked => false
  }
}

// Get current value (unsafe - use atomic instead)
@genType
let getValue = (mutex: mutex<'a>): 'a => {
  mutex.value.contents
}

// ============================================================================
// ATOMIC OPERATIONS (Mutex-protected)
// ============================================================================

// Atomic read
@genType
let atomicRead = (mutex: mutex<'a>): Js.Promise.t<result<'a, string>> => {
  lock(mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        let value = mutex.value.contents
        unlock(mutex)
        Js.Promise.resolve(Ok(value))
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Atomic write
@genType
let atomicWrite = (mutex: mutex<'a>, newValue: 'a): Js.Promise.t<result<unit, string>> => {
  lock(mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        mutex.value := newValue
        unlock(mutex)
        Js.Promise.resolve(Ok())
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Atomic update (read-modify-write)
@genType
let atomicUpdate = (
  mutex: mutex<'a>,
  fn: 'a => 'a,
): Js.Promise.t<result<'a, string>> => {
  lock(mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        let oldValue = mutex.value.contents
        let newValue = fn(oldValue)
        mutex.value := newValue
        unlock(mutex)
        Js.Promise.resolve(Ok(newValue))
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Atomic compare-and-swap (CAS)
@genType
let atomicCAS = (
  mutex: mutex<'a>,
  expected: 'a,
  newValue: 'a,
): Js.Promise.t<result<bool, string>> => {
  lock(mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        let current = mutex.value.contents
        let success = current == expected
        if success {
          mutex.value := newValue
        }
        unlock(mutex)
        Js.Promise.resolve(Ok(success))
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// ============================================================================
// SAFE CACHE TYPE (Mutex-protected cache)
// ============================================================================

@genType
type safeCache<'k, 'v> = {
  data: ref<Js.Dict.t<'v>>,
  mutex: mutex<unit>,
  maxSize: int,
}

// Create a safe cache
@genType
let createSafeCache = (~maxSize: int = 1000): safeCache<'k, 'v> => {
  {
    data: ref(Js.Dict.empty()),
    mutex: createMutex(),
    maxSize,
  }
}

// Safe cache get
@genType
let cacheGet = (
  cache: safeCache<'k, 'v>,
  key: string,
): Js.Promise.t<result<option<'v>, string>> => {
  lock(cache.mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        let value = Js.Dict.get(cache.data.contents, key)
        unlock(cache.mutex)
        Js.Promise.resolve(Ok(value))
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Safe cache set
@genType
let cacheSet = (
  cache: safeCache<'k, 'v>,
  key: string,
  value: 'v,
): Js.Promise.t<result<unit, string>> => {
  lock(cache.mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        // Check size limit
        let currentSize = Js.Dict.keys(cache.data.contents)->Belt.Array.length
        let keyExists = Js.Dict.get(cache.data.contents, key)->Belt.Option.isSome
        if currentSize >= cache.maxSize && !keyExists {
          // Evict oldest entry (simple FIFO)
          switch Js.Dict.keys(cache.data.contents)->Belt.Array.get(0) {
          | Some(oldestKey) => {
              Js.Dict.unsafeDeleteKey(cache.data.contents, oldestKey)
              ()
            }
          | None => ()
          }
        }

        Js.Dict.set(cache.data.contents, key, value)
        unlock(cache.mutex)
        Js.Promise.resolve(Ok())
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Safe cache delete
@genType
let cacheDelete = (
  cache: safeCache<'k, 'v>,
  key: string,
): Js.Promise.t<result<unit, string>> => {
  lock(cache.mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        Js.Dict.unsafeDeleteKey(cache.data.contents, key)
        unlock(cache.mutex)
        Js.Promise.resolve(Ok())
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Safe cache clear
@genType
let cacheClear = (cache: safeCache<'k, 'v>): Js.Promise.t<result<unit, string>> => {
  lock(cache.mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        cache.data := Js.Dict.empty()
        unlock(cache.mutex)
        Js.Promise.resolve(Ok())
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// Get cache size
@genType
let cacheSize = (cache: safeCache<'k, 'v>): Js.Promise.t<result<int, string>> => {
  lock(cache.mutex)
  ->Js.Promise.then_(lockResult => {
    switch lockResult {
    | Ok(_) => {
        let size = Js.Dict.keys(cache.data.contents)->Belt.Array.length
        unlock(cache.mutex)
        Js.Promise.resolve(Ok(size))
      }
    | Error(err) => Js.Promise.resolve(Error(err))
    }
  }, _)
}

// ============================================================================
// SEQUENTIAL EXECUTION (Prevent race conditions)
// ============================================================================

// Execute array of promises sequentially
@genType
let sequential = (operations: array<unit => Js.Promise.t<'a>>): Js.Promise.t<array<'a>> => {
  let results = ref([])

  let rec executeNext = (index: int): Js.Promise.t<array<'a>> => {
    if index >= Belt.Array.length(operations) {
      Js.Promise.resolve(results.contents)
    } else {
      switch Belt.Array.get(operations, index) {
      | Some(operation) =>
        operation()
        ->Js.Promise.then_(result => {
          results := Belt.Array.concat(results.contents, [result])
          executeNext(index + 1)
        }, _)
      | None => Js.Promise.resolve(results.contents)
      }
    }
  }

  executeNext(0)
}

// Execute array of promises sequentially, stopping on first error
@genType
let sequentialResults = (
  operations: array<unit => Js.Promise.t<result<'a, 'err>>>
): Js.Promise.t<result<array<'a>, 'err>> => {
  let results = ref([])

  let rec executeNext = (index: int): Js.Promise.t<result<array<'a>, 'err>> => {
    if index >= Belt.Array.length(operations) {
      Js.Promise.resolve(Ok(results.contents))
    } else {
      switch Belt.Array.get(operations, index) {
      | Some(operation) =>
        operation()
        ->Js.Promise.then_(result => {
          switch result {
          | Ok(value) => {
              results := Belt.Array.concat(results.contents, [value])
              executeNext(index + 1)
            }
          | Error(err) => Js.Promise.resolve(Error(err))
          }
        }, _)
      | None => Js.Promise.resolve(Ok(results.contents))
      }
    }
  }

  executeNext(0)
}

// ============================================================================
// DEBOUNCE & THROTTLE (Prevent excessive operations)
// ============================================================================

@genType
type debounceState<'a> = {
  timeoutId: ref<option<Js.Global.timeoutId>>,
  lastArgs: ref<option<'a>>,
}

// Create debounce state
@genType
let createDebounceState = (): debounceState<'a> => {
  {
    timeoutId: ref(None),
    lastArgs: ref(None),
  }
}

// Debounce function execution
@genType
let debounce = (
  state: debounceState<'a>,
  fn: 'a => unit,
  args: 'a,
  delayMs: int,
): unit => {
  // Clear existing timeout
  switch state.timeoutId.contents {
  | Some(id) => Js.Global.clearTimeout(id)
  | None => ()
  }

  // Set new timeout
  let newId = Js.Global.setTimeout(() => {
    fn(args)
    state.timeoutId := None
    state.lastArgs := None
  }, delayMs)

  state.timeoutId := Some(newId)
  state.lastArgs := Some(args)
}

@genType
type throttleState = {
  lastExecuted: ref<int>,
  isThrottled: ref<bool>,
}

// Create throttle state
@genType
let createThrottleState = (): throttleState => {
  {
    lastExecuted: ref(0),
    isThrottled: ref(false),
  }
}

// Throttle function execution
@genType
let throttle = (
  state: throttleState,
  fn: 'a => unit,
  args: 'a,
  intervalMs: int,
): unit => {
  let now = Js.Date.now()->Belt.Float.toInt
  let timeSinceLastExecution = now - state.lastExecuted.contents

  if timeSinceLastExecution >= intervalMs && !state.isThrottled.contents {
    fn(args)
    state.lastExecuted := now
    state.isThrottled := true

    let _ = Js.Global.setTimeout(() => {
      state.isThrottled := false
    }, intervalMs)
  }
}

// ============================================================================
// EXAMPLE USAGE (not exported, for documentation)
// ============================================================================

// Example 1: Safe cache operations
// let cache = createSafeCache(~maxSize=100)
//
// // Thread-safe get
// let value = await cacheGet(cache, "key-123")
// switch value {
// | Ok(Some(v)) => Js.log2("Found:", v)
// | Ok(None) => Js.log("Not found")
// | Error(err) => Js.log2("Error:", err)
// }
//
// // Thread-safe set
// let result = await cacheSet(cache, "key-123", "value")
// switch result {
// | Ok(_) => Js.log("Set successful")
// | Error(err) => Js.log2("Set failed:", err)
// }

// Example 2: Atomic operations
// let counter = createMutex(0)
//
// // Atomic increment
// let newValue = await atomicUpdate(counter, count => count + 1)
// switch newValue {
// | Ok(n) => Js.log2("New count:", n)
// | Error(err) => Js.log2("Error:", err)
// }

// Example 3: Sequential execution
// let operations = [
//   () => fetchUser("user-1"),
//   () => fetchUser("user-2"),
//   () => fetchUser("user-3"),
// ]
//
// let users = await sequential(operations)
// // Executes one at a time, in order, preventing race conditions

// Example 4: Debounce
// let debounceState = createDebounceState()
//
// // Only executes after 300ms of inactivity
// debounce(debounceState, saveToDatabase, data, 300)
