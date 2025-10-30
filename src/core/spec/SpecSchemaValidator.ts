/**
 * Spec Schema Validator
 *
 * Validates YAML specs against JSON Schema using Ajv.
 * Provides structured validation errors with helpful messages.
 *
 * @module core/spec/SpecSchemaValidator
 * @see schema/spec-schema.json
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { SpecYAML, ValidationIssue, SpecValidationResult } from '@/types/spec-yaml.js';
import { logger } from '@/utils/logger.js';
import { SecurityValidator } from './SecurityValidator.js';

// Get current file directory (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Schema validator for YAML specs
 */
export class SpecSchemaValidator {
  private ajv: Ajv;
  private validateFn: ValidateFunction | null = null;
  private schemaPath: string;
  private securityValidator: SecurityValidator;

  constructor(schemaPath?: string) {
    // Default schema path relative to project root
    this.schemaPath = schemaPath || join(__dirname, '../../../schema/spec-schema.json');

    // Initialize security validator
    this.securityValidator = new SecurityValidator();

    // Initialize Ajv with strict mode
    this.ajv = new Ajv({
      allErrors: true,        // Collect all errors, not just first
      verbose: true,          // Include schema and data in errors
      strict: true,           // Strict schema validation
      strictSchema: true,     // Strict meta-schema validation
      strictNumbers: true,    // Reject NaN and Infinity
      strictTypes: true,      // Strict type checking
      strictTuples: true,     // Strict tuple validation
      strictRequired: true    // Strict required property checking
    });

    // Add format validators (email, date-time, uri, etc.)
    addFormats(this.ajv);

    // Load and compile schema
    this.loadSchema();
  }

  /**
   * Load and compile JSON Schema
   */
  private loadSchema(): void {
    try {
      const schemaContent = readFileSync(this.schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);

      // Compile schema
      this.validateFn = this.ajv.compile(schema);

      logger.debug('Schema loaded and compiled', {
        schemaPath: this.schemaPath,
        schemaId: schema.$id
      });
    } catch (error) {
      logger.error('Failed to load schema', {
        schemaPath: this.schemaPath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to load schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate a spec against the schema
   *
   * @param spec - Parsed YAML spec
   * @returns Validation result with errors/warnings
   */
  validate(spec: unknown): SpecValidationResult {
    if (!this.validateFn) {
      throw new Error('Schema not loaded');
    }

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    // Run JSON Schema validation
    const valid = this.validateFn(spec);

    if (!valid && this.validateFn.errors) {
      // Convert Ajv errors to ValidationIssue format
      for (const error of this.validateFn.errors) {
        const issue = this.convertAjvError(error);
        errors.push(issue);
      }
    }

    // Additional semantic validations (warnings/info)
    if (valid && this.isSpecYAML(spec)) {
      this.validateSemantics(spec, warnings, info);

      // Run security validation (Phase 1)
      const securityIssues = this.securityValidator.validate(spec);
      for (const issue of securityIssues) {
        if (issue.severity === 'error') {
          errors.push(issue);
        } else if (issue.severity === 'warning') {
          warnings.push(issue);
        } else {
          info.push(issue);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Type guard to check if value is SpecYAML
   */
  private isSpecYAML(value: unknown): value is SpecYAML {
    return (
      typeof value === 'object' &&
      value !== null &&
      'version' in value &&
      'metadata' in value &&
      'actors' in value
    );
  }

  /**
   * Additional semantic validations (warnings/info)
   */
  private validateSemantics(
    spec: SpecYAML,
    warnings: ValidationIssue[],
    info: ValidationIssue[]
  ): void {
    // Check for missing optional but recommended fields
    if (!spec.providers) {
      info.push({
        ruleId: 'SCHEMA-INFO-001',
        severity: 'info',
        message: 'No provider configuration specified. Will use system defaults.',
        path: 'providers'
      });
    }

    if (!spec.policy) {
      info.push({
        ruleId: 'SCHEMA-INFO-002',
        severity: 'info',
        message: 'No policy configuration specified. Will use balanced routing.',
        path: 'policy'
      });
    }

    if (!spec.observability) {
      warnings.push({
        ruleId: 'SCHEMA-WARN-001',
        severity: 'warning',
        message: 'No observability configuration. Consider enabling metrics/logging for production.',
        path: 'observability',
        suggestion: 'Add observability section with metrics and logs enabled'
      });
    }

    if (!spec.recovery) {
      warnings.push({
        ruleId: 'SCHEMA-WARN-002',
        severity: 'warning',
        message: 'No recovery configuration. System will use defaults which may not be optimal.',
        path: 'recovery',
        suggestion: 'Add recovery section with retry and timeout configuration'
      });
    }

    // Check actor permissions
    for (let i = 0; i < spec.actors.length; i++) {
      const actor = spec.actors[i];
      if (!actor) continue;

      if (!actor.permissions) {
        warnings.push({
          ruleId: 'SCHEMA-WARN-003',
          severity: 'warning',
          message: `Actor "${actor.id}" has no permissions specified. This may be a security risk.`,
          path: `actors[${i}].permissions`,
          suggestion: 'Explicitly define filesystem, network, and environment permissions'
        });
      }

      if (!actor.timeout) {
        info.push({
          ruleId: 'SCHEMA-INFO-003',
          severity: 'info',
          message: `Actor "${actor.id}" has no timeout specified. Will use default 5 minutes.`,
          path: `actors[${i}].timeout`
        });
      }
    }

    // Check budget configuration if providers specified
    if (spec.providers?.primary && !spec.providers.primary.budget) {
      warnings.push({
        ruleId: 'SCHEMA-WARN-004',
        severity: 'warning',
        message: 'Primary provider has no budget limits. Consider setting cost caps.',
        path: 'providers.primary.budget',
        suggestion: 'Add budget section with softCap and hardCap'
      });
    }
  }

  /**
   * Convert Ajv error to ValidationIssue
   */
  private convertAjvError(error: ErrorObject): ValidationIssue {
    const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
    const keyword = error.keyword;

    let message = error.message || 'Validation error';
    let suggestion: string | undefined;

    // Provide helpful messages based on error type
    switch (keyword) {
      case 'required':
        message = `Missing required field: ${error.params.missingProperty}`;
        suggestion = `Add "${error.params.missingProperty}" field`;
        break;

      case 'additionalProperties':
        message = `Unknown field: ${error.params.additionalProperty}`;
        suggestion = 'Remove this field or check for typos';
        break;

      case 'type':
        message = `Invalid type: expected ${error.params.type}, got ${typeof error.data}`;
        suggestion = `Change value to ${error.params.type} type`;
        break;

      case 'enum':
        message = `Invalid value. Must be one of: ${error.params.allowedValues.join(', ')}`;
        suggestion = `Use one of the allowed values: ${error.params.allowedValues.join(', ')}`;
        break;

      case 'pattern':
        message = `Value does not match required pattern: ${error.params.pattern}`;
        suggestion = 'Check format requirements in schema';
        break;

      case 'format':
        message = `Invalid ${error.params.format} format`;
        suggestion = `Provide a valid ${error.params.format}`;
        break;

      case 'minimum':
      case 'maximum':
        message = `Value must be ${keyword === 'minimum' ? 'at least' : 'at most'} ${error.params.limit}`;
        suggestion = `Adjust value to meet ${keyword} requirement`;
        break;

      case 'minItems':
      case 'maxItems':
        message = `Array must have ${keyword === 'minItems' ? 'at least' : 'at most'} ${error.params.limit} items`;
        suggestion = `Adjust array length to meet requirement`;
        break;

      case 'minLength':
      case 'maxLength':
        message = `String must be ${keyword === 'minLength' ? 'at least' : 'at most'} ${error.params.limit} characters`;
        suggestion = `Adjust string length to meet requirement`;
        break;

      default:
        message = error.message || `Validation failed: ${keyword}`;
    }

    return {
      ruleId: `SCHEMA-${keyword.toUpperCase()}`,
      severity: 'error',
      message,
      path: path || undefined,
      suggestion
    };
  }

  /**
   * Get schema object (for inspection/debugging)
   */
  getSchema(): object {
    if (!this.validateFn) {
      throw new Error('Schema not loaded');
    }
    return this.validateFn.schema as object;
  }

  /**
   * Validate and throw on error (convenience method)
   */
  validateOrThrow(spec: unknown): asserts spec is SpecYAML {
    const result = this.validate(spec);

    if (!result.valid) {
      const errorMessages = result.errors.map(e =>
        e.path ? `${e.path}: ${e.message}` : e.message
      ).join('\n');

      throw new Error(`Spec validation failed:\n${errorMessages}`);
    }
  }
}

/**
 * Default singleton instance
 */
let defaultValidator: SpecSchemaValidator | null = null;

/**
 * Get default validator instance (singleton)
 */
export function getDefaultValidator(): SpecSchemaValidator {
  if (!defaultValidator) {
    defaultValidator = new SpecSchemaValidator();
  }
  return defaultValidator;
}

/**
 * Convenience function: validate spec with default validator
 */
export function validateSpec(spec: unknown): SpecValidationResult {
  return getDefaultValidator().validate(spec);
}

/**
 * Convenience function: validate and throw on error
 */
export function validateSpecOrThrow(spec: unknown): asserts spec is SpecYAML {
  const result = validateSpec(spec);

  if (!result.valid) {
    const errorMessages = result.errors.map(e =>
      e.path ? `${e.path}: ${e.message}` : e.message
    ).join('\n');

    throw new Error(`Spec validation failed:\n${errorMessages}`);
  }
}
