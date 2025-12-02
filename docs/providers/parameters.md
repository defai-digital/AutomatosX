# Provider Model Parameters

**Version**: v5.0.5+
**Status**: Stable

---

## Overview

AutomatosX allows provider CLIs to use their optimal default model parameters. This ensures agents have maximum capability and automatically benefit from provider updates.

### Key Principles

✅ **Provider Defaults First**: Let each CLI use its best-tuned parameters
✅ **No Artificial Limits**: Avoid restricting agent capabilities unnecessarily
✅ **Optional Control**: Configure parameters only when needed
✅ **Clear Documentation**: Understand what each provider supports

---

## Default Behavior (v5.0.5+)

By default, **no model parameters are set** in the configuration. Each provider CLI uses its optimal defaults:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 3,
      "timeout": 1500000,
      "command": "claude"
      // No "defaults" - uses provider's optimal settings
    }
  }
}
```

### Why No Defaults?

1. **Provider CLIs evolve**: Token limits increase (4K → 200K → 2M), we shouldn't restrict them
2. **Inconsistent support**: Only 1/3 providers actually use our config values
3. **Better performance**: Provider defaults are optimized for their models
4. **Less maintenance**: No need to track each provider's latest capabilities

---

## Available Parameters

### maxTokens

Controls the maximum output tokens (response length).

**Default behavior**: Undefined (provider decides)

| Provider | CLI Support | Notes |
|----------|-------------|-------|
| **OpenAI** | ✅ Yes | Via `-c max_tokens=N` |
| **Gemini** | ❌ No | Not supported (feature request: [#5280](https://github.com/google-gemini/gemini-cli/issues/5280)) |
| **Claude** | ❌ No | Not passed to CLI (uses provider default) |

**When to set**:
- ✅ Cost control (limit usage in production)
- ✅ Budget constraints (enterprise environments)
- ❌ Default usage (let provider optimize)

### temperature

Controls randomness/creativity in responses (0.0 = deterministic, 1.0+ = creative).

**Default behavior**: Undefined (provider decides)

| Provider | CLI Support | Notes |
|----------|-------------|-------|
| **OpenAI** | ✅ Yes | Via `-c temperature=N` |
| **Gemini** | ❌ No | Not supported (feature request: [#5280](https://github.com/google-gemini/gemini-cli/issues/5280)) |
| **Claude** | ❌ No | Not passed to CLI (uses provider default) |

**When to set**:
- ✅ QA/Testing agents (set to 0 for determinism)
- ✅ Specific requirements (regulatory compliance)
- ❌ Creative tasks (agent role/prompt is more effective)

### topP

Nucleus sampling parameter (alternative to temperature).

**Default behavior**: Undefined (provider decides)

**Recommendation**: Avoid setting unless you have specific requirements. Use `temperature` instead for creativity control.

---

## Configuration Examples

### Default (Recommended)

Let providers use optimal defaults:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "command": "codex",
      "timeout": 1500000
      // No defaults = maximum capability
    }
  }
}
```

### Cost Control (Enterprise)

Limit token usage for budget control:

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "command": "codex",
      "timeout": 1500000,
      "defaults": {
        "maxTokens": 2048  // Limit for cost control
      }
    }
  }
}
```

### QA Agent (Deterministic)

Force deterministic output for testing:

```yaml
# .automatosx/agents/qa-specialist.yaml
name: qa-specialist
team: core
role: QA Specialist

provider:
  primary: openai
  defaults:
    temperature: 0      # Completely deterministic
    maxTokens: 4096    # Sufficient for test reports
```

### Team-Level Configuration

Set parameters for entire team:

```yaml
# .automatosx/teams/engineering.yaml
name: engineering
displayName: "Engineering Team"

provider:
  primary: codex
  fallbackChain: [codex, gemini, claude]
  # v5.0.5: No defaults = use provider optimal settings

  # Only set if needed:
  # defaults:
  #   maxTokens: 8192    # For complex code generation
  #   temperature: 0.3   # Slightly deterministic
```

---

## Migration from v5.0.4

### What Changed

**Before v5.0.5**:
```json
{
  "providers": {
    "claude-code": {
      "defaults": {
        "maxTokens": 4096,     // ❌ Artificially limited
        "temperature": 0.7,    // ❌ Not used by Claude CLI
        "topP": 1              // ❌ Not needed
      }
    }
  }
}
```

**After v5.0.5**:
```json
{
  "providers": {
    "claude-code": {
      // ✅ No defaults = uses provider optimal settings
      // Can still set if needed for specific requirements
    }
  }
}
```

### Impact on Your Agents

#### Scenario 1: Default Configuration (Most Users)
```
Before: Limited to 4096 tokens
After:  Uses provider default (often much higher)
Impact: ✅ Positive - Better agent capability
```

#### Scenario 2: Custom maxTokens for Cost Control
```
Before: Custom setting in ax.config.json
After:  Still works - no change needed
Impact: ✅ No impact - your settings preserved
```

#### Scenario 3: Relying on temperature Setting
```
Before: Set temperature=0.7 expecting deterministic output
After:  Provider uses its default
Impact: ⚠️ May vary - use agent.provider.defaults if needed
```

### Upgrade Steps

1. **No action required** for most users
2. **If you need cost control**: Explicitly set `maxTokens`
3. **If you need determinism**: Set `temperature: 0` in agent/team config
4. **Test your agents**: Verify behavior meets expectations

---

## Best Practices

### 1. **Trust Provider Defaults**

```yaml
# ✅ Good: No artificial limits
provider:
  primary: codex

# ❌ Bad: Unnecessary restrictions
provider:
  primary: codex
  defaults:
    maxTokens: 1024  # Too small for complex tasks
```

### 2. **Use Agent/Team Level for Specific Needs**

```yaml
# ✅ Good: Specific requirements at agent level
# .automatosx/agents/qa-specialist.yaml
name: qa-specialist
provider:
  defaults:
    temperature: 0  # QA needs determinism

# ❌ Bad: Global restriction
# ax.config.json
{
  "providers": {
    "openai": {
      "defaults": {
        "temperature": 0  // Affects ALL agents
      }
    }
  }
}
```

### 3. **Control Creativity via Role/Prompt**

```yaml
# ✅ Good: Use role definition
name: designer
role: Creative UI/UX Designer
systemPrompt: |
  You are a creative designer who thinks outside the box.
  Explore innovative solutions and unique approaches.

# ❌ Bad: Use temperature parameter
name: designer
provider:
  defaults:
    temperature: 1.2  # Unclear, provider-dependent
```

### 4. **Document Why You Set Parameters**

```yaml
# ✅ Good: Clear reasoning
provider:
  defaults:
    maxTokens: 2048  # Cost control: $0.02/1K tokens limit
    temperature: 0   # Regulatory requirement: reproducible output

# ❌ Bad: No explanation
provider:
  defaults:
    maxTokens: 2048
    temperature: 0
```

---

## Provider CLI Support Matrix

### Current Support (v5.0.5)

| Parameter | OpenAI (codex) | Gemini CLI | Claude Code |
|-----------|----------------|------------|-------------|
| maxTokens | ✅ `-c max_tokens=N` | ❌ Not supported | ❌ Not supported |
| temperature | ✅ `-c temperature=N` | ❌ Not supported | ❌ Not supported |
| topP | ✅ `-c top_p=N` | ❌ Not supported | ❌ Not supported |

**Note**: Gemini CLI currently does not support model parameters via CLI or configuration file. Support for these parameters is under development ([GitHub Issue #5280](https://github.com/google-gemini/gemini-cli/issues/5280), opened July 2025).

### Planned Support (v5.1.0+)

Goals for next release:
- [ ] Unify parameter passing across all providers
- [ ] Support maxTokens for Claude CLI
- [ ] Support temperature for Gemini CLI
- [ ] Add parameter validation warnings

---

## Troubleshooting

### Agent generates too much output

**Symptom**: Response is very long, higher than expected costs

**Solution**: Set `maxTokens` for specific agent
```yaml
# .automatosx/agents/backend.yaml
provider:
  defaults:
    maxTokens: 4096  # Limit output length
```

### Agent responses are inconsistent

**Symptom**: Same prompt gives different results each time

**Solution**: Set `temperature: 0` for deterministic output
```yaml
# .automatosx/agents/qa-specialist.yaml
provider:
  defaults:
    temperature: 0  # Fully deterministic
```

### Parameter not taking effect

**Symptom**: Setting maxTokens but no change in behavior

**Cause**: Provider doesn't support parameter via CLI

**Solution**: Check provider support matrix above. Currently, only OpenAI CLI supports these parameters.

**For Gemini**: Model parameters are not yet supported. Track progress at [GitHub Issue #5280](https://github.com/google-gemini/gemini-cli/issues/5280).

**Workaround**: Use agent role/prompt to control behavior instead of parameters.

---

## FAQ

### Q: Why remove default model parameters?

**A**: Three reasons:
1. Only OpenAI actually used them (Gemini and Claude ignored them)
2. Hard-coded limits (4096 tokens) restricted agent capabilities unnecessarily
3. Provider CLIs have better-optimized defaults that improve over time

### Q: Will this increase my costs?

**A**: Potentially, yes. Providers may use more tokens without artificial limits. However:
- You can still set `maxTokens` for cost control
- Better results often mean fewer retries (net savings)
- Most complex tasks need more than 4096 tokens anyway

### Q: How do I get the old behavior back?

**A**: Explicitly set parameters in your config:
```json
{
  "providers": {
    "openai": {
      "defaults": {
        "maxTokens": 4096,
        "temperature": 0.7
      }
    }
  }
}
```

### Q: Which parameter should I use: temperature or topP?

**A**: Use `temperature` (0.0-1.0):
- `0.0` = Deterministic, consistent
- `0.5-0.7` = Balanced (provider default)
- `1.0+` = Creative, varied

Avoid `topP` unless you have specific requirements.

---

## See Also

- [Team Configuration](./team-configuration.md) - Team-level provider settings
- [Core Concepts](./core-concepts.md) - Understanding providers
- [CLI Commands Reference](../reference/cli-commands.md) - Command details

---

**Last Updated**: 2025-10-09
**Version**: v5.0.5
