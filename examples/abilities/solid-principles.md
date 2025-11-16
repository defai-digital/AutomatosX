# SOLID Principles Ability

Expert understanding and application of SOLID principles for object-oriented design.

## Overview

SOLID is an acronym for five design principles that make software designs more understandable, flexible, and maintainable.

## The Five Principles

### 1. Single Responsibility Principle (SRP)

**Definition**: A class should have one, and only one, reason to change.

**Key Concepts**:
- Each module/class should have responsibility over a single part of functionality
- Separate concerns into different classes
- High cohesion within classes
- Changes to one responsibility don't affect others

**Code Smells (Violations)**:
- "God classes" that do everything
- Classes with multiple unrelated methods
- Classes that change for multiple reasons
- Mixed business logic and infrastructure

**Examples**:
```typescript
// ❌ BAD: Multiple responsibilities
class UserManager {
  saveToDatabase(user: User) { }
  sendWelcomeEmail(user: User) { }
  generateReport(user: User) { }
  validateUser(user: User) { }
}

// ✅ GOOD: Single responsibilities
class UserRepository {
  save(user: User) { }
}
class EmailService {
  sendWelcomeEmail(user: User) { }
}
class ReportGenerator {
  generate(user: User) { }
}
class UserValidator {
  validate(user: User) { }
}
```

### 2. Open/Closed Principle (OCP)

**Definition**: Software entities should be open for extension but closed for modification.

**Key Concepts**:
- Extend behavior without modifying existing code
- Use abstraction and polymorphism
- New features via new code, not changed code
- Reduces regression risk

**Code Smells (Violations)**:
- Long switch/if-else chains for type checking
- Modifying existing classes to add new features
- Tight coupling to concrete implementations

**Examples**:
```typescript
// ❌ BAD: Must modify class to add new shapes
class AreaCalculator {
  calculateArea(shape: any) {
    if (shape.type === 'circle') {
      return Math.PI * shape.radius ** 2;
    } else if (shape.type === 'rectangle') {
      return shape.width * shape.height;
    }
    // Must add new else-if for each shape type
  }
}

// ✅ GOOD: Open for extension via new implementations
interface Shape {
  calculateArea(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  calculateArea() {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  calculateArea() {
    return this.width * this.height;
  }
}

class AreaCalculator {
  calculateTotal(shapes: Shape[]) {
    return shapes.reduce((sum, shape) => sum + shape.calculateArea(), 0);
  }
}
```

### 3. Liskov Substitution Principle (LSP)

**Definition**: Objects of a superclass should be replaceable with objects of its subclasses without breaking the application.

**Key Concepts**:
- Subtypes must be substitutable for base types
- Derived classes must honor base class contracts
- Preconditions cannot be strengthened
- Postconditions cannot be weakened

**Code Smells (Violations)**:
- Subclass throws exceptions on base class methods
- Subclass changes expected behavior
- Subclass requires type checking before use
- "Is-a" relationship violated

**Examples**:
```typescript
// ❌ BAD: Square violates Rectangle's contract
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(width: number) { this.width = width; }
  setHeight(height: number) { this.height = height; }
  getArea() { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(width: number) {
    this.width = width;
    this.height = width; // Breaks expectation
  }
  setHeight(height: number) {
    this.width = height; // Breaks expectation
    this.height = height;
  }
}

// ✅ GOOD: Separate hierarchies
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  getArea() { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private size: number) {}
  getArea() { return this.size * this.size; }
}
```

### 4. Interface Segregation Principle (ISP)

**Definition**: Clients should not be forced to depend on interfaces they don't use.

**Key Concepts**:
- Many small, specific interfaces better than one large interface
- Avoid "fat interfaces" with unused methods
- Clients depend only on methods they need
- High cohesion in interfaces

**Code Smells (Violations)**:
- Interface with many unrelated methods
- Classes implementing interfaces with empty/throw methods
- Clients importing interfaces with unused methods

**Examples**:
```typescript
// ❌ BAD: Fat interface forces unnecessary dependencies
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements Worker {
  work() { /* ... */ }
  eat() { throw new Error('Robots don\'t eat'); }
  sleep() { throw new Error('Robots don\'t sleep'); }
}

// ✅ GOOD: Segregated interfaces
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class Human implements Workable, Feedable, Sleepable {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
}

class Robot implements Workable {
  work() { /* ... */ }
}
```

### 5. Dependency Inversion Principle (DIP)

**Definition**: High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Key Concepts**:
- Depend on abstractions, not concretions
- Use dependency injection
- Decouple high-level policy from low-level details
- Enables testability and flexibility

**Code Smells (Violations)**:
- Direct instantiation of dependencies (new keyword everywhere)
- Tight coupling to concrete classes
- Hard to test due to embedded dependencies
- Cannot swap implementations

**Examples**:
```typescript
// ❌ BAD: High-level depends on low-level
class EmailNotifier {
  send(message: string) {
    // Send email
  }
}

class UserService {
  private notifier = new EmailNotifier(); // Tight coupling

  registerUser(user: User) {
    // ...
    this.notifier.send('Welcome!');
  }
}

// ✅ GOOD: Both depend on abstraction
interface Notifier {
  send(message: string): void;
}

class EmailNotifier implements Notifier {
  send(message: string) {
    // Send email
  }
}

class SMSNotifier implements Notifier {
  send(message: string) {
    // Send SMS
  }
}

class UserService {
  constructor(private notifier: Notifier) {} // Dependency injection

  registerUser(user: User) {
    // ...
    this.notifier.send('Welcome!');
  }
}
```

## Applying SOLID in Code Reviews

### Review Checklist

**Single Responsibility:**
- [ ] Does each class have a clear, single purpose?
- [ ] Can you describe the class's responsibility in one sentence?
- [ ] Would changes to different features require changing this class?

**Open/Closed:**
- [ ] Can new behavior be added without modifying existing code?
- [ ] Are variations handled through polymorphism?
- [ ] Is the code using abstraction appropriately?

**Liskov Substitution:**
- [ ] Can subclasses be used anywhere the base class is expected?
- [ ] Do derived classes honor base class contracts?
- [ ] Are preconditions and postconditions preserved?

**Interface Segregation:**
- [ ] Are interfaces focused and cohesive?
- [ ] Do clients only depend on methods they use?
- [ ] Are there any "fat interfaces" to split?

**Dependency Inversion:**
- [ ] Are dependencies injected rather than created?
- [ ] Do modules depend on abstractions?
- [ ] Is the code testable with mock dependencies?

## Common Trade-offs

**Simplicity vs. Flexibility:**
- Don't over-engineer for flexibility you don't need
- Apply SOLID when complexity justifies it
- Start simple, refactor when patterns emerge

**Abstraction Overhead:**
- Every abstraction adds cognitive load
- Balance between flexibility and understandability
- Concrete is simpler, abstract is more flexible

**Performance:**
- Indirection can add minimal overhead
- Maintainability usually outweighs micro-optimizations
- Profile before optimizing away good design

## When to Apply SOLID

**Good Candidates:**
- Business logic and domain models
- Core abstractions used throughout system
- Code expected to change frequently
- Public APIs and interfaces

**Less Important:**
- Simple data structures
- One-off scripts or tools
- Performance-critical tight loops
- Code unlikely to change

## Further Reading

- "Clean Architecture" by Robert C. Martin
- "Design Patterns" by Gang of Four
- "Refactoring" by Martin Fowler
- "Growing Object-Oriented Software, Guided by Tests" by Freeman and Pryce
