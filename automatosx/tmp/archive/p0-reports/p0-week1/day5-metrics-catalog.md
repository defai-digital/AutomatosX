# P0 Telemetry Metrics Catalog

> Canonical definitions for P0 migration telemetry. All metrics must be implemented with automated collection by Week 2.

## Migration Completeness Metrics
| Metric | Definition | Data Source | Collection Method | Update Frequency | Target / Threshold |
|--------|------------|-------------|-------------------|------------------|--------------------|
| P0 Module Completion % | Completed P0 modules ÷ total P0 modules (125) × 100 | Module inventory, migration tracker | Join module status table with P0 classification | Hourly | >= 90% by P0 exit; alert < planned trajectory (linear burn) |
| Migration Velocity | Number of modules transitioned per calendar week | Module tracker history | Weekly diff of completed module counts | Daily | >= 18 modules/week; alert if 3-day moving average < 12 |
| Migration Burndown (Remaining Modules) | Remaining modules per priority bucket plotted over time | Module inventory | Snapshot remaining counts nightly | Daily | Trend should reach zero by P0 deadline; alert if slope deviates by >15% |
| Action Mix Progress | Completion % by action type (KEEP, EXTEND, REFACTOR, NEW) | Module inventory with action tags | Aggregation by action type | Daily | Each category tracks within +/-10% of plan; alert when drift >10% |

## Quality Metrics
| Metric | Definition | Data Source | Collection Method | Update Frequency | Target / Threshold |
|--------|------------|-------------|-------------------|------------------|--------------------|
| Regression Test Coverage % | Covered statements in regression suite ÷ total statements for migrated modules | Coverage reports (Vitest), module ownership map | Merge coverage output with module IDs | Per build | >= 85%; alert < 80% sustained for 2 builds |
| Regression Pass Rate | Passed regression cases ÷ total executed per run | CI test runner logs | Parse pipeline results | Per build | 100%; alert if failures >2 consecutive runs or pass rate < 95% |
| Defect Density | Confirmed defects ÷ migrated modules in period | Incident tracker, module list | Link incidents to modules via tags | Weekly | <= 0.1 defects/module; alert when >0.2 in rolling week |
| Escaped Defects | Production incidents triggered by migrated modules | Incident Mgmt (PagerDuty/Jira) | Tag incidents with migration flag | Real-time | Alert on any escaped defect; auto-page critical |

## Performance Metrics
| Metric | Definition | Data Source | Collection Method | Update Frequency | Target / Threshold |
|--------|------------|-------------|-------------------|------------------|--------------------|
| Parser Throughput | Processed requests per second under P0 workload | Performance harness telemetry | Load test summary ingestion | Per run | >= baseline (v4) +10%; alert when < baseline |
| Parser 95th Percentile Latency | P95 response time for migrated parser | Performance monitoring | Export metrics via Prometheus/OpenTelemetry | 5 min | <= 250ms; alert warning @ 250ms, critical @ 300ms |
| Build Time | Duration of CI build for migrated modules | CI pipeline logs | Capture build step timings | Per build | <= 12 min; alert > 15 min |
| Resource Utilization | CPU/memory usage during parser workload | Infrastructure metrics (Grafana/Cloud) | Collect via agent + traced runs | 1 min | CPU < 75%, Memory < 70%; alert threshold breaches lasting >10 min |

## Operational Metrics
| Metric | Definition | Data Source | Collection Method | Update Frequency | Target / Threshold |
|--------|------------|-------------|-------------------|------------------|--------------------|
| CI/CD Success Rate | Successful pipeline runs ÷ total runs | CI system | Aggregate pipeline results | Per pipeline run | >= 95%; alert < 90% daily |
| Deployment Frequency | Deployments of migrated modules per week | Release tracker | Count deployments tagged with migration | Daily | >= 2 deployments/week; alert if <1 in rolling 7 days |
| Mean Time to Restore (MTTR) | Avg time to restore service after incident caused by migrated module | Incident tracker | Incident open/close timestamps | Incident-based | <= 30 min; alert if MTTR > 45 min |
| Change Failure Rate | Failed deployments ÷ total deployments | CI/CD + incident tracker | Link failed deploys to incidents | Weekly | <= 10%; alert when >15% |

## Business / Delivery Metrics
| Metric | Definition | Data Source | Collection Method | Update Frequency | Target / Threshold |
|--------|------------|-------------|-------------------|------------------|--------------------|
| Feature Delivery Rate | Count of P0-required features delivered per sprint | Product roadmap, release notes | Integrate roadmap tracker with release tagging | Sprintly | >= 90% of committed features; alert <80% |
| Team Capacity Utilization | Actual engineering hours spent on migration ÷ planned capacity | Resource planning tool, timesheets | Pull actuals vs plan data | Weekly | 80–95%; alert <70% (under-utilization) or >105% (burnout risk) |
| Stakeholder Satisfaction Score | Qualitative score from weekly stakeholder survey (1–5) | Stakeholder liaison survey | Automated survey ingestion | Weekly | >= 4.0; alert when <3.5 |
| Risk Burn-Down | Count of open high/critical architecture risks | Architecture risk register | Sync risk register statuses | Weekly | Downward trend; alert if count increases week-over-week |

## Instrumentation Notes
- **Identifiers**: Standardize module IDs across telemetry feeds to enable join operations.
- **Time Alignment**: All timestamps stored in UTC with ISO-8601 format; dashboards display localized time as needed.
- **Access Control**: Metrics stored in observability warehouse with role-based access reflective of persona views.
- **Data Quality**: Each metric must include validation checks (missing data alerts, range anomalies).
- **Backfill**: Pre-load baseline data for previous two sprints to seed trends before P0 Week 2 dashboard release.
