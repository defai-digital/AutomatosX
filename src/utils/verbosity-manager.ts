/**
 * Centralized verbosity control for AutomatosX (v8.5.8)
 *
 * Provides three verbosity levels for different use cases:
 * - QUIET (0): Only errors and final results - for AI assistants
 * - NORMAL (1): Minimal progress + results - default for CLI
 * - VERBOSE (2): All details + debug info - for debugging
 *
 * Auto-detects non-interactive contexts (Claude Code, background mode)
 * and uses appropriate verbosity level.
 */

export enum VerbosityLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2
}

export interface VerbosityConfig {
  level: VerbosityLevel;
  showProgress: boolean;
  showProviderOutput: boolean;
  showComplexityAnalysis: boolean;
  showSpinner: boolean;
  showCompletionMessages: boolean;
  showExecutionInfo: boolean;
  showBanner: boolean;
}

export class VerbosityManager {
  private static instance: VerbosityManager | null = null;
  private config: VerbosityConfig;

  private constructor(level: VerbosityLevel) {
    this.config = this.buildConfig(level);
  }

  /**
   * Get singleton instance
   * @param level Optional explicit level (overrides auto-detection)
   */
  static getInstance(level?: VerbosityLevel): VerbosityManager {
    if (!VerbosityManager.instance || level !== undefined) {
      const resolvedLevel = level !== undefined ? level : VerbosityManager.detectLevel();
      VerbosityManager.instance = new VerbosityManager(resolvedLevel);
    }
    return VerbosityManager.instance;
  }

  /**
   * Reset singleton (useful for testing)
   */
  static reset(): void {
    VerbosityManager.instance = null;
  }

  /**
   * Auto-detect verbosity level from environment and context
   */
  private static detectLevel(): VerbosityLevel {
    // 1. Check explicit env var (highest priority)
    const envVerbosity = process.env.AUTOMATOSX_VERBOSITY;
    if (envVerbosity !== undefined) {
      const parsed = parseInt(envVerbosity, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
        return parsed as VerbosityLevel;
      }
    }

    // 2. Check legacy QUIET flag
    if (process.env.AUTOMATOSX_QUIET === 'true') {
      return VerbosityLevel.QUIET;
    }

    // 3. Auto-detect non-interactive context
    // These contexts should use quiet mode by default:
    // - No TTY (background processes, piped output)
    // - CI environment
    // - Iterate mode (autonomous execution)
    const isNonInteractive = !process.stdin.isTTY ||
                             process.env.CI === 'true' ||
                             process.env.AUTOMATOSX_ITERATE === 'true';

    if (isNonInteractive) {
      return VerbosityLevel.QUIET;
    }

    // 4. Default to NORMAL for interactive use
    return VerbosityLevel.NORMAL;
  }

  /**
   * Build configuration based on verbosity level
   */
  private buildConfig(level: VerbosityLevel): VerbosityConfig {
    switch (level) {
      case VerbosityLevel.QUIET:
        return {
          level: VerbosityLevel.QUIET,
          showProgress: false,
          showProviderOutput: false,
          showComplexityAnalysis: false,
          showSpinner: false,
          showCompletionMessages: false,
          showExecutionInfo: false,
          showBanner: false
        };

      case VerbosityLevel.NORMAL:
        return {
          level: VerbosityLevel.NORMAL,
          showProgress: true,
          showProviderOutput: false,
          showComplexityAnalysis: false,
          showSpinner: true,
          showCompletionMessages: true,
          showExecutionInfo: false,
          showBanner: true
        };

      case VerbosityLevel.VERBOSE:
        return {
          level: VerbosityLevel.VERBOSE,
          showProgress: true,
          showProviderOutput: true,
          showComplexityAnalysis: true,
          showSpinner: true,
          showCompletionMessages: true,
          showExecutionInfo: true,
          showBanner: true
        };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): VerbosityConfig {
    return { ...this.config };
  }

  /**
   * Get current verbosity level
   */
  getLevel(): VerbosityLevel {
    return this.config.level;
  }

  /**
   * Set verbosity level (updates config)
   */
  setLevel(level: VerbosityLevel): void {
    this.config = this.buildConfig(level);
  }

  /**
   * Check if a specific feature should be shown
   */
  shouldShow(feature: keyof Omit<VerbosityConfig, 'level'>): boolean {
    return this.config[feature];
  }

  /**
   * Check if we're in quiet mode
   */
  isQuiet(): boolean {
    return this.config.level === VerbosityLevel.QUIET;
  }

  /**
   * Check if we're in normal mode
   */
  isNormal(): boolean {
    return this.config.level === VerbosityLevel.NORMAL;
  }

  /**
   * Check if we're in verbose mode
   */
  isVerbose(): boolean {
    return this.config.level === VerbosityLevel.VERBOSE;
  }

  /**
   * Get human-readable level name
   */
  getLevelName(): string {
    switch (this.config.level) {
      case VerbosityLevel.QUIET: return 'quiet';
      case VerbosityLevel.NORMAL: return 'normal';
      case VerbosityLevel.VERBOSE: return 'verbose';
    }
  }
}
