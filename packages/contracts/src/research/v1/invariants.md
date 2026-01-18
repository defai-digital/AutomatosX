# Research Domain Invariants

This document defines the behavioral invariants for the research agent domain.

## Schema Invariants (INV-RSH-001 to INV-RSH-099)

### INV-RSH-001: All Sources Cited in Synthesis
- **Constraint**: Every source used MUST be cited in the synthesis
- **Rationale**: Traceability and attribution
- **Enforcement**: Synthesis generator validation

### INV-RSH-002: Confidence Reflects Source Reliability
- **Constraint**: Confidence score MUST be weighted by source reliability
- **Rationale**: Official docs > community > generated content
- **Enforcement**: `calculateConfidence()` function

### INV-RSH-003: Stale Data Flagged with Warning
- **Constraint**: Data older than 24 hours MUST include a staleness warning
- **Rationale**: Users should know when information may be outdated
- **Enforcement**: `hasStaleDataWarning()` check

### INV-RSH-004: Query Length Bounds
- **Constraint**: Query MUST be between 1 and 5000 characters
- **Rationale**: Reasonable search scope
- **Enforcement**: Zod schema validation

### INV-RSH-005: Max Sources Bounds
- **Constraint**: `maxSources` MUST be between 1 and 20
- **Rationale**: Balance thoroughness with performance
- **Enforcement**: Zod schema validation

## Runtime Invariants (INV-RSH-100 to INV-RSH-199)

### INV-RSH-100: Timeout Enforced
- **Constraint**: Research operations MUST respect configured timeout
- **Rationale**: Prevent indefinite hanging
- **Enforcement**: Promise.race with timeout

### INV-RSH-101: Parallel Fetch with Rate Limiting
- **Constraint**: Parallel fetches MUST NOT exceed 5 concurrent requests
- **Rationale**: Avoid overwhelming sources and rate limits
- **Enforcement**: Semaphore in fetcher

### INV-RSH-102: Failed Sources Don't Block Results
- **Constraint**: Individual source failures MUST NOT block overall research
- **Rationale**: Partial results are better than no results
- **Enforcement**: Promise.allSettled in aggregator

### INV-RSH-103: Cache Respects TTL
- **Constraint**: Cached results MUST NOT be served past expiration
- **Rationale**: Balance freshness with performance
- **Enforcement**: TTL check in cache retrieval

## Synthesis Invariants (INV-RSH-200 to INV-RSH-299)

### INV-RSH-200: Synthesis Includes Source Attribution
- **Constraint**: Synthesis MUST attribute claims to specific sources
- **Rationale**: Verifiability of information
- **Enforcement**: Synthesis template includes citations

### INV-RSH-201: Code Examples Attributed
- **Constraint**: Code examples MUST include source URL when available
- **Rationale**: Users can verify and get more context
- **Enforcement**: CodeExample schema requires source

### INV-RSH-202: Conflicting Information Noted
- **Constraint**: When sources conflict, synthesis MUST note the discrepancy
- **Rationale**: Users should be aware of uncertainty
- **Enforcement**: Conflict detection in synthesizer

### INV-RSH-203: No Hallucinated URLs
- **Constraint**: All URLs in synthesis MUST come from fetched sources
- **Rationale**: Prevent fabricated references
- **Enforcement**: URL whitelist validation
