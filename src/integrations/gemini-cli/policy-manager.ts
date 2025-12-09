/**
 * Gemini Policy Manager
 *
 * Enforces security policies, tool restrictions, and operational boundaries
 * for Gemini CLI operations.
 */

import { randomUUID } from 'crypto';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { writeFile, mkdir } from 'fs/promises';
import {
  PolicyViolationType,
  PolicyViolationSeverity
} from '../../types/gemini-policy.js';
import type {
  GeminiPolicy,
  PolicyViolation,
  PolicyContext,
  PolicyValidationResult,
  PolicyStats,
  PolicyAuditLog
} from '../../types/gemini-policy.js';
import { logger } from '../../shared/logging/logger.js';

export class GeminiPolicyManager {
  private policy: GeminiPolicy;
  private stats: PolicyStats;
  private auditLog: PolicyAuditLog[] = [];
  private auditLogPath: string;

  constructor(policy: GeminiPolicy = { enabled: false }) {
    this.policy = policy;
    this.stats = {
      totalValidations: 0,
      violationsBlocked: 0,
      violationsWarned: 0,
      approvalsRequired: 0,
      topViolations: []
    };
    this.auditLogPath = join(homedir(), '.automatosx', 'policy-audit.json');
  }

  /**
   * Validate an operation against policy rules
   */
  validateOperation(context: PolicyContext): PolicyValidationResult {
    const startTime = Date.now();
    this.stats.totalValidations++;

    const result: PolicyValidationResult = {
      allowed: true,
      violations: [],
      requiresApproval: false,
      warnings: []
    };

    try {
      // Skip validation if policy is disabled
      if (!this.policy.enabled) {
        return result;
      }

      // Check tool restrictions
      if (context.tool) {
        const toolResult = this.validateTool(context.tool);
        result.violations.push(...toolResult.violations);
        if (!toolResult.allowed) {
          result.allowed = false;
        }
        if (toolResult.requiresApproval) {
          result.requiresApproval = true;
        }
      }

      // Check path restrictions
      if (context.path) {
        const pathResult = this.validatePath(context.path);
        result.violations.push(...pathResult.violations);
        if (!pathResult.allowed) {
          result.allowed = false;
        }
        if (pathResult.requiresApproval) {
          result.requiresApproval = true;
        }
      }

      // Check file size limits
      if (context.fileSize !== undefined) {
        const sizeResult = this.validateFileSize(context.fileSize);
        result.violations.push(...sizeResult.violations);
        if (!sizeResult.allowed) {
          result.allowed = false;
        }
      }

      return result;

    } catch (error) {
      logger.error('Policy validation error', { error, context });
      
      // Fail safe: block operation on validation error
      const errorViolation: PolicyViolation = {
        id: randomUUID(),
        ruleId: 'validation-error',
        type: PolicyViolationType.OPERATION_DENIED,
        severity: PolicyViolationSeverity.HIGH,
        message: 'Policy validation failed',
        details: { error: String(error) },
        timestamp: new Date(),
        action: 'blocked',
        resolved: false
      };

      result.allowed = false;
      result.violations.push(errorViolation);
      result.warnings.push('Policy validation system error - operation blocked for safety');

      return result;
    }
  }

  /**
   * Enforce policy by throwing error if operation is not allowed
   */
  enforcePolicy(context: PolicyContext): void {
    const result = this.validateOperation(context);

    if (!result.allowed) {
      const messages = result.violations.map(v => v.message);
      throw new Error(`Policy violation: ${messages.join('; ')}`);
    }

    if (result.requiresApproval) {
      const messages = result.violations.map(v => v.message);
      throw new Error(`Approval required: ${messages.join('; ')}`);
    }

    if (result.warnings.length > 0 && this.policy.strictMode) {
      throw new Error(`Policy warnings in strict mode: ${result.warnings.join('; ')}`);
    }
  }

  /**
   * Validate tool access
   */
  private validateTool(tool: string): PolicyValidationResult {
    const result: PolicyValidationResult = {
      allowed: true,
      violations: [],
      requiresApproval: false,
      warnings: []
    };

    // Check blocked tools
    if (this.policy.blockedTools?.includes(tool)) {
      const violation: PolicyViolation = {
        id: randomUUID(),
        ruleId: 'blocked-tools',
        type: PolicyViolationType.TOOL_BLOCKED,
        severity: PolicyViolationSeverity.HIGH,
        message: `Tool "${tool}" is blocked by policy`,
        details: { tool },
        timestamp: new Date(),
        action: 'blocked',
        resolved: false
      };
      result.violations.push(violation);
      result.allowed = false;
      return result;
    }

    // Check allowed tools (if specified)
    if (this.policy.allowedTools && !this.policy.allowedTools.includes(tool)) {
      const violation: PolicyViolation = {
        id: randomUUID(),
        ruleId: 'allowed-tools',
        type: PolicyViolationType.TOOL_BLOCKED,
        severity: PolicyViolationSeverity.MEDIUM,
        message: `Tool "${tool}" is not in allowed list`,
        details: { tool },
        timestamp: new Date(),
        action: 'blocked',
        resolved: false
      };
      result.violations.push(violation);
      result.allowed = false;
      return result;
    }

    // Check tools requiring approval
    if (this.policy.requireApproval?.includes(tool)) {
      const violation: PolicyViolation = {
        id: randomUUID(),
        ruleId: 'approval-required',
        type: PolicyViolationType.TOOL_BLOCKED,
        severity: PolicyViolationSeverity.LOW,
        message: `Tool "${tool}" requires approval`,
        details: { tool },
        timestamp: new Date(),
        action: 'approval_required',
        resolved: false
      };
      result.violations.push(violation);
      result.requiresApproval = true;
    }

    return result;
  }

  /**
   * Validate path access
   */
  private validatePath(path: string): PolicyValidationResult {
    const result: PolicyValidationResult = {
      allowed: true,
      violations: [],
      requiresApproval: false,
      warnings: []
    };

    const resolvedPath = resolve(path);

    // Check blocked paths
    if (this.policy.blockedPaths) {
      for (const blockedPath of this.policy.blockedPaths) {
        const resolvedBlocked = resolve(blockedPath);
        if (resolvedPath.startsWith(resolvedBlocked)) {
          const violation: PolicyViolation = {
            id: randomUUID(),
            ruleId: 'blocked-paths',
            type: PolicyViolationType.PATH_DENIED,
            severity: PolicyViolationSeverity.HIGH,
            message: `Path "${path}" is blocked by policy`,
            details: { path: resolvedPath },
            timestamp: new Date
,
            action: 'blocked',
            resolved: false
          };
          result.violations.push(violation);
          result.allowed = false;
          return result;
        }
      }
    }

    // Check allowed paths (if specified)
    if (this.policy.allowedPaths) {
      let allowed = false;
      for (const allowedPath of this.policy.allowedPaths) {
        const resolvedAllowed = resolve(allowedPath);
        if (resolvedPath.startsWith(resolvedAllowed)) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        const violation: PolicyViolation = {
          id: randomUUID(),
          ruleId: 'allowed-paths',
          type: PolicyViolationType.PATH_DENIED,
          severity: PolicyViolationSeverity.MEDIUM,
          message: `Path "${path}" is not in allowed list`,
          details: { path: resolvedPath },
          timestamp: new Date(),
          action: 'blocked',
          resolved: false
        };
        result.violations.push(violation);
        result.allowed = false;
      }
    }

    return result;
  }

  /**
   * Validate file size
   */
  private validateFileSize(fileSize: number): PolicyValidationResult {
    const result: PolicyValidationResult = {
      allowed: true,
      violations: [],
      requiresApproval: false,
      warnings: []
    };

    if (this.policy.maxFileSize && fileSize > this.policy.maxFileSize) {
      const violation: PolicyViolation = {
        id: randomUUID(),
        ruleId: 'max-file-size',
        type: PolicyViolationType.FILE_SIZE_EXCEEDED,
        severity: PolicyViolationSeverity.MEDIUM,
        message: `File size ${fileSize} bytes exceeds limit of ${this.policy.maxFileSize} bytes`,
        details: { fileSize, limit: this.policy.maxFileSize },
        timestamp: new Date(),
        action: 'blocked',
        resolved: false
      };
      result.violations.push(violation);
      result.allowed = false;
    }

    return result;
  }

  /**
   * Log audit entry
   */
  private logAudit(
    context: PolicyContext,
    result: 'allowed' | 'blocked' | 'warning' | 'approval_required',
    validationResult: PolicyValidationResult,
    duration: number
  ): void {
    if (!this.policy.auditMode) {
      return;
    }

    const auditEntry: PolicyAuditLog = {
      id: randomUUID(),
      timestamp: new Date(),
      sessionId: context.sessionId,
      user: context.user,
      operation: context.operation,
      result,
      violations: validationResult.violations,
      duration,
      metadata: context.metadata
    };

    this.auditLog.push(auditEntry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Async write to disk
    this.writeAuditLog().catch(error => {
      logger.error('Failed to write audit log', { error });
    });
  }

  /**
   * Write audit log to disk
   */
  private async writeAuditLog(): Promise<void> {
    try {
      const auditDir = join(homedir(), '.automatosx');
      await mkdir(auditDir, { recursive: true });
      
      await writeFile(
        this.auditLogPath,
        JSON.stringify(this.auditLog, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to write audit log', { error });
    }
  }

  /**
   * Get policy statistics
   */
  getStats(): PolicyStats {
    return { ...this.stats };
  }

  /**
   * Get recent audit log entries
   */
  getAuditLog(limit: number = 100): PolicyAuditLog[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Update policy configuration
   */
  updatePolicy(policy: GeminiPolicy): void {
    this.policy = policy;
    logger.info('Policy updated', { enabled: policy.enabled });
  }
}
