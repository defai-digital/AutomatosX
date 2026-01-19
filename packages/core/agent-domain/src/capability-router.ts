/**
 * Capability Router
 *
 * Routes task inputs to appropriate capability mappings based on task classification.
 * Supports fallback to default workflow when no capability matches.
 *
 * Invariants:
 * - INV-CAP-001: workflowRef must reference valid workflow
 * - INV-CAP-004: Classification is deterministic
 * - INV-CAP-005: Falls back to default workflow if no match
 */

import type { AgentProfile, CapabilityMapping, AgentTaskType } from '@defai.digital/contracts';
import { classifyTask, extractTaskDescription } from './task-classifier.js';

/**
 * Result of capability routing
 */
export interface CapabilityRouteResult {
  /** Matched capability (null if using default workflow) */
  capability: CapabilityMapping | null;
  /** Classified task type */
  taskType: AgentTaskType;
  /** Classification confidence 0-1 */
  confidence: number;
  /** Whether to use agent's default workflow */
  useDefaultWorkflow: boolean;
  /** Keywords that matched during classification */
  matchedKeywords: string[];
}

/**
 * Route input to appropriate capability
 *
 * @param agent - Agent profile with optional capabilityMappings
 * @param input - Task input (string or object with task/prompt field)
 * @returns Routing result with capability, taskType, and confidence
 *
 * INV-CAP-004: Classification is deterministic
 * INV-CAP-005: Falls back to default workflow if no match
 */
export function routeToCapability(
  agent: AgentProfile,
  input: unknown
): CapabilityRouteResult {
  // No capability mappings = always use default workflow
  if (!agent.capabilityMappings || agent.capabilityMappings.length === 0) {
    return {
      capability: null,
      taskType: 'general',
      confidence: 0,
      useDefaultWorkflow: true,
      matchedKeywords: [],
    };
  }

  // Extract task description from input
  const taskDescription = extractTaskDescription(input);

  // Classify the task
  const classification = classifyTask(taskDescription, agent.capabilityMappings);

  // Find matching capability
  const capability = agent.capabilityMappings.find(
    (c) => c.taskType === classification.taskType
  );

  if (capability) {
    return {
      capability,
      taskType: classification.taskType,
      confidence: classification.confidence,
      useDefaultWorkflow: false,
      matchedKeywords: classification.matchedKeywords,
    };
  }

  // INV-CAP-005: No matching capability = fallback to default workflow
  return {
    capability: null,
    taskType: classification.taskType,
    confidence: classification.confidence,
    useDefaultWorkflow: true,
    matchedKeywords: classification.matchedKeywords,
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
  if (workflowRef.startsWith('std/')) {
    const workflowName = workflowRef.slice(4); // Remove "std/" prefix
    return `workflows/std/${workflowName}.yaml`;
  }

  // Custom workflow reference - append .yaml if needed
  if (!workflowRef.endsWith('.yaml') && !workflowRef.endsWith('.json')) {
    return `${workflowRef}.yaml`;
  }

  return workflowRef;
}

/**
 * Check if a workflow reference is a standard workflow
 */
export function isStandardWorkflow(workflowRef: string): boolean {
  return workflowRef.startsWith('std/');
}
