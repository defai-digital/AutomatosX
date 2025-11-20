# ⚠️ DEPRECATED: Grok CLI Configuration

**Status**: Deprecated as of v9.1.0
**Replacement**: `.ax-cli/` directory with ax-cli integration

---

## Migration Notice

This directory (`.grok/`) was used for the old Grok CLI integration via `@vibe-kit/grok-cli`.

**As of v9.1.0**, the `ax cli` command now uses **ax-cli** instead of grok-cli for better multi-provider support.

### What Changed

**Before (v9.0.x and earlier):**
```bash
ax cli                    # Launched @vibe-kit/grok-cli
                         # Used .grok/settings.json for configuration
```

**After (v9.1.0+):**
```bash
ax cli                    # Launches ax-cli (multi-provider)
                         # Uses .ax-cli/ for configuration
```

---

## Using Grok with ax-cli (New Way)

### Option 1: Use ax-cli with xAI Provider

```bash
# Interactive mode with xAI Grok
ax cli --provider xai --model grok-2

# With API key
ax cli --provider xai --model grok-2 --api-key xai-your-key

# Direct prompt
ax cli --provider xai --model grok-2 "Design a REST API"
```

### Option 2: Use grok-cli Directly

If you still want to use `@vibe-kit/grok-cli` directly:

```bash
# Install grok-cli globally
npm install -g @vibe-kit/grok-cli

# Use grok command directly (not through ax)
grok "your prompt"
```

---

## Migration Steps

1. **If using xAI Grok:**
   ```bash
   # Set environment variable
   export YOUR_API_KEY="xai-your-key"

   # Use ax cli with xAI provider
   ax cli --provider xai --model grok-2
   ```

2. **If using Z.AI GLM:**
   ```bash
   # Set environment variable
   export YOUR_API_KEY="your-glm-api-key"

   # Use ax cli with GLM (default provider)
   ax cli --model glm-4.6
   ```

3. **Configure ax-cli (Optional):**
   ```bash
   # Initialize ax-cli configuration
   ax-cli setup

   # This creates .ax-cli/settings.json with your preferences
   ```

---

## Why This Change?

**Benefits of ax-cli:**
- ✅ **Multi-Provider Support**: GLM, xAI, OpenAI, Anthropic, Ollama
- ✅ **Unified Experience**: One CLI for all AI providers
- ✅ **Better Integration**: Consistent with AutomatosX architecture
- ✅ **Active Development**: Regular updates and improvements
- ✅ **IDE Integration**: VSCode, file context, git diff support

**Old Grok CLI Limitations:**
- ❌ Single provider only (xAI or Z.AI, not both)
- ❌ Requires separate configuration
- ❌ Less flexible provider switching
- ❌ Not integrated with AutomatosX provider system

---

## File Location

This directory (`.grok/`) is kept for backward compatibility and documentation only.

**Active Configuration**: See `.ax-cli/` directory instead.

---

## Reference

**Old Configuration File**: `.grok/settings.json`
**New Configuration File**: `.ax-cli/settings.json` (optional)
**Documentation**: See [ax-cli documentation](https://github.com/defai-digital/ax-cli)

---

**Last Updated**: 2025-11-20
**AutomatosX Version**: v9.1.0+
