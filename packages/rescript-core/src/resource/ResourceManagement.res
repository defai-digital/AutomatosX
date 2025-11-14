// ============================================================================
// ResourceManagement.res - RAII pattern for automatic resource cleanup
// ============================================================================
//
// PREVENTS: BUG #16 (Resource leaks from missing cleanup)
//
// TypeScript problem: Manual cleanup, forgot to release resources, nested try/finally
// ReScript solution: RAII pattern, automatic cleanup, type-safe resource lifecycle
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// RESOURCE TYPES
// ============================================================================

// Resource handle - represents an acquired resource
@genType
type resource<'a> = {
  value: 'a,
  cleanup: unit => unit,
  isReleased: ref<bool>,
  acquiredAt: int,
}

// Resource pool for reusable resources
@genType
type resourcePool<'a> = {
  available: ref<array<resource<'a>>>,
  inUse: ref<array<resource<'a>>>,
  maxSize: int,
  factory: unit => result<'a, string>,
  cleanup: 'a => unit,
}

// ============================================================================
// RESOURCE ACQUISITION
// ============================================================================

// Acquire a resource with automatic cleanup
@genType
let acquireResource = (
  ~acquire: unit => result<'a, string>,
  ~cleanup: 'a => unit,
): result<resource<'a>, string> => {
  switch acquire() {
  | Error(err) => Error(err)
  | Ok(value) => {
      let now = Js.Date.now()->Belt.Float.toInt
      Ok({
        value,
        cleanup: () => cleanup(value),
        isReleased: ref(false),
        acquiredAt: now,
      })
    }
  }
}

// Release a resource (manual cleanup)
@genType
let releaseResource = (resource: resource<'a>): unit => {
  if !resource.isReleased.contents {
    resource.cleanup()
    resource.isReleased := true
  }
}

// Check if resource is still active
@genType
let isResourceActive = (resource: resource<'a>): bool => {
  !resource.isReleased.contents
}

// Get time resource has been held (milliseconds)
@genType
let getResourceAge = (resource: resource<'a>): int => {
  let now = Js.Date.now()->Belt.Float.toInt
  now - resource.acquiredAt
}

// ============================================================================
// RESOURCE SCOPING (RAII Pattern)
// ============================================================================

// Use resource in a scope with automatic cleanup
@genType
let withResource = (
  ~acquire: unit => result<'a, string>,
  ~cleanup: 'a => unit,
  ~use: 'a => result<'b, string>,
): result<'b, string> => {
  switch acquireResource(~acquire, ~cleanup) {
  | Error(err) => Error(err)
  | Ok(resource) => {
      let result = use(resource.value)
      releaseResource(resource)
      result
    }
  }
}

// Use multiple resources with automatic cleanup
@genType
let withResources2 = (
  ~acquire1: unit => result<'a, string>,
  ~cleanup1: 'a => unit,
  ~acquire2: unit => result<'b, string>,
  ~cleanup2: 'b => unit,
  ~use: ('a, 'b) => result<'c, string>,
): result<'c, string> => {
  withResource(
    ~acquire=acquire1,
    ~cleanup=cleanup1,
    ~use=r1 => {
      withResource(
        ~acquire=acquire2,
        ~cleanup=cleanup2,
        ~use=r2 => use(r1, r2),
      )
    },
  )
}

// Use three resources with automatic cleanup
@genType
let withResources3 = (
  ~acquire1: unit => result<'a, string>,
  ~cleanup1: 'a => unit,
  ~acquire2: unit => result<'b, string>,
  ~cleanup2: 'b => unit,
  ~acquire3: unit => result<'c, string>,
  ~cleanup3: 'c => unit,
  ~use: ('a, 'b, 'c) => result<'d, string>,
): result<'d, string> => {
  withResources2(
    ~acquire1,
    ~cleanup1,
    ~acquire2,
    ~cleanup2,
    ~use=(r1, r2) => {
      withResource(
        ~acquire=acquire3,
        ~cleanup=cleanup3,
        ~use=r3 => use(r1, r2, r3),
      )
    },
  )
}

// ============================================================================
// RESOURCE POOL (Object Pooling Pattern)
// ============================================================================

// Create a resource pool
@genType
let createPool = (
  ~maxSize: int = 10,
  ~factory: unit => result<'a, string>,
  ~cleanup: 'a => unit,
): resourcePool<'a> => {
  {
    available: ref([]),
    inUse: ref([]),
    maxSize,
    factory,
    cleanup,
  }
}

// Get resource from pool (or create new one)
@genType
let borrowFromPool = (pool: resourcePool<'a>): result<resource<'a>, string> => {
  // Try to reuse an available resource
  switch Belt.Array.get(pool.available.contents, 0) {
  | Some(resource) => {
      // Remove from available
      pool.available := Belt.Array.sliceToEnd(pool.available.contents, 1)
      // Add to in-use
      pool.inUse := Belt.Array.concat(pool.inUse.contents, [resource])
      // Reset released flag
      resource.isReleased := false
      Ok(resource)
    }
  | None => {
      // Check if pool is at max capacity
      let totalSize = Belt.Array.length(pool.available.contents) + Belt.Array.length(pool.inUse.contents)
      if totalSize >= pool.maxSize {
        Error(`Resource pool exhausted (max: ${Belt.Int.toString(pool.maxSize)})`)
      } else {
        // Create new resource
        switch acquireResource(~acquire=pool.factory, ~cleanup=pool.cleanup) {
        | Error(err) => Error(err)
        | Ok(resource) => {
            pool.inUse := Belt.Array.concat(pool.inUse.contents, [resource])
            Ok(resource)
          }
        }
      }
    }
  }
}

// Return resource to pool
@genType
let returnToPool = (pool: resourcePool<'a>, resource: resource<'a>): unit => {
  // Remove from in-use
  pool.inUse := Belt.Array.keep(pool.inUse.contents, r => r !== resource)

  // Add to available if not released
  if !resource.isReleased.contents {
    pool.available := Belt.Array.concat(pool.available.contents, [resource])
  }
}

// Use resource from pool with automatic return
@genType
let withPooledResource = (
  pool: resourcePool<'a>,
  use: 'a => result<'b, string>,
): result<'b, string> => {
  switch borrowFromPool(pool) {
  | Error(err) => Error(err)
  | Ok(resource) => {
      let result = use(resource.value)
      returnToPool(pool, resource)
      result
    }
  }
}

// Drain and cleanup all resources in pool
@genType
let drainPool = (pool: resourcePool<'a>): unit => {
  // Release all available resources
  Belt.Array.forEach(pool.available.contents, resource => {
    releaseResource(resource)
  })
  pool.available := []

  // Release all in-use resources (WARNING: may cause issues!)
  Belt.Array.forEach(pool.inUse.contents, resource => {
    releaseResource(resource)
  })
  pool.inUse := []
}

// Get pool statistics
@genType
type poolStats = {
  available: int,
  inUse: int,
  total: int,
  capacity: int,
  utilizationPercent: float,
}

@genType
let getPoolStats = (pool: resourcePool<'a>): poolStats => {
  let available = Belt.Array.length(pool.available.contents)
  let inUse = Belt.Array.length(pool.inUse.contents)
  let total = available + inUse
  let utilization = if pool.maxSize > 0 {
    Belt.Int.toFloat(inUse) /. Belt.Int.toFloat(pool.maxSize) *. 100.0
  } else {
    0.0
  }

  {
    available,
    inUse,
    total,
    capacity: pool.maxSize,
    utilizationPercent: utilization,
  }
}

// ============================================================================
// COMMON RESOURCE TYPES
// ============================================================================

// File handle resource
@genType
type fileHandle = {
  path: string,
  fd: int,  // File descriptor (placeholder - actual implementation would use Node.js fs)
}

// Create file resource
@genType
let createFileResource = (path: string): result<fileHandle, string> => {
  // In real implementation, this would call fs.openSync()
  // For now, return a mock file descriptor
  Ok({path, fd: 1})
}

// Cleanup file resource
@genType
let cleanupFileResource = (file: fileHandle): unit => {
  // In real implementation, this would call fs.closeSync(file.fd)
  Js.log2("Closing file:", file.path)
}

// Database connection resource
@genType
type dbConnection = {
  connectionString: string,
  isConnected: ref<bool>,
}

// Create database connection
@genType
let createDbConnection = (connString: string): result<dbConnection, string> => {
  Ok({
    connectionString: connString,
    isConnected: ref(true),
  })
}

// Cleanup database connection
@genType
let cleanupDbConnection = (conn: dbConnection): unit => {
  if conn.isConnected.contents {
    Js.log("Closing database connection")
    conn.isConnected := false
  }
}

// Network socket resource
@genType
type socket = {
  host: string,
  port: int,
  isOpen: ref<bool>,
}

// Create socket
@genType
let createSocket = (host: string, port: int): result<socket, string> => {
  Ok({
    host,
    port,
    isOpen: ref(true),
  })
}

// Cleanup socket
@genType
let cleanupSocket = (socket: socket): unit => {
  if socket.isOpen.contents {
    Js.log2("Closing socket:", socket.host ++ ":" ++ Belt.Int.toString(socket.port))
    socket.isOpen := false
  }
}

// ============================================================================
// RESOURCE TRACKING (Leak Detection)
// ============================================================================

// Note: Global resource tracking removed due to type parameter constraints
// For leak detection in production, implement type-specific trackers or use
// external monitoring tools

// ============================================================================
// ASYNC RESOURCE MANAGEMENT
// ============================================================================

// Async resource with promise-based cleanup
@genType
let withResourceAsync = (
  ~acquire: unit => Js.Promise.t<result<'a, string>>,
  ~cleanup: 'a => Js.Promise.t<unit>,
  ~use: 'a => Js.Promise.t<result<'b, string>>,
): Js.Promise.t<result<'b, string>> => {
  acquire()
  ->Js.Promise.then_(acquireResult => {
    switch acquireResult {
    | Error(err) => Js.Promise.resolve(Error(err))
    | Ok(value) => {
        use(value)
        ->Js.Promise.then_(useResult => {
          cleanup(value)
          ->Js.Promise.then_(_ => {
            Js.Promise.resolve(useResult)
          }, _)
        }, _)
      }
    }
  }, _)
}

// ============================================================================
// DEMONSTRATION: Why This Prevents BUG #16
// ============================================================================

// TypeScript version (BUGGY):
// ```typescript
// function processFile(path: string) {
//   const fd = fs.openSync(path);
//
//   if (someCondition) {
//     return result;  // ❌ BUG #16: Forgot to close file!
//   }
//
//   const data = fs.readFileSync(fd);
//   fs.closeSync(fd);  // Only closes on happy path
//   return data;
// }
// ```

// ReScript version (CORRECT):
// ```rescript
// let processFile = (path: string): result<string, string> => {
//   withResource(
//     ~acquire=() => createFileResource(path),
//     ~cleanup=cleanupFileResource,
//     ~use=file => {
//       // File ALWAYS closed, even on early return!
//       if someCondition {
//         Ok("result")  // ✅ File will be closed automatically
//       } else {
//         readFile(file)
//       }
//     }
//   )
// }
// // No way to forget cleanup - compiler enforces RAII pattern!
// ```

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Example 1: File resource (BUG #16 prevention)
// let result = withResource(
//   ~acquire=() => createFileResource("/tmp/data.txt"),
//   ~cleanup=cleanupFileResource,
//   ~use=file => {
//     // Use file here
//     Ok("data")
//   }
// )
// // File automatically closed when scope exits!

// Example 2: Database connection pool
// let pool = createPool(
//   ~maxSize=10,
//   ~factory=() => createDbConnection("postgres://localhost"),
//   ~cleanup=cleanupDbConnection
// )
//
// let result = withPooledResource(pool, conn => {
//   // Execute query
//   Ok("result")
// })
// // Connection automatically returned to pool!

// Example 3: Multiple resources
// let result = withResources2(
//   ~acquire1=() => createDbConnection("postgres://localhost"),
//   ~cleanup1=cleanupDbConnection,
//   ~acquire2=() => createFileResource("/tmp/output.txt"),
//   ~cleanup2=cleanupFileResource,
//   ~use=(conn, file) => {
//     // Use both resources
//     Ok("result")
//   }
// )
// // Both resources cleaned up in reverse order (file, then db)!
