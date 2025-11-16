# Our Architecture Decisions - AutomatosX v5

> Key architectural decisions and rationale for AutomatosX

## ADR-001: SQLite FTS5 Over Milvus

**Decision:** Use SQLite with FTS5 full-text search instead of Milvus

**Rationale:**

- v3.1 used Milvus (340MB bundle, complex setup)
- SQLite FTS5 offers < 1ms search performance
- Simple setup, no external services

**Impact:**

- ✅ Bundle: 340MB → 381KB (99.9% reduction)
- ✅ Fast text search (45ms → <1ms, 45x faster)
- ✅ No embedding costs (v4.11.0: removed vector search)
- ❌ Limited to single-node (acceptable for CLI tool)

## ADR-002: ESM Over CommonJS

**Decision:** Use ES Modules (ESM) for entire codebase

**Rationale:**

- Node.js 20+ has first-class ESM support
- Better tree-shaking and bundle optimization
- Modern standards compliance

**Impact:**

- ✅ Better tree-shaking (smaller bundle)
- ✅ Future-proof
- ⚠️ Requires `.js` in imports (minor inconvenience)

## ADR-003: TypeScript Strict Mode

**Decision:** Enable all strict TypeScript checks

**Configuration:**

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true
}
```

**Impact:**

- ✅ Fewer runtime errors
- ✅ Better IDE support
- ✅ Safer refactoring
- ⚠️ More initial development time (worth it)

## ADR-004: Three-Layer Security Model

**Decision:** Implement path validation, workspace access control, and input sanitization

**Layers:**

1. **Path Resolution:** All file access through PathResolver
2. **Workspace Access Control:** Shared workspaces with path validation (v5.2+)
3. **Input Validation:** Sanitize all user inputs

**Impact:**

- ✅ Prevents path traversal attacks
- ✅ Controlled workspace access with validation
- ✅ No privilege escalation
- ⚠️ Slightly more complex file operations

## ADR-005: Profile + Abilities = Agent

**Decision:** Separate agent profile (YAML) from abilities (Markdown)

**Structure:**

- Profile: YAML with metadata, systemPrompt, abilities references
- Abilities: Markdown files with domain knowledge
- Agent = Profile + loaded Abilities

**Impact:**

- ✅ Reusable abilities across agents
- ✅ Easy to add new knowledge
- ✅ Clear separation of concerns
- ✅ User can customize both independently

## ADR-006: Team-Based Configuration (v4.10.0+)

**Decision:** Agents inherit configuration from their team

**4 Built-in Teams:**

- **core:** Quality assurance (primary: claude)
- **engineering:** Software development (primary: codex)
- **business:** Product & planning (primary: gemini)
- **design:** Design & content (primary: gemini)

**Impact:**

- ✅ No configuration duplication
- ✅ Change provider for entire team at once
- ✅ Shared abilities automatically included
- ✅ Centralized orchestration settings

## ADR-007: Lazy Loading for Performance

**Decision:** Defer expensive imports until needed

**Implementation:**

- Heavy modules use dynamic import: `await import('module')`
- Core modules use static imports
- LazyLoader utility for caching

**Impact:**

- ✅ Faster CLI startup (~200ms)
- ✅ Smaller initial memory footprint
- ✅ Pay for what you use

## ADR-008: Vitest Over Jest

**Decision:** Use Vitest as testing framework

**Rationale:**

- Modern test runner with native ESM support
- Fast execution with watch mode
- Compatible with Vite ecosystem

**Impact:**

- ✅ Fast test execution (1,149 tests in ~10s)
- ✅ Native ESM support (no transform)
- ✅ Great developer experience

## ADR-009: TTL Cache for Profiles

**Decision:** Cache loaded profiles with 5-minute TTL

**Configuration:**

- TTLCache with 5-minute TTL
- Max 20 entries (LRU eviction)
- Cleanup every 60 seconds

**Impact:**

- ✅ Faster repeated executions
- ✅ Reduced file I/O
- ✅ Automatic cache invalidation
- ⚠️ 5-minute delay for profile updates (acceptable)

## ADR-010: Provider Router Pattern

**Decision:** Use Router to abstract provider selection

**Features:**

- Router manages provider selection
- Retry with exponential backoff
- Fallback to alternative providers

**Impact:**

- ✅ Provider flexibility
- ✅ Resilience to provider failures
- ✅ Easy to add new providers

---

**Last Updated:** 2025-10-10
**For:** AutomatosX v5.0+
