# Context Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for execution context management.

## Loading Invariants

### INV-CTX-001: File Size Limits

**Statement:** Individual files MUST NOT exceed `maxFileSize` configuration.

**Rationale:** Oversized files cause memory issues.

**Enforcement:**
- Size checked before loading
- Oversized files skipped
- Warning logged with path

### INV-CTX-002: Total Size Budget

**Statement:** Total loaded context MUST NOT exceed `maxTotalSize`.

**Rationale:** Prevents token exhaustion.

**Enforcement:**
- Running total tracked
- Loading stops at budget
- Most relevant files prioritized

### INV-CTX-003: UTF-8 Validation

**Statement:** All context content MUST be valid UTF-8.

**Rationale:** Binary content corrupts context.

**Enforcement:**
- Encoding validated on load
- Binary files skipped
- Invalid encoding logged

## Relevance Invariants

### INV-CTX-REL-001: Relevance Scoring

**Statement:** Context items MUST be scored for relevance to task.

**Rationale:** More relevant content should be prioritized.

**Enforcement:**
- Score based on task keywords
- Score based on file proximity
- Scores normalized 0-1

### INV-CTX-REL-002: Prioritized Inclusion

**Statement:** Higher relevance items MUST be included first.

**Rationale:** Budget should go to most relevant content.

**Enforcement:**
- Items sorted by relevance
- Budget filled in order
- Cutoff logged

## Testing Requirements

1. `INV-CTX-001`: Test file size limit enforcement
2. `INV-CTX-002`: Test total size budget
3. `INV-CTX-003`: Test UTF-8 validation
4. `INV-CTX-REL-001`: Test relevance scoring
5. `INV-CTX-REL-002`: Test prioritized inclusion

## Version History

- V1 (2024-12-16): Initial contract definition
