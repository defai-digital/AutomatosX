# Cost Configuration Guide (v12.7.x)

> Cost estimation/policy-based routing and free-tier optimization are not supported in this version. Control spend by setting provider priorities and monitoring your provider accounts directly.

## How to manage cost today

1) Set provider priorities in `ax.config.json` (lower number = higher priority).
```json
{
  "providers": {
    "gemini-cli": { "enabled": true, "priority": 1 },
    "claude-code": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 3 }
  }
}
```

2) Keep a cheaper provider first (e.g., Gemini), quality provider second (Claude), and a fast/backup provider third (OpenAI).

3) Verify provider health before long runs:
```bash
ax providers list
ax providers info gemini-cli
ax doctor gemini-cli
```

4) Monitor usage in provider dashboards (AutomatosX does not fetch quota/billing data).

## Best practices

- Use project-local installs (`pnpm ax ...`) to keep environments reproducible.
- For large tasks, run a small dry-run prompt to validate provider availability before executing a full workflow.
- Store cost-related notes near specs/workflows if budgets matter; keep them manual and explicit.

## Out of scope

- Policy-based routing, workload scoring, and free-tier auto-selection (removed in v8.3.0).
- Built-in cost estimation or quota tracking.
