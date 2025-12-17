# Resilience Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for resilience patterns including circuit breaker, rate limiting, and metrics collection.

## Circuit Breaker Invariants

### INV-CB-001: State Transitions

**Statement:** Circuit breaker MUST follow defined state transitions.

**Rationale:** Invalid transitions indicate bugs and inconsistent behavior.

**Valid Transitions:**
- `closed` → `open` (on failure threshold)
- `open` → `half-open` (after timeout)
- `half-open` → `closed` (on success)
- `half-open` → `open` (on failure)

**Enforcement:**
- State machine enforced in circuit breaker
- Invalid transitions logged and rejected
- Transitions emit events

### INV-CB-002: Failure Counting

**Statement:** Failures MUST be counted accurately within the window.

**Rationale:** Inaccurate counts cause premature or delayed circuit opening.

**Enforcement:**
- Sliding window implementation
- Old failures aged out of window
- Count reflects recent failures only

### INV-CB-003: Reset After Timeout

**Statement:** Open circuit MUST transition to half-open after timeout.

**Rationale:** Circuits must eventually allow retry to detect recovery.

**Enforcement:**
- Timeout timer started on open
- Half-open entered after timeout
- Single request allowed in half-open

## Rate Limiter Invariants

### INV-RL-001: Limit Enforcement

**Statement:** Rate limits MUST be enforced as configured.

**Rationale:** Exceeding limits causes provider throttling or cost overruns.

**Enforcement:**
- Requests counted per window
- Excess requests rejected or queued
- No bypass without explicit override

### INV-RL-002: Token Bucket Accuracy

**Statement:** Token bucket MUST refill at configured rate.

**Rationale:** Inaccurate refill causes throttling drift.

**Enforcement:**
- Tokens added at `refillRate` per second
- Max tokens capped at `bucketSize`
- Fractional tokens tracked

### INV-RL-003: Fair Queueing

**Statement:** Queued requests MUST be processed in order.

**Rationale:** FIFO ensures fair treatment of requests.

**Enforcement:**
- Queue uses FIFO ordering
- No priority jumping without configuration
- Queue size limited to prevent memory issues

## Metrics Invariants

### INV-MET-001: Accurate Counting

**Statement:** Metrics counters MUST be monotonically increasing.

**Rationale:** Decreasing counters indicate bugs or data loss.

**Enforcement:**
- Counters only increment, never decrement
- Atomic increment operations
- Reset only via explicit reset method

### INV-MET-002: Latency Accuracy

**Statement:** Latency measurements MUST reflect actual elapsed time.

**Rationale:** Inaccurate latency affects performance analysis.

**Enforcement:**
- High-resolution timer used
- Start/end timestamps paired
- Negative latencies rejected

### INV-MET-003: No Data Loss

**Statement:** Metrics MUST NOT be lost during collection.

**Rationale:** Lost metrics cause incorrect dashboards and alerts.

**Enforcement:**
- Metrics buffered before flush
- Flush failures retry with backoff
- Overflow handled gracefully

## Testing Requirements

1. `INV-CB-001`: Test all state transitions
2. `INV-CB-002`: Test failure counting accuracy
3. `INV-CB-003`: Test timeout causes half-open
4. `INV-RL-001`: Test rate limits enforced
5. `INV-RL-002`: Test token refill rate
6. `INV-RL-003`: Test queue ordering
7. `INV-MET-001`: Test counter monotonicity
8. `INV-MET-002`: Test latency accuracy
9. `INV-MET-003`: Test no data loss on flush

## Version History

- V1 (2024-12-16): Initial contract definition
