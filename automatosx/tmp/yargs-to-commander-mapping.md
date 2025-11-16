# Yargs → Commander.js Conversion Guide

**Purpose**: Convert v7.6.1 setup.ts from yargs to Commander.js (v8.x standard)
**Date**: 2025-11-15

---

## API Mapping Table

| Yargs API | Commander.js API | Notes |
|-----------|------------------|-------|
| `command: 'name [arg]'` | `.command('name [arg]')` | Identical syntax |
| `describe: 'text'` | `.description('text')` | Different method name |
| `.builder(yargs => yargs.option(...))` | `.option(...)` | Chain `.option()` directly |
| `.positional('name', {...})` | In `.command()` string | Positionals defined in command string |
| `.option('name', {...})` | `.option('-n, --name <value>', 'desc', default)` | Different syntax |
| `.handler(async (argv) => {})` | `.action(async (options, command) => {})` | Different callback signature |
| `argv.name` | `options.name` | First parameter of `.action()` |
| `yargs` context object | `command` object | Second parameter of `.action()` |

---

## v7.6.1 setup.ts Structure (Yargs)

```typescript
export const setupCommand: CommandModule<Record<string, unknown>, SetupOptions> = {
  command: 'setup [path]',
  describe: 'Set up AutomatosX in current or specified directory',

  builder: (yargs) => {
    return yargs
      .positional('path', {
        describe: 'Project directory (defaults to current directory)',
        type: 'string',
        default: '.'
      })
      .option('force', {
        alias: 'f',
        describe: 'Force setup even if .automatosx already exists',
        type: 'boolean',
        default: false
      })
      .option('spec-kit', {
        describe: 'Automatically initialize GitHub Spec-Kit for spec-driven development',
        type: 'boolean'
      })
      .option('skip-spec-kit', {
        describe: 'Skip Spec-Kit initialization (useful for CI/CD)',
        type: 'boolean'
      });
  },

  handler: async (argv) => {
    const projectDir = resolve(argv.path || '.');
    const automatosxDir = join(projectDir, '.automatosx');
    // ... rest of handler logic
  }
};
```

---

## v8.x setup.ts Structure (Commander.js)

```typescript
/**
 * Create setup command for Commander.js
 */
export function createSetupCommand(): Command {
  return new Command('setup')
    .description('Set up AutomatosX in current or specified directory')
    .argument('[path]', 'Project directory (defaults to current directory)', '.')
    .option('-f, --force', 'Force setup even if .automatosx already exists')
    .option('--spec-kit', 'Automatically initialize GitHub Spec-Kit for spec-driven development')
    .option('--skip-spec-kit', 'Skip Spec-Kit initialization (useful for CI/CD)')
    .action(async (path, options) => {
      const projectDir = resolve(path || '.');
      const automatosxDir = join(projectDir, '.automatosx');
      // ... rest of handler logic (same as v7.6.1)
    });
}
```

---

## Key Differences

### 1. Module Export Pattern

**Yargs (v7.6.1)**:
```typescript
export const setupCommand: CommandModule<...> = {
  command: 'setup [path]',
  describe: '...',
  builder: (yargs) => { ... },
  handler: async (argv) => { ... }
};
```

**Commander.js (v8.x)**:
```typescript
export function createSetupCommand(): Command {
  return new Command('setup')
    .description('...')
    .argument('[path]', '...', '.')
    .option('...')
    .action(async (path, options) => { ... });
}
```

---

### 2. Positional Arguments

**Yargs (v7.6.1)**:
```typescript
command: 'setup [path]'  // Define in command string

builder: (yargs) => {
  return yargs.positional('path', {  // Configure separately
    describe: 'Project directory',
    type: 'string',
    default: '.'
  });
}

handler: async (argv) => {
  const path = argv.path;  // Access via argv object
}
```

**Commander.js (v8.x)**:
```typescript
.command('setup')
.argument('[path]', 'Project directory', '.')  // All-in-one definition
//        ^^^^^^    ^^^^^^^^^^^^^^^^^^^  ^^^
//        name      description          default

.action(async (path, options) => {
  // path is first parameter (positional argument)
  const projectDir = path || '.';
})
```

---

### 3. Options

**Yargs (v7.6.1)**:
```typescript
.option('force', {
  alias: 'f',
  describe: 'Force setup even if .automatosx already exists',
  type: 'boolean',
  default: false
})

// Access: argv.force
```

**Commander.js (v8.x)**:
```typescript
.option('-f, --force', 'Force setup even if .automatosx already exists')
//      ^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//      short, long    description
//
// Boolean options have implicit default: false
// No value needed (presence = true)

// Access: options.force
```

**Option with value:**
```typescript
// Yargs:
.option('provider', {
  describe: 'AI provider to use',
  type: 'string',
  default: 'claude'
})

// Commander.js:
.option('-p, --provider <name>', 'AI provider to use', 'claude')
//                      ^^^^^^                          ^^^^^^^
//                      required value                  default
```

---

### 4. Action Handler

**Yargs (v7.6.1)**:
```typescript
handler: async (argv) => {
  const path = argv.path;
  const force = argv.force;
  const specKit = argv.specKit;  // Note: camelCase
  const skipSpecKit = argv.skipSpecKit;
  // ...
}
```

**Commander.js (v8.x)**:
```typescript
.action(async (path, options, command) => {
  // path = first positional argument
  // options = all named options as object
  // command = Command object (rarely needed)

  const projectDir = resolve(path || '.');
  const force = options.force;
  const specKit = options.specKit;  // Commander auto-converts to camelCase
  const skipSpecKit = options.skipSpecKit;
  // ...
})
```

**Multiple positional arguments:**
```typescript
.command('copy')
.argument('<source>', 'Source file')
.argument('<dest>', 'Destination file')
.action(async (source, dest, options) => {
  // source and dest are separate parameters
  console.log(`Copying ${source} to ${dest}`);
})
```

---

## Complete Conversion Example

### Before (Yargs):
```typescript
export const setupCommand: CommandModule<Record<string, unknown>, SetupOptions> = {
  command: 'setup [path]',
  describe: 'Set up AutomatosX in current or specified directory',

  builder: (yargs) => {
    return yargs
      .positional('path', {
        describe: 'Project directory (defaults to current directory)',
        type: 'string',
        default: '.'
      })
      .option('force', {
        alias: 'f',
        describe: 'Force setup even if .automatosx already exists',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    const projectDir = resolve(argv.path || '.');
    const force = argv.force;
    console.log(`Setting up in ${projectDir}, force=${force}`);
  }
};
```

### After (Commander.js):
```typescript
export function createSetupCommand(): Command {
  return new Command('setup')
    .description('Set up AutomatosX in current or specified directory')
    .argument('[path]', 'Project directory (defaults to current directory)', '.')
    .option('-f, --force', 'Force setup even if .automatosx already exists')
    .action(async (path, options) => {
      const projectDir = resolve(path || '.');
      const force = options.force;
      console.log(`Setting up in ${projectDir}, force=${force}`);
    });
}
```

---

## Conversion Checklist

For setup.ts conversion:

- [ ] **Change module pattern**
  - [ ] Remove `CommandModule` interface
  - [ ] Change `export const setupCommand = {...}` to `export function createSetupCommand()`
  - [ ] Return `new Command('setup')` instead of object literal

- [ ] **Convert command definition**
  - [ ] Keep `command: 'setup [path]'` → `.command('setup')`
  - [ ] Move `[path]` to `.argument('[path]', 'desc', 'default')`
  - [ ] Change `describe` → `.description()`

- [ ] **Convert options**
  - [ ] Change `.builder(yargs => yargs.option(...))` → Direct `.option(...)` chains
  - [ ] Format: `.option('-short, --long <value>', 'description', defaultValue)`
  - [ ] Boolean options don't need `<value>` or explicit defaults

- [ ] **Convert handler**
  - [ ] Change `handler: async (argv) =>` to `.action(async (path, options) =>`
  - [ ] Update argument access:
    - `argv.path` → `path` (first parameter)
    - `argv.force` → `options.force`
    - `argv.specKit` → `options.specKit`
    - `argv.skipSpecKit` → `options.skipSpecKit`

- [ ] **Update business logic**
  - [ ] Change all `argv.xxx` references to `options.xxx` or positional param
  - [ ] No other changes needed - business logic stays the same!

---

## Registration in src/cli/index.ts

**Add import:**
```typescript
import { createSetupCommand } from './commands/setup.js';
```

**Add command to program:**
```typescript
// After line 101 (after createConfigCommand())
program.addCommand(createSetupCommand());
```

---

## Testing Commands

```bash
# Test command help
ax setup --help

# Test default execution
ax setup

# Test with options
ax setup ./my-project --force
ax setup --spec-kit
ax setup --skip-spec-kit

# Test short options
ax setup -f
```

---

## Common Pitfalls

### 1. Boolean Options
```typescript
// ❌ WRONG:
.option('--force <value>', 'Force setup', false)

// ✅ CORRECT:
.option('--force', 'Force setup')
// Implicit: present = true, absent = false
```

### 2. Required vs Optional Arguments
```typescript
// Optional (can omit):
.argument('[path]', 'Directory')  // Square brackets

// Required (must provide):
.argument('<source>', 'Source file')  // Angle brackets
```

### 3. Action Handler Signature
```typescript
// ❌ WRONG:
.action(async (options) => {
  const path = options.path;  // path is NOT in options!
})

// ✅ CORRECT:
.action(async (path, options) => {
  // path is first parameter
  // options contains named flags
})
```

### 4. Option Name Conversion
```typescript
// Commander auto-converts kebab-case to camelCase:
.option('--skip-spec-kit', '...')

// Access as:
options.skipSpecKit  // ✅ camelCase
// NOT: options['skip-spec-kit']  // ❌
```

---

## Time Estimates

| Task | Time |
|------|------|
| Update imports | 5 min |
| Convert command definition | 10 min |
| Convert options (4 options) | 10 min |
| Convert handler signature | 5 min |
| Update argv references (~20 locations) | 20 min |
| Test and debug | 20 min |
| **Total** | **70 min (~1 hour)** |

---

**Mapping Complete**: 2025-11-15
**Ready for Conversion**: Yes ✅
