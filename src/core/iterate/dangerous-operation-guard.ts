/**
 * Dangerous Operation Guard
 *
 * Scans tool outputs, shell commands, and file operations for potential risks
 * in iterate mode to prevent auto-confirmation of destructive actions.
 *
 * **Risk Categories**:
 * - LOW: Safe operations (read files, git status, etc.)
 * - MEDIUM: Potentially risky (npm install, shell commands, etc.)
 * - HIGH: Dangerous operations (file deletion, force push, secrets, etc.)
 *
 * **Detection Methods**:
 * - Command pattern matching
 * - File path analysis (workspace boundaries)
 * - Content scanning (secrets, tokens)
 * - Git operation classification
 *
 * @module core/iterate/dangerous-operation-guard
 * @since v6.4.0
 */

import type {
  Operation,
  RiskAssessment,
  RiskLevel,
  SafetyConfig
} from '../../types/iterate.js';
import type { WorkspaceManager } from '../workspace-manager.js';
import { logger } from '../../utils/logger.js';
import { resolve as resolvePath } from 'path';

/**
 * Dangerous Operation Guard
 *
 * Enforces safety constraints by assessing risk level of operations
 * before auto-confirming them in iterate mode.
 *
 * **Risk Enforcement**:
 * - LOW risk: Auto-allow (with logging)
 * - MEDIUM risk: Auto-allow or warn (based on risk tolerance)
 * - HIGH risk: Always pause for user confirmation
 *
 * **Usage**:
 * ```typescript
 * const guard = new DangerousOperationGuard(config, workspaceManager);
 *
 * // Check shell command
 * const assessment = await guard.checkShellCommand("rm -rf /tmp/build");
 * if (assessment.requiresConfirmation) {
 *   await controller.pause('high_risk_operation', assessment.recommendation);
 * }
 * ```
 *
 * @since v6.4.0
 */
export class DangerousOperationGuard {
  private config: SafetyConfig;
  private workspaceManager?: WorkspaceManager;

  /**
   * Regex patterns for dangerous commands (cached)
   * @private
   */
  private dangerousPatterns: Map<string, RegExp> = new Map();

  /**
   * Create DangerousOperationGuard
   *
   * @param config - Safety configuration
   * @param workspaceManager - Workspace manager for path validation (optional)
   */
  constructor(
    config: SafetyConfig,
    workspaceManager?: WorkspaceManager
  ) {
    this.config = config;
    this.workspaceManager = workspaceManager;

    logger.debug('DangerousOperationGuard created', {
      enabled: config.enableDangerousOperationGuard,
      riskTolerance: config.riskTolerance
    });

    // Compile dangerous command patterns for performance
    this.compileDangerousPatterns();
  }

  /**
   * Check generic operation for risk
   *
   * @param operation - Operation to check
   * @returns Risk assessment
   *
   * **Phase 1 (Week 1)**: Skeleton only (returns LOW risk placeholder)
   * **Phase 5 (Week 5)**: Full risk assessment implementation
   */
  async checkOperation(operation: Operation): Promise<RiskAssessment> {
    logger.debug('Checking operation', {
      type: operation.type,
      details: operation.details.substring(0, 100)
    });

    // Route to specific checker based on operation type
    switch (operation.type) {
      case 'shell_command':
        return this.checkShellCommand(operation.command || operation.details);

      case 'git_operation':
        return this.checkGitOperation(operation.command || operation.details);

      case 'file_write':
        return this.checkFileOperation({
          type: 'write',
          path: operation.paths?.[0] || operation.details,
          isExecutable: operation.context?.isExecutable
        });

      case 'file_delete':
        return this.checkFileOperation({
          type: 'delete',
          path: operation.paths?.[0] || operation.details
        });

      case 'package_install':
        // Package installation is generally MEDIUM risk
        const packageRiskLevel = this.config.dangerousOperations.packageInstall;
        const packageAllowed = this.config.enableDangerousOperationGuard
          ? packageRiskLevel !== 'HIGH' || this.config.riskTolerance === 'permissive'
          : true;
        const packageRequiresConfirmation = this.config.enableDangerousOperationGuard
          ? this.requiresConfirmation(packageRiskLevel)
          : false;

        return {
          riskLevel: packageRiskLevel,
          reason: 'Package installation operation',
          allowed: packageAllowed,
          requiresConfirmation: packageRequiresConfirmation,
          riskFactors: [
            {
              factor: 'package_install',
              severity: packageRiskLevel,
              description: 'Installing packages may execute scripts'
            }
          ],
          recommendation: packageRiskLevel === 'HIGH'
            ? 'Review package source before installation'
            : 'Package installation may proceed'
        };

      default:
        // Unknown operation type - default to LOW risk
        logger.warn('Unknown operation type, defaulting to LOW risk', {
          type: operation.type
        });
        return {
          riskLevel: 'LOW',
          reason: `Unknown operation type: ${operation.type}`,
          allowed: true,
          requiresConfirmation: false,
          riskFactors: [],
          recommendation: 'Operation type not recognized, proceeding with caution'
        };
    }
  }

  /**
   * Check shell command for dangerous patterns
   *
   * **Dangerous Patterns**:
   * - `rm -rf` - Recursive force delete
   * - `git push --force` - Force push (loses history)
   * - `chmod 777` - Overly permissive permissions
   * - `sudo` - Elevated privileges
   * - `curl | bash` - Piped execution (code injection risk)
   *
   * @param command - Shell command to check
   * @returns Risk assessment
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 5 (Week 5)**: Full command pattern matching
   */
  async checkShellCommand(command: string): Promise<RiskAssessment> {
    const riskFactors: Array<{ factor: string; severity: RiskLevel; description: string }> = [];

    // Check dangerous shell patterns
    const patterns = [
      { name: 'rm_rf', severity: 'HIGH' as RiskLevel, description: 'Recursive force deletion' },
      { name: 'sudo', severity: 'HIGH' as RiskLevel, description: 'Elevated privileges' },
      { name: 'chmod_777', severity: 'HIGH' as RiskLevel, description: 'Overly permissive file permissions' },
      { name: 'piped_execution', severity: 'HIGH' as RiskLevel, description: 'Piped command execution (code injection risk)' },
      { name: 'curl_pipe', severity: 'HIGH' as RiskLevel, description: 'Curl piped to shell (code injection risk)' },
      { name: 'wget_execute', severity: 'HIGH' as RiskLevel, description: 'Wget piped execution' },
      { name: 'dd_command', severity: 'HIGH' as RiskLevel, description: 'Low-level disk operations' },
      { name: 'mkfs', severity: 'HIGH' as RiskLevel, description: 'Filesystem creation (data loss risk)' },
      { name: 'fdisk', severity: 'HIGH' as RiskLevel, description: 'Disk partitioning (data loss risk)' }
    ];

    for (const { name, severity, description } of patterns) {
      const pattern = this.dangerousPatterns.get(name);
      if (pattern && pattern.test(command)) {
        riskFactors.push({ factor: name, severity, description });
      }
    }

    // Determine overall risk level
    let riskLevel: RiskLevel = 'LOW';
    if (riskFactors.length > 0) {
      // If any HIGH risk factors, overall is HIGH
      const hasHigh = riskFactors.some(f => f.severity === 'HIGH');
      riskLevel = hasHigh ? 'HIGH' : 'MEDIUM';
    }

    const allowed = this.config.enableDangerousOperationGuard ? riskLevel !== 'HIGH' || this.config.riskTolerance === 'permissive' : true;
    const requiresConfirmation = this.config.enableDangerousOperationGuard ? this.requiresConfirmation(riskLevel) : false;

    const reason = riskFactors.length > 0
      ? `Dangerous command detected: ${riskFactors.map(f => f.factor).join(', ')}`
      : 'Command appears safe';

    const recommendation = riskFactors.length > 0
      ? `Review command carefully: ${riskFactors[0]?.description || 'Unknown risk'}`
      : 'Command may proceed';

    logger.debug('Shell command checked', {
      command: command.substring(0, 100),
      riskLevel,
      riskFactorCount: riskFactors.length,
      requiresConfirmation
    });

    return {
      riskLevel,
      reason,
      allowed,
      requiresConfirmation,
      riskFactors,
      recommendation
    };
  }

  /**
   * Check file operation for risk
   *
   * **Risk Factors**:
   * - Write outside workspace (HIGH risk)
   * - Delete operations (MEDIUM-HIGH risk)
   * - System/hidden files (MEDIUM risk)
   * - Executable permissions (MEDIUM risk)
   *
   * @param operation - File operation details
   * @returns Risk assessment
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 5 (Week 5)**: Full file operation checking with workspace validation
   */
  async checkFileOperation(operation: {
    type: 'read' | 'write' | 'delete';
    path: string;
    isExecutable?: boolean;
  }): Promise<RiskAssessment> {
    const riskFactors: Array<{ factor: string; severity: RiskLevel; description: string }> = [];

    // Check if path is outside workspace
    const isOutside = this.isOutsideWorkspace(operation.path);
    if (isOutside && (operation.type === 'write' || operation.type === 'delete')) {
      riskFactors.push({
        factor: 'outside_workspace',
        severity: 'HIGH',
        description: `${operation.type === 'delete' ? 'Deleting' : 'Writing'} file outside workspace`
      });
    }

    // Check for system/hidden files
    const fileName = operation.path.split('/').pop() || '';
    const isSensitive = fileName.startsWith('.') || fileName.endsWith('.env') ||
                        operation.path.includes('/.git/') ||
                        operation.path.includes('/node_modules/') ||
                        fileName === 'package.json' ||
                        fileName === 'package-lock.json';

    if (isSensitive && operation.type === 'delete') {
      riskFactors.push({
        factor: 'delete_sensitive_file',
        severity: 'HIGH',
        description: 'Deleting sensitive/system file'
      });
    } else if (isSensitive && operation.type === 'write') {
      riskFactors.push({
        factor: 'write_sensitive_file',
        severity: 'MEDIUM',
        description: 'Writing to sensitive/system file'
      });
    }

    // Check for executable files
    if (operation.isExecutable && operation.type === 'write') {
      riskFactors.push({
        factor: 'write_executable',
        severity: 'MEDIUM',
        description: 'Writing executable file'
      });
    }

    // Assess operation type risk
    let baseRisk: RiskLevel = 'LOW';
    if (operation.type === 'delete') {
      baseRisk = 'MEDIUM'; // Deletes are inherently risky
    } else if (operation.type === 'write') {
      baseRisk = 'LOW'; // Writes are generally safe
    } // read is always LOW

    // Determine overall risk level
    let riskLevel: RiskLevel = baseRisk;
    if (riskFactors.length > 0) {
      const hasHigh = riskFactors.some(f => f.severity === 'HIGH');
      const hasMedium = riskFactors.some(f => f.severity === 'MEDIUM');
      if (hasHigh) {
        riskLevel = 'HIGH';
      } else if (hasMedium || baseRisk === 'MEDIUM') {
        riskLevel = 'MEDIUM';
      }
    }

    const configRiskLevel = this.config.dangerousOperations.fileDelete;
    const allowed = this.config.enableDangerousOperationGuard
      ? !(riskLevel === 'HIGH' && configRiskLevel === 'HIGH') || this.config.riskTolerance === 'permissive'
      : true;

    const requiresConfirmation = this.config.enableDangerousOperationGuard ? this.requiresConfirmation(riskLevel) : false;

    const reason = riskFactors.length > 0
      ? `Risky file operation: ${riskFactors.map(f => f.factor).join(', ')}`
      : `${operation.type} operation appears safe`;

    const recommendation = riskFactors.length > 0
      ? `Review file operation: ${riskFactors[0]?.description || 'Unknown risk'}`
      : 'File operation may proceed';

    logger.debug('File operation checked', {
      type: operation.type,
      path: operation.path,
      riskLevel,
      riskFactorCount: riskFactors.length
    });

    return {
      riskLevel,
      reason,
      allowed,
      requiresConfirmation,
      riskFactors,
      recommendation
    };
  }

  /**
   * Check git operation for risk
   *
   * **High-Risk Git Operations**:
   * - `git push --force` - Loses history
   * - `git reset --hard` - Loses uncommitted changes
   * - `git clean -fd` - Deletes untracked files
   * - `git rebase` on pushed commits - Rewrites history
   *
   * @param command - Git command to check
   * @returns Risk assessment
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 5 (Week 5)**: Full git operation risk checking
   */
  async checkGitOperation(command: string): Promise<RiskAssessment> {
    const riskFactors: Array<{ factor: string; severity: RiskLevel; description: string }> = [];

    // Check git-specific dangerous patterns
    const gitPatterns = [
      { name: 'git_force_push', severity: 'HIGH' as RiskLevel, description: 'Force push (loses history)' },
      { name: 'git_reset_hard', severity: 'HIGH' as RiskLevel, description: 'Hard reset (loses uncommitted changes)' },
      { name: 'git_clean', severity: 'HIGH' as RiskLevel, description: 'Delete untracked files' },
      { name: 'git_rebase', severity: 'MEDIUM' as RiskLevel, description: 'Rebase (rewrites history)' }
    ];

    for (const { name, severity, description } of gitPatterns) {
      const pattern = this.dangerousPatterns.get(name);
      if (pattern && pattern.test(command)) {
        riskFactors.push({ factor: name, severity, description });
      }
    }

    // Check for force push to protected branches
    if (command.includes('push') && command.includes('--force') && (command.includes('main') || command.includes('master'))) {
      riskFactors.push({
        factor: 'force_push_protected',
        severity: 'HIGH',
        description: 'Force push to protected branch (main/master)'
      });
    }

    let riskLevel: RiskLevel = 'LOW';
    if (riskFactors.length > 0) {
      const hasHigh = riskFactors.some(f => f.severity === 'HIGH');
      riskLevel = hasHigh ? 'HIGH' : 'MEDIUM';
    }

    const allowed = this.config.enableDangerousOperationGuard ? riskLevel !== 'HIGH' || this.config.riskTolerance === 'permissive' : true;
    const requiresConfirmation = this.config.enableDangerousOperationGuard ? this.requiresConfirmation(riskLevel) : false;

    const reason = riskFactors.length > 0
      ? `Dangerous git operation: ${riskFactors.map(f => f.factor).join(', ')}`
      : 'Git operation appears safe';

    const recommendation = riskFactors.length > 0
      ? `Review git operation: ${riskFactors[0]?.description || 'Unknown risk'}`
      : 'Git operation may proceed';

    logger.debug('Git operation checked', {
      command: command.substring(0, 100),
      riskLevel,
      riskFactorCount: riskFactors.length
    });

    return {
      riskLevel,
      reason,
      allowed,
      requiresConfirmation,
      riskFactors,
      recommendation
    };
  }

  /**
   * Scan content for secrets (API keys, tokens, passwords)
   *
   * **Secret Patterns**:
   * - API keys: `AKIA...`, `sk_live_...`, etc.
   * - Tokens: Long hex strings, JWTs
   * - Passwords: `password=`, `pwd=`, etc.
   * - Private keys: `-----BEGIN PRIVATE KEY-----`
   *
   * @param content - Content to scan
   * @param filePath - File path (for context)
   * @returns Risk assessment
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 5 (Week 5)**: Full secret scanning
   */
  async scanForSecrets(
    content: string,
    filePath?: string
  ): Promise<RiskAssessment> {
    const riskFactors: Array<{ factor: string; severity: RiskLevel; description: string }> = [];

    // Check secret patterns
    const secretPatterns = [
      { name: 'aws_key', severity: 'HIGH' as RiskLevel, description: 'AWS access key detected' },
      { name: 'github_token', severity: 'HIGH' as RiskLevel, description: 'GitHub personal access token detected' },
      { name: 'stripe_key', severity: 'HIGH' as RiskLevel, description: 'Stripe secret key detected' },
      { name: 'generic_api_key', severity: 'HIGH' as RiskLevel, description: 'Generic API key detected' },
      { name: 'password_field', severity: 'HIGH' as RiskLevel, description: 'Password in plaintext detected' },
      { name: 'private_key', severity: 'HIGH' as RiskLevel, description: 'Private key detected' },
      { name: 'jwt_token', severity: 'MEDIUM' as RiskLevel, description: 'JWT token detected' }
    ];

    for (const { name, severity, description } of secretPatterns) {
      const pattern = this.dangerousPatterns.get(name);
      if (pattern && pattern.test(content)) {
        riskFactors.push({ factor: name, severity, description });
      }
    }

    // Special handling for .env files - always HIGH risk if has secrets
    if (filePath && (filePath.endsWith('.env') || filePath.includes('.env.'))) {
      if (riskFactors.length > 0) {
        riskFactors.push({
          factor: 'secrets_in_env_file',
          severity: 'HIGH',
          description: 'Secrets detected in environment file'
        });
      }
    }

    let riskLevel: RiskLevel = 'LOW';
    if (riskFactors.length > 0) {
      const hasHigh = riskFactors.some(f => f.severity === 'HIGH');
      riskLevel = hasHigh ? 'HIGH' : 'MEDIUM';
    }

    const allowed = this.config.enableDangerousOperationGuard && this.config.dangerousOperations.secretsInCode === 'HIGH'
      ? riskLevel !== 'HIGH' || this.config.riskTolerance === 'permissive'
      : true;

    const requiresConfirmation = this.config.enableDangerousOperationGuard ? this.requiresConfirmation(riskLevel) : false;

    const reason = riskFactors.length > 0
      ? `Secrets detected: ${riskFactors.map(f => f.factor).join(', ')}`
      : 'No secrets detected';

    const recommendation = riskFactors.length > 0
      ? `Remove secrets from code: ${riskFactors[0]?.description || 'Unknown secret type'}`
      : 'Content appears safe';

    logger.debug('Secret scan complete', {
      contentLength: content.length,
      filePath,
      riskLevel,
      secretCount: riskFactors.length
    });

    return {
      riskLevel,
      reason,
      allowed,
      requiresConfirmation,
      riskFactors,
      recommendation
    };
  }

  /**
   * Compile dangerous command patterns for performance
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only (no patterns compiled)
   * **Phase 5 (Week 5)**: Compile all dangerous patterns
   */
  private compileDangerousPatterns(): void {
    // Dangerous shell command patterns
    this.dangerousPatterns.set('rm_rf', /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive.*--force|-[a-zA-Z]*f[a-zA-Z]*r)/);
    this.dangerousPatterns.set('sudo', /\bsudo\b/);
    this.dangerousPatterns.set('chmod_777', /chmod\s+777/);
    this.dangerousPatterns.set('piped_execution', /\|\s*(bash|sh|zsh|fish|python|ruby|perl|node)/);
    this.dangerousPatterns.set('curl_pipe', /curl.*\|\s*(bash|sh)/);
    this.dangerousPatterns.set('wget_execute', /wget.*-O.*\|\s*(bash|sh)/);
    this.dangerousPatterns.set('dd_command', /\bdd\b.*if=.*of=/);
    this.dangerousPatterns.set('mkfs', /\bmkfs\./);
    this.dangerousPatterns.set('fdisk', /\bfdisk\b/);

    // Git force operations
    this.dangerousPatterns.set('git_force_push', /git\s+push.*--force(-with-lease)?/);
    this.dangerousPatterns.set('git_reset_hard', /git\s+reset\s+--hard/);
    this.dangerousPatterns.set('git_clean', /git\s+clean\s+-[a-zA-Z]*[fd]/);
    this.dangerousPatterns.set('git_rebase', /git\s+rebase\s+(-i|--interactive)/);

    // Secret patterns
    this.dangerousPatterns.set('aws_key', /AKIA[0-9A-Z]{16}/);
    this.dangerousPatterns.set('github_token', /ghp_[a-zA-Z0-9]{36}/);
    this.dangerousPatterns.set('stripe_key', /sk_live_[0-9a-zA-Z]{24,}/);
    this.dangerousPatterns.set('generic_api_key', /api[_-]?key\s*[=:]\s*['"][^'"]{16,}['"]/i);
    this.dangerousPatterns.set('password_field', /password\s*[=:]\s*['"][^'"]+['"]/i);
    this.dangerousPatterns.set('private_key', /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/);
    this.dangerousPatterns.set('jwt_token', /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/);

    logger.debug('Dangerous patterns compiled', {
      patternCount: this.dangerousPatterns.size
    });
  }

  /**
   * Check if path is outside workspace
   *
   * @param path - Path to check
   * @returns True if path is outside workspace
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only (always returns false)
   * **Phase 4 (Week 4)**: Use WorkspaceManager for validation
   */
  private isOutsideWorkspace(filePath: string): boolean {
    // Get workspace root
    // Note: WorkspaceManager.projectDir is private, so we need alternative approach
    // Use process.cwd() as workspace root (current working directory)
    const workspaceRoot = process.cwd();

    // Resolve paths to absolute
    const absoluteWorkspace = resolvePath(workspaceRoot);
    const absoluteFile = resolvePath(filePath);

    // Normalize paths for comparison (resolve symlinks, remove trailing slashes)
    const normalizedWorkspace = absoluteWorkspace.replace(/\/$/, '');
    const normalizedFile = absoluteFile.replace(/\/$/, '');

    // Check if file path starts with workspace path
    // This means it's inside or at the workspace root
    const isInside = normalizedFile.startsWith(normalizedWorkspace);

    // Return true if outside workspace
    return !isInside;
  }

  /**
   * Determine if operation requires user confirmation based on risk level
   *
   * @param riskLevel - Assessed risk level
   * @returns True if requires confirmation
   * @private
   *
   * **Phase 1 (Week 1)**: Skeleton only
   * **Phase 5 (Week 5)**: Use risk tolerance config
   */
  private requiresConfirmation(riskLevel: RiskLevel): boolean {
    const { riskTolerance } = this.config;

    switch (riskTolerance) {
      case 'paranoid':
        // Require confirmation for MEDIUM and HIGH risk
        return riskLevel === 'MEDIUM' || riskLevel === 'HIGH';

      case 'balanced':
        // Only require confirmation for HIGH risk (default)
        return riskLevel === 'HIGH';

      case 'permissive':
        // Never require confirmation (dangerous! User accepted risk)
        return false;

      default:
        // Default to balanced behavior
        logger.warn('Unknown risk tolerance, defaulting to balanced', { riskTolerance });
        return riskLevel === 'HIGH';
    }
  }
}
