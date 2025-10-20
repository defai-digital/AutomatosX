Initialize AutomatosX in the current project directory.

**IMPORTANT**: When user types `/ax-init`, you MUST execute:

```bash
automatosx init
```

This will:

1. Create `.automatosx/` directory structure
2. Install 15 example agents in `.automatosx/agents/`
3. Install 15 example abilities in `.automatosx/abilities/`
4. Create `.claude/` integration files (slash commands + MCP)
5. Generate `automatosx.config.json`
6. Update `.gitignore`

**Examples**:

User input: `/ax-init`
→ Execute: `automatosx init`

User input: `/ax-init --force`
→ Execute: `automatosx init --force`
(Use `--force` to reinitialize if `.automatosx` already exists)
