# P3 Week 4 Plan - CLI Commands & Documentation

**Date**: 2025-11-07
**Phase**: P3.4 - CLI Commands & Documentation
**Status**: 🚀 **PLANNED** (Ready to Execute)

---

## Overview

P3 Week 4 focuses on providing user-facing CLI commands for telemetry management and comprehensive documentation. This work makes the telemetry system accessible to end users and integrators.

**Prerequisites**: P3 Week 2 complete (Remote Submission & Aggregation)

**Duration**: 3-4 days

**Estimated Lines of Code**: ~600 (400 production + 200 test)

---

## Goals

1. **User Control**: Provide intuitive CLI commands for telemetry management
2. **Transparency**: Show users what data is collected and stored
3. **Privacy**: Clear documentation of privacy-first approach
4. **Developer Experience**: API documentation for telemetry integration

---

## Day 1: Core CLI Commands (Status, Enable, Disable)

### Tasks

#### 1.1 Implement `ax telemetry status` Command
**Purpose**: Show current telemetry configuration and state

**Output Format**:
```
Telemetry Status:
  Enabled: Yes
  Remote Submission: Yes
  Session ID: 550e8400-e29b-41d4-a716-446655440000

Local Storage:
  Events: 1,234
  Database Size: 2.5 MB
  Oldest Event: 2025-10-15 10:30:00
  Newest Event: 2025-11-07 17:25:00

Remote Submission:
  Queue: 15 pending, 3 retrying
  Last Submission: 2025-11-07 17:25:00
  Status: OK
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetryStatus()`
- Dependencies: TelemetryService, TelemetryDAO
- Error handling: Graceful fallback if service unavailable

**Tests**:
- Status when telemetry disabled
- Status when local-only enabled
- Status when remote enabled
- Status with empty database
- Status with queue entries

#### 1.2 Implement `ax telemetry enable [--remote]` Command
**Purpose**: Enable telemetry collection with optional remote submission

**Usage**:
```bash
ax telemetry enable              # Local only
ax telemetry enable --remote     # Local + remote submission
```

**Output**:
```
✓ Telemetry enabled (local only)

What is collected:
  - Command usage (no file paths)
  - Query performance metrics
  - Parser invocations (language stats only)
  - Error types (no stack traces with PII)

Privacy:
  - No file paths or code content
  - Anonymous session IDs only
  - Data stored locally in ~/.automatosx/telemetry.db

View data: ax telemetry stats
Disable: ax telemetry disable
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetryEnable(remote?: boolean)`
- Dependencies: TelemetryService
- Consent recording: Save consent timestamp

**Tests**:
- Enable local only
- Enable with remote
- Re-enable when already enabled
- Error handling

#### 1.3 Implement `ax telemetry disable` Command
**Purpose**: Disable telemetry collection

**Usage**:
```bash
ax telemetry disable
```

**Output**:
```
✓ Telemetry disabled

Your data:
  - 1,234 events remain in local database
  - To clear: ax telemetry clear

Re-enable: ax telemetry enable
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetryDisable()`
- Dependencies: TelemetryService
- Opt-out recording: Save opt-out timestamp

**Tests**:
- Disable when enabled
- Disable when already disabled
- Disable stops background submission
- Error handling

**Estimated Work**: 4-6 hours, ~200 lines of code, 15 tests

---

## Day 2: Data Management Commands (Clear, Submit, Stats)

### Tasks

#### 2.1 Implement `ax telemetry clear` Command
**Purpose**: Clear all telemetry data from local database

**Usage**:
```bash
ax telemetry clear              # Interactive confirmation
ax telemetry clear --force      # Skip confirmation
```

**Output**:
```
Warning: This will delete all telemetry data (1,234 events)

Are you sure? (y/N): y

✓ Cleared 1,234 events
✓ Cleared 18 queued submissions
✓ Database size: 2.5 MB → 24 KB

Re-enable telemetry: ax telemetry enable
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetryClear(force?: boolean)`
- Dependencies: TelemetryService
- Confirmation prompt: Use `inquirer` or built-in readline
- Clear both telemetry_events and telemetry_queue tables

**Tests**:
- Clear with confirmation (yes)
- Clear with confirmation (no)
- Clear with --force flag
- Clear when already empty
- Error handling

#### 2.2 Implement `ax telemetry submit` Command
**Purpose**: Manually trigger remote submission

**Usage**:
```bash
ax telemetry submit
```

**Output**:
```
Submitting queued events...

✓ Submitted 15 events
✓ Accepted: 15
✓ Rejected: 0

Queue: 0 pending, 0 retrying
```

**Error Output** (rate limited):
```
⚠ Rate limited: Please wait 5 seconds before next submission

Queue: 15 pending, 0 retrying
Automatic submission in 30 seconds
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetrySubmit()`
- Dependencies: TelemetryService
- Error handling: Rate limiting, network errors

**Tests**:
- Successful submission
- Rate limited submission
- Network error handling
- Empty queue
- Remote submission disabled

#### 2.3 Implement `ax telemetry stats [--format json|table]` Command
**Purpose**: Show aggregated telemetry statistics

**Usage**:
```bash
ax telemetry stats              # Table format (default)
ax telemetry stats --format json
ax telemetry stats --start 2025-11-01 --end 2025-11-07
```

**Output** (table format):
```
Telemetry Statistics (2025-11-01 to 2025-11-07)

Command Usage:
  ax find       523 executions
  ax def        234 executions
  ax flow        89 executions
  ax lint        45 executions

Query Performance:
  Symbol queries:    523 (avg 12ms)
  Text queries:      234 (avg 45ms)
  Cached results:    42%

Parser Invocations:
  TypeScript:   1,234 files (avg 8ms)
  JavaScript:     456 files (avg 6ms)
  Python:         234 files (avg 10ms)

Errors:
  Parse errors:       12
  Network errors:      3
  Unknown errors:      1
```

**Output** (JSON format):
```json
{
  "period": {
    "start": "2025-11-01T00:00:00Z",
    "end": "2025-11-07T23:59:59Z"
  },
  "commands": {
    "ax find": { "count": 523, "avgDuration": 145 },
    "ax def": { "count": 234, "avgDuration": 89 }
  },
  "queries": {
    "symbol": { "count": 523, "avgDuration": 12, "cached": 220 },
    "text": { "count": 234, "avgDuration": 45, "cached": 98 }
  },
  "parsers": {
    "typescript": { "files": 1234, "avgDuration": 8 },
    "javascript": { "files": 456, "avgDuration": 6 }
  },
  "errors": {
    "parse": 12,
    "network": 3,
    "unknown": 1
  }
}
```

**Implementation**:
- File: `src/cli/commands/telemetry.ts`
- Function: `telemetryStats(options: StatsOptions)`
- Dependencies: TelemetryService, TelemetryDAO
- Date filtering: Support --start and --end flags
- Formatting: Table (default) or JSON

**Tests**:
- Stats with default date range
- Stats with custom date range
- Stats in table format
- Stats in JSON format
- Empty database

**Estimated Work**: 4-6 hours, ~200 lines of code, 15 tests

---

## Day 3: CLI Integration & Testing

### Tasks

#### 3.1 CLI Entry Point Integration
**Purpose**: Wire up telemetry commands to main CLI

**File**: `src/cli/index.ts`

**Changes**:
```typescript
import { telemetryStatus, telemetryEnable, telemetryDisable, telemetryClear, telemetrySubmit, telemetryStats } from './commands/telemetry.js';

// Add telemetry command group
program
  .command('telemetry')
  .description('Manage telemetry collection and privacy')
  .addCommand(telemetryStatusCommand)
  .addCommand(telemetryEnableCommand)
  .addCommand(telemetryDisableCommand)
  .addCommand(telemetryClearCommand)
  .addCommand(telemetrySubmitCommand)
  .addCommand(telemetryStatsCommand);
```

#### 3.2 CLI Command Tests
**Purpose**: Test CLI commands end-to-end

**File**: `src/cli/commands/__tests__/telemetry.test.ts`

**Test Coverage** (30 tests):
- Status command (5 tests)
- Enable command (5 tests)
- Disable command (5 tests)
- Clear command (5 tests)
- Submit command (5 tests)
- Stats command (5 tests)

**Testing Strategy**:
- Mock TelemetryService methods
- Test output formatting
- Test error handling
- Test flag parsing
- Test interactive prompts

#### 3.3 Manual CLI Testing
**Purpose**: Verify CLI commands work in real environment

**Test Scenarios**:
1. Enable telemetry → status → submit → stats → disable
2. Enable with remote → status → submit → stats → disable → clear
3. Error scenarios (network failures, rate limiting)
4. Edge cases (empty database, already enabled/disabled)

**Estimated Work**: 4-6 hours, ~100 lines of test code, 30 tests

---

## Day 4: Documentation

### Tasks

#### 4.1 User Documentation
**Purpose**: Help users understand telemetry and privacy

**File**: `automatosx/PRD/telemetry-user-guide.md`

**Sections**:
1. **What is Telemetry?**
   - Purpose and benefits
   - What data is collected
   - What is NOT collected (privacy)

2. **Getting Started**
   - Enabling telemetry
   - Viewing your data
   - Disabling telemetry

3. **CLI Commands**
   - `ax telemetry status`
   - `ax telemetry enable [--remote]`
   - `ax telemetry disable`
   - `ax telemetry clear`
   - `ax telemetry submit`
   - `ax telemetry stats`

4. **Privacy Policy**
   - No PII collection
   - Anonymous session IDs
   - Local-first storage
   - User control and transparency

5. **FAQ**
   - Common questions
   - Troubleshooting

**Estimated Work**: 2-3 hours, ~300 lines

#### 4.2 Developer API Documentation
**Purpose**: Help developers integrate telemetry in their code

**File**: `automatosx/PRD/telemetry-api-reference.md`

**Sections**:
1. **Overview**
   - Architecture diagram
   - Component interaction

2. **TelemetryService API**
   - Initialization
   - Event tracking methods
   - Remote submission methods
   - Data management methods

3. **Event Types**
   - Command events
   - Query events
   - Parser events
   - Error events
   - Performance metrics
   - Feature usage

4. **Configuration**
   - SubmissionConfig
   - RateLimiterConfig
   - RetryConfig

5. **Best Practices**
   - When to track events
   - Error handling
   - Testing with telemetry
   - Performance considerations

6. **Examples**
   - Basic usage
   - Remote submission setup
   - Custom event tracking
   - Integration testing

**Estimated Work**: 2-3 hours, ~400 lines

#### 4.3 Privacy Policy Document
**Purpose**: Formal privacy policy for telemetry

**File**: `automatosx/PRD/telemetry-privacy-policy.md`

**Sections**:
1. **Data Collection**
   - What we collect
   - What we don't collect

2. **Data Usage**
   - Purpose of collection
   - How data is used

3. **Data Storage**
   - Local storage location
   - Remote submission (opt-in)
   - Data retention

4. **User Rights**
   - Right to disable
   - Right to view data
   - Right to delete data

5. **Changes to Policy**
   - Notification of changes

**Estimated Work**: 1-2 hours, ~200 lines

**Day 4 Total**: 5-8 hours, ~900 lines of documentation

---

## Success Criteria

### Functionality
- [ ] All 6 CLI commands implemented and working
- [ ] Commands provide clear, helpful output
- [ ] Error handling is robust and informative
- [ ] Interactive prompts work correctly
- [ ] JSON and table output formats correct

### Testing
- [ ] 30+ CLI command tests passing
- [ ] Manual testing completed successfully
- [ ] Edge cases handled gracefully
- [ ] Error scenarios tested

### Documentation
- [ ] User guide complete and clear
- [ ] API reference comprehensive
- [ ] Privacy policy accurate and transparent
- [ ] Examples working and tested

### User Experience
- [ ] Commands are intuitive and discoverable
- [ ] Output is readable and helpful
- [ ] Errors provide actionable guidance
- [ ] Privacy information is transparent

---

## File Structure

```
src/
├── cli/
│   ├── commands/
│   │   ├── telemetry.ts                    # NEW: CLI command implementations
│   │   └── __tests__/
│   │       └── telemetry.test.ts           # NEW: CLI command tests
│   └── index.ts                            # MODIFIED: Add telemetry commands

automatosx/PRD/
├── telemetry-user-guide.md                 # NEW: User documentation
├── telemetry-api-reference.md              # NEW: Developer documentation
└── telemetry-privacy-policy.md             # NEW: Privacy policy
```

---

## Dependencies

### Production Dependencies
- None (all components from P3 Week 2)

### Dev Dependencies
- `vitest` (already installed) - For CLI testing
- `@types/node` (already installed) - For CLI types

### CLI Framework
Current CLI framework: Check `src/cli/index.ts` to determine if using:
- `commander` - Command-line framework
- `inquirer` - Interactive prompts
- OR custom implementation

---

## Risk Assessment

### Low Risk
- CLI command implementation (straightforward)
- Status and stats commands (read-only)
- Documentation (no code changes)

### Medium Risk
- Interactive prompts (confirmation for clear command)
- Output formatting (table vs JSON)
- Error message consistency

### Mitigation
- Test all commands manually
- Use established CLI libraries
- Follow existing CLI patterns in codebase

---

## Timeline

| Day | Tasks | Hours | Status |
|-----|-------|-------|--------|
| 1 | Status, Enable, Disable commands | 4-6 | Pending |
| 2 | Clear, Submit, Stats commands | 4-6 | Pending |
| 3 | CLI integration, testing | 4-6 | Pending |
| 4 | User & developer documentation | 5-8 | Pending |
| **Total** | **All tasks** | **17-26 hours** | **0% Complete** |

---

## Next Actions

1. **Day 1 Start**: Implement `telemetry.ts` command file with status, enable, disable
2. **Check CLI Framework**: Determine current CLI setup (commander, yargs, custom)
3. **Test Infrastructure**: Set up CLI command testing with vitest
4. **Incremental Testing**: Test each command as implemented

---

## Notes

- Follow existing CLI command patterns in `src/cli/`
- Ensure consistent output formatting across commands
- All commands should be non-breaking (safe to run multiple times)
- Privacy-first messaging in all user-facing output
- Clear documentation of what data is collected and why

---

**Generated**: 2025-11-07
**Phase**: P3.4 - CLI Commands & Documentation
**Status**: 🚀 PLANNED
**Estimated Duration**: 3-4 days
**Estimated LOC**: 600 (400 production + 200 test) + 900 documentation
