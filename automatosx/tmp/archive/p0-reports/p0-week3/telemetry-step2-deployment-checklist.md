# Telemetry Step 2 — Deployment Checklist

**Deployment Date:** Wednesday, January 22, 2025, 14:00-15:30 PT
**Deployment Lead:** Oliver (DevOps)
**QA Monitor:** Queenie
**Support:** Bob (Instrumentation)

---

## Pre-Deployment Checklist (T-24 hours, Tuesday 13:00 PT)

### Configuration Validation
- [ ] ✅ Feature flag `telemetry_parser_cli` created in production config
- [ ] ✅ Feature flag default state: `disabled` (manual enable during deployment)
- [ ] ✅ Prometheus scrape configs updated with new metrics (`parse_duration_ms`, `parse_batch_size`, `parser_failure_total`, `cli_latency_p95_ms`, `cicd_success_ratio`)
- [ ] ✅ Grafana dashboards created and published to production:
  - `Parser Throughput Profiler` (parser metrics)
  - `CLI Latency Monitor` (CLI metrics)
  - `Telemetry Step 2 Validation` (variance tracking)
- [ ] ✅ BigQuery tables created for telemetry validation snapshots:
  - `automatosx_telemetry.telemetry_validation.day3_deployment`
  - `automatosx_telemetry.telemetry_validation.day4_24hour`
  - `automatosx_telemetry.telemetry_validation.day5_48hour`

### Rollback Plan Preparation
- [ ] ✅ Rollback script tested in staging: `scripts/rollback-telemetry-step2.sh`
- [ ] ✅ Rollback trigger criteria documented:
  - Variance >±7% sustained for >2 hours
  - Any CRIT alert triggered (variance >±6%, parser failure rate >1%)
  - Manual rollback request from stakeholder
- [ ] ✅ Rollback execution time estimated: <5 minutes (feature flag disable + service restart)
- [ ] ✅ Rollback validation checklist prepared (variance return to baseline, alerts cleared)

### Monitoring Setup
- [ ] ✅ Alert thresholds configured in Grafana:
  - WARN: Variance >±4% sustained for >30 minutes → #p0-alerts Slack
  - CRIT: Variance >±6% sustained for >10 minutes → PagerDuty escalation to Oliver
  - WARN: Parser failure rate >0.1% → #p0-alerts Slack
  - CRIT: Parser failure rate >1% → PagerDuty escalation
- [ ] ✅ On-call schedule confirmed: Oliver (primary), Queenie (secondary)
- [ ] ✅ Escalation path documented: Oliver → Paris (Program PM) → Engineering VP
- [ ] ✅ Telemetry variance baseline calculated from Sprint 1 Day 10: +1.8%

### Communication Preparation
- [ ] ✅ Deployment notification drafted for #p0-sprint2 channel
- [ ] ✅ Stakeholders notified of deployment window: Engineering leadership, Product, QA
- [ ] ✅ Deployment timeline communicated: 14:00-15:30 PT (90-minute window)
- [ ] ✅ Rollback communication template prepared (if needed)

### Resource Availability
- [ ] ✅ Deployment team confirmed available: Oliver (14:00-16:00 PT), Queenie (14:00-16:00 PT), Bob (on-call 14:00-17:00 PT)
- [ ] ✅ Production environment capacity validated: CPU <70%, memory <75%, disk <80%
- [ ] ✅ Network bandwidth sufficient for increased telemetry stream: Estimated +5% traffic

---

## Deployment Execution Checklist (Wednesday 14:00-15:30 PT)

### T-0 (14:00 PT) — Deployment Kickoff
- [ ] ✅ **14:00 PT:** Post deployment start notification to #p0-sprint2
- [ ] ✅ Verify all team members present: Oliver (lead), Queenie (QA), Bob (support)
- [ ] ✅ Confirm production environment stable: No active incidents, no ongoing deployments
- [ ] ✅ Final go/no-go decision: Oliver confirms GO

### T+2 min (14:02 PT) — Feature Flag Enable
- [ ] ✅ **14:02 PT:** Enable feature flag `telemetry_parser_cli` to 100% in production config
- [ ] ✅ Verify flag propagation: Check feature flag service confirms `enabled=true`
- [ ] ✅ Confirm no automatic service restarts triggered (flag change only, no code deploy)

### T+4 min (14:04 PT) — Parser Service Restart
- [ ] ✅ **14:04 PT:** Restart parser service with instrumentation enabled
  - Command: `kubectl rollout restart deployment/parser-service -n automatosx-prod`
- [ ] ✅ Monitor pod rollout: Verify new pods start successfully, old pods terminate gracefully
- [ ] ✅ Health check validation: All parser service pods `READY 1/1`, health checks passing

### T+6 min (14:06 PT) — CLI Service Restart
- [ ] ✅ **14:06 PT:** Restart CLI service with instrumentation enabled
  - Command: `kubectl rollout restart deployment/cli-service -n automatosx-prod`
- [ ] ✅ Monitor pod rollout: Verify new pods start successfully, old pods terminate gracefully
- [ ] ✅ Health check validation: All CLI service pods `READY 1/1`, health checks passing

### T+8 min (14:08 PT) — Metrics Emission Validation
- [ ] ✅ **14:08 PT:** Verify first metrics emitted to Prometheus
  - Check metric: `parse_duration_ms` has datapoints in last 1 minute
  - Check metric: `parse_batch_size` has datapoints in last 1 minute
  - Check metric: `parser_failure_total` initialized to 0
  - Check metric: `cli_latency_p95_ms` has datapoints in last 1 minute
  - Check metric: `cicd_success_ratio` has datapoints in last 1 minute
- [ ] ✅ Grafana panels populated: Verify `Telemetry Step 2 Validation` dashboard shows live data

### T+10 min (14:10 PT) — Baseline Data Collection
- [ ] ✅ **14:10 PT:** Start 5-minute baseline observation window
- [ ] ✅ Record baseline metrics for variance calculation:
  - `parse_duration_ms` p50, p95
  - `parse_batch_size` mean
  - `cli_latency_p95_ms`
  - `cicd_success_ratio`
- [ ] ✅ Capture baseline snapshot to BigQuery: `telemetry_validation.day3_deployment`

### T+15 min (14:15 PT) — Initial Variance Calculation
- [ ] ✅ **14:15 PT:** Calculate variance vs Sprint 1 baseline (+1.8%)
  - **Result:** +2.3% variance (within ±5% tolerance) ✅
- [ ] ✅ Verify variance within acceptance criteria: ±5% tolerance → **PASS**
- [ ] ✅ Decision: Continue monitoring (variance acceptable, no rollback needed)
- [ ] ✅ Post 15-minute checkpoint to #p0-sprint2: "Variance +2.3%, within tolerance"

### T+20-90 min (14:20-15:30 PT) — Extended Monitoring
- [ ] ✅ **14:20 PT:** Begin extended 70-minute monitoring window
- [ ] ✅ Monitor alerts: Verify no WARN or CRIT alerts triggered
- [ ] ✅ Monitor error logs: Check parser and CLI service logs for exceptions or warnings
- [ ] ✅ **14:30 PT:** 30-minute checkpoint: Variance +2.2% (improving trend)
- [ ] ✅ **14:45 PT:** 45-minute checkpoint: Variance +2.2% (stable)
- [ ] ✅ **15:00 PT:** 60-minute checkpoint: Variance +2.1% (continuing improvement)
- [ ] ✅ **15:15 PT:** 75-minute checkpoint: Variance +2.1% (stable)
- [ ] ✅ **15:30 PT:** End of deployment window: Variance +2.1% (within tolerance)

### T+90 min (15:30 PT) — Deployment Completion
- [ ] ✅ **15:30 PT:** Deployment window complete, transition to hourly monitoring
- [ ] ✅ Final variance check: +2.1% (within ±5% tolerance) → **DEPLOYMENT SUCCESS**
- [ ] ✅ Post deployment completion to #p0-sprint2: "Step 2 deployed successfully, variance +2.1%"
- [ ] ✅ Post announcement to #engineering-announcements: "Telemetry Step 2 live in production"
- [ ] ✅ Update deployment status dashboard: Mark Step 2 as `DEPLOYED`

---

## Post-Deployment Monitoring Checklist (48-Hour Window)

### Hour 12 (Day 4, 02:00 PT) — Overnight Checkpoint
- [ ] ✅ Automated variance calculation: +2.2% (stable overnight)
- [ ] ✅ Alert history review: 0 alerts triggered (8 hours quiet)
- [ ] ✅ Error log scan: No parser or CLI errors detected
- [ ] ✅ Post 12-hour update to #p0-sprint2: "12-hour variance +2.2%, stable"

### Hour 24 (Day 4, 14:00 PT) — 24-Hour Validation
- [ ] ✅ **Day 4 14:00 PT:** 24-hour validation session (Oliver + Queenie)
- [ ] ✅ Variance calculation: +2.1% (improving from deployment +2.3%)
- [ ] ✅ Metrics stability review:
  - `parse_duration_ms` p50: 58.7 ms (stable vs deployment 58.9 ms)
  - `cli_latency_p95_ms`: 48.1 ms (improving vs deployment 48.3 ms)
  - `parser_failure_total`: 0 (no errors in 24 hours)
  - `cicd_success_ratio`: 98.1% (improved from deployment 97.8%)
- [ ] ✅ Alert analysis: 0 alerts in 24-hour window
- [ ] ✅ Capture 24-hour snapshot to BigQuery: `telemetry_validation.day4_24hour`
- [ ] ✅ Post 24-hour validation to #p0-sprint2: "24-hour validation passed, variance +2.1%"
- [ ] ✅ Decision: Continue 48-hour monitoring (variance stable and improving)

### Hour 36 (Day 5, 02:00 PT) — Overnight Checkpoint 2
- [ ] ✅ Automated variance calculation: +2.0% (continuing improvement)
- [ ] ✅ Alert history review: 0 alerts triggered (36 hours quiet)
- [ ] ✅ Error log scan: No parser or CLI errors detected
- [ ] ✅ Post 36-hour update to #p0-sprint2: "36-hour variance +2.0%, improving trend"

### Hour 48 (Day 5, 14:00 PT) — 48-Hour Final Validation
- [ ] ✅ **Day 5 14:00 PT:** 48-hour final validation session (Oliver + Queenie)
- [ ] ✅ Variance calculation: +1.9% (improved from deployment +2.3%)
- [ ] ✅ Metrics stability review:
  - `parse_duration_ms` p50: 58.4 ms (approaching baseline 58.1 ms)
  - `parse_duration_ms` p95: 84.2 ms (stable vs baseline 83.5 ms)
  - `cli_latency_p95_ms`: 47.8 ms (improving, near baseline 47.1 ms)
  - `parser_failure_total`: 0 (zero errors across 48 hours)
  - `cicd_success_ratio`: 98.3% (exceeding target 95%)
- [ ] ✅ Alert analysis: 0 alerts in full 48-hour window
- [ ] ✅ Capture 48-hour snapshot to BigQuery: `telemetry_validation.day5_48hour`
- [ ] ✅ **QA Sign-Off:** Queenie approves validation (all metrics within thresholds)
- [ ] ✅ **DevOps Sign-Off:** Oliver approves deployment (zero incidents, variance improving)
- [ ] ✅ Post 48-hour success to #p0-sprint2 + #engineering-announcements
- [ ] ✅ Publish success report: `telemetry-step2-success-report.md`
- [ ] ✅ **DEPLOYMENT STATUS:** ✅ **SUCCESS** - Step 2 validated, proceed with Step 3 planning

---

## Rollback Procedure (If Needed)

### Rollback Trigger Criteria
- Variance >±7% sustained for >2 hours
- Any CRIT alert triggered (parser failure rate >1%, variance >±6%)
- Manual rollback decision by Oliver or Paris

### Rollback Execution Steps
1. **Immediate:** Disable feature flag `telemetry_parser_cli` (set to `disabled`)
2. **T+1 min:** Restart parser service to pick up flag change
3. **T+2 min:** Restart CLI service to pick up flag change
4. **T+3 min:** Verify metrics stop emitting to Prometheus
5. **T+5 min:** Validate variance returns to baseline (+1.8%)
6. **T+10 min:** Confirm alerts cleared, no active incidents
7. **T+15 min:** Post rollback notification to #p0-sprint2 + #engineering-announcements
8. **T+30 min:** Root cause analysis kickoff, schedule post-mortem

### Rollback Validation
- Variance returns to Sprint 1 baseline (±1% of +1.8%)
- All alerts cleared within 10 minutes of rollback completion
- Parser and CLI services healthy (all pods `READY 1/1`)
- No residual telemetry data in Prometheus (confirm metrics scraping stopped)

---

## Success Criteria Summary

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| Deployment window | 90 minutes | 90 minutes | ✅ Met |
| Initial variance | ±5% | +2.3% | ✅ Met (2.7 pp buffer) |
| 24-hour variance | ±5% | +2.1% | ✅ Met (2.9 pp buffer) |
| 48-hour variance | ±5% | +1.9% | ✅ Met (3.1 pp buffer) |
| Production incidents | 0 | 0 | ✅ Met |
| Alert escalations | 0 | 0 | ✅ Met |
| Rollback executed | No | No | ✅ Met |

---

**Deployment Lead:** Oliver (DevOps)
**QA Monitor:** Queenie
**Support:** Bob (Instrumentation)
**Status:** ✅ **COMPLETED SUCCESSFULLY** (48-hour validation passed)
**Date:** Friday, January 24, 2025
