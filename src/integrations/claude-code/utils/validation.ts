/**
 * Claude Code Integration - Validation Utilities
 *
 * Provides validation functions for Claude Code configurations,
 * commands, and MCP servers.
 *
 * @module integrations/claude-code/utils/validation
 */

import type {
  ClaudeConfig,
  ClaudeCommand,
  ClaudeMCPServer,
  MCPManifest,
  ValidationResult,
} from '../types.js';

/**
 * Validate Claude Code configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateClaudeConfig(config: ClaudeConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if config is an object
  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be an object');
    return { valid: false, errors, warnings };
  }

  // Validate model settings if present
  if (config.model !== undefined) {
    if (typeof config.model !== 'object' || config.model === null) {
      errors.push('model must be an object');
    } else {
      // Validate model name
      if (config.model.name !== undefined && typeof config.model.name !== 'string') {
        errors.push('model.name must be a string');
      }

      // Validate temperature
      if (config.model.temperature !== undefined) {
        if (typeof config.model.temperature !== 'number') {
          errors.push('model.temperature must be a number');
        } else if (config.model.temperature < 0 || config.model.temperature > 2) {
          warnings.push('model.temperature should be between 0 and 2');
        }
      }

      // Validate maxTokens
      if (config.model.maxTokens !== undefined) {
        if (typeof config.model.maxTokens !== 'number') {
          errors.push('model.maxTokens must be a number');
        } else if (config.model.maxTokens < 1) {
          errors.push('model.maxTokens must be positive');
        }
      }
    }
  }

  // Validate instructions if present
  if (config.instructions !== undefined) {
    if (typeof config.instructions !== 'object' || config.instructions === null) {
      errors.push('instructions must be an object');
    } else {
      if (config.instructions.global !== undefined && typeof config.instructions.global !== 'string') {
        errors.push('instructions.global must be a string');
      }
      if (config.instructions.project !== undefined && typeof config.instructions.project !== 'string') {
        errors.push('instructions.project must be a string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate MCP server configuration
 *
 * @param server - MCP server to validate
 * @param name - Server name for error messages
 * @returns Validation result
 */
export function validateMCPServer(
  server: ClaudeMCPServer,
  name: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if server is an object
  if (typeof server !== 'object' || server === null) {
    errors.push(`Server "${name}" must be an object`);
    return { valid: false, errors, warnings };
  }

  // Validate command (required)
  if (!server.command) {
    errors.push(`Server "${name}" missing required field: command`);
  } else if (typeof server.command !== 'string') {
    errors.push(`Server "${name}" command must be a string`);
  } else if (server.command.trim().length === 0) {
    errors.push(`Server "${name}" command cannot be empty`);
  }

  // Validate args (optional array)
  if (server.args !== undefined) {
    if (!Array.isArray(server.args)) {
      errors.push(`Server "${name}" args must be an array`);
    } else {
      for (let i = 0; i < server.args.length; i++) {
        if (typeof server.args[i] !== 'string') {
          errors.push(`Server "${name}" args[${i}] must be a string`);
        }
      }
    }
  }

  // Validate env (optional object)
  if (server.env !== undefined) {
    if (typeof server.env !== 'object' || server.env === null || Array.isArray(server.env)) {
      errors.push(`Server "${name}" env must be an object`);
    } else {
      // Check for sensitive environment variables
      const sensitiveKeys = ['PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'APIKEY', 'API_KEY'];
      for (const key of Object.keys(server.env)) {
        if (typeof server.env[key] !== 'string') {
          errors.push(`Server "${name}" env.${key} must be a string`);
        }
        const upperKey = key.toUpperCase();
        if (sensitiveKeys.some(sensitive => upperKey.includes(sensitive))) {
          warnings.push(`Server "${name}" env.${key} may contain sensitive data`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate MCP manifest
 *
 * @param manifest - MCP manifest to validate
 * @returns Validation result
 */
export function validateMCPManifest(manifest: MCPManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if manifest is an object
  if (typeof manifest !== 'object' || manifest === null) {
    errors.push('Manifest must be an object');
    return { valid: false, errors, warnings };
  }

  // Validate version (optional but recommended)
  if (manifest.version !== undefined) {
    if (typeof manifest.version !== 'string') {
      errors.push('version must be a string');
    }
  } else {
    warnings.push('version is not specified');
  }

  // Validate mcpServers (optional)
  if (manifest.mcpServers !== undefined) {
    if (typeof manifest.mcpServers !== 'object' || manifest.mcpServers === null || Array.isArray(manifest.mcpServers)) {
      errors.push('mcpServers must be an object');
    } else {
      // Validate each server
      for (const [name, server] of Object.entries(manifest.mcpServers)) {
        if (!isValidServerName(name)) {
          errors.push(`Invalid server name: "${name}"`);
        }
        const serverResult = validateMCPServer(server, name);
        errors.push(...serverResult.errors);
        warnings.push(...serverResult.warnings);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Claude Code command
 *
 * @param command - Command to validate
 * @returns Validation result
 */
export function validateCommand(command: ClaudeCommand): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate name
  if (!command.name) {
    errors.push('Command name is required');
  } else if (!isValidCommandName(command.name)) {
    errors.push(`Invalid command name: "${command.name}"`);
  }

  // Validate path
  if (!command.path) {
    errors.push('Command path is required');
  } else if (!command.path.endsWith('.md')) {
    errors.push('Command file must have .md extension');
  }

  // Validate content
  if (!command.content || command.content.trim().length === 0) {
    errors.push('Command content cannot be empty');
  }

  // Validate description
  if (!command.description || command.description.trim().length === 0) {
    warnings.push('Command description is empty');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a command name is valid
 *
 * Valid command names:
 * - Contain only lowercase letters, numbers, and hyphens
 * - Start with a letter
 * - No consecutive hyphens
 *
 * @param name - Command name to check
 * @returns True if valid
 */
export function isValidCommandName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Must start with a letter
  if (!/^[a-z]/.test(name)) {
    return false;
  }

  // Only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return false;
  }

  // No consecutive hyphens
  if (/--/.test(name)) {
    return false;
  }

  // No trailing hyphen
  if (name.endsWith('-')) {
    return false;
  }

  return true;
}

/**
 * Check if a server name is valid
 *
 * Valid server names:
 * - Contain only letters, numbers, underscores, and hyphens
 * - Start with a letter or underscore
 *
 * @param name - Server name to check
 * @returns True if valid
 */
export function isValidServerName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Must start with a letter or underscore
  if (!/^[a-zA-Z_]/.test(name)) {
    return false;
  }

  // Only letters, numbers, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return false;
  }

  return true;
}

/**
 * Check if a validation result has warnings
 *
 * @param result - Validation result to check
 * @returns True if has warnings
 */
export function hasWarnings(result: ValidationResult): boolean {
  return result.warnings.length > 0;
}

/**
 * Get a summary of validation result
 *
 * @param result - Validation result
 * @returns Human-readable summary
 */
export function getValidationSummary(result: ValidationResult): string {
  const parts: string[] = [];

  if (result.valid) {
    parts.push('✓ Valid');
  } else {
    parts.push(`✗ Invalid (${result.errors.length} error(s))`);
  }

  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning(s)`);
  }

  return parts.join(', ');
}
