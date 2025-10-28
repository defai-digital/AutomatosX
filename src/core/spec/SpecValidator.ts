/**
 * SpecValidator - Spec validation pipeline
 *
 * Validates spec structure, content, and dependencies
 * Supports strict and permissive modes
 * Extensible with custom validation rules
 *
 * @module core/spec/SpecValidator
 */

import type {
  ParsedSpec,
  SpecValidationResult,
  ValidationIssue,
  SpecValidatorOptions,
  ValidationRule,
  SpecTask
} from '../../types/spec.js';
import { SpecGraphBuilder } from './SpecGraphBuilder.js';
import { logger } from '../../utils/logger.js';

/**
 * Default validator options
 */
const DEFAULT_OPTIONS: SpecValidatorOptions = {
  mode: 'strict',
  validateDependencies: true,
  validateOps: true,
  customRules: []
};

/**
 * SpecValidator class
 * Handles spec validation
 */
export class SpecValidator {
  private options: SpecValidatorOptions;

  constructor(options?: SpecValidatorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Validate spec
   */
  async validate(spec: ParsedSpec): Promise<SpecValidationResult> {
    logger.info('Validating spec', { specId: spec.metadata.id });

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    // 1. Validate structure
    this.validateStructure(spec, errors, warnings);

    // 2. Validate content
    this.validateContent(spec, errors, warnings);

    // 3. Validate tasks
    this.validateTasks(spec, errors, warnings);

    // 4. Validate dependencies
    if (this.options.validateDependencies) {
      this.validateDependencies(spec, errors, warnings);
    }

    // 5. Validate ops commands
    if (this.options.validateOps) {
      this.validateOpsCommands(spec, errors, warnings);
    }

    // 6. Run custom rules
    if (this.options.customRules && this.options.customRules.length > 0) {
      this.runCustomRules(spec, errors, warnings, info);
    }

    // Determine overall validity
    const valid = errors.length === 0;

    const result: SpecValidationResult = {
      valid,
      errors,
      warnings,
      info
    };

    logger.info('Validation complete', {
      valid,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length
    });

    return result;
  }

  /**
   * Validate structure (required files and basic format)
   */
  private validateStructure(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    // Check if content is non-empty
    if (!spec.content.spec || spec.content.spec.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_SPEC',
        message: 'spec.md is empty or missing',
        file: 'spec.md',
        suggestion: 'Add specification content to spec.md'
      });
    }

    if (!spec.content.plan || spec.content.plan.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_PLAN',
        message: 'plan.md is empty or missing',
        file: 'plan.md',
        suggestion: 'Add technical plan to plan.md'
      });
    }

    if (!spec.content.tasks || spec.content.tasks.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_TASKS',
        message: 'tasks.md is empty or missing',
        file: 'tasks.md',
        suggestion: 'Add task list to tasks.md'
      });
    }

    // Check minimum content length
    const MIN_SPEC_LENGTH = 100; // characters
    if (spec.content.spec.length < MIN_SPEC_LENGTH) {
      warnings.push({
        severity: 'warning',
        code: 'SHORT_SPEC',
        message: `spec.md is very short (${spec.content.spec.length} chars)`,
        file: 'spec.md',
        suggestion: 'Consider adding more detail to the specification'
      });
    }
  }

  /**
   * Validate content (required sections)
   */
  private validateContent(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    // Check for required sections in spec.md
    const requiredSections = [
      { name: 'Objective', pattern: /##?\s*objective/i },
      { name: 'Requirements', pattern: /##?\s*requirements?/i },
      { name: 'Success Criteria', pattern: /##?\s*success\s+criteria/i }
    ];

    requiredSections.forEach(section => {
      if (!section.pattern.test(spec.content.spec)) {
        const severity = this.options.mode === 'strict' ? 'error' : 'warning';
        (severity === 'error' ? errors : warnings).push({
          severity,
          code: 'MISSING_SECTION',
          message: `Missing required section: ${section.name}`,
          file: 'spec.md',
          suggestion: `Add a ${section.name} section to spec.md`
        });
      }
    });

    // Check for plan sections
    const planSections = [
      { name: 'Approach', pattern: /##?\s*approach/i },
      { name: 'Architecture', pattern: /##?\s*architecture/i }
    ];

    planSections.forEach(section => {
      if (!section.pattern.test(spec.content.plan)) {
        warnings.push({
          severity: 'warning',
          code: 'MISSING_PLAN_SECTION',
          message: `Missing recommended section: ${section.name}`,
          file: 'plan.md',
          suggestion: `Consider adding a ${section.name} section to plan.md`
        });
      }
    });
  }

  /**
   * Validate tasks
   */
  private validateTasks(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    if (spec.tasks.length === 0) {
      errors.push({
        severity: 'error',
        code: 'NO_TASKS',
        message: 'No tasks found in tasks.md',
        file: 'tasks.md',
        suggestion: 'Add at least one task to tasks.md'
      });
      return;
    }

    // Check for duplicate task IDs
    const seenIds = new Set<string>();
    spec.tasks.forEach(task => {
      if (seenIds.has(task.id)) {
        errors.push({
          severity: 'error',
          code: 'DUPLICATE_TASK_ID',
          message: `Duplicate task ID: ${task.id}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: `Use unique task IDs. Consider: ${task.id}-2`
        });
      }
      seenIds.add(task.id);
    });

    // Validate task format
    spec.tasks.forEach(task => {
      // Check ID format (should be namespace:action)
      if (!/:/.test(task.id)) {
        warnings.push({
          severity: 'warning',
          code: 'INVALID_TASK_ID_FORMAT',
          message: `Task ID should follow namespace:action format: ${task.id}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: `Consider: module:${task.id}`
        });
      }

      // Check if ops is non-empty
      if (!task.ops || task.ops.trim().length === 0) {
        errors.push({
          severity: 'error',
          code: 'EMPTY_OPS',
          message: `Task ${task.id} has empty ops command`,
          file: 'tasks.md',
          line: task.line,
          suggestion: 'Add an ops command to execute this task'
        });
      }
    });
  }

  /**
   * Validate dependencies
   */
  private validateDependencies(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    try {
      // Try to build graph (will throw if cycles exist)
      const graph = SpecGraphBuilder.build(spec.tasks);

      // Check for isolated tasks (no deps and no dependents)
      spec.tasks.forEach(task => {
        const hasDeps = task.deps.length > 0;
        const hasDependents = spec.tasks.some(t => t.deps.includes(task.id));

        if (!hasDeps && !hasDependents && spec.tasks.length > 1) {
          warnings.push({
            severity: 'warning',
            code: 'ISOLATED_TASK',
            message: `Task ${task.id} has no dependencies or dependents`,
            file: 'tasks.md',
            line: task.line,
            suggestion: 'Consider if this task should have dependencies'
          });
        }
      });

      // Warn if graph is very deep
      if (graph.metadata.maxDepth > 10) {
        warnings.push({
          severity: 'warning',
          code: 'DEEP_DEPENDENCY_TREE',
          message: `Dependency tree is very deep (${graph.metadata.maxDepth} levels)`,
          file: 'tasks.md',
          suggestion: 'Consider flattening the dependency structure'
        });
      }

    } catch (error) {
      // Cycle detection or missing dependencies
      errors.push({
        severity: 'error',
        code: 'INVALID_DEPENDENCIES',
        message: (error as Error).message,
        file: 'tasks.md',
        suggestion: 'Fix dependency issues before proceeding'
      });
    }
  }

  /**
   * Validate ops commands
   */
  private validateOpsCommands(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ): void {
    const validCommandPatterns = [
      /^ax\s+run\s+\w+/,  // ax run agent "task"
      /^npx\s+/,           // npx command
      /^npm\s+/,           // npm command
      /^bash\s+/,          // bash script
      /^\w+\s+/            // Other commands
    ];

    spec.tasks.forEach(task => {
      const isValid = validCommandPatterns.some(pattern => pattern.test(task.ops));

      if (!isValid) {
        warnings.push({
          severity: 'warning',
          code: 'UNUSUAL_OPS_COMMAND',
          message: `Unusual ops command format in task ${task.id}: ${task.ops}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: 'Verify the ops command is correct'
        });
      }

      // Check if ax run command has valid agent hint
      if (/^ax\s+run/.test(task.ops) && !task.assigneeHint) {
        warnings.push({
          severity: 'warning',
          code: 'MISSING_AGENT_HINT',
          message: `Cannot extract agent from ops in task ${task.id}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: 'Use format: ax run <agent> "task"'
        });
      }
    });
  }

  /**
   * Run custom validation rules
   */
  private runCustomRules(
    spec: ParsedSpec,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    info: ValidationIssue[]
  ): void {
    this.options.customRules?.forEach(rule => {
      try {
        const issues = rule.validate(spec);
        issues.forEach(issue => {
          if (issue.severity === 'error') {
            errors.push(issue);
          } else if (issue.severity === 'warning') {
            warnings.push(issue);
          } else {
            info.push(issue);
          }
        });
      } catch (error) {
        logger.warn('Custom rule failed', {
          rule: rule.name,
          error: (error as Error).message
        });
      }
    });
  }

  /**
   * Static validate method (convenience)
   */
  static async validate(
    spec: ParsedSpec,
    options?: SpecValidatorOptions
  ): Promise<SpecValidationResult> {
    const validator = new SpecValidator(options);
    return validator.validate(spec);
  }

  /**
   * Format validation result as human-readable string
   */
  static formatResult(result: SpecValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✅ Validation passed');
    } else {
      lines.push('❌ Validation failed');
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:');
      result.errors.forEach((error, i) => {
        lines.push(`  ${i + 1}. [${error.code}] ${error.message}`);
        if (error.file) {
          lines.push(`     File: ${error.file}${error.line ? `:${error.line}` : ''}`);
        }
        if (error.suggestion) {
          lines.push(`     Suggestion: ${error.suggestion}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        lines.push(`  ${i + 1}. [${warning.code}] ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`     Suggestion: ${warning.suggestion}`);
        }
      });
    }

    if (result.info.length > 0) {
      lines.push('\nInfo:');
      result.info.forEach((info, i) => {
        lines.push(`  ${i + 1}. ${info.message}`);
      });
    }

    return lines.join('\n');
  }
}
