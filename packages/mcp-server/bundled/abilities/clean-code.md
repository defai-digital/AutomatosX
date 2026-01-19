---
abilityId: clean-code
displayName: Clean Code Principles
category: engineering
tags: [clean-code, readability, maintainability]
priority: 90
---

# Clean Code Principles

## Naming Conventions

### Variables and Functions
```typescript
// BAD - unclear names
const d = new Date();
const u = users.filter(x => x.a);
function calc(a, b) { return a * b; }

// GOOD - descriptive names
const createdAt = new Date();
const activeUsers = users.filter(user => user.isActive);
function calculateTotalPrice(quantity, unitPrice) {
  return quantity * unitPrice;
}
```

### Boolean Names
```typescript
// Use is/has/can/should prefixes
const isVisible = true;
const hasPermission = user.role === 'admin';
const canEdit = hasPermission && !isLocked;
const shouldNotify = preferences.emailEnabled;
```

### Constants
```typescript
// Use SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;
const API_BASE_URL = 'https://api.example.com';
```

## Function Design

### Single Responsibility
```typescript
// BAD - does too many things
function processUser(user) {
  validateUser(user);
  const savedUser = saveToDatabase(user);
  sendWelcomeEmail(savedUser);
  logUserCreation(savedUser);
  return savedUser;
}

// GOOD - single responsibility
function createUser(userData) {
  const validatedUser = validateUser(userData);
  return saveUser(validatedUser);
}

// Orchestration in a higher level function
async function registerUser(userData) {
  const user = await createUser(userData);
  await sendWelcomeEmail(user);
  await logUserCreation(user);
  return user;
}
```

### Keep Functions Small
```typescript
// Aim for functions that:
// - Fit on one screen (~20-30 lines)
// - Do one thing well
// - Have one level of abstraction

function processOrder(order) {
  validateOrder(order);
  const items = reserveInventory(order.items);
  const payment = processPayment(order.payment);
  const confirmation = createConfirmation(order, items, payment);
  return sendConfirmation(confirmation);
}
```

### Minimize Parameters
```typescript
// BAD - too many parameters
function createUser(name, email, age, address, phone, role) {}

// GOOD - use object parameter
function createUser(params: CreateUserParams) {
  const { name, email, age, address, phone, role } = params;
}

// Or use builder pattern for complex construction
const user = new UserBuilder()
  .withName('John')
  .withEmail('john@example.com')
  .withRole('admin')
  .build();
```

## Code Organization

### Early Returns
```typescript
// BAD - deep nesting
function processOrder(order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.payment) {
        // actual logic buried here
      }
    }
  }
}

// GOOD - early returns
function processOrder(order) {
  if (!order) return null;
  if (order.items.length === 0) return null;
  if (!order.payment) return null;

  // actual logic at the top level
  return fulfillOrder(order);
}
```

### Avoid Magic Numbers
```typescript
// BAD
if (user.age >= 18) {}
if (attempts > 3) {}
setTimeout(fn, 86400000);

// GOOD
const ADULT_AGE = 18;
const MAX_LOGIN_ATTEMPTS = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (user.age >= ADULT_AGE) {}
if (attempts > MAX_LOGIN_ATTEMPTS) {}
setTimeout(fn, ONE_DAY_MS);
```

## Comments

### When to Comment
```typescript
// GOOD - explain why, not what
// Using binary search because the list is always sorted
// and we need O(log n) performance for large datasets
const index = binarySearch(sortedItems, target);

// GOOD - document complex algorithms
// Implements the Levenshtein distance algorithm
// to calculate edit distance between strings

// BAD - stating the obvious
// Increment counter by 1
counter++;

// BAD - commented-out code (just delete it)
// const oldImplementation = ...
```

### Self-Documenting Code
```typescript
// Instead of comments, use clear names
// BAD
// Check if user can access the resource
if (user.role === 'admin' || resource.ownerId === user.id) {}

// GOOD
const isAdmin = user.role === 'admin';
const isOwner = resource.ownerId === user.id;
const canAccessResource = isAdmin || isOwner;

if (canAccessResource) {}
```

## Error Handling

### Don't Return Null
```typescript
// BAD
function findUser(id) {
  const user = db.find(id);
  return user; // might be null
}

// GOOD - use Optional/Maybe pattern
function findUser(id): User | undefined {
  return db.find(id);
}

// Or throw a specific error
function getUser(id): User {
  const user = db.find(id);
  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }
  return user;
}
```

### Use Specific Exceptions
```typescript
// BAD
throw new Error('Something went wrong');

// GOOD
throw new ValidationError('Email format is invalid');
throw new NotFoundError('User', userId);
throw new UnauthorizedError('Invalid credentials');
```

## DRY (Don't Repeat Yourself)

```typescript
// BAD - duplicated logic
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUserEmail(user) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email);
}

// GOOD - extract shared logic
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function validateUserEmail(user: User): boolean {
  return isValidEmail(user.email);
}
```

## Testing Considerations

- Write testable code (dependency injection)
- Avoid hidden dependencies
- Separate pure functions from side effects
- Make functions deterministic when possible

## Code Smells to Avoid

- Long functions (> 30 lines)
- Deep nesting (> 3 levels)
- Long parameter lists (> 3 params)
- Duplicate code
- Dead code
- God objects/classes
- Primitive obsession
- Feature envy
