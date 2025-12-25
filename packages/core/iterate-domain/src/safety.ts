/**
 * Safety Guard
 *
 * Checks for dangerous patterns and enforces safety limits.
 *
 * Invariants:
 * - INV-ITR-002: Safety guards must pause on dangerous patterns
 */

import {
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  type IterateSafetyConfig,
  type SafetyCheckResult,
} from '@defai.digital/contracts';
import type { ISafetyGuard } from './types.js';

// ============================================================================
// Default Dangerous Patterns
// ============================================================================

/**
 * Default patterns that trigger safety pause
 */
const DEFAULT_DANGEROUS_PATTERNS = [
  // File system destruction
  'rm\\s+-rf\\s+[/~]',
  'rm\\s+-rf\\s+\\*',
  'rm\\s+-rf\\s+\\.',
  'rmdir\\s+/\\s',
  // Database destruction
  'DROP\\s+TABLE',
  'DROP\\s+DATABASE',
  'TRUNCATE\\s+TABLE',
  'DELETE\\s+FROM\\s+\\w+\\s*;',
  // Disk format
  'mkfs\\.',
  'format\\s+[cC]:',
  'dd\\s+if=',
  // Fork bomb
  ':\\(\\)\\{\\s*:|:&\\s*\\};:',
  // Git force
  'git\\s+push\\s+.*--force',
  'git\\s+reset\\s+--hard\\s+origin',
  // Shutdown/reboot
  'shutdown',
  'reboot',
  'init\\s+0',
  // Env/secrets exposure
  'echo\\s+\\$[A-Z_]*KEY',
  'echo\\s+\\$[A-Z_]*SECRET',
  'echo\\s+\\$[A-Z_]*PASSWORD',
];

// ============================================================================
// Safety Guard Implementation
// ============================================================================

/**
 * Checks content for dangerous patterns
 */
export class SafetyGuard implements ISafetyGuard {
  private config: IterateSafetyConfig;
  private compiledPatterns: RegExp[];

  constructor(config?: Partial<IterateSafetyConfig>) {
    this.config = {
      maxConsecutiveErrors: config?.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS,
      enableDangerousPatternDetection: config?.enableDangerousPatternDetection ?? true,
      dangerousPatterns: config?.dangerousPatterns ?? DEFAULT_DANGEROUS_PATTERNS,
      customDangerousPatterns: config?.customDangerousPatterns,
    };

    // Compile patterns for performance
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Compile all patterns into RegExp objects
   */
  private compilePatterns(): RegExp[] {
    const patterns = [
      ...this.config.dangerousPatterns,
      ...(this.config.customDangerousPatterns ?? []),
    ];

    return patterns.map((pattern) => {
      try {
        return new RegExp(pattern, 'i');
      } catch {
        // Invalid pattern - skip it
        console.warn(`Invalid dangerous pattern: ${pattern}`);
        return null;
      }
    }).filter((p): p is RegExp => p !== null);
  }

  /**
   * Check content for dangerous patterns
   */
  checkContent(content: string): SafetyCheckResult {
    if (!this.config.enableDangerousPatternDetection) {
      return { safe: true };
    }

    for (const pattern of this.compiledPatterns) {
      if (pattern.test(content)) {
        // Determine severity based on pattern
        const severity = this.getSeverity(pattern.source);

        return {
          safe: false,
          reason: `Dangerous pattern detected: ${pattern.source}`,
          matchedPattern: pattern.source,
          severity,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Check if too many consecutive errors
   */
  checkErrors(consecutiveErrors: number): SafetyCheckResult {
    if (consecutiveErrors >= this.config.maxConsecutiveErrors) {
      return {
        safe: false,
        reason: `Too many consecutive errors (${consecutiveErrors}/${this.config.maxConsecutiveErrors})`,
        severity: 'warning',
      };
    }

    return { safe: true };
  }

  /**
   * Get safety configuration
   */
  getConfig(): IterateSafetyConfig {
    return { ...this.config };
  }

  /**
   * Determine severity based on pattern
   */
  private getSeverity(pattern: string): 'warning' | 'danger' | 'critical' {
    // Critical patterns - immediate system damage
    const criticalPatterns = [
      'rm\\s+-rf\\s+[/~]',
      'mkfs\\.',
      'dd\\s+if=',
      'DROP\\s+DATABASE',
      ':\\(\\)\\{',
    ];

    for (const critical of criticalPatterns) {
      if (pattern.includes(critical) || pattern === critical) {
        return 'critical';
      }
    }

    // Danger patterns - significant data loss
    const dangerPatterns = [
      'DROP\\s+TABLE',
      'TRUNCATE',
      'DELETE\\s+FROM',
      'git\\s+push.*--force',
    ];

    for (const danger of dangerPatterns) {
      if (pattern.includes(danger) || pattern === danger) {
        return 'danger';
      }
    }

    return 'warning';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a safety guard with optional configuration
 */
export function createSafetyGuard(config?: Partial<IterateSafetyConfig>): ISafetyGuard {
  return new SafetyGuard(config);
}

/**
 * Quick check if content is safe
 */
export function isContentSafe(content: string): boolean {
  const guard = new SafetyGuard();
  return guard.checkContent(content).safe;
}
