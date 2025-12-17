---
abilityId: testing-strategy
displayName: Testing Strategy
category: quality
tags: [testing, unit, integration, e2e]
priority: 80
---

# Testing Strategy

## Testing Pyramid

```
         /\
        /  \      E2E Tests (few)
       /----\
      /      \    Integration Tests (some)
     /--------\
    /          \  Unit Tests (many)
   /------------\
```

## Unit Tests

### Characteristics
- Fast (milliseconds)
- Isolated (no external dependencies)
- Focused (test one thing)
- Deterministic (same result every time)

### Best Practices
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid input', async () => {
      // Arrange
      const input = { email: 'test@example.com', name: 'Test' };

      // Act
      const result = await service.createUser(input);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.email).toBe(input.email);
    });

    it('should throw for invalid email', async () => {
      const input = { email: 'invalid', name: 'Test' };

      await expect(service.createUser(input))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### What to Test
- Business logic
- Edge cases
- Error conditions
- State transitions

## Integration Tests

### Characteristics
- Test component interactions
- May use real databases (in containers)
- Slower than unit tests
- Test API contracts

### Best Practices
```typescript
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test' })
      .expect(201);

    expect(response.body.id).toBeDefined();

    // Verify in database
    const user = await db.users.findById(response.body.id);
    expect(user).toBeDefined();
  });
});
```

## E2E Tests

### Characteristics
- Test complete user flows
- Use real browser/app
- Slowest tests
- Most realistic

### Best Practices
```typescript
test('user can sign up and create first project', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'SecurePass123!');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');

  await page.click('text=New Project');
  await page.fill('[name=name]', 'My Project');
  await page.click('text=Create');

  await expect(page.locator('.project-card')).toContainText('My Project');
});
```

## Test Coverage

### Guidelines
- Aim for 80%+ coverage on critical code
- 100% coverage doesn't mean bug-free
- Cover happy paths and error paths
- Don't test implementation details

### Measuring Coverage
```bash
# Run tests with coverage
vitest run --coverage

# Coverage report
=============================== Coverage summary ===============================
Statements   : 85.5% ( 342/400 )
Branches     : 78.2% ( 125/160 )
Functions    : 90.0% ( 90/100 )
Lines        : 85.5% ( 342/400 )
================================================================================
```

## Mocking

### When to Mock
- External services
- Time-dependent code
- Non-deterministic behavior
- Slow operations

### Best Practices
```typescript
// Mock external service
vi.mock('./email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: '123' }),
}));

// Mock time
vi.useFakeTimers();
vi.setSystemTime(new Date('2024-01-01'));

// Restore after test
afterEach(() => {
  vi.restoreAllMocks();
});
```
