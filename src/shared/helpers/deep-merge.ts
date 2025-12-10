/**
 * Deep Merge Utility
 *
 * Provides type-safe deep merging of configuration objects with proper handling
 * of null values (explicit disable), undefined values (use defaults), and arrays (replace).
 */

/**
 * Check if value is a plain object (not array, null, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merge two objects with proper null/undefined handling
 *
 * Behavior:
 * - `user === null` or `user === undefined` → returns defaults
 * - `user.key === null` → feature disabled (result.key = undefined)
 * - `user.key === undefined` → use default (result.key = defaults.key)
 * - `user.key === object` → recursively merge with defaults.key
 * - `user.key === primitive/array` → replace defaults.key
 *
 * @param defaults - Default configuration object
 * @param user - User-provided partial configuration
 * @returns Merged configuration with user overrides
 *
 * @example
 * ```typescript
 * const defaults = {
 *   memory: {
 *     maxEntries: 10000,
 *     search: { defaultLimit: 10 }
 *   }
 * };
 *
 * const user = {
 *   memory: {
 *     maxEntries: 5000,
 *     search: null  // Disable search
 *   }
 * };
 *
 * const result = deepMerge(defaults, user);
 * // {
 * //   memory: {
 * //     maxEntries: 5000,
 * //     search: undefined  // Disabled
 * //   }
 * // }
 * ```
 */
export function deepMerge<T extends object>(
  defaults: T,
  user: Partial<T> | undefined | null
): T {
  // Handle null/undefined user config
  // BUG FIX: Return a shallow copy instead of the original reference
  // to prevent accidental mutation of the defaults object
  if (user === null || user === undefined) {
    return { ...defaults };
  }

  // Start with shallow copy of defaults - use Object.assign for proper typing
  const result = Object.assign({}, defaults);

  // Merge user values using Object.keys with proper typing
  const userKeys = Object.keys(user) as Array<keyof T>;
  for (const key of userKeys) {
    const userValue = user[key];

    // Explicit null = disable feature (set to undefined)
    if (userValue === null) {
      (result as Record<keyof T, unknown>)[key] = undefined;
      continue;
    }

    // Skip undefined (use default)
    if (userValue === undefined) {
      continue;
    }

    const defaultValue = defaults[key];

    // Recursively merge nested objects
    if (isPlainObject(userValue) && isPlainObject(defaultValue)) {
      (result as Record<keyof T, unknown>)[key] = deepMerge(
        defaultValue as object,
        userValue as Partial<object>
      );
    } else {
      // Replace primitives and arrays
      (result as Record<keyof T, unknown>)[key] = userValue;
    }
  }

  return result;
}
