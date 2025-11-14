# fp-ts Integration Evaluation for AutomatosX v2 Code Intelligence Engine

## Executive Summary
- AutomatosX v2 currently relies on imperative error handling (342 `catch` blocks, 77 files with `null | undefined` unions, DAOs returning `T | undefined`). This leaks invariants across layers, complicates reasoning, and obscures faults that surface late in the runtime.
- Adopting `fp-ts` primitives (notably `Option`, `Either`, `TaskEither`, `pipe/flow`) would encode absence, failures, and async effects directly in the type system, aligning with our strict TypeScript posture (ADR-003) and lowering the probability of silent failures in the code-intel pipeline.
- The most leverage comes from the DAO → Service → Parser chain: DAOs publish `Option/Either`, services orchestrate via `TaskEither`, and parser/router utilities expose composable `flow`s. This keeps error contracts close to the source and enables deterministic composition of indexing/query tasks.
- Migration is feasible via staged refactors: begin with DAO surface areas (lowest blast radius), then propagate to orchestration services and parser infrastructure. Primary risks are learning curve, refactor churn, and mixed paradigms during the transition.
- Recommendation: proceed with a phased fp-ts adoption, front-loaded with training and lint guardrails, targeting a 3-sprint rollout. This keeps architecture "invisible"—enabling teams while hardening correctness for the long haul.

## Detailed Analysis

### Drivers & Expected Benefits
| Driver | Current Symptom | fp-ts Leverage |
|--------|-----------------|----------------|
| **Explicit absence handling** | `T \| undefined` surfaces from DAOs (e.g., `src/database/dao/FileDAO.ts:131`) require ad-hoc null checks across services. | Return `Option<T>` to force callers to handle `None` via `fold`, `match`, or `flatMap`. |
| **Uniform failure semantics** | Services mix thrown errors and logged warnings (e.g., nested try/catch in `src/services/TelemetryService.ts:167`). | Encode recoverable failures with `Either`/`TaskEither`, making error paths first-class. |
| **Composable async orchestration** | Promise-heavy flows (indexing, telemetry export) fan out to multiple side effects with manual transaction wiring. | Use `TaskEither` chains + `pipe/flow` to model multi-step workflows with shared context and rollback hooks. |
| **Deterministic parser routing** | `ParserRegistry.parse` throws when no parser exists, pushing exception logic up-stack (`src/parser/ParserRegistry.ts:86`). | Model parser lookup as `Either<UnsupportedFileError, ParseResult>` so consumers can branch without exceptions. |

### Integration Points

#### DAO Layer
- **Scope:** `src/database/dao/**/*.ts` (FileDAO, SymbolDAO, ChunkDAO, TelemetryDAO).
- **Pattern:** Replace `T | undefined` returns with `Option<T>`; wrap transactional mutations in `Either` to surface domain validation failures (e.g., constraint violations) rather than throwing.
- **Supporting tools:** `fp-ts/Option`, `fp-ts/Either`, helper mappers (`fromNullable`, `map`, `flatMap`).
- **Benefits:** Centralizes absence semantics, unlocks richer composition in services, and simplifies testing (`Option` can be pattern-matched without mocking thrown errors).

#### Service & Orchestration Layer
- **Scope:** `src/services/**`, `src/cache`, `src/cli/commands/**`.
- **Pattern:** Express multi-step operations (indexing, telemetry submission, query routing) as `TaskEither` pipelines. Use `pipe` to chain DAO queries, parser invocations, and cache updates while keeping rollback logic explicit.
- **Example touchpoints:** `FileService.reindexFile` (line `205`), `TelemetryService.trackEvent` (line `167`), `QueryRouter.routeQuery`.
- **Benefits:** Services expose a consistent contract (`TaskEither<ServiceError, Result>`), easing integration with CLI commands and automated retries; also enables cross-cutting policies (logging, metrics) via `mapLeft`/`tap`.

#### Parser & Analysis Layer
- **Scope:** `src/parser/**`, `ChunkingService`, `QueryFilterParser`.
- **Pattern:** Convert parser lookups and symbol extraction into composable `flow`s returning `Either`. Downstream consumers (e.g., `ChunkingService`) can remain pure by accepting `Option` inputs for optional metadata.
- **Benefits:** Eliminates exception-driven control flow when a parser is missing; easier to provide user-friendly diagnostics and fallback strategies (e.g., degrade to text search).

## Representative Before/After Examples

### 1. File Reindexing (Service ↔ DAO)
**Current (`src/services/FileService.ts:205`):**
```ts
const existingFile = this.fileDAO.findByPath(path);
if (!existingFile) {
  throw new Error(`File not found: ${path}`);
}

this.fileDAO.update(existingFile.id, { content });
```

**Proposed fp-ts style:**
```ts
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

const reindex = (path: string, content: string) =>
  pipe(
    this.fileDAO.findByPath(path),          // Option<FileRecord>
    O.fromNullable,
    E.fromOption(() => new NotFoundError({ path })),
    E.map((file) => ({
      file,
      parseResult: this.parserRegistry.parse(content, path),
      chunks: this.chunkingService.chunkFile(content, []),
    })),
    E.tap(({ file }) => E.tryCatch(
      () => this.fileDAO.update(file.id, { content }),
      (err) => new PersistenceError({ cause: err })
    ))
  );
```
The service now returns `Either<ServiceError, ReindexResult>`; callers must deal with the `NotFoundError`, improving clarity and testability.

### 2. Telemetry Event Capture (Async workflow)
**Current (`src/services/TelemetryService.ts:167`):**
```ts
try {
  const eventId = await this.dao.saveEvent(event);
  if (this.remoteEnabled && this.queue && eventId) {
    try {
      this.queue.enqueue([eventId]);
    } catch (queueError) {
      console.debug('Failed to enqueue event:', queueError);
    }
  }
} catch (error) {
  console.debug('Telemetry event failed:', error);
}
```

**Proposed fp-ts style with `TaskEither`:**
```ts
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

const trackEvent = (event: TelemetryEvent) =>
  pipe(
    TE.tryCatch(
      () => this.dao.saveEvent(event),
      (err) => new PersistenceError({ cause: err })
    ),
    TE.tap((eventId) =>
      pipe(
        TE.fromPredicate(
          () => this.remoteEnabled && !!this.queue && !!eventId,
          () => null
        ),
        TE.flatMap(() =>
          TE.tryCatch(
            () => Promise.resolve(this.queue!.enqueue([eventId!])),
            (err) => new SubmissionError({ cause: err })
          )
        ),
        TE.orElse(() => TE.right(undefined))
      )
    ),
    TE.match(
      (err) => this.logger.debug('Telemetry event failed', err),
      () => undefined
    )
  )();
```
Nested try/catch disappears, error logging is centralized, and retry logic can later compose with `RetryManager` via `TE.retrying`.

### 3. Parser Routing
**Current (`src/parser/ParserRegistry.ts:86`):**
```ts
const parser = this.getParserByPath(filePath);
if (!parser) {
  const ext = extname(filePath);
  throw new Error(`No parser registered for file extension: ${ext}`);
}
return parser.parse(content);
```

**Proposed fp-ts style with `Either` + `flow`:**
```ts
import * as E from 'fp-ts/Either';
import { flow } from 'fp-ts/function';

const parseFile = (filePath: string) =>
  flow(
    this.getParserByPath.bind(this),
    E.fromNullable(() => new UnsupportedLanguageError({ filePath })),
    E.flatMap((parser) =>
      E.tryCatch(
        () => parser.parse(content),
        (err) => new ParserExecutionError({ cause: err, filePath })
      )
    )
  )(filePath);
```
Consumers can now compose parser outcomes with downstream chunking or fallback heuristics without relying on exceptions.

## Migration Complexity & Risks
| Risk | Likelihood | Impact | Notes & Mitigation |
|------|------------|--------|--------------------|
| **Learning curve for contributors** | Medium | Medium | Provide fp-ts primers, lint rules (`eslint-plugin-fp-ts`), and cookbooks. Pair Avery/Felix with squads for initial PRs. |
| **Mixed paradigms during rollout** | High | Medium | Adopt per-module gates: once a DAO/service is converted, forbid reverting to imperative style. Track compliance via lint rule + ADR updates. |
| **Bundle size / tree-shaking** | Low | Low | `fp-ts` tree-shakes well under ESM (ADR-002). Use path imports (`import { pipe } from 'fp-ts/function'`) to avoid pulling unused code. |
| **Test churn** | Medium | Medium | Tests referencing raw promises/undefined must adapt to `Either` helpers. Mitigate with helper factories in `src/test-utils/fp.ts`. |
| **Interop with existing async utilities** | Medium | Medium | Wrap legacy promise-based helpers with `TaskEither.fromTask`. Provide adapters for `transaction` wrappers to avoid double evaluation. |

## Recommendation
Adopt fp-ts incrementally, starting with DAO and telemetry subsystems, then rolling through services and parser orchestration over ~3 sprints. This balances rigor with pragmatism: the resulting architecture keeps invariants close to data sources, improves observability (structured errors), and builds an "invisible" foundation that will scale with future agents/marketplace requirements. No-blocker risks surfaced; mitigations are manageable with training and tooling.

## Implementation Roadmap
1. **Enablement (Week 0):**
   - Publish fp-ts coding standards + examples (Avery-owned).
   - Add dependencies (`fp-ts`, `eslint-plugin-fp-ts`) and CI lint checks.
   - Run focused workshops for DAO/service owners.
2. **Phase 1 – DAO Surface (Week 1):**
   - Convert FileDAO/SymbolDAO/ChunkDAO query methods to `Option`/`Either`. Provide adapter helpers (`toOption`, `toEither`).
   - Update unit tests to expect `Option`.
   - Deliver ADR update capturing the new persistence contract.
3. **Phase 2 – Service Orchestration (Weeks 2–3):**
   - Refactor `FileService`, `TelemetryService`, `QueryRouter`, and cache services to expose `TaskEither`. Introduce shared `ServiceError` hierarchy.
   - Implement logging/metrics middleware using `TaskEither.tap`.
4. **Phase 3 – Parser & CLI Integration (Weeks 3–4):**
   - Wrap parser registry and CLI command handlers with `Either` pipelines; ensure CLI surfaces actionable messages when `Left`.
   - Update chunking/index queues to consume new APIs.
5. **Phase 4 – Hardening & Governance (Week 5):**
   - Add architecture fitness functions (lint checks + targeted tests) to prevent regression to `undefined` unions or naked `catch` blocks.
   - Measure error-rate reduction + telemetry reliability; capture in KPIs for Tony.

Success Metrics: ≥75% reduction in `undefined` return types, ≤10% of `catch` blocks remaining (only around top-level boundaries), telemetry queue failure rate <1%, and demonstrable readability improvements in code reviews.
