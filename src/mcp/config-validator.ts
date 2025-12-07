/**
 * MCP Config Validator (v12.0.0)
 *
 * Validates MCP configuration files for Claude and Gemini providers.
 * Uses Zod for runtime type checking with detailed error messages.
 *
 * @module mcp/config-validator
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import { logger } from '../shared/logging/logger.js';
import { getProviderConfigPath, type MCPProvider } from './config-injector.js';

/**
 * MCP Server Config Schema
 */
export const MCPServerConfigSchema = z.object({
  command: z.string().min(1, 'Command must not be empty'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional()
}).strict();

/**
 * Provider MCP Config Schema (Claude/Gemini config file structure)
 */
export const ProviderMCPConfigSchema = z.object({
  mcpServers: z.record(z.string(), MCPServerConfigSchema).optional()
}).passthrough(); // Allow other fields we don't know about

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: z.infer<typeof ProviderMCPConfigSchema>;
}

/**
 * Validate a provider's MCP config file
 */
export async function validateProviderConfig(provider: MCPProvider): Promise<ValidationResult> {
  const configPath = getProviderConfigPath(provider);

  try {
    // Check if file exists
    try {
      await fs.access(configPath, fs.constants.R_OK);
    } catch {
      return {
        valid: true, // Non-existent config is valid (will be created)
        errors: [],
        warnings: ['Config file does not exist yet']
      };
    }

    // Read and parse JSON
    const content = await fs.readFile(configPath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`],
        warnings: []
      };
    }

    // Validate against schema
    const result = ProviderMCPConfigSchema.safeParse(parsed);

    if (!result.success) {
      // Zod v4 uses .issues
      const issues = result.error.issues;
      return {
        valid: false,
        errors: issues.map((e) => `${e.path.join('.')}: ${e.message}`),
        warnings: []
      };
    }

    // Check for common issues (warnings)
    const warnings: string[] = [];

    if (result.data.mcpServers) {
      for (const [name, config] of Object.entries(result.data.mcpServers)) {
        // Check for potentially problematic commands
        if (config.command.includes(' ')) {
          warnings.push(`Server '${name}': command contains spaces, consider using args instead`);
        }

        // Check for relative paths
        if (config.command.startsWith('./') || config.command.startsWith('../')) {
          warnings.push(`Server '${name}': command uses relative path, this may cause issues`);
        }

        // Check for missing env vars
        if (config.env) {
          for (const [key, value] of Object.entries(config.env)) {
            if (value.startsWith('$') || value.includes('${')) {
              warnings.push(`Server '${name}': env var '${key}' contains shell variable syntax which may not be expanded`);
            }
          }
        }
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
      config: result.data
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate config: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}

/**
 * Validate a single MCP server config object
 */
export function validateServerConfig(config: unknown): ValidationResult {
  const result = MCPServerConfigSchema.safeParse(config);

  if (!result.success) {
    // Zod v4 uses .issues
    const issues = result.error.issues;
    return {
      valid: false,
      errors: issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      warnings: []
    };
  }

  return {
    valid: true,
    errors: [],
    warnings: []
  };
}

/**
 * Check if AutomatosX MCP server config is valid
 */
export async function validateAutomatosXConfig(provider: MCPProvider): Promise<ValidationResult> {
  const validation = await validateProviderConfig(provider);

  if (!validation.valid) {
    return validation;
  }

  // Check if automatosx server exists and is valid
  const automatosxConfig = validation.config?.mcpServers?.automatosx;

  if (!automatosxConfig) {
    return {
      valid: false,
      errors: ['AutomatosX MCP server not configured'],
      warnings: validation.warnings
    };
  }

  // Validate automatosx-specific requirements
  const errors: string[] = [];
  const warnings: string[] = [...validation.warnings];

  // Check command is npx or node
  if (!['npx', 'node', 'automatosx'].includes(automatosxConfig.command)) {
    warnings.push('AutomatosX server uses non-standard command (expected npx, node, or automatosx)');
  }

  // Check for required args
  if (automatosxConfig.args && !automatosxConfig.args.includes('mcp-server')) {
    warnings.push('AutomatosX server args should include "mcp-server"');
  }

  // Check for project dir env
  if (!automatosxConfig.env?.AUTOMATOSX_PROJECT_DIR) {
    warnings.push('AutomatosX server missing AUTOMATOSX_PROJECT_DIR env var');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config: validation.config
  };
}

/**
 * Log validation results
 */
export function logValidationResult(result: ValidationResult, provider: MCPProvider): void {
  if (result.valid) {
    if (result.warnings.length > 0) {
      logger.warn('Config validation passed with warnings', {
        provider,
        warnings: result.warnings
      });
    } else {
      logger.debug('Config validation passed', { provider });
    }
  } else {
    logger.error('Config validation failed', {
      provider,
      errors: result.errors,
      warnings: result.warnings
    });
  }
}
