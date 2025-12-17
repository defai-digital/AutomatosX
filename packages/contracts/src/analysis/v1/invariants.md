# Analysis Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for code analysis including bug detection, refactoring opportunities, and context building.

## Context Building Invariants

### INV-ANL-CTX-001: File Size Limits

**Statement:** Individual files MUST NOT exceed `maxFileSize` configuration.

**Rationale:** Large files cause memory issues and slow processing.

**Enforcement:**
- File size checked before loading
- Oversized files skipped with warning
- Partial loading not supported

### INV-ANL-CTX-002: Total Size Budget

**Statement:** Total context size MUST NOT exceed `maxTotalSize`.

**Rationale:** Context budget prevents token exhaustion and cost overruns.

**Enforcement:**
- Running total tracked during collection
- Collection stops when budget reached
- Most relevant files prioritized

### INV-ANL-CTX-003: UTF-8 Validation

**Statement:** All files MUST be valid UTF-8 text.

**Rationale:** Binary files corrupt analysis and waste tokens.

**Enforcement:**
- UTF-8 validation before inclusion
- Binary files detected and skipped
- Invalid encoding logged with path

## Finding Invariants

### INV-ANL-FIND-001: Severity Ordering

**Statement:** Findings MUST be ordered by severity (critical first).

**Rationale:** Critical issues should be addressed first.

**Enforcement:**
- Severity levels: critical > high > medium > low > info
- Stable sort within same severity
- Order preserved in response

### INV-ANL-FIND-002: Location Accuracy

**Statement:** Finding locations MUST accurately point to the issue.

**Rationale:** Inaccurate locations waste developer time.

**Enforcement:**
- Line and column numbers validated
- File path must exist
- Range must be within file bounds

### INV-ANL-FIND-003: Actionable Suggestions

**Statement:** All findings MUST include actionable suggestions.

**Rationale:** Findings without suggestions are not useful.

**Enforcement:**
- At least one suggestion per finding
- Suggestions must be specific
- Auto-fix provided when possible

## Provider Routing Invariants

### INV-ANL-PROV-001: Fallback Support

**Statement:** Analysis MUST fallback to alternate providers on failure.

**Rationale:** Single provider failure should not block analysis.

**Enforcement:**
- Provider list includes fallbacks
- Failure triggers next provider
- All failures reported as aggregate error

### INV-ANL-PROV-002: Timeout Handling

**Statement:** Provider calls MUST respect configured timeout.

**Rationale:** Hung providers should not block indefinitely.

**Enforcement:**
- Timeout wraps all provider calls
- Timeout triggers fallback
- Partial results discarded on timeout

## Testing Requirements

1. `INV-ANL-CTX-001`: Test file size limits
2. `INV-ANL-CTX-002`: Test total size budget
3. `INV-ANL-CTX-003`: Test UTF-8 validation
4. `INV-ANL-FIND-001`: Test severity ordering
5. `INV-ANL-FIND-002`: Test location accuracy
6. `INV-ANL-FIND-003`: Test suggestions present
7. `INV-ANL-PROV-001`: Test fallback on failure
8. `INV-ANL-PROV-002`: Test timeout handling

## Version History

- V1 (2024-12-16): Initial contract definition
