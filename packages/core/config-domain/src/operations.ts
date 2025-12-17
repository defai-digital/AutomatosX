/**
 * Configuration Operations
 *
 * Pure functions for config manipulation (immutable operations).
 */

import type { AutomatosXConfig } from '@automatosx/contracts';

// ============================================================================
// Path Operations
// ============================================================================

/**
 * Parses a config path into segments
 * @example parsePath('providers.0.providerId') => ['providers', '0', 'providerId']
 */
export function parsePath(path: string): string[] {
  if (path === '') {
    return [];
  }
  return path.split('.');
}

/**
 * Gets a value from config by path
 * @example getValue(config, 'providers.0.providerId') => 'claude'
 */
export function getValue<T>(
  config: AutomatosXConfig,
  path: string
): T | undefined {
  const segments = parsePath(path);

  let current: unknown = config;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }

    // Handle array access with numeric index
    if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current as T | undefined;
}

/**
 * Sets a value in config by path (immutable)
 * @example setValue(config, 'logLevel', 'debug') => new config with updated logLevel
 */
export function setValue(
  config: AutomatosXConfig,
  path: string,
  value: unknown
): AutomatosXConfig {
  const segments = parsePath(path);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }

  return setNestedValue(config, segments, value) as AutomatosXConfig;
}

/**
 * Recursively sets a nested value (immutable)
 */
function setNestedValue(
  obj: unknown,
  segments: string[],
  value: unknown
): unknown {
  if (segments.length === 0) {
    return value;
  }

  const first = segments[0];
  const rest = segments.slice(1);

  if (first === undefined) {
    return value;
  }

  if (Array.isArray(obj)) {
    const index = parseInt(first, 10);
    if (Number.isNaN(index)) {
      throw new Error(`Invalid array index: ${first}`);
    }
    const newArray = [...obj];
    newArray[index] = setNestedValue(obj[index], rest, value);
    return newArray;
  }

  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>;
    return {
      ...record,
      [first]: setNestedValue(record[first], rest, value),
    };
  }

  // Create new object if current value is not an object
  return {
    [first]: setNestedValue(undefined, rest, value),
  };
}

/**
 * Removes a value from config by path (immutable)
 */
export function removeValue(
  config: AutomatosXConfig,
  path: string
): AutomatosXConfig {
  const segments = parsePath(path);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }

  return removeNestedValue(config, segments) as AutomatosXConfig;
}

/**
 * Recursively removes a nested value (immutable)
 */
function removeNestedValue(obj: unknown, segments: string[]): unknown {
  if (segments.length === 0) {
    return undefined;
  }

  const first = segments[0];
  const rest = segments.slice(1);

  if (first === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    const index = parseInt(first, 10);
    if (Number.isNaN(index) || index < 0 || index >= obj.length) {
      return obj;
    }

    if (rest.length === 0) {
      // Remove element from array
      return [...obj.slice(0, index), ...obj.slice(index + 1)];
    }

    // Recurse into array element
    const newArray = [...obj];
    newArray[index] = removeNestedValue(obj[index], rest);
    return newArray;
  }

  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>;

    if (rest.length === 0) {
      // Remove key from object
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(record)) {
        if (key !== first) {
          result[key] = record[key];
        }
      }
      return result;
    }

    // Recurse into nested object
    return {
      ...record,
      [first]: removeNestedValue(record[first], rest),
    };
  }

  return obj;
}

// ============================================================================
// Config Merging
// ============================================================================

/**
 * Deep merges two configs (immutable)
 * Override values take precedence
 */
export function mergeConfigs(
  base: AutomatosXConfig,
  override: Partial<AutomatosXConfig>
): AutomatosXConfig {
  return deepMerge(base, override);
}

/**
 * Deep merges two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base };

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key];
    const baseValue = base[key];

    if (overrideValue === undefined) {
      continue;
    }

    if (
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(overrideValue) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = overrideValue as T[keyof T];
    }
  }

  return result;
}

// ============================================================================
// Config Comparison
// ============================================================================

/**
 * Compares two configs and returns the differences
 */
export function diffConfigs(
  oldConfig: AutomatosXConfig,
  newConfig: AutomatosXConfig
): Array<{ path: string; oldValue: unknown; newValue: unknown }> {
  const diffs: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];

  function compare(
    oldObj: unknown,
    newObj: unknown,
    currentPath: string
  ): void {
    // Handle primitives and nulls
    if (
      oldObj === newObj ||
      typeof oldObj !== 'object' ||
      typeof newObj !== 'object' ||
      oldObj === null ||
      newObj === null
    ) {
      if (oldObj !== newObj) {
        diffs.push({ path: currentPath, oldValue: oldObj, newValue: newObj });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      const maxLength = Math.max(oldObj.length, newObj.length);
      for (let i = 0; i < maxLength; i++) {
        compare(
          oldObj[i],
          newObj[i],
          currentPath !== '' ? `${currentPath}.${i}` : String(i)
        );
      }
      return;
    }

    // Handle objects
    const oldRecord = oldObj as Record<string, unknown>;
    const newRecord = newObj as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

    for (const key of allKeys) {
      compare(
        oldRecord[key],
        newRecord[key],
        currentPath !== '' ? `${currentPath}.${key}` : key
      );
    }
  }

  compare(oldConfig, newConfig, '');
  return diffs;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Checks if a path exists in the config
 */
export function hasPath(config: AutomatosXConfig, path: string): boolean {
  return getValue(config, path) !== undefined;
}

/**
 * Gets all paths in a config (flattened)
 */
export function getAllPaths(config: AutomatosXConfig): string[] {
  const paths: string[] = [];

  function traverse(obj: unknown, currentPath: string): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      paths.push(currentPath);
      obj.forEach((item, index) => {
        traverse(
          item,
          currentPath !== '' ? `${currentPath}.${index}` : String(index)
        );
      });
      return;
    }

    if (typeof obj === 'object') {
      if (currentPath !== '') {
        paths.push(currentPath);
      }
      for (const [key, value] of Object.entries(obj)) {
        traverse(value, currentPath !== '' ? `${currentPath}.${key}` : key);
      }
      return;
    }

    paths.push(currentPath);
  }

  traverse(config, '');
  return paths;
}
