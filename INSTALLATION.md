# AutomatosX Installation Guide

## Prerequisites

Before installing AutomatosX, ensure you have:

- **Node.js**: v24.x or higher ([Download](https://nodejs.org/))
- **npm**: v10.0.0 or higher (comes with Node.js)
- **Operating System**:
  - Ubuntu 24.04 LTS or later
  - macOS 26 (Tahoe) or later
  - Windows 11 or later

## Installation Methods

### Method 1: Global Installation (Recommended)

Install AutomatosX globally to use the `ax` command from anywhere:

```bash
npm install -g @defai.digital/automatosx
```

Verify installation:

```bash
ax --version
# Output: 8.0.4
```

### Method 2: Use with npx (No Installation)

Run AutomatosX without installing:

```bash
npx @defai.digital/automatosx@latest <command>
```

Examples:
```bash
# Search code
npx @defai.digital/automatosx@latest find "getUserById"

# Launch interactive CLI
npx @defai.digital/automatosx@latest cli

# Index codebase
npx @defai.digital/automatosx@latest index ./src
```

### Method 3: Project-Local Installation

Install as a project dependency:

```bash
npm install @defai.digital/automatosx --save-dev
```

Then use via npm scripts in `package.json`:

```json
{
  "scripts": {
    "ax": "ax",
    "code:search": "ax find",
    "code:index": "ax index ./src"
  }
}
```

Run commands:
```bash
npm run ax -- find "login"
npm run code:search "authentication"
```

## First-Time Setup

After installation, initialize AutomatosX in your project:

### 1. Index Your Codebase

```bash
# Index current directory
ax index .

# Index specific directory
ax index ./src

# Index with file watching
ax watch ./src
```

### 2. Test the Installation

```bash
# Check system status
ax status

# Search for code
ax find "function"

# Launch interactive mode
ax cli
```

### 3. Configure (Optional)

Create `automatosx.config.json` in your project root:

```json
{
  "languages": {
    "typescript": { "enabled": true },
    "python": { "enabled": true }
  },
  "indexing": {
    "excludePatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**"
    ]
  },
  "search": {
    "defaultLimit": 10
  }
}
```

## Environment Setup

### Configure AI Providers (Optional)

AutomatosX supports multiple AI providers. Set up API keys:

```bash
# Claude (Anthropic)
export ANTHROPIC_API_KEY="your-api-key-here"

# Gemini (Google)
export GOOGLE_API_KEY="your-api-key-here"

# OpenAI
export OPENAI_API_KEY="your-api-key-here"
```

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# AutomatosX AI Provider Configuration
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIza..."
export OPENAI_API_KEY="sk-..."
```

## Updating AutomatosX

### Global Installation

```bash
npm update -g @defai.digital/automatosx
```

### Check Current Version

```bash
ax --version
npm list -g @defai.digital/automatosx
```

### View Available Versions

```bash
npm view @defai.digital/automatosx versions
```

### Install Specific Version

```bash
npm install -g @defai.digital/automatosx@8.0.4
```

## Troubleshooting

### Command Not Found

If `ax` command is not found after global installation:

1. **Check npm global bin directory**:
   ```bash
   npm config get prefix
   ```

2. **Add to PATH** (Linux/macOS):
   ```bash
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

3. **Add to PATH** (Windows PowerShell):
   ```powershell
   $env:Path += ";$(npm config get prefix)"
   ```

### Permission Errors (Linux/macOS)

If you get EACCES errors:

```bash
# Fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 24
npm install -g @defai.digital/automatosx
```

### Python 3.14 Compatibility Issues

If you encounter `distutils` errors during installation:

**Issue**: Python 3.14 removed the `distutils` module, affecting native module compilation.

**Solution**: The package includes a fix (node-gyp 10.3.1). Reinstall:

```bash
npm uninstall -g @defai.digital/automatosx
npm cache clean --force
npm install -g @defai.digital/automatosx
```

### Windows C++ Build Tools

If installation fails on Windows with build errors:

```bash
# Install Visual Studio Build Tools
npm install --global --production windows-build-tools

# Or install Visual Studio 2022 Community Edition with:
# - Desktop development with C++
# - MSVC v143 - VS 2022 C++ x64/x86 build tools
# - Windows 10 SDK
```

### Database Initialization

If you encounter database errors:

```bash
# Remove existing database
rm -rf .automatosx/

# Re-index codebase
ax index ./src
```

## Uninstallation

### Global Installation

```bash
npm uninstall -g @defai.digital/automatosx
```

### Clean All Data

```bash
# Remove database and cache
rm -rf .automatosx/

# Remove configuration
rm automatosx.config.json
```

## Next Steps

After installation:

1. **Read the Quick Start Guide**: See [README.md](./README.md#-quick-start)
2. **Explore Interactive CLI**: Run `ax cli` for ChatGPT-style interface
3. **Try SpecKit Generators**: Run `ax speckit spec "your workflow description"`
4. **Check Documentation**: See [API Quick Reference](./API-QUICKREF.md)

## Support

- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Documentation**: [README.md](./README.md)
- **License**: [Apache 2.0](./LICENSE)

---

**AutomatosX v8.0.4** - Production-ready code intelligence platform

Copyright 2025 DEFAI Private Limited | Apache License 2.0
