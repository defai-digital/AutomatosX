import type {
  MCPCacheStats,
  MCPRequestLimits,
  ValidationError,
} from '@defai.digital/contracts';
import { validateRequest } from '../validation/request-validator.js';

// ============================================================================
// Guard Check Result Types
// ============================================================================

export type GuardStatus = 'PASS' | 'WARN' | 'FAIL';

export interface GuardCheckResult {
  status: GuardStatus;
  gate: string;
  message: string;
  details?: Record<string, unknown>;
  /** Suggested action when check fails */
  suggestion?: string;
  /** Audit data for logging */
  audit?: Record<string, unknown>;
}

export interface RuntimeGuardResult {
  /** Overall status (FAIL if any gate fails) */
  status: GuardStatus;
  /** Individual gate results */
  gates: GuardCheckResult[];
  /** Human-readable summary */
  summary: string;
  /** Whether the request should proceed */
  allowed: boolean;
  /** Timestamp of check */
  timestamp: string;
}

// ============================================================================
// Guard Configuration
// ============================================================================

export interface RuntimeGuardConfig {
  /** Enable memory pressure checks */
  checkMemoryPressure: boolean;
  /** Enable request validation */
  checkRequestLimits: boolean;
  /** Block on critical memory pressure */
  blockOnCriticalPressure: boolean;
  /** Block on validation failures */
  blockOnValidationFailure: boolean;
  /** Custom request limits */
  requestLimits?: MCPRequestLimits;
}

export const DEFAULT_GUARD_CONFIG: RuntimeGuardConfig = {
  checkMemoryPressure: true,
  checkRequestLimits: true,
  blockOnCriticalPressure: true,
  blockOnValidationFailure: true,
};

// ============================================================================
// Guard Context
// ============================================================================

export interface RuntimeGuardContext {
  /** Tool being called */
  toolName: string;
  /** Tool arguments */
  args: unknown;
  /** Current cache stats (optional) */
  cacheStats?: MCPCacheStats | undefined;
  /** Request size in bytes (optional) */
  requestSizeBytes?: number | undefined;
  /** Request ID for tracing */
  requestId?: string | undefined;
}

// ============================================================================
// Guard Implementation
// ============================================================================

/**
 * Runtime guard for MCP operations.
 *
 * Enforces runtime governance policies:
 * - Memory pressure checks
 * - Request size and array limits
 * - Timeout tracking (via audit)
 *
 * Invariants:
 * - INV-MCP-GUARD-001: Critical pressure blocks operations
 * - INV-MCP-GUARD-002: Invalid requests rejected before processing
 * - INV-MCP-GUARD-003: All checks logged for audit
 */
export class RuntimeGuard {
  private readonly config: RuntimeGuardConfig;
  private readonly limits: MCPRequestLimits | undefined;

  constructor(config: Partial<RuntimeGuardConfig> = {}) {
    this.config = { ...DEFAULT_GUARD_CONFIG, ...config };
    this.limits = config.requestLimits;
  }

  /**
   * Run all guard checks for a request.
   */
  async check(context: RuntimeGuardContext): Promise<RuntimeGuardResult> {
    const gates: GuardCheckResult[] = [];
    let hasFailure = false;
    let hasWarning = false;

    // Memory pressure check
    if (this.config.checkMemoryPressure && context.cacheStats) {
      const pressureResult = this.checkMemoryPressure(context.cacheStats);
      gates.push(pressureResult);

      if (pressureResult.status === 'FAIL') {
        hasFailure = true;
      } else if (pressureResult.status === 'WARN') {
        hasWarning = true;
      }
    }

    // Request validation check
    if (this.config.checkRequestLimits) {
      const validationResult = this.checkRequestLimits(
        context.toolName,
        context.args
      );
      gates.push(validationResult);

      if (validationResult.status === 'FAIL') {
        hasFailure = true;
      } else if (validationResult.status === 'WARN') {
        hasWarning = true;
      }
    }

    // Determine overall status
    let status: GuardStatus = 'PASS';
    if (hasFailure) {
      status = 'FAIL';
    } else if (hasWarning) {
      status = 'WARN';
    }

    // Determine if request should proceed
    const allowed = this.shouldAllow(status, gates);

    // Generate summary
    const summary = this.generateSummary(status, gates);

    return {
      status,
      gates,
      summary,
      allowed,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check memory pressure.
   * INV-MCP-GUARD-001: Critical pressure blocks operations.
   */
  private checkMemoryPressure(stats: MCPCacheStats): GuardCheckResult {
    const { pressureLevel, currentSizeBytes, maxSizeBytes, hitRate } = stats;

    if (pressureLevel === 'critical') {
      return {
        status: this.config.blockOnCriticalPressure ? 'FAIL' : 'WARN',
        gate: 'memory_pressure',
        message: `Memory pressure is critical (${Math.round((currentSizeBytes / maxSizeBytes) * 100)}% used)`,
        details: {
          pressureLevel,
          usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
          currentSizeBytes,
          maxSizeBytes,
          hitRate,
        },
        suggestion: 'Wait for cache eviction or increase maxSizeBytes',
      };
    }

    if (pressureLevel === 'high') {
      return {
        status: 'WARN',
        gate: 'memory_pressure',
        message: `Memory pressure is high (${Math.round((currentSizeBytes / maxSizeBytes) * 100)}% used)`,
        details: {
          pressureLevel,
          usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
          currentSizeBytes,
          maxSizeBytes,
          hitRate,
        },
        suggestion: 'Consider reducing cache usage or increasing limits',
      };
    }

    return {
      status: 'PASS',
      gate: 'memory_pressure',
      message: `Memory pressure is ${pressureLevel}`,
      details: {
        pressureLevel,
        usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
      },
    };
  }

  /**
   * Check request limits.
   * INV-MCP-GUARD-002: Invalid requests rejected before processing.
   */
  private checkRequestLimits(
    toolName: string,
    args: unknown
  ): GuardCheckResult {
    const result = validateRequest(toolName, args, this.limits);

    if (!result.valid) {
      const errors: ValidationError[] = result.errors;
      const errorMessages = errors.map((e: ValidationError) => e.message).join('; ');

      return {
        status: this.config.blockOnValidationFailure ? 'FAIL' : 'WARN',
        gate: 'request_limits',
        message: `Request validation failed: ${errorMessages}`,
        details: {
          errors,
          toolName,
        },
        suggestion: 'Reduce array sizes or split into multiple requests',
      };
    }

    return {
      status: 'PASS',
      gate: 'request_limits',
      message: 'Request validation passed',
      details: { toolName },
    };
  }

  /**
   * Determine if request should be allowed based on results.
   */
  private shouldAllow(status: GuardStatus, gates: GuardCheckResult[]): boolean {
    if (status === 'PASS' || status === 'WARN') {
      return true;
    }

    // Check if any blocking failures exist
    for (const gate of gates) {
      if (gate.status === 'FAIL') {
        // Memory pressure failure
        if (gate.gate === 'memory_pressure' && this.config.blockOnCriticalPressure) {
          return false;
        }
        // Validation failure
        if (gate.gate === 'request_limits' && this.config.blockOnValidationFailure) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Generate human-readable summary.
   */
  private generateSummary(status: GuardStatus, gates: GuardCheckResult[]): string {
    const passCount = gates.filter((g) => g.status === 'PASS').length;
    const warnCount = gates.filter((g) => g.status === 'WARN').length;
    const failCount = gates.filter((g) => g.status === 'FAIL').length;

    if (status === 'PASS') {
      return `All ${gates.length} checks passed`;
    }

    if (status === 'WARN') {
      return `${passCount} passed, ${warnCount} warnings`;
    }

    return `${failCount} failed, ${warnCount} warnings, ${passCount} passed`;
  }
}

/**
 * Create a runtime guard instance.
 */
export function createRuntimeGuard(
  config?: Partial<RuntimeGuardConfig>
): RuntimeGuard {
  return new RuntimeGuard(config);
}

/**
 * Quick check helper for common use case.
 */
export async function quickGuardCheck(
  toolName: string,
  args: unknown,
  cacheStats?: MCPCacheStats
): Promise<RuntimeGuardResult> {
  const guard = createRuntimeGuard();
  return guard.check({ toolName, args, cacheStats });
}
