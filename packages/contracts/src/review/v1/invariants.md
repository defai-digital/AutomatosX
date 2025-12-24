# Review Domain Invariants

This document defines the behavioral guarantees that MUST be enforced by the review domain implementation.

## Core Invariants

### INV-REV-001: Focus Mode Isolation

**Statement:** Each focus mode MUST only report issues relevant to that focus.

**Rationale:** Prevents noise and allows targeted reviews.

**Enforcement:**
- Security focus: Only OWASP/CWE categories
- Architecture focus: Only coupling/cohesion/dependency categories
- Performance focus: Only complexity/resource/latency categories
- Maintainability focus: Only readability/duplication/naming categories
- Correctness focus: Only logic/null-handling/type categories
- All focus: May include any category

**Validation:**
- Review comments MUST have `focus` field matching request focus
- Comments with mismatched focus MUST be filtered out

---

### INV-REV-002: Confidence Filtering

**Statement:** Comments below minConfidence threshold MUST NOT be included in results.

**Rationale:** Reduces false positives and noise.

**Enforcement:**
- Default threshold: 0.7 (70%)
- LLM instructed to provide confidence scores
- Post-filtering removes low-confidence findings

**Validation:**
- All returned comments MUST have `confidence >= minConfidence`
- Filtered comments are NOT counted in summary statistics

---

### INV-REV-003: Explanation Required

**Statement:** Every review comment MUST include rationale explaining WHY it matters.

**Rationale:** Differentiates from simple linting - provides learning value.

**Enforcement:**
- `body` field is required and MUST be non-empty
- Prompt explicitly requests rationale
- Comments without adequate body marked as low-confidence

**Validation:**
- `body` field MUST have minimum 10 characters
- Comments with empty/missing body MUST be rejected

---

### INV-REV-004: Actionable Suggestions

**Statement:** Comments with severity >= warning MUST include a suggestion.

**Rationale:** Comments should help, not just criticize.

**Enforcement:**
- Critical/warning comments require `suggestion` field
- Suggestions validated for presence
- `suggestedCode` optional but encouraged

**Validation:**
- Comments with severity `critical` or `warning` MUST have non-empty `suggestion`
- Comments with severity `suggestion` or `note` MAY omit `suggestion` field

---

## Operational Invariants

### INV-REV-OPS-001: Timeout Handling

**Statement:** Reviews MUST complete or fail within configured timeout.

**Rationale:** Prevents hanging processes.

**Enforcement:**
- Use `Promise.race` with timeout
- Partial results returned on timeout (if available)
- Clear error message with code `TIMEOUT` on timeout

**Validation:**
- Review duration MUST NOT exceed `timeoutMs` + 5000ms buffer
- Timeout error MUST include elapsed time in message

---

### INV-REV-OPS-002: Provider Fallback

**Statement:** If preferred provider unavailable, MUST fall back to available provider.

**Rationale:** Reviews should not fail due to single provider outage.

**Enforcement:**
- Provider router tries multiple providers
- Fallback order: claude > gemini > codex
- Error only if all providers unavailable

**Validation:**
- Result MUST include `providerId` indicating actual provider used
- `PROVIDER_UNAVAILABLE` error only when ALL providers fail

---

## Output Invariants

### INV-REV-OUT-001: Severity Ordering

**Statement:** Comments MUST be ordered by severity (critical first).

**Rationale:** Most important issues surface first.

**Enforcement:**
- Sort: critical > warning > suggestion > note
- Secondary sort by confidence (descending)
- Tertiary sort by file path (alphabetical)

**Validation:**
- Comments array MUST be sorted per the comparison function
- For any two adjacent comments `a`, `b`: `SEVERITY_ORDER[a.severity] <= SEVERITY_ORDER[b.severity]`

---

### INV-REV-OUT-002: Health Score Calculation

**Statement:** Health score MUST reflect weighted severity counts.

**Rationale:** Provides at-a-glance code health assessment.

**Formula:**
```
healthScore = 100 - (critical * 25 + warning * 10 + suggestion * 2)
```

**Constraints:**
- Score clamped to 0-100 range
- 0 critical + 0 warning = 100 (suggestions don't hurt much)

**Validation:**
- Health score MUST match formula result exactly
- Score MUST be integer between 0 and 100

---

### INV-REV-OUT-003: SARIF Compliance

**Statement:** SARIF output MUST comply with SARIF 2.1.0 schema.

**Rationale:** Enables integration with GitHub, VS Code, other tools.

**Enforcement:**
- Schema validation against official SARIF schema
- Required fields: `$schema`, `version`, `runs`
- Tool metadata included

**Validation:**
- SARIF output MUST validate against `SarifOutputSchema`
- `$schema` MUST be `https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json`
- `version` MUST be `2.1.0`

---

## Test Requirements

Each invariant MUST have corresponding tests in `tests/contract/review.test.ts`:

1. **INV-REV-001**: Test that comments are filtered by focus mode
2. **INV-REV-002**: Test that low-confidence comments are excluded
3. **INV-REV-003**: Test that comments without body are rejected
4. **INV-REV-004**: Test that critical/warning without suggestion are flagged
5. **INV-REV-OPS-001**: Test timeout behavior (mock slow provider)
6. **INV-REV-OPS-002**: Test provider fallback chain
7. **INV-REV-OUT-001**: Test comment ordering
8. **INV-REV-OUT-002**: Test health score calculation
9. **INV-REV-OUT-003**: Test SARIF output validation
