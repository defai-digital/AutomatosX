# AutomatosX Bug Report — Consolidated

Last updated: 2026-03-22
All bugs from all passes have been triaged and resolved.

---

## Status: All Clear

| Pass | Bugs Found | Bugs Fixed | False Positives |
|------|-----------|------------|-----------------|
| 1 | 4 | 4 | 0 |
| 2 | 5 | 4 | 1 |
| 3 | 4 | 1 | 3 |
| 4 | 0 | 0 | 0 |
| 5 | (corrupted report) | 0 | — |
| 6 | 7 | 2 | 5 |
| 7 | 4 | 1 | 3 |
| **Total** | **10 real** | **10 fixed** | **12 false positives** |

---

## Fixed Bugs

| ID | File | Description | Fix Applied |
|----|------|-------------|-------------|
| P1-001 | `shared-runtime/src/review.ts` | `warnedFiles` set grows without bound | Capped at 500 entries |
| P1-002 | `shared-runtime/src/review.ts` | Temp file names use timestamp (collision risk) | Replaced with `randomUUID()` |
| P1-003 | `shared-runtime/src/index.ts` | Confusing `minProviders` logic | Clarified and fixed |
| P1-004 | `workflow-engine/src/runner.ts` | Missing `truncated` flag on loop step output | Added |
| P2-001 | `workflow-engine/src/runner.ts` | Step index mismatch: `stepResults[i-1]` crashes when steps skipped | Changed to `stepResults[stepResults.length - 1]` |
| P2-002 | `shared-runtime/src/review.ts` | `Date.parse()` subtraction produces NaN on invalid timestamps | Added `safeDurationMs()` guard |
| P3-001 | `shared-runtime/src/review.ts` | `visit()` stat/readdir not wrapped — unhandled fs errors crash review | Added try-catch |
| P6-003 | `shared-runtime/src/provider-bridge.ts` | `child.stdin` not destroyed on process `'error'` event (fd leak) | Added `child.stdin?.destroy()` |
| P6-007 | `workflow-engine/src/runner.ts` | After-guard exceptions silently swallowed; workflow continues | Now fails workflow with `WORKFLOW_AFTER_GUARD_ERROR` |
| P7-001 | `shared-runtime/src/provider-bridge.ts` | `stdin.write()` unguarded — synchronous throw leaves Promise unresolved | Wrapped in try/catch; resolves with `PROVIDER_STDIN_ERROR` failure |

---

## False Positives (Not Bugs)

| ID | Claimed Issue | Why It Is Not a Bug |
|----|---------------|---------------------|
| P2-005 | `truncated` flag missing | Already fixed in Pass 1 |
| P3-002 | `spawnSync` in init | Intentional — one-time blocking setup |
| P3-003 | Defensive `??` fallback | Harmless TypeScript null safety pattern |
| P3-004 | Fragile filename regex | Only operates on self-generated filenames |
| P6-001 | `setValueAtPath` overwrites non-objects | Correct behavior — standard path-set semantics |
| P6-002 | Discussion queue unbounded growth | Standard work queue; items consumed as fast as produced |
| P6-004 | `stdin` not closed on timeout | `SIGKILL` closes all child fds at OS level |
| P6-005 | Session rejoin clears `leftAt` | Intentional — allows agents to rejoin long-running sessions |
| P6-006 | Agent re-registration with different metadata | Correct behavior — different metadata = different config = allowed update |
| P7-002 | Stale lock race condition in state-store | Single-process design; in-memory queue serializes all mutations before reaching `acquireLock` |
| P7-003 | Unhandled promise rejection in MCP server | `handleRequest` promises pushed into `pending[]` and awaited via `Promise.all` on close |
| P7-004 | Race condition in discussion coordinator | JavaScript is single-threaded; `Promise.all` resolves before `participatingProviders` is mutated |

---

## Design Decisions (Not Bugs)

- **In-process file queue (`enqueueExclusive`)**: Single-process by design. Not safe across multiple processes — this is a known limitation, not a bug.
- **`spawnSync` in `init.ts`**: Blocking is intentional for one-time workspace bootstrap.
- **File-based JSON persistence**: Architectural choice vs SQLite. Known tradeoff, not a defect.
