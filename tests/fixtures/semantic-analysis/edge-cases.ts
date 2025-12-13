/**
 * Edge Case Test Fixtures - Semantic Dead Code Analysis
 *
 * These are tricky cases that often cause false positives.
 * The analyzer should handle these correctly.
 *
 * @module tests/fixtures/semantic-analysis/edge-cases
 */

// ============================================================================
// 1. Side-Effect Imports (should NOT be flagged)
// ============================================================================

// Simulating: import './polyfill';
// Side-effect imports have no named imports but execute code
// We can't directly simulate this in a single file

// ============================================================================
// 2. Declaration Merging (interface + namespace)
// ============================================================================

// Interface declaration
interface MergedSymbol {
  name: string;
}

// Namespace declaration (merges with interface)
namespace MergedSymbol {
  export const VERSION = '1.0.0';
}

// Both should be considered used if either is used
const mergedUsage: MergedSymbol = { name: 'test' };
console.log(mergedUsage.name, MergedSymbol.VERSION);

// ============================================================================
// 3. Class + Interface Merge
// ============================================================================

class ClassWithMerge {
  value: number = 0;
}

interface ClassWithMerge {
  additionalProp?: string;
}

// Using the merged type
const merged: ClassWithMerge = new ClassWithMerge();
merged.additionalProp = 'extra';
console.log(merged.value, merged.additionalProp);

// ============================================================================
// 4. Module Augmentation (should not flag augmented types)
// ============================================================================

// Simulating module augmentation
// declare module 'express' {
//   interface Request {
//     user?: User;
//   }
// }

// ============================================================================
// 5. React Component Pattern (JSX usage)
// ============================================================================

// Components used in JSX are referenced without explicit calls
// In a .tsx file: <MyComponent /> would use MyComponent

interface ComponentProps {
  title: string;
}

// This would be used as <MyComponent title="Hello" /> in JSX
function MyComponent(props: ComponentProps): string {
  return `<div>${props.title}</div>`; // Simulated JSX return
}

// Simulating JSX usage
const element = MyComponent({ title: 'Hello' });
console.log(element);

// ============================================================================
// 6. Dynamic Property Access
// ============================================================================

const dynamicKeys = {
  methodA: () => 'A',
  methodB: () => 'B',
  methodC: () => 'C', // Might appear unused but accessed dynamically
};

// Dynamic access - all methods are potentially used
const key = 'methodC' as keyof typeof dynamicKeys;
console.log(dynamicKeys[key]());

// ============================================================================
// 7. Object.keys/values/entries Pattern
// ============================================================================

const config = {
  setting1: 'value1',
  setting2: 'value2',
  setting3: 'value3', // Accessed via Object.entries
};

// All properties are used via Object.entries
for (const [key, value] of Object.entries(config)) {
  console.log(`${key}: ${value}`);
}

// ============================================================================
// 8. Spread Operator Usage
// ============================================================================

const defaults = {
  color: 'blue',
  size: 'medium',
  unusedDefault: 'maybe used', // Used via spread
};

// All properties from defaults are used via spread
const options = { ...defaults, color: 'red' };
console.log(options);

// ============================================================================
// 9. Destructuring with Rest
// ============================================================================

interface DataObject {
  keep: string;
  alsoKeep: string;
  restProp1: number;
  restProp2: number;
}

const data: DataObject = {
  keep: 'a',
  alsoKeep: 'b',
  restProp1: 1,
  restProp2: 2, // Captured in rest
};

// rest captures restProp1 and restProp2
const { keep, alsoKeep, ...rest } = data;
console.log(keep, alsoKeep, rest);

// ============================================================================
// 10. String Literal Types with Mapping
// ============================================================================

type Status = 'pending' | 'active' | 'completed';

const statusMessages: Record<Status, string> = {
  pending: 'Waiting...',
  active: 'In progress',
  completed: 'Done!', // All used in Record
};

function getStatusMessage(status: Status): string {
  return statusMessages[status];
}

console.log(getStatusMessage('completed'));

// ============================================================================
// 11. Overloaded Functions
// ============================================================================

// Function overloads
function process(input: string): string;
function process(input: number): number;
function process(input: string | number): string | number {
  if (typeof input === 'string') {
    return input.toUpperCase();
  }
  return input * 2;
}

// Using overloaded function
console.log(process('hello'));
console.log(process(5));

// ============================================================================
// 12. Getter/Setter Usage
// ============================================================================

class WithAccessors {
  private _value: number = 0;

  // Getter might appear unused if only setter is directly called
  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._value = v;
  }
}

const accessor = new WithAccessors();
accessor.value = 42; // Uses setter
console.log(accessor.value); // Uses getter

// ============================================================================
// 13. Static Members
// ============================================================================

class WithStatics {
  static readonly VERSION = '1.0.0';
  static helper(): string {
    return 'helped';
  }

  // Instance method that uses static
  getVersion(): string {
    return WithStatics.VERSION;
  }
}

// Using static members directly
console.log(WithStatics.VERSION);
console.log(WithStatics.helper());

const withStatic = new WithStatics();
console.log(withStatic.getVersion());

// ============================================================================
// 14. Symbol Used in typeof
// ============================================================================

const templateObject = {
  field1: 'string',
  field2: 42,
};

// typeof usage - templateObject is used
type TemplateType = typeof templateObject;

const clone: TemplateType = { ...templateObject };
console.log(clone);

// ============================================================================
// 15. Conditional Types
// ============================================================================

type IsString<T> = T extends string ? true : false;

// Using the conditional type
type Test1 = IsString<string>; // true
type Test2 = IsString<number>; // false

const test1: Test1 = true;
const test2: Test2 = false;
console.log(test1, test2);

// ============================================================================
// 16. Mapped Types
// ============================================================================

type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

interface Mutable {
  x: number;
  y: number;
}

// Using the mapped type
const immutable: Readonly<Mutable> = { x: 1, y: 2 };
console.log(immutable);

// ============================================================================
// 17. Tuple Types
// ============================================================================

type Point = [number, number];

function distance(p1: Point, p2: Point): number {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

const origin: Point = [0, 0];
const target: Point = [3, 4];
console.log(distance(origin, target));

// ============================================================================
// 18. Index Signatures
// ============================================================================

interface StringMap {
  [key: string]: string;
}

const translations: StringMap = {
  hello: 'hola',
  goodbye: 'adios',
};

// All properties potentially used via dynamic access
console.log(translations['hello']);

// ============================================================================
// 19. Constructor Assignment
// ============================================================================

class AutoAssign {
  // These are used - assigned via constructor parameter
  constructor(
    public name: string,
    private secret: string,
    readonly id: number
  ) {}

  reveal(): string {
    return this.secret; // secret is used
  }
}

const auto = new AutoAssign('test', 'hidden', 1);
console.log(auto.name, auto.id, auto.reveal());

// ============================================================================
// 20. Exported Re-export Pattern
// ============================================================================

// Internal helper that gets re-exported
function internalHelper(): string {
  return 'helper';
}

// Re-export makes it an entry point
export { internalHelper };

// ============================================================================
// 21. Symbol Used Only in Tests (annotation pattern)
// ============================================================================

// @internal - marked for internal use
function _testHelper(): void {
  // Used in test files, not production code
  console.log('test helper');
}

// Export for test access
export { _testHelper };

// ============================================================================
// 22. Ambient Declarations
// ============================================================================

// declare const __DEV__: boolean;
// Ambient declarations should not be flagged

// ============================================================================
// 23. Type Predicate Return
// ============================================================================

interface Cat {
  meow(): void;
}

interface Dog {
  bark(): void;
}

type Animal = Cat | Dog;

// Type predicate function - Cat is used in type position
function isCat(animal: Animal): animal is Cat {
  return 'meow' in animal;
}

const animal: Animal = { meow: () => console.log('meow') };
if (isCat(animal)) {
  animal.meow(); // Type narrowed to Cat
}

// ============================================================================
// 24. Assertion Functions
// ============================================================================

function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Not a string');
  }
}

const maybeString: unknown = 'hello';
assertIsString(maybeString);
console.log(maybeString.toUpperCase()); // Type narrowed to string
