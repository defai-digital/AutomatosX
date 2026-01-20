/**
 * Task Classifier
 *
 * Config-driven task classification for capability routing.
 * Supports both default rules and custom rules from agent configuration.
 *
 * Invariants:
 * - INV-TC-001: Case-insensitive pattern matching
 * - INV-TC-002: First-match-wins (priority ordered)
 * - INV-TC-003: Default workflow fallback
 * - INV-TC-004: Classification is deterministic (same input = same output)
 * - INV-TC-005: Unknown tasks route to defaultWorkflow
 */

import type {
  AgentTaskType,
  CapabilityMapping,
  TaskClassifierConfig,
  TaskClassifierRule,
} from '@defai.digital/contracts';

/**
 * Result of task classification (domain-level interface)
 *
 * Note: This is distinct from the contract's TaskClassificationResultSchema
 * which is designed for external MCP tool responses.
 */
export interface TaskClassificationResult {
  /** Classified task type */
  taskType: AgentTaskType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Keywords/patterns that matched */
  matchedKeywords: string[];
  /** Workflow to use (if provided by rule) - undefined means use default */
  workflow: string | undefined;
}

/**
 * Default classification rules derived from common task patterns.
 * Used when no custom config is provided.
 *
 * Priority values:
 * - 80: High priority (specific patterns)
 * - 70: Medium priority (common patterns)
 * - 50: Default priority
 */
export const DEFAULT_CLASSIFICATION_RULES: TaskClassifierRule[] = [
  // Code review patterns (high priority)
  // Note: \b word boundaries for short patterns to avoid false matches (e.g., "pr" in "improve")
  {
    pattern: 'review|audit|\\bpr\\b|pull request|merge request|\\bmr\\b|feedback|code review',
    taskType: 'code-review',
    workflow: 'workflows/std/code-review.yaml',
    priority: 80,
  },
  // Debugging patterns (high priority)
  {
    pattern: 'fix|bug|debug|error|crash|broken|failing|exception|not working|stack trace|traceback',
    taskType: 'debugging',
    workflow: 'workflows/std/debugging.yaml',
    priority: 80,
  },
  // Testing patterns (high priority)
  {
    pattern: 'test|spec|coverage|unit test|integration test|e2e|testing|test case|assertion|mock',
    taskType: 'testing',
    workflow: 'workflows/std/testing.yaml',
    priority: 80,
  },
  // Refactoring patterns (medium priority)
  {
    pattern: 'refactor|restructure|clean|improve|optimize|simplify|reorganize|code smell|technical debt|modernize',
    taskType: 'refactoring',
    workflow: 'workflows/std/refactoring.yaml',
    priority: 70,
  },
  // Documentation patterns (medium priority)
  {
    pattern: 'document|readme|docs|explain|describe|jsdoc|comment|documentation|wiki|guide',
    taskType: 'documentation',
    workflow: 'workflows/std/documentation.yaml',
    priority: 70,
  },
  // Analysis patterns (medium priority)
  {
    pattern: 'analyze|investigate|understand|explore|examine|assess|evaluate|study|look into',
    taskType: 'analysis',
    workflow: 'workflows/std/analysis.yaml',
    priority: 70,
  },
  // Research patterns (medium priority) - distinct from analysis for learning/comparison tasks
  {
    pattern: 'research|learn|find out|search|compare|evaluate options|best practice',
    taskType: 'research',
    workflow: 'workflows/std/research.yaml',
    priority: 70,
  },
  // Deployment patterns (medium priority) - CI/CD and infrastructure tasks
  // Note: \b word boundaries for short patterns to avoid false matches
  {
    pattern: 'deploy|release|\\bci\\b|\\bcd\\b|pipeline|kubernetes|docker|infrastructure|devops|publish',
    taskType: 'deployment',
    workflow: 'workflows/std/deployment.yaml',
    priority: 70,
  },
  // Planning patterns (medium priority)
  {
    pattern: 'plan|design|architect|strategy|approach|roadmap|proposal|specification|requirements',
    taskType: 'planning',
    workflow: 'workflows/std/analysis.yaml',
    priority: 70,
  },
  // API design patterns (medium priority)
  {
    pattern: 'api|endpoint|rest|graphql|interface|contract|openapi|swagger|routes|service interface',
    taskType: 'api-design',
    workflow: 'workflows/std/implementation.yaml',
    priority: 70,
  },
  // Implementation patterns (default priority - broad catch)
  {
    pattern: 'implement|build|create|add|feature|develop|write code|make|construct|new feature',
    taskType: 'implementation',
    workflow: 'workflows/std/implementation.yaml',
    priority: 50,
  },
];

/**
 * Default workflow when no rules match
 */
export const DEFAULT_WORKFLOW = 'workflows/std/implementation.yaml';

/**
 * Compiled rule with cached regex
 */
interface CompiledRule {
  rule: TaskClassifierRule;
  regex: RegExp;
}

/**
 * Task classifier instance
 */
export interface TaskClassifier {
  /** Classify a task description */
  classifyTask(taskDescription: string): TaskClassificationResult;
  /** Get the rules being used */
  getRules(): TaskClassifierRule[];
  /** Get the default workflow */
  getDefaultWorkflow(): string;
}

/**
 * Create a task classifier with the given configuration.
 *
 * @param config - Optional configuration. If not provided, uses DEFAULT_CLASSIFICATION_RULES.
 * @returns A TaskClassifier instance
 *
 * INV-TC-001: Case-insensitive pattern matching (regex 'i' flag)
 * INV-TC-002: First-match-wins (rules sorted by priority)
 * INV-TC-003: Default workflow fallback
 * INV-TC-004: Classification is deterministic
 */
export function createTaskClassifier(config?: TaskClassifierConfig): TaskClassifier {
  // Use provided config or default rules
  const rules = config?.rules ?? DEFAULT_CLASSIFICATION_RULES;
  const defaultWorkflow = config?.defaultWorkflow ?? DEFAULT_WORKFLOW;
  const enabled = config?.enabled ?? true;

  // Sort rules by priority (highest first), then by original order
  // We use a stable sort to maintain definition order for same-priority rules
  const sortedRules = [...rules]
    .map((rule, index) => ({ rule, originalIndex: index }))
    .sort((a, b) => {
      const priorityDiff = (b.rule.priority ?? 50) - (a.rule.priority ?? 50);
      if (priorityDiff !== 0) return priorityDiff;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ rule }) => rule);

  // Compile regex patterns once for performance
  // INV-TC-001: Use 'i' flag for case-insensitive matching
  // INV-TC-006: Invalid regex patterns are skipped with warning (defensive handling)
  // INV-TC-007: ReDoS-vulnerable patterns are rejected (catastrophic backtracking protection)
  const compiledRules: CompiledRule[] = sortedRules
    .map((rule) => {
      try {
        // INV-TC-007: Check for ReDoS-vulnerable patterns before compilation
        // Reject patterns with nested quantifiers that can cause exponential backtracking
        // Common ReDoS patterns: (a+)+, (a*)*b, (a|a)+, (.*a){10,}
        const redosPatterns = [
          /\([^)]*[+*][^)]*\)[+*]/, // Nested quantifiers like (a+)+
          /\([^)]*\|[^)]*\)[+*]/,   // Alternation with quantifier like (a|b)+
          /\.\*[^?].*\.\*/,         // Multiple greedy .* without lazy
        ];
        if (redosPatterns.some(p => p.test(rule.pattern))) {
          console.warn(`[task-classifier] Skipping potentially unsafe regex pattern (ReDoS risk): "${rule.pattern}"`);
          return null;
        }

        return {
          rule,
          regex: new RegExp(rule.pattern, 'i'),
        };
      } catch {
        // Skip rules with invalid regex patterns
        // This can happen if config bypasses Zod validation
        console.warn(`[task-classifier] Skipping rule with invalid regex pattern: "${rule.pattern}"`);
        return null;
      }
    })
    .filter((r): r is CompiledRule => r !== null);

  return {
    classifyTask(taskDescription: string): TaskClassificationResult {
      // If classification disabled, return general with default workflow
      if (!enabled) {
        return {
          taskType: 'general',
          confidence: 0,
          matchedKeywords: [],
          workflow: defaultWorkflow,
        };
      }

      const description = taskDescription.toLowerCase().trim();

      // Empty description - return general with no confidence
      // INV-TC-005: Unknown tasks route to defaultWorkflow
      if (description.length === 0) {
        return {
          taskType: 'general',
          confidence: 0,
          matchedKeywords: [],
          workflow: defaultWorkflow,
        };
      }

      // INV-TC-002: First-match-wins (priority ordered)
      for (const { rule, regex } of compiledRules) {
        const match = description.match(regex);
        if (match) {
          // INV-TC-006: Confidence calculation considers all pattern matches
          // Use matchAll with global flag to capture all matches
          const globalRegex = new RegExp(rule.pattern, 'gi');
          const allMatches = [...description.matchAll(globalRegex)];
          const matchedKeywords = [...new Set(allMatches.map(m => m[0]))];

          // Calculate confidence based on total match coverage
          const totalMatchLength = allMatches.reduce((sum, m) => sum + m[0].length, 0);
          const matchRatio = Math.min(totalMatchLength / description.length, 1);
          // Base confidence of 0.6 + up to 0.4 based on match coverage
          // Bonus for multiple distinct matches (up to 0.1)
          const multiMatchBonus = Math.min((matchedKeywords.length - 1) * 0.05, 0.1);
          const confidence = Math.min(0.6 + matchRatio * 0.4 + multiMatchBonus, 1);

          return {
            taskType: rule.taskType as AgentTaskType,
            confidence,
            matchedKeywords,
            workflow: rule.workflow,
          };
        }
      }

      // INV-TC-003 & INV-TC-005: No match - return general with defaultWorkflow
      return {
        taskType: 'general',
        confidence: 0,
        matchedKeywords: [],
        workflow: defaultWorkflow,
      };
    },

    getRules(): TaskClassifierRule[] {
      return sortedRules;
    },

    getDefaultWorkflow(): string {
      return defaultWorkflow;
    },
  };
}

// Default classifier instance for backward compatibility
let defaultClassifier: TaskClassifier | null = null;

function getDefaultClassifier(): TaskClassifier {
  if (!defaultClassifier) {
    defaultClassifier = createTaskClassifier();
  }
  return defaultClassifier;
}

/**
 * Reset the default classifier cache.
 * Call this when classification rules may have changed at runtime.
 * INV-TC-008: Classifier cache can be invalidated
 */
export function resetDefaultClassifier(): void {
  defaultClassifier = null;
}

/**
 * Classify a task description into an AgentTaskType
 *
 * @param taskDescription - The task description to classify
 * @param availableCapabilities - Optional list of capabilities to filter by (legacy parameter)
 * @returns Classification result with taskType, confidence, and matched keywords
 *
 * @deprecated Use createTaskClassifier(config).classifyTask() for config-driven classification
 *
 * INV-TC-004: Classification is deterministic (same input = same taskType)
 */
export function classifyTask(
  taskDescription: string,
  availableCapabilities?: CapabilityMapping[]
): TaskClassificationResult {
  const classifier = getDefaultClassifier();
  const result = classifier.classifyTask(taskDescription);

  // Legacy behavior: filter by available capabilities if provided
  if (availableCapabilities && availableCapabilities.length > 0) {
    const availableTaskTypes = new Set(availableCapabilities.map((c) => c.taskType));

    // If result taskType is not in available capabilities, fallback to general
    if (!availableTaskTypes.has(result.taskType) && result.taskType !== 'general') {
      return {
        taskType: 'general',
        confidence: 0,
        matchedKeywords: [],
        workflow: result.workflow,
      };
    }
  }

  return result;
}

/**
 * Extract task description from various input formats
 */
export function extractTaskDescription(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;

    // Try common field names
    const fieldPriority = ['task', 'prompt', 'description', 'query', 'message', 'content', 'input'];

    for (const field of fieldPriority) {
      if (field in obj && typeof obj[field] === 'string') {
        return obj[field];
      }
    }

    // Fallback: stringify the object
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }

  return String(input);
}
