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
import { logger } from '../../shared/logging/logger.js';

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
    // FIXED (Bug #46): Validate spec parameter before accessing properties
    if (!spec || typeof spec !== 'object') {
      throw new Error('Invalid spec: must be a ParsedSpec object');
    }
    if (!spec.metadata || typeof spec.metadata !== 'object') {
      throw new Error('Invalid spec: must have metadata object');
    }
    if (!spec.metadata.id || typeof spec.metadata.id !== 'string') {
      throw new Error('Invalid spec: metadata.id must be a string');
    }

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
    // FIXED (Bug #47): Validate spec.content exists and is an object
    if (!spec.content || typeof spec.content !== 'object') {
      errors.push({
        severity: 'error',
        code: 'INVALID_CONTENT',
        message: 'spec.content must be an object',
        suggestion: 'Ensure spec has a content object with spec/plan/tasks fields'
      });
      return; // Cannot continue without valid content object
    }

    // FIXED (Bug #48): Validate spec.content.spec is a string before calling trim()
    if (typeof spec.content.spec !== 'string') {
      errors.push({
        severity: 'error',
        code: 'INVALID_SPEC_CONTENT_TYPE',
        message: `spec.content.spec must be a string, got ${typeof spec.content.spec}`,
        file: 'spec.md',
        suggestion: 'Ensure spec.md content is loaded as a string'
      });
    } else if (!spec.content.spec || spec.content.spec.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_SPEC',
        message: 'spec.md is empty or missing',
        file: 'spec.md',
        suggestion: 'Add specification content to spec.md'
      });
    }

    // FIXED (Bug #48): Validate spec.content.plan is a string before calling trim()
    if (typeof spec.content.plan !== 'string') {
      errors.push({
        severity: 'error',
        code: 'INVALID_PLAN_CONTENT_TYPE',
        message: `spec.content.plan must be a string, got ${typeof spec.content.plan}`,
        file: 'plan.md',
        suggestion: 'Ensure plan.md content is loaded as a string'
      });
    } else if (!spec.content.plan || spec.content.plan.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_PLAN',
        message: 'plan.md is empty or missing',
        file: 'plan.md',
        suggestion: 'Add technical plan to plan.md'
      });
    }

    // FIXED (Bug #48): Validate spec.content.tasks is a string before calling trim()
    if (typeof spec.content.tasks !== 'string') {
      errors.push({
        severity: 'error',
        code: 'INVALID_TASKS_CONTENT_TYPE',
        message: `spec.content.tasks must be a string, got ${typeof spec.content.tasks}`,
        file: 'tasks.md',
        suggestion: 'Ensure tasks.md content is loaded as a string'
      });
    } else if (!spec.content.tasks || spec.content.tasks.trim().length === 0) {
      errors.push({
        severity: 'error',
        code: 'EMPTY_TASKS',
        message: 'tasks.md is empty or missing',
        file: 'tasks.md',
        suggestion: 'Add task list to tasks.md'
      });
    }

    // Check minimum content length (only if spec.content.spec is a valid string)
    const MIN_SPEC_LENGTH = 100; // characters
    if (typeof spec.content.spec === 'string' && spec.content.spec.length < MIN_SPEC_LENGTH) {
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
    // FIXED (Bug #49): Validate spec.tasks exists and is an array
    if (!spec.tasks || !Array.isArray(spec.tasks)) {
      errors.push({
        severity: 'error',
        code: 'INVALID_TASKS',
        message: `spec.tasks must be an array, got ${typeof spec.tasks}`,
        file: 'tasks.md',
        suggestion: 'Ensure tasks are parsed as an array'
      });
      return; // Cannot continue without valid tasks array
    }

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
    spec.tasks.forEach((task, index) => {
      // FIXED (Bug #50): Validate task is an object before accessing properties
      if (!task || typeof task !== 'object') {
        errors.push({
          severity: 'error',
          code: 'INVALID_TASK_OBJECT',
          message: `Task at index ${index} is not an object, got ${typeof task}`,
          file: 'tasks.md',
          suggestion: 'Ensure all tasks are valid objects'
        });
        return; // Skip this task
      }

      // FIXED (Bug #51): Validate task.id exists and is a string
      if (!task.id || typeof task.id !== 'string') {
        errors.push({
          severity: 'error',
          code: 'INVALID_TASK_ID',
          message: `Task at index ${index} must have id field (string), got ${typeof task.id}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: 'Ensure all tasks have a string id field'
        });
        return; // Skip this task
      }

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
    spec.tasks.forEach((task, index) => {
      // Skip if task is not an object (already reported in previous loop)
      if (!task || typeof task !== 'object') return;

      // Skip if task.id is not a string (already reported in previous loop)
      if (!task.id || typeof task.id !== 'string') return;

      // FIXED (Bug #51): Validate task.id is a string before regex test
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

      // FIXED (Bug #52): Validate task.ops is a string before calling trim()
      if (typeof task.ops !== 'string') {
        errors.push({
          severity: 'error',
          code: 'INVALID_OPS_TYPE',
          message: `Task ${task.id} ops must be a string, got ${typeof task.ops}`,
          file: 'tasks.md',
          line: task.line,
          suggestion: 'Ensure task ops is a string command'
        });
      } else if (!task.ops || task.ops.trim().length === 0) {
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
        // Skip if task is not an object (already reported)
        if (!task || typeof task !== 'object') return;
        if (!task.id || typeof task.id !== 'string') return;

        // FIXED (Bug #53): Validate task.deps is an array before accessing length
        if (!task.deps || !Array.isArray(task.deps)) {
          errors.push({
            severity: 'error',
            code: 'INVALID_TASK_DEPS',
            message: `Task ${task.id} deps must be an array, got ${typeof task.deps}`,
            file: 'tasks.md',
            line: task.line,
            suggestion: 'Ensure task.deps is an array of task IDs'
          });
          return; // Skip this task
        }

        const hasDeps = task.deps.length > 0;
        // Also validate deps in dependents check
        const hasDependents = spec.tasks.some(t => {
          if (!t || typeof t !== 'object') return false;
          if (!t.deps || !Array.isArray(t.deps)) return false;
          return t.deps.includes(task.id);
        });

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
      // FIXED (Bug #54): Validate graph.metadata exists and maxDepth is a number
      if (graph.metadata &&
          typeof graph.metadata === 'object' &&
          typeof graph.metadata.maxDepth === 'number' &&
          graph.metadata.maxDepth > 10) {
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
    this.options.customRules?.forEach((rule, index) => {
      try {
        // FIXED (Bug #55): Validate rule object has validate function
        if (!rule || typeof rule !== 'object') {
          logger.warn('Custom rule is not an object', { index, rule: typeof rule });
          return;
        }
        if (!rule.validate || typeof rule.validate !== 'function') {
          logger.warn('Custom rule missing validate function', { index, ruleName: rule.name });
          return;
        }

        const issues = rule.validate(spec);

        // FIXED (Bug #55): Validate issues is an array before iterating
        if (!issues || !Array.isArray(issues)) {
          logger.warn('Custom rule did not return an array', {
            rule: rule.name,
            returned: typeof issues
          });
          return;
        }

        issues.forEach(issue => {
          // Validate issue has severity property
          if (!issue || typeof issue !== 'object' || !issue.severity) {
            logger.warn('Invalid issue from custom rule', { rule: rule.name, issue });
            return;
          }

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
          rule: rule?.name,
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
