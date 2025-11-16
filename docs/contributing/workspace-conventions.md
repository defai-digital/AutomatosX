# Workspace Path Conventions

This document explains AutomatosX's workspace path conventions and how to find agent-generated files.

## Quick Reference

| File Type | Path | Purpose |
|-----------|------|---------|
| **User files** | `/tmp/` | Your project's temporary directory |
| **Agent files** | `/automatosx/tmp/` | Agent workspace isolation |
| **Planning docs** | `/automatosx/PRD/` | Product requirements documents |
| **Project files** | `/src/`, `/tests/`, `/docs/` | Normal source code |

## User Files vs Agent Files

### User Files (`/tmp/`)
- Your project's standard temporary directory
- Files you create manually
- Build artifacts and test outputs
- Not managed by AutomatosX

### Agent Files (`/automatosx/tmp/`)
- Agent-managed temporary workspace
- Analysis reports and generated artifacts
- Isolated from user files
- Auto-cleanup enabled (optional)

## Why Two Locations?

AutomatosX uses workspace isolation to:

1. **Prevent accidental modifications**: Agents cannot accidentally overwrite user files
2. **Enable auto-cleanup**: Agent files can be cleaned up without touching user's `tmp/`
3. **Provide clear separation**: Easy to distinguish agent-generated vs user-created files
4. **Support multi-agent workflows**: Each agent has isolated workspace

## Finding Agent Output

When an agent reports "saved to tmp/report.md", check **both** locations:

```bash
# Check user tmp directory
ls tmp/*.md

# Check agent workspace (more likely)
ls automatosx/tmp/*.md
```

### Expected Behavior by Provider

| Provider | Default Path | Uses WorkspaceManager |
|----------|--------------|----------------------|
| OpenAI (Codex) | `automatosx/tmp/` | ✅ Yes |
| Gemini CLI | `automatosx/tmp/` | ✅ Yes (as of Phase 1) |
| Claude Code | `automatosx/tmp/` | ✅ Yes |

**Note**: As of Phase 1 implementation, all providers should consistently write to `automatosx/tmp/` for agent workspace files.

## Best Practices

### For Users

**Reading agent outputs**:
```bash
# Check agent workspace first
cat automatosx/tmp/analysis-report.md

# List all agent-generated reports
ls -lh automatosx/tmp/*.md
```

**Writing your own files**:
```bash
# Use project tmp/ for your own files
echo "notes" > tmp/my-notes.txt
```

**PRD documents**:
```bash
# Planning documents are saved separately
ls automatosx/PRD/*.md
```

### For Agent Development

**When creating agents**, use WorkspaceManager APIs:

```typescript
// ✅ Correct: Use WorkspaceManager
await workspaceManager.writeTmp('report.md', content);

// ❌ Incorrect: Direct fs.writeFile() with relative path
await fs.writeFile('tmp/report.md', content);

// ❌ Incorrect: Relative path
await fs.writeFile('./automatosx/tmp/report.md', content);
```

**When delegating to agents**, specify clear output expectations:

```typescript
const result = await executor.execute({
  task: "Analyze the codebase and save report to automatosx/tmp/analysis.md",
  // ...
});
```

## Workspace Structure

```
your-project/
├── tmp/                      # User's temporary directory
│   ├── build-cache/
│   └── user-notes.txt
├── automatosx/               # Agent workspace root
│   ├── tmp/                  # Agent temporary files
│   │   ├── analysis-report.md
│   │   ├── test-results.json
│   │   └── code-review.md
│   ├── PRD/                  # Planning documents
│   │   ├── feature-spec.md
│   │   └── architecture.md
│   └── workspaces/           # Per-agent workspaces
│       ├── backend-agent/
│       └── frontend-agent/
├── src/                      # Project source code
└── tests/                    # Project tests
```

## Configuration

You can customize workspace paths in `automatosx.config.json`:

```json
{
  "workspace": {
    "tmpPath": "automatosx/tmp",
    "prdPath": "automatosx/PRD",
    "autoCleanup": false
  }
}
```

### Options

- `tmpPath`: Path for agent temporary files (default: `automatosx/tmp`)
- `prdPath`: Path for planning documents (default: `automatosx/PRD`)
- `autoCleanup`: Enable automatic cleanup of old agent files (default: `false`)

## Troubleshooting

### "Agent said it saved a file, but I can't find it"

**Solution**: Check both locations:

```bash
# Search in both tmp directories
find . -name "filename.md" -type f

# Check recent agent-generated files
ls -lt automatosx/tmp/*.md | head -5
```

### "Files are in different locations (tmp/ vs automatosx/tmp/)"

**Issue**: Legacy behavior from pre-Phase 1 implementation.

**Solution**: As of Phase 1, all agents should write to `automatosx/tmp/`. If you still see files in `tmp/`, they may be from older runs. Verify by checking file timestamps:

```bash
ls -lh tmp/*.md automatosx/tmp/*.md
```

### "How do I migrate files from tmp/ to automatosx/tmp/?"

```bash
# Move files to agent workspace
mkdir -p automatosx/tmp
mv tmp/agent-*.md automatosx/tmp/
```

## Path Standardization Initiative

AutomatosX is implementing comprehensive path standardization (Phase 1-4):

- **Phase 1**: Prompt enhancement + Gemini CLI wrapper (9 hours)
- **Phase 2**: Provider telemetry and monitoring (6 hours)
- **Phase 3**: Documentation and user guides (current)
- **Phase 4**: Full provider standardization (long-term)

See `tmp/path-standardization-final-recommendations.md` for detailed implementation plan.

## Related Documentation

- [Quick Start Guide](./getting-started/quick-start.md)
- [CLI Reference](./guide/cli-reference.md)
- [Agent Development Guide](../CONTRIBUTING.md)
- [WorkspaceManager API](../src/core/workspace-manager.ts)

## Support

If you encounter path-related issues:

1. Check agent execution logs: `.automatosx/logs/`
2. Report issues: https://github.com/defai-digital/automatosx/issues
3. Include file paths and provider information
