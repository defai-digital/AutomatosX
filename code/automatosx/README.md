# AutomatosX | AX Trust

Trusted runtime and governance for AI software delivery.

[![Version](https://img.shields.io/badge/version-14.0.0-green.svg)](https://github.com/defai-digital/AutomatosX/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)

---

## What is AX Trust?

AutomatosX is the product family.

This repository is being repositioned as `AX Trust`, the trusted execution and governance layer behind the `ax` system.

Instead of positioning this repo as a generic AI toolbox, AX Trust focuses on a narrower and more defensible job:

- workflow-first AI software delivery
- trusted runtime execution
- policy and governance enforcement
- traceability, checkpoints, and resume
- governed bridges and skills for internal capability extension
- review, debugging, and discussion loops that remain inside the same trust model

AX Trust combines:

- workflows
- agents
- bridges
- skills
- dashboards
- trust core: contracts, domains, workflow specs, invariants, guards, and governance policies

The default operating story is:

1. bootstrap a workspace with `ax setup`
2. run one of the five first-class delivery workflows
3. inspect traces, reviews, policy outcomes, and workflow artifacts
4. extend capability through bridges, skills, and operator dashboards when needed

This repository still contains broader advanced and experimental utilities, but they are not the default AX Trust product story.

---

## Quick Start (3 Steps)

```bash
# 1. Install the CLI
npm install -g @defai.digital/cli

# 2. Bootstrap your project
cd your-project
ax setup
ax doctor

# 3. Run a trusted workflow
ax ship --scope <area>
```

Recommended first run:

1. Start with `ship`, `architect`, `audit`, `qa`, or `release`.
2. Use `--dry-run` when you want artifacts without runtime side effects.
3. Inspect `.automatosx/workflows/` for `manifest.json`, `summary.json`, and generated markdown artifacts.

---

## Using AX Trust with Your AI CLI

After running `ax setup`, your AI CLI can connect to the local AX Trust MCP runtime and work through the trusted workflow surface instead of ad-hoc tool sprawl.

### With Claude Code

```bash
claude
```

Example prompts:

```text
Use ax architect --request "Add SSO for enterprise customers"

Run ax review analyze src/ --focus security

Use ax discuss "REST vs GraphQL for mobile app"
```

### With Gemini CLI

```bash
gemini
```

Example prompts:

```text
Run ax ship --scope packages/cli

Use ax discuss quick "Should this release be feature-flagged?"
```

### With Codex CLI

```bash
codex
```

Example prompts:

```text
Show me the stable built-in agents with ax agent list

Run ax audit --scope packages/shared-runtime

Check the available trust policies with ax policy list
```

### With Cursor IDE

Run `ax setup`, open the project in Cursor, and use the same workflow-first surfaces through the generated MCP configuration.

---

## Default AX Trust Surface

### Primary Commands

- `ax setup`
- `ax ship --scope <area>`
- `ax architect --request "<requirement>"`
- `ax audit --scope <path-or-area>`
- `ax qa --target <service-or-feature> --url <url>`
- `ax release --release-version <version>`

### Stable Support Commands

- `ax list`
- `ax run <workflow-id>`
- `ax resume <trace-id>`
- `ax trace [trace-id]`
- `ax discuss "<topic>"`
- `ax agent list`
- `ax review analyze <paths...>`
- `ax policy list`
- `ax doctor`
- `ax status`
- `ax config show`

### Legacy Compatibility

- `ax guard ...` still works as an alias for `ax policy ...`

---

## Built-in stable agents

The current stable built-in agent catalog is:

- `architect`
- `quality`
- `bug-hunter`
- `release-manager`

Broader persona-style agents should be treated as future or registry-defined extensions unless they are explicitly added to the stable catalog.

---

## What Teams Use AX Trust For

### 1. Trusted Workflow Execution

Use AX Trust when teams want software delivery workflows to remain:

- constrained
- traceable
- resumable
- reviewable
- governable

### 2. Debugging and Review

High-value entry points include:

- `ax review analyze <paths...>`
- `ax audit --scope <path-or-area>`
- `ax trace analyze <trace-id>`
- `ax discuss "<topic>"`

This is where teams often use AX Trust to find, explain, and verify issues through a governed runtime rather than a single unconstrained agent session.

### 3. Governed Extension

Use bridges and skills when AX Trust needs to connect to internal tools, commands, services, or team-specific capability packaging.

These surfaces matter, but they stay under the same trust model instead of becoming a separate product story.

---

## CLI Examples

```bash
# Workflow-first
ax ship --scope packages/cli
ax architect --request "Add SSO for enterprise customers"
ax audit --scope packages/shared-runtime
ax qa --target monitor --url https://localhost:3000
ax release --release-version 14.0.1

# Stable support
ax list
ax run <workflow-id>
ax resume <trace-id>
ax trace
ax trace analyze <trace-id>
ax discuss "REST vs GraphQL for mobile app"
ax agent list
ax review analyze src/ --focus security
ax policy list
```

Advanced surfaces still available in the CLI include `bridge`, `skill`, `monitor`, `call`, `iterate`, `mcp`, `feedback`, `history`, `cleanup`, `scaffold`, `memory`, and `semantic`.

---

## Trust Core

AX Trust is built around a trust core that constrains and explains runtime behavior:

- contracts define valid workflow, bridge, skill, and policy shapes
- domains and workflow specs encode the intended operating model
- invariants protect checkpoint integrity and execution replay safety
- guards enforce step-level rules during execution
- governance policies turn those constraints into operator-facing controls and trace evidence

`Compliance` is treated as an outcome of this trust core, not as the product's top-level component name.

---

## MCP Surface

`ax setup` generates an MCP server config that points clients at:

```json
{
  "command": "ax",
  "args": ["mcp", "serve"]
}
```

The runtime exposes a larger MCP tool surface than the default AX Trust surface. The most important stable tool families are:

- workflow: `workflow_run`, `workflow_list`, `workflow_describe`
- trace: `trace_get`, `trace_list`, `trace_analyze`, `trace_by_session`, `trace_tree`
- agent: `agent_get`, `agent_list`, `agent_run`, `agent_recommend`
- discussion: `discuss_run`, `discuss_quick`, `discuss_recursive`
- review: `review_analyze`, `review_list`
- policy / guard runtime: `guard_check`, `guard_list`, `guard_apply`
- session: `session_create`, `session_get`, `session_list`, `session_join`, `session_leave`, `session_complete`, `session_fail`

`ax setup` writes these stable families into the generated project-local `.automatosx/mcp.json` by default.

Advanced MCP helpers remain implemented for operator use, but they are no longer the default onboarding story.

---

## Current Product Boundaries

AX Trust is not currently positioning itself as:

- a generic workflow marketplace
- a broad persona marketplace
- a generic bag of MCP helper tools
- a design-generation-first product
- a pure legal or GRC platform

`ax bridge` and `ax skill` remain important extension surfaces, but v15 treats them as advanced local-first surfaces. Local paths are the supported default. Remote bridge install and remote skill import are explicitly out of scope for the stable v15 story.

`ax monitor` remains available as an advanced local operator dashboard. It is not part of the default onboarding or headline AX Trust surface in v15.

---

## Provider Installation

Install at least one provider CLI:

- Claude Code: `claude`
- Gemini CLI: `gemini`
- Codex CLI: `codex`
- ax-grok: `ax-grok`

Then run:

```bash
ax doctor
```

---

## Product Docs

Current product-direction docs:

- [AX Trust overview](./docs/ax-trust-overview.md)
- [AX Trust product definition PRD](./automatosx/prd/ax-trust-product-repositioning.md)
- [AX Trust product-definition ADR](./automatosx/adr/0003-ax-trust-product-family-and-cli-policy-surface.md)
- [v15 product scope](./automatosx/prd/v15-product-scope-and-surface-contraction.md)
- [v15 ADR](./automatosx/adr/0002-v15-product-boundary.md)
- [v15 surface deprecation matrix](./docs/v15-surface-deprecation-matrix.md)
- [v15 surface registry](./automatosx/product-surface/v15-surface-registry.json)

These documents define the current AX Trust direction together with the older v15 product-boundary work.
