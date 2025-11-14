// Sprint 7 Day 63: Workflow Orchestrator
// Coordinates workflow execution with state management and task planning
// Integrates with Day 61 StateMachine and Day 62 TaskPlanner

open Core__Array

// ============================================================================
// Type Definitions
// ============================================================================

type workflowId = string
type taskId = string

// Workflow definition - the blueprint
@genType
type workflowDefinition = {
  id: workflowId,
  name: string,
  description: string,
  tasks: array<TaskPlanner.task>,
  maxRetries: int,
  timeout: option<int>, // milliseconds
  allowParallel: bool,
}

// Workflow execution status (mirrors state machine states)
@genType
type executionStatus =
  | Pending
  | Running
  | Paused
  | Completed
  | Failed
  | Cancelled
  | TimedOut

@genType
type taskExecution = {
  taskId: taskId,
  status: executionStatus,
  startTime: option<float>,
  endTime: option<float>,
  attempts: int,
  error: option<string>,
}

// Workflow state data (what the state machine manages)
type workflowStateData = {
  instanceId: string,
  workflowId: workflowId,
  currentTasks: array<taskId>,
  completedTasks: array<taskId>,
  failedTasks: array<taskId>,
  taskExecutions: Belt.Map.String.t<taskExecution>,
}

// Workflow events (what triggers state transitions)
type workflowEvent =
  | Start
  | Pause
  | Resume
  | Complete
  | Fail
  | Cancel
  | Timeout

// Workflow instance - runtime execution
@genType
type workflowInstance = {
  id: string,
  workflowId: workflowId,
  definition: workflowDefinition,
  plan: TaskPlanner.taskPlan,
  status: executionStatus,
  currentTasks: array<taskId>,
  completedTasks: array<taskId>,
  failedTasks: array<taskId>,
  taskExecutions: Belt.Map.String.t<taskExecution>,
  stateMachine: StateMachine.stateMachine<workflowStateData, workflowEvent>,
  createdAt: float,
  startedAt: option<float>,
  completedAt: option<float>,
  error: option<string>,
}

@genType
type workflowMetrics = {
  totalTasks: int,
  completedTasks: int,
  failedTasks: int,
  runningTasks: int,
  successRate: float,
  estimatedTimeRemaining: option<int>,
  actualDuration: option<int>,
}

@genType
type workflowEventData =
  | WorkflowCreated(string)
  | WorkflowStarted(string)
  | WorkflowPaused(string)
  | WorkflowResumed(string)
  | WorkflowCompleted(string)
  | WorkflowFailed(string, string)
  | WorkflowCancelled(string)
  | TaskStarted(string, taskId)
  | TaskCompleted(string, taskId)
  | TaskFailed(string, taskId, string)
  | TaskRetrying(string, taskId, int)

// ============================================================================
// Helper Functions
// ============================================================================

let getCurrentTime = () => Js.Date.now()

let executionStatusToString = status =>
  switch status {
  | Pending => "pending"
  | Running => "running"
  | Paused => "paused"
  | Completed => "completed"
  | Failed => "failed"
  | Cancelled => "cancelled"
  | TimedOut => "timedout"
  }

let stringToExecutionStatus = str =>
  switch str {
  | "pending" => Some(Pending)
  | "running" => Some(Running)
  | "paused" => Some(Paused)
  | "completed" => Some(Completed)
  | "failed" => Some(Failed)
  | "cancelled" => Some(Cancelled)
  | "timedout" => Some(TimedOut)
  | _ => None
  }

// Convert StateMachine.state to executionStatus
let stateToExecutionStatus = (state: StateMachine.state<workflowStateData>): executionStatus =>
  switch state {
  | Idle => Pending
  | Running(_) => Running
  | Paused(_) => Paused
  | Completed(_) => Completed
  | Failed(_) => Failed
  }

// ============================================================================
// State Machine Configuration
// ============================================================================

// Create workflow state machine transitions
let createWorkflowTransitions = (): array<
  StateMachine.transition<workflowStateData, workflowEvent>,
> => [
  // Pending -> Running (on Start)
  {
    from: Idle,
    event: Start,
    to: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Running -> Paused (on Pause)
  {
    from: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Pause,
    to: Paused({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Paused -> Running (on Resume)
  {
    from: Paused({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Resume,
    to: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Running -> Completed (on Complete)
  {
    from: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Complete,
    to: Completed({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Running -> Failed (on Fail)
  {
    from: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Fail,
    to: Failed("Workflow failed"),
    guard: None,
    action: None,
  },
  // Pending -> Cancelled (on Cancel)
  {
    from: Idle,
    event: Cancel,
    to: Completed({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Running -> Cancelled (on Cancel)
  {
    from: Running({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Cancel,
    to: Completed({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
  // Paused -> Cancelled (on Cancel)
  {
    from: Paused({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    event: Cancel,
    to: Completed({
      instanceId: "",
      workflowId: "",
      currentTasks: [],
      completedTasks: [],
      failedTasks: [],
      taskExecutions: Belt.Map.String.empty,
    }),
    guard: None,
    action: None,
  },
]

// ============================================================================
// Workflow Creation
// ============================================================================

@genType
let createWorkflowDefinition = (
  id: workflowId,
  name: string,
  description: string,
  tasks: array<TaskPlanner.task>,
  maxRetries: int,
  timeout: option<int>,
  allowParallel: bool,
): workflowDefinition => {
  id,
  name,
  description,
  tasks,
  maxRetries,
  timeout,
  allowParallel,
}

@genType
let createWorkflowInstance = (
  definition: workflowDefinition,
): result<workflowInstance, string> => {
  // Create task plan
  let planResult = TaskPlanner.plan(definition.tasks)

  switch planResult {
  | Error(error) => Error(error)
  | Ok(plan) => {
      // Create state machine for workflow
      let transitions = createWorkflowTransitions()
      let stateMachine = StateMachine.create(Idle, transitions, ())

      let instanceId = "instance-" ++ definition.id ++ "-" ++ Belt.Float.toString(getCurrentTime())

      let instance: workflowInstance = {
        id: instanceId,
        workflowId: definition.id,
        definition,
        plan,
        status: Pending,
        currentTasks: [],
        completedTasks: [],
        failedTasks: [],
        taskExecutions: Belt.Map.String.empty,
        stateMachine,
        createdAt: getCurrentTime(),
        startedAt: None,
        completedAt: None,
        error: None,
      }
      Ok(instance)
    }
  }
}

// ============================================================================
// Task Execution Management
// ============================================================================

let createTaskExecution = (taskId: taskId): taskExecution => {
  taskId,
  status: Pending,
  startTime: None,
  endTime: None,
  attempts: 0,
  error: None,
}

let startTaskExecution = (execution: taskExecution): taskExecution => {
  {
    ...execution,
    status: Running,
    startTime: Some(getCurrentTime()),
    attempts: execution.attempts + 1,
  }
}

let completeTaskExecution = (execution: taskExecution): taskExecution => {
  {
    ...execution,
    status: Completed,
    endTime: Some(getCurrentTime()),
  }
}

let failTaskExecution = (execution: taskExecution, error: string): taskExecution => {
  {
    ...execution,
    status: Failed,
    endTime: Some(getCurrentTime()),
    error: Some(error),
  }
}

// ============================================================================
// Workflow Execution
// ============================================================================

@genType
let startWorkflow = async (
  instance: workflowInstance,
): result<workflowInstance, string> => {
  // Create event
  let event = StateMachine.createEvent(~id="start", ~data=Start, ())

  // Transition state machine
  let transitionResult = await StateMachine.transition(instance.stateMachine, event)

  switch transitionResult {
  | Error(error) => Error(error)
  | Ok(_newState) => {
      // Get first tasks to execute
      let firstTasks = if length(instance.plan.parallelGroups) > 0 {
        Belt.Array.get(instance.plan.parallelGroups, 0)->Belt.Option.getWithDefault([])
      } else {
        []
      }

      // Initialize task executions
      let taskExecutions = Belt.Array.reduce(instance.plan.tasks, Belt.Map.String.empty, (
        acc,
        task,
      ) => {
        let execution = createTaskExecution(task.id)
        Belt.Map.String.set(acc, task.id, execution)
      })

      let updatedInstance: workflowInstance = {
        ...instance,
        status: Running,
        currentTasks: firstTasks,
        taskExecutions,
        startedAt: Some(getCurrentTime()),
      }

      Ok(updatedInstance)
    }
  }
}

@genType
let pauseWorkflow = async (
  instance: workflowInstance,
): result<workflowInstance, string> => {
  let event = StateMachine.createEvent(~id="pause", ~data=Pause, ())
  let transitionResult = await StateMachine.transition(instance.stateMachine, event)

  switch transitionResult {
  | Error(error) => Error(error)
  | Ok(_newState) =>
    Ok({
      ...instance,
      status: Paused,
    })
  }
}

@genType
let resumeWorkflow = async (
  instance: workflowInstance,
): result<workflowInstance, string> => {
  let event = StateMachine.createEvent(~id="resume", ~data=Resume, ())
  let transitionResult = await StateMachine.transition(instance.stateMachine, event)

  switch transitionResult {
  | Error(error) => Error(error)
  | Ok(_newState) =>
    Ok({
      ...instance,
      status: Running,
    })
  }
}

@genType
let cancelWorkflow = async (
  instance: workflowInstance,
): result<workflowInstance, string> => {
  let event = StateMachine.createEvent(~id="cancel", ~data=Cancel, ())
  let transitionResult = await StateMachine.transition(instance.stateMachine, event)

  switch transitionResult {
  | Error(error) => Error(error)
  | Ok(_newState) =>
    Ok({
      ...instance,
      status: Cancelled,
      completedAt: Some(getCurrentTime()),
    })
  }
}

// ============================================================================
// Task Completion Handling
// ============================================================================

let getNextTasks = (
  plan: TaskPlanner.taskPlan,
  completedTasksList: array<taskId>,
  completedTaskId: taskId,
): array<taskId> => {
  // Find which parallel group the completed task belongs to
  let currentGroupIndex = Belt.Array.reduceWithIndex(
    plan.parallelGroups,
    None,
    (acc, group, index) => {
      switch acc {
      | Some(_) => acc
      | None =>
        if Belt.Array.some(group, id => id === completedTaskId) {
          Some(index)
        } else {
          None
        }
      }
    },
  )

  switch currentGroupIndex {
  | None => []
  | Some(groupIndex) => {
      // Check if all tasks in current group are completed
      let currentGroup =
        Belt.Array.get(plan.parallelGroups, groupIndex)->Belt.Option.getWithDefault([])
      let allCompleted = Belt.Array.every(currentGroup, taskId =>
        Belt.Array.some(completedTasksList, id => id === taskId)
      )

      if allCompleted {
        // Move to next group
        Belt.Array.get(plan.parallelGroups, groupIndex + 1)->Belt.Option.getWithDefault(
          [],
        )
      } else {
        // Stay in current group
        []
      }
    }
  }
}

@genType
let completeTask = async (
  instance: workflowInstance,
  taskId: taskId,
): result<workflowInstance, string> => {
  // Get task execution
  let executionOpt = Belt.Map.String.get(instance.taskExecutions, taskId)

  switch executionOpt {
  | None => Error("Task execution not found: " ++ taskId)
  | Some(execution) => {
      // Update task execution
      let completedExecution = completeTaskExecution(execution)
      let updatedExecutions = Belt.Map.String.set(
        instance.taskExecutions,
        taskId,
        completedExecution,
      )

      // Add to completed tasks
      let completedTasks = concat(instance.completedTasks, [taskId])

      // Remove from current tasks
      let currentTasks = Belt.Array.keep(instance.currentTasks, id => id !== taskId)

      // Get next tasks (pass updated completedTasks list)
      let nextTasks = getNextTasks(instance.plan, completedTasks, taskId)
      let newCurrentTasks = concat(currentTasks, nextTasks)

      // Start executions for next tasks
      let updatedExecutions2 = Belt.Array.reduce(nextTasks, updatedExecutions, (acc, nextId) => {
        let execOpt = Belt.Map.String.get(acc, nextId)
        switch execOpt {
        | None => acc
        | Some(exec) => {
            let startedExec = startTaskExecution(exec)
            Belt.Map.String.set(acc, nextId, startedExec)
          }
        }
      })

      // Check if workflow is complete
      let isComplete = length(completedTasks) === length(instance.plan.tasks)

      if isComplete {
        let event = StateMachine.createEvent(~id="complete", ~data=Complete, ())
        let transitionResult = await StateMachine.transition(instance.stateMachine, event)
        switch transitionResult {
        | Error(error) => Error(error)
        | Ok(_newState) =>
          Ok({
            ...instance,
            status: Completed,
            currentTasks: newCurrentTasks,
            completedTasks,
            taskExecutions: updatedExecutions2,
            completedAt: Some(getCurrentTime()),
          })
        }
      } else {
        Ok({
          ...instance,
          currentTasks: newCurrentTasks,
          completedTasks,
          taskExecutions: updatedExecutions2,
        })
      }
    }
  }
}

@genType
let failTask = async (
  instance: workflowInstance,
  taskId: taskId,
  error: string,
): result<workflowInstance, string> => {
  // Get task execution
  let executionOpt = Belt.Map.String.get(instance.taskExecutions, taskId)

  switch executionOpt {
  | None => Error("Task execution not found: " ++ taskId)
  | Some(execution) => {
      // Check if we can retry
      let canRetry = execution.attempts < instance.definition.maxRetries

      if canRetry {
        // Retry task
        let retriedExecution = startTaskExecution(execution)
        let updatedExecutions = Belt.Map.String.set(
          instance.taskExecutions,
          taskId,
          retriedExecution,
        )

        Ok({
          ...instance,
          taskExecutions: updatedExecutions,
        })
      } else {
        // Task failed permanently
        let failedExecution = failTaskExecution(execution, error)
        let updatedExecutions = Belt.Map.String.set(
          instance.taskExecutions,
          taskId,
          failedExecution,
        )

        let failedTasks = concat(instance.failedTasks, [taskId])
        let currentTasks = Belt.Array.keep(instance.currentTasks, id => id !== taskId)

        // Fail the entire workflow
        let event = StateMachine.createEvent(~id="fail", ~data=Fail, ())
        let transitionResult = await StateMachine.transition(instance.stateMachine, event)
        switch transitionResult {
        | Error(err) => Error(err)
        | Ok(_newState) =>
          Ok({
            ...instance,
            status: Failed,
            currentTasks,
            failedTasks,
            taskExecutions: updatedExecutions,
            completedAt: Some(getCurrentTime()),
            error: Some("Task failed: " ++ taskId ++ " - " ++ error),
          })
        }
      }
    }
  }
}

// ============================================================================
// Workflow Metrics
// ============================================================================

@genType
let getWorkflowMetrics = (instance: workflowInstance): workflowMetrics => {
  let totalTasks = length(instance.plan.tasks)
  let completedTasks = length(instance.completedTasks)
  let failedTasks = length(instance.failedTasks)
  let runningTasks = length(instance.currentTasks)

  let successRate = if totalTasks > 0 {
    Belt.Int.toFloat(completedTasks) /. Belt.Int.toFloat(totalTasks)
  } else {
    0.0
  }

  let estimatedTimeRemaining = switch instance.status {
  | Running => {
      let remainingTasks = totalTasks - completedTasks
      if remainingTasks > 0 {
        // Rough estimate based on plan
        Some(instance.plan.estimatedTotalTime)
      } else {
        Some(0)
      }
    }
  | _ => None
  }

  let actualDuration = switch (instance.startedAt, instance.completedAt) {
  | (Some(start), Some(end_)) => Some(Belt.Float.toInt(end_ -. start))
  | (Some(start), None) => Some(Belt.Float.toInt(getCurrentTime() -. start))
  | _ => None
  }

  {
    totalTasks,
    completedTasks,
    failedTasks,
    runningTasks,
    successRate,
    estimatedTimeRemaining,
    actualDuration,
  }
}

// ============================================================================
// Workflow Query Functions
// ============================================================================

@genType
let isWorkflowComplete = (instance: workflowInstance): bool => {
  switch instance.status {
  | Completed | Failed | Cancelled | TimedOut => true
  | _ => false
  }
}

@genType
let isWorkflowRunning = (instance: workflowInstance): bool => {
  switch instance.status {
  | Running => true
  | _ => false
  }
}

@genType
let getTaskStatus = (instance: workflowInstance, taskId: taskId): option<executionStatus> => {
  Belt.Map.String.get(instance.taskExecutions, taskId)->Belt.Option.map(exec => exec.status)
}

@genType
let getRunningTasks = (instance: workflowInstance): array<taskId> => {
  instance.currentTasks
}

@genType
let getCompletedTasks = (instance: workflowInstance): array<taskId> => {
  instance.completedTasks
}

@genType
let getFailedTasks = (instance: workflowInstance): array<taskId> => {
  instance.failedTasks
}

@genType
let getWorkflowProgress = (instance: workflowInstance): float => {
  let total = length(instance.plan.tasks)
  if total === 0 {
    1.0
  } else {
    Belt.Int.toFloat(length(instance.completedTasks)) /. Belt.Int.toFloat(total)
  }
}
