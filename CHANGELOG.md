# Changelog

All notable changes to AutomatosX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [11.0.1] - 2025-12-02

### Added - AI-Assisted Orchestration Platform Release

AutomatosX v11.0.1 - Production-ready AI Agent Orchestration Platform.

#### Core Features
- **Workflow Templates**: YAML-based workflow templates with `--workflow` flag for iterate mode
- **Spec-Kit Generators**: Auto-generate plans, DAGs, scaffolds, and tests (`ax gen` commands)
- **Pure CLI Wrapper**: Seamlessly wraps around `claude`, `gemini`, `codex`, `ax-cli` CLIs
- **Persistent Memory**: SQLite FTS5 full-text search with < 1ms response time
- **20+ Specialized Agents**: Autonomous task delegation across specialized domains
- **Token-Based Budget Control**: Reliable budget management using token limits
- **Complete JSONL Observability**: Full trace logging for every execution decision

#### Platform Support
- macOS 26.0+
- Windows 10+
- Ubuntu 24.04+
- Node.js >= 24.0.0

#### Providers Supported
- Claude Code (Anthropic)
- Gemini CLI (Google)
- OpenAI Codex
- ax-cli (GLM, xAI, Ollama)

### Changed
- Simplified documentation by removing legacy version references
- Streamlined CLAUDE.md and integration guides

---

For complete version history prior to v11.0.0, see git commit history.
