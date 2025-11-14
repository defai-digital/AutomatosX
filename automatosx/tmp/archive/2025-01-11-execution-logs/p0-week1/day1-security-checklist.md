# Day 1 Security Checklist — ReScript Runtime State Machine

## Attack Surface Inventory

| Transition/Event | Potential Attack Vector | Notes / Current Mitigation |
|------------------|-------------------------|-----------------------------|
| `BOOTSTRAPPING → IDLE` on `DEPS_READY` | Spoofed dependency validation signal could unlock runtime early. | Require signed config bundle + checksum before accepting event. |
| `IDLE → PREPARING` on `TASK_SUBMITTED` | Malicious manifest could smuggle privileged steps or excessive resource claims. | Run schema validation + policy guard before transition; enforce manifest size/time budgets. |
| `PREPARING ↔ WAITING_ON_DEP` on `DEPS_READY` / `RETRY_TRIGGER` | Dependency fan-out could be used for DoS (retry storms) or to hold locks indefinitely. | Rate-limit retries, enforce max wait window, emit telemetry for stuck dependencies. |
| `PREPARING → EXECUTING` on `DEPS_READY` | Guard bypass leads to unverified execution (policy/rule evasion). | Guards must run in isolated worker; require signed guard verdict. |
| `EXECUTING → COMPLETED/FAILED/CANCELED` via `RULE_VIOLATION`, `TIMEOUT`, `CANCEL_REQUEST` | Event spoofing could hide genuine violations or trigger unwanted rollback. | Authenticate event emitters, attach trace/span ids, audit cancellation requests. |
| `EXECUTING → COMPLETED` on `TELEMETRY_FLUSHED` | Telemetry flush could be skipped to avoid audit trail. | Block completion until telemetry sink acks receipt. |
| `FAILED/CANCELED → RETRY` | Replaying retry events could brute force policies or leak info through timing. | Throttle retries per task id, log replay attempts, bind retries to token. |

## Threat Model Checklist (Prep for Day 3 Deep Dive)

- [ ] Validate provenance of all state change events (signatures or mTLS channel).
- [ ] Enforce guard evaluation sandbox with immutable inputs.
- [ ] Capture structured audit log for every transition (include actor, manifest digest, guard verdict).
- [ ] Rate-limit retries + dependency wake-ups to prevent amplification attacks.
- [ ] Ensure cancellation requests require dual confirmation (initiator + runtime).
- [ ] Telemetry flush must confirm delivery before state exit; capture hash of emitted payload.
- [ ] Document timeout budgets per state to limit resource pinning.
- [ ] Map transition handlers to ownership (Runtime, Security, DevOps) for escalation routing.
- [ ] Integrate threat classification tags (Spoofing, Tampering, Repudiation, DoS, Elevation).
- [ ] Add regression tests for illegal transitions + guard bypass attempts (starting Day 2).

**Assumptions**
- Runtime events originate from authenticated CLI/Planner channel (mTLS + signed payloads).
- Policy guard verdicts will expose structured justification string for audit + user feedback.
- Telemetry sink is trusted once OTLP endpoint issues 200 OK (staging + prod parity).
