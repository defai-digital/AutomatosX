# Bugfix Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for bug detection and fixing functionality.

## Scan Invariants

### INV-BUG-SCAN-001: Deterministic Results

**Statement:** Same codebase MUST produce same scan results.

**Rationale:** Non-deterministic scans cause flaky CI and confusion.

**Enforcement:**
- Pattern matching is deterministic
- File order is deterministic (sorted)
- No random sampling

### INV-BUG-SCAN-002: No False Modifications

**Statement:** Scan operations MUST NOT modify any files.

**Rationale:** Scanning should be safe to run at any time.

**Enforcement:**
- Scan is read-only operation
- No writes during scan
- File handles opened read-only

### INV-BUG-SCAN-003: Complete Coverage

**Statement:** Scan MUST check all files matching configured patterns.

**Rationale:** Skipped files may contain critical bugs.

**Enforcement:**
- All matching files processed
- Large files handled (may be chunked)
- Progress reported for long scans

## Fix Invariants

### INV-BUG-FIX-001: Backup Before Fix

**Statement:** Files MUST be backed up before applying fixes.

**Rationale:** Incorrect fixes should be recoverable.

**Enforcement:**
- Backup created before modification
- Backup path configurable
- Backup verified before proceeding

### INV-BUG-FIX-002: Atomic Application

**Statement:** Fix application MUST be atomic per file.

**Rationale:** Partial fixes leave code in broken state.

**Enforcement:**
- All changes for a file applied together
- Failure rolls back entire file
- No partial edits persisted

### INV-BUG-FIX-003: Dry Run Support

**Statement:** Fixes MUST support dry-run mode.

**Rationale:** Users should preview changes before applying.

**Enforcement:**
- `dryRun: true` shows changes without applying
- Dry run output matches actual changes
- No modifications in dry run mode

## Testing Requirements

1. `INV-BUG-SCAN-001`: Test scan determinism
2. `INV-BUG-SCAN-002`: Test scan is read-only
3. `INV-BUG-SCAN-003`: Test complete coverage
4. `INV-BUG-FIX-001`: Test backup creation
5. `INV-BUG-FIX-002`: Test atomic application
6. `INV-BUG-FIX-003`: Test dry run mode

## Version History

- V1 (2024-12-16): Initial contract definition
