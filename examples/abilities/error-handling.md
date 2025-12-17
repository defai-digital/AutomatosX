---
abilityId: error-handling
displayName: Error Handling
category: engineering
tags: [errors, exceptions, resilience]
priority: 85
---

# Error Handling Best Practices

## Error Design Principles

### Error Categories
1. **Operational errors**: Expected failures (network, disk, validation)
2. **Programming errors**: Bugs (null reference, type errors)
3. **User errors**: Invalid input, unauthorized actions

### Error Information
- **Code**: Machine-readable identifier
- **Message**: Human-readable description
- **Details**: Additional context for debugging
- **Stack trace**: For development only

## Custom Error Classes

```typescript
// Base error class
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}
```

## Result Type Pattern

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Success helper
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

// Error helper
function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Usage
async function findUser(id: string): Promise<Result<User, NotFoundError>> {
  const user = await db.users.findById(id);
  if (!user) {
    return err(new NotFoundError('User', id));
  }
  return ok(user);
}

// Handling
const result = await findUser('123');
if (result.ok) {
  console.log(result.value.name);
} else {
  console.error(result.error.message);
}
```

## Error Handling in APIs

### Express Error Handler
```typescript
// Error handling middleware
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle validation errors (e.g., Zod)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    });
  }

  // Unknown errors - don't leak details
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

### Async Handler Wrapper
```typescript
function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User', req.params.id);
  }
  res.json(user);
}));
```

## Error Handling Patterns

### Try-Catch with Cleanup
```typescript
async function processFile(path: string) {
  let file: FileHandle | null = null;
  try {
    file = await fs.open(path, 'r');
    const content = await file.readFile('utf-8');
    return processContent(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('File', path);
    }
    throw error;
  } finally {
    await file?.close();
  }
}
```

### Retry with Backoff
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retriable errors
      if (error instanceof ValidationError) {
        throw error;
      }

      if (attempt < options.maxRetries) {
        const delay = options.baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
```

### Circuit Breaker
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

## Logging Errors

```typescript
// Structured error logging
logger.error({
  message: error.message,
  code: error.code,
  stack: error.stack,
  context: {
    userId: req.user?.id,
    requestId: req.id,
    path: req.path,
    method: req.method,
  },
});

// Don't log sensitive data
const sanitizedBody = omit(req.body, ['password', 'token', 'creditCard']);
```

## Anti-Patterns

- Swallowing errors silently
- Using exceptions for control flow
- Exposing stack traces in production
- Generic error messages without codes
- Not logging errors
- Retrying non-retriable errors
- Missing error boundaries in UI
