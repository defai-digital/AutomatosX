/**
 * Agent Selection Gate
 *
 * Governance gate for validating agent selection decisions.
 * Ensures agent selection follows policy constraints and invariants.
 *
 * Invariants enforced:
 * - INV-GUARD-AGT-001: Selected agent must be enabled
 * - INV-GUARD-AGT-002: Selected agent must match required capabilities
 * - INV-GUARD-AGT-003: Selected agent must not be in excluded list
 * - INV-GUARD-AGT-004: Agent must be within allowed team scope
 * - INV-GUARD-AGT-005: Confidence must meet minimum threshold
 */

import type { GateResult, GovernanceContext } from '../types.js';

/**
 * Agent selection context for gate validation
 */
export interface AgentSelectionGateContext {
  /** The selected agent ID */
  selectedAgentId: string;

  /** Selection confidence (0-1) */
  confidence: number;

  /** The task that was matched */
  task: string;

  /** Required capabilities */
  requiredCapabilities?: string[];

  /** Team scope restriction */
  teamScope?: string;

  /** Excluded agents */
  excludedAgents?: string[];

  /** Agent's capabilities */
  agentCapabilities?: string[];

  /** Agent's team */
  agentTeam?: string;

  /** Agent enabled status */
  agentEnabled?: boolean;

  /** Agent category */
  agentCategory?: string;
}

/**
 * Configuration for agent selection gate
 */
export interface AgentSelectionGateConfig {
  /** Minimum confidence threshold (default: 0.3) */
  minConfidence?: number;

  /** Required agent categories */
  allowedCategories?: string[];

  /** Forbidden agent categories */
  forbiddenCategories?: string[];

  /** Require team match */
  enforceTeamScope?: boolean;
}

const DEFAULT_CONFIG: AgentSelectionGateConfig = {
  minConfidence: 0.3,
  enforceTeamScope: false,
};

/**
 * Executes the agent selection gate
 *
 * Validates that an agent selection decision meets governance requirements.
 */
export function agentSelectionGate(
  _governanceContext: GovernanceContext,
  selectionContext: AgentSelectionGateContext,
  config: AgentSelectionGateConfig = {}
): Promise<GateResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const violations: string[] = [];
  const warnings: string[] = [];

  // INV-GUARD-AGT-001: Selected agent must be enabled
  if (selectionContext.agentEnabled === false) {
    violations.push(
      `Agent "${selectionContext.selectedAgentId}" is disabled and cannot be selected`
    );
  }

  // INV-GUARD-AGT-002: Check required capabilities
  if (
    selectionContext.requiredCapabilities &&
    selectionContext.requiredCapabilities.length > 0
  ) {
    const agentCaps = selectionContext.agentCapabilities ?? [];
    const missingCaps = selectionContext.requiredCapabilities.filter(
      (req) => !agentCaps.some((cap) => cap.toLowerCase().includes(req.toLowerCase()))
    );

    if (missingCaps.length > 0) {
      violations.push(
        `Agent "${selectionContext.selectedAgentId}" is missing required capabilities: ${missingCaps.join(', ')}`
      );
    }
  }

  // INV-GUARD-AGT-003: Check excluded agents
  if (selectionContext.excludedAgents?.includes(selectionContext.selectedAgentId)) {
    violations.push(
      `Agent "${selectionContext.selectedAgentId}" is in the excluded agents list`
    );
  }

  // INV-GUARD-AGT-004: Check team scope
  if (
    mergedConfig.enforceTeamScope &&
    selectionContext.teamScope &&
    selectionContext.agentTeam !== selectionContext.teamScope
  ) {
    violations.push(
      `Agent "${selectionContext.selectedAgentId}" (team: ${selectionContext.agentTeam ?? 'none'}) is not in required team scope: ${selectionContext.teamScope}`
    );
  }

  // INV-GUARD-AGT-005: Check confidence threshold
  if (
    mergedConfig.minConfidence !== undefined &&
    selectionContext.confidence < mergedConfig.minConfidence
  ) {
    warnings.push(
      `Selection confidence (${selectionContext.confidence.toFixed(2)}) is below threshold (${mergedConfig.minConfidence})`
    );
  }

  // Check allowed categories
  if (
    mergedConfig.allowedCategories &&
    mergedConfig.allowedCategories.length > 0 &&
    selectionContext.agentCategory
  ) {
    if (!mergedConfig.allowedCategories.includes(selectionContext.agentCategory)) {
      violations.push(
        `Agent category "${selectionContext.agentCategory}" is not in allowed categories: ${mergedConfig.allowedCategories.join(', ')}`
      );
    }
  }

  // Check forbidden categories
  if (
    mergedConfig.forbiddenCategories &&
    selectionContext.agentCategory &&
    mergedConfig.forbiddenCategories.includes(selectionContext.agentCategory)
  ) {
    violations.push(
      `Agent category "${selectionContext.agentCategory}" is forbidden`
    );
  }

  // Determine result
  if (violations.length > 0) {
    return Promise.resolve({
      gate: 'agent_selection',
      status: 'FAIL',
      message: `Agent selection failed: ${violations[0]}`,
      details: {
        violations,
        warnings,
        selectedAgent: selectionContext.selectedAgentId,
        confidence: selectionContext.confidence,
        task: selectionContext.task,
      },
    });
  }

  if (warnings.length > 0) {
    return Promise.resolve({
      gate: 'agent_selection',
      status: 'WARN',
      message: `Agent selection passed with warnings: ${warnings[0]}`,
      details: {
        warnings,
        selectedAgent: selectionContext.selectedAgentId,
        confidence: selectionContext.confidence,
      },
    });
  }

  return Promise.resolve({
    gate: 'agent_selection',
    status: 'PASS',
    message: `Agent "${selectionContext.selectedAgentId}" selected with confidence ${selectionContext.confidence.toFixed(2)}`,
    details: {
      selectedAgent: selectionContext.selectedAgentId,
      confidence: selectionContext.confidence,
      category: selectionContext.agentCategory,
    },
  });
}

/**
 * Validates agent selection policy compliance
 *
 * Used to pre-validate selection requests against policy before execution.
 */
export function validateSelectionPolicy(
  request: {
    task: string;
    team?: string;
    requiredCapabilities?: string[];
    excludeAgents?: string[];
  },
  config: AgentSelectionGateConfig = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate task is not empty
  if (!request.task || request.task.trim().length === 0) {
    errors.push('Task description is required');
  }

  // Validate task length
  if (request.task && request.task.length > 2000) {
    errors.push('Task description exceeds maximum length (2000 characters)');
  }

  // Validate required capabilities don't exceed limit
  if (request.requiredCapabilities && request.requiredCapabilities.length > 10) {
    errors.push('Required capabilities cannot exceed 10 items');
  }

  // Validate excluded agents don't exceed limit
  if (request.excludeAgents && request.excludeAgents.length > 20) {
    errors.push('Excluded agents cannot exceed 20 items');
  }

  // Check if enforcing team scope without providing team
  if (config.enforceTeamScope && !request.team) {
    errors.push('Team scope is required when enforceTeamScope is enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
