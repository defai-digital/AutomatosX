# Developer Documentation

Welcome to the AutomatosX developer documentation! This section is for contributors and developers working on AutomatosX itself.

**📖 Looking to USE AutomatosX?** See the [main documentation](../README.md) instead.

---

## 🎯 Who This Is For

This documentation is for the **5%** who want to:

- **Contribute** code or documentation to AutomatosX
- **Develop** new features or fix bugs
- **Understand** the internal architecture
- **Extend** AutomatosX for custom use cases
- **Deploy** AutomatosX in production environments

If you just want to **use** AutomatosX agents in your project, see the [User Documentation](../README.md).

---

## 📚 Developer Resources

### 🏗️ Architecture

System design, performance, and internals:

- **[Best Practices](./architecture/best-practices.md)** ✨
  - Production patterns
  - Security guidelines
  - Performance optimization
  - Error handling strategies

- **[Caching](./architecture/caching.md)** 💾
  - Cache strategies and configuration
  - Invalidation patterns
  - Performance impact analysis

- **[Performance Tuning](./architecture/performance.md)** 🚀
  - Optimization strategies
  - Benchmarking approaches
  - Resource management
  - Profiling tools

- **[Parallel Execution](./architecture/parallel-execution.md)** ⚡
  - Concurrent agent execution
  - Observability patterns
  - Resource management strategies
  - Implementation best practices

### 🔌 API Reference

Internal APIs and observability:

- **[Observability API](./api/observability.md)** 📊
  - Performance monitoring
  - Metrics collection
  - Debugging tools
  - Tracing and logging

### 🤝 Contributing

How to contribute to AutomatosX:

- **[Getting Started](./contributing/getting-started.md)** 🚀
  - Development environment setup
  - Building from source
  - Running tests locally
  - First contribution guide

- **[Testing Guide](./contributing/testing.md)** 🧪
  - Unit testing patterns
  - Integration testing setup
  - Test coverage requirements
  - Mocking strategies

- **[Test Standards](./contributing/test-standards.md)** 📏
  - Testing best practices
  - Code coverage requirements (95%+)
  - Mock and stub patterns
  - CI/CD test requirements

- **[E2E Testing](./contributing/e2e-testing.md)** 🔄
  - End-to-end test setup
  - Test scenarios and fixtures
  - CI/CD integration patterns
  - Provider mocking

- **[Release Process](./contributing/release-process.md)** 🚀
  - Version management (semantic versioning)
  - Release checklist
  - Publishing workflow
  - Changelog generation

- **[Conventional Commits](./contributing/conventional-commits.md)** 📝
  - Commit message format
  - Semantic versioning integration
  - Automated changelog generation
  - PR title requirements

- **[Workspace Conventions](./contributing/workspace-conventions.md)** 📂
  - Project structure
  - File organization (src/, tests/, docs/)
  - Naming conventions
  - TypeScript patterns

### 🔄 Migration Guides

Version-specific upgrade guides:

- **[v9 Cost to Tokens Migration](./migration/v9-cost-to-tokens.md)** 💰→🎫
  - Cost estimation disabled by default
  - Token-based tracking instead
  - Configuration updates
  - Breaking changes

### 🖥️ Platform Guides

Platform-specific development and deployment:

- **[Windows Setup](./platform/setup.md)** 🪟
  - Development environment on Windows
  - PATH configuration
  - Provider CLI setup
  - PowerShell vs CMD considerations

- **[Windows Troubleshooting](./platform/troubleshooting.md)** 🔧
  - Common Windows development issues
  - Permission problems
  - File system differences
  - Diagnostic commands

### 📦 Project Internals

Internal project details:

- **[Project History](./internals/project-history.md)** 📜
  - Development timeline
  - Major milestones (v4.0 → v12.0)
  - Evolution of features
  - Architecture decisions

- **[Dependencies Analysis](./internals/dependencies.md)** 📊
  - npm dependency tree
  - Bundle size analysis
  - Security audit results
  - Update strategies

---

## 🚀 Quick Start for Contributors

### 1. Clone and Setup

```bash
git clone https://github.com/defai-digital/automatosx
cd automatosx
npm install
```

### 2. Build

```bash
npm run build          # Production build
npm run dev           # Development mode with watch
```

### 3. Run Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:watch    # Watch mode for TDD
```

### 4. Verify Changes

```bash
npm run verify        # Pre-commit checks (lint + typecheck + build + tests)
```

### 5. Create Pull Request

See [Contributing Guide](./contributing/getting-started.md) for the full PR process.

---

## 🧪 Development Workflow

### Daily Development

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run tests: `npm test`
4. Verify: `npm run verify`
5. Commit with conventional commits format: `git commit -m "feat: add feature"`
6. Push and create PR

### Testing Philosophy

- **Unit Tests**: Fast, isolated, mocked dependencies
- **Integration Tests**: Real providers (or mocks), real file system
- **E2E Tests**: Full workflows, realistic scenarios
- **Coverage**: 95%+ required for new code

### Code Quality Standards

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier for consistent formatting
- **Type Safety**: Zod for runtime validation of external data

---

## 🛠️ Useful Commands

```bash
# Development
npm run dev                   # Watch mode development
npm run build                 # Production build
npm run typecheck             # Type checking only

# Testing
npm test                      # All tests
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report

# Quality Checks
npm run lint                  # Lint code
npm run lint:fix              # Fix lint issues
npm run verify                # Full pre-commit verification

# Release
npm run release:check         # Validate release readiness
npm run release               # Create release
npm version [patch|minor|major]  # Bump version
```

---

## 📖 Key Files for Developers

### Configuration

- `ax.config.json` - User-editable configuration
- `src/config.generated.ts` - **Generated** TypeScript config (never edit manually!)
- `tools/prebuild-config.cjs` - Config generator script
- `vitest.config.ts` - Vitest configuration
- `tsup.config.ts` - Build configuration
- `tsconfig.json` - TypeScript configuration

### Source Code

- `src/cli/` - CLI commands and entry point
- `src/core/` - Core services (router, memory, session, spec-kit)
- `src/providers/` - Provider implementations
- `src/agents/` - Agent system
- `src/integrations/` - Provider integrations (claude-code, gemini-cli, etc.)
- `src/utils/` - Utilities and helpers

### Tests

- `tests/unit/` - Fast unit tests with mocks
- `tests/integration/` - Integration tests with real providers
- `tests/smoke/` - Smoke tests (bash scripts)
- `tests/fixtures/` - Test fixtures and data
- `vitest.setup.ts` - Test setup (global mocks, cleanup)

---

## 🏗️ Architecture Overview

AutomatosX is built on these core principles:

### 1. **CLI-First Design**

Pure CLI tool that wraps `claude`, `gemini`, `grok`, `codex` commands for orchestration.

### 2. **Policy-Driven Routing**

Provider selection based on cost, latency, privacy, and workload policies.

### 3. **Persistent Memory**

SQLite + FTS5 for < 1ms full-text search (no vector embeddings, no API calls).

### 4. **Multi-Agent Orchestration**

20+ specialized agents with natural language delegation and session management.

### 5. **Spec-Driven Workflows**

YAML workflow definitions with automatic plan/DAG/scaffold/test generation.

### 6. **Zero Configuration**

Sensible defaults, optional customization, automatic provider detection.

---

## 🔐 Security Best Practices

- **Never commit** API keys or secrets
- **Use environment variables** for sensitive configuration
- **Run** `npm audit` regularly for dependency vulnerabilities
- **Follow** [Security Policy](../../SECURITY.md) for reporting vulnerabilities
- **Test** security features with unit + integration tests

---

## 📝 Documentation Standards

When contributing documentation:

1. **User-First**: Write for users, not developers (unless in `docs/developer/`)
2. **Clear Examples**: Show code, not just descriptions
3. **Progressive Disclosure**: Simple → intermediate → advanced
4. **Consistent Style**: Follow [writing style guide](../../automatosx/PRD/docs-migration-detailed-plan.md#writing-style-guide)
5. **Keep Current**: Update with code changes, verify examples work

---

## 🤝 Community & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/defai-digital/automatosx/issues)
- **Pull Requests**: [Contribution guidelines](./contributing/getting-started.md)
- **Discussions**: [GitHub Discussions](https://github.com/defai-digital/automatosx/discussions)
- **Security**: [Security Policy](../../SECURITY.md)
- **Code of Conduct**: [Community Standards](../../CODE_OF_CONDUCT.md)

---

## 📄 License

AutomatosX is [Apache 2.0 licensed](../../LICENSE).

---

## 🔗 Links

- **Main Documentation**: [docs/README.md](../README.md) - For users
- **GitHub**: [github.com/defai-digital/automatosx](https://github.com/defai-digital/automatosx)
- **npm**: [@defai.digital/automatosx](https://www.npmjs.com/package/@defai.digital/automatosx)
- **Contributing**: [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

**Happy hacking on AutomatosX!** 🚀💻

---

**Version**: 9.0.0
**Last Updated**: 2025-11-18
**Developer Docs**: Phase 2 Migration Complete
