# AutomatosX VS Code Extension - Installation Guide

## Prerequisites

- VS Code 1.80.0 or higher
- Node.js 18+ and npm

## Installation Steps

### Option 1: From Source (Development)

1. **Install Dependencies**:
   ```bash
   cd extensions/vscode
   npm install
   ```

2. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

3. **Run in Debug Mode**:
   - Open `extensions/vscode` in VS Code
   - Press F5 to launch Extension Development Host
   - Test extension in new VS Code window

### Option 2: Build VSIX Package

1. **Install VSCE** (VS Code Extension Manager):
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Build Extension**:
   ```bash
   cd extensions/vscode
   npm install
   npm run compile
   vsce package
   ```

3. **Install VSIX**:
   ```bash
   code --install-extension automatosx-vscode-2.0.0.vsix
   ```

### Option 3: From VS Code Marketplace (Future)

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "AutomatosX"
4. Click Install

## Configuration

After installation, configure in VS Code settings:

```json
{
  "automatosx.enableDiagnostics": true,
  "automatosx.complexityThreshold": 10,
  "automatosx.autoIndex": true,
  "automatosx.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**"
  ]
}
```

## Verification

1. Open a TypeScript/JavaScript project
2. Look for "AutomatosX" in the activity bar (sidebar)
3. Run command: `AutomatosX: Index Project`
4. Check status bar for quality indicator

## Troubleshooting

### Extension Not Activating
- Check VS Code version: `code --version`
- Look for errors in Output panel (View → Output → AutomatosX)
- Restart VS Code: `Developer: Reload Window`

### LSP Server Not Starting
- Check Output panel for LSP errors
- Verify Node.js version: `node --version`
- Clear extension cache and reinstall

### Missing Dependencies
```bash
cd extensions/vscode
rm -rf node_modules package-lock.json
npm install
```

## Development Setup

For development and testing:

1. **Clone Repository**:
   ```bash
   git clone https://github.com/automatosx/automatosx.git
   cd automatosx/extensions/vscode
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```

4. **Watch Mode** (auto-compile):
   ```bash
   npm run watch
   ```

5. **Launch Extension**:
   - Open in VS Code
   - Press F5 to debug

## Uninstallation

```bash
code --uninstall-extension automatosx.automatosx-vscode
```

Or from VS Code:
1. Go to Extensions (Cmd+Shift+X)
2. Find "AutomatosX"
3. Click Uninstall

## Support

- Documentation: https://automatosx.dev/docs
- Issues: https://github.com/automatosx/automatosx/issues
- Discussions: https://github.com/automatosx/automatosx/discussions
