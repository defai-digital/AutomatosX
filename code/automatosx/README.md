# AutomatosX v14

AutomatosX v14 is the unified release line that combines:

- the workflow-first UX and durable artifact model from `11.4`
- the modular runtime, MCP surface, and shared stores from `13.5`

## Default Entry Paths

Primary CLI workflows:

```bash
ax ship --scope <area>
ax architect --request "<requirement>"
ax audit --scope <path-or-area>
ax qa --target <service-or-feature> --url <url>
ax release --release-version <version>
```

Primary AI-tool integration path:

```bash
ax setup
ax init
ax doctor
```

`ax init` now generates project-local integration files for `Claude Code`, `Cursor`, `Gemini`, and `ax-grok`, plus a Codex `config.toml` snippet under `.automatosx/providers/` for the remaining global Codex step.
`ax setup` now also writes `.automatosx/environment.json` with the local MCP baseline and detected provider clients.

## Advanced Surface Guidance

- `ax run <workflow-id>` remains available as an advanced runtime bridge.
- `ax call "<prompt>"` is now the direct provider-invocation surface for the shared runtime bridge, with optional file context loading, explicit execution-mode reporting, and an autonomy mode for bounded multi-round execution.
- `ax doctor`, `ax status`, `ax list`, `ax trace`, and `ax discuss` are retained as high-value support commands from the legacy surfaces.
- `ax config` and `ax cleanup` are now first-class operational commands for workspace config and stale runtime state management.
- `ax ability` and `ax feedback` are now first-class operator commands for reusable runtime ability context and durable quality feedback loops.
- `ax resume <trace-id>` can rerun prior workflow or discussion traces from stored execution context, and `ax iterate ...` can repeat runnable commands until success or budget exhaustion.
- `ax trace analyze <trace-id>` summarizes execution health, `ax trace by-session <session-id>` groups correlated runtime traces, and `ax trace tree <trace-id>` reconstructs trace hierarchies.
- `ax guard` now includes a built-in `safe-filesystem` policy that blocks out-of-scope writes, oversized change sets, sensitive-path edits, and obvious secret leakage.
- `ax agent`, `ax mcp`, `ax session`, and `ax review` are retained as advanced operational surfaces on top of the shared runtime and MCP-aligned stores.
- `ax mcp` can inspect MCP tools, resources, prompts, and per-tool schemas in addition to serving and invoking tools.
- MCP tool calls now accept legacy `ax_*` aliases such as `ax_agent_list` and `ax_workflow_run` for compatibility with older `13.5` prompts and clients.
- Shared runtime prompt and discussion execution can now use real provider subprocesses when configured through `.automatosx/config.json` under `providers.executors.<provider>` or `AUTOMATOSX_PROVIDER_<PROVIDER>_CMD` / `_ARGS`.
- `ax call --autonomous` can run intent-aware rounds for `query`, `analysis`, and `code` tasks, with `--goal`, `--max-rounds`, and `--require-real` controls.
- Stronger provider-native adapters are available as an opt-in bridge path via `providers.nativeAdapters: true` in `.automatosx/config.json` or `AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS=true`.
- Workflow users should prefer `ax ship`, `ax architect`, `ax audit`, `ax qa`, and `ax release`.
- MCP integrations should prefer the shared runtime-backed tool surface.
- Legacy direct-orchestration paths are no longer the promoted product story for v14.

Example provider bridge configuration:

```json
{
  "providers": {
    "nativeAdapters": true,
    "executors": {
      "claude": {
        "command": "node",
        "args": ["./scripts/provider-adapter.mjs"],
        "timeoutMs": 30000,
        "protocol": "json-stdio"
      }
    }
  }
}
```

## Artifact and Trace Contract

- Workflow outputs default to `.automatosx/workflows/<command>/<trace-id>/`
- Each flagship workflow emits `manifest.json`, `summary.json`, and artifact markdown files
- CLI and MCP executions write into the same shared trace/runtime stores under `.automatosx/runtime/`

## MCP Surface

Representative shared-runtime-backed MCP tools:

- `workflow.run`, `workflow.list`, `workflow.describe`
- `trace.get`, `trace.list`, `trace.analyze`, `trace.by_session`, `trace.tree`, `trace.close_stuck`
- `agent.register`, `agent.get`, `agent.list`, `agent.remove`, `agent.capabilities`, `agent.run`, `agent.recommend`
- `memory.store`, `memory.list`, `memory.retrieve`, `memory.search`, `memory.delete`
- `semantic.store`, `semantic.search`, `semantic.get`, `semantic.list`, `semantic.delete`, `semantic.stats`, `semantic.clear`
- `feedback.submit`, `feedback.history`, `feedback.stats`, `feedback.overview`, `feedback.adjustments`
- `ability.list`, `ability.inject`
- `config.get`, `config.set`, `config.show`
- `file.exists`, `file.write`, `directory.create`
- `git.status`, `git.diff`, `commit.prepare`, `pr.review`, `pr.create`
- `session.create`, `session.get`, `session.list`, `session.join`, `session.leave`, `session.complete`, `session.fail`, `session.close_stuck`
- `review.analyze`, `review.list`
- `discuss.run`, `discuss.quick`, `discuss.recursive`
- `parallel.plan`, `parallel.run`
- `policy.register`, `policy.list`
- `dashboard.list`

## Migration Notes

- Use the first-class workflow commands instead of treating `run` as the main UX.
- Treat `ax init` as the MCP/AI integration entry path, not a workflow command.
- Shared stores are now authoritative for traces, memory, policies, and agent registration.
- Sprint status, tracker state, and release evidence live under [PRD](/Users/akiralam/code/automatosx/PRD).

## Verification

```bash
npm run typecheck
npm test
```
