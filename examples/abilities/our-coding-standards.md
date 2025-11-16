# Our Coding Standards - AutomatosX v5

> Project-specific coding standards for AutomatosX

## TypeScript Standards

**Strict mode enabled:**

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true
}
```

**Type annotations:**

```typescript
// ✅ Good: Explicit types for public APIs
export function loadProfile(name: string): Promise<AgentProfile> { }

// ❌ Bad: Any types
function process(data: any) { }  // Never use any!
```

**Error handling:**

```typescript
// ✅ Good: Typed errors from utils/errors.ts
import { AgentValidationError, PathError } from '../utils/errors.js';

if (!profile.name) {
  throw new AgentValidationError('Missing required field: name');
}

// Include error context
try {
  await executeTask();
} catch (error) {
  logger.error('Task execution failed', {
    task: taskName,
    agent: agentName,
    error: (error as Error).message
  });
  throw error;
}
```

**Module system (ESM with .js extensions):**

```typescript
// ✅ Good: .js extension in imports (required for ESM)
import { PathResolver } from '../core/path-resolver.js';
import type { AgentProfile } from '../types/agent.js';

// ❌ Bad: No extension
import { PathResolver } from '../core/path-resolver';
```

## Code Quality Standards

**Function size (<50 lines):**

```typescript
// ✅ Good: Small, focused function
private buildPrompt(context: ExecutionContext): string {
  let prompt = '';
  if (context.abilities) {
    prompt += `# Your Abilities\n\n${context.abilities}\n\n`;
  }
  if (context.agent.stages) {
    prompt += this.buildStagesSection(context.agent.stages);
  }
  prompt += `# Task\n\n${context.task}`;
  return prompt;
}
```

**Naming conventions:**

```typescript
// ✅ Good: Descriptive names
const profilePath = join(profilesDir, `${name}.yaml`);
async function resolveAgentName(input: string): Promise<string> { }

// ✅ Good: PascalCase for classes
export class PathResolver { }
export class MemoryManager { }

// ❌ Bad: Abbreviations or vague names
const p = join(dir, `${n}.yaml`);
export class PM { }
```

**JSDoc for public APIs:**

```typescript
/**
 * Load agent profile from YAML file
 *
 * @param name - Agent name (e.g., "backend", "quality")
 * @returns Validated AgentProfile
 * @throws AgentNotFoundError if profile doesn't exist
 * @throws AgentValidationError if profile is invalid
 */
async loadProfile(name: string): Promise<AgentProfile> { }
```

## Security Standards

**Always use PathResolver:**

```typescript
// ✅ Good: Use PathResolver for all file access
import { PathResolver } from '../core/path-resolver.js';

const resolver = new PathResolver({ projectRoot });
const safePath = await resolver.resolve(userInput);

// ❌ Bad: Direct path manipulation
const path = join(projectRoot, userInput);  // Unsafe!
```

**Input sanitization:**

```typescript
// ✅ Good: Sanitize before using in file system
const agentDirName = agentName
  .replace(/[^a-zA-Z0-9-]/g, '-')
  .toLowerCase();

// ✅ Good: File size limits to prevent DoS
if (content.length > 100 * 1024) {
  throw new AgentValidationError('Profile file too large (max 100KB)');
}
```

**Restrictive permissions:**

```typescript
// ✅ Good: Restrict workspace permissions (Unix)
if (process.platform !== 'win32') {
  await chmod(agentWorkspace, 0o700);  // Owner only
}
```

## Testing Standards

**Structure with Vitest:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('PathResolver', () => {
  let resolver: PathResolver;

  beforeEach(() => {
    resolver = new PathResolver({ projectRoot: '/test' });
  });

  it('should resolve relative paths', async () => {
    const result = await resolver.resolve('./file.txt');
    expect(result).toBe('/test/file.txt');
  });

  it('should reject path traversal', async () => {
    await expect(
      resolver.resolve('../../../etc/passwd')
    ).rejects.toThrow(PathError);
  });
});
```

**Coverage targets:**

- Overall: 70%+ (currently 85%)
- Core modules: 85%+
- CLI commands: 70%+
- Utils: 90%+

## Logging Standards

**Use structured logging:**

```typescript
import { logger } from '../utils/logger.js';

// ✅ Good: Structured logging with context
logger.info('Profile loaded', {
  name: profileName,
  path: profilePath
});

logger.error('Execution failed', {
  agent: agentName,
  task: taskSummary,
  error: (error as Error).message
});

// ❌ Bad: Console.log
console.log('Profile loaded');
```

**Log levels:**

- **debug:** Development details
- **info:** Normal operations
- **warn:** Recoverable issues
- **error:** Failures requiring attention

## Performance Standards

**Lazy loading:**

```typescript
// ✅ Good: Lazy load heavy dependencies
async executeTask() {
  const { spawn } = await import('child_process');
  // ...
}
```

**Caching:**

```typescript
// ✅ Good: Cache profiles with TTL
this.cache = new TTLCache<AgentProfile>({
  maxEntries: 20,
  ttl: 300000,        // 5 minutes
  cleanupInterval: 60000
});
```

**Bundle size target:** <250KB (currently 381KB)

## Git Commit Standards

**Conventional Commits format:** `type(scope): message`

```bash
# Types
feat(agents): add stage injection to executor
fix(memory): resolve vector search timeout
docs(readme): update installation instructions
test(router): add retry logic tests
refactor(cli): simplify command parsing
perf(cache): optimize TTL cleanup interval
```

**Commit message structure:**

```bash
# ✅ Good: Clear, specific
feat(stages): inject workflow stages into prompt

- Add Stage and Personality interfaces to types
- Update ProfileLoader to parse stages from YAML
- Modify Executor to include stages in prompt

# ❌ Bad: Vague
fix: bug fix
update: changes
```

---

**Last Updated:** 2025-10-10
**For:** AutomatosX v5.0+
