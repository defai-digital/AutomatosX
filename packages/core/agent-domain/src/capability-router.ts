/**
 * Capability Router
 *
 * Routes task inputs to appropriate capability mappings based on task classification.
 * Supports both:
 * 1. Agent's taskClassifier config (meta-agent pattern) - direct workflow routing
 * 2. Capability mappings (archetype pattern) - capability-based routing
 *
 * Invariants:
 * - INV-CAP-001: workflowRef must reference valid workflow
 * - INV-CAP-004: Classification is deterministic
 * - INV-CAP-005: Falls back to default workflow if no match
 * - INV-TC-001: Case-insensitive pattern matching
 * - INV-TC-002: First-match-wins (priority ordered)
 * - INV-TC-003: Default workflow fallback
 */

import type { AgentProfile, CapabilityMapping, AgentTaskType } from '@defai.digital/contracts';
import { classifyTask, createTaskClassifier, extractTaskDescription } from './task-classifier.js';

// ============================================================================
// Constants
// ============================================================================

/** Default capability priority for sorting */
const DEFAULT_CAPABILITY_PRIORITY = 50;

/** Standard workflow path prefix */
const STD_WORKFLOW_PREFIX = 'std/';

/** Base path for standard workflows */
const WORKFLOWS_BASE_PATH = 'workflows/std';

/** Supported workflow file extensions */
const WORKFLOW_EXTENSIONS = ['.yaml', '.json'] as const;

/** Default workflow extension when not specified */
const DEFAULT_WORKFLOW_EXTENSION = '.yaml';

/**
 * Result of capability routing
 */
export interface CapabilityRouteResult {
  /** Matched capability (null if using default workflow or taskClassifier) */
  capability: CapabilityMapping | null;
  /** Classified task type */
  taskType: AgentTaskType;
  /** Classification confidence 0-1 */
  confidence: number;
  /** Whether to use agent's default workflow */
  useDefaultWorkflow: boolean;
  /** Keywords that matched during classification */
  matchedKeywords: string[];
  /** Resolved workflow path (from taskClassifier or capability) - undefined means use agent's default */
  workflow: string | undefined;
  /** Whether taskClassifier was used for routing */
  usedTaskClassifier: boolean;
  /** INV-CAP-007: Whether classification was actually performed (false = default routing) */
  classificationPerformed: boolean;
}

/**
 * Route input to appropriate capability
 *
 * Supports two routing patterns:
 * 1. taskClassifier config (meta-agent pattern): Uses agent's taskClassifier rules
 *    to directly determine the workflow based on regex patterns.
 * 2. capabilityMappings (archetype pattern): Uses keyword-based classification
 *    to find matching capability and its workflow.
 *
 * @param agent - Agent profile with optional taskClassifier or capabilityMappings
 * @param input - Task input (string or object with task/prompt field)
 * @returns Routing result with capability, taskType, workflow, and confidence
 *
 * INV-CAP-004: Classification is deterministic
 * INV-CAP-005: Falls back to default workflow if no match
 * INV-TC-001: Case-insensitive pattern matching
 * INV-TC-002: First-match-wins (priority ordered)
 * INV-TC-003: Default workflow fallback
 */
export function routeToCapability(
  agent: AgentProfile,
  input: unknown
): CapabilityRouteResult {
  // Extract task description from input
  const taskDescription = extractTaskDescription(input);

  // Pattern 1: Use agent's taskClassifier config if provided (meta-agent pattern)
  // This takes priority over capabilityMappings
  if (agent.taskClassifier?.enabled !== false && agent.taskClassifier?.rules?.length) {
    const classifier = createTaskClassifier(agent.taskClassifier);
    const result = classifier.classifyTask(taskDescription);

    return {
      capability: null, // No capability mapping in this pattern
      taskType: result.taskType,
      confidence: result.confidence,
      useDefaultWorkflow: !result.workflow,
      matchedKeywords: result.matchedKeywords,
      workflow: result.workflow,
      usedTaskClassifier: true,
      classificationPerformed: true,
    };
  }

  // Pattern 2: Use capabilityMappings (archetype pattern)
  // INV-CAP-007: No capability mappings = default routing with confidence 1
  if (!agent.capabilityMappings || agent.capabilityMappings.length === 0) {
    return {
      capability: null,
      taskType: 'general',
      confidence: 1, // We're 100% confident this is the default path
      useDefaultWorkflow: true,
      matchedKeywords: [],
      workflow: undefined,
      usedTaskClassifier: false,
      classificationPerformed: false, // No classification was performed
    };
  }

  // Classify the task using default keyword-based classifier
  const classification = classifyTask(taskDescription, agent.capabilityMappings);

  // INV-CAP-006: Find best matching capability (highest priority)
  // Filter all matching capabilities and select by priority
  const matchingCapabilities = agent.capabilityMappings.filter(
    (c) => c.taskType === classification.taskType
  );

  // Sort by priority (highest first), then by array order
  const capability = matchingCapabilities.length > 0
    ? matchingCapabilities.sort((a, b) =>
        (b.priority ?? DEFAULT_CAPABILITY_PRIORITY) - (a.priority ?? DEFAULT_CAPABILITY_PRIORITY)
      )[0]
    : undefined;

  if (capability) {
    return {
      capability,
      taskType: classification.taskType,
      confidence: classification.confidence,
      useDefaultWorkflow: false,
      matchedKeywords: classification.matchedKeywords,
      workflow: capability.workflowRef ? resolveWorkflowRef(capability.workflowRef) : undefined,
      usedTaskClassifier: false,
      classificationPerformed: true,
    };
  }

  // INV-CAP-005: No matching capability = fallback to default workflow
  return {
    capability: null,
    taskType: classification.taskType,
    confidence: classification.confidence,
    useDefaultWorkflow: true,
    matchedKeywords: classification.matchedKeywords,
    workflow: undefined,
    usedTaskClassifier: false,
    classificationPerformed: true,
  };
}

/**
 * Get abilities for a capability mapping
 *
 * Merges capability-specific abilities with agent's core abilities.
 * Capability abilities take precedence (listed first).
 *
 * @param capability - Capability mapping (may be null)
 * @param agent - Agent profile
 * @returns Array of ability IDs to inject
 */
export function getAbilitiesForCapability(
  capability: CapabilityMapping | null,
  agent: AgentProfile
): string[] {
  const abilities: string[] = [];

  // Add capability-specific abilities first (higher priority)
  if (capability?.abilities) {
    abilities.push(...capability.abilities);
  }

  // Add agent's core abilities
  if (agent.abilities?.core) {
    for (const core of agent.abilities.core) {
      if (!abilities.includes(core)) {
        abilities.push(core);
      }
    }
  }

  return abilities;
}

/**
 * Resolve workflow reference to file path
 *
 * Handles both standard workflows (std/*) and custom workflows.
 *
 * @param workflowRef - Workflow reference (e.g., "std/code-review" or "custom/my-workflow")
 * @returns Resolved file path
 */
export function resolveWorkflowRef(workflowRef: string): string {
  // Standard workflow reference (e.g., "std/code-review")
  if (workflowRef.startsWith(STD_WORKFLOW_PREFIX)) {
    const workflowName = workflowRef.slice(STD_WORKFLOW_PREFIX.length);
    // INV-CAP-006: Guard against empty workflow name (e.g., "std/" alone)
    if (!workflowName) {
      throw new Error(`Invalid workflow reference: "${workflowRef}" - workflow name is empty`);
    }
    return `${WORKFLOWS_BASE_PATH}/${workflowName}${DEFAULT_WORKFLOW_EXTENSION}`;
  }

  // Custom workflow reference - append extension if needed
  if (!WORKFLOW_EXTENSIONS.some(ext => workflowRef.endsWith(ext))) {
    return `${workflowRef}${DEFAULT_WORKFLOW_EXTENSION}`;
  }

  return workflowRef;
}

/**
 * Check if a workflow reference is a standard workflow
 */
export function isStandardWorkflow(workflowRef: string): boolean {
  return workflowRef.startsWith(STD_WORKFLOW_PREFIX);
}
