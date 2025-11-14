// WorkflowTypes.res - Day 1: Type definitions for workflow system
// Complete type system for workflow definitions, steps, and execution

module StepType = {
  type t =
    | AgentTask
    | HttpRequest
    | FileOperation
    | DatabaseQuery
    | SemanticSearch
    | Transform
    | Conditional
    | Parallel
    | Sequential

  let toString = (stepType: t): string => {
    switch stepType {
    | AgentTask => "agent_task"
    | HttpRequest => "http_request"
    | FileOperation => "file_operation"
    | DatabaseQuery => "database_query"
    | SemanticSearch => "semantic_search"
    | Transform => "transform"
    | Conditional => "conditional"
    | Parallel => "parallel"
    | Sequential => "sequential"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "agent_task" => Some(AgentTask)
    | "http_request" => Some(HttpRequest)
    | "file_operation" => Some(FileOperation)
    | "database_query" => Some(DatabaseQuery)
    | "semantic_search" => Some(SemanticSearch)
    | "transform" => Some(Transform)
    | "conditional" => Some(Conditional)
    | "parallel" => Some(Parallel)
    | "sequential" => Some(Sequential)
    | _ => None
    }
  }
}

module StepConfig = {
  type agentTask = {
    agent: string, // "@backend", "@security", etc.
    task: string,
    context: option<Js.Dict.t<string>>,
  }

  type httpRequest = {
    method: string, // "GET", "POST", etc.
    url: string,
    headers: option<Js.Dict.t<string>>,
    body: option<string>,
    timeout: option<int>,
  }

  type fileOperation = {
    operation: string, // "read", "write", "delete", "copy"
    path: string,
    content: option<string>,
    encoding: option<string>,
  }

  type databaseQuery = {
    query: string,
    params: option<array<string>>,
    database: option<string>,
  }

  type semanticSearch = {
    query: string,
    mode: string, // "semantic", "hybrid", "fts5"
    limit: option<int>,
    filters: option<Js.Dict.t<string>>,
  }

  type transform = {
    input: string, // Variable name or expression
    function: string, // "map", "filter", "reduce", "custom"
    code: option<string>, // JavaScript code for custom transforms
  }

  type conditional = {
    condition: string, // Boolean expression
    thenSteps: array<string>, // Step IDs to execute if true
    elseSteps: option<array<string>>, // Step IDs to execute if false
  }

  type parallel = {
    steps: array<string>, // Step IDs to execute in parallel
    maxConcurrency: option<int>,
  }

  type sequential = {
    steps: array<string>, // Step IDs to execute sequentially
  }

  type t =
    | AgentTask(agentTask)
    | HttpRequest(httpRequest)
    | FileOperation(fileOperation)
    | DatabaseQuery(databaseQuery)
    | SemanticSearch(semanticSearch)
    | Transform(transform)
    | Conditional(conditional)
    | Parallel(parallel)
    | Sequential(sequential)
}

module StepDefinition = {
  type t = {
    id: string,
    name: string,
    stepType: StepType.t,
    config: StepConfig.t,
    dependsOn: array<string>, // Step IDs this step depends on
    timeout: option<int>, // Timeout in milliseconds
    retries: option<int>, // Number of retry attempts
    continueOnError: bool, // Continue workflow if this step fails
  }

  let make = (
    ~id: string,
    ~name: string,
    ~stepType: StepType.t,
    ~config: StepConfig.t,
    ~dependsOn: option<array<string>>=?,
    ~timeout: option<int>=?,
    ~retries: option<int>=?,
    ~continueOnError: bool=false,
    (),
  ): t => {
    {
      id,
      name,
      stepType,
      config,
      dependsOn: Belt.Option.getWithDefault(dependsOn, []),
      timeout,
      retries,
      continueOnError,
    }
  }

  let getId = (step: t): string => step.id

  let getName = (step: t): string => step.name

  let getType = (step: t): StepType.t => step.stepType

  let getDependencies = (step: t): array<string> => step.dependsOn

  let hasDependencies = (step: t): bool => {
    Belt.Array.length(step.dependsOn) > 0
  }

  let canRetry = (step: t): bool => {
    switch step.retries {
    | Some(retries) => retries > 0
    | None => false
    }
  }
}

module WorkflowMetadata = {
  type t = {
    name: string,
    description: option<string>,
    version: option<string>,
    author: option<string>,
    tags: array<string>,
    createdAt: option<float>,
    updatedAt: option<float>,
  }

  let make = (
    ~name: string,
    ~description: option<string>=?,
    ~version: option<string>=?,
    ~author: option<string>=?,
    ~tags: option<array<string>>=?,
    (),
  ): t => {
    {
      name,
      description,
      version,
      author,
      tags: Belt.Option.getWithDefault(tags, []),
      createdAt: Some(Js.Date.now()),
      updatedAt: None,
    }
  }

  let getName = (metadata: t): string => metadata.name

  let getVersion = (metadata: t): option<string> => metadata.version

  let getTags = (metadata: t): array<string> => metadata.tags

  let hasTag = (metadata: t, tag: string): bool => {
    Belt.Array.some(metadata.tags, t => t == tag)
  }
}

module VariableDefinition = {
  type varType =
    | String
    | Number
    | Boolean
    | Object
    | Array

  type t = {
    name: string,
    varType: varType,
    defaultValue: option<string>,
    required: bool,
    description: option<string>,
  }

  let make = (
    ~name: string,
    ~varType: varType,
    ~defaultValue: option<string>=?,
    ~required: bool=false,
    ~description: option<string>=?,
    (),
  ): t => {
    {
      name,
      varType,
      defaultValue,
      required,
      description,
    }
  }

  let typeToString = (varType: varType): string => {
    switch varType {
    | String => "string"
    | Number => "number"
    | Boolean => "boolean"
    | Object => "object"
    | Array => "array"
    }
  }

  let typeFromString = (str: string): option<varType> => {
    switch str {
    | "string" => Some(String)
    | "number" => Some(Number)
    | "boolean" => Some(Boolean)
    | "object" => Some(Object)
    | "array" => Some(Array)
    | _ => None
    }
  }
}

module WorkflowDefinition = {
  type t = {
    id: string,
    metadata: WorkflowMetadata.t,
    variables: array<VariableDefinition.t>,
    steps: array<StepDefinition.t>,
    onSuccess: option<array<string>>, // Step IDs to execute on success
    onFailure: option<array<string>>, // Step IDs to execute on failure
    onCancel: option<array<string>>, // Step IDs to execute on cancel
  }

  let make = (
    ~id: string,
    ~metadata: WorkflowMetadata.t,
    ~variables: option<array<VariableDefinition.t>>=?,
    ~steps: array<StepDefinition.t>,
    ~onSuccess: option<array<string>>=?,
    ~onFailure: option<array<string>>=?,
    ~onCancel: option<array<string>>=?,
    (),
  ): t => {
    {
      id,
      metadata,
      variables: Belt.Option.getWithDefault(variables, []),
      steps,
      onSuccess,
      onFailure,
      onCancel,
    }
  }

  let getId = (workflow: t): string => workflow.id

  let getName = (workflow: t): string => workflow.metadata.name

  let getSteps = (workflow: t): array<StepDefinition.t> => workflow.steps

  let getStepById = (workflow: t, stepId: string): option<StepDefinition.t> => {
    Belt.Array.getBy(workflow.steps, step => step.id == stepId)
  }

  let getVariables = (workflow: t): array<VariableDefinition.t> => workflow.variables

  let getRequiredVariables = (workflow: t): array<VariableDefinition.t> => {
    Belt.Array.keep(workflow.variables, v => v.required)
  }

  let hasStep = (workflow: t, stepId: string): bool => {
    Belt.Array.some(workflow.steps, step => step.id == stepId)
  }

  let getStepCount = (workflow: t): int => {
    Belt.Array.length(workflow.steps)
  }
}

module DependencyGraph = {
  type node = {
    stepId: string,
    dependencies: array<string>,
    dependents: array<string>,
    level: int, // Topological level (0 = no dependencies)
  }

  type t = {
    nodes: array<node>,
    levels: array<array<string>>, // Steps grouped by level for parallel execution
  }

  let makeNode = (~stepId: string, ~dependencies: array<string>, ~level: int): node => {
    {
      stepId,
      dependencies,
      dependents: [],
      level,
    }
  }

  let make = (steps: array<StepDefinition.t>): t => {
    // Build initial nodes
    let nodes = Belt.Array.map(steps, step => {
      makeNode(~stepId=step.id, ~dependencies=step.dependsOn, ~level=0)
    })

    // Calculate topological levels
    let rec calculateLevels = (nodes: array<node>, maxIterations: int): array<node> => {
      if maxIterations <= 0 {
        nodes // Prevent infinite loops
      } else {
        let updated = Belt.Array.map(nodes, node => {
          if Belt.Array.length(node.dependencies) == 0 {
            {...node, level: 0}
          } else {
            let maxDepLevel = Belt.Array.reduce(node.dependencies, 0, (acc, depId) => {
              switch Belt.Array.getBy(nodes, n => n.stepId == depId) {
              | Some(depNode) => max(acc, depNode.level)
              | None => acc
              }
            })
            {...node, level: maxDepLevel + 1}
          }
        })

        // Check if any levels changed
        let changed = Belt.Array.some(Belt.Array.zip(nodes, updated), ((old, updated)) => {
          old.level != updated.level
        })

        if changed {
          calculateLevels(updated, maxIterations - 1)
        } else {
          updated
        }
      }
    }

    let leveledNodes = calculateLevels(nodes, 100) // Max 100 iterations

    // Group steps by level
    let maxLevel = Belt.Array.reduce(leveledNodes, 0, (acc, node) => max(acc, node.level))
    let levels = Belt.Array.makeBy(maxLevel + 1, level => {
      Belt.Array.keepMap(leveledNodes, node => {
        if node.level == level {
          Some(node.stepId)
        } else {
          None
        }
      })
    })

    {nodes: leveledNodes, levels}
  }

  let getNode = (graph: t, stepId: string): option<node> => {
    Belt.Array.getBy(graph.nodes, n => n.stepId == stepId)
  }

  let getLevel = (graph: t, stepId: string): option<int> => {
    switch getNode(graph, stepId) {
    | Some(node) => Some(node.level)
    | None => None
    }
  }

  let getLevelSteps = (graph: t, level: int): array<string> => {
    switch Belt.Array.get(graph.levels, level) {
    | Some(steps) => steps
    | None => []
    }
  }

  let getMaxLevel = (graph: t): int => {
    Belt.Array.length(graph.levels) - 1
  }

  let hasCycle = (graph: t): bool => {
    // If any node has dependencies that are also dependents, there's a cycle
    Belt.Array.some(graph.nodes, node => {
      Belt.Array.some(node.dependencies, depId => {
        Belt.Array.some(node.dependents, dependentId => depId == dependentId)
      })
    })
  }

  let getExecutionOrder = (graph: t): array<array<string>> => {
    graph.levels
  }

  let canExecuteInParallel = (graph: t, stepIds: array<string>): bool => {
    // Steps can execute in parallel if they're at the same level
    switch Belt.Array.get(stepIds, 0) {
    | None => false
    | Some(firstId) => {
        switch getLevel(graph, firstId) {
        | None => false
        | Some(level) => {
            Belt.Array.every(stepIds, stepId => {
              switch getLevel(graph, stepId) {
              | Some(l) => l == level
              | None => false
              }
            })
          }
        }
      }
    }
  }
}

module ExecutionResult = {
  type status =
    | Success
    | Failure
    | Skipped
    | Cancelled

  type t = {
    stepId: string,
    status: status,
    output: option<Js.Dict.t<string>>,
    error: option<string>,
    startedAt: float,
    completedAt: option<float>,
    duration: option<float>,
    retryCount: int,
  }

  let make = (~stepId: string, ~startedAt: float): t => {
    {
      stepId,
      status: Success,
      output: None,
      error: None,
      startedAt,
      completedAt: None,
      duration: None,
      retryCount: 0,
    }
  }

  let success = (result: t, output: Js.Dict.t<string>): t => {
    let now = Js.Date.now()
    {
      ...result,
      status: Success,
      output: Some(output),
      completedAt: Some(now),
      duration: Some(now -. result.startedAt),
    }
  }

  let failure = (result: t, error: string): t => {
    let now = Js.Date.now()
    {
      ...result,
      status: Failure,
      error: Some(error),
      completedAt: Some(now),
      duration: Some(now -. result.startedAt),
    }
  }

  let skip = (result: t): t => {
    let now = Js.Date.now()
    {
      ...result,
      status: Skipped,
      completedAt: Some(now),
      duration: Some(now -. result.startedAt),
    }
  }

  let cancel = (result: t): t => {
    let now = Js.Date.now()
    {
      ...result,
      status: Cancelled,
      completedAt: Some(now),
      duration: Some(now -. result.startedAt),
    }
  }

  let incrementRetry = (result: t): t => {
    {...result, retryCount: result.retryCount + 1}
  }

  let statusToString = (status: status): string => {
    switch status {
    | Success => "success"
    | Failure => "failure"
    | Skipped => "skipped"
    | Cancelled => "cancelled"
    }
  }

  let statusFromString = (str: string): option<status> => {
    switch str {
    | "success" => Some(Success)
    | "failure" => Some(Failure)
    | "skipped" => Some(Skipped)
    | "cancelled" => Some(Cancelled)
    | _ => None
    }
  }

  let isComplete = (result: t): bool => {
    Belt.Option.isSome(result.completedAt)
  }

  let isSuccess = (result: t): bool => {
    result.status == Success
  }

  let isFailure = (result: t): bool => {
    result.status == Failure
  }
}

// Export types for TypeScript interop
@genType
type stepType = StepType.t

@genType
type stepDefinition = StepDefinition.t

@genType
type workflowMetadata = WorkflowMetadata.t

@genType
type workflowDefinition = WorkflowDefinition.t

@genType
type dependencyGraph = DependencyGraph.t

@genType
type executionResult = ExecutionResult.t

// Export factory functions
@genType
let makeStepDefinition = StepDefinition.make

@genType
let makeWorkflowMetadata = WorkflowMetadata.make

@genType
let makeWorkflowDefinition = WorkflowDefinition.make

@genType
let makeDependencyGraph = DependencyGraph.make

@genType
let makeExecutionResult = ExecutionResult.make
