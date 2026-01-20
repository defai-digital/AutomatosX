/**
 * Task Classifier Gate
 *
 * Validates task classifier configuration and rules.
 * Ensures workflow references are valid and rules are well-formed.
 *
 * Invariants:
 * - INV-GUARD-TC-001: Workflow Validation - all workflow references must exist
 * - INV-GUARD-TC-002: Pattern Validation - all regex patterns must be valid
 * - INV-GUARD-TC-003: Priority Range - priorities must be 0-100
 * - INV-GUARD-TC-004: Rule Uniqueness - warn on duplicate patterns
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GovernanceContext, GateResult } from '../types.js';

/**
 * Files related to task classifier that trigger this gate
 */
const TASK_CLASSIFIER_FILES = [
  'packages/core/agent-domain/src/task-classifier.ts',
  'packages/core/agent-domain/src/capability-router.ts',
  'packages/contracts/src/agent/v1/schema.ts',
];

/**
 * Agent config patterns that may contain taskClassifier
 */
const AGENT_CONFIG_PATTERNS = [
  /agents\/.*\.json$/,
  /packages\/cli\/bundled\/agents\/.*\.json$/,
];

/**
 * Check if a file is related to task classification
 */
function isTaskClassifierRelated(file: string): boolean {
  if (TASK_CLASSIFIER_FILES.includes(file)) {
    return true;
  }
  return AGENT_CONFIG_PATTERNS.some((pattern) => pattern.test(file));
}

/**
 * Validate a regex pattern
 * INV-GUARD-TC-002: Pattern Validation
 */
function isValidRegexPattern(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, 'i');
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid regex' };
  }
}

/**
 * Validate a workflow reference exists
 * INV-GUARD-TC-001: Workflow Validation
 */
function validateWorkflowExists(
  workflowRef: string,
  cwd: string
): { exists: boolean; resolvedPath: string } {
  let resolvedPath: string;

  if (workflowRef.startsWith('workflows/')) {
    // Already a full path
    resolvedPath = workflowRef;
  } else if (workflowRef.startsWith('std/')) {
    // Standard workflow reference
    resolvedPath = `workflows/${workflowRef}.yaml`;
  } else {
    // Custom workflow
    resolvedPath = workflowRef.endsWith('.yaml') ? workflowRef : `${workflowRef}.yaml`;
  }

  const fullPath = join(cwd, resolvedPath);
  return { exists: existsSync(fullPath), resolvedPath };
}

/**
 * Extract workflow references from DEFAULT_CLASSIFICATION_RULES in task-classifier.ts
 */
function extractDefaultRuleWorkflows(content: string): string[] {
  const workflows: string[] = [];
  const workflowRegex = /workflow:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = workflowRegex.exec(content)) !== null) {
    const workflow = match[1];
    if (workflow) {
      workflows.push(workflow);
    }
  }

  return workflows;
}

/**
 * Extract taskClassifier config from agent JSON
 */
function extractAgentTaskClassifier(
  content: string
): { rules: Array<{ pattern: string; workflow: string; priority?: number }>; defaultWorkflow?: string } | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.taskClassifier?.rules) {
      return {
        rules: parsed.taskClassifier.rules,
        defaultWorkflow: parsed.taskClassifier.defaultWorkflow,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Executes the task classifier gate
 *
 * INV-GUARD-TC-001: Workflow Validation
 * INV-GUARD-TC-002: Pattern Validation
 * INV-GUARD-TC-003: Priority Range
 * INV-GUARD-TC-004: Rule Uniqueness
 */
export async function taskClassifierGate(
  _context: GovernanceContext,
  changedFiles: string[],
  fileContents?: Map<string, string>
): Promise<GateResult> {
  // Check if any task classifier related files were changed
  const relevantFiles = changedFiles.filter(isTaskClassifierRelated);

  if (relevantFiles.length === 0) {
    return {
      gate: 'task_classifier',
      status: 'PASS',
      message: 'No task classifier files modified',
    };
  }

  const cwd = process.cwd();
  const issues: string[] = [];
  const warnings: string[] = [];

  // If we have file contents, validate them
  if (fileContents) {
    for (const [file, content] of fileContents) {
      if (!isTaskClassifierRelated(file)) continue;

      // Check task-classifier.ts for DEFAULT_CLASSIFICATION_RULES
      if (file.endsWith('task-classifier.ts')) {
        const workflows = extractDefaultRuleWorkflows(content);
        for (const workflow of workflows) {
          const { exists, resolvedPath } = validateWorkflowExists(workflow, cwd);
          if (!exists) {
            issues.push(`Missing workflow: ${resolvedPath} (referenced in DEFAULT_CLASSIFICATION_RULES)`);
          }
        }
      }

      // Check agent JSON files for taskClassifier config
      if (file.endsWith('.json') && AGENT_CONFIG_PATTERNS.some((p) => p.test(file))) {
        const config = extractAgentTaskClassifier(content);
        if (config) {
          const seenPatterns = new Set<string>();

          for (const rule of config.rules) {
            // INV-GUARD-TC-002: Validate regex pattern
            const patternCheck = isValidRegexPattern(rule.pattern);
            if (!patternCheck.valid) {
              issues.push(`Invalid regex in ${file}: "${rule.pattern}" - ${patternCheck.error}`);
            }

            // INV-GUARD-TC-001: Validate workflow exists
            const { exists, resolvedPath } = validateWorkflowExists(rule.workflow, cwd);
            if (!exists) {
              issues.push(`Missing workflow in ${file}: ${resolvedPath}`);
            }

            // INV-GUARD-TC-003: Validate priority range
            if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 100)) {
              issues.push(`Invalid priority in ${file}: ${rule.priority} (must be 0-100)`);
            }

            // INV-GUARD-TC-004: Check for duplicate patterns
            if (seenPatterns.has(rule.pattern)) {
              warnings.push(`Duplicate pattern in ${file}: "${rule.pattern}"`);
            }
            seenPatterns.add(rule.pattern);
          }

          // Check default workflow
          if (config.defaultWorkflow) {
            const { exists, resolvedPath } = validateWorkflowExists(config.defaultWorkflow, cwd);
            if (!exists) {
              issues.push(`Missing default workflow in ${file}: ${resolvedPath}`);
            }
          }
        }
      }
    }
  } else {
    // No file contents provided - do basic validation by checking workflow files exist
    // This is a lighter check when full file contents aren't available
    const stdWorkflows = [
      'workflows/std/code-review.yaml',
      'workflows/std/debugging.yaml',
      'workflows/std/testing.yaml',
      'workflows/std/refactoring.yaml',
      'workflows/std/documentation.yaml',
      'workflows/std/analysis.yaml',
      'workflows/std/research.yaml',
      'workflows/std/deployment.yaml',
      'workflows/std/implementation.yaml',
    ];

    for (const workflow of stdWorkflows) {
      const fullPath = join(cwd, workflow);
      if (!existsSync(fullPath)) {
        issues.push(`Missing standard workflow: ${workflow}`);
      }
    }
  }

  // Return result based on issues found
  if (issues.length > 0) {
    return {
      gate: 'task_classifier',
      status: 'FAIL',
      message: `Task classifier validation failed: ${issues.length} issue(s) found`,
      details: {
        issues,
        warnings: warnings.length > 0 ? warnings : undefined,
        relevantFiles,
      },
    };
  }

  if (warnings.length > 0) {
    return {
      gate: 'task_classifier',
      status: 'WARN',
      message: `Task classifier validation passed with ${warnings.length} warning(s)`,
      details: {
        warnings,
        relevantFiles,
      },
    };
  }

  return {
    gate: 'task_classifier',
    status: 'PASS',
    message: `Task classifier validation passed for ${relevantFiles.length} file(s)`,
    details: {
      relevantFiles,
    },
  };
}
