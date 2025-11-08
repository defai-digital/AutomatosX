# P0 Sprint 1 Backlog Template

## Sprint Goal
- Concise statement aligning sprint commitment to ReScript refactor and SQLite integration outcomes.
- Example: “Deliver two ReScript-migrated modules with validated bindings, and ship first tranche of SQLite migrations through staging.”

## Sprint Cadence Snapshot
- Sprint length: 2 weeks  
- Daily standup: HH:MM (timezone)  
- Mid-sprint health check: Day 6  
- Demo & retrospective: Day 10

## User Stories & Tasks
| ID | Title | Type (Story/Spike/Task/Bug) | Description | Acceptance Criteria | Story Points | Owner(s) | Status |
|----|-------|-----------------------------|-------------|---------------------|--------------|----------|--------|
| P0-### | | | | - [ ] Criteria 1<br>- [ ] Criteria 2 | | | Not Started |

### Acceptance Criteria Format
- [ ] Behavior-focused statement referencing user value.  
- [ ] Testing evidence (automated or manual).  
- [ ] Documentation updates captured (if applicable).  
- [ ] Rollback/feature flag strategy defined.

## Estimation Guide
- Fibonacci sequence: 1, 2, 3, 5, 8 (avoid 13+; split instead).  
- Reference cards:  
  - **1 point:** Update existing binding configuration.  
  - **3 points:** Create new migration with tests.  
  - **5 points:** Migrate ReScript module with TypeScript interop and coverage.  
- Spikes receive timeboxed estimate (in days) and produce documented outcome.

## Capacity & Velocity Worksheet
| Team Member | Role | Availability (hours) | Focus Factor | Effective Capacity (points/hours) | Notes |
|-------------|------|----------------------|--------------|-----------------------------------|-------|
| Avery | Architecture | 16 | 0.6 | | |
| Bob | Backend | 64 | 0.8 | | |
| Felix | Fullstack | 64 | 0.8 | | |
| ReScript Champion | Specialist | 48 | 0.7 | | |
| Oliver | DevOps | 32 | 0.5 | | |
| Queenie | QA | 40 | 0.7 | | |
| Release Manager | Coordination | 24 | 0.5 | | |

## Dependencies & Blockers
| Item | Description | Owner | Needed By | Status | Mitigation |
|------|-------------|-------|-----------|--------|------------|
| | | | | | |

## Daily Progress Tracker
| Day | Date | Completed Stories | In-Progress | Blocked | Notes |
|-----|------|-------------------|-------------|---------|-------|
| 1 | | | | | |
| 2 | | | | | |
| ... | | | | | |

## Burndown/Burnup Setup
- Capture daily remaining story points in spreadsheet or Jira dashboard.  
- Plot ideal vs. actual trend; annotate scope changes.  
- For burnup, track total scope vs. completed scope to visualize additions/removals.

## Risk & Issue Log
| Risk/Issue | Likelihood (Low/Med/High) | Impact (Low/Med/High) | Mitigation Plan | Owner | Trigger/Review Date | Residual Risk |
|------------|---------------------------|-----------------------|-----------------|-------|---------------------|---------------|
| | | | | | | |

## Definition of Done Reminder
- ReScript builds green in CI with coverage.  
- SQLite migrations applied locally/staging with checksum verified.  
- Documentation updated (setup guide, onboarding, migration notes).  
- QA sign-off captured and release manager informed.  
- Observability updated where new components introduced.
