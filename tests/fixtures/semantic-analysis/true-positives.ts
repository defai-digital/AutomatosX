/**
 * True Positive Test Fixtures - Semantic Dead Code Analysis
 *
 * These symbols ARE dead code and SHOULD be detected.
 * Used to measure recall (true positive rate).
 *
 * @module tests/fixtures/semantic-analysis/true-positives
 */

// ============================================================================
// 1. Completely Unused Variables
// ============================================================================

// Should be detected: declared but never used
const unusedConstant = 42;

// Should be detected: let variable never read
let unusedLetVariable = 'hello';

// Should be detected: var variable never used
var unusedVarVariable = true;

// ============================================================================
// 2. Unused Functions
// ============================================================================

// Should be detected: function defined but never called
function unusedFunction() {
  return 'never called';
}

// Should be detected: arrow function never used
const unusedArrowFunction = () => {
  console.log('never called');
};

// Should be detected: function with parameters
function unusedFunctionWithParams(a: number, b: string): string {
  return `${a}-${b}`;
}

// ============================================================================
// 3. Unused Classes
// ============================================================================

// Should be detected: class never instantiated or referenced
class UnusedClass {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }
}

// Should be detected: abstract class with no implementations
abstract class UnusedAbstractClass {
  abstract getValue(): number;
}

// ============================================================================
// 4. Type-Only Usage (Value Dead)
// ============================================================================

// Should be detected as value-dead: class only used in type position
class OnlyUsedAsType {
  doSomething(): void {
    console.log('action');
  }
}

// This uses OnlyUsedAsType in type position only
function acceptsType(input: OnlyUsedAsType): void {
  // Note: input is typed, but OnlyUsedAsType is never instantiated
  console.log(input);
}

// ============================================================================
// 5. Unused Interfaces and Type Aliases (when includeTypeOnly=true)
// ============================================================================

// Should be detected: interface never used
interface UnusedInterface {
  id: number;
  name: string;
}

// Should be detected: type alias never used
type UnusedTypeAlias = {
  foo: string;
  bar: number;
};

// Should be detected: complex generic type never used
type UnusedGenericType<T, U> = {
  left: T;
  right: U;
};

// ============================================================================
// 6. Unused Enums
// ============================================================================

// Should be detected: enum never used
enum UnusedEnum {
  Value1 = 'VALUE1',
  Value2 = 'VALUE2',
  Value3 = 'VALUE3',
}

// Should be detected: const enum never used
const enum UnusedConstEnum {
  A = 1,
  B = 2,
  C = 3,
}

// ============================================================================
// 7. Self-Reference Only
// ============================================================================

// Should be detected: only references itself recursively but never called from outside
function selfReferenceOnly(n: number): number {
  if (n <= 0) return 0;
  return selfReferenceOnly(n - 1); // recursive but never called
}

// ============================================================================
// 8. Unused Imports (in real usage, these would come from other files)
// These are simulated with local variables
// ============================================================================

// Simulating unused import scenario:
// import { neverUsedHelper } from './helpers';
// const neverUsedHelper = () => {}; // Never called

// ============================================================================
// 9. Unused Parameters
// ============================================================================

// Should be detected: unused parameters in function
function hasUnusedParams(used: string, _unused: number, alsoUnused: boolean): string {
  // only 'used' is accessed
  return used;
}

// ============================================================================
// 10. Private Members Never Used
// ============================================================================

class ClassWithDeadPrivates {
  private usedValue: number;
  private unusedValue: string; // Should be detected
  private unusedMethod(): void { // Should be detected
    console.log('never called');
  }

  constructor() {
    this.usedValue = 42;
    this.unusedValue = 'dead'; // Assigned but never read
  }

  public getUsedValue(): number {
    return this.usedValue;
  }
}

// Use the class to ensure it's not itself dead
const instance = new ClassWithDeadPrivates();
console.log(instance.getUsedValue());

// ============================================================================
// Export some used items to prevent file-level dead code detection
// ============================================================================

// These are used (exported and assumed to be imported elsewhere)
export function usedExportedFunction(): void {
  console.log('I am used');
}

export const usedExportedConstant = 'I am used too';

// Call hasUnusedParams to use it (but its params are still partially unused)
console.log(hasUnusedParams('hello', 42, true));

// Use acceptsType (but OnlyUsedAsType class is never instantiated)
acceptsType(null as unknown as OnlyUsedAsType);
