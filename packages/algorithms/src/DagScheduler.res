/**
 * DAG Scheduler Algorithm
 *
 * Schedules tasks in a Directed Acyclic Graph for parallel execution.
 * Groups independent tasks for concurrent processing.
 *
 * @module DagScheduler
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Types
// =============================================================================

type dagNode = {
  id: string,
  deps: array<string>,
  estimatedDuration: int, // milliseconds
  priority: int, // 1-10, lower = higher priority
}

type scheduleGroup = {
  nodes: array<string>,
  parallelizable: bool,
  estimatedDuration: int,
}

type scheduleResult = {
  groups: array<scheduleGroup>,
  totalEstimatedDuration: int,
  criticalPath: array<string>,
  error: option<string>,
}

// =============================================================================
// Cycle Detection
// =============================================================================

/**
 * Detect cycles in the DAG using DFS
 */
let hasCycle = (nodes: array<dagNode>): bool => {
  let nodeMap = Map.make()
  nodes->Array.forEach(n => nodeMap->Map.set(n.id, n))

  let visited = Set.make()
  let recStack = Set.make()

  let rec dfs = (nodeId: string): bool => {
    if recStack->Set.has(nodeId) {
      true // Cycle found
    } else if visited->Set.has(nodeId) {
      false // Already processed
    } else {
      visited->Set.add(nodeId)->ignore
      recStack->Set.add(nodeId)->ignore

      let hasCycleInDeps = switch nodeMap->Map.get(nodeId) {
      | Some(node) =>
        node.deps->Array.some(dep => dfs(dep))
      | None => false
      }

      recStack->Set.delete(nodeId)->ignore
      hasCycleInDeps
    }
  }

  nodes->Array.some(n => dfs(n.id))
}

// =============================================================================
// Critical Path
// =============================================================================

/**
 * Find the critical path (longest path through the DAG)
 */
let findCriticalPath = (nodes: array<dagNode>): array<string> => {
  let nodeMap = Map.make()
  nodes->Array.forEach(n => nodeMap->Map.set(n.id, n))

  // Calculate longest path to each node
  let longestPath = Map.make()
  let pathPredecessor = Map.make()

  // Topological sort first
  let inDegree = Map.make()
  nodes->Array.forEach(n => {
    inDegree->Map.set(n.id, n.deps->Array.length)
  })

  let queue = nodes
    ->Array.filter(n => n.deps->Array.length == 0)
    ->Array.map(n => n.id)

  let sorted = []

  let queueRef = ref(queue)
  while Array.length(queueRef.contents) > 0 {
    // Safe access with pattern matching instead of getUnsafe
    let current = switch Array.get(queueRef.contents, 0) {
    | Some(c) => c
    | None => "" // Should not happen due to while condition, but safe
    }
    queueRef := queueRef.contents->Array.sliceToEnd(~start=1)
    if current != "" {
    sorted->Array.push(current)->ignore

    // Find nodes that depend on current
    nodes->Array.forEach(n => {
      if n.deps->Array.includes(current) {
        let newDegree = (inDegree->Map.get(n.id)->Option.getOr(0)) - 1
        inDegree->Map.set(n.id, newDegree)
        if newDegree == 0 {
          queueRef := queueRef.contents->Array.concat([n.id])
        }
      }
    })
    }
  }

  // Validate topological sort completed (all nodes processed)
  if Array.length(sorted) != Array.length(nodes) {
    []
  } else {
  // Calculate longest paths
  sorted->Array.forEach(nodeId => {
    switch nodeMap->Map.get(nodeId) {
    | Some(node) =>
      let maxPredDuration = node.deps->Array.reduce(0, (max, dep) => {
        let depDuration = longestPath->Map.get(dep)->Option.getOr(0)
        if depDuration > max {
          pathPredecessor->Map.set(nodeId, dep)
          depDuration
        } else {
          max
        }
      })
      longestPath->Map.set(nodeId, maxPredDuration + node.estimatedDuration)
    | None => ()
    }
  })

  // Find the end node with longest path
  let (endNode, _) = nodes->Array.reduce(("", 0), ((maxNode, maxDuration), node) => {
    let duration = longestPath->Map.get(node.id)->Option.getOr(0)
    if duration > maxDuration {
      (node.id, duration)
    } else {
      (maxNode, maxDuration)
    }
  })

  // Return empty array if no valid end node found (empty input or no path)
  if endNode == "" {
    []
  } else {
  // Reconstruct critical path
  let path = [endNode]
  let current = ref(endNode)
  while pathPredecessor->Map.has(current.contents) {
    switch pathPredecessor->Map.get(current.contents) {
    | Some(pred) =>
      path->Array.unshift(pred)->ignore
      current := pred
    | None => ()
    }
  }

  path
  }
  }
}

// =============================================================================
// Scheduling
// =============================================================================

/**
 * Schedule DAG nodes for parallel execution
 */
let scheduleParallel = (nodes: array<dagNode>): scheduleResult => {
  // Check for cycles
  if hasCycle(nodes) {
    {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: [],
      error: Some("Cycle detected in DAG"),
    }
  } else if Array.length(nodes) == 0 {
    {
      groups: [],
      totalEstimatedDuration: 0,
      criticalPath: [],
      error: None,
    }
  } else {
    let nodeMap = Map.make()
    nodes->Array.forEach(n => nodeMap->Map.set(n.id, n))

    let remaining = ref(nodes->Array.map(n => n.id))
    let completed = Set.make()
    let groups: array<scheduleGroup> = []
    let totalDuration = ref(0)
    let continueLoop = ref(true)

    while Array.length(remaining.contents) > 0 && continueLoop.contents {
      // Find all nodes whose dependencies are complete
      let ready = remaining.contents->Array.filter(nodeId => {
        switch nodeMap->Map.get(nodeId) {
        | Some(node) =>
          node.deps->Array.every(dep => completed->Set.has(dep))
        | None => false
        }
      })

      if Array.length(ready) == 0 {
        // This shouldn't happen if cycle detection works
        continueLoop := false
      } else {
        // Sort ready nodes by priority
        let sortedReady = ready->Array.toSorted((a, b) => {
          let priorityA = switch nodeMap->Map.get(a) {
          | Some(n) => n.priority
          | None => 5
          }
          let priorityB = switch nodeMap->Map.get(b) {
          | Some(n) => n.priority
          | None => 5
          }
          Int.toFloat(priorityA - priorityB)
        })

        // Calculate max duration for this group (parallel execution)
        let groupDuration = sortedReady->Array.reduce(0, (max, nodeId) => {
          switch nodeMap->Map.get(nodeId) {
          | Some(node) => Math.Int.max(max, node.estimatedDuration)
          | None => max
          }
        })

        groups->Array.push({
          nodes: sortedReady,
          parallelizable: Array.length(sortedReady) > 1,
          estimatedDuration: groupDuration,
        })->ignore

        totalDuration := totalDuration.contents + groupDuration

        // Mark as completed
        sortedReady->Array.forEach(id => {
          completed->Set.add(id)->ignore
        })

        // Remove from remaining
        remaining := remaining.contents->Array.filter(id =>
          !(sortedReady->Array.includes(id))
        )
      }
    }

    {
      groups,
      totalEstimatedDuration: totalDuration.contents,
      criticalPath: findCriticalPath(nodes),
      error: None,
    }
  }
}

/**
 * Get execution order (flattened schedule)
 */
let getExecutionOrder = (result: scheduleResult): array<string> => {
  result.groups->Array.flatMap(g => g.nodes)
}
