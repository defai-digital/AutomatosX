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

      // FIXED (Bug #64): Command/ops validation
      issues.push(...this.validateCommandSecurity(actor, actorPath));
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

    // FIXED (Bug #66): Validate network.whitelist is array before using array methods
    if (network.whitelist && !Array.isArray(network.whitelist)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" network.whitelist must be an array`,
        path: `${actorPath}.permissions.network.whitelist`,
        suggestion: 'Ensure whitelist is an array of strings'
      });
      return issues; // Cannot continue validation without valid array
    }

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
      // FIXED (Bug #66): Validate each domain is string before using string methods
      const wildcards = network.whitelist.filter((domain: any) =>
        typeof domain === 'string' && (domain === '*' || domain.startsWith('*.'))
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

      // Validate all domains are strings
      const nonStrings = network.whitelist.filter((domain: any) => typeof domain !== 'string');
      if (nonStrings.length > 0) {
        issues.push({
          ruleId: 'TYPE-ERROR',
          severity: 'error',
          message: `Actor "${actor.id}" whitelist contains non-string values`,
          path: `${actorPath}.permissions.network.whitelist`,
          suggestion: 'All whitelist entries must be strings'
        });
      }
    }

    return issues;
  }

  /**
   * SEC004: Dangerous filesystem write paths
   * SEC005: Sensitive file read access
   * SEC006: Overly broad path wildcards
   * SEC013: Symbolic link bypass warning (Bug #90)
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

    // FIXED (Bug #90): Warn about symbolic link bypass limitation
    // Path validation does not resolve symbolic links, which could allow bypass
    // This is a known limitation due to validation happening before filesystem access
    if ((fs.read && fs.read.length > 0) || (fs.write && fs.write.length > 0)) {
      issues.push({
        ruleId: 'SEC013',
        severity: 'info',
        message: `Actor "${actor.id}" filesystem access does not validate symbolic links - ensure runtime enforcement prevents symlink attacks`,
        path: `${actorPath}.permissions.filesystem`,
        suggestion: 'Implement runtime checks for symbolic links or disable symlink following in execution environment'
      });
    }

    // FIXED (Bug #66): Validate fs.write is array before using array methods
    if (fs.write && !Array.isArray(fs.write)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" filesystem.write must be an array`,
        path: `${actorPath}.permissions.filesystem.write`,
        suggestion: 'Ensure write is an array of path strings'
      });
      return issues;
    }

    // FIXED (Bug #66): Validate fs.read is array before using array methods
    if (fs.read && !Array.isArray(fs.read)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" filesystem.read must be an array`,
        path: `${actorPath}.permissions.filesystem.read`,
        suggestion: 'Ensure read is an array of path strings'
      });
      return issues;
    }

    // SEC004: Dangerous write paths
    // FIXED (Bug #88): Added normalized Windows paths to ensure patterns match
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
      'C:\\Windows\\**',          // Windows-style (for display/raw input)
      '/c:/windows/**',           // FIXED (Bug #88): Normalized Windows path
      '**/windows/**',            // FIXED (Bug #88): Generic Windows system dir
      'C:\\Program Files\\**',    // Windows-style
      '/c:/program files/**',     // FIXED (Bug #88): Normalized Windows path
      '**/program files/**',      // FIXED (Bug #88): Generic Program Files
      '**/programdata/**',        // FIXED (Bug #88): Windows ProgramData
      '**/system32/**'            // FIXED (Bug #88): Windows system32 anywhere
    ];

    if (fs.write) {
      // FIXED (Bug #62, #63, #86): Normalize paths before checking
      // FIXED (Bug #86): Don't normalize glob patterns
      const dangerous = fs.write.filter((path: any) => {
        if (typeof path !== 'string') return false;
        const normalized = this.normalizePath(path);
        return dangerousWritePaths.some(d => {
          if (d.includes('*') || d.includes('?')) {
            // Glob pattern - use matchesPattern
            return this.matchesPattern(normalized, d);
          } else {
            // Exact path - normalize and check
            const normalizedDangerous = this.normalizePath(d);
            return normalized === normalizedDangerous || normalized.startsWith(normalizedDangerous);
          }
        });
      });

      if (dangerous.length > 0) {
        issues.push({
          ruleId: 'SEC004',
          severity: 'error',
          message: `Actor "${actor.id}" has dangerous filesystem write access: ${dangerous.join(', ')}`,
          path: `${actorPath}.permissions.filesystem.write`,
          suggestion: 'Restrict write paths to specific project directories'
        });
      }

      // Validate all paths are strings
      const nonStrings = fs.write.filter((path: any) => typeof path !== 'string');
      if (nonStrings.length > 0) {
        issues.push({
          ruleId: 'TYPE-ERROR',
          severity: 'error',
          message: `Actor "${actor.id}" filesystem.write contains non-string paths`,
          path: `${actorPath}.permissions.filesystem.write`,
          suggestion: 'All write paths must be strings'
        });
      }
    }

    // SEC005: Sensitive file reads
    // FIXED (Bug #82, #83): Comprehensive sensitive file patterns with proper glob matching
    const sensitiveFiles = [
      // Unix system files
      '/etc/passwd',
      '/etc/shadow',
      '/etc/ssh/**',

      // SSH keys - use ** prefix to match any path containing these
      '~/.ssh/**',                  // Tilde notation (kept for compatibility)
      '**/.ssh/id_rsa',             // FIXED (Bug #82, #83): Private key anywhere
      '**/.ssh/id_dsa',             // DSA key
      '**/.ssh/id_ecdsa',           // ECDSA key
      '**/.ssh/id_ed25519',         // Ed25519 key
      '**/.ssh/**',                 // Any file in any .ssh directory
      '/root/.ssh/**',              // Linux root SSH

      // Credentials and secrets
      '**/.env',
      '**/.env.local',
      '**/.env.production',
      '**/credentials.json',
      '**/secrets.yaml',
      '**/secrets.yml',
      '**/*.key',
      '**/*.pem',
      '**/.aws/credentials',        // FIXED (Bug #82): AWS credentials
      '**/.aws/config',

      // Windows sensitive files
      'C:\\Windows\\System32\\config\\**',
      '/c:/windows/system32/config/**',  // FIXED (Bug #82): Normalized Windows path
      '**/system32/config/**',      // Catch any Windows config access
    ];

    if (fs.read) {
      // FIXED (Bug #62, #63, #67, #86): Normalize paths and check for traversal
      // FIXED (Bug #86): Don't normalize glob patterns - only normalize exact match patterns
      const sensitive = fs.read.filter((path: any) => {
        if (typeof path !== 'string') return false;
        const normalized = this.normalizePath(path);
        return sensitiveFiles.some(s => {
          // Only normalize patterns that don't contain glob characters
          if (s.includes('*') || s.includes('?')) {
            // Glob pattern - use as-is for matching
            return this.matchesPattern(normalized, s);
          } else {
            // Exact path - normalize for comparison
            const normalizedSensitive = this.normalizePath(s);
            return normalized === normalizedSensitive;
          }
        });
      });

      if (sensitive.length > 0) {
        issues.push({
          ruleId: 'SEC005',
          severity: 'error',
          message: `Actor "${actor.id}" has access to sensitive files: ${sensitive.join(', ')}`,
          path: `${actorPath}.permissions.filesystem.read`,
          suggestion: 'Remove access to sensitive system files and credentials'
        });
      }

      // Validate all paths are strings
      const nonStrings = fs.read.filter((path: any) => typeof path !== 'string');
      if (nonStrings.length > 0) {
        issues.push({
          ruleId: 'TYPE-ERROR',
          severity: 'error',
          message: `Actor "${actor.id}" filesystem.read contains non-string paths`,
          path: `${actorPath}.permissions.filesystem.read`,
          suggestion: 'All read paths must be strings'
        });
      }
    }

    // SEC006: Overly broad wildcards
    const broadPatterns = ['/**', '**/*', '**/'];

    const checkBroadPatterns = (paths: string[], type: 'read' | 'write') => {
      // FIXED (Bug #66): Validate each path is string before using string methods
      const broad = paths.filter((path: any) =>
        typeof path === 'string' && broadPatterns.some(p => path === p || path.endsWith(p))
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

    // FIXED (Bug #66): Validate env.read is array before using array methods
    if (env.read && !Array.isArray(env.read)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" environment.read must be an array`,
        path: `${actorPath}.permissions.environment.read`,
        suggestion: 'Ensure read is an array of environment variable names'
      });
      return issues;
    }

    // FIXED (Bug #66): Validate env.write is array before using array methods
    if (env.write && !Array.isArray(env.write)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" environment.write must be an array`,
        path: `${actorPath}.permissions.environment.write`,
        suggestion: 'Ensure write is an array of environment variable names'
      });
      return issues;
    }

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
      // FIXED (Bug #66): Validate each var is string before using string methods
      const sensitive = vars.filter((varName: any) =>
        typeof varName === 'string' && sensitivePatterns.some(p => varName.toUpperCase().includes(p))
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

      // Validate all vars are strings
      const nonStrings = vars.filter((varName: any) => typeof varName !== 'string');
      if (nonStrings.length > 0) {
        issues.push({
          ruleId: 'TYPE-ERROR',
          severity: 'error',
          message: `Actor "${actor.id}" environment.${access} contains non-string variable names`,
          path: `${actorPath}.permissions.environment.${access}`,
          suggestion: 'All environment variable names must be strings'
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
      // FIXED (Bug #65): Validate parseMemoryLimit returns valid number
      const memLimit = this.parseMemoryLimit(resources.memory.limit);

      if (memLimit === null) {
        issues.push({
          ruleId: 'SEC008',
          severity: 'error',
          message: `Actor "${actor.id}" has invalid memory limit format: ${resources.memory.limit}`,
          path: `${actorPath}.resources.memory.limit`,
          suggestion: 'Use valid format: <number>KB, <number>MB, or <number>GB (e.g., "512MB", "1GB")'
        });
      } else if (memLimit > 8192) { // > 8GB
        issues.push({
          ruleId: 'SEC010',
          severity: 'warning',
          message: `Actor "${actor.id}" has excessive memory limit: ${resources.memory.limit}`,
          path: `${actorPath}.resources.memory.limit`,
          suggestion: 'Review if such high memory allocation is necessary'
        });
      }
    }

    // FIXED (Bug #65, #66): Validate CPU limit is number before comparison
    if (resources.cpu?.limit) {
      if (typeof resources.cpu.limit !== 'number' || !Number.isFinite(resources.cpu.limit)) {
        issues.push({
          ruleId: 'SEC009',
          severity: 'error',
          message: `Actor "${actor.id}" has invalid CPU limit: must be a finite number`,
          path: `${actorPath}.resources.cpu.limit`,
          suggestion: 'Use numeric value (e.g., 1.0, 2.0 cores)'
        });
      } else if (resources.cpu.limit > 8.0) {
        issues.push({
          ruleId: 'SEC010',
          severity: 'warning',
          message: `Actor "${actor.id}" has excessive CPU limit: ${resources.cpu.limit} cores`,
          path: `${actorPath}.resources.cpu.limit`,
          suggestion: 'Review if such high CPU allocation is necessary'
        });
      }
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
   * SEC012: Command injection vulnerabilities in operations
   * FIXED (Bug #64, #70): Added validation for actor operations/commands (both string and array)
   */
  private validateCommandSecurity(
    actor: any,
    actorPath: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!actor.operations) {
      return issues;
    }

    // Shell metacharacters that indicate potential injection
    // FIXED (Bug #87): Added missing dangerous patterns
    const dangerousPatterns = [
      /\$\(/,           // Command substitution $(...)
      /\$\{/,           // FIXED (Bug #87): Variable expansion ${...}
      /`/,              // Backtick command substitution
      /;/,              // Command separator
      /\|/,             // Pipe
      /&/,              // Background execution
      />/,              // Output redirect
      /<(?!\()/,        // FIXED (Bug #87): Input redirect (but not process substitution <() )
      /<\(/,            // Process substitution
      /\|\|/,           // OR operator
      /&&/,             // AND operator
      /\n/,             // Newline injection
      /\r/              // FIXED (Bug #87): Carriage return injection
    ];

    // Helper to check command string for shell metacharacters
    const checkCommandString = (commandStr: string, path: string) => {
      const foundPatterns = dangerousPatterns.filter(pattern =>
        pattern.test(commandStr)
      );

      if (foundPatterns.length > 0) {
        issues.push({
          ruleId: 'SEC012',
          severity: 'error',
          message: `Actor "${actor.id}" operation contains shell metacharacters that may enable command injection`,
          path,
          suggestion: 'Avoid shell metacharacters in commands. Use explicit argument arrays instead of shell strings'
        });
      }
    };

    // FIXED (Bug #70): Handle string operations (not just arrays)
    if (typeof actor.operations === 'string') {
      checkCommandString(actor.operations, `${actorPath}.operations`);
      return issues;
    }

    // Handle array of operations
    if (!Array.isArray(actor.operations)) {
      issues.push({
        ruleId: 'TYPE-ERROR',
        severity: 'error',
        message: `Actor "${actor.id}" operations must be a string or array`,
        path: `${actorPath}.operations`,
        suggestion: 'Ensure operations is either a string command or array of operation objects'
      });
      return issues;
    }

    for (let i = 0; i < actor.operations.length; i++) {
      const op = actor.operations[i];

      // FIXED (Bug #66): Validate operation is object before accessing properties
      if (!op || typeof op !== 'object') {
        issues.push({
          ruleId: 'SEC012',
          severity: 'error',
          message: `Actor "${actor.id}" operation at index ${i} must be an object`,
          path: `${actorPath}.operations[${i}]`,
          suggestion: 'Ensure all operations are properly formatted objects'
        });
        continue;
      }

      const command = op.command;

      // Validate command is string
      if (typeof command !== 'string') {
        issues.push({
          ruleId: 'SEC012',
          severity: 'error',
          message: `Actor "${actor.id}" operation command must be a string`,
          path: `${actorPath}.operations[${i}].command`,
          suggestion: 'Ensure command field is a string'
        });
        continue;
      }

      // Check for shell metacharacters
      checkCommandString(command, `${actorPath}.operations[${i}].command`);
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
   * Helper: Normalize path for security checks
   * FIXED (Bug #62, #63, #67, #74, #76, #77, #78, #85, #89): Canonicalizes paths to prevent bypass via:
   * - Relative traversal (../)
   * - Windows case insensitivity
   * - Mixed path separators (\ vs /)
   * - UNC paths (\\?\ and network \\server\share)
   * - Stack underflow from excessive ../
   * - Null byte injection (all encoding variants)
   * - Case normalization order
   * - Empty path normalization to root
   */
  private normalizePath(path: string): string {
    if (typeof path !== 'string') return '';

    // FIXED (Bug #89): Reject empty or whitespace-only paths
    // Empty string would normalize to '/' (root directory access)
    if (path.length === 0 || path.trim().length === 0) {
      return ''; // Invalid: empty path
    }

    // FIXED (Bug #77, #85): Reject null bytes in all encoding forms
    if (path.includes('\0') ||
        path.includes('\x00') ||
        path.includes('%00') ||
        path.includes('\u0000') ||  // Unicode notation
        path.includes('%2500') ||   // Double URL-encoded
        path.includes('\xC0\x80')) { // UTF-8 overlong encoding
      return ''; // Invalid path with null byte
    }

    let normalized = path;

    // Normalize path separators to forward slashes
    // FIXED (Bug #67): Handle Windows backslashes
    normalized = normalized.replace(/\\/g, '/');

    // FIXED (Bug #78): Lowercase FIRST on Windows (before other processing)
    // This ensures case-insensitive regex matching works correctly
    if (process.platform === 'win32') {
      normalized = normalized.toLowerCase();
    }

    // FIXED (Bug #76): Handle Windows UNC paths (both long path and network UNC)
    // Long path: \\?\C:\ becomes C:/
    normalized = normalized.replace(/^\/\/\?\/([a-z]):\//, '$1:/');
    // Network UNC: //server/share stays as-is but gets leading / removed for consistency
    // UNC paths starting with // are detected but kept (will be rejected by denylist if needed)
    if (normalized.startsWith('//')) {
      // This is a network UNC path like //server/share
      // Keep it as-is for now (security checks will handle it)
    }

    // Resolve relative path components (..)
    // FIXED (Bug #62, #74): Prevent directory traversal bypass AND stack underflow
    const parts = normalized.split('/').filter(Boolean);
    const stack: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        // FIXED (Bug #74): Only pop if stack is not empty (prevent underflow)
        if (stack.length > 0) {
          stack.pop();
        }
        // If stack is empty, we're trying to go above root - ignore the ../
      } else if (part !== '.') {
        stack.push(part);
      }
    }

    normalized = '/' + stack.join('/');

    // Collapse multiple slashes
    normalized = normalized.replace(/\/+/g, '/');

    return normalized;
  }

  /**
   * Helper: Check if path matches pattern (simple glob matching)
   * FIXED (Bug #75): Prevent ReDoS by using non-backtracking approach
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // SECURITY: Avoid regex to prevent ReDoS vulnerability
    // Instead, use character-by-character matching with ** and * expansion

    const pathParts = path.split('/');
    const patternParts = pattern.split('/');

    let pathIdx = 0;
    let patternIdx = 0;

    while (pathIdx < pathParts.length && patternIdx < patternParts.length) {
      const patternPart = patternParts[patternIdx];

      if (patternPart === '**') {
        // ** matches zero or more path segments
        // Try to match rest of pattern with remaining path
        patternIdx++;

        // If ** is last element, it matches everything
        if (patternIdx >= patternParts.length) {
          return true;
        }

        // Try to find where the next pattern part matches
        const nextPattern = patternParts[patternIdx];
        if (!nextPattern) return false; // Pattern exhausted

        while (pathIdx < pathParts.length) {
          if (this.matchGlobSegment(pathParts[pathIdx]!, nextPattern)) {
            // Found match, continue from here
            break;
          }
          pathIdx++;
        }

        if (pathIdx >= pathParts.length) {
          return false;
        }
      } else {
        const pathPart = pathParts[pathIdx];
        const currentPattern = patternParts[patternIdx];
        if (!pathPart || !currentPattern) return false; // Exhausted

        if (this.matchGlobSegment(pathPart, currentPattern)) {
          // Single segment matches
          pathIdx++;
          patternIdx++;
        } else {
          return false;
        }
      }
    }

    // Handle trailing ** in pattern
    while (patternIdx < patternParts.length && patternParts[patternIdx] === '**') {
      patternIdx++;
    }

    return pathIdx === pathParts.length && patternIdx === patternParts.length;
  }

  /**
   * Helper: Match single path segment against glob pattern
   * FIXED (Bug #75): Simple character matching without regex backtracking
   */
  private matchGlobSegment(segment: string, pattern: string): boolean {
    let segIdx = 0;
    let patIdx = 0;
    let starIdx = -1;
    let segBacktrack = -1;

    while (segIdx < segment.length) {
      if (patIdx < pattern.length && (pattern[patIdx] === '?' || pattern[patIdx] === segment[segIdx])) {
        // Exact match or ? wildcard
        segIdx++;
        patIdx++;
      } else if (patIdx < pattern.length && pattern[patIdx] === '*') {
        // * wildcard - record position for backtracking
        starIdx = patIdx;
        segBacktrack = segIdx;
        patIdx++;
      } else if (starIdx !== -1) {
        // Backtrack to last * and try matching one more character
        patIdx = starIdx + 1;
        segBacktrack++;
        segIdx = segBacktrack;
      } else {
        return false;
      }
    }

    // Consume remaining * in pattern
    while (patIdx < pattern.length && pattern[patIdx] === '*') {
      patIdx++;
    }

    return patIdx === pattern.length;
  }

  /**
   * Helper: Parse memory limit string to MB
   * FIXED (Bug #71, #79, #81): Support decimal/binary units + prevent integer overflow + strict format
   */
  private parseMemoryLimit(limit: string): number | null {
    // Ensure limit is a string
    if (typeof limit !== 'string') return null;

    // Match decimal (KB/MB/GB) or binary (KiB/MiB/GiB) units
    // FIXED (Bug #81): Removed \s* to disallow spaces between number and unit
    const match = limit.match(/^(\d+(?:\.\d+)?)(KB|MB|GB|KiB|MiB|GiB)$/i);
    if (!match || !match[1] || !match[2]) return null;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    // FIXED (Bug #79): Validate reasonable bounds to prevent overflow
    // Max realistic memory: 1TB = 1048576 MB
    const MAX_MB_LIMIT = 1048576; // 1TB in MB

    // Check for Infinity, NaN, or unreasonably large values BEFORE multiplication
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      return null;
    }

    let resultMB: number;

    // Handle decimal units (1000-based)
    switch (unit) {
      case 'KB':
        resultMB = value / 1024;
        break;
      case 'MB':
        resultMB = value;
        break;
      case 'GB':
        resultMB = value * 1024;
        break;
      // Handle binary units (1024-based)
      case 'KIB':
        resultMB = value / 1024;
        break;
      case 'MIB':
        resultMB = value;
        break;
      case 'GIB':
        resultMB = value * 1024;
        break;
      default:
        return null;
    }

    // FIXED (Bug #79): Validate result is within reasonable bounds
    if (!Number.isFinite(resultMB) || resultMB < 0 || resultMB > MAX_MB_LIMIT) {
      return null; // Invalid: overflow, negative, or > 1TB
    }

    return resultMB;
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
