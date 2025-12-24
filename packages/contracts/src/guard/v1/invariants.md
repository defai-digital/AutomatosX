# AX Guard Policy Invariants

## Behavioral Invariants

### Policy Resolution

1. **Deterministic Resolution**: Given the same policy ID and variables, resolution MUST produce identical governance context
2. **Variable Substitution**: All `{{variable}}` placeholders MUST be resolved before path matching
3. **Path Precedence**: Forbidden paths take precedence over allowed paths (deny wins)

### Gate Execution

1. **Order Independence**: Gates MAY execute in any order; results MUST be consistent regardless of order
2. **Fail Fast Option**: Implementation MAY stop on first FAIL, but MUST report all failures when not in fail-fast mode
3. **No Side Effects**: Gate execution MUST NOT modify any files or state

### Path Violation Gate

1. **Exact Match**: Modified files MUST be checked against exact resolved paths
2. **Glob Semantics**: Path patterns follow standard glob semantics (`**` for recursive, `*` for single level)
3. **Forbidden Wins**: If a path matches both allowed and forbidden, it MUST be treated as forbidden

### Change Radius Gate

1. **Package Counting**: Only top-level package directories under `packages/` are counted
2. **Limit Enforcement**: If count exceeds `change_radius_limit`, gate MUST FAIL
3. **Root Changes**: Changes outside `packages/` do not count toward radius

### Dependency Gate

1. **Boundary Enforcement**: Cross-layer imports MUST be detected using dependency-cruiser rules
2. **Existing Rules**: Gate MUST use the project's existing `.dependency-cruiser.cjs` configuration
3. **New Violations Only**: Gate SHOULD only report violations in changed files

### Contract Test Gate

1. **Scope Limiting**: Only contracts listed in `required_contracts` are tested
2. **No Test Modification**: If contract test files themselves are modified, gate MUST FAIL
3. **Test Isolation**: Contract tests MUST run in isolation from other tests

### Secrets Detection Gate

1. **Pattern Matching**: Gate MUST scan changed file contents for common secret patterns (API keys, passwords, connection strings)
2. **Location Reporting**: Detected secrets MUST report file path and line number
3. **Ignore Support**: Gate MUST respect `.secretsignore` file for false positive suppression
4. **No False Negatives**: Gate MUST detect common patterns (AWS keys, GitHub tokens, generic API keys, passwords, connection strings)

## Result Invariants

1. **Status Determination**:
   - If ANY gate returns FAIL → overall status is FAIL
   - If NO gates FAIL but ANY return WARN → overall status is WARN
   - Otherwise → overall status is PASS

2. **Suggestion Quality**: Every FAIL result MUST include at least one actionable suggestion

3. **Traceability**: All results MUST include timestamp and can be correlated with trace events
