# Docs Accuracy Checklist

Use this before publishing docs updates.

1) Version: matches `package.json` (`name`/`version`), update in landing/guide headers.
2) Commands: every listed command exists in `src/cli/commands/` or `src/cli/index.ts` examples.
3) Routing: reflects current router behavior (`priority + health/fallback`; no policy/free-tier/workload scoring).
4) Providers: align with supported set in code; note any disabled/experimental items.
5) Features: no references to removed capabilities (policy routing, free-tier prioritization, provider trace metrics).
6) Paths: examples use `.automatosx` workspace and pnpm-first install.
7) Tests/metrics: only cite counts that can be derived locally (e.g., `find tests -name '*.test.ts'`).
8) Links: run a quick link check or spot-check key cross-links after edits.
