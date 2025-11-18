# Project Context for @defai.digital/automatosx

> Last updated: 2025-11-18
> Project: @defai.digital/automatosx (v8.4.16)

## Project Overview

**From Idea to Production in Minutes: The AI Workforce Platform with Persistent Memory**

AutomatosX is a pure CLI orchestration platform for AI agents. It wraps around `claude`, `gemini`, and `codex` commands to provide multi-agent orchestration, persistent memory, and workflow automation. Simple, focused, and easy to integrate with your existing AI workflow.

[![npm version](https://img.shields.io/npm/v/@defai.digital/automatosx.svg)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-2,423+%20passing-brightgreen.svg)](#)
[![npm](https://img.shields.io/npm/dt/%40defai.digital%2Fautomatosx.svg?label=total%20downloads&color=blue)](https://www.npmjs.com/package/@defai.digital/automatosx)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)

**Status**: ✅ **Production Ready** | v8.4.16 | 20 Specialized Agents | Pure CLI Orchestration | Simplified Architecture

> 🎉 **NEW in v8.3.0**: Major simplification! Removed ~36,000 lines of code including policy routing, free-tier management, and SDK providers. AutomatosX is now a pure CLI orchestration wrapper around `claude`, `gemini`, and `codex` commands. Simpler, faster, easier to maintain. See [Migration Guide](MIGRATION.md) for upgrade details.

**Key Features:**
| Feature | Description | Default |
|---------|-------------|---------|
| **Autonomous Execution** | Agents auto-respond to confirmation prompts | Enabled with `--iterate` |
| **Time Limits** | Configure execution timeouts to prevent runaway tasks | 120 minutes |
| **Safety Levels** | Choose from `paranoid`, `balanced`, `permissive` | `balanced` |
| **Dangerous Operation Detection** | Automatic classification of risky operations | Always active |
| **Dry Run Mode** | Test autonomous execution without making changes | Off |
| **Context History** | Maintains classification context for smarter decisions | Max 100 entries |
| **Workspace Protection** | Prevents access to files outside project directory | Always active |

**Version:** 8.4.16  
**Language:** TypeScript  
**Build Tool:** tsup  
**Test Framework:** Vitest

**Stack:** TypeScript, tsup, Vitest

## Architecture

**Type:** Command-line interface (CLI)

**Flow:**
```
1. CLI Interface
   ↓
2. Commands & Options
   ↓
3. Business Logic
   ↓
4. I/O Operations
```

**Key Components:**
- `src/config.generated.ts` - Configuration

## File Structure


**Directories:**
- `src/` - Source code (230 files)
- `tests/` - Test files (148 files)
- `docs/` - Documentation (42 files)
- `dist/` - Build output (2 files)

**Total Files:** 422

## Agent Delegation Rules

### Development
- **TypeScript issues** → @fullstack (Felix)
- **Infrastructure/DevOps** → @devops (Oliver)

### Quality & Architecture
- **Tests/QA** → @quality (Queenie)
- **Security audits** → @security (Steve) - mandatory for: auth, payments, PII
- **Architecture/ADR** → @architecture (Avery)

### Documentation & Product
- **Technical writing** → @writer (Wendy)
- **Product management** → @product (Paris)

## Coding Conventions

### Testing
- **Framework:** Vitest
- **Coverage:** 80% minimum
- **Run:** `npm test`

### Code Style
- **TypeScript:** Strict mode enabled
- **Indent:** 2 spaces
- **Max line:** 100 chars

### Git Workflow
- **Branch naming:** `feature/description` or `fix/description`
- **Commits:** Conventional commits format (feat/fix/chore/docs)
- **PRs:** Review required before merge

## Critical Guardrails

⚠️ **NEVER:**
- Commit to main/production branches directly
- Skip tests before pushing
- Expose API keys or credentials in code

✅ **ALWAYS:**
- Run `npm test` before pushing
- Document breaking changes
- Add tests for new features

## Canonical Commands

```bash
# Development
npm run dev                        # Start development server

# Building
npm run build                      # Build for production

# Testing
npm run test                       # Run all tests
npm run test:unit                  # Run unit tests
npm run test:integration           # Run integration tests
npm run test:all                   # Run Vitest tests
npm run test:ci                    # Run Vitest tests
npm run test:release               # Run Vitest tests
npm run test:smoke                 # Run test:smoke
npm run test:real-providers        # Run test:real-providers
npm run test:coverage              # Run Vitest tests
npm run test:watch                 # Watch mode for test
npm run test:typecheck             # Run Vitest tests
npm run test:debug                 # Run Vitest tests
npm run test:memory                # Run Vitest tests

# Quality Checks
npm run lint                       # Check code style
npm run lint:fix                   # Fix code style issues
npm run typecheck                  # Type check TypeScript
npm run verify                     # Pre-commit verification
npm run check:size                 # Run check:size
npm run check:timers               # Run check:timers

# Deployment
npm run release:check              # Run release:check
npm run release                    # Run release
npm run release:patch              # Run release:patch
npm run release:minor              # Run release:minor
npm run release:major              # Run release:major
npm run release:spec               # Run release:spec
npm run release:standard           # Run release:standard
npm run release:beta               # Run release:beta
npm run release:rc                 # Run release:rc
npm run release:first              # Run release:first

# Other
npm run prebuild:config            # Run prebuild:config
npm run typecheck:incremental      # TypeScript compilation
npm run prepublishOnly             # Run prepublishOnly
npm run prepack                    # Run prepack
npm run postpack                   # Run postpack
npm run version                    # Run version
npm run version:patch              # Run version:patch
npm run version:minor              # Run version:minor
npm run version:major              # Run version:major
npm run version:beta               # Run version:beta
npm run version:rc                 # Run version:rc
npm run sync:all-versions          # Run sync:all-versions
npm run prerelease                 # Run prerelease
npm run tools:check                # Run tools:check
npm run prepare                    # Run prepare
npm run commit                     # Run commit
```

## Useful Links

- [Repository](https://github.com/defai-digital/automatosx)
- [Documentation](docs/)

---

**Generated by `ax init` • Run regularly to keep up-to-date**
