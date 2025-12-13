/**
 * True Negative Test Fixtures - Semantic Dead Code Analysis
 *
 * These symbols are NOT dead code and should NOT be detected.
 * Used to measure precision (false positive rate).
 *
 * @module tests/fixtures/semantic-analysis/true-negatives
 */

// ============================================================================
// 1. Clearly Used Variables
// ============================================================================

const usedConstant = 42;
console.log(usedConstant); // Used in value position

let usedLetVariable = 'hello';
usedLetVariable = 'world'; // Reassigned
console.log(usedLetVariable); // Used

// ============================================================================
// 2. Used Functions
// ============================================================================

function usedFunction(): string {
  return 'called';
}
const result = usedFunction(); // Function is called
console.log(result);

const usedArrowFunction = (x: number) => x * 2;
console.log(usedArrowFunction(5)); // Called

// ============================================================================
// 3. Used Classes
// ============================================================================

class UsedClass {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }
}

const instance = new UsedClass(42); // Instantiated
console.log(instance.getValue()); // Methods used

// ============================================================================
// 4. Exported Symbols (entry points)
// ============================================================================

// Exports should NOT be flagged as dead (entry points)
export const exportedConstant = 'entry point';

export function exportedFunction(): void {
  console.log('entry point');
}

export class ExportedClass {
  doSomething(): void {
    console.log('entry point');
  }
}

export interface ExportedInterface {
  id: number;
  name: string;
}

export type ExportedType = {
  foo: string;
};

export enum ExportedEnum {
  Value1 = 'V1',
  Value2 = 'V2',
}

// ============================================================================
// 5. Types Used in Annotations
// ============================================================================

interface UsedInterface {
  id: number;
  name: string;
}

// Interface is used in type annotation
function processData(data: UsedInterface): void {
  console.log(data.id, data.name);
}

type UsedTypeAlias = string | number;

// Type alias is used
const value: UsedTypeAlias = 'hello';
console.log(value);

// Call to use the function
processData({ id: 1, name: 'test' });

// ============================================================================
// 6. Generics Used Properly
// ============================================================================

type GenericType<T> = {
  value: T;
  transform: (v: T) => T;
};

// Generic type is instantiated with concrete types
const stringBox: GenericType<string> = {
  value: 'hello',
  transform: (s) => s.toUpperCase(),
};
console.log(stringBox.transform(stringBox.value));

// ============================================================================
// 7. Enums Used
// ============================================================================

enum UsedEnum {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

const status: UsedEnum = UsedEnum.Active; // Enum value used
console.log(status);

const checkStatus = (s: UsedEnum): boolean => s === UsedEnum.Active;
console.log(checkStatus(UsedEnum.Inactive));

// ============================================================================
// 8. Callback/Handler Pattern
// ============================================================================

type EventHandler = (event: string) => void;

function registerHandler(handler: EventHandler): void {
  handler('event'); // Handler is invoked
}

// The function passed as callback is used
registerHandler((event) => {
  console.log(`Handling: ${event}`);
});

// ============================================================================
// 9. Factory Pattern
// ============================================================================

class Product {
  constructor(public name: string) {}
}

function createProduct(name: string): Product {
  return new Product(name); // Class is used via factory
}

const product = createProduct('Widget');
console.log(product.name);

// ============================================================================
// 10. Inheritance Chain
// ============================================================================

class BaseClass {
  protected baseMethod(): string {
    return 'base';
  }
}

class DerivedClass extends BaseClass {
  derivedMethod(): string {
    return this.baseMethod() + '-derived'; // baseMethod is used
  }
}

const derived = new DerivedClass();
console.log(derived.derivedMethod()); // DerivedClass used, which uses BaseClass

// ============================================================================
// 11. Interface Implementation
// ============================================================================

interface Serializable {
  serialize(): string;
}

class SerializableData implements Serializable {
  constructor(private data: string) {}

  serialize(): string {
    return JSON.stringify({ data: this.data });
  }
}

const serializable: Serializable = new SerializableData('test');
console.log(serializable.serialize());

// ============================================================================
// 12. Re-exported Symbols (barrel exports)
// ============================================================================

// Simulating re-export: export { Something } from './somewhere';
// The original Something should not be flagged if re-exported

// ============================================================================
// 13. Symbol Used in Multiple Files (cross-file reference)
// ============================================================================

// In a real project, this would be imported and used in another file
// We simulate by having it exported

export const sharedUtility = (x: number): number => x * 2;

// ============================================================================
// 14. Decorator Targets
// ============================================================================

// Simulating decorator usage
function MyDecorator(target: unknown): void {
  console.log('Decorated:', target);
}

// If decorators are enabled, the class is used
// @MyDecorator - decorators require experimental flag
class DecoratedClass {
  method(): void {
    console.log('method');
  }
}

// Manually apply decorator to simulate
MyDecorator(DecoratedClass);

// ============================================================================
// 15. Symbols in Conditionals
// ============================================================================

const feature = {
  enabled: true,
};

// This function is conditionally called
function featureHandler(): void {
  console.log('Feature active');
}

if (feature.enabled) {
  featureHandler(); // Conditionally used
}

// ============================================================================
// 16. Promise/Async Patterns
// ============================================================================

async function fetchData(): Promise<string> {
  return 'data';
}

// Used in async context
fetchData().then(console.log);

// ============================================================================
// 17. Error Classes
// ============================================================================

class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomError';
  }
}

function mightFail(shouldFail: boolean): void {
  if (shouldFail) {
    throw new CustomError('Failed!'); // Error class is used
  }
}

try {
  mightFail(false);
} catch (e) {
  if (e instanceof CustomError) {
    console.log('Caught custom error');
  }
}
