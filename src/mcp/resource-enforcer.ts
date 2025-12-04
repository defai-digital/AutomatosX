/**
 * MCP Resource Enforcer
 *
 * Enforces resource limits on MCP servers to prevent runaway processes.
 * Monitors CPU, memory, and enforces configured limits.
 *
 * Phase 4E: Security & Resource Limits
 *
 * @module mcp/resource-enforcer
 */

import { logger } from '../shared/logging/logger.js';
import type { MCPServerProcess, UniversalMCPConfig } from './types-common.js';

/**
 * Resource Limits
 */
export interface ResourceLimits {
  /** Maximum memory in MB */
  maxMemoryMB: number;

  /** Maximum CPU usage percentage */
  maxCpuPercent: number;

  /** Maximum number of file descriptors */
  maxFileDescriptors?: number;

  /** Maximum network connections */
  maxConnections?: number;
}

/**
 * Resource Violation Event
 */
export interface ResourceViolation {
  /** Server name */
  serverName: string;

  /** Violation type */
  type: 'memory' | 'cpu' | 'file_descriptors' | 'connections';

  /** Current value */
  current: number;

  /** Limit value */
  limit: number;

  /** Timestamp */
  timestamp: Date;

  /** Action taken */
  action: 'warn' | 'throttle' | 'kill';
}

/**
 * Resource Usage
 */
export interface ResourceUsage {
  /** Server name */
  serverName: string;

  /** CPU usage percentage */
  cpuPercent: number;

  /** Memory usage in MB */
  memoryMB: number;

  /** File descriptors count */
  fileDescriptors?: number;

  /** Network connections count */
  connections?: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Violation Handler
 */
export type ViolationHandler = (violation: ResourceViolation) => void | Promise<void>;

/**
 * Resource Enforcer Options
 */
export interface ResourceEnforcerOptions {
  /** Default resource limits */
  defaultLimits: ResourceLimits;

  /** Per-server limits override */
  serverLimits?: Map<string, ResourceLimits>;

  /** Enforcement mode: warn, throttle, kill */
  enforcementMode?: 'warn' | 'throttle' | 'kill';

  /** Check interval in milliseconds */
  checkIntervalMs?: number;

  /** Grace period before enforcement (ms) */
  gracePeriodMs?: number;
}

/**
 * MCP Resource Enforcer
 *
 * Monitors and enforces resource limits on MCP servers.
 */
export class ResourceEnforcer {
  private defaultLimits: ResourceLimits;
  private serverLimits: Map<string, ResourceLimits>;
  private enforcementMode: 'warn' | 'throttle' | 'kill';
  private checkIntervalMs: number;
  private gracePeriodMs: number;

  private checkInterval?: NodeJS.Timeout;
  private violationHandlers: ViolationHandler[] = [];
  private violationTimestamps: Map<string, Date> = new Map();
  private monitoredServers: Map<string, MCPServerProcess> = new Map();

  constructor(options: ResourceEnforcerOptions) {
    this.defaultLimits = options.defaultLimits;
    this.serverLimits = options.serverLimits || new Map();
    this.enforcementMode = options.enforcementMode || 'warn';
    this.checkIntervalMs = options.checkIntervalMs || 5000; // 5 seconds
    this.gracePeriodMs = options.gracePeriodMs || 10000; // 10 seconds
  }

  /**
   * Start enforcing resource limits
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('ResourceEnforcer: Already running');
      return;
    }

    logger.info('ResourceEnforcer: Starting enforcement', {
      mode: this.enforcementMode,
      checkIntervalMs: this.checkIntervalMs,
      gracePeriodMs: this.gracePeriodMs,
    });

    this.checkInterval = setInterval(async () => {
      await this.checkAllServers();
    }, this.checkIntervalMs);
  }

  /**
   * Stop enforcing resource limits
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      logger.info('ResourceEnforcer: Stopped enforcement');
    }
  }

  /**
   * Register server for monitoring
   */
  registerServer(serverName: string, serverProcess: MCPServerProcess): void {
    this.monitoredServers.set(serverName, serverProcess);
    logger.debug('ResourceEnforcer: Registered server', { serverName });
  }

  /**
   * Unregister server from monitoring
   */
  unregisterServer(serverName: string): void {
    this.monitoredServers.delete(serverName);
    this.violationTimestamps.delete(serverName);
    logger.debug('ResourceEnforcer: Unregistered server', { serverName });
  }

  /**
   * Register violation handler
   */
  onViolation(handler: ViolationHandler): void {
    this.violationHandlers.push(handler);
  }

  /**
   * Get resource usage for server
   */
  async getResourceUsage(
    serverName: string,
    pid: number
  ): Promise<ResourceUsage | null> {
    try {
      // Try to use pidusage for accurate metrics (optional dependency)
      const pidusage = await import('pidusage' as any);
      const stats = await pidusage.default(pid);

      return {
        serverName,
        cpuPercent: stats.cpu,
        memoryMB: stats.memory / (1024 * 1024),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.debug('ResourceEnforcer: Failed to get resource usage', {
        serverName,
        pid,
        error,
      });
      return null;
    }
  }

  /**
   * Get limits for server
   */
  getLimits(serverName: string): ResourceLimits {
    return this.serverLimits.get(serverName) || this.defaultLimits;
  }

  /**
   * Set limits for server
   */
  setLimits(serverName: string, limits: ResourceLimits): void {
    this.serverLimits.set(serverName, limits);
    logger.info('ResourceEnforcer: Updated limits for server', {
      serverName,
      limits,
    });
  }

  // ========== Private Methods ==========

  /**
   * Check all monitored servers
   */
  private async checkAllServers(): Promise<void> {
    for (const [serverName, serverProcess] of this.monitoredServers) {
      if (!serverProcess.running || !serverProcess.process.pid) {
        continue;
      }

      try {
        await this.checkServer(serverName, serverProcess);
      } catch (error) {
        logger.error('ResourceEnforcer: Failed to check server', {
          serverName,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Check single server
   */
  private async checkServer(
    serverName: string,
    serverProcess: MCPServerProcess
  ): Promise<void> {
    const pid = serverProcess.process.pid;
    if (!pid) return;

    // Get current resource usage
    const usage = await this.getResourceUsage(serverName, pid);
    if (!usage) return;

    // Get limits for this server
    const limits = this.getLimits(serverName);

    // Check memory limit
    if (usage.memoryMB > limits.maxMemoryMB) {
      await this.handleViolation({
        serverName,
        type: 'memory',
        current: usage.memoryMB,
        limit: limits.maxMemoryMB,
        timestamp: new Date(),
        action: this.enforcementMode,
      }, serverProcess);
    }

    // Check CPU limit
    if (usage.cpuPercent > limits.maxCpuPercent) {
      await this.handleViolation({
        serverName,
        type: 'cpu',
        current: usage.cpuPercent,
        limit: limits.maxCpuPercent,
        timestamp: new Date(),
        action: this.enforcementMode,
      }, serverProcess);
    }
  }

  /**
   * Handle resource violation
   */
  private async handleViolation(
    violation: ResourceViolation,
    serverProcess: MCPServerProcess
  ): Promise<void> {
    // Check grace period
    const lastViolation = this.violationTimestamps.get(violation.serverName);
    const now = new Date();

    if (lastViolation) {
      const timeSinceLastViolation = now.getTime() - lastViolation.getTime();
      if (timeSinceLastViolation < this.gracePeriodMs) {
        logger.debug('ResourceEnforcer: Within grace period', {
          serverName: violation.serverName,
          type: violation.type,
        });
        return;
      }
    }

    // Record violation timestamp
    this.violationTimestamps.set(violation.serverName, now);

    // Log violation
    logger.warn('ResourceEnforcer: Resource limit violation', {
      serverName: violation.serverName,
      type: violation.type,
      current: violation.current,
      limit: violation.limit,
      action: violation.action,
    });

    // Notify handlers
    await Promise.allSettled(
      this.violationHandlers.map(handler => handler(violation))
    );

    // Take enforcement action
    switch (violation.action) {
      case 'warn':
        // Just log and notify - no action
        break;

      case 'throttle':
        // Attempt to throttle process (send SIGSTOP/SIGCONT)
        await this.throttleProcess(serverProcess);
        break;

      case 'kill':
        // Kill the process
        await this.killProcess(serverProcess);
        break;
    }
  }

  /**
   * Throttle process temporarily
   */
  private async throttleProcess(serverProcess: MCPServerProcess): Promise<void> {
    try {
      logger.info('ResourceEnforcer: Throttling process', {
        serverName: serverProcess.config.name,
        pid: serverProcess.process.pid,
      });

      // Send SIGSTOP to pause the process
      serverProcess.process.kill('SIGSTOP');

      // Resume after 1 second
      setTimeout(() => {
        try {
          serverProcess.process.kill('SIGCONT');
          logger.info('ResourceEnforcer: Resumed process', {
            serverName: serverProcess.config.name,
          });
        } catch (error) {
          logger.error('ResourceEnforcer: Failed to resume process', {
            error: (error as Error).message,
          });
        }
      }, 1000);
    } catch (error) {
      logger.error('ResourceEnforcer: Failed to throttle process', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Kill process
   */
  private async killProcess(serverProcess: MCPServerProcess): Promise<void> {
    try {
      logger.warn('ResourceEnforcer: Killing process due to resource violation', {
        serverName: serverProcess.config.name,
        pid: serverProcess.process.pid,
      });

      serverProcess.process.kill('SIGKILL');
      serverProcess.running = false;
    } catch (error) {
      logger.error('ResourceEnforcer: Failed to kill process', {
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Create resource enforcer from config
 */
export function createResourceEnforcer(
  config: UniversalMCPConfig
): ResourceEnforcer | null {
  if (!config.security?.limits) {
    logger.debug('ResourceEnforcer: No limits configured, skipping');
    return null;
  }

  const limits = config.security.limits;

  const enforcer = new ResourceEnforcer({
    defaultLimits: {
      maxMemoryMB: limits.maxMemoryPerServer || 512,
      maxCpuPercent: limits.maxCpuPerServer || 50,
    },
    enforcementMode: 'warn', // Default to warn mode
    checkIntervalMs: 5000,
    gracePeriodMs: 10000,
  });

  return enforcer;
}

/**
 * Default resource enforcer instance
 */
let defaultEnforcer: ResourceEnforcer | undefined;

/**
 * Get default resource enforcer
 */
export function getResourceEnforcer(): ResourceEnforcer | undefined {
  return defaultEnforcer;
}

/**
 * Initialize default resource enforcer
 */
export function initializeResourceEnforcer(
  config: UniversalMCPConfig
): ResourceEnforcer | null {
  if (!defaultEnforcer) {
    defaultEnforcer = createResourceEnforcer(config) || undefined;
  }
  return defaultEnforcer || null;
}
