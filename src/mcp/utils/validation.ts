/**
 * MCP Input Validation Utilities
 *
 * Provides comprehensive validation for MCP tool parameters to prevent
 * security vulnerabilities like path traversal, injection attacks, etc.
 */

import { resolve, isAbsolute, sep } from 'path';
import { McpErrorCode } from '../types.js';

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: McpErrorCode = McpErrorCode.InvalidParams,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a path parameter to prevent path traversal attacks
 *
 * Security checks:
 * - Rejects path traversal patterns (.., ~/)
 * - Rejects absolute paths
 * - Rejects system directories (/etc, /var, /usr, C:\, etc.)
 * - Ensures path stays within project boundary
 *
 * @param path - Path to validate
 * @param paramName - Parameter name for error messages
 * @param projectRoot - Project root directory (defaults to process.cwd())
 * @throws {ValidationError} If path is invalid or potentially malicious
 */
export function validatePathParameter(
  path: string,
  paramName: string,
  projectRoot: string = process.cwd()
): void {
  // Reject empty paths
  if (!path || path.trim() === '') {
    throw new ValidationError(
      `Invalid ${paramName}: path cannot be empty`,
      McpErrorCode.InvalidParams,
      { path, paramName }
    );
  }

  // Dangerous patterns that indicate path traversal attempts
  const dangerousPatterns = [
    '../',          // Parent directory traversal (Unix)
    '..\\',         // Parent directory traversal (Windows)
    '~/',           // Home directory (Unix)
    '~\\',          // Home directory (Windows)
    '/etc/',        // System directory (Unix)
    '/var/',        // System directory (Unix)
    '/usr/',        // System directory (Unix)
    '/root/',       // Root home directory (Unix)
    'C:\\',         // System drive (Windows)
    'C:/',          // System drive (Windows, alt format)
    'D:\\',         // Common data drive (Windows)
    'D:/',          // Common data drive (Windows, alt format)
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (path.includes(pattern)) {
      throw new ValidationError(
        `Invalid ${paramName}: path contains dangerous pattern "${pattern}"`,
        McpErrorCode.InvalidParams,
        { path, paramName, pattern }
      );
    }
  }

  // Reject absolute paths
  if (isAbsolute(path)) {
    throw new ValidationError(
      `Invalid ${paramName}: absolute paths are not allowed`,
      McpErrorCode.InvalidParams,
      { path, paramName }
    );
  }

  // Resolve path relative to project root and check boundary
  try {
    const resolvedPath = resolve(projectRoot, path);
    const normalizedRoot = resolve(projectRoot);

    // Ensure resolved path starts with project root
    // This catches traversal attempts that might slip through pattern checks
    if (!resolvedPath.startsWith(normalizedRoot + sep) && resolvedPath !== normalizedRoot) {
      throw new ValidationError(
        `Invalid ${paramName}: path escapes project boundary`,
        McpErrorCode.InvalidParams,
        { path, paramName, projectRoot, resolvedPath }
      );
    }
  } catch (error) {
    // If path resolution fails, it's suspicious
    throw new ValidationError(
      `Invalid ${paramName}: path resolution failed`,
      McpErrorCode.InvalidParams,
      { path, paramName, error: String(error) }
    );
  }

  // Check for null bytes (common injection technique)
  if (path.includes('\0')) {
    throw new ValidationError(
      `Invalid ${paramName}: path contains null byte`,
      McpErrorCode.InvalidParams,
      { path, paramName }
    );
  }

  // Check for special characters that might be problematic
  const suspiciousChars = /[<>:|"]/;
  if (suspiciousChars.test(path)) {
    throw new ValidationError(
      `Invalid ${paramName}: path contains invalid characters`,
      McpErrorCode.InvalidParams,
      { path, paramName }
    );
  }
}

/**
 * Validates an agent name parameter
 *
 * Agent names should be simple alphanumeric strings with hyphens/underscores.
 * No path separators, no special characters.
 *
 * @param name - Agent name to validate
 * @throws {ValidationError} If name is invalid
 */
export function validateAgentName(name: string): void {
  // Reject empty names
  if (!name || name.trim() === '') {
    throw new ValidationError(
      'Invalid agent name: name cannot be empty',
      McpErrorCode.InvalidParams,
      { name }
    );
  }

  // Reject path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new ValidationError(
      'Invalid agent name: path traversal detected',
      McpErrorCode.InvalidParams,
      { name }
    );
  }

  // Reject absolute paths
  if (isAbsolute(name)) {
    throw new ValidationError(
      'Invalid agent name: absolute paths not allowed',
      McpErrorCode.InvalidParams,
      { name }
    );
  }

  // Agent names should match pattern: alphanumeric, hyphens, underscores
  const validNamePattern = /^[a-zA-Z0-9_-]+$/;
  if (!validNamePattern.test(name)) {
    throw new ValidationError(
      'Invalid agent name: must contain only letters, numbers, hyphens, and underscores',
      McpErrorCode.InvalidParams,
      { name }
    );
  }

  // Prevent excessively long names (DoS protection)
  if (name.length > 100) {
    throw new ValidationError(
      'Invalid agent name: name too long (max 100 characters)',
      McpErrorCode.InvalidParams,
      { name, length: name.length }
    );
  }
}

/**
 * Validates a string input parameter
 *
 * @param value - String to validate
 * @param paramName - Parameter name for error messages
 * @param options - Validation options
 * @throws {ValidationError} If value is invalid
 */
export function validateStringParameter(
  value: string,
  paramName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): void {
  const { required = false, minLength, maxLength, pattern } = options;

  // Check required
  if (required && (!value || value.trim() === '')) {
    throw new ValidationError(
      `Invalid ${paramName}: value is required`,
      McpErrorCode.InvalidParams,
      { paramName }
    );
  }

  // Skip other checks if optional and empty
  if (!required && (!value || value.trim() === '')) {
    return;
  }

  // Check minimum length
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(
      `Invalid ${paramName}: value too short (min ${minLength} characters)`,
      McpErrorCode.InvalidParams,
      { paramName, value, minLength, actualLength: value.length }
    );
  }

  // Check maximum length
  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(
      `Invalid ${paramName}: value too long (max ${maxLength} characters)`,
      McpErrorCode.InvalidParams,
      { paramName, maxLength, actualLength: value.length }
    );
  }

  // Check pattern
  if (pattern && !pattern.test(value)) {
    throw new ValidationError(
      `Invalid ${paramName}: value does not match required pattern`,
      McpErrorCode.InvalidParams,
      { paramName, pattern: pattern.source }
    );
  }
}

/**
 * Validates a number parameter
 *
 * @param value - Number to validate
 * @param paramName - Parameter name for error messages
 * @param options - Validation options
 * @throws {ValidationError} If value is invalid
 */
export function validateNumberParameter(
  value: number,
  paramName: string,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): void {
  const { min, max, integer = false } = options;

  // Check if it's a number
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(
      `Invalid ${paramName}: must be a number`,
      McpErrorCode.InvalidParams,
      { paramName, value }
    );
  }

  // Check if integer is required
  if (integer && !Number.isInteger(value)) {
    throw new ValidationError(
      `Invalid ${paramName}: must be an integer`,
      McpErrorCode.InvalidParams,
      { paramName, value }
    );
  }

  // Check minimum
  if (min !== undefined && value < min) {
    throw new ValidationError(
      `Invalid ${paramName}: value too small (min ${min})`,
      McpErrorCode.InvalidParams,
      { paramName, value, min }
    );
  }

  // Check maximum
  if (max !== undefined && value > max) {
    throw new ValidationError(
      `Invalid ${paramName}: value too large (max ${max})`,
      McpErrorCode.InvalidParams,
      { paramName, value, max }
    );
  }
}
