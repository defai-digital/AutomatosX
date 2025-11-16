# Import Mapping Table: v7.6.1 → v8.x

**Created**: 2025-11-15
**Purpose**: Map setup.ts imports from v7.6.1 to v8.x equivalents
**File**: src/cli/commands/setup.ts (1,296 lines)

---

## Summary

| Category | v7.6.1 Imports | v8.x Status | Action Required |
|----------|----------------|-------------|-----------------|
| Third-party | 5 imports | ✅ Available | No changes needed |
| Node.js Built-ins | 4 imports | ✅ Available | No changes needed |
| Config Types | 2 imports | ⚠️ Partial Match | Update paths & exports |
| Utils | 2 imports | ❌ Missing | Create shim utilities |
| **Total** | **13 imports** | **9 available, 4 need work** | **~30-45 min** |

---

## Detailed Mapping

### 1. Third-Party Dependencies ✅

These imports work without changes (yargs, chalk already in package.json):

| v7.6.1 Import | v8.x Status | Notes |
|---------------|-------------|-------|
| `import type { CommandModule } from 'yargs'` | ✅ Available | yargs@17.7.2 in package.json |
| `import chalk from 'chalk'` | ✅ Available | chalk@5.3.0 in package.json |

**Action**: None - these work as-is

---

### 2. Node.js Built-in Modules ✅

Standard Node.js APIs, work without changes:

| v7.6.1 Import | v8.x Status | Notes |
|---------------|-------------|-------|
| `import { mkdir, writeFile, access, readdir, copyFile, rm, stat } from 'fs/promises'` | ✅ Available | Node.js built-in |
| `import { resolve, join, dirname } from 'path'` | ✅ Available | Node.js built-in |
| `import { fileURLToPath } from 'url'` | ✅ Available | Node.js built-in |
| `import { constants, existsSync } from 'fs'` | ✅ Available | Node.js built-in |

**Action**: None - these work as-is

---

### 3. Config Types ⚠️ NEEDS UPDATE

| v7.6.1 Import | v7.6.1 Path | v8.x Equivalent | v8.x Path | Action |
|---------------|-------------|-----------------|-----------|--------|
| `DEFAULT_CONFIG` | `../../types/config.js` | ❌ Not exported | - | **Create export** |
| `AutomatosXConfig` (type) | `../../types/config.js` | ✅ Exists | `../../types/Config.js` | **Update path** (capital C) |

#### Details

**v7.6.1 `DEFAULT_CONFIG` import:**
```typescript
import { DEFAULT_CONFIG } from '../../types/config.js';
```

**v8.x Reality:**
- File exists as `src/types/Config.ts` (capital C!)
- Exports `AutomatosXConfig` type ✅
- Does NOT export `DEFAULT_CONFIG` constant ❌
- Has `AutomatosXConfigSchema` Zod schema ✅

**v8.x ConfigLoader.ts (src/services/ConfigLoader.ts):**
```typescript
constructor() {
  // Initialize with default configuration
  this.defaultConfig = AutomatosXConfigSchema.parse({
    search: {},
    indexing: {},
    database: {},
    performance: {},
    logging: {},
  });
}
```

**Solution Options:**

**Option A (Recommended): Add DEFAULT_CONFIG export to Config.ts**
```typescript
// Add to src/types/Config.ts after line 216
export const DEFAULT_CONFIG: AutomatosXConfig = AutomatosXConfigSchema.parse({
  search: {},
  indexing: {},
  database: {},
  performance: {},
  logging: {},
});
```

**Option B: Import from ConfigLoader**
```typescript
// In setup.ts
import { ConfigLoader } from '../../services/ConfigLoader.js';
const configLoader = new ConfigLoader();
const DEFAULT_CONFIG = configLoader['defaultConfig']; // Access private field (hacky)
```

**Recommended: Option A** - Clean, reusable, maintains separation of concerns

---

### 4. Utilities ❌ MISSING - NEEDS CREATION

| v7.6.1 Import | v7.6.1 Path | v8.x Equivalent | v8.x Path | Action |
|---------------|-------------|-----------------|-----------|--------|
| `logger` | `../../utils/logger.js` | ❌ Does not exist | - | **Create shim** |
| `printError` | `../../utils/error-formatter.js` | ❌ Does not exist | - | **Create shim** |

#### Details

**v7.6.1 Expected Usage in setup.ts:**
```typescript
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';

// Likely usage patterns:
logger.info('Setting up project...');
logger.error('Setup failed');
printError(error);
```

**v8.x Available Utilities:**
- `src/utils/ErrorEnvelope.ts` - Structured error wrapping ✅
- `src/utils/SpinnerLogger.ts` - Ora-based spinner logging ✅
- `src/utils/StreamingLogger.ts` - Real-time streaming logs ✅
- NO simple logger.ts or error-formatter.ts ❌

**Solution: Create Shim Utilities**

**Create `src/utils/logger.ts`:**
```typescript
/**
 * Simple logger shim for setup command
 * Wraps console.log/error with color formatting
 */
import chalk from 'chalk';

export const logger = {
  info: (message: string) => console.log(chalk.blue('ℹ'), message),
  success: (message: string) => console.log(chalk.green('✓'), message),
  warn: (message: string) => console.warn(chalk.yellow('⚠'), message),
  error: (message: string) => console.error(chalk.red('✗'), message),
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  },
};
```

**Create `src/utils/error-formatter.ts`:**
```typescript
/**
 * Error formatter for CLI commands
 */
import chalk from 'chalk';
import { ErrorEnvelope } from './ErrorEnvelope.js';

export function printError(error: unknown): void {
  if (error instanceof ErrorEnvelope) {
    console.error(chalk.red.bold('Error:'), error.message);
    if (error.context) {
      console.error(chalk.gray('Context:'), error.context);
    }
    if (error.cause) {
      console.error(chalk.gray('Cause:'), error.cause);
    }
  } else if (error instanceof Error) {
    console.error(chalk.red.bold('Error:'), error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
  } else {
    console.error(chalk.red.bold('Error:'), String(error));
  }
}
```

---

## Action Plan

### Step 1: Update Config Imports (15 min)

**1.1 Add DEFAULT_CONFIG to Config.ts**
```bash
# Edit src/types/Config.ts
# Add after line 216:
```

```typescript
/**
 * Default configuration with all defaults applied
 */
export const DEFAULT_CONFIG: AutomatosXConfig = AutomatosXConfigSchema.parse({
  search: {},
  indexing: {},
  database: {},
  performance: {},
  logging: {},
});
```

**1.2 Update setup.ts imports (line 11-12)**
```typescript
// BEFORE:
import { DEFAULT_CONFIG } from '../../types/config.js';
import type { AutomatosXConfig } from '../../types/config.js';

// AFTER:
import { DEFAULT_CONFIG, type AutomatosXConfig } from '../../types/Config.js';
//                                                         ↑ capital C
```

---

### Step 2: Create Utility Shims (30 min)

**2.1 Create src/utils/logger.ts** (see full code above)

**2.2 Create src/utils/error-formatter.ts** (see full code above)

**2.3 Update setup.ts imports (line 13-14)**
```typescript
// BEFORE:
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';

// AFTER: (no changes needed, files now exist)
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
```

---

### Step 3: Verify No Other Dependencies (5 min)

**Search setup.ts for other v7.6.1-specific imports:**
```bash
grep -n "from '.*automatosx" src/cli/commands/setup.ts
```

**Expected**: Only the 4 imports we've already mapped

---

## Verification Checklist

After implementing changes:

- [ ] `DEFAULT_CONFIG` exported from `src/types/Config.ts`
- [ ] `src/utils/logger.ts` created with info, success, warn, error, debug methods
- [ ] `src/utils/error-formatter.ts` created with printError function
- [ ] All imports in `src/cli/commands/setup.ts` resolve correctly
- [ ] TypeScript compilation passes: `pnpm run build:typescript`
- [ ] No import errors when importing setup.ts

---

## Import Summary Table

### Final Import List for setup.ts (v8.x)

```typescript
// Third-party (unchanged)
import type { CommandModule } from 'yargs';
import chalk from 'chalk';

// Node.js built-ins (unchanged)
import { mkdir, writeFile, access, readdir, copyFile, rm, stat } from 'fs/promises';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { constants, existsSync } from 'fs';

// AutomatosX types (UPDATED PATH - capital C)
import { DEFAULT_CONFIG, type AutomatosXConfig } from '../../types/Config.js';

// AutomatosX utils (NEW - created shims)
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
```

---

## Time Estimates

| Task | Time | Complexity |
|------|------|------------|
| Add DEFAULT_CONFIG export | 5 min | Low |
| Update Config import path | 2 min | Trivial |
| Create logger.ts shim | 15 min | Low |
| Create error-formatter.ts shim | 10 min | Low |
| Verify imports resolve | 5 min | Low |
| Test TypeScript compilation | 5 min | Low |
| **Total** | **42 min** | **Low-Medium** |

---

## Risk Assessment

### Low Risk
- ✅ Third-party deps already in package.json
- ✅ Node.js built-ins always available
- ✅ AutomatosXConfig type exists in v8.x

### Medium Risk
- ⚠️ DEFAULT_CONFIG needs new export (minor breaking change if others use it)
  - **Mitigation**: Check if ConfigLoader should also use this export
- ⚠️ Logger shim is simple - may not match v7.6.1 logger API exactly
  - **Mitigation**: Scan setup.ts for logger usage patterns first

### No Risk
- ✅ Creating new utils files doesn't break existing code
- ✅ Path changes are localized to setup.ts

---

## Next Steps

After completing import mapping:

1. **Day 2 Remaining**: Implement import updates (Tasks 1.1.3-1.1.4)
2. **Day 3**: Fix TypeScript compilation errors
3. **Day 4**: Register command in CLI, test end-to-end

---

**Mapping Complete**: 2025-11-15
**Ready for Implementation**: Yes ✅
**Estimated Implementation Time**: 42 minutes
