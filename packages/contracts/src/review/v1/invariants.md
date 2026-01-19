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

## Performance Invariants (Tier 2)

### INV-REV-PERF-001: Smart Batching

**Statement:** When smartBatching is enabled, files MUST be grouped by relevance to focus mode.

**Rationale:** Improves LLM context quality by grouping related files.

**Enforcement:**
- Files matching focus-relevant patterns get higher priority
- Security focus: auth, crypto, validation files prioritized
- Architecture focus: index, module, interface files prioritized
- Performance focus: loop, cache, query files prioritized
- Batches processed in priority order (high to low)

**Validation:**
- High-priority batches MUST be processed before low-priority
- Batch size MUST NOT exceed SMART_BATCH_SIZE (10 files)

---

### INV-REV-PERF-002: Incremental Reviews

**Statement:** When `since` parameter provided, MUST only review files changed since that commit.

**Rationale:** Enables fast incremental reviews on large codebases.

**Enforcement:**
- Uses `git diff --name-only <since>...HEAD` to get changed files
- Falls back to full review if git command fails
- Only code extensions included (no binary/config files)

**Validation:**
- Result `filesReviewed` MUST be subset of git-changed files
- Git errors MUST NOT cause review failure (graceful fallback)

---

### INV-REV-PERF-003: Provider-Aware Timeouts

**Statement:** Timeout MUST be calculated based on provider characteristics and file count.

**Rationale:** Different providers have different performance profiles.

**Formula:**
```
timeout = min(baseTimeout + (fileCount * perFileTimeout), maxTimeout)
```

**Provider Defaults:**
- Claude: 60s base + 5s/file, max 300s
- Gemini: 45s base + 4s/file, max 240s
- Codex: 90s base + 6s/file, max 360s
- Grok: 50s base + 4.5s/file, max 250s

**Validation:**
- Calculated timeout MUST NOT exceed provider's maxTimeout
- Explicit timeoutMs in request overrides calculation

---

## Performance Invariants (Tier 3)

### INV-REV-PERF-004: Dependency Ordering

**Statement:** When dependencyOrdering enabled, files MUST be ordered by import graph.

**Rationale:** Files with more dependents provide better context when reviewed first.

**Enforcement:**
- Parse imports from TypeScript/JavaScript/Python files
- Build dependency graph tracking imports/importedBy
- Sort by importedBy count (descending)

**Validation:**
- Files with more dependents MUST appear before files with fewer
- Circular dependencies MUST NOT cause infinite loops

---

### INV-REV-PERF-005: Memory Management

**Statement:** Memory usage MUST be bounded for large codebases.

**Rationale:** Prevents OOM on repositories with thousands of files.

**Enforcement:**
- MAX_FILES_IN_MEMORY limit (50 files)
- Files read with p-limit concurrency control
- File content truncated at maxLinesPerFile

**Validation:**
- Active file contents in memory MUST NOT exceed limit
- Large files MUST be truncated with marker

---

### INV-REV-PERF-006: Partial Result Recovery

**Statement:** When enableRecovery is true, partial results MUST be preserved on failure.

**Rationale:** Allows resuming failed reviews without losing progress.

**Enforcement:**
- Track completed/failed batches per request
- Store partial comments on batch success
- Expose getPartialResult() and resumeFromPartial() methods

**Validation:**
- Partial result MUST contain all completed batch IDs
- Failed batches MUST be recorded separately
- Recovery MUST not duplicate already-reviewed files

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
10. **INV-REV-PERF-001**: Test smart batching groups files by focus relevance
11. **INV-REV-PERF-002**: Test incremental reviews with --since flag
12. **INV-REV-PERF-003**: Test provider-aware timeout calculation
13. **INV-REV-PERF-004**: Test dependency-based file ordering
14. **INV-REV-PERF-005**: Test memory limits respected
15. **INV-REV-PERF-006**: Test partial result recovery on failure
