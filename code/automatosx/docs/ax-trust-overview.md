# AX Trust Overview

`AutomatosX` is the product family brand.

This repository now positions its core product as `AX Trust` (`ax-trust`), the trusted runtime and governance layer for AI-assisted software delivery.

Formal planning documents:

- [AX Trust product definition PRD](../automatosx/prd/ax-trust-product-repositioning.md)
- [AX Trust product-definition ADR](../automatosx/adr/0003-ax-trust-product-family-and-cli-policy-surface.md)

## Product Role

AX Trust is the execution layer that makes AI engineering activity:

- constrained
- traceable
- resumable
- reviewable
- governable

It is not a generic workflow marketplace or a broad AI helper bundle.

## Product Components

AX Trust is organized into six external-facing components:

- `Workflows`
- `Agents`
- `Bridges`
- `Skills`
- `Dashboards`
- `Trust Core`

## Trust Core

`Trust Core` is the foundation that turns AX Trust into a trustworthy execution system.

It includes:

- `Contracts`
- `Domains`
- `Workflow Specs`
- `Invariants`
- `Guards`
- `Governance Policies`

`Compliance` is treated as an outcome of this trust core, not as the product's top-level component name.

## CLI Naming

The primary CLI remains `ax`.

For trust-policy operations, the canonical command is:

- `ax policy`

The previous command remains supported for compatibility:

- `ax guard` -> legacy alias for `ax policy`

This keeps existing scripts working while moving the external product language toward policy- and trust-oriented terminology.

## Current Positioning

The current external positioning for AX Trust is:

`AX Trust is the trusted runtime and governance layer for AI software delivery.`

That positioning is implemented through:

- workflow execution
- agent routing and discussion
- review and debugging loops
- governed bridge and skill execution
- dashboard and trace visibility
- policy-enforced runtime behavior
