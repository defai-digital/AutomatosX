# Refactor Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for code refactoring functionality.

## Scan Invariants

### INV-REF-SCAN-001: Pattern Detection

**Statement:** Refactoring opportunities MUST be detected based on defined patterns.

**Rationale:** Consistent detection enables reliable automation.

**Enforcement:**
- Patterns defined in configuration
- AST-based detection where possible
- Pattern matching is deterministic

### INV-REF-SCAN-002: Confidence Scoring

**Statement:** Each opportunity MUST have a confidence score 0-1.

**Rationale:** Confidence helps prioritize and filter suggestions.

**Enforcement:**
- Score reflects detection certainty
- Lower scores for heuristic-based detection
- Score threshold configurable

## Apply Invariants

### INV-REF-APPLY-001: Semantic Preservation

**Statement:** Refactoring MUST preserve program semantics.

**Rationale:** Refactoring changes structure, not behavior.

**Enforcement:**
- Behavior tests should pass before and after
- No functional changes in refactoring
- Compiler/type errors indicate failure

### INV-REF-APPLY-002: AST Validity

**Statement:** Applied refactoring MUST produce valid syntax.

**Rationale:** Syntax errors break the build.

**Enforcement:**
- Parse output to verify syntax
- Revert on parse failure
- Report specific syntax errors

### INV-REF-APPLY-003: Test Preservation

**Statement:** Refactoring MUST NOT delete or modify test assertions.

**Rationale:** Tests verify the preserved semantics.

**Enforcement:**
- Test files excluded from semantic changes
- Import updates only in tests
- Assertion statements preserved

## Impact Invariants

### INV-REF-IMPACT-001: Impact Assessment

**Statement:** Each refactoring MUST declare its impact level.

**Rationale:** Users need to understand change scope.

**Impact Levels:**
- `trivial`: Cosmetic, no behavior change
- `minor`: Local scope, limited blast radius
- `major`: Cross-file, moderate blast radius
- `breaking`: API changes, wide blast radius

**Enforcement:**
- Impact level required in opportunity
- Level validated against actual changes
- Breaking changes require confirmation

## Testing Requirements

1. `INV-REF-SCAN-001`: Test pattern detection
2. `INV-REF-SCAN-002`: Test confidence scores
3. `INV-REF-APPLY-001`: Test semantic preservation
4. `INV-REF-APPLY-002`: Test AST validity
5. `INV-REF-APPLY-003`: Test assertions preserved
6. `INV-REF-IMPACT-001`: Test impact assessment

## Version History

- V1 (2024-12-16): Initial contract definition
