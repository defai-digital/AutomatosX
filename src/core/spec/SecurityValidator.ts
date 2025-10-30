/**
 * Security Validator
 *
 * Extends SpecValidator with security-focused validation rules.
 * Implements 11 security rules (SEC001-SEC011) covering:
 * - Network access control
 * - Filesystem permissions
 * - Environment variable access
 * - Resource limits
 *
 * @module core/spec/SecurityValidator
 */

import type { SpecYAML, ValidationIssue } from '@/types/spec-yaml.js';
import { logger } from '@/utils/logger.js';

/**
 * Security validator for YAML specs
 */
export class SecurityValidator {
  /**
   * Validate spec security
   */
  validate(spec: SpecYAML): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate each actor
    for (let i = 0; i < spec.actors.length; i++) {
      const actor = spec.actors[i];
      const actorPath = `actors[${i}]`;

      // Network validation
      issues.push(...this.validateNetworkAccess(actor, actorPath));

      // Filesystem validation
      issues.push(...this.validateFilesystemAccess(actor, actorPath));

      // Environment variable validation
      issues.push(...this.validateEnvironmentAccess(actor, actorPath));

      // Resource limits validation
      issues.push(...this.validateResourceLimits(actor, actorPath));

      // Permission specification validation
      issues.push(...this.validatePermissionSpec(actor, actorPath));
    }

    // Provider security validation
    if (spec.providers) {
      issues.push(...this.validateProviderSecurity(spec));
    }

    // Observability requirements
    issues.push(...this.validateObservabilityRequirements(spec));

    logger.debug('Security validation complete', {
      issueCount: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length
    });

    return issues;
  }

  /**
   * SEC001: Network access without whitelist
   * SEC002: Non-TLS network connections
   * SEC003: Wildcard domains in whitelist
   */
  private validateNetworkAccess(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.permissions?.network) {
      return issues;
    }

    const network = actor.permissions.network;

    // SEC001: Network enabled without whitelist
    if (network.enabled && (!network.whitelist || network.whitelist.length === 0)) {
      issues.push({
        ruleId: 'SEC001',
        severity: 'error',
        message: `Actor "${actor.id}" has network access enabled without whitelist`,
        path: `${actorPath}.permissions.network.whitelist`,
        suggestion: 'Add whitelist array with allowed domains/IPs, or disable network access'
      });
    }

    // SEC002: TLS not required
    if (network.enabled && !network.requireTls) {
      issues.push({
        ruleId: 'SEC002',
        severity: 'warning',
        message: `Actor "${actor.id}" allows non-TLS connections`,
        path: `${actorPath}.permissions.network.requireTls`,
        suggestion: 'Set requireTls: true to enforce encrypted connections'
      });
    }

    // SEC003: Wildcard domains
    if (network.whitelist) {
      const wildcards = network.whitelist.filter((domain: string) =>
        domain === '*' || domain.startsWith('*.')
      );

      if (wildcards.length > 0) {
        issues.push({
          ruleId: 'SEC003',
          severity: 'warning',
          message: `Actor "${actor.id}" has wildcard domains in whitelist: ${wildcards.join(', ')}`,
          path: `${actorPath}.permissions.network.whitelist`,
          suggestion: 'Replace wildcards with specific domain names'
        });
      }
    }

    return issues;
  }

  /**
   * SEC004: Dangerous filesystem write paths
   * SEC005: Sensitive file read access
   * SEC006: Overly broad path wildcards
   */
  private validateFilesystemAccess(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.permissions?.filesystem) {
      return issues;
    }

    const fs = actor.permissions.filesystem;

    // SEC004: Dangerous write paths
    const dangerousWritePaths = [
      '/',
      '/*',
      '/**',
      '**/*',
      '/etc/**',
      '/usr/**',
      '/bin/**',
      '/sbin/**',
      '/var/**',
      '/sys/**',
      '/proc/**',
      'C:\\Windows\\**',
      'C:\\Program Files\\**'
    ];

    if (fs.write) {
      const dangerous = fs.write.filter((path: string) =>
        dangerousWritePaths.some(d => path === d || path.startsWith(d))
      );

      if (dangerous.length > 0) {
        issues.push({
          ruleId: 'SEC004',
          severity: 'error',
          message: `Actor "${actor.id}" has dangerous filesystem write access: ${dangerous.join(', ')}`,
          path: `${actorPath}.permissions.filesystem.write`,
          suggestion: 'Restrict write paths to specific project directories'
        });
      }
    }

    // SEC005: Sensitive file reads
    const sensitiveFiles = [
      '/etc/passwd',
      '/etc/shadow',
      '/etc/ssh/**',
      '~/.ssh/**',
      '**/.env',
      '**/credentials.json',
      '**/secrets.yaml',
      '**/*.key',
      '**/*.pem',
      'C:\\Windows\\System32\\config\\**'
    ];

    if (fs.read) {
      const sensitive = fs.read.filter((path: string) =>
        sensitiveFiles.some(s => path === s || this.matchesPattern(path, s))
      );

      if (sensitive.length > 0) {
        issues.push({
          ruleId: 'SEC005',
          severity: 'error',
          message: `Actor "${actor.id}" has access to sensitive files: ${sensitive.join(', ')}`,
          path: `${actorPath}.permissions.filesystem.read`,
          suggestion: 'Remove access to sensitive system files and credentials'
        });
      }
    }

    // SEC006: Overly broad wildcards
    const broadPatterns = ['/**', '**/*', '**/'];

    const checkBroadPatterns = (paths: string[], type: 'read' | 'write') => {
      const broad = paths.filter((path: string) =>
        broadPatterns.some(p => path === p || path.endsWith(p))
      );

      if (broad.length > 0) {
        issues.push({
          ruleId: 'SEC006',
          severity: 'warning',
          message: `Actor "${actor.id}" has overly broad ${type} wildcards: ${broad.join(', ')}`,
          path: `${actorPath}.permissions.filesystem.${type}`,
          suggestion: `Use specific directory paths instead of broad wildcards`
        });
      }
    };

    if (fs.read) checkBroadPatterns(fs.read, 'read');
    if (fs.write) checkBroadPatterns(fs.write, 'write');

    return issues;
  }

  /**
   * SEC007: Sensitive environment variables
   */
  private validateEnvironmentAccess(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.permissions?.environment) {
      return issues;
    }

    const env = actor.permissions.environment;

    // SEC007: Sensitive environment variables
    const sensitivePatterns = [
      'API_KEY',
      'SECRET',
      'PASSWORD',
      'TOKEN',
      'PRIVATE',
      'AUTH',
      'CREDENTIAL'
    ];

    const checkSensitive = (vars: string[], access: 'read' | 'write') => {
      const sensitive = vars.filter((varName: string) =>
        sensitivePatterns.some(p => varName.toUpperCase().includes(p))
      );

      if (sensitive.length > 0) {
        issues.push({
          ruleId: 'SEC007',
          severity: 'warning',
          message: `Actor "${actor.id}" has ${access} access to sensitive environment variables: ${sensitive.join(', ')}`,
          path: `${actorPath}.permissions.environment.${access}`,
          suggestion: 'Review environment variable access and use secret management instead'
        });
      }
    };

    if (env.read) checkSensitive(env.read, 'read');
    if (env.write) checkSensitive(env.write, 'write');

    return issues;
  }

  /**
   * SEC008: Missing memory limits
   * SEC009: Missing CPU limits
   * SEC010: Excessive resource limits
   */
  private validateResourceLimits(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.resources) {
      issues.push({
        ruleId: 'SEC008',
        severity: 'warning',
        message: `Actor "${actor.id}" has no resource limits defined`,
        path: `${actorPath}.resources`,
        suggestion: 'Add resource limits (memory, CPU) to prevent resource exhaustion'
      });
      return issues;
    }

    const resources = actor.resources;

    // SEC008: Missing memory limit
    if (!resources.memory?.limit) {
      issues.push({
        ruleId: 'SEC008',
        severity: 'warning',
        message: `Actor "${actor.id}" has no memory limit`,
        path: `${actorPath}.resources.memory.limit`,
        suggestion: 'Set memory limit (e.g., "512MB", "1GB")'
      });
    }

    // SEC009: Missing CPU limit
    if (!resources.cpu?.limit) {
      issues.push({
        ruleId: 'SEC009',
        severity: 'info',
        message: `Actor "${actor.id}" has no CPU limit`,
        path: `${actorPath}.resources.cpu.limit`,
        suggestion: 'Consider setting CPU limit (e.g., 1.0, 2.0 cores)'
      });
    }

    // SEC010: Excessive resource limits
    if (resources.memory?.limit) {
      const memLimit = this.parseMemoryLimit(resources.memory.limit);
      if (memLimit && memLimit > 8192) { // > 8GB
        issues.push({
          ruleId: 'SEC010',
          severity: 'warning',
          message: `Actor "${actor.id}" has excessive memory limit: ${resources.memory.limit}`,
          path: `${actorPath}.resources.memory.limit`,
          suggestion: 'Review if such high memory allocation is necessary'
        });
      }
    }

    if (resources.cpu?.limit && resources.cpu.limit > 8.0) {
      issues.push({
        ruleId: 'SEC010',
        severity: 'warning',
        message: `Actor "${actor.id}" has excessive CPU limit: ${resources.cpu.limit} cores`,
        path: `${actorPath}.resources.cpu.limit`,
        suggestion: 'Review if such high CPU allocation is necessary'
      });
    }

    return issues;
  }

  /**
   * SEC011: Missing permission specification
   */
  private validatePermissionSpec(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.permissions) {
      issues.push({
        ruleId: 'SEC011',
        severity: 'error',
        message: `Actor "${actor.id}" has no permissions specified`,
        path: `${actorPath}.permissions`,
        suggestion: 'Define explicit permissions (filesystem, network, environment) following principle of least privilege'
      });
    }

    return issues;
  }

  /**
   * Validate provider security
   */
  private validateProviderSecurity(spec: SpecYAML): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if provider has budget limits (important for cost control)
    if (spec.providers?.primary && !spec.providers.primary.budget) {
      issues.push({
        ruleId: 'SEC-PROVIDER-001',
        severity: 'warning',
        message: 'Primary provider has no budget limits',
        path: 'providers.primary.budget',
        suggestion: 'Set budget limits to prevent unexpected costs'
      });
    }

    return issues;
  }

  /**
   * Validate observability requirements
   */
  private validateObservabilityRequirements(spec: SpecYAML): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Audit logging should be enabled for security-sensitive specs
    if (!spec.observability?.audit?.enabled) {
      issues.push({
        ruleId: 'SEC-OBS-001',
        severity: 'warning',
        message: 'Audit logging is not enabled',
        path: 'observability.audit.enabled',
        suggestion: 'Enable audit logging for security compliance and incident response'
      });
    }

    return issues;
  }

  /**
   * Helper: Check if path matches pattern (simple glob matching)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Helper: Parse memory limit string to MB
   */
  private parseMemoryLimit(limit: string): number | null {
    const match = limit.match(/^(\d+)(KB|MB|GB)$/i);
    if (!match || !match[1] || !match[2]) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'KB':
        return value / 1024;
      case 'MB':
        return value;
      case 'GB':
        return value * 1024;
      default:
        return null;
    }
  }
}

/**
 * Default singleton instance
 */
let defaultSecurityValidator: SecurityValidator | null = null;

/**
 * Get default security validator instance (singleton)
 */
export function getDefaultSecurityValidator(): SecurityValidator {
  if (!defaultSecurityValidator) {
    defaultSecurityValidator = new SecurityValidator();
  }
  return defaultSecurityValidator;
}

/**
 * Convenience function: validate spec security
 */
export function validateSecurityIssues(spec: SpecYAML): ValidationIssue[] {
  return getDefaultSecurityValidator().validate(spec);
}
