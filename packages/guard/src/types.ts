/**
 * AX Guard v1 - Post-check AI Coding Governance
 *
 * Types for policy, gates, and governance context.
 */

// Import and re-export Policy and GateType from contracts to avoid duplication
import type { Policy, GateType } from '@automatosx/contracts';
export type { Policy, GateType };

/**
 * Gate execution result status
 */
export type GateStatus = 'PASS' | 'FAIL' | 'WARN';

/**
 * Result of a single gate execution
 */
export interface GateResult {
  gate: GateType;
  status: GateStatus;
  message: string;
  details?: Record<string, unknown>;
}

// Policy interface is imported from @automatosx/contracts above

/**
 * Variables for policy path resolution
 */
export type PolicyVariables = Record<string, string>;

/**
 * Resolved governance context for a task
 */
export interface GovernanceContext {
  /**
   * The policy being applied
   */
  policyId: string;

  /**
   * Resolved allowed paths (variables substituted)
   */
  allowedPaths: string[];

  /**
   * Resolved forbidden paths
   */
  forbiddenPaths: string[];

  /**
   * Required contract test suites
   */
  requiredContracts: string[];

  /**
   * Gates to execute
   */
  enabledGates: GateType[];

  /**
   * Maximum packages that can be modified
   */
  changeRadiusLimit: number;

  /**
   * Target being operated on (e.g., provider name)
   */
  target: string;
}

/**
 * Overall guard check result
 */
export interface GuardResult {
  /**
   * Overall status (FAIL if any gate fails)
   */
  status: GateStatus;

  /**
   * Policy that was checked
   */
  policyId: string;

  /**
   * Target that was checked
   */
  target: string;

  /**
   * Individual gate results
   */
  gates: GateResult[];

  /**
   * Human-readable summary
   */
  summary: string;

  /**
   * Suggested actions for failures
   */
  suggestions: string[];

  /**
   * Timestamp of check
   */
  timestamp: string;
}

/**
 * Options for guard check command
 */
export interface GuardCheckOptions {
  /**
   * Policy to apply
   */
  policy: string;

  /**
   * Target (e.g., provider name)
   */
  target: string;

  /**
   * Base branch for diff comparison
   */
  baseBranch?: string;

  /**
   * Output format
   */
  format?: 'text' | 'json';

  /**
   * Enable verbose output
   */
  verbose?: boolean;
}

/**
 * Gate executor function signature
 */
export type GateExecutor = (
  context: GovernanceContext,
  changedFiles: string[]
) => Promise<GateResult>;
