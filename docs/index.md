---
layout: home

hero:
  name: AutomatosX
  text: AI Agent Orchestration Platform
  tagline: Priority-based multi-agent orchestration with TypeScript CLI
  image:
    src: /logo.svg
    alt: AutomatosX
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/defai-digital/automatosx
    - theme: alt
      text: CLI Reference
      link: /full-features

features:
  - icon: 🧠
    title: Persistent Memory
    details: SQLite-backed memory with fast full-text search and explicit opt-in saving.

  - icon: 🔌
    title: Multi-Provider
    details: Claude, Gemini, OpenAI, Grok, Qwen with priority-based fallback routing.

  - icon: 🧰
    title: CLI Tooling
    details: Agents, sessions, memory, specs, bugfix/refactor workflows in one CLI.

  - icon: 🔒
    title: Workspace Isolation
    details: Path validation and sandbox-friendly defaults to keep runs contained.

  - icon: ✅
    title: Tested TS Codebase
    details: TypeScript-first, strict typecheck, 200+ tests across unit/integration/smoke.

---

## Quick Example

```bash
# Install (pnpm recommended)
pnpm add -D @defai.digital/automatosx

# Initialize AutomatosX in a project
pnpm ax setup

# Run an agent
pnpm ax run backend "Design a REST API for tasks"
```

## Get Started

1. Install with pnpm (Node 24+)
2. `pnpm ax setup` to create `.automatosx` workspace
3. Configure providers with `pnpm ax config`
4. Run agents with `pnpm ax run <agent> "task"`
5. Explore memory (`pnpm ax memory list`) and sessions (`pnpm ax session list`)

## Community

::: tip Get Help
Please use [GitHub Issues](https://github.com/defai-digital/automatosx/issues) for:
- 🐛 Bug reports
- ✨ Feature requests & Wishlist (use "enhancement" label)
- ❓ Questions & Support
:::

## Version

Current release: v12.7.x (see `package.json` for exact version)

## License

[Apache-2.0](https://github.com/defai-digital/automatosx/blob/main/LICENSE)
