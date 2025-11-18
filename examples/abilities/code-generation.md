# Code Generation

Generate high-quality, production-ready code following best practices and patterns.

## Core Principles

### 1. Type Safety & Validation
- Use strong typing (TypeScript interfaces, Python type hints)
- Validate inputs before processing
- Define clear return types
- Use enums for fixed value sets

### 2. Error Handling
- Use try-catch for I/O operations
- Provide specific error messages with context
- Log errors appropriately
- Never swallow errors silently
- Return typed error objects or throw typed exceptions

### 3. Function Design
- Single responsibility per function
- Clear, descriptive names
- Document complex logic with comments
- Keep functions small (<50 lines)
- Minimize side effects

### 4. API Design
- RESTful conventions (GET/POST/PUT/DELETE)
- Consistent response formats
- Proper HTTP status codes
- Request/response validation
- API versioning when needed

### 5. Testing
- Write unit tests for business logic
- Test error cases and edge conditions
- Use descriptive test names
- Aim for >80% coverage on critical paths
- Mock external dependencies

### 6. Code Quality
- Follow project coding standards
- Use linting and formatting tools
- Write self-documenting code
- Keep complexity low (cyclomatic complexity <10)
- Remove dead code and TODOs

### 7. Security
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Never log sensitive data
- Follow principle of least privilege
- Keep dependencies updated

### 8. Performance
- Avoid N+1 queries
- Use appropriate data structures
- Cache when beneficial
- Lazy load when possible
- Profile before optimizing

## Language-Specific Patterns

### TypeScript/JavaScript
- Async/await for promises
- Optional chaining (?.) and nullish coalescing (??)
- Destructuring for cleaner code
- Use const by default, let when needed
- Avoid var

### TypeScript with Zod (Preferred for Scripts)

**IMPORTANT**: When writing JavaScript or TypeScript scripts, always use TypeScript with Zod for runtime type safety and validation.

#### Why Zod?
- Runtime type validation (catches errors TypeScript can't)
- Schema-based validation with composable schemas
- Automatic type inference (no duplicate type definitions)
- Parse, validate, and transform data in one step
- Excellent error messages for debugging

#### Installation
```bash
npm install zod
# or
pnpm add zod
```

#### Basic Usage Pattern

```typescript
import { z } from 'zod';

// ✅ Define schema (types are automatically inferred)
const UserSchema = z.object({
  id: z.number().positive(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['admin', 'user', 'guest']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type is automatically inferred from schema
type User = z.infer<typeof UserSchema>;

// Parse and validate data
function createUser(data: unknown): User {
  // Throws ZodError if validation fails
  return UserSchema.parse(data);
}

// Safe parsing (returns success/error object)
function tryCreateUser(data: unknown): User | null {
  const result = UserSchema.safeParse(data);
  if (result.success) {
    return result.data;
  } else {
    console.error('Validation failed:', result.error.issues);
    return null;
  }
}
```

#### API Request/Response Validation

```typescript
import { z } from 'zod';

// ✅ Input validation schema
const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).max(10).optional(),
  publishAt: z.string().datetime().optional(),
});

// ✅ Response schema
const PostResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

type CreatePostInput = z.infer<typeof CreatePostSchema>;
type PostResponse = z.infer<typeof PostResponseSchema>;

// ✅ API handler with validation
async function createPost(req: Request): Promise<PostResponse> {
  // Validate request body
  const input = CreatePostSchema.parse(await req.json());

  // Business logic
  const post = await db.posts.create({
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
  });

  // Validate response before returning
  return PostResponseSchema.parse({
    id: post.id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  });
}
```

#### Configuration File Validation

```typescript
import { z } from 'zod';
import { readFile } from 'fs/promises';

// ✅ Configuration schema
const ConfigSchema = z.object({
  server: z.object({
    port: z.number().int().min(1024).max(65535).default(3000),
    host: z.string().default('localhost'),
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().int().positive().default(10),
    ssl: z.boolean().default(false),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    pretty: z.boolean().default(false),
  }).optional(),
});

type Config = z.infer<typeof ConfigSchema>;

// ✅ Load and validate configuration
async function loadConfig(path: string): Promise<Config> {
  const raw = await readFile(path, 'utf-8');
  const json = JSON.parse(raw);

  // Parse with defaults applied
  return ConfigSchema.parse(json);
}
```

#### CLI Argument Validation

```typescript
import { z } from 'zod';

// ✅ CLI arguments schema
const CliArgsSchema = z.object({
  input: z.string().min(1),
  output: z.string().min(1),
  verbose: z.boolean().default(false),
  format: z.enum(['json', 'yaml', 'csv']).default('json'),
  limit: z.number().int().positive().optional(),
});

type CliArgs = z.infer<typeof CliArgsSchema>;

// ✅ Parse CLI arguments
function parseCliArgs(argv: string[]): CliArgs {
  const args = {
    input: argv[2],
    output: argv[3],
    verbose: argv.includes('--verbose'),
    format: argv.includes('--format')
      ? argv[argv.indexOf('--format') + 1]
      : undefined,
  };

  return CliArgsSchema.parse(args);
}
```

#### Data Transformation with Zod

```typescript
import { z } from 'zod';

// ✅ Transform and validate data
const TimestampSchema = z.string().transform((str) => new Date(str));

const UserInputSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  age: z.string().transform((s) => parseInt(s, 10)),
  createdAt: TimestampSchema,
});

// Input: { email: 'USER@EXAMPLE.COM', age: '25', createdAt: '2024-01-01T00:00:00Z' }
// Output: { email: 'user@example.com', age: 25, createdAt: Date object }
```

#### Error Handling Best Practices

```typescript
import { z } from 'zod';

function processUserData(data: unknown) {
  const result = UserSchema.safeParse(data);

  if (!result.success) {
    // ✅ Detailed error messages
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    throw new ValidationError('Invalid user data', errors);
  }

  return result.data;
}
```

#### When to Use Zod

**Always use Zod for**:
- ✅ API request/response validation
- ✅ Configuration file parsing
- ✅ CLI argument validation
- ✅ External data (files, databases, APIs)
- ✅ User input from any source
- ✅ Environment variable validation

**TypeScript types alone are sufficient for**:
- Internal function parameters (within same file)
- Return types of pure functions
- Class properties with known types
- Type aliases and interfaces for documentation

#### Quick Checklist for TypeScript + Zod

Before submitting TypeScript code:
- [ ] Installed Zod (`npm install zod`)
- [ ] Defined schemas for all external data
- [ ] Used `z.infer<typeof Schema>` for type inference
- [ ] Validated inputs at boundaries (API, CLI, files)
- [ ] Used `safeParse()` for better error handling
- [ ] Included meaningful error messages
- [ ] No `any` types (use `z.unknown()` if needed)

### Python
- Type hints for function signatures
- List/dict comprehensions for data transformation
- Context managers (with statement) for resources
- Follow PEP 8 style guide
- Use dataclasses for data models

### SQL
- Use indexes on frequently queried columns
- Avoid SELECT *
- Use JOINs efficiently
- Parameterize queries
- Use transactions for multi-step operations

## Quick Checklist

Before submitting code:
- [ ] Types and interfaces defined
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Tests written and passing
- [ ] Code formatted and linted
- [ ] No console.log/print in production code
- [ ] Security considerations addressed
- [ ] Performance optimized where needed
