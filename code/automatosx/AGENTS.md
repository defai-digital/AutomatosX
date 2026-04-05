# automatosx Agent Instructions

This repository is configured for AutomatosX v14 and is being repositioned as **AX Trust** — the trusted execution and governance layer within the AutomatosX product family. See [docs/ax-trust-overview.md](docs/ax-trust-overview.md) for the full product positioning.

Workspace output rules:
- Store temporary files, generated reports, and project status reports in automatosx/tmp/.
- Store PRDs in automatosx/prd/.
- Store ADRs in automatosx/adr/.
- Store product surface registries in automatosx/product-surface/.

Documentation placement:
- Keep cross-package architecture, migration, governance, and product-boundary notes in docs/.
- Do not recreate repo-level notes under packages/cli/docs.

Default entry paths:
- ax setup
- ax ship --scope <area>
- ax architect --request "<requirement>"
- ax audit --scope <path-or-area>
- ax qa --target <service-or-feature> --url <url>
- ax release --release-version <version>

Stable support commands:
- ax doctor
- ax status
- ax agent list
- ax review analyze <paths...>
- ax policy list
- ax config show
- ax resume <trace-id>
- ax list
- ax trace [trace-id]
- ax trace analyze <trace-id>
- ax trace by-session <session-id>
- ax discuss "<topic>"

Advanced commands:
- ax cleanup
- ax history
- ax call "summarize this diff"
- ax call --autonomous --intent analysis "assess release risk"
- ax iterate run <workflow-id>
- ax ability list
- ax feedback overview
- ax bridge list
- ax skill list
- ax monitor
- ax mcp tools
- ax mcp serve
- ax session list
- ax governance

Retained high-value commands:
- ax trace [trace-id]
- ax discuss "<topic>"

Current product-boundary references:
- docs/ax-trust-overview.md
- automatosx/prd/ax-trust-product-repositioning.md
- automatosx/adr/0003-ax-trust-product-family-and-cli-policy-surface.md
- automatosx/prd/v15-product-scope-and-surface-contraction.md
- automatosx/adr/0002-v15-product-boundary.md
- automatosx/product-surface/v15-surface-registry.json
- docs/v15-surface-deprecation-matrix.md
- docs/README.md

Project instruction and context files:
- AGENTS.md
- .automatosx/config.json
- .automatosx/context/conventions.md
- .automatosx/context/rules.md
- .automatosx/mcp.json
