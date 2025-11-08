// Sprint 1 Day 4: Rule Engine
// Rule Engine Component: Rule Evaluation Pipeline
//
// Purpose: Execute policy rules and evaluate guard conditions
// Architecture: Pipeline-based rule evaluation with policy integration
// Compliance: Zero warnings required for merge

open Belt

// Rule evaluation result
type evaluationResult =
  | RulePass
  | RuleFail(string)
  | RuleDefer(string)

// Rule execution context
type executionContext = {
  currentState: StateMachine.State.t,
  event: StateMachine.Event.t,
  metadata: option<Js.Dict.t<Js.Json.t>>,
  policy: option<PolicyDSL.policy>,
}

// Rule evaluation outcome
type evaluationOutcome = {
  policy: option<PolicyDSL.policy>,
  rulesEvaluated: int,
  result: evaluationResult,
  reason: option<string>,
}

// Create execution context
let createExecutionContext = (
  ~currentState: StateMachine.State.t,
  ~event: StateMachine.Event.t,
  ~metadata: option<Js.Dict.t<Js.Json.t>>=?,
  ~policy: option<PolicyDSL.policy>=?,
  (),
): executionContext => {
  {
    currentState: currentState,
    event: event,
    metadata: metadata,
    policy: policy,
  }
}

// Evaluate a single policy condition
let evaluateCondition = (
  condition: PolicyDSL.policyCondition,
  context: executionContext,
): bool => {
  switch condition {
  | PolicyDSL.StateIs(expectedState) => {
      let currentStateStr = StateMachine.State.toString(context.currentState)
      currentStateStr == expectedState
    }
  | PolicyDSL.EventIs(expectedEvent) => {
      let currentEventStr = StateMachine.Event.toString(context.event)
      currentEventStr == expectedEvent
    }
  | PolicyDSL.MetadataHas(field) => {
      switch context.metadata {
      | None => false
      | Some(dict) => {
          switch Js.Dict.get(dict, field) {
          | None => false
          | Some(_) => true
          }
        }
      }
    }
  | PolicyDSL.DependencyAvailable(_dep) => {
      // For P0 MVP, assume dependencies are always available
      // Full dependency checking will be implemented in later phases
      true
    }
  }
}

// Evaluate all conditions in a rule (AND logic)
let evaluateRuleConditions = (
  rule: PolicyDSL.policyRule,
  context: executionContext,
): bool => {
  if Array.length(rule.conditions) == 0 {
    true // Empty conditions array means rule always applies
  } else {
    Array.every(rule.conditions, condition => evaluateCondition(condition, context))
  }
}

// Evaluate a single policy rule
let evaluateRule = (
  rule: PolicyDSL.policyRule,
  context: executionContext,
): evaluationResult => {
  let conditionsMet = evaluateRuleConditions(rule, context)

  if conditionsMet {
    switch rule.action {
    | PolicyDSL.Allow => RulePass
    | PolicyDSL.Deny(reason) => RuleFail(`Rule ${rule.ruleId} denied: ${reason}`)
    | PolicyDSL.Require(requirement) => {
        // For P0 MVP, check if requirement is satisfied via metadata
        switch context.metadata {
        | None => RuleFail(`Rule ${rule.ruleId} requires: ${requirement}`)
        | Some(dict) => {
            switch Js.Dict.get(dict, requirement) {
            | None => RuleFail(`Rule ${rule.ruleId} requires: ${requirement}`)
            | Some(_) => RulePass
            }
          }
        }
      }
    }
  } else {
    // Conditions not met, skip this rule
    RulePass
  }
}

// Evaluate all rules in a policy
let evaluatePolicy = (
  policy: PolicyDSL.policy,
  context: executionContext,
): evaluationOutcome => {
  let rulesEvaluated = ref(0)
  let finalResult = ref(RulePass)
  let failureReason = ref(None)

  // Evaluate each rule until a failure occurs
  Array.forEach(policy.rules, rule => {
    if Belt.Result.isOk({
      switch finalResult.contents {
      | RulePass => Ok()
      | _ => Error()
      }
    }) {
      rulesEvaluated := rulesEvaluated.contents + 1
      let result = evaluateRule(rule, context)

      switch result {
      | RuleFail(reason) => {
          finalResult := RuleFail(reason)
          failureReason := Some(reason)
        }
      | RuleDefer(reason) => {
          finalResult := RuleDefer(reason)
          failureReason := Some(reason)
        }
      | RulePass => ()
      }
    }
  })

  {
    policy: Some(policy),
    rulesEvaluated: rulesEvaluated.contents,
    result: finalResult.contents,
    reason: failureReason.contents,
  }
}

// Execute rule engine with context
let execute = (context: executionContext): evaluationOutcome => {
  switch context.policy {
  | None => {
      // No policy provided, default to pass
      {
        policy: None,
        rulesEvaluated: 0,
        result: RulePass,
        reason: None,
      }
    }
  | Some(policy) => evaluatePolicy(policy, context)
  }
}

// Helper: Convert evaluation result to string
let evaluationResultToString = (result: evaluationResult): string => {
  switch result {
  | RulePass => "RulePass"
  | RuleFail(reason) => `RuleFail(${reason})`
  | RuleDefer(reason) => `RuleDefer(${reason})`
  }
}

// Helper: Convert evaluation outcome to string
let outcomeToString = (outcome: evaluationOutcome): string => {
  let policyStr = switch outcome.policy {
  | None => "None"
  | Some(p) => PolicyDSL.policyToString(p)
  }

  let resultStr = evaluationResultToString(outcome.result)

  `Outcome(policy=${policyStr}, evaluated=${Int.toString(outcome.rulesEvaluated)}, result=${resultStr})`
}

// Helper: Check if evaluation passed
let isPassed = (result: evaluationResult): bool => {
  switch result {
  | RulePass => true
  | _ => false
  }
}

// Helper: Check if evaluation failed
let isFailed = (result: evaluationResult): bool => {
  switch result {
  | RuleFail(_) => true
  | _ => false
  }
}

// Helper: Check if evaluation deferred
let isDeferred = (result: evaluationResult): bool => {
  switch result {
  | RuleDefer(_) => true
  | _ => false
  }
}

// Helper: Get failure reason
let getFailureReason = (result: evaluationResult): option<string> => {
  switch result {
  | RuleFail(reason) => Some(reason)
  | _ => None
  }
}
