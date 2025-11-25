# Clean Code Ability

Expert knowledge and application of clean code principles for writing maintainable, readable, and high-quality software.

## Overview

Clean code is code that is easy to read, understand, and modify. It communicates intent clearly and minimizes cognitive load for future developers (including yourself).

## Fundamental Principles

### 1. Meaningful Names

**Rule**: Names should reveal intent without requiring comments

**Guidelines**:
- Use intention-revealing names
- Avoid disinformation and encodings
- Make meaningful distinctions
- Use pronounceable and searchable names
- Avoid mental mapping

**Examples**:
```typescript
// ❌ BAD: Cryptic names
const d = new Date(); // elapsed time in days
const arr = ['Bob', 'Alice'];

// ✅ GOOD: Intention-revealing
const elapsedTimeInDays = new Date();
const userNames = ['Bob', 'Alice'];

// ❌ BAD: Hungarian notation, noise words
const strName = 'Bob';
const userData = { name: 'Bob' };
const userInfo = { name: 'Bob' }; // What's the difference?

// ✅ GOOD: Clean, semantic names
const userName = 'Bob';
const user = { name: 'Bob' };
const userProfile = { name: 'Bob', bio: '...' };
```

**Variable Naming**:
- Use nouns or noun phrases
- Boolean: `isActive`, `hasPermission`, `canEdit`
- Collections: Use plural (`users`, `orders`, `products`)

**Function Naming**:
- Use verbs or verb phrases
- `getUser()`, `calculateTotal()`, `validateInput()`
- Boolean returning: `isValid()`, `hasErrors()`, `canProceed()`

**Class Naming**:
- Use nouns
- Avoid "Manager", "Processor", "Data" suffixes
- `UserRepository`, `EmailService`, `OrderValidator`

### 2. Functions

**Rule**: Functions should do one thing, do it well, and do it only

**Small Functions**:
- Keep functions small (< 20 lines ideal)
- Each function should be one level of abstraction
- Functions should not have side effects

**Single Responsibility**:
```typescript
// ❌ BAD: Multiple responsibilities
function processUser(user: User) {
  validateUser(user);
  saveToDatabase(user);
  sendEmail(user);
  logAudit(user);
  updateCache(user);
}

// ✅ GOOD: Single responsibility
function registerUser(user: User) {
  const validated = validateUser(user);
  return userRepository.save(validated);
}

function notifyUserRegistered(user: User) {
  emailService.sendWelcome(user);
  auditLogger.log('USER_REGISTERED', user.id);
}
```

**Function Arguments**:
- Zero arguments (niladic) is ideal
- One argument (monadic) is good
- Two arguments (dyadic) are okay
- Three+ arguments (triadic+) require justification
- Avoid flag arguments (split into two functions)

**Examples**:
```typescript
// ❌ BAD: Too many arguments
function createUser(name: string, email: string, age: number, role: string, active: boolean) {}

// ✅ GOOD: Use object parameter
function createUser(userData: UserData) {}

// ❌ BAD: Flag argument
function saveUser(user: User, validate: boolean) {}

// ✅ GOOD: Separate functions
function saveUser(user: User) {}
function saveUserWithoutValidation(user: User) {}
```

**Command Query Separation**:
- Functions should either DO something or ANSWER something, not both
- Commands modify state, queries return values

```typescript
// ❌ BAD: Does both
function setAndReturn(value: string): boolean {
  this.value = value; // Command
  return this.value === value; // Query
}

// ✅ GOOD: Separated
function setValue(value: string): void {
  this.value = value;
}

function getValue(): string {
  return this.value;
}
```

### 3. Comments

**Rule**: Good code mostly documents itself; use comments wisely

**When to Comment**:
- Explain WHY, not WHAT
- Clarify complex business rules
- Warn of consequences
- TODO/FIXME notes (with tickets)
- Legal comments (copyright, license)
- API documentation (JSDoc, docstrings)

**When NOT to Comment**:
- Don't comment bad code, rewrite it
- Avoid redundant comments
- Don't comment out code (use version control)
- Avoid journal comments
- Avoid position markers

**Examples**:
```typescript
// ❌ BAD: Redundant comments
// Get the user by ID
function getUserById(id: string): User {
  // Return the user
  return users.find(u => u.id === id);
}

// ✅ GOOD: Self-documenting code
function getUserById(id: string): User {
  return users.find(u => u.id === id);
}

// ❌ BAD: Commented-out code
function processOrder(order: Order) {
  // validateOrder(order);
  // checkInventory(order);
  saveOrder(order);
}

// ✅ GOOD: Clear intent without noise
/**
 * Processes order for payment and fulfillment.
 * NOTE: Validation and inventory check are handled upstream.
 */
function processOrder(order: Order) {
  saveOrder(order);
}
```

### 4. Formatting

**Rule**: Code formatting is about communication

**Vertical Formatting**:
- Small files are better (< 500 lines)
- Blank lines separate concepts
- Related code should be close together
- Declare variables close to usage
- Dependent functions should be close

**Horizontal Formatting**:
- Keep lines short (< 120 characters)
- Use whitespace to associate related things
- Indent to show hierarchy

**Example**:
```typescript
// ✅ GOOD: Well-formatted
class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async registerUser(userData: UserData): Promise<User> {
    const validated = this.validateUserData(userData);
    const user = await this.userRepository.create(validated);
    await this.sendWelcomeEmail(user);
    return user;
  }

  private validateUserData(userData: UserData): UserData {
    if (!userData.email) throw new Error('Email required');
    if (!userData.name) throw new Error('Name required');
    return userData;
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    await this.emailService.send(user.email, 'Welcome!');
  }
}
```

### 5. Objects and Data Structures

**Rule**: Objects hide data, expose behavior. Data structures expose data, have no behavior.

**Law of Demeter**:
- Don't talk to strangers
- Method should only call methods on:
  - Itself
  - Its parameters
  - Objects it creates
  - Its direct dependencies

```typescript
// ❌ BAD: Violates Law of Demeter (train wreck)
const street = user.getAddress().getStreet().getName();

// ✅ GOOD: Tell, don't ask
const street = user.getStreetName();

// Inside User class:
getStreetName(): string {
  return this.address.street.name;
}
```

### 6. Error Handling

**Rule**: Error handling is important, but it shouldn't obscure logic

**Use Exceptions**:
```typescript
// ❌ BAD: Error codes
function processPayment(amount: number): number {
  if (amount <= 0) return -1;
  if (insufficientFunds()) return -2;
  return 0; // success
}

// ✅ GOOD: Exceptions
function processPayment(amount: number): void {
  if (amount <= 0) {
    throw new InvalidAmountError('Amount must be positive');
  }
  if (insufficientFunds()) {
    throw new InsufficientFundsError('Not enough balance');
  }
  // Process payment
}
```

**Don't Return Null**:
```typescript
// ❌ BAD: Null checks everywhere
const users = getUsers();
if (users !== null) {
  for (const user of users) {
    if (user !== null) {
      // ...
    }
  }
}

// ✅ GOOD: Return empty collection
function getUsers(): User[] {
  return users ?? [];
}

// Or use Optional/Maybe pattern
function getUserById(id: string): User | undefined {
  return users.find(u => u.id === id);
}
```

### 7. DRY (Don't Repeat Yourself)

**Rule**: Every piece of knowledge should have a single representation in the system

```typescript
// ❌ BAD: Duplication
function calculateOrderTotal(order: Order): number {
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
  }
  total += total * 0.1; // Tax
  total += 5; // Shipping
  return total;
}

function calculateInvoiceTotal(invoice: Invoice): number {
  let total = 0;
  for (const item of invoice.items) {
    total += item.price * item.quantity;
  }
  total += total * 0.1; // Tax
  total += 5; // Shipping
  return total;
}

// ✅ GOOD: Extract common logic
function calculateSubtotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function addTaxAndShipping(subtotal: number): number {
  const tax = subtotal * 0.1;
  const shipping = 5;
  return subtotal + tax + shipping;
}

function calculateTotal(items: Item[]): number {
  const subtotal = calculateSubtotal(items);
  return addTaxAndShipping(subtotal);
}
```

## Code Quality Checklist

**Naming**:
- [ ] All names reveal intent
- [ ] No abbreviations or encodings
- [ ] Boolean names start with is/has/can
- [ ] Collections are plural
- [ ] Functions are verbs, classes are nouns

**Functions**:
- [ ] Functions are small (< 20 lines)
- [ ] Functions do one thing
- [ ] One level of abstraction per function
- [ ] Few arguments (prefer 0-2)
- [ ] No flag arguments
- [ ] No side effects

**Comments**:
- [ ] Comments explain WHY, not WHAT
- [ ] No commented-out code
- [ ] No redundant comments
- [ ] API documentation present where needed

**Formatting**:
- [ ] Consistent indentation
- [ ] Lines < 120 characters
- [ ] Blank lines separate concepts
- [ ] Related code is together

**Error Handling**:
- [ ] Use exceptions, not error codes
- [ ] Don't return null (use empty collections or Optional)
- [ ] Exceptions are specific and meaningful

**General**:
- [ ] No duplication (DRY)
- [ ] Code is self-documenting
- [ ] Tests exist and pass
- [ ] No dead code

## The Boy Scout Rule

**"Leave the code better than you found it."**

- Clean up small messes when you see them
- Improve names, extract functions, add tests
- Continuous improvement over time
- Don't need permission for small improvements

## Further Reading

- "Clean Code" by Robert C. Martin
- "Code Complete" by Steve McConnell
- "The Pragmatic Programmer" by Hunt and Thomas
- "Refactoring" by Martin Fowler
