// Sprint 1 Day 4: Policy DSL
// Rule Engine Component: Policy Definition and Parsing
//
// Purpose: Define policy DSL structure and parse policy definitions
// Architecture: JSON-based policy format with version metadata
// Compliance: Zero warnings required for merge

open Belt

// Policy action types
type policyAction =
  | Allow
  | Deny(string)
  | Require(string)

// Policy condition types
type policyCondition =
  | StateIs(string)
  | EventIs(string)
  | MetadataHas(string)
  | DependencyAvailable(string)

// Policy rule definition
type policyRule = {
  ruleId: string,
  conditions: array<policyCondition>,
  action: policyAction,
}

// Policy definition with versioning
type policy = {
  policyId: string,
  version: string,
  description: string,
  rules: array<policyRule>,
}

// Policy parse result
type parseResult =
  | ParseSuccess(policy)
  | ParseError(string)

// Create policy action
let allowAction = (): policyAction => Allow
let denyAction = (reason: string): policyAction => Deny(reason)
let requireAction = (requirement: string): policyAction => Require(requirement)

// Create policy conditions
let stateIsCondition = (state: string): policyCondition => StateIs(state)
let eventIsCondition = (event: string): policyCondition => EventIs(event)
let metadataHasCondition = (field: string): policyCondition => MetadataHas(field)
let dependencyAvailableCondition = (dep: string): policyCondition => DependencyAvailable(dep)

// Create policy rule
let createPolicyRule = (
  ~ruleId: string,
  ~conditions: array<policyCondition>,
  ~action: policyAction,
): policyRule => {
  {
    ruleId: ruleId,
    conditions: conditions,
    action: action,
  }
}

// Create policy
let createPolicy = (
  ~policyId: string,
  ~version: string,
  ~description: string,
  ~rules: array<policyRule>,
): policy => {
  {
    policyId: policyId,
    version: version,
    description: description,
    rules: rules,
  }
}

// Convert policy action to string
let actionToString = (action: policyAction): string => {
  switch action {
  | Allow => "Allow"
  | Deny(reason) => `Deny(${reason})`
  | Require(requirement) => `Require(${requirement})`
  }
}

// Convert policy condition to string
let conditionToString = (condition: policyCondition): string => {
  switch condition {
  | StateIs(state) => `StateIs(${state})`
  | EventIs(event) => `EventIs(${event})`
  | MetadataHas(field) => `MetadataHas(${field})`
  | DependencyAvailable(dep) => `DependencyAvailable(${dep})`
  }
}

// Parse policy from JSON
// Note: Simplified parser for P0 MVP - uses basic JSON structure
let parsePolicy = (json: Js.Json.t): parseResult => {
  switch Js.Json.decodeObject(json) {
  | None => ParseError("Policy must be a JSON object")
  | Some(obj) => {
      // Extract policyId
      let policyId = switch Js.Dict.get(obj, "policyId") {
      | Some(value) =>
        switch Js.Json.decodeString(value) {
        | Some(str) => str
        | None => ""
        }
      | None => ""
      }

      // Extract version
      let version = switch Js.Dict.get(obj, "version") {
      | Some(value) =>
        switch Js.Json.decodeString(value) {
        | Some(str) => str
        | None => ""
        }
      | None => ""
      }

      // Extract description
      let description = switch Js.Dict.get(obj, "description") {
      | Some(value) =>
        switch Js.Json.decodeString(value) {
        | Some(str) => str
        | None => ""
        }
      | None => ""
      }

      // Validate required fields
      if String.length(policyId) == 0 {
        ParseError("policyId is required")
      } else if String.length(version) == 0 {
        ParseError("version is required")
      } else {
        // For P0 MVP, create a simple policy with empty rules
        // Full rule parsing will be implemented in later phases
        let policy = createPolicy(
          ~policyId,
          ~version,
          ~description,
          ~rules=[],
        )

        ParseSuccess(policy)
      }
    }
  }
}

// Validate policy structure
let validatePolicy = (policy: policy): result<unit, string> => {
  if String.length(policy.policyId) == 0 {
    Error("policyId cannot be empty")
  } else if String.length(policy.version) == 0 {
    Error("version cannot be empty")
  } else if Array.length(policy.rules) == 0 {
    Error("policy must have at least one rule")
  } else {
    Ok()
  }
}

// Convert policy to string for logging
let policyToString = (policy: policy): string => {
  let rulesStr = Array.map(policy.rules, rule => rule.ruleId)->Array.joinWith(", ", x => x)
  `Policy(${policy.policyId}@${policy.version}, rules=[${rulesStr}])`
}

// Helper: Check if action is Allow
let isAllowAction = (action: policyAction): bool => {
  switch action {
  | Allow => true
  | _ => false
  }
}

// Helper: Check if action is Deny
let isDenyAction = (action: policyAction): bool => {
  switch action {
  | Deny(_) => true
  | _ => false
  }
}

// Helper: Check if action is Require
let isRequireAction = (action: policyAction): bool => {
  switch action {
  | Require(_) => true
  | _ => false
  }
}

// Helper: Get policy rule count
let getRuleCount = (policy: policy): int => {
  Array.length(policy.rules)
}

// Helper: Find rule by ID
let findRule = (policy: policy, ruleId: string): option<policyRule> => {
  Array.getBy(policy.rules, rule => rule.ruleId == ruleId)
}
