# Frequently Asked Questions (FAQ)

## Installation & Setup

### Q: Why do I see peer dependency warnings when installing?

**A**: AutomatosX uses tree-sitter v0.25.0 (latest), while some language parser packages haven't updated their peer dependencies yet. The warnings are harmless and can be safely ignored.

**Solution**: Create a `.npmrc` file to suppress warnings:
```bash
echo "strict-peer-dependencies=false" > .npmrc
```

See [INSTALLATION.md#peer-dependency-warnings](./INSTALLATION.md#peer-dependency-warnings) for detailed solutions.

---

### Q: Can I use npm instead of pnpm?

**A**: **Yes**, if you're an end user installing the CLI:
- ✅ `npm install -g @defai.digital/automatosx` works perfectly
- ✅ No peer dependency warnings with npm
- ✅ All features work correctly

**However**, if you're a developer contributing to the AutomatosX codebase:
- ⚠️ You **must** use pnpm (workspace structure requires it)
- See [automatosx/tmp/pnpm-all-issues-fixed.md](./automatosx/tmp/pnpm-all-issues-fixed.md) for technical details

---

### Q: What Node.js version do I need?

**A**: Node.js v24.x or higher is required. The latest LTS version is recommended.

**Check your version**:
```bash
node --version
# Should show v24.x.x or higher
```

**Upgrade Node.js**:
- Using nvm (recommended): `nvm install 24 && nvm use 24`
- Download from [nodejs.org](https://nodejs.org/)

---

### Q: How do I fix "command not found: ax"?

**A**: This usually means your npm global bin directory isn't in PATH.

**Solution**:
```bash
# 1. Check npm global bin path
npm config get prefix

# 2. Add to PATH (Linux/macOS)
export PATH="$(npm config get prefix)/bin:$PATH"

# 3. Add to your shell profile
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

For Windows, see [INSTALLATION.md#command-not-found](./INSTALLATION.md#command-not-found).

---

## Features & Usage

### Q: What languages does AutomatosX support?

**A**: AutomatosX supports **45 programming languages** via Tree-sitter parsing:

**Systems & Performance**: C, C++, Rust, Go, Zig, Objective-C, AssemblyScript, CUDA
**Frontend & Mobile**: TypeScript, JavaScript, HTML, Dart, Kotlin
**Backend**: Python, Ruby, PHP, Java, Scala, C#
**Functional**: Haskell, OCaml, Elm, Elixir, Gleam
**Data & Config**: SQL, JSON, YAML, TOML, Markdown, CSV
**DevOps**: Bash, Zsh, HCL (Terraform), Makefile, Puppet
**Specialized**: Solidity, Verilog, SystemVerilog, Julia, MATLAB, Regex, Thrift

See [src/parser/](./src/parser/) for parser implementations.

---

### Q: How does AutomatosX compare to GitHub Copilot?

**A**: AutomatosX and GitHub Copilot serve different purposes:

| Feature | AutomatosX | GitHub Copilot |
|---------|------------|----------------|
| **Primary Use** | Code intelligence, search, workflow automation | AI-powered code completion |
| **Code Search** | ✅ AST-based, 45 languages | ❌ Basic text search |
| **Symbol Lookup** | ✅ Function/class definitions | ❌ No structured search |
| **Workflow Automation** | ✅ Multi-step workflows | ❌ Single completions |
| **AI Providers** | ✅ Claude, Gemini, OpenAI | GitHub Copilot only |
| **Interactive CLI** | ✅ ChatGPT-style REPL | ❌ Editor-only |
| **Open Source** | ✅ Apache 2.0 | ❌ Proprietary |

**TL;DR**: Use both! Copilot for completions, AutomatosX for search and automation.

---

### Q: Does AutomatosX require an internet connection?

**A**: **Partially**:

**Works offline**:
- ✅ Code indexing and search
- ✅ Symbol lookups
- ✅ File watching
- ✅ Database operations
- ✅ CLI commands

**Requires internet**:
- ❌ AI provider calls (Claude, Gemini, OpenAI)
- ❌ SpecKit auto-generation
- ❌ Interactive CLI AI responses
- ❌ Workflow AI steps

**Local-only mode**: Set `AUTOMATOSX_OFFLINE=true` to disable AI features.

---

### Q: How do I use the interactive CLI?

**A**: Launch with:
```bash
ax cli
```

**Features**:
- 💬 ChatGPT-style conversations
- ⚡ 15+ slash commands (`/help`, `/agent`, `/workflow`)
- 🎨 Syntax highlighting and table formatting
- 💾 Auto-save conversations to SQLite
- 🔄 Context-aware responses

**Example session**:
```
> Search for authentication code
[AI response with search results]

> /agent list
[Shows 21 available agents]

> /workflow execute cicd.yaml
[Executes CI/CD workflow]

> /history
[Shows conversation history]
```

See [README.md#5-interactive-cli-mode](./README.md#5-interactive-cli-mode) for details.

---

## Performance & Troubleshooting

### Q: Why is indexing slow?

**A**: Indexing speed depends on:
- **File count**: 2000+ files/sec typical
- **File size**: Large files (>1MB) take longer
- **Language complexity**: TypeScript/C++ slower than JSON

**Optimization tips**:
```bash
# 1. Exclude unnecessary directories
ax index ./src --exclude "**/node_modules/**,**/dist/**"

# 2. Use file watching instead of re-indexing
ax watch ./src

# 3. Index only changed files
ax index ./src --incremental
```

---

### Q: How much disk space does the database use?

**A**: Database size varies by codebase:

**Typical sizes**:
- Small project (1K files): ~5MB
- Medium project (10K files): ~50MB
- Large project (100K files): ~500MB

**Location**: `.automatosx/db/code-intelligence.db`

**Reduce size**:
```bash
# Vacuum database
sqlite3 .automatosx/db/code-intelligence.db "VACUUM;"

# Rebuild with exclusions
rm -rf .automatosx/
ax index ./src --exclude "**/test/**,**/__tests__/**"
```

---

### Q: Why do searches return no results?

**A**: Common causes:

1. **Database not indexed**:
   ```bash
   ax index ./src
   ```

2. **Query syntax issue**:
   ```bash
   # ✅ Correct
   ax find "getUserById"

   # ❌ Incorrect (missing quotes)
   ax find getUserById
   ```

3. **Filters too restrictive**:
   ```bash
   # Remove filters to test
   ax find "getUserById" --no-filter
   ```

4. **Cache issue**:
   ```bash
   rm -rf .automatosx/cache/
   ax find "getUserById"
   ```

---

### Q: Can I use AutomatosX in CI/CD pipelines?

**A**: **Yes!** AutomatosX works great in CI/CD:

**Example GitHub Actions workflow**:
```yaml
name: Code Quality Check

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Install AutomatosX
        run: npm install -g @defai.digital/automatosx

      - name: Index codebase
        run: ax index ./src

      - name: Run analysis
        run: ax analyze --format json > report.json

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: code-analysis
          path: report.json
```

---

## AI & Providers

### Q: Which AI provider should I use?

**A**: Depends on your needs:

| Provider | Best For | Cost | Speed |
|----------|----------|------|-------|
| **Claude** | Complex reasoning, long context | $$$ | Medium |
| **Gemini** | Balanced performance, code generation | $$ | Fast |
| **OpenAI** | General purpose, stable API | $$$ | Medium |

**Recommendation**: Configure all three for automatic fallback:
```bash
export ANTHROPIC_API_KEY="..."
export GOOGLE_API_KEY="..."
export OPENAI_API_KEY="..."
```

AutomatosX will automatically failover if one provider is down.

---

### Q: How much do AI provider costs add up to?

**A**: Costs vary by usage:

**Typical costs per 1000 queries**:
- Simple searches: $0 (local only)
- SpecKit generation: $5-10 (AI calls)
- Interactive CLI: $10-20 (conversation)
- Workflow automation: $20-50 (multi-step)

**Cost optimization**:
- Use caching (enabled by default)
- Limit AI calls to complex tasks
- Use local search for simple queries

---

## Development & Contributing

### Q: How do I contribute to AutomatosX?

**A**: We welcome contributions!

1. **Fork the repository**:
   ```bash
   git clone https://github.com/defai-digital/automatosx.git
   cd automatosx
   ```

2. **Install pnpm** (required for development):
   ```bash
   npm install -g pnpm@9
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Build**:
   ```bash
   pnpm run build
   ```

5. **Run tests**:
   ```bash
   pnpm test
   ```

See [CLAUDE.md](./CLAUDE.md) for detailed development guide.

---

### Q: Why does the project use both ReScript and TypeScript?

**A**: **Hybrid architecture** for optimal performance:

**ReScript** (`packages/rescript-core/`):
- ✅ State machines (deterministic workflow execution)
- ✅ Rule engine (policy DSL)
- ✅ Type-safe at compile time

**TypeScript** (`src/`):
- ✅ CLI framework (Commander.js)
- ✅ Service layer (SQLite, Tree-sitter)
- ✅ Web UI (React + Redux)

**Why not just TypeScript?**:
- ReScript provides stronger type guarantees
- Pattern matching simplifies state machines
- Compiles to optimized JavaScript

**Why not just ReScript?**:
- TypeScript ecosystem is larger
- Better tooling for CLI/web development
- More contributors familiar with TS

See [CLAUDE.md#hybrid-language-stack](./CLAUDE.md#hybrid-language-stack) for architecture details.

---

## Common Issues

### Q: "Error: Cannot find module 'tree-sitter'"

**A**: Native module installation failed.

**Solution**:
```bash
# Reinstall with build tools
npm rebuild tree-sitter

# If that fails, reinstall AutomatosX
npm uninstall -g @defai.digital/automatosx
npm cache clean --force
npm install -g @defai.digital/automatosx
```

---

### Q: "Error: EACCES: permission denied"

**A**: npm global directory not writable.

**Solution**:
```bash
# Option 1: Fix permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Option 2: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 24
npm install -g @defai.digital/automatosx
```

---

### Q: Tests fail with "no such module: vec0"

**A**: SQLite vector extension not loaded (known issue in some tests).

**Impact**: 14 embedding tests affected (non-critical)

**Workaround**: These tests are skipped in CI. Not required for core functionality.

See [automatosx/tmp/v8.0.1-RUNTIME-FIXES-COMPLETE.md](./automatosx/tmp/v8.0.1-RUNTIME-FIXES-COMPLETE.md) for details.

---

## Still Have Questions?

- **GitHub Issues**: [Report bugs or request features](https://github.com/defai-digital/automatosx/issues)
- **Documentation**: [README.md](./README.md), [CLAUDE.md](./CLAUDE.md), [INSTALLATION.md](./INSTALLATION.md)
- **License**: [Apache 2.0](./LICENSE)

---

**AutomatosX v8.0.6** - Production-ready code intelligence platform

Copyright 2025 DEFAI Private Limited | Apache License 2.0
