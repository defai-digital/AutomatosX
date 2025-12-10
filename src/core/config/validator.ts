/**
 * Configuration Validator
 *
 * Validates AutomatosX configuration against schema
 */

import type { LogLevel } from '../../types/logger.js';
import { VALIDATION_LIMITS } from '../validation-limits.js';

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate entire configuration
 */
export function validateConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required top-level fields
  if (!config.providers) {
    errors.push({
      path: 'providers',
      message: 'Required field "providers" is missing'
    });
  } else {
    errors.push(...validateProviders(config.providers));
  }

  if (!config.memory) {
    errors.push({
      path: 'memory',
      message: 'Required field "memory" is missing'
    });
  } else {
    errors.push(...validateMemory(config.memory));
  }

  if (!config.workspace) {
    errors.push({
      path: 'workspace',
      message: 'Required field "workspace" is missing'
    });
  } else {
    errors.push(...validateWorkspace(config.workspace));
  }

  if (!config.logging) {
    errors.push({
      path: 'logging',
      message: 'Required field "logging" is missing'
    });
  } else {
    errors.push(...validateLogging(config.logging));
  }

  if (config.execution) {
    errors.push(...validateExecution(config.execution));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate providers configuration
 */
function validateProviders(providers: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof providers !== 'object' || providers === null) {
    errors.push({
      path: 'providers',
      message: 'Providers must be an object',
      value: providers
    });
    return errors;
  }

  const providerNames = Object.keys(providers);
  if (providerNames.length === 0) {
    errors.push({
      path: 'providers',
      message: 'At least one provider must be configured'
    });
  }

  // Validate each provider
  for (const [name, provider] of Object.entries(providers)) {
    errors.push(...validateProvider(name, provider as Record<string, unknown>));
  }

  // Check for at least one enabled provider
  const hasEnabledProvider = providerNames.some(name => providers[name]?.enabled === true);
  if (!hasEnabledProvider) {
    errors.push({
      path: 'providers',
      message: 'At least one provider must be enabled'
    });
  }

  return errors;
}

/**
 * Validate single provider configuration
 */
function validateProvider(name: string, provider: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `providers.${name}`;

  if (typeof provider !== 'object' || provider === null) {
    errors.push({
      path: basePath,
      message: 'Provider must be an object',
      value: provider
    });
    return errors;
  }

  // Required fields
  if (typeof provider.enabled !== 'boolean') {
    errors.push({
      path: `${basePath}.enabled`,
      message: 'enabled must be a boolean',
      value: provider.enabled
    });
  }

  // FIXED (v6.5.13 Bug #129): Enforce integer validation for priority
  if (typeof provider.priority !== 'number') {
    errors.push({
      path: `${basePath}.priority`,
      message: 'priority must be a number',
      value: provider.priority
    });
  } else if (!Number.isInteger(provider.priority)) {
    errors.push({
      path: `${basePath}.priority`,
      message: 'priority must be an integer (no fractional values)',
      value: provider.priority
    });
  } else if (provider.priority < 1) {
    errors.push({
      path: `${basePath}.priority`,
      message: 'priority must be >= 1',
      value: provider.priority
    });
  }

  // FIXED (v6.5.13 Bug #129): Enforce integer validation for timeout
  if (typeof provider.timeout !== 'number') {
    errors.push({
      path: `${basePath}.timeout`,
      message: 'timeout must be a number',
      value: provider.timeout
    });
  } else if (!Number.isInteger(provider.timeout)) {
    errors.push({
      path: `${basePath}.timeout`,
      message: 'timeout must be an integer (no fractional values)',
      value: provider.timeout
    });
  } else if (provider.timeout < 1000) {
    errors.push({
      path: `${basePath}.timeout`,
      message: 'timeout must be >= 1000ms',
      value: provider.timeout
    });
  }

  if (typeof provider.command !== 'string') {
    errors.push({
      path: `${basePath}.command`,
      message: 'command must be a string',
      value: provider.command
    });
  } else if (provider.command.trim() === '') {
    errors.push({
      path: `${basePath}.command`,
      message: 'command cannot be empty',
      value: provider.command
    });
  }

  return errors;
}

/**
 * Validate memory configuration
 */
function validateMemory(memory: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = 'memory';

  if (typeof memory !== 'object' || memory === null) {
    errors.push({
      path: basePath,
      message: 'Memory must be an object',
      value: memory
    });
    return errors;
  }

  // maxEntries
  if (typeof memory.maxEntries !== 'number') {
    errors.push({
      path: `${basePath}.maxEntries`,
      message: 'maxEntries must be a number',
      value: memory.maxEntries
    });
  } else if (memory.maxEntries < 100) {
    errors.push({
      path: `${basePath}.maxEntries`,
      message: 'maxEntries must be >= 100',
      value: memory.maxEntries
    });
  }

  // persistPath
  if (typeof memory.persistPath !== 'string') {
    errors.push({
      path: `${basePath}.persistPath`,
      message: 'persistPath must be a string',
      value: memory.persistPath
    });
  } else if (memory.persistPath.trim() === '') {
    errors.push({
      path: `${basePath}.persistPath`,
      message: 'persistPath cannot be empty',
      value: memory.persistPath
    });
  }

  // autoCleanup
  if (typeof memory.autoCleanup !== 'boolean') {
    errors.push({
      path: `${basePath}.autoCleanup`,
      message: 'autoCleanup must be a boolean',
      value: memory.autoCleanup
    });
  }

  // cleanupDays
  if (typeof memory.cleanupDays !== 'number') {
    errors.push({
      path: `${basePath}.cleanupDays`,
      message: 'cleanupDays must be a number',
      value: memory.cleanupDays
    });
  } else if (memory.cleanupDays < 1) {
    errors.push({
      path: `${basePath}.cleanupDays`,
      message: 'cleanupDays must be >= 1',
      value: memory.cleanupDays
    });
  }

  return errors;
}

/**
 * Validate workspace configuration (v5.2.0)
 */
function validateWorkspace(workspace: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = 'workspace';

  if (typeof workspace !== 'object' || workspace === null) {
    errors.push({
      path: basePath,
      message: 'Workspace must be an object',
      value: workspace
    });
    return errors;
  }

  // prdPath (v5.2.0)
  if (typeof workspace.prdPath !== 'string') {
    errors.push({
      path: `${basePath}.prdPath`,
      message: 'prdPath must be a string',
      value: workspace.prdPath
    });
  } else if (workspace.prdPath.trim() === '') {
    errors.push({
      path: `${basePath}.prdPath`,
      message: 'prdPath cannot be empty',
      value: workspace.prdPath
    });
  }

  // tmpPath (v5.2.0)
  if (typeof workspace.tmpPath !== 'string') {
    errors.push({
      path: `${basePath}.tmpPath`,
      message: 'tmpPath must be a string',
      value: workspace.tmpPath
    });
  } else if (workspace.tmpPath.trim() === '') {
    errors.push({
      path: `${basePath}.tmpPath`,
      message: 'tmpPath cannot be empty',
      value: workspace.tmpPath
    });
  }

  // autoCleanupTmp (v5.2.0)
  if (typeof workspace.autoCleanupTmp !== 'boolean') {
    errors.push({
      path: `${basePath}.autoCleanupTmp`,
      message: 'autoCleanupTmp must be a boolean',
      value: workspace.autoCleanupTmp
    });
  }

  // tmpCleanupDays (v5.2.0)
  if (typeof workspace.tmpCleanupDays !== 'number') {
    errors.push({
      path: `${basePath}.tmpCleanupDays`,
      message: 'tmpCleanupDays must be a number',
      value: workspace.tmpCleanupDays
    });
  } else if (workspace.tmpCleanupDays < 1) {
    errors.push({
      path: `${basePath}.tmpCleanupDays`,
      message: 'tmpCleanupDays must be >= 1',
      value: workspace.tmpCleanupDays
    });
  }

  // v5.2.0: maxFiles removed (no longer needed)

  return errors;
}

/**
 * Validate logging configuration
 */
function validateLogging(logging: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = 'logging';

  if (typeof logging !== 'object' || logging === null) {
    errors.push({
      path: basePath,
      message: 'Logging must be an object',
      value: logging
    });
    return errors;
  }

  // level
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (typeof logging.level !== 'string') {
    errors.push({
      path: `${basePath}.level`,
      message: 'level must be a string',
      value: logging.level
    });
  } else if (!validLevels.includes(logging.level as LogLevel)) {
    errors.push({
      path: `${basePath}.level`,
      message: `level must be one of: ${validLevels.join(', ')}`,
      value: logging.level
    });
  }

  // path
  if (typeof logging.path !== 'string') {
    errors.push({
      path: `${basePath}.path`,
      message: 'path must be a string',
      value: logging.path
    });
  } else if (logging.path.trim() === '') {
    errors.push({
      path: `${basePath}.path`,
      message: 'path cannot be empty',
      value: logging.path
    });
  }

  // console
  if (typeof logging.console !== 'boolean') {
    errors.push({
      path: `${basePath}.console`,
      message: 'console must be a boolean',
      value: logging.console
    });
  }

  return errors;
}

function validateExecution(execution: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = 'execution';

  if (typeof execution !== 'object' || execution === null) {
    errors.push({
      path: basePath,
      message: 'Execution must be an object',
      value: execution
    });
    return errors;
  }

  if (execution.maxConcurrentAgents !== undefined) {
    const value = execution.maxConcurrentAgents;

    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push({
        path: `${basePath}.maxConcurrentAgents`,
        message: 'maxConcurrentAgents must be a number',
        value
      });
    } else if (!Number.isInteger(value)) {
      errors.push({
        path: `${basePath}.maxConcurrentAgents`,
        message: 'maxConcurrentAgents must be an integer',
        value
      });
    } else if (value < 1) {
      errors.push({
        path: `${basePath}.maxConcurrentAgents`,
        message: 'maxConcurrentAgents must be >= 1',
        value
      });
    } else if (value > VALIDATION_LIMITS.MAX_CONCURRENT_AGENTS) {
      errors.push({
        path: `${basePath}.maxConcurrentAgents`,
        message: `maxConcurrentAgents must be <= ${VALIDATION_LIMITS.MAX_CONCURRENT_AGENTS}`,
        value
      });
    }
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'No validation errors';
  }

  const lines: string[] = ['Configuration validation failed:\n'];

  errors.forEach((error, index) => {
    lines.push(`  ${index + 1}. ${error.path}: ${error.message}`);
    if (error.value !== undefined) {
      lines.push(`     Current value: ${JSON.stringify(error.value)}`);
    }
  });

  return lines.join('\n');
}
