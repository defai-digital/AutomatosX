# eslint-plugin-automatosx

ESLint rules for AutomatosX to prevent timer leaks, memory leaks, and other common bugs.

## Installation

```bash
npm install --save-dev eslint-plugin-automatosx
```

Or link locally for development:

```bash
cd tools/eslint-plugin-automatosx
npm link
cd ../..
npm link eslint-plugin-automatosx
```

## Usage

### ESLint Flat Config (v9+)

For projects using ESLint 9+ flat config (`eslint.config.js`):

```javascript
// eslint.config.js
import automatosxPlugin from './tools/eslint-plugin-automatosx/lib/index.js';

export default [
  {
    files: ['src/**/*.ts'],
    plugins: {
      automatosx: automatosxPlugin,
    },
    rules: {
      'automatosx/no-interval-without-unref': 'warn',
      'automatosx/eventemitter-requires-destroy': 'warn',
      'automatosx/timeout-must-clear-on-error': 'off',
    },
  },
];
```

### Legacy Config (.eslintrc)

For projects using the legacy ESLint configuration:

```json
{
  "plugins": ["automatosx"],
  "extends": ["plugin:automatosx/recommended"]
}
```

Or configure individual rules:

```json
{
  "plugins": ["automatosx"],
  "rules": {
    "automatosx/no-interval-without-unref": "error",
    "automatosx/eventemitter-requires-destroy": "error",
    "automatosx/timeout-must-clear-on-error": "warn"
  }
}
```

### AutomatosX Integration

The plugin is pre-integrated in AutomatosX. The rules are configured in `eslint.config.js`:

```javascript
// Already configured in AutomatosX:
'automatosx/no-interval-without-unref': 'warn',
'automatosx/eventemitter-requires-destroy': 'warn',
'automatosx/timeout-must-clear-on-error': 'off',
```

Run linting to see timer/resource issues:

```bash
npm run lint
```

## Rules

### `automatosx/no-interval-without-unref`

Disallow `setInterval()` without `.unref()`.

**Why:** `setInterval()` without `.unref()` prevents Node.js from exiting gracefully, causing processes to hang and tests to timeout.

**Bad:**
```javascript
setInterval(() => checkHealth(), 30000);
```

**Good:**
```javascript
// Option 1: Use createSafeInterval (recommended)
import { createSafeInterval } from '@/shared/utils';
createSafeInterval(() => checkHealth(), 30000);

// Option 2: Call .unref() manually
const interval = setInterval(() => checkHealth(), 30000);
if (interval.unref) interval.unref();
```

**Options:**
- `allowWithUnref` (boolean, default: `true`): Allow `setInterval` if followed by `.unref()`

### `automatosx/eventemitter-requires-destroy`

Require `destroy()` method in classes extending `EventEmitter`.

**Why:** EventEmitter instances that register listeners need a `destroy()` method that calls `removeAllListeners()` to prevent memory leaks.

**Bad:**
```javascript
class MyService extends EventEmitter {
  constructor() {
    super();
    // No destroy method!
  }
}
```

**Good:**
```javascript
// Option 1: Extend DisposableEventEmitter (recommended)
import { DisposableEventEmitter } from '@/shared/utils';

class MyService extends DisposableEventEmitter {
  protected onDestroy(): void {
    // Custom cleanup
  }
}

// Option 2: Add destroy() manually
class MyService extends EventEmitter {
  destroy(): void {
    this.removeAllListeners();
  }
}
```

**Options:**
- `baseClasses` (array, default: `['EventEmitter', 'DisposableEventEmitter']`): Base class names to check
- `allowAbstract` (boolean, default: `true`): Allow abstract classes without `destroy()`

### `automatosx/timeout-must-clear-on-error`

Require `clearTimeout()` in both success and error paths of promise timeouts.

**Why:** If a promise rejects before the timeout fires, but the timeout is not cleared, it will fire later and potentially cause unexpected behavior or resource leaks.

**Bad:**
```javascript
async function fetchWithTimeout(url) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  const result = await Promise.race([fetch(url), timeoutPromise]);
  clearTimeout(timeoutId); // Only cleared on success!
  return result;
}
```

**Good:**
```javascript
// Option 1: Use withTimeout utility (recommended)
import { withTimeout } from '@/shared/utils';

async function fetchWithTimeout(url) {
  return withTimeout(fetch(url), 5000);
}

// Option 2: Use try/finally
async function fetchWithTimeout(url) {
  let timeoutId;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    return await Promise.race([fetch(url), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId); // Cleared in both paths!
  }
}
```

## Configurations

### `plugin:automatosx/recommended`

Enables all rules with sensible defaults:
- `no-interval-without-unref`: error
- `eventemitter-requires-destroy`: error
- `timeout-must-clear-on-error`: warn

### `plugin:automatosx/strict`

Stricter configuration:
- All rules as errors
- `allowWithUnref: false` (always require `createSafeInterval`)
- `allowAbstract: false` (require `destroy()` even on abstract classes)

### `plugin:automatosx/lenient`

Lenient configuration for gradual adoption:
- All rules as warnings
- `timeout-must-clear-on-error`: off

## License

MIT
