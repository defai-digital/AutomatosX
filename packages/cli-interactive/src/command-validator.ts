/**
 * Command Validator
 *
 * Validates commands before execution and classifies their risk level.
 * Prevents dangerous operations and command injection.
 */

export enum CommandRisk {
  SAFE = 'safe',           // npm test, ls, git status
  LOW = 'low',             // npm install, git pull
  MEDIUM = 'medium',       // rm (safe patterns), git push
  HIGH = 'high',           // rm -rf, chmod, sudo
  CRITICAL = 'critical'    // rm -rf /, dd, mkfs
}

export interface ValidationResult {
  valid: boolean;
  risk: CommandRisk;
  warnings: string[];
  sanitized?: string;
  blocked?: boolean;
  reason?: string;
}

export class CommandValidator {
  // CRITICAL patterns - always block these
  private static readonly CRITICAL_PATTERNS = [
    /rm\s+(-[rf]+\s+)?\/\s*$/,              // rm -rf /
    /rm\s+(-[rf]+\s+)?\/[^\/\s]*\s*$/,      // rm -rf /dir
    /dd\s+if=/,                             // dd if=
    /mkfs/,                                 // mkfs
    /:\(\)\s*\{.*:\|:/,                     // Fork bomb
    />\/dev\/sd[a-z]/,                      // Write to disk
    />\s*\/dev\/(null|zero|random)/,        // Dangerous redirects
    /format\s+[a-z]:/i,                     // Format drive (Windows)
    /del\s+\/[sStT]\s+[a-z]:/i              // Recursive delete (Windows)
  ];

  // HIGH risk patterns - require explicit confirmation
  private static readonly HIGH_PATTERNS = [
    /sudo/,
    /rm\s+-rf/,
    /rm\s+-fr/,
    /chmod\s+(-R\s+)?777/,
    /chown\s+-R/,
    /curl[^|]*\|\s*(ba)?sh/,                // Pipe to bash
    /wget[^|]*\|\s*sh/,                     // Pipe to sh
    /eval/,
    /exec\(/,
    />\s*~?\/.+/,                           // Redirect to home dir files
    /killall/,
    /pkill\s+-9/
  ];

  // MEDIUM risk patterns - simple confirmation
  private static readonly MEDIUM_PATTERNS = [
    /git\s+push\s+(-f|--force)/,
    /git\s+push\s+[^\s]*\s+[^\s]*\s+(-f|--force)/,
    /npm\s+publish/,
    /yarn\s+publish/,
    /rm\s+[^-]/,                            // rm without -rf
    /git\s+reset\s+--hard/,
    /git\s+clean\s+-[df]/,
    /npm\s+uninstall\s+(-g|--global)/
  ];

  // SAFE commands - no confirmation needed
  private static readonly SAFE_COMMANDS = [
    'ls', 'dir', 'pwd', 'cd', 'cat', 'less', 'more', 'head', 'tail',
    'echo', 'printf', 'date', 'whoami', 'which', 'where',
    'git status', 'git log', 'git diff', 'git show', 'git branch',
    'npm test', 'npm run test', 'yarn test',
    'npm list', 'yarn list', 'npm outdated', 'yarn outdated',
    'node --version', 'npm --version', 'git --version',
    'grep', 'find', 'tree', 'wc', 'sort', 'uniq'
  ];

  /**
   * Validate command before execution
   */
  validate(command: string): ValidationResult {
    const warnings: string[] = [];
    const trimmed = command.trim();

    // Empty command
    if (!trimmed) {
      return {
        valid: false,
        risk: CommandRisk.SAFE,
        warnings: ['Command is empty'],
        blocked: true,
        reason: 'Empty command'
      };
    }

    // Check for CRITICAL patterns - always block
    for (const pattern of CommandValidator.CRITICAL_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          risk: CommandRisk.CRITICAL,
          warnings: ['This command is extremely dangerous and has been blocked'],
          blocked: true,
          reason: 'Command matches critical danger pattern'
        };
      }
    }

    // Classify risk
    const risk = this.classifyRisk(trimmed);

    // Check for suspicious patterns
    const suspiciousWarnings = this.checkDangerousPatterns(trimmed);
    warnings.push(...suspiciousWarnings);

    // Add risk-specific warnings
    if (risk === CommandRisk.HIGH) {
      warnings.push('This command can cause permanent damage');
      warnings.push('Make sure you understand what it does before proceeding');
    } else if (risk === CommandRisk.MEDIUM) {
      warnings.push('This command will make changes to your system');
      warnings.push('Review carefully before proceeding');
    }

    return {
      valid: true,
      risk,
      warnings,
      blocked: false
    };
  }

  /**
   * Classify command risk level
   */
  classifyRisk(command: string): CommandRisk {
    const trimmed = command.trim();

    // Check if it's a safe command
    for (const safe of CommandValidator.SAFE_COMMANDS) {
      if (trimmed === safe || trimmed.startsWith(safe + ' ')) {
        return CommandRisk.SAFE;
      }
    }

    // Check HIGH patterns
    for (const pattern of CommandValidator.HIGH_PATTERNS) {
      if (pattern.test(trimmed)) {
        return CommandRisk.HIGH;
      }
    }

    // Check MEDIUM patterns
    for (const pattern of CommandValidator.MEDIUM_PATTERNS) {
      if (pattern.test(trimmed)) {
        return CommandRisk.MEDIUM;
      }
    }

    // Check for package manager installs (LOW risk)
    if (this.isPackageManagerInstall(trimmed)) {
      return CommandRisk.LOW;
    }

    // Check for git pull/fetch (LOW risk)
    if (/^git\s+(pull|fetch)/.test(trimmed)) {
      return CommandRisk.LOW;
    }

    // Check for build commands (SAFE)
    if (this.isBuildCommand(trimmed)) {
      return CommandRisk.SAFE;
    }

    // Default to LOW for unknown commands
    return CommandRisk.LOW;
  }

  /**
   * Check for dangerous patterns
   */
  checkDangerousPatterns(command: string): string[] {
    const warnings: string[] = [];

    // Command injection patterns
    if (/[;&|`$()]/.test(command)) {
      warnings.push('Command contains shell metacharacters');
    }

    // Redirect patterns
    if (/>\s*[^>]/.test(command)) {
      warnings.push('Command contains output redirection');
    }

    // Pipe to interpreter
    if (/\|\s*(ba)?sh\s*$/.test(command) || /\|\s*node\s*$/.test(command)) {
      warnings.push('Command pipes output to an interpreter');
    }

    // Network access
    if (/curl|wget|fetch|http/.test(command)) {
      warnings.push('Command may access the network');
    }

    // Recursive operations
    if (/-R|--recursive/.test(command)) {
      warnings.push('Command uses recursive option');
    }

    // Force operations
    if (/-f|--force/.test(command)) {
      warnings.push('Command uses force option');
    }

    return warnings;
  }

  /**
   * Sanitize command (remove dangerous parts)
   */
  sanitize(command: string): string {
    let sanitized = command.trim();

    // Remove command chaining
    sanitized = sanitized.split(/[;&|]/).map(part => part.trim())[0] || '';

    // Remove redirects
    sanitized = sanitized.replace(/>\s*[^>\s]+/g, '');
    sanitized = sanitized.replace(/<\s*[^<\s]+/g, '');

    // Remove backticks
    sanitized = sanitized.replace(/`[^`]*`/g, '');

    // Remove $()
    sanitized = sanitized.replace(/\$\([^)]*\)/g, '');

    return sanitized.trim();
  }

  /**
   * Check if command is a package manager install
   */
  private isPackageManagerInstall(command: string): boolean {
    const patterns = [
      /^npm\s+(install|i|add)\s/,
      /^yarn\s+(add|install)\s/,
      /^pnpm\s+(add|install)\s/,
      /^pip\s+install\s/,
      /^gem\s+install\s/,
      /^cargo\s+install\s/
    ];

    return patterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if command is a build command
   */
  private isBuildCommand(command: string): boolean {
    const patterns = [
      /^npm\s+run\s+(build|dev|start|test)/,
      /^yarn\s+(build|dev|start|test)/,
      /^pnpm\s+(build|dev|start|test)/,
      /^make\s+(build|test|all)?$/,
      /^cargo\s+(build|test|run)/,
      /^go\s+(build|test|run)/,
      /^mvn\s+(compile|test|package)/,
      /^gradle\s+(build|test)/
    ];

    return patterns.some(pattern => pattern.test(command));
  }

  /**
   * Get approval prompt for command based on risk
   */
  getApprovalPrompt(command: string, risk: CommandRisk): string | null {
    switch (risk) {
      case CommandRisk.SAFE:
        return null; // No approval needed

      case CommandRisk.LOW:
        return null; // No approval needed

      case CommandRisk.MEDIUM:
        return `Execute command: ${command}?\nContinue? (y/n)`;

      case CommandRisk.HIGH:
        return `⚠️  HIGH RISK COMMAND ⚠️\n\nCommand: ${command}\n\nThis command can cause permanent damage.\nType 'yes' to confirm:`;

      case CommandRisk.CRITICAL:
        return null; // Should never reach here (blocked)

      default:
        return `Execute command: ${command}?\nContinue? (y/n)`;
    }
  }

  /**
   * Check if command is allowed
   */
  isAllowed(command: string): boolean {
    const result = this.validate(command);
    return result.valid && !result.blocked;
  }
}
