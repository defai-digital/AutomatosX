/**
 * Orchestration Types - Agent-to-agent collaboration and delegation
 *
 * @module types/orchestration
 * @since v4.7.0
 */

import type { ExecutionResponse } from './provider.js';
import type { IterateState } from './iterate.js';

/**
 * Delegation Request - Structured request for agent delegation
 *
 * @example
 * ```typescript
 * const request: DelegationRequest = {
 *   fromAgent: 'backend',
 *   toAgent: 'frontend',
 *   task: 'Create login UI component',
 *   context: {
 *     sessionId: 'auth-feature-123',
 *     requirements: ['Email/password fields', 'Form validation'],
 *     expectedOutputs: ['LoginForm.tsx', 'tests']
 *   }
 * };
 * ```
 */
export interface DelegationRequest {
  /** Agent initiating the delegation */
  fromAgent: string;

  /** Agent receiving the delegated task */
  toAgent: string;

  /** Task description for the delegated agent */
  task: string;

  /** Additional context for the delegation */
  context?: {
    /** Shared data to pass to delegated agent */
    sharedData?: Record<string, any>;

    /** Structured requirements for the task */
    requirements?: string[];

    /** Expected outputs from the delegated agent */
    expectedOutputs?: string[];

    /** Session ID to track related work (CRITICAL for multi-agent workflows) */
    sessionId?: string;

    /** Delegation chain for cycle detection */
    delegationChain?: string[];
  };

  /** Execution options */
  options?: {
    /** Maximum execution time in milliseconds */
    timeout?: number;

    /** Task priority (affects execution order if queued) */
    priority?: 'low' | 'medium' | 'high';
  };
}

/**
 * Delegation Result - Structured result from agent delegation
 *
 * Contains both the execution response and structured outputs for easy integration.
 *
 * @example
 * ```typescript
 * const result = await executor.delegateToAgent(request);
 *
 * // Access structured outputs
 * console.log('Files created:', result.outputs.files);
 * console.log('Memory IDs:', result.outputs.memoryIds);
 * console.log('Workspace path:', result.outputs.workspacePath);
 * ```
 */
export interface DelegationResult {
  /** Unique delegation identifier (for tracking and auditing) */
  delegationId: string;

  /** Agent that initiated the delegation */
  fromAgent: string;

  /** Agent that executed the task */
  toAgent: string;

  /** Task description */
  task: string;

  /** Delegation status */
  status: 'success' | 'failure' | 'timeout';

  /** Whether the delegation was successful (derived from status) */
  success: boolean;

  /** Response from the delegated agent execution */
  response: ExecutionResponse;

  /** Execution duration in milliseconds */
  duration: number;

  /** Structured outputs from the delegation */
  outputs: {
    /** Files created in shared workspace */
    files?: string[];

    /** Memory entry IDs created during execution */
    memoryIds?: number[];

    /** Path to workspace containing outputs */
    workspacePath?: string;
  };

  /** Delegation start timestamp */
  startTime: Date;

  /** Delegation completion timestamp */
  endTime: Date;
}

/**
 * Session - Tracks multi-agent collaborative workflows
 *
 * A session groups related work across multiple agents, providing shared context
 * and workspace organization.
 *
 * @example
 * ```typescript
 * // Create session for auth feature implementation
 * const session = await sessionManager.createSession(
 *   'Implement authentication feature',
 *   'backend'
 * );
 *
 * // Agents added as they join the work
 * await sessionManager.addAgent(session.id, 'frontend');
 * await sessionManager.addAgent(session.id, 'security');
 * ```
 */
export interface Session {
  /** Unique session identifier (UUID) */
  id: string;

  /** Agent that initiated the session */
  initiator: string;

  /** Overall task/goal for the session */
  task: string;

  /** Agents involved in this session (ordered by join time) */
  agents: string[];

  /** Current session status */
  status: 'active' | 'completed' | 'failed';

  /** Session creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /**
   * Additional session metadata
   *
   * Phase 3: May contain tasks array for task tracking
   * tasks?: Array<{id, title, agent, startedAt, status, ...}>
   */
  metadata?: Record<string, any>;

  /**
   * Iterate mode state (v6.4.0+)
   *
   * Present when session is running in autonomous iterate mode.
   * Tracks iterations, auto-responses, cost, and classification history.
   *
   * @since v6.4.0
   */
  iterateState?: IterateState;
}

/**
 * Orchestration Configuration - Agent collaboration capabilities
 *
 * Defines delegation depth limits for agents.
 * All agents can delegate by default (v4.9.0+). Safety is ensured through
 * cycle detection, depth limits, and timeouts.
 *
 * v5.2.0: Workspace permission fields removed. All agents have equal access
 * to automatosx/PRD and automatosx/tmp.
 *
 * @example
 * ```yaml
 * # .automatosx/agents/backend.yaml
 * orchestration:
 *   maxDelegationDepth: 3
 * ```
 */
export interface OrchestrationConfig {
  /**
   * Maximum delegation chain depth (default: 3)
   *
   * This represents the number of intermediate delegations allowed, NOT the total number of agents.
   *
   * Example:
   * - maxDelegationDepth = 3 allows: A → B → C → D (3 delegations, 4 agents)
   * - maxDelegationDepth = 3 rejects: A → B → C → D → E (4 delegations, 5 agents)
   *
   * The depth is measured by the length of the delegation chain (excluding the current agent).
   */
  maxDelegationDepth?: number;

  // v5.2.0: Removed workspace permission controls
  // All agents have equal access to automatosx/PRD and automatosx/tmp
}

/**
 * Orchestration Metadata - Runtime orchestration information in execution context
 *
 * Added to ExecutionContext when orchestration system is enabled.
 * v4.9.0+: All agents can delegate by default. This metadata indicates whether
 * the orchestration infrastructure (SessionManager, WorkspaceManager) is available.
 */
export interface OrchestrationMetadata {
  /** Whether orchestration system is enabled (SessionManager/WorkspaceManager available) */
  isDelegationEnabled: boolean;

  /** List of available agents for delegation */
  availableAgents: string[];

  /** Path to shared workspace */
  sharedWorkspace: string;

  /** Current delegation chain (for cycle detection) */
  delegationChain: string[];

  /** Maximum delegation depth (default: 3) */
  maxDelegationDepth: number;
}

/**
 * Delegation Error - Specialized error for delegation failures
 */
export class DelegationError extends Error {
  constructor(
    message: string,
    public readonly fromAgent: string,
    public readonly toAgent: string,
    public readonly reason: 'unauthorized' | 'not_found' | 'max_depth' | 'cycle' | 'timeout' | 'execution_failed'
  ) {
    super(message);
    this.name = 'DelegationError';
  }
}

/**
 * Session Error - Specialized error for session operations
 */
export class SessionError extends Error {
  constructor(
    message: string,
    public readonly sessionId?: string,
    public readonly reason?: 'not_found' | 'already_completed' | 'creation_failed' | 'invalid_format' | 'metadata_too_large'
  ) {
    super(message);
    this.name = 'SessionError';
  }
}
