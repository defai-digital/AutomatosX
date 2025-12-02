# TypeScript + Zod Validation

**CRITICAL**: When writing JavaScript or TypeScript scripts, ALWAYS use TypeScript with Zod for runtime type safety and validation. This is a REQUIRED standard for AutomatosX agents.

## Why TypeScript + Zod?

### The Problem with TypeScript Alone

TypeScript provides **compile-time** type safety, but types disappear at runtime:

```typescript
// ❌ TypeScript types don't catch runtime errors
interface User {
  email: string;
  age: number;
}

function createUser(data: unknown): User {
  return data as User; // UNSAFE! No validation!
}

// This will compile fine but crash at runtime
const user = createUser({ email: 123, age: "invalid" });
console.log(user.email.toLowerCase()); // Runtime error!
```

### The Solution: Zod

Zod provides **runtime** validation + automatic TypeScript type inference:

```typescript
// ✅ Zod catches errors at runtime
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

type User = z.infer<typeof UserSchema>;

function createUser(data: unknown): User {
  return UserSchema.parse(data); // Throws if invalid!
}

// This will throw a clear error before anything bad happens
try {
  const user = createUser({ email: 123, age: "invalid" });
} catch (error) {
  console.error('Validation failed:', error.message);
  // Output: "email: Expected string, received number"
}
```

## Installation

```bash
npm install zod
# or
pnpm add zod
# or
yarn add zod
```

## Core Concepts

### 1. Schema Definition

```typescript
import { z } from 'zod';

// Primitive types
const StringSchema = z.string();
const NumberSchema = z.number();
const BooleanSchema = z.boolean();
const DateSchema = z.date();

// Objects
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
});

// Arrays
const StringArraySchema = z.array(z.string());
const UserArraySchema = z.array(UserSchema);

// Enums
const RoleSchema = z.enum(['admin', 'user', 'guest']);

// Unions (OR)
const StringOrNumberSchema = z.union([z.string(), z.number()]);
const StringOrNumberSchema2 = z.string().or(z.number()); // Alternative syntax

// Intersections (AND)
const BaseUserSchema = z.object({ id: z.string() });
const ExtendedUserSchema = BaseUserSchema.and(
  z.object({ email: z.string() })
);
```

### 2. Type Inference

```typescript
import { z } from 'zod';

// ✅ Define schema once, get TypeScript types for free
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

// Type is automatically inferred
type User = z.infer<typeof UserSchema>;
// Equivalent to:
// type User = {
//   id: string;
//   email: string;
//   role: 'admin' | 'user';
// }
```

### 3. Parsing and Validation

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

// parse() - Throws on validation failure
try {
  const user = UserSchema.parse({ email: 'test@example.com', age: 25 });
  console.log(user); // { email: 'test@example.com', age: 25 }
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation failed:', error.issues);
  }
}

// safeParse() - Returns success/error object (recommended)
const result = UserSchema.safeParse({ email: 'invalid', age: -5 });

if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.error('Validation errors:', result.error.issues);
  // [
  //   { path: ['email'], message: 'Invalid email' },
  //   { path: ['age'], message: 'Number must be greater than 0' }
  // ]
}
```

## Common Use Cases

### Use Case 1: CLI Argument Validation

```typescript
import { z } from 'zod';

const CliArgsSchema = z.object({
  input: z.string().min(1, 'Input file required'),
  output: z.string().min(1, 'Output file required'),
  verbose: z.boolean().default(false),
  format: z.enum(['json', 'yaml', 'csv']).default('json'),
  limit: z.number().int().positive().optional(),
  filters: z.array(z.string()).default([]),
});

type CliArgs = z.infer<typeof CliArgsSchema>;

function parseCliArgs(argv: string[]): CliArgs {
  // Build args object from process.argv
  const rawArgs = {
    input: argv[2],
    output: argv[3],
    verbose: argv.includes('--verbose'),
    format: argv.includes('--format')
      ? argv[argv.indexOf('--format') + 1]
      : undefined,
    limit: argv.includes('--limit')
      ? parseInt(argv[argv.indexOf('--limit') + 1], 10)
      : undefined,
    filters: argv.filter(arg => arg.startsWith('--filter=')).map(f => f.slice(9)),
  };

  // Validate and apply defaults
  const result = CliArgsSchema.safeParse(rawArgs);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Invalid CLI arguments:\n${errors.join('\n')}`);
  }

  return result.data;
}

// Usage
try {
  const args = parseCliArgs(process.argv);
  console.log('Parsed args:', args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
```

### Use Case 2: Configuration File Validation

```typescript
import { z } from 'zod';
import { readFile } from 'fs/promises';

const ServerConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(3000),
  host: z.string().default('localhost'),
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string().url()).default(['http://localhost:3000']),
  }).optional(),
});

const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  poolSize: z.number().int().positive().default(10),
  ssl: z.boolean().default(false),
  migrations: z.object({
    auto: z.boolean().default(false),
    directory: z.string().default('./migrations'),
  }).optional(),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text']).default('text'),
  destination: z.string().default('stdout'),
});

const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  logging: LoggingConfigSchema.optional(),
});

type AppConfig = z.infer<typeof AppConfigSchema>;

async function loadConfig(path: string): Promise<AppConfig> {
  try {
    const raw = await readFile(path, 'utf-8');
    const json = JSON.parse(raw);

    // Validate and apply defaults
    const result = AppConfigSchema.safeParse(json);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `  config.${path}: ${issue.message}`;
      });
      throw new Error(
        `Invalid configuration file:\n${errors.join('\n')}\n\nPlease check ${path}`
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

// Usage
const config = await loadConfig('./config.json');
console.log('Server running on:', `${config.server.host}:${config.server.port}`);
```

### Use Case 3: API Request/Response Validation

```typescript
import { z } from 'zod';

// Input schema for creating a blog post
const CreatePostInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().min(1).max(50)).max(10).default([]),
  publishAt: z.string().datetime().optional(),
  draft: z.boolean().default(true),
});

// Response schema for a blog post
const PostResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  publishAt: z.string().datetime().nullable(),
  draft: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

type CreatePostInput = z.infer<typeof CreatePostInputSchema>;
type PostResponse = z.infer<typeof PostResponseSchema>;

// API handler with validation
async function createPostHandler(req: Request): Promise<Response> {
  try {
    // Validate request body
    const body = await req.json();
    const input = CreatePostInputSchema.parse(body);

    // Business logic
    const post = await database.posts.create({
      title: input.title,
      content: input.content,
      tags: input.tags,
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      draft: input.draft,
      authorId: req.user.id,
    });

    // Build response
    const responseData = {
      id: post.id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      publishAt: post.publishAt?.toISOString() ?? null,
      draft: post.draft,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      author: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    };

    // Validate response before sending
    const validatedResponse = PostResponseSchema.parse(responseData);

    return new Response(JSON.stringify(validatedResponse), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          issues: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw error;
  }
}
```

### Use Case 4: Environment Variable Validation

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).pipe(
    z.number().int().min(1024).max(65535)
  ).default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_KEY: z.string().min(32),
  ENABLE_FEATURE_X: z.string()
    .transform((val) => val === 'true')
    .default('false'),
});

type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const envVar = issue.path.join('.');
      return `  ${envVar}: ${issue.message}`;
    });

    console.error('❌ Invalid environment variables:');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file or environment configuration.');
    process.exit(1);
  }

  return result.data;
}

// Usage at application startup
const env = loadEnv();
console.log(`Starting server on port ${env.PORT} in ${env.NODE_ENV} mode`);
```

### Use Case 5: File Content Validation

```typescript
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';

const PackageJsonSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  main: z.string().default('index.js'),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  engines: z.object({
    node: z.string().optional(),
    npm: z.string().optional(),
  }).optional(),
});

type PackageJson = z.infer<typeof PackageJsonSchema>;

async function readPackageJson(path: string): Promise<PackageJson> {
  try {
    const raw = await readFile(path, 'utf-8');
    const json = JSON.parse(raw);

    const result = PackageJsonSchema.safeParse(json);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const field = issue.path.join('.');
        return `  ${field}: ${issue.message}`;
      });
      throw new Error(
        `Invalid package.json at ${path}:\n${errors.join('\n')}`
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in package.json: ${error.message}`);
    }
    throw error;
  }
}

async function updatePackageVersion(
  path: string,
  newVersion: string
): Promise<void> {
  const pkg = await readPackageJson(path);

  // Validate new version format
  const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
  const validatedVersion = versionSchema.parse(newVersion);

  pkg.version = validatedVersion;

  // Re-validate entire package.json before writing
  const validated = PackageJsonSchema.parse(pkg);

  await writeFile(path, JSON.stringify(validated, null, 2), 'utf-8');
  console.log(`✅ Updated package.json version to ${validatedVersion}`);
}
```

## Advanced Patterns

### Pattern 1: Refinements (Custom Validation)

```typescript
import { z } from 'zod';

const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number',
  });

const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'], // Error will be attached to confirmPassword field
});
```

### Pattern 2: Transformations

```typescript
import { z } from 'zod';

// Transform string to Date
const DateFromStringSchema = z.string()
  .datetime()
  .transform((str) => new Date(str));

// Transform and validate
const UserInputSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  age: z.string().transform((s) => parseInt(s, 10)).pipe(
    z.number().int().min(0).max(150)
  ),
  createdAt: DateFromStringSchema,
});

// Input: { email: 'USER@EXAMPLE.COM', age: '25', createdAt: '2024-01-01T00:00:00Z' }
// Output: { email: 'user@example.com', age: 25, createdAt: Date object }
```

### Pattern 3: Discriminated Unions

```typescript
import { z } from 'zod';

const SuccessResponseSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const ApiResponseSchema = z.discriminatedUnion('status', [
  SuccessResponseSchema,
  ErrorResponseSchema,
]);

type ApiResponse = z.infer<typeof ApiResponseSchema>;

function handleResponse(response: ApiResponse) {
  if (response.status === 'success') {
    // TypeScript knows response.data exists here
    console.log('Success:', response.data.name);
  } else {
    // TypeScript knows response.error exists here
    console.error('Error:', response.error.message);
  }
}
```

### Pattern 4: Recursive Schemas

```typescript
import { z } from 'zod';

type Category = {
  id: string;
  name: string;
  subcategories: Category[];
};

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    subcategories: z.array(CategorySchema),
  })
);

// Can validate deeply nested category trees
const category = CategorySchema.parse({
  id: '123',
  name: 'Electronics',
  subcategories: [
    {
      id: '456',
      name: 'Computers',
      subcategories: [
        {
          id: '789',
          name: 'Laptops',
          subcategories: [],
        },
      ],
    },
  ],
});
```

## Error Handling Best Practices

### Detailed Error Messages

```typescript
import { z } from 'zod';

function validateData(data: unknown) {
  const result = UserSchema.safeParse(data);

  if (!result.success) {
    // ✅ Extract detailed error information
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      received: issue.received,
    }));

    console.error('Validation failed:');
    errors.forEach((err) => {
      console.error(`  - ${err.field}: ${err.message} (got: ${err.received})`);
    });

    throw new ValidationError('Data validation failed', errors);
  }

  return result.data;
}
```

### Custom Error Messages

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  }).email('Please provide a valid email address'),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  }).int('Age must be a whole number')
    .min(0, 'Age cannot be negative')
    .max(150, 'Age must be less than 150'),

  role: z.enum(['admin', 'user', 'guest'], {
    errorMap: () => ({ message: 'Role must be either admin, user, or guest' }),
  }),
});
```

## Testing with Zod

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

describe('UserSchema', () => {
  it('should validate valid user data', () => {
    const result = UserSchema.safeParse({
      email: 'test@example.com',
      age: 25,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.age).toBe(25);
    }
  });

  it('should reject invalid email', () => {
    const result = UserSchema.safeParse({
      email: 'not-an-email',
      age: 25,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
      expect(result.error.issues[0].message).toContain('email');
    }
  });

  it('should reject negative age', () => {
    const result = UserSchema.safeParse({
      email: 'test@example.com',
      age: -5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['age']);
    }
  });
});
```

## Quick Reference Checklist

### Before Writing Any Script

- [ ] Installed Zod (`npm install zod`)
- [ ] Imported Zod (`import { z } from 'zod'`)
- [ ] Defined schemas for all external data sources
- [ ] Used `z.infer<typeof Schema>` for type inference
- [ ] Validated at system boundaries (CLI, files, APIs, env vars)
- [ ] Used `safeParse()` for better error handling
- [ ] Provided meaningful custom error messages
- [ ] No `any` types (use `z.unknown()` if type is truly unknown)
- [ ] Tested validation logic with unit tests

### When to Use Zod (Required)

✅ **ALWAYS use Zod for:**
- CLI argument parsing
- Configuration file validation (JSON, YAML, etc.)
- API request/response validation
- File content validation
- Environment variable validation
- Database query results
- External API responses
- User input from any source

❌ **TypeScript types alone are sufficient for:**
- Internal function parameters (same file)
- Return types of pure functions
- Class properties with known types
- Type aliases and interfaces for documentation
- Generic type parameters

## Common Zod Methods Reference

```typescript
// String validations
z.string()
z.string().min(5)
z.string().max(100)
z.string().email()
z.string().url()
z.string().uuid()
z.string().regex(/pattern/)
z.string().datetime()

// Number validations
z.number()
z.number().int()
z.number().positive()
z.number().negative()
z.number().min(0)
z.number().max(100)

// Array validations
z.array(z.string())
z.array(z.number()).min(1)
z.array(z.string()).max(10)

// Object validations
z.object({ key: z.string() })
z.object({ key: z.string() }).strict() // No extra keys
z.object({ key: z.string() }).partial() // All keys optional
z.object({ key: z.string() }).required() // All keys required

// Optional and nullable
z.string().optional()
z.string().nullable()
z.string().nullish() // null | undefined

// Default values
z.string().default('default value')
z.number().default(0)

// Enums
z.enum(['option1', 'option2'])
z.nativeEnum(MyEnum)

// Unions and intersections
z.union([z.string(), z.number()])
z.string().or(z.number())
z.intersection(Schema1, Schema2)
Schema1.and(Schema2)

// Transformations
z.string().transform((val) => val.toLowerCase())
z.string().transform((val) => parseInt(val, 10))

// Refinements
z.string().refine((val) => val.length > 5, 'Must be longer than 5')
```

## Resources

- Official Docs: https://zod.dev
- GitHub: https://github.com/colinhacks/zod
- NPM: https://www.npmjs.com/package/zod

---

**Remember**: When an AutomatosX agent writes a TypeScript script, Zod validation is **MANDATORY** for all external data. No exceptions!
