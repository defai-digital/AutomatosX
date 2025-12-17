---
abilityId: design-patterns
displayName: Design Patterns
category: architecture
tags: [patterns, architecture, oop, solid]
priority: 85
---

# Design Patterns

## Creational Patterns

### Singleton
Single instance with global access point.
```typescript
class Database {
  private static instance: Database;
  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}
```

### Factory
Create objects without specifying exact class.
```typescript
interface Logger { log(msg: string): void; }

function createLogger(type: 'console' | 'file'): Logger {
  switch (type) {
    case 'console': return new ConsoleLogger();
    case 'file': return new FileLogger();
  }
}
```

### Builder
Construct complex objects step by step.
```typescript
class QueryBuilder {
  private query: Query = {};

  select(fields: string[]) { this.query.fields = fields; return this; }
  from(table: string) { this.query.table = table; return this; }
  where(condition: string) { this.query.condition = condition; return this; }
  build() { return this.query; }
}

// Usage
new QueryBuilder().select(['id', 'name']).from('users').where('active = true').build();
```

## Structural Patterns

### Adapter
Convert interface to another interface clients expect.
```typescript
interface NewApi { fetchData(): Promise<Data>; }
interface LegacyApi { getData(callback: (data: Data) => void): void; }

class LegacyAdapter implements NewApi {
  constructor(private legacy: LegacyApi) {}

  fetchData(): Promise<Data> {
    return new Promise(resolve => this.legacy.getData(resolve));
  }
}
```

### Decorator
Add behavior to objects dynamically.
```typescript
interface Coffee { cost(): number; description(): string; }

class Espresso implements Coffee {
  cost() { return 2; }
  description() { return 'Espresso'; }
}

class MilkDecorator implements Coffee {
  constructor(private coffee: Coffee) {}
  cost() { return this.coffee.cost() + 0.5; }
  description() { return this.coffee.description() + ' + Milk'; }
}
```

### Facade
Simplified interface to complex subsystem.
```typescript
class OrderFacade {
  constructor(
    private inventory: InventoryService,
    private payment: PaymentService,
    private shipping: ShippingService
  ) {}

  placeOrder(order: Order): Result {
    this.inventory.reserve(order.items);
    this.payment.charge(order.total);
    this.shipping.schedule(order.address);
    return { success: true };
  }
}
```

## Behavioral Patterns

### Observer
One-to-many dependency for state changes.
```typescript
class EventEmitter<T> {
  private listeners: ((data: T) => void)[] = [];

  subscribe(fn: (data: T) => void) { this.listeners.push(fn); }
  emit(data: T) { this.listeners.forEach(fn => fn(data)); }
}
```

### Strategy
Family of interchangeable algorithms.
```typescript
interface SortStrategy<T> { sort(items: T[]): T[]; }

class Sorter<T> {
  constructor(private strategy: SortStrategy<T>) {}

  setStrategy(strategy: SortStrategy<T>) { this.strategy = strategy; }
  sort(items: T[]): T[] { return this.strategy.sort(items); }
}
```

### Command
Encapsulate request as an object.
```typescript
interface Command { execute(): void; undo(): void; }

class AddTextCommand implements Command {
  constructor(private editor: Editor, private text: string) {}
  execute() { this.editor.insert(this.text); }
  undo() { this.editor.delete(this.text.length); }
}
```

## SOLID Principles

### Single Responsibility
One class, one reason to change.

### Open/Closed
Open for extension, closed for modification.

### Liskov Substitution
Subtypes must be substitutable for base types.

### Interface Segregation
Many specific interfaces > one general interface.

### Dependency Inversion
Depend on abstractions, not concretions.

## When to Use Patterns

- **Do**: Apply when you see the problem the pattern solves
- **Don't**: Force patterns where they don't fit
- **Consider**: Trade-offs (complexity vs flexibility)
- **Document**: Why you chose a particular pattern
