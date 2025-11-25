# Refactoring Ability

Expert knowledge of code smells, refactoring techniques, and strategies for improving code quality without changing behavior.

## Overview

Refactoring is the process of restructuring existing code without changing its external behavior. The goal is to improve code quality, readability, and maintainability.

## Code Smells

Code smells are indicators that something might be wrong with your code structure.

### Bloaters

**Long Method**
- **Smell**: Method with too many lines
- **Impact**: Hard to understand, test, and maintain
- **Refactoring**: Extract Method, Replace Temp with Query, Decompose Conditional

```typescript
// ❌ BAD: Long method
function processOrder(order: Order) {
  // Validate order
  if (!order.id) throw new Error('Invalid order');
  if (order.items.length === 0) throw new Error('Empty order');
  for (const item of order.items) {
    if (item.quantity <= 0) throw new Error('Invalid quantity');
    if (!item.price) throw new Error('Missing price');
  }

  // Calculate total
  let subtotal = 0;
  for (const item of order.items) {
    subtotal += item.price * item.quantity;
  }
  const tax = subtotal * 0.1;
  const shipping = subtotal > 100 ? 0 : 10;
  const total = subtotal + tax + shipping;

  // Apply discounts
  let discount = 0;
  if (order.customer.isPremium) {
    discount = total * 0.15;
  } else if (total > 200) {
    discount = total * 0.1;
  } else if (total > 100) {
    discount = total * 0.05;
  }

  // Save order
  // ... 50 more lines
}

// ✅ GOOD: Extracted methods
function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateTotal(order);
  const discounted = applyDiscounts(total, order.customer);
  return saveOrder(order, discounted);
}

function validateOrder(order: Order) {
  if (!order.id) throw new Error('Invalid order');
  if (order.items.length === 0) throw new Error('Empty order');
  order.items.forEach(validateOrderItem);
}

function calculateTotal(order: Order): number {
  const subtotal = calculateSubtotal(order.items);
  const tax = calculateTax(subtotal);
  const shipping = calculateShipping(subtotal);
  return subtotal + tax + shipping;
}

function applyDiscounts(total: number, customer: Customer): number {
  const discountRate = getDiscountRate(total, customer);
  return total * (1 - discountRate);
}
```

**Large Class**
- **Smell**: Class with too many fields, methods, or responsibilities
- **Impact**: Violates Single Responsibility Principle
- **Refactoring**: Extract Class, Extract Subclass

**Long Parameter List**
- **Smell**: Function with many parameters
- **Impact**: Hard to use, understand, and change
- **Refactoring**: Introduce Parameter Object, Preserve Whole Object

**Primitive Obsession**
- **Smell**: Using primitives instead of small objects
- **Impact**: Loss of type safety and domain meaning
- **Refactoring**: Replace Data Value with Object, Introduce Value Object

### Object-Orientation Abusers

**Switch Statements**
- **Smell**: Type-based conditionals instead of polymorphism
- **Impact**: Violates Open/Closed Principle, hard to extend
- **Refactoring**: Replace Conditional with Polymorphism

**Refused Bequest**
- **Smell**: Subclass doesn't use inherited methods
- **Impact**: Violates Liskov Substitution Principle
- **Refactoring**: Replace Inheritance with Delegation, Push Down Method

### Change Preventers

**Divergent Change**
- **Smell**: One class changed for many different reasons
- **Impact**: Violates Single Responsibility Principle
- **Refactoring**: Extract Class

**Shotgun Surgery**
- **Smell**: Every change requires many small changes in many classes
- **Impact**: Hard to make changes, easy to miss updates
- **Refactoring**: Move Method, Move Field, Inline Class

### Dispensables

**Duplicate Code**
- **Smell**: Same code structure in multiple places
- **Impact**: Maintenance nightmare, bugs replicate
- **Refactoring**: Extract Method, Extract Class, Pull Up Method

**Dead Code**
- **Smell**: Unused variables, parameters, methods, classes
- **Impact**: Confusion, maintenance burden
- **Refactoring**: Delete it

**Speculative Generality**
- **Smell**: "We might need this someday" code
- **Impact**: Unnecessary complexity
- **Refactoring**: Collapse Hierarchy, Inline Class, Remove Parameter

## Refactoring Techniques

### Extract Method

**When**: Code fragment can be grouped together
**Benefit**: Improves clarity, reusability

### Inline Method

**When**: Method body is as clear as the name
**Benefit**: Reduces unnecessary indirection

### Extract Variable

**When**: Complex expression that's hard to understand
**Benefit**: Makes expression clearer

### Rename Variable/Method/Class

**When**: Name doesn't reveal intent
**Benefit**: Improves readability

### Move Method/Field

**When**: Method/field used more by another class
**Benefit**: Reduces coupling, improves cohesion

### Extract Class

**When**: Class has responsibilities for multiple concerns
**Benefit**: Follows Single Responsibility Principle

### Replace Conditional with Polymorphism

**When**: Type-based conditionals
**Benefit**: Follows Open/Closed Principle

## Refactoring Strategies

### 1. The Refactoring Workflow

**Red-Green-Refactor (TDD)**:
1. **Red**: Write failing test
2. **Green**: Make test pass (quick and dirty)
3. **Refactor**: Improve code while keeping tests green

**Safe Refactoring**:
1. Ensure tests exist and pass
2. Make small, incremental changes
3. Run tests after each change
4. Commit frequently
5. Use automated refactoring tools when possible

### 2. When to Refactor

**Rule of Three**:
- First time: Just do it
- Second time: Wince but do it anyway
- Third time: Refactor

**Opportunistic Refactoring**:
- While adding features
- While fixing bugs
- During code review
- When understanding code

### 3. When NOT to Refactor

- Code is about to be deleted
- Rewriting is easier than refactoring
- Close to a deadline (defer to later)
- Code works and doesn't need changes

## Best Practices

1. **Test Coverage First**: Ensure tests exist before refactoring
2. **Small Steps**: Make one change at a time
3. **Commit Often**: Save working states frequently
4. **Use Tools**: Leverage IDE and automated refactoring
5. **Review Changes**: Have someone review your refactoring
6. **Document Why**: Explain major refactorings in commit messages

## Further Reading

- "Refactoring" by Martin Fowler
- "Working Effectively with Legacy Code" by Michael Feathers
- "Your Code as a Crime Scene" by Adam Tornhill
