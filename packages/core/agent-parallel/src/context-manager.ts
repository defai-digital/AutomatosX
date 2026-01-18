/**
 * Context Manager
 *
 * Manages shared immutable context for parallel agent execution.
 * Ensures context is frozen before execution and cannot be modified.
 *
 * Invariants:
 * - INV-APE-003: Shared context immutable during execution
 * - INV-APE-300: Context snapshot timing (frozen before first task)
 */

import type { SharedContext } from '@defai.digital/contracts';
import { ParallelExecutionErrorCodes } from '@defai.digital/contracts';
import type { ContextManager } from './types.js';

/**
 * Error thrown when context mutation is attempted
 */
export class ContextMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextMutationError';
  }

  static readonly code = ParallelExecutionErrorCodes.CONTEXT_MUTATION;
}

/**
 * Deep freeze an object and all nested objects
 * INV-APE-003: Ensures true immutability
 */
function deepFreeze<T extends object>(obj: T): T {
  // Get property names
  const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[];

  // Freeze nested objects first
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }

  // Freeze self
  return Object.freeze(obj);
}

/**
 * Creates a context manager for shared immutable context
 */
export function createContextManager(): ContextManager {
  let context: SharedContext | null = null;
  let frozen = false;

  return {
    /**
     * Create frozen shared context
     * INV-APE-300: Context snapshot timing
     */
    create(data: Record<string, unknown>): SharedContext {
      // Deep clone to prevent external mutation
      const clonedData = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

      // Create context object
      const newContext: SharedContext = {
        data: clonedData,
        createdAt: new Date().toISOString(),
        version: '1',
      };

      // Deep freeze the entire context
      // INV-APE-003: Immutable during execution
      context = deepFreeze(newContext);
      frozen = true;

      return context;
    },

    /**
     * Get read-only view of context
     */
    get(): SharedContext | null {
      return context;
    },

    /**
     * Check if context is frozen/immutable
     */
    isFrozen(): boolean {
      return frozen && context !== null && Object.isFrozen(context);
    },

    /**
     * Clear context (for cleanup after execution)
     */
    clear(): void {
      context = null;
      frozen = false;
    },
  };
}

/**
 * Creates a proxy that throws on any mutation attempt
 * Alternative approach for stricter runtime enforcement
 */
export function createImmutableContextProxy<T extends Record<string, unknown>>(
  data: T
): Readonly<T> {
  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      // Recursively wrap nested objects
      if (value && typeof value === 'object') {
        return createImmutableContextProxy(value as Record<string, unknown>);
      }
      return value;
    },

    set(_target, prop) {
      throw new ContextMutationError(
        `Cannot modify shared context: attempted to set "${String(prop)}". ` +
          'Shared context is immutable during parallel execution (INV-APE-003).'
      );
    },

    deleteProperty(_target, prop) {
      throw new ContextMutationError(
        `Cannot modify shared context: attempted to delete "${String(prop)}". ` +
          'Shared context is immutable during parallel execution (INV-APE-003).'
      );
    },

    defineProperty(_target, prop) {
      throw new ContextMutationError(
        `Cannot modify shared context: attempted to define "${String(prop)}". ` +
          'Shared context is immutable during parallel execution (INV-APE-003).'
      );
    },

    setPrototypeOf() {
      throw new ContextMutationError(
        'Cannot modify shared context prototype. ' +
          'Shared context is immutable during parallel execution (INV-APE-003).'
      );
    },
  };

  return new Proxy(data, handler) as Readonly<T>;
}

/**
 * Validates that context data is JSON-serializable
 */
export function validateContextData(
  data: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check JSON serializability
    JSON.stringify(data);
  } catch (e) {
    errors.push(
      `Context data is not JSON-serializable: ${e instanceof Error ? e.message : 'Unknown error'}`
    );
    return { valid: false, errors };
  }

  // Check for functions (not serializable)
  function checkForFunctions(obj: unknown, path: string): void {
    if (typeof obj === 'function') {
      errors.push(`Context contains function at ${path}`);
    } else if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => checkForFunctions(item, `${path}[${index}]`));
      } else {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          checkForFunctions(value, path ? `${path}.${key}` : key);
        }
      }
    }
  }

  checkForFunctions(data, '');

  // Check for circular references (JSON.stringify would have failed)
  // Already caught above

  return {
    valid: errors.length === 0,
    errors,
  };
}
