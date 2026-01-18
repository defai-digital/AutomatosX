# Feedback Learning Domain Invariants

This document defines the behavioral invariants for the feedback learning system.

## Schema Invariants (INV-FBK-001 to INV-FBK-099)

### INV-FBK-001: Feedback Records Immutable
- **Constraint**: Once created, feedback records MUST NOT be modified
- **Rationale**: Audit trail integrity
- **Enforcement**: No update methods in storage interface

### INV-FBK-002: Score Adjustments Bounded
- **Constraint**: Score adjustments MUST be between -0.5 and +0.5
- **Rationale**: Prevent single feedback from dominating scoring
- **Enforcement**: Zod schema validation + clamp in calculator

### INV-FBK-003: Minimum Sample Count Before Adjustment
- **Constraint**: Adjustments MUST NOT apply with fewer than MIN_SAMPLE_COUNT (3) samples
- **Rationale**: Statistical significance
- **Enforcement**: `shouldApplyAdjustment()` check

### INV-FBK-004: Adjustments Decay Over Time
- **Constraint**: Adjustments MUST decay at DECAY_RATE_PER_DAY (5%)
- **Rationale**: Recent feedback more relevant than old
- **Enforcement**: `calculateDecayedAdjustment()` function

### INV-FBK-005: Rating Bounds
- **Constraint**: Rating MUST be between 1 and 5 (inclusive)
- **Rationale**: Standard 5-star rating scale
- **Enforcement**: Zod schema validation

## Runtime Invariants (INV-FBK-100 to INV-FBK-199)

### INV-FBK-100: No Duplicate Feedback
- **Constraint**: Same user/session MUST NOT submit identical feedback twice
- **Rationale**: Prevent gaming the system
- **Enforcement**: Deduplication in collector

### INV-FBK-101: Automatic Outcome Tracking
- **Constraint**: Implicit feedback MUST be collected on task completion
- **Rationale**: Build learning corpus automatically
- **Enforcement**: Event listener on task events

### INV-FBK-102: Pattern Matching Consistent
- **Constraint**: Same task description MUST match same patterns
- **Rationale**: Reproducible behavior
- **Enforcement**: Deterministic hash function

### INV-FBK-103: Expired Adjustments Ignored
- **Constraint**: Adjustments past expiresAt MUST NOT affect scoring
- **Rationale**: Prevent stale data influence
- **Enforcement**: Expiration check in scorer

## Learning Invariants (INV-FBK-200 to INV-FBK-299)

### INV-FBK-200: Confidence Reflects Sample Size
- **Constraint**: Adjustment confidence MUST increase with sample count
- **Rationale**: More data = more reliable
- **Enforcement**: Confidence formula in calculator

### INV-FBK-201: Conflicting Feedback Averaged
- **Constraint**: Conflicting feedback for same pattern MUST be averaged
- **Rationale**: Balance different opinions
- **Enforcement**: Weighted average in aggregator

### INV-FBK-202: Cold Start Handling
- **Constraint**: New agents MUST start with neutral adjustments (0)
- **Rationale**: Fair starting point
- **Enforcement**: Default value in scorer

### INV-FBK-203: Feedback Attribution
- **Constraint**: Every adjustment MUST trace back to feedback records
- **Rationale**: Explainability
- **Enforcement**: Pattern ID links in adjustment

## Privacy Invariants (INV-FBK-300 to INV-FBK-399)

### INV-FBK-300: No PII in Patterns
- **Constraint**: Task patterns MUST NOT contain PII
- **Rationale**: Privacy protection
- **Enforcement**: PII filter in pattern extractor

### INV-FBK-301: Retention Policy Enforced
- **Constraint**: Feedback MUST be deleted after retentionDays
- **Rationale**: Data minimization
- **Enforcement**: Scheduled cleanup job
