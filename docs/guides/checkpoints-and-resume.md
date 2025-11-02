# Checkpoints & Run History

AutomatosX 5.3 adds stage checkpoints and run history for multi-stage agents. Use them to pause long workflows, recover after provider failures, and audit artifacts.

## Overview
Stage-based agents break their work into ordered stages. When checkpoints are enabled, AutomatosX records the mode, inputs, outputs, and artifacts after each completed stage. Each run is stored under `.automatosx/checkpoints/<run-id>/`, so you can restart the run from the next stage without repeating earlier work.

## Prerequisites
- AutomatosX initialized (run `ax setup`) with version 5.3.0 or later.
- An agent profile that defines `stages`; single-step agents skip checkpoints.
- Local write access to `.automatosx/` for checkpoints, logs, and artifacts.

## Enabling checkpoints
### CLI quick start
```bash
ax run backend "Ship onboarding flow" --resumable --interactive
```
`--resumable` turns on checkpoint saving for that run. Add `--interactive` to confirm each stage, `--streaming` to stream progress, or `--hybrid` for both.

When a stage completes, the CLI prints the Run ID and path of the saved checkpoint:
```
Checkpoint saved: 4bf7d4e0-...
Resume with: ax resume 4bf7d4e0-...
```

### Configure defaults
Set `execution.stages.enabled` to `true` in `automatosx.config.json` to make stage checkpoints the default for every multi-stage agent. You can also control the storage path, cleanup window, and auto-save behaviour:

```json
{
  "execution": {
    "stages": {
      "enabled": true,
      "checkpointPath": ".automatosx/checkpoints",
      "autoSaveCheckpoint": true,
      "cleanupAfterDays": 14,
      "prompts": {
        "autoConfirm": false,
        "timeout": 600000
      }
    }
  }
}
```

AutomatosX keeps backward compatibility by leaving `execution.stages.enabled` off until you opt in.

## Command reference
### `ax run` with checkpoints
**Syntax**
```bash
ax run <agent> "<task>" [--resumable] [--interactive] [--streaming] [--hybrid] [--auto-continue] [--verbose]
```

**Key options**
- `--resumable` Save a checkpoint after each stage (or according to config).
- `--interactive` Pause after each stage for manual confirmation.
- `--streaming` Display live progress updates and stage summaries.
- `--hybrid` Shortcut for `--interactive --streaming`.
- `--auto-continue` Accept stage output automatically (useful in CI).
- `--verbose` Show resolved agent names, config source, and memory status.

**Example**
```bash
ax run product "Plan, implement, and test onboarding flow" --resumable --hybrid
```

### `ax resume`
**Syntax**
```bash
ax resume <run-id> [--interactive] [--streaming] [--hybrid] [--auto-continue] [--verbose]
```

**Options**
- `--interactive`, `--streaming`, `--hybrid` Override the mode saved in the checkpoint.
- `--auto-continue` Skip prompts and continue through remaining stages.
- `--verbose` Print project paths, provider loading, and memory initialisation.

**Example**
```bash
ax resume 4bf7d4e0-9c2a-4cfd-990c-c9eb2b6b0d52 --interactive
```

### `ax runs list`
**Syntax**
```bash
ax runs list [--status <state>] [--agent <name>] [--limit <number>]
```

**Options**
- `--status` Filter by `running`, `paused`, `completed`, `failed`, or `aborted`.
- `--agent` Show runs for one agent only.
- `--limit` Limit the number of rows (default 20).

**Example**
```bash
ax runs list --status paused --limit 5
```

### `ax runs show`
**Syntax**
```bash
ax runs show <run-id> [--stages <true|false>] [--artifacts]
```

**Options**
- `--stages` (default `true`) Toggle stage-by-stage history.
- `--artifacts` List generated files stored in the checkpoint directory.

**Example**
```bash
ax runs show 4bf7d4e0-9c2a-4cfd-990c-c9eb2b6b0d52 --artifacts
```

### `ax runs delete`
**Syntax**
```bash
ax runs delete <run-id> [--force]
```

**Options**
- `--force`, `-f` Skip the confirmation prompt (useful in scripts).

**Example**
```bash
ax runs delete 4bf7d4e0-9c2a-4cfd-990c-c9eb2b6b0d52 --force
```

## Common workflows
### Resume after a failure or timeout
1. Run the agent with checkpoints: `ax run backend "Deploy release" --resumable`.
2. If the provider times out, note the Run ID shown in the CLI.
3. Optional: Inspect context before resuming: `ax runs show <run-id>`.
4. Resume from the next stage: `ax resume <run-id> --interactive`.
5. After success, clean up the checkpoint when no longer needed.

### Monitor active runs
1. List in-flight work: `ax runs list --status running`.
2. Filter by agent if you are coordinating multiple teams: `ax runs list --agent backend`.
3. Share the short Run ID (first eight characters) with teammates for quick reference.

### Inspect stage outputs and artifacts
1. View the detailed stage timeline: `ax runs show <run-id>`.
2. Include artifacts to see generated specs, code, or reports: `ax runs show <run-id> --artifacts`.
3. Open files directly from `.automatosx/checkpoints/<run-id>/artifacts/`.

### Delete old runs
1. Check what will be removed: `ax runs show <run-id>`.
2. Confirm deletion: `ax runs delete <run-id>`.
3. Use `ax runs delete <run-id> --force` inside scripts or CI cleanup jobs.
4. Tune `execution.stages.cleanupAfterDays` so AutomatosX prunes stale checkpoints automatically.

## Configuration options
| Key | Default | Purpose |
| --- | --- | --- |
| `execution.stages.enabled` | `false` | Opt-in flag for stage checkpoints (legacy behaviour stays off). |
| `execution.stages.defaultTimeout` | `1800000` (30 min) | Per-stage timeout when agents do not specify one. |
| `execution.stages.checkpointPath` | `.automatosx/checkpoints` | Folder where checkpoints, logs, and artifacts live. |
| `execution.stages.autoSaveCheckpoint` | `true` | Save a checkpoint automatically after each stage. |
| `execution.stages.cleanupAfterDays` | `7` | Auto-delete checkpoints older than this many days. |
| `execution.stages.retry.defaultMaxRetries` | `1` | Retry count for a stage before marking it as failed. |
| `execution.stages.retry.defaultRetryDelay` | `2000` (ms) | Wait time between stage retries. |
| `execution.stages.prompts.timeout` | `600000` (ms) | How long AutomatosX waits for interactive approval. |
| `execution.stages.prompts.autoConfirm` | `false` | Skip prompts; continue immediately after each stage. |
| `execution.stages.prompts.locale` | `"en"` | Language used in stage prompts. |
| `execution.stages.progress.updateInterval` | `2000` (ms) | Frequency of progress updates in interactive mode. |
| `execution.stages.progress.syntheticProgress` | `true` | Show synthetic progress when providers do not stream tokens. |

AutomatosX also records the execution mode in each checkpoint so `ax resume` can restore it unless you override the flags.

## Best practices
- Enable checkpoints for multi-stage agents that produce specs, code, and tests in sequence.
- Keep `checkpointPath` inside `.automatosx/` so the PathResolver enforces sandbox limits.
- Use `--auto-continue` only for trusted pipelines; keep it off when human review is required.
- Review checkpoints daily with `ax runs list --status paused` to avoid stale work.
- Raise `cleanupAfterDays` when audits require retaining artifacts longer, or lower it for privacy-sensitive projects.
- Do not commit `.automatosx/checkpoints/` to version control; export permanent assets to a dedicated workspace before deleting the run.

## Next steps
- Learn how stage execution fits into larger workflows in [Multi-Agent Orchestration](multi-agent-orchestration.md).
- Troubleshoot provider issues with the [Terminal Mode Guide](terminal-mode.md) if a resume fails.
