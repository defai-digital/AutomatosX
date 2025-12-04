/**
 * Deep Merge Utility
 *
 * Provides type-safe deep merging of configuration objects with proper handling
 * of null values (explicit disable), undefined values (use defaults), and arrays (replace).
 */

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
  if (user === null || user === undefined) {
    return defaults;
  }

  // Start with shallow copy of defaults
  const result = { ...defaults };

  // Merge user values
  for (const key in user) {
    const userValue = user[key];

    // Explicit null = disable feature (set to undefined)
    if (userValue === null) {
      result[key] = undefined as any;
      continue;
    }

    // Skip undefined (use default)
    if (userValue === undefined) {
      continue;
    }

    const defaultValue = defaults[key];

    // Recursively merge nested objects
    if (
      typeof userValue === 'object' &&
      typeof defaultValue === 'object' &&
      !Array.isArray(userValue) &&
      !Array.isArray(defaultValue) &&
      userValue !== null &&
      defaultValue !== null
    ) {
      result[key] = deepMerge(defaultValue, userValue as any);
    } else {
      // Replace primitives and arrays
      result[key] = userValue as any;
    }
  }

  return result;
}
