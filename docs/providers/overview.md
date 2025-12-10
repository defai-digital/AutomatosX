# Provider Comparison Guide (v12.7.x)

Routing is priority-based with health checks and fallback. There is no policy scoring, workload analysis, or free-tier optimization in this version.

---

## Supported Providers

- Claude Code (`claude-code`)
- Gemini CLI (`gemini-cli`)
- OpenAI (`openai`)
- Grok (`grok`)
- Qwen (`qwen`)
- GLM (`glm`)

Check availability:
```bash
ax providers list
ax providers info <name>
ax doctor <name>
```

Set priority in `ax.config.json` or with `ax config --set providers.<name>.priority`.

---

## Quick Comparison (high level)

| Feature            | OpenAI        | Claude Code    | Gemini CLI    |
|--------------------|---------------|----------------|---------------|
| Typical profile    | Fast, controllable params | Strong reasoning | Cost-aware |
| Streaming          | Yes           | Yes            | Yes           |
| Vision             | Yes           | No             | Yes           |
| Function calling   | Yes           | Yes            | Yes           |
| Free tier routing  | Not managed by AX | Not managed by AX | Not managed by AX |

Notes: Costs and limits depend on your accounts; AutomatosX does not fetch or enforce quotas.

---

## Routing Behavior (Current)

- Providers are attempted by ascending priority.
- Health checks and circuit breaker manage retries/failover.
- No policy-driven scoring, workload sizing, or free-tier prioritization.
- Configure provider priority to balance cost vs speed/quality.

Example:
```json
{
  "providers": {
    "gemini-cli": { "enabled": true, "priority": 1 },
    "claude-code": { "enabled": true, "priority": 2 },
    "openai": { "enabled": true, "priority": 3 }
  }
}
```

---

## Recommended Uses

- **Speed/control**: OpenAI
- **Complex reasoning**: Claude Code
- **Cost-aware/general**: Gemini CLI
- **Alternate models**: Grok, Qwen, GLM (configure per need)

Tune priorities per project and test with `ax providers info <name>`.

---

## Maintenance Checklist

- Confirm provider entries in `ax.config.json` match what you intend to use.
- Run `ax doctor <provider>` after changing priorities or keys.
- Avoid relying on historical docs that mention policy/free-tier routing (removed in v8.3.0).
