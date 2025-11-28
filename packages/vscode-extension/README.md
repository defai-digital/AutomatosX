# AutomatosX VS Code Extension

AI Agent Orchestration for VS Code - Multi-provider support with intelligent agent routing.

## Features

### Command Palette Commands

Access all features via `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux):

| Command | Description |
|---------|-------------|
| `AutomatosX: Run Task` | Execute a task with auto-selected agent |
| `AutomatosX: Run Task with Agent...` | Choose a specific agent for your task |
| `AutomatosX: Analyze Selection` | Analyze selected code with an agent |
| `AutomatosX: Explain Code` | Get a detailed explanation of selected code |
| `AutomatosX: Generate Tests` | Generate unit tests for selected code |
| `AutomatosX: Security Review` | Perform security analysis on selected code |
| `AutomatosX: Optimize Code` | Get optimization suggestions |
| `AutomatosX: Refactor Code` | Get refactoring suggestions |
| `AutomatosX: Search Memory` | Search conversation history |
| `AutomatosX: Show Status` | View system status |
| `AutomatosX: Setup` | Initialize AutomatosX in workspace |

### Sidebar Views

The extension adds an AutomatosX sidebar with:

- **Agents** - Browse available agents by team
- **Sessions** - View active and recent sessions
- **Memory** - Memory stats and search
- **System** - Provider health and system status

### Code Lens

Clickable actions appear above functions and classes:

- **Ask Agent** - Get explanations about code
- **Tests** - Generate unit tests
- **Security** - Run security review

### Hover Actions

Hover over functions to see quick action links for common operations.

### Context Menu

Right-click selected code to access AutomatosX actions in the editor context menu.

### Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+A` | Run Task |
| `Cmd+Shift+Alt+A` | Run Task with Agent |
| `Cmd+Shift+E` | Analyze Selection (when text selected) |

## Installation

### From VS Code Marketplace

Search for "AutomatosX" in the Extensions view.

### From VSIX

```bash
# Build the extension
cd packages/vscode-extension
pnpm build
pnpm package

# Install the generated .vsix file
code --install-extension automatosx-11.0.0-alpha.0.vsix
```

## Configuration

### Extension Settings

Configure in VS Code settings (`Cmd+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `automatosx.defaultAgent` | `standard` | Default agent when none specified |
| `automatosx.defaultProvider` | `ax-cli` | Default AI provider |
| `automatosx.timeout` | `300000` | Execution timeout (ms) |
| `automatosx.showStatusBar` | `true` | Show status bar item |
| `automatosx.enableCodeLens` | `true` | Enable Code Lens actions |
| `automatosx.enableHover` | `true` | Enable hover actions |
| `automatosx.streamOutput` | `true` | Stream agent output |
| `automatosx.autoSaveToMemory` | `true` | Save interactions to memory |

### Claude Code MCP Integration

Add to your Claude Code settings for MCP server access:

```json
{
  "claude-code.mcpServers": {
    "automatosx": {
      "command": "npx",
      "args": ["ax-mcp"],
      "env": {
        "AUTOMATOSX_BASE_PATH": "${workspaceFolder}/.automatosx"
      }
    }
  }
}
```

## Quick Setup

1. Install the extension
2. Open Command Palette: `Cmd+Shift+P`
3. Run: `AutomatosX: Setup`
4. Start using agents!

Or generate VS Code configs automatically:

```bash
ax setup --vscode
```

This creates:
- `.vscode/tasks.json` - Pre-configured tasks
- `.vscode/settings.json` - Extension settings
- `.vscode/automatosx.code-snippets` - Code snippets

## Available Agents

AutomatosX includes 22 specialized agents:

| Agent | Specialization |
|-------|----------------|
| `backend` | API design, databases, microservices |
| `frontend` | React, UI/UX, accessibility |
| `devops` | CI/CD, infrastructure, containers |
| `security` | Vulnerabilities, threat modeling |
| `quality` | Testing, QA, bug triage |
| `data` | Data pipelines, SQL, analytics |
| `researcher` | Deep research and analysis |
| `standard` | General-purpose assistant |

...and more! Run `ax agent list` to see all.

## Requirements

- VS Code 1.85.0 or higher
- Node.js 24.0.0 or higher
- AutomatosX CLI (`npm install -g @ax/cli`)

## Development

```bash
# Install dependencies
pnpm install

# Build extension
pnpm --filter automatosx build

# Watch mode
pnpm --filter automatosx dev

# Package for distribution
pnpm --filter automatosx package
```

## License

Apache-2.0
