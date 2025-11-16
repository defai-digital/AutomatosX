# AutomatosX Runtime - Threat Model v1

**Document Version**: 1.0 (Day 3 Baseline)
**Last Updated**: Sprint 1, Day 3
**Status**: **BASELINE ESTABLISHED** ✅
**Security Lead**: SEC
**Contributors**: ARCH, RE1, RE2, QAL, DO1

---

## Executive Summary

This threat model establishes the **baseline security posture** for AutomatosX Runtime state machine. It identifies attack surfaces, threat actors, attack vectors, and mitigation strategies for the runtime's state transition system.

**Threat Model Scope**: Sprint 1 Day 3 baseline covers:
- State transition attack surface (8 states, 7 event types)
- Guard evaluation vulnerabilities
- Event spoofing and replay attacks
- Metadata injection and sanitization
- Cancellation abuse scenarios

**Maturity Level**: **v1 Baseline** (Day 3)
**Next Review**: Day 5 (Week 1 gate review) - Expand to include guard library and telemetry threats

---

## 1. Threat Actor Profile

### Primary Threat Actors

| Actor Type           | Motivation                                  | Capability Level | Attack Vector Focus                          |
|----------------------|---------------------------------------------|------------------|----------------------------------------------|
| **Malicious User**   | Execute unauthorized tasks, bypass policies | Medium           | Event injection, guard bypass                |
| **Compromised Agent**| Escalate privileges, exfiltrate data        | High             | State transition manipulation, event replay  |
| **Supply Chain Attacker** | Inject malicious manifest/dependencies | High             | Manifest tampering, dependency poisoning     |
| **Internal Threat**  | Data theft, sabotage                        | High             | Direct state machine access, telemetry manipulation |

### Threat Actor Capabilities

- **Low**: Can submit normal events via public API
- **Medium**: Can craft malformed payloads, attempt event injection
- **High**: Can attempt cryptographic attacks, timing exploits, state machine reverse engineering

---

## 2. Attack Surface Inventory (from Day 1 Security Checklist)

### Critical Attack Surfaces

| Transition                  | Attack Vector                              | Impact (H/M/L) | Likelihood (H/M/L) | Risk Score |
|-----------------------------|-------------------------------------------|----------------|-------------------|------------|
| **BOOTSTRAPPING → IDLE**    | Spoofed dependency validation signal      | High           | Medium            | **HIGH**   |
| **IDLE → PREPARING**        | Malicious manifest smuggling              | High           | High              | **CRITICAL** |
| **PREPARING → EXECUTING**   | Guard bypass exploitation                 | High           | Medium            | **HIGH**   |
| **EXECUTING → COMPLETED/FAILED** | Event spoofing and replay            | Medium         | High              | **MEDIUM** |
| **All States**              | Metadata injection attacks                | Medium         | Medium            | **MEDIUM** |
| **PREPARING/EXECUTING**     | Cancellation abuse (DoS)                  | Low            | Medium            | **LOW**    |

**Risk Scoring**: Critical (H+H), High (H+M or M+H), Medium (M+M or H+L), Low (L+* or *+L)

---

## 3. Detailed Threat Scenarios

### Threat 1: Malicious Manifest Smuggling (IDLE → PREPARING)

**Attack Vector**: Attacker submits `TaskSubmitted` event with crafted manifest containing:
- Malicious code execution payloads
- Resource exhaustion triggers
- Privilege escalation instructions

**Attack Flow**:
1. User submits task via CLI: `ax run malicious-task`
2. Runtime accepts event without manifest validation: `IDLE → PREPARING`
3. `HydratePlan(taskId)` effect loads malicious manifest from untrusted source
4. Execution proceeds with compromised plan

**Impact**:
- **High**: Arbitrary code execution in runtime context
- **Data Exfiltration**: Task could access sensitive memory
- **Persistence**: Malicious task could establish backdoors

**Current Mitigations** (Day 3 Baseline):
- ❌ **Missing**: No schema validation on manifest structure
- ❌ **Missing**: No signature verification on manifest source
- ❌ **Missing**: No manifest content sanitization

**Recommended Mitigations** (P0):
1. **Schema Validation**: Enforce Zod schema validation on all manifest fields before accepting `TaskSubmitted` event
2. **Signature Verification**: Require cryptographic signature on manifest bundle (HMAC-SHA256 with shared secret)
3. **Content Sanitization**: Strip dangerous fields (e.g., `eval`, `exec`, filesystem access) from manifest before hydration
4. **Sandboxing**: Execute manifest hydration in isolated worker with resource limits

**Target Completion**: Day 4 (Rule Engine + Policy DSL implementation)

---

### Threat 2: Guard Bypass Exploitation (PREPARING → EXECUTING)

**Attack Vector**: Attacker manipulates `guardVerdict` context or guard evaluation logic to bypass policy checks.

**Attack Flow**:
1. Task enters PREPARING state with crafted metadata
2. Guard evaluation runs with tampered context: `guardVerdict: Allowed` (should be `Blocked`)
3. Transition to EXECUTING proceeds despite policy violation
4. Unauthorized task execution completes

**Impact**:
- **High**: Policy enforcement circumvention
- **Privilege Escalation**: Blocked tasks execute with elevated privileges
- **Compliance Violations**: Actions violate organizational policies (e.g., change windows, resource quotas)

**Current Mitigations** (Day 3 Baseline):
- ✅ **Present**: Guard verdict checked in `PREPARING → EXECUTING` transition (StateMachine.res:236-246)
- ❌ **Missing**: No guard execution isolation (guards run in main thread)
- ❌ **Missing**: No guard verdict audit trail
- ❌ **Missing**: No guard verdict tampering detection

**Recommended Mitigations** (P1):
1. **Guard Isolation**: Execute all guards in isolated worker threads with immutable context inputs
2. **Verdict Signing**: Sign guard verdicts with cryptographic proof-of-execution (HMAC)
3. **Audit Logging**: Log all guard evaluations with timestamp, context snapshot, verdict to immutable log
4. **Verdict Re-Evaluation**: Re-check guard verdict immediately before `StartExecution` effect

**Target Completion**: Day 5-7 (Guard library hardening)

---

### Threat 3: Event Spoofing & Replay Attacks (All Transitions)

**Attack Vector**: Attacker crafts or replays legitimate events to force unauthorized state transitions.

**Attack Flow (Spoofing)**:
1. Attacker intercepts `DependenciesReady` event structure
2. Crafts fake `DependenciesReady` event with `dependenciesReady=true`
3. Injects event into state machine while dependencies are **not** actually ready
4. Runtime transitions `PREPARING → EXECUTING` with unmet dependencies

**Attack Flow (Replay)**:
1. Attacker captures legitimate `RetryTrigger` event from previous session
2. Replays event multiple times to force excessive retries (DoS)
3. Runtime exhausts retry budget, causing task failures

**Impact**:
- **Medium**: State machine desynchronization
- **DoS**: Retry/cancellation amplification attacks
- **Data Corruption**: Executing with incomplete dependencies

**Current Mitigations** (Day 3 Baseline):
- ❌ **Missing**: No event authentication (events lack signatures)
- ❌ **Missing**: No event nonce/sequence tracking (replay vulnerable)
- ❌ **Missing**: No event timestamp validation (temporal exploits possible)

**Recommended Mitigations** (P0):
1. **Event Authentication**: Attach trace/span IDs (OpenTelemetry format) to all events, verify against active trace
2. **Nonce Tracking**: Include monotonic sequence number in events, reject duplicates
3. **Timestamp Validation**: Reject events older than 30s, enforce clock skew tolerance
4. **Event Source Validation**: Whitelist event emitters (only dispatcher, not external sources)

**Target Completion**: Day 6 (Event dispatcher security hardening)

---

### Threat 4: Metadata Injection Attacks (All Transitions)

**Attack Vector**: Attacker injects malicious payloads into `context.metadata` field to exploit downstream consumers.

**Attack Flow**:
1. User submits task with crafted metadata: `{"taskId": "<script>alert(XSS)</script>"}`
2. Runtime accepts metadata without sanitization
3. Metadata propagated to telemetry, logs, effects
4. Telemetry backend executes injected script (XSS in monitoring dashboard)

**Impact**:
- **Medium**: XSS in telemetry/monitoring dashboards
- **Low**: Log injection (falsified audit trails)
- **Low**: Effect payload tampering

**Current Mitigations** (Day 3 Baseline):
- ❌ **Missing**: No metadata schema validation
- ❌ **Missing**: No metadata sanitization before effect emission
- ❌ **Missing**: No metadata size limits (amplification DoS)

**Recommended Mitigations** (P1):
1. **Schema Validation**: Define and enforce Zod schemas for all metadata fields
2. **Sanitization**: HTML-escape all string values before emission to telemetry/logs
3. **Size Limits**: Cap metadata size at 10KB, reject oversized payloads
4. **Field Whitelisting**: Only allow known metadata fields, drop unknown keys

**Target Completion**: Day 7-8 (Metadata validation layer)

---

### Threat 5: Cancellation Abuse (PREPARING/WAITING/EXECUTING → CANCELED)

**Attack Vector**: Attacker floods runtime with `CancelRequest` events to cause denial-of-service.

**Attack Flow**:
1. Attacker submits 1000 tasks rapidly
2. Immediately issues `CancelRequest` for each task
3. Runtime processes cancellations, triggering rollback effects for all tasks
4. Effect processing queue saturated, legitimate tasks delayed

**Impact**:
- **Low**: DoS via effect queue saturation
- **Low**: Resource exhaustion (rollback operations costly)
- **Medium**: Legitimate task starvation

**Current Mitigations** (Day 3 Baseline):
- ✅ **Present**: Cancellation requires `cancellationRequested=true` flag in PREPARING state (StateMachine.res:252-261)
- ❌ **Missing**: No rate limiting on `CancelRequest` events
- ❌ **Missing**: No dual confirmation for EXECUTING state cancellations

**Recommended Mitigations** (P2):
1. **Rate Limiting**: Apply per-user rate limit on `CancelRequest` events (max 10/minute)
2. **Dual Confirmation**: Require explicit confirmation for canceling EXECUTING tasks
3. **Effect Throttling**: Limit concurrent `PerformRollback` effects to 5 (queue remainder)
4. **Cancellation Audit**: Log all cancellation requests with requestor identity

**Target Completion**: Day 9-10 (Cancellation hardening)

---

### Threat 6: Spoofed Dependency Validation (BOOTSTRAPPING → IDLE)

**Attack Vector**: Attacker manipulates dependency check to force premature runtime initialization.

**Attack Flow**:
1. Runtime enters BOOTSTRAPPING state, begins dependency validation
2. Attacker injects fake `DependenciesReady` event before validation completes
3. Runtime transitions to IDLE with uninitialized dependencies
4. First task submission triggers crash or undefined behavior

**Impact**:
- **High**: Runtime crash on first task execution
- **High**: Undefined behavior from uninitialized state
- **Medium**: Data corruption from partial initialization

**Current Mitigations** (Day 3 Baseline):
- ✅ **Present**: BOOTSTRAPPING only accepts `DependenciesReady` event (StateMachine.res:204-218)
- ❌ **Missing**: No cryptographic proof of dependency readiness
- ❌ **Missing**: No dependency validation checksum

**Recommended Mitigations** (P0):
1. **Signed Config Bundle**: Require cryptographically signed config bundle with dependency checksums
2. **Checksum Verification**: Verify SHA-256 hash of loaded dependencies against manifest
3. **Initialization Attestation**: Emit signed "initialization complete" attestation before accepting events

**Target Completion**: Day 4-5 (Bootstrapping hardening)

---

## 4. Mitigation Roadmap

### Priority 1 (P0) - Critical Security (Days 4-6)

| Threat            | Mitigation                                    | Deliverable                              | Day |
|-------------------|----------------------------------------------|------------------------------------------|-----|
| Manifest Smuggling| Schema validation + signature verification   | Zod schemas for manifest, HMAC verifier  | 4   |
| Dependency Spoofing| Signed config bundle, checksum verification | Checksum validator, attestation emitter  | 5   |
| Event Spoofing    | Event authentication (trace IDs), nonces     | Event signature library, nonce tracker   | 6   |

### Priority 2 (P1) - High Security (Days 7-8)

| Threat            | Mitigation                                    | Deliverable                              | Day |
|-------------------|----------------------------------------------|------------------------------------------|-----|
| Guard Bypass      | Guard isolation, verdict signing             | Worker-based guard executor, HMAC signer | 7   |
| Metadata Injection| Schema validation, sanitization, size limits | Metadata validator, HTML escaper         | 8   |

### Priority 3 (P2) - Medium Security (Days 9-10)

| Threat            | Mitigation                                    | Deliverable                              | Day |
|-------------------|----------------------------------------------|------------------------------------------|-----|
| Cancellation Abuse| Rate limiting, dual confirmation             | Rate limiter, confirmation prompt        | 9   |
| Event Replay      | Timestamp validation, sequence tracking      | Replay detector, timestamp validator     | 10  |

---

## 5. Attack Mitigation Summary (Contract Integration)

### Transition-Specific Mitigations

| Transition               | Enforced Mitigation                                               | Contract Clause |
|--------------------------|------------------------------------------------------------------|-----------------|
| BOOTSTRAPPING → IDLE     | Signed config bundle, checksum verification on dependencies      | Section 3, 8    |
| IDLE → PREPARING         | Manifest schema validation (Zod), HMAC signature check           | Section 3, 8    |
| PREPARING → EXECUTING    | Guard isolation (worker threads), verdict re-check, audit log    | Section 4, 7    |
| WAITING → PREPARING      | Dependency validation, event authentication (trace IDs)          | Section 3, 8    |
| EXECUTING → COMPLETED    | Telemetry flush with signature, event nonce check                | Section 6, 8    |
| * → CANCELED             | Rate limit (10/min), dual confirmation for EXECUTING cancellations | Section 9, 8    |

---

## 6. Security Testing Requirements (Day 3 Target: 820 Tests)

### Threat-Based Test Coverage

| Test Category                          | Test Count | Coverage Area                                              |
|----------------------------------------|------------|------------------------------------------------------------|
| **Manifest Schema Validation Tests**   | 5          | Reject malformed manifests, invalid signatures             |
| **Guard Isolation Tests**              | 5          | Verify guards run in isolated context, no shared state     |
| **Event Authentication Tests**         | 5          | Reject events without trace IDs, detect replay attempts    |
| **Metadata Sanitization Tests**        | 5          | HTML-escape metadata, reject oversized payloads            |
| **Cancellation Rate Limit Tests**      | 5          | Enforce rate limits, dual confirmation logic               |
| **Dependency Checksum Tests**          | 5          | Verify checksums, reject tampered dependencies             |

**Total Threat Model Tests**: 30 (subset of 40 Day 3 tests, remainder = contract boundary tests)

---

## 7. Compliance & Audit Requirements

### Audit Log Requirements

All security-relevant events **must** be logged to immutable audit log:

1. **Guard Evaluation**: Timestamp, taskId, guardName, verdict, context snapshot
2. **State Transitions**: Timestamp, fromState, toState, event, actor/requestor
3. **Cancellation Requests**: Timestamp, taskId, requestedBy, confirmation status
4. **Manifest Loading**: Timestamp, taskId, manifestVersion, signature verification result
5. **Dependency Validation**: Timestamp, dependencyName, checksum, validation result

**Log Retention**: 90 days minimum
**Log Integrity**: Append-only, cryptographically signed log entries (HMAC-SHA256)

### Security Monitoring

**Alert Thresholds**:
- Guard bypass attempts: >5 within 10 minutes → **Critical Alert**
- Event replay detections: >10 within 5 minutes → **High Alert**
- Cancellation rate limit violations: >50 within 1 hour → **Medium Alert**
- Manifest signature failures: >1 within 1 day → **High Alert**

---

## 8. Threat Model Versioning

### Version History

| Version | Date         | Changes                                                  | Author |
|---------|--------------|----------------------------------------------------------|--------|
| v1.0    | Sprint 1 Day 3 | Baseline threat model covering 6 primary threat scenarios | SEC    |

### Next Version (v1.1 - Day 5)

**Planned Additions**:
- Threat scenarios for guard library (rate limiting guards, dependency checks)
- Telemetry injection attacks (fake telemetry events)
- Retry amplification attacks (exponential backoff bypass)
- Time-of-check/time-of-use (TOCTOU) vulnerabilities in context validation

---

## 9. Open Security Risks (Day 3 Baseline)

| Risk ID | Description                                           | Severity | Status       | Target Resolution |
|---------|-------------------------------------------------------|----------|--------------|-------------------|
| RISK-001| No manifest signature verification                    | Critical | **OPEN**     | Day 4             |
| RISK-002| Guard execution not isolated                          | High     | **OPEN**     | Day 7             |
| RISK-003| Event authentication missing (trace IDs)              | High     | **OPEN**     | Day 6             |
| RISK-004| Metadata validation/sanitization absent               | Medium   | **OPEN**     | Day 8             |
| RISK-005| Cancellation rate limiting not enforced               | Low      | **OPEN**     | Day 9             |
| RISK-006| Dependency checksum verification missing              | Critical | **OPEN**     | Day 5             |

**P0 Risks (Must resolve before Week 1 gate)**: RISK-001, RISK-006, RISK-003

---

## 10. Sign-Off

**Security Lead (SEC)**: ✅ **APPROVED** - v1.0 baseline established. P0 mitigations prioritized for Days 4-6.
**Architecture Lead (ARCH)**: ✅ **REVIEWED** - Threat scenarios align with contract (day3-state-machine-contract.md).
**Runtime Lead (RE1)**: ✅ **ACKNOWLEDGED** - Mitigation roadmap feasible within Sprint 1 timeline.

**Threat Model Version**: 1.0
**Effective Date**: Sprint 1, Day 3
**Next Review**: Day 5 (Week 1 gate review) + Security deep-dive workshop

---

**End of Threat Model v1**
