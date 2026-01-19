/**
 * Task Classifier
 *
 * Classifies task descriptions into AgentTaskType for capability routing.
 * Uses keyword-based matching with confidence scoring.
 *
 * Invariants:
 * - INV-CAP-004: Classification is deterministic (same input = same taskType)
 */

import type { AgentTaskType, CapabilityMapping } from '@defai.digital/contracts';

/**
 * Result of task classification
 */
export interface TaskClassificationResult {
  /** Classified task type */
  taskType: AgentTaskType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Keywords that matched */
  matchedKeywords: string[];
}

/**
 * Keywords for each task type
 * Lower indices = higher priority when scores are equal
 */
const TASK_TYPE_KEYWORDS: Record<AgentTaskType, string[]> = {
  'code-review': [
    'review',
    'pr',
    'pull request',
    'code review',
    'feedback',
    'merge request',
    'mr',
    'check code',
    'look at this code',
    'review this',
  ],
  debugging: [
    'debug',
    'bug',
    'error',
    'fix',
    'issue',
    'broken',
    'failing',
    'crash',
    'exception',
    'not working',
    'stack trace',
    'traceback',
  ],
  refactoring: [
    'refactor',
    'improve',
    'clean up',
    'restructure',
    'simplify',
    'reorganize',
    'optimize code',
    'code smell',
    'technical debt',
    'modernize',
  ],
  'api-design': [
    'api',
    'endpoint',
    'rest',
    'graphql',
    'interface',
    'contract',
    'openapi',
    'swagger',
    'routes',
    'service interface',
  ],
  implementation: [
    'implement',
    'build',
    'create',
    'add',
    'feature',
    'develop',
    'write code',
    'make',
    'construct',
    'new feature',
  ],
  testing: [
    'test',
    'spec',
    'coverage',
    'unit test',
    'integration test',
    'e2e',
    'testing',
    'test case',
    'assertion',
    'mock',
  ],
  documentation: [
    'document',
    'readme',
    'docs',
    'explain',
    'describe',
    'jsdoc',
    'comment',
    'documentation',
    'wiki',
    'guide',
  ],
  analysis: [
    'analyze',
    'investigate',
    'understand',
    'explore',
    'research',
    'examine',
    'assess',
    'evaluate',
    'study',
    'look into',
  ],
  planning: [
    'plan',
    'design',
    'architect',
    'strategy',
    'approach',
    'roadmap',
    'proposal',
    'specification',
    'requirements',
  ],
  general: [],
};

/**
 * Classify a task description into a AgentTaskType
 *
 * @param taskDescription - The task description to classify
 * @param availableCapabilities - Optional list of capabilities to filter by
 * @returns Classification result with taskType, confidence, and matched keywords
 *
 * INV-CAP-004: Classification is deterministic (same input = same taskType)
 */
export function classifyTask(
  taskDescription: string,
  availableCapabilities?: CapabilityMapping[]
): TaskClassificationResult {
  const description = taskDescription.toLowerCase().trim();

  // If no description, return general
  if (description.length === 0) {
    return {
      taskType: 'general',
      confidence: 0,
      matchedKeywords: [],
    };
  }

  // Determine which task types to consider
  const availableAgentTaskTypes = availableCapabilities
    ? new Set(availableCapabilities.map((c) => c.taskType))
    : new Set(Object.keys(TASK_TYPE_KEYWORDS) as AgentTaskType[]);

  // Always allow 'general' as fallback
  availableAgentTaskTypes.add('general');

  // Score each task type
  const scores: {
    taskType: AgentTaskType;
    score: number;
    keywords: string[];
    priority: number;
  }[] = [];

  const taskTypeEntries = Object.entries(TASK_TYPE_KEYWORDS) as [AgentTaskType, string[]][];

  for (const [taskType, keywords] of taskTypeEntries) {
    if (!availableAgentTaskTypes.has(taskType)) {
      continue;
    }

    const matchedKeywords = keywords.filter((k) => description.includes(k));
    const score = matchedKeywords.length;

    // Get priority from capability mapping (higher = preferred)
    const capability = availableCapabilities?.find((c) => c.taskType === taskType);
    const priority = capability?.priority ?? 50;

    if (score > 0 || taskType === 'general') {
      scores.push({
        taskType,
        score,
        keywords: matchedKeywords,
        priority,
      });
    }
  }

  // Sort by:
  // 1. Score descending (more keyword matches = better)
  // 2. Priority descending (higher priority = preferred)
  // 3. AgentTaskType alphabetically (deterministic tie-breaker)
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.taskType.localeCompare(b.taskType);
  });

  // Select best match
  const best = scores[0] ?? { taskType: 'general' as AgentTaskType, score: 0, keywords: [], priority: 50 };

  // Calculate confidence based on match quality
  const maxPossibleScore = Math.max(
    ...Object.values(TASK_TYPE_KEYWORDS).map((k) => Math.min(k.length, 3)), // Cap at 3 for normalization
    1
  );
  const normalizedScore = Math.min(best.score / maxPossibleScore, 1);

  // Boost confidence if multiple keywords matched
  const confidence = best.score === 0 ? 0 : Math.min(0.3 + normalizedScore * 0.7, 1);

  return {
    taskType: best.taskType,
    confidence,
    matchedKeywords: best.keywords,
  };
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
