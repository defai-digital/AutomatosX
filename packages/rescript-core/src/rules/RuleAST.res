// Sprint 1 Day 13: Rule AST Module
// AST data structures for rule expressions
//
// Provides:
// - Rule structure (condition → action format)
// - Condition expressions (comparisons, logical operators)
// - Action definitions (effects to execute)
// - Value types (literals, context references, operators)
// - Rule validation and serialization

open Belt

// Value types for rule expressions
type value =
  | StringValue(string)
  | IntValue(int)
  | FloatValue(float)
  | BoolValue(bool)
  | NullValue
  | ContextRef(string) // Reference to context field (e.g., "state", "retryCount")

// Comparison operators
type compareOp =
  | Equal
  | NotEqual
  | GreaterThan
  | LessThan
  | GreaterThanOrEqual
  | LessThanOrEqual
  | Contains // For string/array containment
  | Matches // For regex matching

// Logical operators
type logicOp =
  | And
  | Or

// Condition expression (recursive structure)
type rec condition =
  | Comparison(value, compareOp, value) // e.g., state == "Preparing"
  | LogicalOp(logicOp, condition, condition) // e.g., cond1 AND cond2
  | Not(condition) // e.g., NOT cond
  | Always // Always true (default rule)
  | Never // Never true (disabled rule)

// Action to execute when condition is met
type action =
  | ExecuteEffect(StateMachine.Effect.t)
  | SetContextValue(string, value) // Set context field to value
  | TransitionTo(StateMachine.State.t) // Transition to specific state
  | EmitEvent(StateMachine.Event.t) // Emit an event
  | NoAction // No-op action

// Rule priority for conflict resolution
type priority =
  | High
  | Medium
  | Low
  | Custom(int) // Custom priority value (higher = more important)

// Rule metadata
type ruleMetadata = {
  name: string,
  description: option<string>,
  tags: array<string>,
  enabled: bool,
  createdAt: option<float>,
  updatedAt: option<float>,
}

// Complete rule structure
type rule = {
  metadata: ruleMetadata,
  priority: priority,
  condition: condition,
  actions: array<action>,
}

// Rule evaluation result
type evaluationResult =
  | Matched(array<action>) // Condition matched, return actions
  | NotMatched // Condition not matched
  | EvaluationError(string) // Error during evaluation

// Rule validation result
type validationResult =
  | Valid
  | Invalid(array<string>) // List of validation errors

module ValueHelpers = {
  // Convert value to string for display
  let toString = (v: value): string => {
    switch v {
    | StringValue(s) => `"${s}"`
    | IntValue(i) => Int.toString(i)
    | FloatValue(f) => Float.toString(f)
    | BoolValue(b) => b ? "true" : "false"
    | NullValue => "null"
    | ContextRef(ref) => `$${ref}`
    }
  }

  // Check if value is a literal (not a context reference)
  let isLiteral = (v: value): bool => {
    switch v {
    | ContextRef(_) => false
    | _ => true
    }
  }

  // Get value type name
  let getTypeName = (v: value): string => {
    switch v {
    | StringValue(_) => "string"
    | IntValue(_) => "int"
    | FloatValue(_) => "float"
    | BoolValue(_) => "bool"
    | NullValue => "null"
    | ContextRef(_) => "context_ref"
    }
  }
}

module CompareOpHelpers = {
  // Convert operator to string
  let toString = (op: compareOp): string => {
    switch op {
    | Equal => "=="
    | NotEqual => "!="
    | GreaterThan => ">"
    | LessThan => "<"
    | GreaterThanOrEqual => ">="
    | LessThanOrEqual => "<="
    | Contains => "contains"
    | Matches => "matches"
    }
  }

  // Check if operator requires specific value types
  let validateOperands = (op: compareOp, left: value, right: value): bool => {
    switch op {
    | Contains =>
      // Left should be string or array, right should be compatible
      switch (left, right) {
      | (StringValue(_), StringValue(_)) => true
      | (ContextRef(_), _) => true // Can't validate without context
      | _ => false
      }
    | Matches =>
      // Left should be string, right should be regex pattern
      switch (left, right) {
      | (StringValue(_), StringValue(_)) => true
      | (ContextRef(_), StringValue(_)) => true
      | _ => false
      }
    | _ => true // Other operators work with any comparable types
    }
  }
}

module ConditionHelpers = {
  // Convert condition to string (for debugging/logging)
  let rec toString = (cond: condition): string => {
    switch cond {
    | Comparison(left, op, right) =>
      `${ValueHelpers.toString(left)} ${CompareOpHelpers.toString(op)} ${ValueHelpers.toString(right)}`
    | LogicalOp(And, left, right) => `(${toString(left)} AND ${toString(right)})`
    | LogicalOp(Or, left, right) => `(${toString(left)} OR ${toString(right)})`
    | Not(cond) => `NOT (${toString(cond)})`
    | Always => "ALWAYS"
    | Never => "NEVER"
    }
  }

  // Get all context references in a condition
  let rec getContextRefs = (cond: condition): array<string> => {
    switch cond {
    | Comparison(left, _, right) => {
        let leftRefs = switch left {
        | ContextRef(ref) => [ref]
        | _ => []
        }
        let rightRefs = switch right {
        | ContextRef(ref) => [ref]
        | _ => []
        }
        leftRefs->Array.concat(rightRefs)
      }
    | LogicalOp(_, left, right) => getContextRefs(left)->Array.concat(getContextRefs(right))
    | Not(cond) => getContextRefs(cond)
    | Always | Never => []
    }
  }
}

module ActionHelpers = {
  // Convert action to string
  let toString = (action: action): string => {
    switch action {
    | ExecuteEffect(effect) => {
        let effectStr = switch effect {
        | StateMachine.Effect.HydratePlan(taskId) => `HydratePlan(${taskId})`
        | StateMachine.Effect.EvaluateGuards => "EvaluateGuards"
        | StateMachine.Effect.StartExecution(taskId) => `StartExecution(${taskId})`
        | StateMachine.Effect.EnterWaitState => "EnterWaitState"
        | StateMachine.Effect.EmitTelemetry(label) => `EmitTelemetry(${label})`
        | StateMachine.Effect.ScheduleRetry => "ScheduleRetry"
        | StateMachine.Effect.PerformRollback(reason) => `PerformRollback(${reason})`
        | StateMachine.Effect.RecordCancellation(actor) => `RecordCancellation(${actor})`
        | StateMachine.Effect.FlushTelemetryBuffer => "FlushTelemetryBuffer"
        }
        `ExecuteEffect(${effectStr})`
      }
    | SetContextValue(field, value) => `SetContext(${field} = ${ValueHelpers.toString(value)})`
    | TransitionTo(state) => `TransitionTo(${StateMachine.State.toString(state)})`
    | EmitEvent(event) => {
        let eventStr = switch event {
        | StateMachine.Event.TaskSubmitted(payload) => `TaskSubmitted(${payload.taskId})`
        | StateMachine.Event.DependenciesReady => "DependenciesReady"
        | StateMachine.Event.TelemetryFlushed => "TelemetryFlushed"
        | StateMachine.Event.RuleViolation(rule) => `RuleViolation(${rule})`
        | StateMachine.Event.Timeout(ms) => `Timeout(${Int.toString(ms)})`
        | StateMachine.Event.CancelRequest(payload) => `CancelRequest(${payload.requestedBy})`
        | StateMachine.Event.RetryTrigger => "RetryTrigger"
        }
        `EmitEvent(${eventStr})`
      }
    | NoAction => "NoAction"
    }
  }
}

module PriorityHelpers = {
  // Convert priority to integer (for comparison)
  let toInt = (p: priority): int => {
    switch p {
    | High => 100
    | Medium => 50
    | Low => 10
    | Custom(value) => value
    }
  }

  // Convert priority to string
  let toString = (p: priority): string => {
    switch p {
    | High => "High"
    | Medium => "Medium"
    | Low => "Low"
    | Custom(value) => `Custom(${Int.toString(value)})`
    }
  }

  // Compare priorities (returns true if p1 > p2)
  let isHigherThan = (p1: priority, p2: priority): bool => {
    toInt(p1) > toInt(p2)
  }
}

module RuleValidation = {
  // Validate a rule structure
  let validateRule = (rule: rule): validationResult => {
    let errors = []

    // 1. Validate metadata
    if String.length(rule.metadata.name) === 0 {
      let _ = errors->Js.Array2.push("Rule name cannot be empty")
    }

    // 2. Validate condition has at least one context reference or is Always/Never
    let contextRefs = ConditionHelpers.getContextRefs(rule.condition)
    if Array.length(contextRefs) === 0 {
      switch rule.condition {
      | Always | Never => () // Valid
      | _ =>
        let _ = errors->Js.Array2.push(
          "Rule condition must reference at least one context field or be Always/Never",
        )
      }
    }

    // 3. Validate actions array is not empty
    if Array.length(rule.actions) === 0 {
      let _ = errors->Js.Array2.push("Rule must have at least one action")
    }

    // 4. Validate condition operators have correct operand types
    let rec validateConditionOperands = (cond: condition): unit => {
      switch cond {
      | Comparison(left, op, right) => {
          if !CompareOpHelpers.validateOperands(op, left, right) {
            let _ = errors->Js.Array2.push(
              `Invalid operands for operator ${CompareOpHelpers.toString(op)}`,
            )
          }
        }
      | LogicalOp(_, left, right) => {
          validateConditionOperands(left)
          validateConditionOperands(right)
        }
      | Not(cond) => validateConditionOperands(cond)
      | Always | Never => ()
      }
    }
    validateConditionOperands(rule.condition)

    // Return result
    if Array.length(errors) === 0 {
      Valid
    } else {
      Invalid(errors)
    }
  }
}

module RuleFactory = {
  // Create a simple rule with default metadata
  let createSimpleRule = (
    name: string,
    condition: condition,
    actions: array<action>,
  ): rule => {
    metadata: {
      name: name,
      description: None,
      tags: [],
      enabled: true,
      createdAt: Some(Js.Date.now()),
      updatedAt: None,
    },
    priority: Medium,
    condition: condition,
    actions: actions,
  }

  // Create a high-priority rule
  let createHighPriorityRule = (
    name: string,
    condition: condition,
    actions: array<action>,
  ): rule => {
    ...createSimpleRule(name, condition, actions),
    priority: High,
  }

  // Create a default/fallback rule (always matches)
  let createDefaultRule = (name: string, actions: array<action>): rule => {
    createSimpleRule(name, Always, actions)
  }
}

// Export types and functions for JavaScript/TypeScript consumption
let createSimpleRule = RuleFactory.createSimpleRule
let createHighPriorityRule = RuleFactory.createHighPriorityRule
let createDefaultRule = RuleFactory.createDefaultRule
let validateRule = RuleValidation.validateRule

let conditionToString = ConditionHelpers.toString
let actionToString = ActionHelpers.toString
let priorityToInt = PriorityHelpers.toInt
let compareByPriority = (r1: rule, r2: rule) =>
  PriorityHelpers.toInt(r2.priority) - PriorityHelpers.toInt(r1.priority)
