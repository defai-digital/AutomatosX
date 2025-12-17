# automatosx - Quick Reference

**Type:** application | **Lang:** TypeScript | **Ver:**  v13.0.0
**Stack:** Vitest, ESM, TypeScript

Contract-first monorepo with AI-safe governance

---

## 🎯 Critical Rules

1. **ESM Imports:** Always use `.js` extension: `import { x } from './y.js'`
2. **Types:** Explicit return types required on all functions
3. **Testing:** 80%+ coverage, test error paths
4. **Modules:** Use `import/export` (not `require/module.exports`)
5. **File Organization:** Follow standardized output paths (see below)

---

## 📁 Project File Organization

### Standard Output Paths

All AI-generated and project artifacts must follow this structure:

```
automatosx/
├── PRD/              # Product Requirement Documents
│   ├── features/     # Feature specifications
│   ├── api/          # API documentation
│   └── archive/      # Old/deprecated PRDs
├── REPORT/           # Project reports and analysis
│   ├── status/       # Status reports
│   ├── plans/        # Implementation plans
│   ├── analysis/     # Code analysis reports
│   └── metrics/      # Performance and quality metrics
└── tmp/              # Temporary files and drafts
    ├── logs/         # Debug and execution logs
    ├── cache/        # Cached data
    └── scratch/      # Temporary work files
```

### Path Usage Guidelines

**PRD (Product Requirement Documents):**
- **Path:** `./automatosx/PRD/`
- **Purpose:** Feature specs, requirements, architecture decisions
- **Naming:** `YYYY-MM-DD-feature-name.md` or `feature-name-v1.md`
- **Example:**
  ```bash
  automatosx/PRD/features/2025-11-20-mcp-integration.md
  automatosx/PRD/api/rest-api-spec.md
  ```

**REPORT (Plans & Status):**
- **Path:** `./automatosx/REPORT/`
- **Purpose:** Implementation plans, status reports, analysis
- **Naming:** `YYYY-MM-DD-report-type.md`
- **Example:**
  ```bash
  automatosx/REPORT/status/2025-11-20-weekly-status.md
  automatosx/REPORT/plans/authentication-implementation-plan.md
  automatosx/REPORT/analysis/code-quality-report.md
  ```

**tmp (Temporary Files):**
- **Path:** `./automatosx/tmp/`
- **Purpose:** Logs, cache, scratch work, debug output
- **Auto-cleanup:** Files older than 7 days can be deleted
- **Example:**
  ```bash
  automatosx/tmp/logs/ai-session-2025-11-20.log
  automatosx/tmp/cache/api-response-cache.json
  automatosx/tmp/scratch/debugging-notes.md
  ```

### File Naming Conventions

1. **Use kebab-case:** `feature-name.md` (not `Feature_Name.md`)
2. **Include dates:** `YYYY-MM-DD-` prefix for time-sensitive docs
3. **Be descriptive:** `user-auth-flow.md` (not `flow.md`)
4. **Version when needed:** `api-spec-v2.md`

### .gitignore Rules

```gitignore
# Temporary files (not tracked)
automatosx/tmp/

# Keep structure but ignore content
automatosx/PRD/.gitkeep
automatosx/REPORT/.gitkeep

# Track important PRDs and reports
!automatosx/PRD/**/*.md
!automatosx/REPORT/**/*.md
```

---

## 📋 Project Overview

**PM:** pnpm | **Module:** ESM


**Directories:**
- `tests/` - Tests

---

## 🔧 Code Patterns
### TypeScript

✅ **DO:**
```typescript
// Explicit types
function process(x: string): Promise<Result> { }

// ESM imports with .js extension
import { foo } from './bar.js';
```

❌ **DON'T:**
```typescript
// No any types
function process(x: any) { }  // ❌

// Missing .js extension
import { foo } from './bar';  // ❌
```

---

## 🔄 Workflow
**Before:**
- Read files to understand implementation
- Search for related patterns
- Review tests for expected behavior

**Changes:**
- Edit existing files (never recreate)
- Keep changes focused and atomic
- Preserve code style
- Update tests when changing functionality

**After:**
1. Lint: `eslint .`
2. Test: `vitest run`
3. Build: `pnpm -r build`

**Quick Commands:**
```bash
pnpm test    # Run tests
pnpm build   # Production build
```

---

## 🐛 Troubleshooting

### "Module not found" errors

**Solution:** Add `.js` extension to imports (ESM requirement)

```typescript
// ✅ Correct
import { x } from './y.js';

// ❌ Wrong
import { x } from './y';  // Missing .js
```

### Tests fail locally but pass in CI

**Solution:** Check Node version, clear node_modules, check environment-specific code

### TypeScript compilation errors

**Solution:** Check `tsconfig.json` settings, ensure all types are imported, verify `moduleResolution`

---

## 💡 Development Tips
- ESM requires .js extension in imports even for TypeScript files
- TypeScript strict mode is enabled - null checks required
- Monorepo: use pnpm --filter <pkg> to target specific packages
- Tests are in tests/ directory
- Run single test: pnpm test -- path/to/test.ts