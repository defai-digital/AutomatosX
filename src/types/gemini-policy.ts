/**
 * Gemini Policy Engine Types
 *
 * Policy engine for Gemini CLI to enforce security restrictions,
 * tool limitations, and operational boundaries.
 */

/**
 * Policy violation severity levels
 */
export enum PolicyViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Policy violation types
 */
export enum PolicyViolationType {
  TOOL_BLOCKED = 'tool_blocked',
  PATH_DENIED = 'path_denied',
  FILE_SIZE_EXCEEDED = 'file_size_exceeded',
  OPERATION_DENIED = 'operation_denied',
  QUOTA_EXCEEDED = 'quota_exceeded'
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: PolicyViolationSeverity;
  type: PolicyViolationType;
  condition: {
    // Tool-based rules
    tools?: string[];
    // Path-based rules
    paths?: string[];
    patterns?: string[];
    // Size-based rules
    maxFileSize?: number;
    // Operation-based rules
    operations?: string[];
  };
  action: 'block' | 'warn' | 'log' | 'require_approval';
  message?: string;
}

/**
 * Policy violation record
 */
export interface PolicyViolation {
  id: string;
  ruleId: string;
  type: PolicyViolationType;
  severity: PolicyViolationSeverity;
  message: string;
  details: {
    tool?: string;
    path?: string;
    operation?: string;
    fileSize?: number;
    limit?: number;
    actual?: number;
    error?: string;
  };
  timestamp: Date;
  action: 'blocked' | 'warned' | 'logged' | 'approval_required';
  resolved: boolean;
}

/**
 * Policy validation context
 */
export interface PolicyContext {
  operation: string;
  tool?: string;
  path?: string;
  fileSize?: number;
  user?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  allowed: boolean;
  violations: PolicyViolation[];
  requiresApproval: boolean;
  warnings: string[];
}

/**
 * Gemini policy configuration
 */
export interface GeminiPolicy {
  enabled: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
  requireApproval?: string[];
  maxFileSize?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  rules?: PolicyRule[];
  strictMode?: boolean;
  logViolations?: boolean;
  auditMode?: boolean;
}

/**
 * Policy engine statistics
 */
export interface PolicyStats {
  totalValidations: number;
  violationsBlocked: number;
  violationsWarned: number;
  approvalsRequired: number;
  topViolations: Array<{
    ruleId: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

/**
 * Policy audit log entry
 */
export interface PolicyAuditLog {
  id: string;
  timestamp: Date;
  sessionId?: string;
  user?: string;
  operation: string;
  result: 'allowed' | 'blocked' | 'warning' | 'approval_required';
  violations: PolicyViolation[];
  duration: number;
  metadata?: Record<string, unknown>;
}