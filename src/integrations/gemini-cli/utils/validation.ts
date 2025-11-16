/**
 * Gemini CLI Integration - Validation Utilities
 *
 * Configuration and input validation functions.
 *
 * @module integrations/gemini-cli/utils/validation
 */

import type {
  GeminiConfig,
  GeminiMCPServer,
  ValidationResult,
  TomlCommand,
} from '../types.js';

/**
 * Allowed commands for MCP servers
 */
const ALLOWED_COMMANDS = [
  'node',
  'python',
  'python3',
  'ax',
  'gemini',
  'npm',
  'npx',
];

/**
 * Validate Gemini CLI configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateGeminiConfig(config: GeminiConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate structure
  if (typeof config !== 'object' || config === null) {
    errors.push('Configuration must be an object');
    return { valid: false, errors, warnings };
  }

  // Validate MCP servers if present
  if (config.mcpServers) {
    if (typeof config.mcpServers !== 'object') {
      errors.push('mcpServers must be an object');
    } else {
      for (const [name, server] of Object.entries(config.mcpServers)) {
        const serverResult = validateMCPServer(server, name);
        errors.push(...serverResult.errors);
        warnings.push(...serverResult.warnings);
      }
    }
  }

  // Validate MCP settings if present
  if (config.mcp) {
    if (typeof config.mcp !== 'object') {
      errors.push('mcp must be an object');
    } else if (
      config.mcp.discovery &&
      typeof config.mcp.discovery !== 'object'
    ) {
      errors.push('mcp.discovery must be an object');
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
 * @param server - Server configuration to validate
 * @param name - Server name for error messages
 * @returns Validation result
 */
export function validateMCPServer(
  server: GeminiMCPServer,
  name: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!server.command) {
    errors.push(`${name}: command is required`);
  } else {
    // Validate command is in whitelist
    const baseCommand = server.command.split('/').pop() || server.command;
    if (!ALLOWED_COMMANDS.includes(baseCommand)) {
      warnings.push(
        `${name}: command "${server.command}" is not in the whitelist. ` +
          `Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`
      );
    }
  }

  // Validate transport
  if (server.transport) {
    const validTransports = ['stdio', 'sse', 'http'];
    if (!validTransports.includes(server.transport)) {
      errors.push(
        `${name}: invalid transport "${server.transport}". ` +
          `Must be one of: ${validTransports.join(', ')}`
      );
    }

    // Warn about remote servers
    if (server.transport !== 'stdio') {
      warnings.push(
        `${name}: Remote MCP server (${server.transport}). ` +
          'Ensure you trust the source.'
      );
    }
  }

  // Validate URL for remote transports
  if (
    (server.transport === 'sse' || server.transport === 'http') &&
    !server.url
  ) {
    errors.push(
      `${name}: url is required for ${server.transport} transport`
    );
  }

  // Validate args
  if (server.args && !Array.isArray(server.args)) {
    errors.push(`${name}: args must be an array`);
  }

  // Validate env
  if (server.env) {
    if (typeof server.env !== 'object' || Array.isArray(server.env)) {
      errors.push(`${name}: env must be an object`);
    } else {
      // Check for sensitive data
      for (const [key, value] of Object.entries(server.env)) {
        if (
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token')
        ) {
          warnings.push(
            `${name}: Environment variable "${key}" may contain sensitive data. ` +
              'Consider using a secure credential store.'
          );
        }

        if (typeof value !== 'string') {
          errors.push(
            `${name}: env["${key}"] must be a string, got ${typeof value}`
          );
        }
      }
    }
  }

  // Validate auth
  if (server.auth) {
    if (typeof server.auth !== 'object') {
      errors.push(`${name}: auth must be an object`);
    } else {
      if (server.auth.type && server.auth.type !== 'oauth2') {
        warnings.push(
          `${name}: Unknown auth type "${server.auth.type}". Only "oauth2" is documented.`
        );
      }

      if (server.auth.clientSecret) {
        warnings.push(
          `${name}: Client secret in config file. Use secure credential storage instead.`
        );
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
 * Validate TOML command structure
 *
 * @param command - Command to validate
 * @param name - Command name for error messages
 * @returns Validation result
 */
export function validateTomlCommand(
  command: TomlCommand,
  name: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!command.description) {
    errors.push(`${name}: description is required`);
  } else if (typeof command.description !== 'string') {
    errors.push(`${name}: description must be a string`);
  }

  if (!command.prompt) {
    errors.push(`${name}: prompt is required`);
  } else if (typeof command.prompt !== 'string') {
    errors.push(`${name}: prompt must be a string`);
  } else {
    // Check for placeholder usage
    if (!command.prompt.includes('{{args}}')) {
      warnings.push(
        `${name}: prompt does not contain {{args}} placeholder. ` +
          'User input will not be included in the command.'
      );
    }

    // Warn about very long prompts
    if (command.prompt.length > 10000) {
      warnings.push(
        `${name}: prompt is very long (${command.prompt.length} characters). ` +
          'Consider splitting into multiple commands.'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate command name
 *
 * @param name - Command name to validate
 * @returns True if valid
 */
export function isValidCommandName(name: string): boolean {
  // Must be lowercase alphanumeric with hyphens, colons for namespaces
  return /^[a-z0-9]+([:-][a-z0-9]+)*$/.test(name);
}

/**
 * Validate server name
 *
 * @param name - Server name to validate
 * @returns True if valid
 */
export function isValidServerName(name: string): boolean {
  // Must be lowercase alphanumeric with hyphens or underscores
  return /^[a-z0-9]+([_-][a-z0-9]+)*$/.test(name);
}

/**
 * Sanitize environment variables
 *
 * @param env - Environment variables to sanitize
 * @returns Sanitized environment variables
 */
export function sanitizeEnv(
  env: Record<string, string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // Remove sensitive-looking values
    if (
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token')
    ) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if configuration has any warnings
 *
 * @param config - Configuration to check
 * @returns True if there are warnings
 */
export function hasWarnings(config: GeminiConfig): boolean {
  const result = validateGeminiConfig(config);
  return result.warnings.length > 0;
}

/**
 * Get validation summary
 *
 * @param result - Validation result
 * @returns Human-readable summary
 */
export function getValidationSummary(result: ValidationResult): string {
  const parts: string[] = [];

  if (result.valid) {
    parts.push('✓ Configuration is valid');
  } else {
    parts.push(`✗ Configuration has ${result.errors.length} error(s)`);
  }

  if (result.warnings.length > 0) {
    parts.push(`⚠ ${result.warnings.length} warning(s)`);
  }

  return parts.join(' | ');
}
