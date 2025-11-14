// EventBus.res - Pub/Sub Event System for Workflow Events
// Day 64: Event Bus Implementation
// Provides event subscription, publishing, filtering, and history tracking

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

@genType
type eventId = string

@genType
type subscriberId = string

@genType
type eventPattern = string

@genType
type eventPriority = int

// Event data structure
@genType
type eventData = {
  id: eventId,
  eventType: string,
  payload: Js.Json.t,
  timestamp: float,
  source: option<string>,
  metadata: option<Js.Dict.t<string>>,
  priority: eventPriority,
}

// Subscription handler type
type eventHandler = eventData => promise<result<unit, string>>

// Subscription record
type subscription = {
  id: subscriberId,
  pattern: eventPattern,
  handler: eventHandler,
  priority: eventPriority,
  active: bool,
  createdAt: float,
}

// Event bus configuration
@genType
type eventBusConfig = {
  maxHistorySize: int,
  enableHistory: bool,
  enableFiltering: bool,
  defaultPriority: eventPriority,
}

// Event bus state
@genType
type eventBus = {
  subscriptions: Belt.Map.String.t<subscription>,
  history: array<eventData>,
  config: eventBusConfig,
  mutable eventCount: int,
  mutable errorCount: int,
}

// Event filter for querying
@genType
type eventFilter = {
  eventType: option<string>,
  source: option<string>,
  startTime: option<float>,
  endTime: option<float>,
  limit: option<int>,
}

// Event statistics
@genType
type eventBusStats = {
  totalEvents: int,
  totalSubscribers: int,
  activeSubscribers: int,
  historySize: int,
  errorCount: int,
  averageHandlers: float,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let getCurrentTime = (): float => Js.Date.now()

let generateId = (prefix: string): string => {
  let timestamp = getCurrentTime()
  let random = Js.Math.random()
  `${prefix}-${Belt.Float.toString(timestamp)}-${Belt.Float.toString(random)}`
}

// Check if event type matches pattern (supports wildcards)
let matchesPattern = (eventType: string, pattern: eventPattern): bool => {
  // Exact match
  if eventType === pattern {
    true
  } else if pattern === "*" {
    // Wildcard matches all
    true
  } else if Js.String2.endsWith(pattern, "*") {
    // Prefix wildcard (e.g., "workflow.*" matches "workflow.started")
    let prefix = Js.String2.slice(pattern, ~from=0, ~to_=Js.String2.length(pattern) - 1)
    Js.String2.startsWith(eventType, prefix)
  } else {
    false
  }
}

// Filter subscriptions by event type
let getMatchingSubscriptions = (
  bus: eventBus,
  eventType: string,
): array<subscription> => {
  bus.subscriptions
  ->Belt.Map.String.valuesToArray
  ->Belt.Array.keep(sub => sub.active && matchesPattern(eventType, sub.pattern))
  ->Belt.Array.reverse // Reverse to get correct priority order after sort
  ->Core__Array.toSorted((a, b) => {
    // Return Core__Ordering.t (float): -1.0 = less, 0.0 = equal, 1.0 = greater
    if b.priority > a.priority {
      1.0 // b is higher priority, so b should come first
    } else if b.priority < a.priority {
      -1.0
    } else {
      0.0
    }
  })
}

// Apply event filter to history
let applyEventFilter = (events: array<eventData>, filter: eventFilter): array<eventData> => {
  let filtered = events->Belt.Array.keep(event => {
    let typeMatch = switch filter.eventType {
    | None => true
    | Some(t) => event.eventType === t
    }

    let sourceMatch = switch filter.source {
    | None => true
    | Some(s) => switch event.source {
      | None => false
      | Some(eventSource) => eventSource === s
      }
    }

    let timeMatch = {
      let afterStart = switch filter.startTime {
      | None => true
      | Some(start) => event.timestamp >= start
      }
      let beforeEnd = switch filter.endTime {
      | None => true
      | Some(end_) => event.timestamp <= end_
      }
      afterStart && beforeEnd
    }

    typeMatch && sourceMatch && timeMatch
  })

  switch filter.limit {
  | None => filtered
  | Some(limit) => Belt.Array.slice(filtered, ~offset=0, ~len=limit)
  }
}

// ============================================================================
// EVENT BUS CREATION
// ============================================================================

@genType
let createConfig = (
  ~maxHistorySize: int=1000,
  ~enableHistory: bool=true,
  ~enableFiltering: bool=true,
  ~defaultPriority: eventPriority=0,
  (),
): eventBusConfig => {
  maxHistorySize,
  enableHistory,
  enableFiltering,
  defaultPriority,
}

@genType
let create = (~config: option<eventBusConfig>=?, ()): eventBus => {
  let defaultConfig = createConfig()
  let finalConfig = switch config {
  | None => defaultConfig
  | Some(c) => c
  }

  {
    subscriptions: Belt.Map.String.empty,
    history: [],
    config: finalConfig,
    eventCount: 0,
    errorCount: 0,
  }
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

@genType
let subscribe = (
  bus: eventBus,
  pattern: eventPattern,
  handler: eventHandler,
  ~priority: option<eventPriority>=?,
  (),
): result<(eventBus, subscriberId), string> => {
  let id = generateId("sub")
  let finalPriority = switch priority {
  | None => bus.config.defaultPriority
  | Some(p) => p
  }

  let subscription = {
    id,
    pattern,
    handler,
    priority: finalPriority,
    active: true,
    createdAt: getCurrentTime(),
  }

  let newSubscriptions = Belt.Map.String.set(bus.subscriptions, id, subscription)
  let newBus = {...bus, subscriptions: newSubscriptions}

  Ok((newBus, id))
}

@genType
let unsubscribe = (bus: eventBus, subscriberId: subscriberId): result<eventBus, string> => {
  switch Belt.Map.String.get(bus.subscriptions, subscriberId) {
  | None => Error(`Subscriber not found: ${subscriberId}`)
  | Some(_) => {
      let newSubscriptions = Belt.Map.String.remove(bus.subscriptions, subscriberId)
      Ok({...bus, subscriptions: newSubscriptions})
    }
  }
}

@genType
let pauseSubscription = (bus: eventBus, subscriberId: subscriberId): result<eventBus, string> => {
  switch Belt.Map.String.get(bus.subscriptions, subscriberId) {
  | None => Error(`Subscriber not found: ${subscriberId}`)
  | Some(sub) => {
      let updatedSub = {...sub, active: false}
      let newSubscriptions = Belt.Map.String.set(bus.subscriptions, subscriberId, updatedSub)
      Ok({...bus, subscriptions: newSubscriptions})
    }
  }
}

@genType
let resumeSubscription = (bus: eventBus, subscriberId: subscriberId): result<eventBus, string> => {
  switch Belt.Map.String.get(bus.subscriptions, subscriberId) {
  | None => Error(`Subscriber not found: ${subscriberId}`)
  | Some(sub) => {
      let updatedSub = {...sub, active: true}
      let newSubscriptions = Belt.Map.String.set(bus.subscriptions, subscriberId, updatedSub)
      Ok({...bus, subscriptions: newSubscriptions})
    }
  }
}

@genType
let getSubscription = (bus: eventBus, subscriberId: subscriberId): option<subscription> => {
  Belt.Map.String.get(bus.subscriptions, subscriberId)
}

@genType
let getAllSubscriptions = (bus: eventBus): array<subscription> => {
  bus.subscriptions->Belt.Map.String.valuesToArray
}

@genType
let getActiveSubscriptions = (bus: eventBus): array<subscription> => {
  getAllSubscriptions(bus)->Belt.Array.keep(sub => sub.active)
}

// ============================================================================
// EVENT CREATION
// ============================================================================

@genType
let createEvent = (
  eventType: string,
  payload: Js.Json.t,
  ~source: option<string>=?,
  ~metadata: option<Js.Dict.t<string>>=?,
  ~priority: option<eventPriority>=?,
  (),
): eventData => {
  {
    id: generateId("event"),
    eventType,
    payload,
    timestamp: getCurrentTime(),
    source,
    metadata,
    priority: switch priority {
    | None => 0
    | Some(p) => p
    },
  }
}

// ============================================================================
// EVENT PUBLISHING
// ============================================================================

@genType
let publish = async (bus: eventBus, event: eventData): promise<result<eventBus, string>> => {
  // Get matching subscriptions
  let subscribers = getMatchingSubscriptions(bus, event.eventType)

  // If no subscribers and filtering is enabled, skip processing
  if bus.config.enableFiltering && Belt.Array.length(subscribers) === 0 {
    // Still add to history if enabled
    let newBus = if bus.config.enableHistory {
      let newHistory = Belt.Array.concat(bus.history, [event])
      let trimmedHistory = if Belt.Array.length(newHistory) > bus.config.maxHistorySize {
        Belt.Array.sliceToEnd(newHistory, Belt.Array.length(newHistory) - bus.config.maxHistorySize)
      } else {
        newHistory
      }
      {...bus, history: trimmedHistory, eventCount: bus.eventCount + 1}
    } else {
      {...bus, eventCount: bus.eventCount + 1}
    }
    Js.Promise.resolve(Ok(newBus))
  } else {
    // Call all matching handlers in parallel
    let handlerPromises = Belt.Array.map(subscribers, sub => sub.handler(event))

    // Wait for all handlers to complete
    let results = await Js.Promise.all(handlerPromises)

    // Count errors
    let errors = Belt.Array.keep(results, r => switch r {
    | Ok(_) => false
    | Error(_) => true
    })
    let errorCount = Belt.Array.length(errors)

    // Update history if enabled
    let newHistory = if bus.config.enableHistory {
      let newHist = Belt.Array.concat(bus.history, [event])
      if Belt.Array.length(newHist) > bus.config.maxHistorySize {
        Belt.Array.sliceToEnd(newHist, Belt.Array.length(newHist) - bus.config.maxHistorySize)
      } else {
        newHist
      }
    } else {
      bus.history
    }

    // Return updated bus with new event count and error count
    let newBus = {
      ...bus,
      history: newHistory,
      eventCount: bus.eventCount + 1,
      errorCount: bus.errorCount + errorCount,
    }

    // Always return Ok with the bus - caller can check errorCount if needed
    Js.Promise.resolve(Ok(newBus))
  }
}

@genType
let publishSync = (bus: eventBus, event: eventData): result<eventBus, string> => {
  // Get matching subscriptions
  let subscribers = getMatchingSubscriptions(bus, event.eventType)

  // Update history if enabled
  let newHistory = if bus.config.enableHistory {
    let newHist = Belt.Array.concat(bus.history, [event])
    if Belt.Array.length(newHist) > bus.config.maxHistorySize {
      Belt.Array.sliceToEnd(newHist, Belt.Array.length(newHist) - bus.config.maxHistorySize)
    } else {
      newHist
    }
  } else {
    bus.history
  }

  // Return updated bus (handlers will execute async but we don't wait)
  let newBus = {
    ...bus,
    history: newHistory,
    eventCount: bus.eventCount + 1,
  }

  // Fire handlers without waiting (fire-and-forget)
  Belt.Array.forEach(subscribers, sub => {
    let _ = sub.handler(event)
  })

  Ok(newBus)
}

// ============================================================================
// EVENT HISTORY
// ============================================================================

@genType
let getHistory = (bus: eventBus, ~filter: option<eventFilter>=?, ()): array<eventData> => {
  switch filter {
  | None => bus.history
  | Some(f) => applyEventFilter(bus.history, f)
  }
}

@genType
let clearHistory = (bus: eventBus): eventBus => {
  {...bus, history: []}
}

@genType
let getEvent = (bus: eventBus, eventId: eventId): option<eventData> => {
  Belt.Array.getBy(bus.history, event => event.id === eventId)
}

@genType
let getEventsByType = (bus: eventBus, eventType: string, ~limit: option<int>=?, ()): array<eventData> => {
  let filtered = Belt.Array.keep(bus.history, event => event.eventType === eventType)
  switch limit {
  | None => filtered
  | Some(l) => Belt.Array.slice(filtered, ~offset=0, ~len=l)
  }
}

@genType
let getEventsBySource = (bus: eventBus, source: string, ~limit: option<int>=?, ()): array<eventData> => {
  let filtered = Belt.Array.keep(bus.history, event =>
    switch event.source {
    | None => false
    | Some(s) => s === source
    }
  )
  switch limit {
  | None => filtered
  | Some(l) => Belt.Array.slice(filtered, ~offset=0, ~len=l)
  }
}

@genType
let getRecentEvents = (bus: eventBus, count: int): array<eventData> => {
  let historyLen = Belt.Array.length(bus.history)
  if historyLen <= count {
    bus.history
  } else {
    Belt.Array.sliceToEnd(bus.history, historyLen - count)
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

@genType
let getStats = (bus: eventBus): eventBusStats => {
  let allSubs = getAllSubscriptions(bus)
  let activeSubs = Belt.Array.keep(allSubs, sub => sub.active)

  let avgHandlers = if bus.eventCount === 0 {
    0.0
  } else {
    Belt.Int.toFloat(Belt.Array.length(allSubs)) /. Belt.Int.toFloat(bus.eventCount)
  }

  {
    totalEvents: bus.eventCount,
    totalSubscribers: Belt.Array.length(allSubs),
    activeSubscribers: Belt.Array.length(activeSubs),
    historySize: Belt.Array.length(bus.history),
    errorCount: bus.errorCount,
    averageHandlers: avgHandlers,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

@genType
let hasSubscribers = (bus: eventBus, pattern: eventPattern): bool => {
  let matching = getMatchingSubscriptions(bus, pattern)
  Belt.Array.length(matching) > 0
}

@genType
let getSubscriberCount = (bus: eventBus, pattern: eventPattern): int => {
  let matching = getMatchingSubscriptions(bus, pattern)
  Belt.Array.length(matching)
}

@genType
let reset = (bus: eventBus): eventBus => {
  {
    ...bus,
    subscriptions: Belt.Map.String.empty,
    history: [],
    eventCount: 0,
    errorCount: 0,
  }
}

// Create event filter helper
@genType
let createFilter = (
  ~eventType: option<string>=?,
  ~source: option<string>=?,
  ~startTime: option<float>=?,
  ~endTime: option<float>=?,
  ~limit: option<int>=?,
  (),
): eventFilter => {
  {
    eventType,
    source,
    startTime,
    endTime,
    limit,
  }
}
