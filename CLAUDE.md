# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start
- Node.js >= 20.0.0 required
- `npm install` after pulling
- `npm run dev -- <command>` for CLI in watch mode (e.g., `npm run dev -- status`)
- `npm run build` before committing (auto-runs `npm run prebuild:config`)
- `npm run typecheck` to resolve type issues
- `npm test` runs all tests; scope with `npm run test:unit`, `npm run test:integration`, `npm run test:smoke`
- `npm run dev -- doctor` to validate provider setup (v6.0.7+)

## Directory Structure
- `src/` — runtime source organized by responsibility
  - `cli/` — command handlers and CLI interface
  - `agents/` — agent behaviors and delegation
  - `core/` — router, memory, spec-kit, policy evaluation
  - `providers/` — CLI integrations (Claude Code, Gemini, OpenAI)
  - `integrations/` — external tool integrations
  - `utils/` — shared utilities
- `tests/` — test suites (unit, integration, reliability, smoke)
- `docs/` — user-facing documentation
- `automatosx/PRD/` — product requirements and design notes
- `automatosx/tmp/` — short-lived drafts (auto-cleaned)
- `dist/` — generated bundles (never edit)
- `src/config.generated.ts` — auto-generated from `automatosx.config.json` (never edit)

## Development Workflow
1. Review `automatosx/PRD/` or `docs/` for context before making changes
2. Modify implementation under `src/` and corresponding tests under `tests/`
3. Run `npm run prebuild:config` if you modify `automatosx.config.json`
4. Keep worktree diffs focused
5. Update `docs/` or `README.md` when changing behavior

## Essential Commands

### Development
```bash
npm run dev -- list agents                     # Test CLI in watch mode
npm run dev -- run backend "hello world"       # Exercise agent in watch mode
npm run dev -- doctor openai                   # Validate OpenAI provider setup
npm run prebuild:config                        # Regenerate src/config.generated.ts
```

### Testing
```bash
npm test                                       # All tests (unit + integration + smoke)
npm run test:unit                              # Unit tests only (~1,536 tests)
npm run test:unit -- memory                    # Targeted unit suite
npm run test:integration                       # Integration tests
npm run test:smoke                             # Smoke tests (bash script)
npm run test:ci                                # CI profile (fast, critical tests only)
npm run test:coverage                          # With coverage report
```

### Quality & Release
```bash
npm run typecheck                              # Type check without emitting
npm run verify                                 # Typecheck + build + unit tests
npm run tools:check                            # Validate shell scripts syntax
npm run check:timers                           # Verify timer cleanup
npm run sync:all-versions                      # Sync version across all files
```

## Architecture Overview

### Core Systems

- **Router** (`src/core/router.ts`) — Provider routing with policy-driven selection, automatic failover, and trace logging
- **Memory** (`src/core/memory-manager.ts`) — SQLite + FTS5 full-text search with optional vector support
- **Spec-Kit** (`src/core/spec/`) — DAG-based workflow planner, policy evaluator, and test generator
- **Providers** (`src/providers/`) — CLI integrations for Claude Code, Gemini CLI, and OpenAI (subprocess mode)

### Key Patterns

- **Policy-Driven Routing**: `PolicyEvaluator` scores providers based on cost/latency/privacy constraints
- **Trace Logging**: All routing decisions logged to `.automatosx/logs/router-trace.jsonl` (see `RouterTraceLogger`)
- **Config Precompilation**: `automatosx.config.json` → `src/config.generated.ts` at build time (90% faster startup)
- **Path Aliases**: Use `@/*` for `src/*` and `@tests/*` for `tests/*` (see tsconfig.json)

### Important Constraints

- **TypeScript strict mode** enabled — all code must be type-safe
- **ESM only** — no CommonJS (except build tools in `tools/`)
- **Node 20+** target — use ES2022 features freely
- **No manual edits** to `dist/` or `src/config.generated.ts`

## Testing Strategy

### Test Organization

- **Unit tests** (`tests/unit/`) — Fast, isolated, 30s timeout
- **Integration tests** (`tests/integration/`) — Real I/O, longer timeouts
- **Reliability tests** (`tests/reliability/`) — Chaos/load testing
- **Smoke tests** (`tests/smoke/`) — End-to-end CLI validation

### CI vs Local Testing

- **CI** (`npm run test:ci`) — Critical unit tests only (~1,536 tests, 3-5 min)
  - Excludes: integration, E2E, reliability, slow unit tests
  - Single-threaded for Windows + SQLite stability
- **Local** (`npm test`) — Full suite (unit + integration + smoke)

### Mock Providers

- Set `AUTOMATOSX_MOCK_PROVIDERS=true` to avoid real provider calls
- CI automatically enables mocks via vitest.config.ci.ts

## Common Development Tasks

### Adding a New Provider

1. Create provider class in `src/providers/` extending `BaseProvider`
2. Add provider metadata to `src/core/provider-metadata-registry.ts`
3. Update `automatosx.config.json` with provider config
4. Run `npm run prebuild:config` to regenerate config
5. Add unit tests in `tests/unit/` and integration tests if needed

### Modifying Configuration

1. Edit `automatosx.config.json` (never edit `src/config.generated.ts`)
2. Run `npm run prebuild:config` to regenerate TypeScript config
3. Update types in `src/types/config.ts` if adding new fields
4. Run `npm run typecheck` to verify

### Adding a New Command

1. Create command handler in `src/cli/commands/`
2. Register in `src/cli/index.ts` (yargs command builder)
3. Add unit tests in `tests/unit/`
4. Add smoke test in `tests/smoke/smoke-test.sh`
5. Update README.md and docs/ if user-facing

## Troubleshooting

- **Provider setup issues**: Run `ax doctor [provider]` for diagnostic checks (v6.0.7+)
- **Provider failures**: Run `ax status` to check CLI availability (claude, gemini, codex)
- **CI test failures**: Use `npm run test:ci` locally to reproduce
- **Stale workspace**: Run `bash tools/cleanup-tmp.sh` or `bash tools/cleanup-prd.sh`
- **Timer leaks**: Run `npm run check:timers` to detect unclosed timers
- **Config not updating**: Ensure `npm run prebuild:config` runs before build

### Doctor Command (v6.0.7+)

The `ax doctor` command validates system setup and catches issues before they happen:

```bash
ax doctor              # Check all enabled providers
ax doctor openai       # Check only OpenAI provider
ax doctor --verbose    # Show detailed diagnostics
```

**Checks performed**:
- CLI installation and version
- Authentication status
- API connectivity
- File system permissions
- Configuration validity

**Example output**:
```
🏥 AutomatosX Health Check

🤖 OpenAI Provider
✔ CLI Installation: Installed: codex-cli 0.50.0
✖ Authentication: Not authenticated
✔ API Connectivity: Connected

💡 Suggested Fixes:
1. Authentication:
   Run: codex login
   OR: export OPENAI_API_KEY="sk-..."
```

### OpenAI Integration Modes (v6.0.7 Phase 2)

AutomatosX supports two integration modes for OpenAI:

1. **CLI Mode** (default) — Uses `codex` CLI subprocess
   - Works behind corporate firewalls
   - No API key needed if logged in to codex
   - Slightly slower (~100ms overhead per request)

2. **SDK Mode** (advanced) — Uses OpenAI SDK directly
   - Faster (~100ms saved per request)
   - Requires `OPENAI_API_KEY` environment variable
   - May not work behind corporate firewalls

3. **Auto Mode** (recommended) — Automatically selects best mode based on environment

#### Configuration

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "integration": "auto",  // Options: "auto", "cli", "sdk"
      "sdk": {
        "apiKey": "...",      // Optional: defaults to OPENAI_API_KEY env var
        "defaultModel": "gpt-4o"
      }
    }
  }
}
```

#### Using the Integration Mode Wizard

For interactive mode selection, use the config command:

```bash
ax config --set providers.openai.integration --value auto
```

The wizard will:
- Detect your environment (CLI availability, API key, firewall status)
- Recommend the best integration mode
- Provide detailed reasoning for the recommendation

#### Streaming Feedback (v6.0.7 Phase 2)

When using streaming mode, AutomatosX now provides real-time visual feedback:

```bash
ax run backend "generate code" --streaming
```

**Output**:
```
🔄 Streaming response...
⠋ 234 tokens • 45 tok/s • 5s [███████████████░░░░░] 75% • ~2s left
✓ Streaming complete • 312 tokens in 7s (45 tok/s)
```

Disable with `AUTOMATOSX_QUIET=true` for minimal output.

### Phase 3 Enhancements (v6.0.7)

#### Model Selection & Cost Tracking

AutomatosX now supports explicit model selection and displays cost information after execution:

```bash
ax run backend "generate API endpoints" --model gpt-4o-mini --show-cost
```

**Supported models**:
- `gpt-4o` — Most capable, highest cost ($2.50/$10.00 per 1M tokens)
- `gpt-4o-mini` — Fast and affordable ($0.15/$0.60 per 1M tokens)
- `gpt-4-turbo` — Previous generation flagship
- `o1-preview` — Advanced reasoning model
- `o1-mini` — Faster reasoning model

**Cost tracking output**:
```
📊 Execution Summary
  Model: gpt-4o-mini
  Tokens: 2,847 (prompt: 1,234, completion: 1,613)
  Cost: $0.0012 USD
  Duration: 5.2s
```

Cost tracking is enabled by default. Disable with `--show-cost=false`.

**Note**: Model selection is only available in CLI integration mode. SDK mode respects the `sdk.defaultModel` configuration.

#### Configurable Sandbox Mode

Control code execution isolation when using OpenAI CLI (`codex`) integration:

```bash
ax run backend "task" --sandbox workspace-read   # Read-only access
ax run backend "task" --sandbox workspace-write  # Read/write workspace files
ax run backend "task" --sandbox none             # No restrictions
ax run backend "task" --sandbox full             # Maximum isolation
```

**Sandbox levels**:
- `none` — No sandboxing (unrestricted access)
- `workspace-read` — Read-only access to workspace files
- `workspace-write` — Read/write workspace files (default)
- `full` — Maximum isolation with restricted filesystem access

**Configuration**:

Set default sandbox mode in `automatosx.config.json`:

```json
{
  "providers": {
    "openai": {
      "sandbox": {
        "default": "workspace-write",
        "allowOverride": true
      }
    }
  }
}
```

**Important**: Sandbox mode only applies to CLI integration (`integration: "cli"`). SDK integration communicates directly with OpenAI's API and does not support sandboxing.

#### Process Cleanup Command

Clean up orphaned provider processes (CLI subprocesses that didn't terminate properly):

```bash
ax cleanup              # Detect and clean all orphaned processes
ax cleanup openai       # Clean only OpenAI (codex) processes
ax cleanup gemini       # Clean only Gemini processes
ax cleanup --force      # Skip confirmation prompt
ax cleanup --verbose    # Show detailed process information
```

**Example output**:
```
🧹 AutomatosX Process Cleanup

⚠️  Found 3 orphaned process(es):

  1. PID 12345 - codex
     Runtime: 02:34:12 | Memory: 145MB
  2. PID 12346 - codex
     Runtime: 01:15:43 | Memory: 98MB
  3. PID 12347 - gemini
     Runtime: 00:45:21 | Memory: 76MB

? Kill these processes? (Y/n)

✅ Killed 3 process(es)
   Freed approximately 150MB memory
```

The cleanup command:
- Detects processes running for >5 seconds (filters out startup processes)
- Shows runtime, memory usage, and process details
- Uses graceful termination (SIGTERM) first, then force kill (SIGKILL) if needed
- Estimates memory freed after cleanup

Run `ax cleanup` periodically if you notice:
- High memory usage from background processes
- Stale CLI processes after interrupting executions
- Multiple provider processes accumulating over time

### Phase 4: Observability, Analytics & Optimization (v6.1.0)

#### Usage Analytics & Insights

AutomatosX now tracks execution telemetry and provides actionable analytics and optimization recommendations.

**Privacy-First Design**:
- All data stored locally (`.automatosx/telemetry/events.db`)
- Never transmitted externally
- Opt-in by default (disabled)
- Easy to clear with `ax analytics clear`

#### Viewing Analytics

```bash
# Show 7-day analytics summary
ax analytics summary

# Show 30-day summary
ax analytics summary --period 30d

# Show optimization recommendations
ax analytics optimize

# View telemetry status
ax analytics status

# Clear all telemetry data
ax analytics clear
```

**Analytics Summary includes**:
- Execution counts (total, successful, failed, success rate)
- Performance metrics (avg, P50, P95, P99 latency)
- Cost breakdown (total, per-request, by provider, by model)
- Token usage (total, prompt, completion, average)
- Provider comparison (usage, latency, error rates)
- Top agents by execution count

**Example Output**:
```
📊 AutomatosX Analytics Summary

Period: Last 7 days

Executions
  Total: 143
  Successful: 138
  Failed: 5
  Success Rate: 96.5%

Performance
  Avg Latency: 2.3s
  P50 Latency: 1.8s
  P95 Latency: 4.2s
  P99 Latency: 6.1s

Costs
  Total: $2.47 USD
  Avg per Request: $0.0173

  By Provider:
    openai: $1.85 (74.9%)
    gemini: $0.62 (25.1%)

Top Agents
  backend:
    Executions: 89
    Total Cost: $1.54
    Avg Latency: 2.1s
```

#### Cost Optimization Recommendations

The optimization analyzer identifies opportunities to reduce costs and improve performance:

```bash
ax analytics optimize
```

**Types of Recommendations**:

1. **Model Downgrade** - Switch to cheaper models for routine tasks
   - Example: Use gpt-4o-mini instead of gpt-4o (85% cost savings)

2. **Provider Switching** - Use lower-cost providers
   - Example: Switch to Gemini for cost-sensitive tasks (70% savings)

3. **Caching** - Enable response caching for repeated requests
   - Potential: 30%+ cost reduction

4. **Prompt Optimization** - Reduce prompt token usage
   - Shorter system prompts = lower costs

5. **Performance Improvements** - Reduce latency
   - Use SDK mode instead of CLI (100ms faster)
   - Switch to faster models
   - Enable streaming for better perceived performance

6. **Reliability** - Reduce error rates
   - Fix authentication issues
   - Implement retry logic
   - Add circuit breakers

**Example Output**:
```
💡 Optimization Recommendations

Period: Last 7 days

💰 HIGH: Switch to gpt-4o-mini for routine tasks
   74.9% of costs are from gpt-4o. gpt-4o-mini is 85% cheaper.
   💵 Potential Savings: $1.57 (85% reduction)
   Actions:
     • Review tasks using gpt-4o
     • Identify routine tasks
     • Update agent configs: model: gpt-4o-mini
     • Keep gpt-4o for complex reasoning only

⚡ MEDIUM: High P95 latency detected
   P95 latency: 4.2s. Use faster models or SDK mode.
   📈 Estimated Improvement: 50% p95_latency
   Actions:
     • Switch to faster models (gpt-4o-mini)
     • Enable streaming for better UX
     • Use SDK integration (set integration: "sdk")
```

#### Enabling Telemetry

Telemetry is **disabled by default** (privacy-first). To enable:

```json
// automatosx.config.json
{
  "telemetry": {
    "enabled": true,
    "dbPath": ".automatosx/telemetry/events.db",
    "flushIntervalMs": 30000,
    "retentionDays": 30,
    "bufferSize": 100
  }
}
```

**Configuration Options**:
- `enabled` - Enable/disable telemetry (default: false)
- `dbPath` - SQLite database path
- `flushIntervalMs` - Auto-flush interval (default: 30 seconds)
- `retentionDays` - Data retention period (default: 30 days)
- `bufferSize` - Max events before flush (default: 100)

**Telemetry Events Captured**:
- Execution start/complete/error
- Provider selection and fallback
- Rate limit hits
- Cache hits and misses
- Latency, token usage, and costs

**Data Lifecycle**:
1. Events buffered in memory
2. Auto-flushed every 30 seconds (or when buffer full)
3. Stored in SQLite with indexed queries
4. Auto-cleaned after retention period
5. Can be manually cleared anytime

#### Privacy & Security

- **Local-only storage** - Never leaves your machine
- **No external transmission** - No data sent to Anthropic or anyone
- **Opt-in by default** - Must explicitly enable
- **No sensitive data** - Prompts/responses not stored
- **No credentials** - API keys never logged
- **Easy deletion** - Single command to clear all data
