# Design Patterns Ability

Expert knowledge and application of software design patterns from the Gang of Four and beyond.

## Overview

Design patterns are proven solutions to common software design problems. They provide a shared vocabulary and best practices for object-oriented design.

## Creational Patterns

Patterns for object creation mechanisms.

### Factory Method

**Problem**: Need to create objects without specifying exact class
**Solution**: Define interface for creating objects, let subclasses decide which class to instantiate

**When to use**:
- Class can't anticipate the type of objects it needs to create
- Subclasses specify the objects to create
- Delegate creation responsibility to helper subclasses

**Example**:
```typescript
interface Logger {
  log(message: string): void;
}

abstract class LoggerFactory {
  abstract createLogger(): Logger;

  logMessage(message: string) {
    const logger = this.createLogger();
    logger.log(message);
  }
}

class ConsoleLoggerFactory extends LoggerFactory {
  createLogger(): Logger {
    return new ConsoleLogger();
  }
}

class FileLoggerFactory extends LoggerFactory {
  createLogger(): Logger {
    return new FileLogger();
  }
}
```

### Abstract Factory

**Problem**: Create families of related objects without specifying concrete classes
**Solution**: Provide interface for creating families of related objects

**When to use**:
- System should be independent of how products are created
- System should be configured with one of multiple families of products
- Family of related products should be used together

### Singleton

**Problem**: Ensure a class has only one instance with global access point
**Solution**: Private constructor, static instance method

**When to use**:
- Exactly one instance needed (configuration, connection pool)
- Controlled access to sole instance required
- Instance should be extensible by subclassing

**Caution**: Often considered anti-pattern; prefer dependency injection

**Example**:
```typescript
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private constructor() { }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }
}
```

### Builder

**Problem**: Construct complex objects step by step
**Solution**: Separate construction from representation

**When to use**:
- Object creation involves many steps
- Same construction process should create different representations
- Avoid telescoping constructors

**Example**:
```typescript
class QueryBuilder {
  private query = '';

  select(fields: string[]): this {
    this.query = `SELECT ${fields.join(', ')}`;
    return this;
  }

  from(table: string): this {
    this.query += ` FROM ${table}`;
    return this;
  }

  where(condition: string): this {
    this.query += ` WHERE ${condition}`;
    return this;
  }

  build(): string {
    return this.query;
  }
}

const query = new QueryBuilder()
  .select(['name', 'email'])
  .from('users')
  .where('age > 18')
  .build();
```

### Prototype

**Problem**: Create new objects by copying existing ones
**Solution**: Specify kinds of objects using prototypical instance

## Structural Patterns

Patterns for composing classes and objects.

### Adapter

**Problem**: Make incompatible interfaces work together
**Solution**: Convert interface of class into another interface clients expect

**When to use**:
- Use existing class with incompatible interface
- Create reusable class cooperating with unrelated classes
- Need to use several existing subclasses with incompatible interfaces

**Example**:
```typescript
// Legacy API
class LegacyLogger {
  logMessage(msg: string) { console.log(msg); }
}

// New interface
interface ModernLogger {
  log(level: string, message: string): void;
}

// Adapter
class LoggerAdapter implements ModernLogger {
  constructor(private legacy: LegacyLogger) {}

  log(level: string, message: string) {
    this.legacy.logMessage(`[${level}] ${message}`);
  }
}
```

### Decorator

**Problem**: Add responsibilities to objects dynamically
**Solution**: Wrap object in decorator that adds behavior

**When to use**:
- Add responsibilities to individual objects dynamically
- Responsibilities can be withdrawn
- Extension by subclassing is impractical

**Example**:
```typescript
interface Coffee {
  cost(): number;
  description(): string;
}

class SimpleCoffee implements Coffee {
  cost() { return 5; }
  description() { return 'Simple coffee'; }
}

class MilkDecorator implements Coffee {
  constructor(private coffee: Coffee) {}
  cost() { return this.coffee.cost() + 2; }
  description() { return this.coffee.description() + ', milk'; }
}

class SugarDecorator implements Coffee {
  constructor(private coffee: Coffee) {}
  cost() { return this.coffee.cost() + 1; }
  description() { return this.coffee.description() + ', sugar'; }
}

const coffee = new SugarDecorator(new MilkDecorator(new SimpleCoffee()));
// Cost: 8, Description: "Simple coffee, milk, sugar"
```

### Facade

**Problem**: Provide simplified interface to complex subsystem
**Solution**: Higher-level interface that makes subsystem easier to use

**When to use**:
- Simplify complex subsystem
- Layer your subsystems
- Reduce coupling between subsystems

### Proxy

**Problem**: Provide surrogate or placeholder for another object
**Solution**: Control access to the original object

**When to use**:
- Lazy initialization (virtual proxy)
- Access control (protection proxy)
- Remote object access (remote proxy)
- Caching (cache proxy)

### Composite

**Problem**: Treat individual objects and compositions uniformly
**Solution**: Compose objects into tree structures

## Behavioral Patterns

Patterns for communication between objects.

### Strategy

**Problem**: Define family of algorithms, make them interchangeable
**Solution**: Encapsulate each algorithm, make them interchangeable

**When to use**:
- Many related classes differ only in behavior
- Need different variants of algorithm
- Algorithm uses data clients shouldn't know about
- Class defines many behaviors as conditional statements

**Example**:
```typescript
interface PaymentStrategy {
  pay(amount: number): void;
}

class CreditCardPayment implements PaymentStrategy {
  pay(amount: number) {
    console.log(`Paid ${amount} with credit card`);
  }
}

class PayPalPayment implements PaymentStrategy {
  pay(amount: number) {
    console.log(`Paid ${amount} with PayPal`);
  }
}

class ShoppingCart {
  constructor(private paymentStrategy: PaymentStrategy) {}

  checkout(amount: number) {
    this.paymentStrategy.pay(amount);
  }
}
```

### Observer

**Problem**: Define one-to-many dependency between objects
**Solution**: When one object changes state, all dependents are notified

**When to use**:
- Change to one object requires changing others
- Object should notify others without assumptions about who they are
- Abstraction has two aspects, one dependent on the other

**Example**:
```typescript
interface Observer {
  update(data: any): void;
}

class Subject {
  private observers: Observer[] = [];

  attach(observer: Observer) {
    this.observers.push(observer);
  }

  notify(data: any) {
    this.observers.forEach(obs => obs.update(data));
  }
}

class DataLogger implements Observer {
  update(data: any) {
    console.log('Data logged:', data);
  }
}

class DataDisplay implements Observer {
  update(data: any) {
    console.log('Data displayed:', data);
  }
}
```

### Command

**Problem**: Encapsulate request as object
**Solution**: Parameterize clients with different requests, queue/log requests

**When to use**:
- Parameterize objects with actions
- Specify, queue, and execute requests at different times
- Support undo
- Support logging changes

### Template Method

**Problem**: Define skeleton of algorithm, let subclasses override steps
**Solution**: Define algorithm structure, defer some steps to subclasses

**When to use**:
- Implement invariant parts of algorithm once
- Common behavior among subclasses should be factored
- Control subclass extensions

### Iterator

**Problem**: Access elements of aggregate object sequentially without exposing representation
**Solution**: Provide way to access elements without exposing structure

### State

**Problem**: Allow object to alter behavior when internal state changes
**Solution**: Object appears to change its class

### Chain of Responsibility

**Problem**: Avoid coupling sender to receiver
**Solution**: Give more than one object chance to handle request

## Pattern Selection Guide

### Choosing the Right Pattern

**Creating Objects:**
- Simple object creation → Factory Method
- Family of related objects → Abstract Factory
- Complex construction → Builder
- Copy existing object → Prototype
- Single instance → Singleton

**Structuring Code:**
- Incompatible interfaces → Adapter
- Add behavior dynamically → Decorator
- Simplify complex system → Facade
- Control access → Proxy
- Tree structure → Composite

**Defining Behavior:**
- Interchangeable algorithms → Strategy
- Notify multiple objects → Observer
- Encapsulate requests → Command
- Algorithm skeleton → Template Method
- Sequential access → Iterator
- State-based behavior → State
- Chain of handlers → Chain of Responsibility

## Anti-patterns to Avoid

### Pattern Overuse
- Don't force patterns where they don't fit
- Simpler solutions often better
- Patterns add complexity and abstraction

### Singleton Abuse
- Global state is problematic
- Tight coupling
- Difficult to test
- Consider dependency injection instead

### God Object
- Object that knows/does too much
- Violates Single Responsibility Principle
- Hard to maintain and test

### Premature Optimization
- Don't optimize before measuring
- Pattern complexity should solve real problems
- YAGNI (You Aren't Gonna Need It)

## Best Practices

1. **Understand the Problem First**
   - Identify the actual problem
   - Consider simpler solutions
   - Pattern should solve real need

2. **Know the Trade-offs**
   - Every pattern adds complexity
   - Balance flexibility vs. simplicity
   - Consider maintainability

3. **Use Patterns as Communication**
   - Shared vocabulary
   - Document intent
   - Aid team understanding

4. **Refactor to Patterns**
   - Don't design patterns upfront
   - Let patterns emerge
   - Refactor when pattern becomes clear

5. **Combine Patterns**
   - Patterns often work together
   - Strategy + Factory Method
   - Decorator + Composite
   - Observer + Mediator

## Further Reading

- "Design Patterns: Elements of Reusable Object-Oriented Software" by Gang of Four
- "Head First Design Patterns" by Freeman et al.
- "Patterns of Enterprise Application Architecture" by Martin Fowler
- "Refactoring to Patterns" by Joshua Kerievsky
