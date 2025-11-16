// TaskPlanner.res
// Day 62: Task Planning Engine - Dependency resolution, parallel planning, critical path analysis
// AutomatosX - Sprint 7, Week 1

open Core__Option
open Core__Array

// ============================================================================
// Type Definitions
// ============================================================================

type taskId = string
type resourceId = string

type task = {
  id: taskId,
  name: string,
  estimatedDuration: int, // minutes
  dependencies: array<taskId>,
  requiredResources: array<resourceId>,
  priority: int, // 1-10 (10 is highest)
}

type taskPlan = {
  tasks: array<task>,
  executionOrder: array<taskId>,
  parallelGroups: array<array<taskId>>,
  criticalPath: array<taskId>,
  estimatedTotalTime: int,
}

// Internal type for graph traversal
type visitState = Unvisited | Visiting | Visited

type taskNode = {
  task: task,
  mutable visitState: visitState,
  mutable level: int, // Execution level for parallel grouping
  mutable earliestStart: int,
  mutable latestStart: int,
}

// ============================================================================
// Task Creation
// ============================================================================

@genType
let createTask = (
  id: taskId,
  name: string,
  estimatedDuration: int,
  dependencies: array<taskId>,
  requiredResources: array<resourceId>,
  priority: int,
): task => {
  {
    id,
    name,
    estimatedDuration,
    dependencies,
    requiredResources,
    priority: max(1, min(10, priority)), // Clamp priority to 1-10
  }
}

// ============================================================================
// Dependency Resolution with Topological Sort
// ============================================================================

let createTaskNodeMap = (tasks: array<task>): Belt.Map.String.t<taskNode> => {
  let nodeMap = Belt.Map.String.empty

  tasks->reduce(nodeMap, (acc, task) => {
    let node = {
      task,
      visitState: Unvisited,
      level: 0,
      earliestStart: 0,
      latestStart: 0,
    }
    acc->Belt.Map.String.set(task.id, node)
  })
}

// Detect circular dependencies using DFS
let rec detectCycle = (
  nodeId: taskId,
  nodeMap: Belt.Map.String.t<taskNode>,
  path: array<taskId>,
): option<array<taskId>> => {
  switch nodeMap->Belt.Map.String.get(nodeId) {
  | None => None // Missing dependency, handled separately
  | Some(node) =>
    switch node.visitState {
    | Visited => None // Already fully processed
    | Visiting => Some(concat(path, [nodeId])) // Cycle detected!
    | Unvisited => {
        node.visitState = Visiting
        let newPath = concat(path, [nodeId])

        // Check all dependencies for cycles
        let cycleFound = node.task.dependencies->reduce(None, (acc, depId) => {
          switch acc {
          | Some(_) => acc // Already found a cycle
          | None => detectCycle(depId, nodeMap, newPath)
          }
        })

        node.visitState = Visited
        cycleFound
      }
    }
  }
}

// Topological sort using DFS
let rec topologicalSortVisit = (
  nodeId: taskId,
  nodeMap: Belt.Map.String.t<taskNode>,
  result: array<taskId>,
): array<taskId> => {
  switch nodeMap->Belt.Map.String.get(nodeId) {
  | None => result // Missing dependency
  | Some(node) =>
    if node.visitState === Visited {
      result
    } else {
      node.visitState = Visiting

      // Visit all dependencies first
      let afterDeps = node.task.dependencies->reduce(result, (acc, depId) => {
        topologicalSortVisit(depId, nodeMap, acc)
      })

      node.visitState = Visited
      concat(afterDeps, [nodeId]) // Add current node after dependencies
    }
  }
}

@genType
let resolveDependencies = (tasks: array<task>): result<array<taskId>, string> => {
  if length(tasks) === 0 {
    Ok([])
  } else {
    let nodeMap = createTaskNodeMap(tasks)

    // First, check for circular dependencies
    let rec checkCycles = (idx: int): option<string> => {
      if idx >= length(tasks) {
        None
      } else {
        let task = getUnsafe(tasks, idx)
        let node = nodeMap->Belt.Map.String.get(task.id)

        switch node {
        | None => checkCycles(idx + 1)
        | Some(n) =>
          if n.visitState === Unvisited {
            switch detectCycle(task.id, nodeMap, []) {
            | Some(cycle) => {
                let cycleStr = join(cycle, " -> ")
                Some(`Cycle detected: ${cycleStr}`)
              }
            | None => checkCycles(idx + 1)
            }
          } else {
            checkCycles(idx + 1)
          }
        }
      }
    }

    switch checkCycles(0) {
    | Some(errorMsg) => Error(errorMsg)
    | None => {
        // Reset visit states for topological sort
        nodeMap->Belt.Map.String.forEach((_, node) => {
          node.visitState = Unvisited
        })

        // Perform topological sort
        let sorted = tasks->reduce([], (acc, task) => {
          topologicalSortVisit(task.id, nodeMap, acc)
        })

        // Validate that all dependencies exist
        let missingDeps = tasks->reduce([], (acc, task) => {
          let missing = Belt.Array.keep(task.dependencies, depId => {
            nodeMap->Belt.Map.String.get(depId)->isNone
          })
          concat(acc, missing)
        })

        if length(missingDeps) > 0 {
          let missingStr = join(missingDeps, ", ")
          Error(`Missing dependencies: ${missingStr}`)
        } else {
          Ok(sorted)
        }
      }
    }
  }
}

// ============================================================================
// Parallel Execution Planning
// ============================================================================

let calculateExecutionLevels = (
  tasks: array<task>,
  executionOrder: array<taskId>,
): Belt.Map.String.t<int> => {
  let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))
  let levelMap = Belt.Map.String.empty

  executionOrder->reduce(levelMap, (acc, taskId) => {
    switch taskMap->Belt.Map.String.get(taskId) {
    | None => acc
    | Some(task) => {
        // A task's level is 1 + max(levels of dependencies)
        let depLevels =
          task.dependencies->map(depId => {
            acc->Belt.Map.String.get(depId)->getWithDefault(0)
          })

        let maxDepLevel = depLevels->reduce(0, (a, b) => max(a, b))
        acc->Belt.Map.String.set(taskId, maxDepLevel + 1)
      }
    }
  })
}

let groupByResourceConflicts = (
  tasksAtLevel: array<task>,
): array<array<task>> => {
  if length(tasksAtLevel) <= 1 {
    [tasksAtLevel]
  } else {
    // Simple greedy grouping: tasks can be in same group if they don't share resources
    // Recursive helper function to process remaining tasks
    let rec processRemaining = (remaining: array<task>, groups: array<array<task>>): array<array<task>> => {
      if length(remaining) === 0 {
        groups
      } else {
        // Process one iteration: split remaining into currentGroup and nextRemaining
        let (currentGroup, nextRemaining, _usedResources) = remaining->reduce(([], [], Belt.Set.String.empty), ((group, next, used), task) => {
          let taskResources = Belt.Set.String.fromArray(task.requiredResources)
          let hasConflict = Belt.Set.String.intersect(taskResources, used)->Belt.Set.String.size > 0

          if !hasConflict {
            (concat(group, [task]), next, Belt.Set.String.union(used, taskResources))
          } else {
            (group, concat(next, [task]), used)
          }
        })

        processRemaining(nextRemaining, concat(groups, [currentGroup]))
      }
    }

    processRemaining(tasksAtLevel, [])
  }
}

@genType
let findParallelGroups = (
  tasks: array<task>,
  executionOrder: array<taskId>,
): array<array<taskId>> => {
  let levelMap = calculateExecutionLevels(tasks, executionOrder)
  let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))

  // Group tasks by execution level
  let levelGroups = executionOrder->reduce(Belt.Map.Int.empty, (acc, taskId) => {
    switch levelMap->Belt.Map.String.get(taskId) {
    | None => acc
    | Some(level) => {
        let existing = acc->Belt.Map.Int.get(level)->getWithDefault([])
        acc->Belt.Map.Int.set(level, concat(existing, [taskId]))
      }
    }
  })

  // For each level, split into parallel groups based on resource conflicts
  let allGroups = []

  levelGroups->Belt.Map.Int.forEach((_, taskIds) => {
    let tasksAtLevel =
      Belt.Array.keepMap(taskIds, id => taskMap->Belt.Map.String.get(id))

    let subGroups = groupByResourceConflicts(tasksAtLevel)

    subGroups->forEach(group => {
      let ids = group->map(t => t.id)
      push(allGroups, ids)
    })
  })

  allGroups
}

// ============================================================================
// Critical Path Analysis
// ============================================================================

let calculateEarliestStarts = (
  tasks: array<task>,
  executionOrder: array<taskId>,
): Belt.Map.String.t<int> => {
  let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))
  let earliestStarts = Belt.Map.String.empty

  executionOrder->reduce(earliestStarts, (acc, taskId) => {
    switch taskMap->Belt.Map.String.get(taskId) {
    | None => acc
    | Some(task) => {
        // Earliest start is max(earliest finish of all dependencies)
        let depFinishes =
          task.dependencies->map(depId => {
            let depStart = acc->Belt.Map.String.get(depId)->getWithDefault(0)
            let depTask = taskMap->Belt.Map.String.get(depId)
            let depDuration = depTask->Core__Option.map(t => t.estimatedDuration)->getWithDefault(0)
            depStart + depDuration
          })

        let earliestStart = depFinishes->reduce(0, (a, b) => max(a, b))
        acc->Belt.Map.String.set(taskId, earliestStart)
      }
    }
  })
}

let calculateLatestStarts = (
  tasks: array<task>,
  executionOrder: array<taskId>,
  projectEndTime: int,
): Belt.Map.String.t<int> => {
  let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))
  let latestStarts = Belt.Map.String.empty

  // Process in reverse order
  let reversed = Belt.Array.reverse(executionOrder)

  Belt.Array.reduce(reversed, latestStarts, (acc, taskId) => {
    switch taskMap->Belt.Map.String.get(taskId) {
    | None => acc
    | Some(task) => {
        // Find all tasks that depend on this task
        let dependents = Belt.Array.keep(tasks, t => {
          Belt.Array.some(t.dependencies, depId => depId === taskId)
        })

        let latestStart = if length(dependents) === 0 {
          // This is a final task - must finish by project end
          projectEndTime - task.estimatedDuration
        } else {
          // Latest start is min(latest start of all dependents) - duration
          let depStarts = Belt.Array.map(dependents, dep => {
            acc->Belt.Map.String.get(dep.id)->getWithDefault(projectEndTime)
          })
          let minDepStart = Belt.Array.reduce(depStarts, projectEndTime, (a, b) => min(a, b))
          minDepStart - task.estimatedDuration
        }

        acc->Belt.Map.String.set(taskId, latestStart)
      }
    }
  })
}

@genType
let findCriticalPath = (
  tasks: array<task>,
  executionOrder: array<taskId>,
): array<taskId> => {
  if length(tasks) === 0 || length(executionOrder) === 0 {
    []
  } else {

  let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))

  // Calculate earliest and latest starts
  let earliestStarts = calculateEarliestStarts(tasks, executionOrder)

  // Find project end time (max earliest finish)
  let projectEndTime = Belt.Array.reduce(executionOrder, 0, (acc, taskId) => {
    let start = earliestStarts->Belt.Map.String.get(taskId)->getWithDefault(0)
    let duration = taskMap->Belt.Map.String.get(taskId)->Core__Option.map(t => t.estimatedDuration)->getWithDefault(0)
    max(acc, start + duration)
  })

  let latestStarts = calculateLatestStarts(tasks, executionOrder, projectEndTime)

  // Critical tasks have slack = 0 (earliest start === latest start)
  let criticalTasks = Belt.Array.keep(executionOrder, taskId => {
    let earliest = earliestStarts->Belt.Map.String.get(taskId)->getWithDefault(0)
    let latest = latestStarts->Belt.Map.String.get(taskId)->getWithDefault(0)
    earliest === latest
  })

  criticalTasks
  }
}

// ============================================================================
// Plan Validation
// ============================================================================

@genType
let validatePlan = (plan: taskPlan): result<unit, array<string>> => {
  let errors = []

  // Check: execution order should include all tasks
  if length(plan.executionOrder) !== length(plan.tasks) {
    push(errors, "Execution order length mismatch")
  }

  // Check: all tasks in execution order exist
  let taskIds = Belt.Set.String.fromArray(plan.tasks->map(t => t.id))
  plan.executionOrder->forEach(id => {
    if !Belt.Set.String.has(taskIds, id) {
      push(errors, `Task ${id} in execution order but not in tasks`)
    }
  })

  // Check: all dependencies are satisfied (dependency comes before dependent)
  let taskMap = Belt.Map.String.fromArray(plan.tasks->map(t => (t.id, t)))

  let (dependencyErrors, _) = plan.executionOrder->reduce(([], Belt.Set.String.empty), ((errs, seenTasks), taskId) => {
    switch taskMap->Belt.Map.String.get(taskId) {
    | None => (errs, seenTasks)
    | Some(task) => {
        let newErrors = task.dependencies->reduce(errs, (acc, depId) => {
          if !Belt.Set.String.has(seenTasks, depId) {
            concat(acc, [`Task ${taskId} scheduled before dependency ${depId}`])
          } else {
            acc
          }
        })
        (newErrors, Belt.Set.String.add(seenTasks, taskId))
      }
    }
  })

  dependencyErrors->forEach(err => push(errors, err))

  // Check: parallel groups are valid (no dependencies within group)
  plan.parallelGroups->forEach(group => {
    for i in 0 to length(group) - 1 {
      let taskId = getUnsafe(group, i)
      switch taskMap->Belt.Map.String.get(taskId) {
      | None => ()
      | Some(task) => {
          let groupSet = Belt.Set.String.fromArray(group)
          task.dependencies->forEach(depId => {
            if Belt.Set.String.has(groupSet, depId) {
              push(errors, `Task ${taskId} depends on ${depId} in same parallel group`)
            }
          })
        }
      }
    }
  })

  if length(errors) === 0 {
    Ok()
  } else {
    Error(errors)
  }
}

// ============================================================================
// Plan Optimization
// ============================================================================

@genType
let optimizePlan = (plan: taskPlan): taskPlan => {
  // Optimization 1: Reorder tasks within same level by priority (higher first)
  let levelMap = calculateExecutionLevels(plan.tasks, plan.executionOrder)
  let taskMap = Belt.Map.String.fromArray(plan.tasks->map(t => (t.id, t)))

  // Group by level
  let levels = plan.executionOrder->reduce(Belt.Map.Int.empty, (acc, taskId) => {
    let level = levelMap->Belt.Map.String.get(taskId)->getWithDefault(0)
    let existing = acc->Belt.Map.Int.get(level)->getWithDefault([])
    acc->Belt.Map.Int.set(level, concat(existing, [taskId]))
  })

  // Sort each level by priority
  let maxLevel = levels->Belt.Map.Int.keysToArray->reduce(0, (a, b) => max(a, b))

  let optimizedOrder = Core__Array.fromInitializer(~length=maxLevel, i => i + 1)->reduce([], (acc, level) => {
    switch levels->Belt.Map.Int.get(level) {
    | None => acc
    | Some(taskIds) => {
        let sorted = taskIds->toSorted((a, b) => {
          let taskA = taskMap->Belt.Map.String.get(a)
          let taskB = taskMap->Belt.Map.String.get(b)

          switch (taskA, taskB) {
          | (Some(ta), Some(tb)) => Belt.Int.toFloat(tb.priority - ta.priority) // Higher priority first
          | _ => 0.
          }
        })
        concat(acc, sorted)
      }
    }
  })

  // Recalculate parallel groups and critical path with optimized order
  let parallelGroups = findParallelGroups(plan.tasks, optimizedOrder)
  let criticalPath = findCriticalPath(plan.tasks, optimizedOrder)

  {
    ...plan,
    executionOrder: optimizedOrder,
    parallelGroups,
    criticalPath,
  }
}

// ============================================================================
// Main Planning Function
// ============================================================================

@genType
let plan = (tasks: array<task>): result<taskPlan, string> => {
  // Step 1: Resolve dependencies and get execution order
  switch resolveDependencies(tasks) {
  | Error(msg) => Error(msg)
  | Ok(executionOrder) => {
      // Step 2: Find parallel execution groups
      let parallelGroups = findParallelGroups(tasks, executionOrder)

      // Step 3: Find critical path
      let criticalPath = findCriticalPath(tasks, executionOrder)

      // Step 4: Calculate estimated total time
      let taskMap = Belt.Map.String.fromArray(Belt.Array.map(tasks, t => (t.id, t)))
      let earliestStarts = calculateEarliestStarts(tasks, executionOrder)

      let estimatedTotalTime = Belt.Array.reduce(executionOrder, 0, (acc, taskId) => {
        let start = earliestStarts->Belt.Map.String.get(taskId)->getWithDefault(0)
        let duration = taskMap->Belt.Map.String.get(taskId)->Core__Option.map(t => t.estimatedDuration)->getWithDefault(0)
        max(acc, start + duration)
      })

      // Step 5: Create plan
      let taskPlan = {
        tasks,
        executionOrder,
        parallelGroups,
        criticalPath,
        estimatedTotalTime,
      }

      // Step 6: Validate
      switch validatePlan(taskPlan) {
      | Error(errors) => {
          let errorStr = join(errors, "; ")
          Error(`Plan validation failed: ${errorStr}`)
        }
      | Ok() => {
          // Step 7: Optimize
          let optimized = optimizePlan(taskPlan)
          Ok(optimized)
        }
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

@genType
let getTaskById = (plan: taskPlan, taskId: taskId): option<task> => {
  Belt.Array.getBy(plan.tasks, t => t.id === taskId)
}

@genType
let getTotalSlack = (plan: taskPlan): int => {
  // Slack = tasks not on critical path
  let criticalSet = Belt.Set.String.fromArray(plan.criticalPath)
  let nonCritical = Belt.Array.keep(plan.tasks, t => !Belt.Set.String.has(criticalSet, t.id))
  length(nonCritical)
}

@genType
let getMaxParallelism = (plan: taskPlan): int => {
  // Maximum number of tasks that can run in parallel at any point
  plan.parallelGroups->reduce(0, (acc, group) => max(acc, length(group)))
}

@genType
let getPlanStatistics = (plan: taskPlan): {
  "totalTasks": int,
  "criticalPathLength": int,
  "maxParallelism": int,
  "estimatedTime": int,
  "totalSlack": int,
} => {
  {
    "totalTasks": length(plan.tasks),
    "criticalPathLength": length(plan.criticalPath),
    "maxParallelism": getMaxParallelism(plan),
    "estimatedTime": plan.estimatedTotalTime,
    "totalSlack": getTotalSlack(plan),
  }
}
