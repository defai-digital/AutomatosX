# ADR-011: ReScript Integration Strategy

**Status**: Accepted
**Date**: 2025-11-07
**Deciders**: Architecture Team
**Context**: Phase 0 (P0) Implementation

---

## Context and Problem Statement

AutomatosX aims to introduce ReScript for deterministic state machine implementation and rule-based task orchestration. This ADR defines the integration strategy between ReScript code and the existing TypeScript codebase, ensuring type safety, maintainability, and gradual adoption.

**Key Questions**:
1. How do we compile ReScript code and make it accessible to TypeScript?
2. How do we ensure type safety across the ReScript ↔ TypeScript boundary?
3. How do we structure the codebase to support both languages?
4. What's the adoption strategy (gradual vs all-at-once)?

---

## Decision Drivers

- **Type Safety**: Must maintain strong typing across language boundaries
- **Developer Experience**: Build process should be smooth and well-integrated
- **Gradual Adoption**: Should support incremental migration without big-bang rewrites
- **Tooling**: Must work with existing tools (TypeScript, Vitest, tsup)
- **Performance**: ReScript compilation should not slow down development builds
- **Maintainability**: Clear separation of concerns between ReScript and TypeScript code

---

## Considered Options

### Option 1: ReScript as Primary Language (Full Rewrite)
**Approach**: Rewrite entire codebase in ReScript

**Pros**:
- Full type safety benefits
- Consistent codebase
- Better performance (ReScript optimizations)

**Cons**:
- ❌ Massive effort (weeks/months)
- ❌ Disrupts ongoing development
- ❌ Loses existing TypeScript ecosystem benefits
- ❌ Steep learning curve for team

**Verdict**: ❌ Rejected - Too disruptive

### Option 2: ReScript in Separate Package (Monorepo)
**Approach**: Create `packages/rescript-core` with compiled output consumed by TypeScript

**Pros**:
- ✅ Clear separation of concerns
- ✅ Can version independently
- ✅ Doesn't disrupt TypeScript code
- ✅ Gradual adoption path
- ✅ TypeScript consumes compiled `.bs.js` files

**Cons**:
- Two build steps required
- Need to manage inter-package dependencies

**Verdict**: ✅ **SELECTED**

### Option 3: Mixed ReScript/TypeScript (Same Directory)
**Approach**: Mix `.res` and `.ts` files in same source tree

**Pros**:
- Single package
- Easy imports

**Cons**:
- ❌ Confusing directory structure
- ❌ Harder to maintain build process
- ❌ Type boundaries unclear

**Verdict**: ❌ Rejected - Poor maintainability

---

## Decision Outcome

**Chosen Option**: **Option 2 - ReScript in Separate Package (Monorepo)**

### Implementation Strategy

#### 1. Package Structure

```
automatosx-v2/
├── packages/
│   └── rescript-core/          # ReScript package
│       ├── src/
│       │   ├── Hello.res       # Example module
│       │   └── Index.res       # Package entry point
│       ├── rescript.json       # ReScript config
│       └── package.json
├── src/                        # TypeScript code
│   └── ...
└── package.json               # Root package
```

#### 2. Compilation Flow

```
ReScript Source (.res)
   ↓ (rescript compiler)
JavaScript Output (.bs.js)
   ↓ (consumed by TypeScript)
TypeScript Code (.ts)
   ↓ (tsc + tsup)
Final Distribution (.js)
```

#### 3. Build Integration

**package.json scripts**:
```json
{
  "scripts": {
    "build": "npm run build:rescript && npm run build:typescript",
    "build:rescript": "npm run build --workspace=@automatosx/rescript-core",
    "build:typescript": "tsc"
  }
}
```

**Workflow**:
1. `npm run build:rescript` - Compile ReScript to `.bs.js`
2. `npm run build:typescript` - Compile TypeScript (imports `.bs.js`)
3. TypeScript consumes ReScript via `import` statements

#### 4. Type Safety at Boundaries

**ReScript Side** (`packages/rescript-core/src/Hello.res`):
```rescript
@genType
let greet = (name: string): string => {
  `Hello, ${name}!`
}
```

**TypeScript Side** (`src/example.ts`):
```typescript
import { greet } from '@automatosx/rescript-core';

// Type-safe import via generated .d.ts files
const message: string = greet("World");
```

**Type Generation**:
- Use `@genType` decorator for exported functions
- Generates TypeScript `.d.ts` definition files
- TypeScript sees fully typed ReScript exports

#### 5. Configuration

**ReScript Config** (`packages/rescript-core/rescript.json`):
```json
{
  "name": "@automatosx/rescript-core",
  "version": "2.0.0",
  "sources": {
    "dir": "src",
    "subdirs": true
  },
  "package-specs": {
    "module": "es6",
    "in-source": true
  },
  "suffix": ".bs.js",
  "bs-dependencies": []
}
```

**Key Settings**:
- `module: "es6"` - Output ES modules for TypeScript interop
- `in-source: true` - Output `.bs.js` next to `.res` files
- `suffix: ".bs.js"` - Clear distinction from `.js` files

---

## Consequences

### Positive

1. **✅ Clear Separation**: ReScript code isolated in `packages/rescript-core`
2. **✅ Gradual Adoption**: Can add ReScript modules incrementally
3. **✅ Type Safety**: `@genType` provides TypeScript definitions
4. **✅ No Breaking Changes**: TypeScript code unaffected
5. **✅ Ecosystem Compatibility**: Can use npm packages from both languages
6. **✅ Fast Compilation**: ReScript compiles in ~17ms

### Negative

1. **⚠️ Two Build Steps**: Must run ReScript build before TypeScript
2. **⚠️ Learning Curve**: Team needs to learn ReScript syntax
3. **⚠️ Debugging**: Need source maps for both languages
4. **⚠️ Package Management**: Extra package in workspace

### Neutral

1. **Build Time**: ReScript adds ~17ms (negligible)
2. **Bundle Size**: `.bs.js` files are similar size to `.js`
3. **Tooling**: Works with existing tools (no new IDE plugins required)

---

## Adoption Strategy

### Phase 0 (Foundation) - COMPLETE ✅

**Goal**: Establish ReScript toolchain and prove interop

**Delivered**:
- ReScript 11.1.1 setup in `packages/rescript-core`
- Build pipeline integration (`build:rescript` script)
- Example modules (`Hello.res`, `Index.res`)
- Compilation verified (~17ms)

### Phase 1 (Selective Adoption) - PARTIAL ⚠️

**Goal**: Use ReScript for state machines and rule engines

**Status**: Foundation only, full integration deferred to P2/P3

**Planned Modules**:
- State machine core (`StateMachine.res`)
- Rule evaluator (`RuleEngine.res`)
- Effect handlers (`Effects.res`)
- Task orchestration (`TaskOrchestrator.res`)

**TypeScript Adapters**:
- Wrapper layer in `src/core/state-machines/`
- Exposes async JavaScript APIs
- Handles Promise/async bridging

### Phase 2 (Agent Integration) - FUTURE

**Goal**: Integrate ReScript state machines into agent orchestration

**Planned**:
- Replace AgentExecutor state logic with ReScript
- Add ReScript-based decision trees
- Implement retry/fallback logic in ReScript

---

## Implementation Notes

### Current State (as of P0/P1 completion)

**What Works**:
- ✅ ReScript compilation (17ms compile time)
- ✅ `.bs.js` output consumed by TypeScript
- ✅ Build pipeline integration
- ✅ Example modules functional

**What's Minimal**:
- ⚠️ Only 2 example modules (`Hello.res`, `Index.res`)
- ⚠️ No production use of ReScript yet
- ⚠️ No state machine implementation yet
- ⚠️ No `@genType` usage yet

**Rationale for Minimal Implementation**:
- Focus shifted to language parser expansion (Sprints 7-14)
- ReScript foundation sufficient for future work
- No user-facing feature depends on ReScript yet

### Future Work (P2/P3)

1. **Implement Core Modules**:
   - State machine with type-safe transitions
   - Rule engine for agent decision-making
   - Effect handlers for async operations

2. **Add @genType Annotations**:
   - Generate TypeScript definitions
   - Enable type-safe imports

3. **Create Adapter Layer**:
   - Bridge ReScript and TypeScript seamlessly
   - Handle async/Promise conversions

4. **Integration Testing**:
   - Test ReScript ↔ TypeScript interop
   - Verify type safety at boundaries

---

## References

- **ReScript Documentation**: https://rescript-lang.org/docs/manual/latest/introduction
- **genType Documentation**: https://github.com/rescript-association/genType
- **Implementation**: `packages/rescript-core/`
- **Build Scripts**: `package.json` (root)
- **P0 Completion Report**: `automatosx/tmp/archive/p0-reports/P0-COMPLETE-FINAL-SUMMARY.md`

---

## Related Decisions

- **ADR-013**: Parser orchestration (TypeScript-based, ReScript future)
- **ADR-014**: Zod validation (TypeScript-based, complements ReScript type safety)

---

**Status**: ✅ **Foundation Accepted and Implemented**
**Next Steps**: Complete core modules in P2/P3 when agent orchestration work begins
