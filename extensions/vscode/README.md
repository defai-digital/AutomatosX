# AutomatosX - Code Intelligence for VS Code

Advanced code intelligence with quality metrics and dependency analysis for TypeScript, JavaScript, Python, Go, and Rust.

## Features

### 🔍 Symbol Explorer
- Browse all symbols in your code (functions, classes, variables)
- Filter by symbol kind
- Click to navigate to definition
- Real-time updates as you edit

### 📊 Quality Metrics
- View code quality scores (A-F grades)
- See complexity and maintainability metrics
- Identify files needing attention
- Track quality trends over time

### 🔗 Dependency Analysis
- Visualize file dependencies
- Detect circular dependencies
- Navigate dependency graph
- Understand code relationships

### 📈 Quality Dashboard
- Interactive quality dashboard
- Charts and visualizations
- Export metrics to JSON
- Track project health

### ⚡ Language Server Protocol
- Fast code intelligence via LSP
- Real-time diagnostics
- Symbol references and renaming
- Auto-completion and hover info

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX:
   ```bash
   code --install-extension automatosx-vscode-2.0.0.vsix
   ```

## Quick Start

1. Open a workspace with TypeScript, JavaScript, or Python code
2. Wait for AutomatosX to index your project (automatic)
3. Explore the AutomatosX sidebar views:
   - **Symbol Explorer** - Browse code symbols
   - **Quality Metrics** - View code quality
   - **Dependencies** - See file relationships
4. Run commands from the Command Palette (`Cmd+Shift+P`):
   - `AutomatosX: Show Quality Dashboard`
   - `AutomatosX: Show Dependency Graph`
   - `AutomatosX: Analyze Current File`

## Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `AutomatosX: Index Project` | Index all files in workspace | - |
| `AutomatosX: Show Quality Dashboard` | Open quality metrics dashboard | - |
| `AutomatosX: Show Dependency Graph` | Open dependency visualization | - |
| `AutomatosX: Analyze Current File` | Show metrics for active file | - |
| `AutomatosX: Find Symbol References` | Find all references to symbol | - |
| `AutomatosX: Rename Symbol` | Rename symbol across project | - |
| `AutomatosX: Refresh All Views` | Refresh sidebar views | - |
| `AutomatosX: Export Quality Report` | Export metrics to JSON | - |

## Configuration

Configure AutomatosX in your VS Code settings (`Cmd+,`):

```json
{
  "automatosx.enableDiagnostics": true,
  "automatosx.complexityThreshold": 10,
  "automatosx.autoIndex": true,
  "automatosx.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ],
  "automatosx.maxFileSize": 1048576,
  "automatosx.enableTelemetry": false
}
```

### Settings

- **enableDiagnostics** - Enable code quality diagnostics (default: `true`)
- **complexityThreshold** - Complexity warning threshold (default: `10`)
- **autoIndex** - Auto-index files on save (default: `true`)
- **excludePatterns** - File patterns to exclude from indexing
- **maxFileSize** - Maximum file size to index in bytes (default: 1MB)
- **enableTelemetry** - Enable anonymous usage telemetry (default: `false`)
- **serverPath** - Custom LSP server path (optional)

## Supported Languages

- ✅ TypeScript (`.ts`, `.tsx`)
- ✅ JavaScript (`.js`, `.jsx`)
- ✅ Python (`.py`)
- ✅ Go (`.go`)
- ✅ Rust (`.rs`)

## Quality Grades

| Grade | Score | Description |
|-------|-------|-------------|
| A | 90-100 | Excellent quality |
| B | 80-89 | Good quality |
| C | 70-79 | Acceptable quality |
| D | 60-69 | Needs improvement |
| F | <60 | Poor quality |

Grades are calculated based on:
- Cyclomatic complexity
- Code maintainability
- Code duplication
- Best practice violations

## Status Bar

The AutomatosX status bar item shows:
- Current file quality grade
- Quality score
- Click to open Quality Dashboard

Colors:
- 🟢 Green - Grades A, B (good quality)
- 🟡 Yellow - Grade C (acceptable)
- 🔴 Red - Grades D, F (needs attention)

## Tree Views

### Symbol Explorer
- Shows all symbols in active file
- Group by kind (functions, classes, etc.)
- Filter by symbol type
- Click to navigate

### Quality Metrics
- Groups files by grade (A, B, C, D, F)
- Shows score and complexity
- Click to open file
- Refresh to update

### Dependencies
- Shows imports and exports
- Expand to see symbols
- Detects circular dependencies
- Click to navigate

## Webviews

### Quality Dashboard
- Summary statistics
- Grade distribution
- Score charts
- Export to PNG/PDF (coming soon)

### Dependency Graph
- Interactive graph visualization
- Zoom and pan
- Click nodes to open files
- Highlights circular dependencies

## Performance

- **Indexing**: 2000+ files/second
- **Query latency**: <5ms (P95)
- **Memory usage**: <100MB for typical projects
- **Bundle size**: <1MB

## Troubleshooting

### Extension not activating
1. Check VS Code version (requires 1.80.0+)
2. Look for errors in Output panel (View → Output → AutomatosX)
3. Restart VS Code

### Indexing not working
1. Check exclude patterns in settings
2. Verify file size is under limit
3. Run `AutomatosX: Index Project` manually

### LSP server not starting
1. Check custom server path if configured
2. Look for errors in Output panel
3. Try restarting extension: `Developer: Reload Window`

### Poor performance
1. Reduce workspace size
2. Add more exclude patterns
3. Increase max file size limit
4. Disable auto-index if needed

## Privacy

AutomatosX respects your privacy:
- All processing happens locally (no cloud)
- No code is sent to external servers
- Telemetry is opt-in and anonymous
- No personal data collected

## Contributing

Issues and pull requests welcome at:
https://github.com/automatosx/automatosx

## License

MIT License - see LICENSE file

## Support

- 📚 Documentation: https://automatosx.dev/docs
- 💬 Discussions: https://github.com/automatosx/automatosx/discussions
- 🐛 Issues: https://github.com/automatosx/automatosx/issues

## Release Notes

### 2.0.0

Initial release of AutomatosX VS Code extension:
- Symbol explorer with filtering
- Quality metrics dashboard
- Dependency graph visualization
- LSP integration for code intelligence
- Status bar indicators
- 8 commands for common workflows
- Support for TypeScript, JavaScript, Python, Go, Rust

---

**Enjoy using AutomatosX!** 🚀
