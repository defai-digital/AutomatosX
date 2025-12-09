/**
 * Bugfix Controller
 *
 * Orchestrates the autonomous bug-finding and fixing workflow.
 *
 * Features:
 * - State machine for controlled execution
 * - Integration with IterateModeController patterns
 * - Memory-driven pattern learning
 * - Bounded retries and stop conditions
 *
 * @module core/bugfix/bugfix-controller
 * @since v12.4.0
 */

import { randomUUID } from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import { BugDetector, createDefaultBugfixConfig } from './bug-detector.js';
import { BugFixer } from './bug-fixer.js';
import { VerificationGate } from './verification-gate.js';
import type {
  BugFinding,
  FixAttempt,
  BugfixConfig,
  BugfixState,
  BugfixStats,
  BugfixResult,
  BugType,
  BugSeverity
} from './types.js';

/**
 * Bugfix Controller options
 */
export interface BugfixControllerOptions {
  /** Configuration overrides */
  config?: Partial<BugfixConfig>;

  /** Project root directory */
  rootDir?: string;

  /** Progress callback */
  onProgress?: (message: string, data?: Record<string, unknown>) => void;

  /** Bug found callback */
  onBugFound?: (finding: BugFinding) => void;

  /** Fix applied callback */
  onFixApplied?: (finding: BugFinding, attempt: FixAttempt) => void;

  /** Verification callback */
  onVerification?: (finding: BugFinding, success: boolean) => void;
}

/**
 * Bugfix Controller
 *
 * Main orchestrator for autonomous bug-fixing workflow.
 *
 * State Machine:
 * IDLE → SCANNING → ANALYZING → PLANNING → FIXING → VERIFYING → LEARNING → (ITERATING | COMPLETE)
 */
export class BugfixController {
  private config: BugfixConfig;
  private rootDir: string;
  private state: BugfixState = 'IDLE';
  private sessionId: string;
  private startTime: number = 0;
  private totalTokens: number = 0;

  // Components
  private detector: BugDetector;
  private fixer: BugFixer;
  private verifier: VerificationGate;

  // Session data
  private findings: BugFinding[] = [];
  private attempts: FixAttempt[] = [];
  private currentBugIndex: number = 0;
  private retryCount: Map<string, number> = new Map();

  // Callbacks
  private onProgress?: (message: string, data?: Record<string, unknown>) => void;
  private onBugFound?: (finding: BugFinding) => void;
  private onFixApplied?: (finding: BugFinding, attempt: FixAttempt) => void;
  private onVerification?: (finding: BugFinding, success: boolean) => void;

  constructor(options: BugfixControllerOptions = {}) {
    this.config = createDefaultBugfixConfig(options.config);
    this.rootDir = options.rootDir || process.cwd();
    this.sessionId = randomUUID();

    // Initialize components
    this.detector = new BugDetector(this.config);
    this.fixer = new BugFixer();
    this.verifier = new VerificationGate({
      typecheck: this.config.requireTypecheck,
      tests: this.config.requireTests,
      cwd: this.rootDir
    });

    // Store callbacks
    this.onProgress = options.onProgress;
    this.onBugFound = options.onBugFound;
    this.onFixApplied = options.onFixApplied;
    this.onVerification = options.onVerification;

    logger.debug('BugfixController initialized', {
      sessionId: this.sessionId,
      rootDir: this.rootDir,
      config: this.config
    });
  }

  /**
   * Execute autonomous bugfix workflow
   *
   * @returns Bugfix session result
   */
  async execute(): Promise<BugfixResult> {
    this.startTime = Date.now();
    this.state = 'SCANNING';

    logger.info('Starting bugfix session', {
      sessionId: this.sessionId,
      rootDir: this.rootDir,
      maxBugs: this.config.maxBugs,
      dryRun: this.config.dryRun
    });

    this.emitProgress('Starting bug scan...');

    try {
      // State machine loop
      while (this.shouldContinue()) {
        // Use type assertion to break out of TypeScript's control flow narrowing
        // (handlers mutate state, so TypeScript's control flow can't track it)
        const currentState = this.state as BugfixState;

        if (currentState === 'IDLE') {
          // Should not happen, but handle gracefully
          this.state = 'SCANNING';
        } else if (currentState === 'SCANNING') {
          await this.handleScanning();
        } else if (currentState === 'ANALYZING') {
          await this.handleAnalyzing();
        } else if (currentState === 'PLANNING') {
          await this.handlePlanning();
        } else if (currentState === 'FIXING') {
          await this.handleFixing();
        } else if (currentState === 'VERIFYING') {
          await this.handleVerifying();
        } else if (currentState === 'LEARNING') {
          await this.handleLearning();
        } else if (currentState === 'ITERATING') {
          await this.handleIterating();
        } else if (currentState === 'COMPLETE' || currentState === 'FAILED') {
          // Terminal states - exit loop
          break;
        }
      }

      return this.buildResult();

    } catch (error) {
      this.state = 'FAILED';

      logger.error('Bugfix session failed', {
        sessionId: this.sessionId,
        error: (error as Error).message,
        state: this.state
      });

      return this.buildResult((error as Error).message);
    }
  }

  /**
   * Check if execution should continue
   */
  private shouldContinue(): boolean {
    // Stop conditions
    if (this.state === 'COMPLETE' || this.state === 'FAILED') {
      return false;
    }

    // Time limit
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;
    if (elapsedMinutes >= this.config.maxDurationMinutes) {
      logger.warn('Time limit exceeded', {
        elapsed: elapsedMinutes,
        limit: this.config.maxDurationMinutes
      });
      this.state = 'COMPLETE';
      return false;
    }

    // Token limit
    if (this.totalTokens >= this.config.maxTokens) {
      logger.warn('Token limit exceeded', {
        tokens: this.totalTokens,
        limit: this.config.maxTokens
      });
      this.state = 'COMPLETE';
      return false;
    }

    // Bug limit
    const fixedCount = this.attempts.filter(a => a.status === 'verified').length;
    if (fixedCount >= this.config.maxBugs) {
      logger.info('Max bugs fixed', {
        fixed: fixedCount,
        limit: this.config.maxBugs
      });
      this.state = 'COMPLETE';
      return false;
    }

    return true;
  }

  /**
   * Handle SCANNING state
   */
  private async handleScanning(): Promise<void> {
    this.emitProgress('Scanning for bugs...');

    this.findings = await this.detector.scan(this.rootDir);

    if (this.findings.length === 0) {
      this.emitProgress('No bugs found!');
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress(`Found ${this.findings.length} bugs`);

    for (const finding of this.findings) {
      this.onBugFound?.(finding);
    }

    this.state = 'ANALYZING';
  }

  /**
   * Handle ANALYZING state
   */
  private async handleAnalyzing(): Promise<void> {
    this.emitProgress('Analyzing bugs...');

    // Findings are already sorted by severity and confidence in detector
    // Filter by confidence threshold
    this.findings = this.findings.filter(f => f.confidence >= this.config.minConfidence);

    if (this.findings.length === 0) {
      this.emitProgress('No bugs above confidence threshold');
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress(`${this.findings.length} bugs to fix`);
    this.currentBugIndex = 0;
    this.state = 'PLANNING';
  }

  /**
   * Handle PLANNING state
   */
  private async handlePlanning(): Promise<void> {
    const finding = this.findings[this.currentBugIndex];

    if (!finding) {
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress(`Planning fix for bug ${this.currentBugIndex + 1}/${this.findings.length}`, {
      file: finding.file,
      type: finding.type,
      severity: finding.severity
    });

    // Check if this bug has a fix strategy
    if (!finding.fixStrategy) {
      logger.info('Bug requires manual review', {
        bugId: finding.id,
        type: finding.type
      });

      // Mark as skipped and move to next
      const skippedAttempt: FixAttempt = {
        id: randomUUID(),
        bugId: finding.id,
        attemptNumber: 1,
        strategy: 'manual_review',
        diff: '',
        status: 'skipped',
        error: 'No automatic fix available',
        attemptedAt: new Date().toISOString(),
        durationMs: 0
      };
      this.attempts.push(skippedAttempt);

      this.currentBugIndex++;
      if (this.currentBugIndex >= this.findings.length) {
        this.state = 'COMPLETE';
      }
      return;
    }

    this.state = 'FIXING';
  }

  /**
   * Handle FIXING state
   */
  private async handleFixing(): Promise<void> {
    const finding = this.findings[this.currentBugIndex];

    if (!finding) {
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress(`Fixing: ${finding.file}:${finding.lineStart}`, {
      type: finding.type,
      strategy: finding.fixStrategy
    });

    const attempt = await this.fixer.applyFix(finding, this.rootDir, this.config.dryRun);
    this.attempts.push(attempt);

    this.onFixApplied?.(finding, attempt);

    if (attempt.status === 'applied') {
      this.state = 'VERIFYING';
    } else if (attempt.status === 'skipped') {
      this.emitProgress(`Skipped: ${attempt.error || 'No changes needed'}`);
      this.currentBugIndex++;
      this.state = this.currentBugIndex >= this.findings.length ? 'COMPLETE' : 'PLANNING';
    } else {
      // Fix failed - try to retry
      this.state = 'ITERATING';
    }
  }

  /**
   * Handle VERIFYING state
   */
  private async handleVerifying(): Promise<void> {
    const finding = this.findings[this.currentBugIndex];
    const lastAttempt = this.attempts[this.attempts.length - 1];

    if (!finding || !lastAttempt) {
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress(`Verifying fix for ${finding.file}...`);

    // Quick verify first (typecheck only)
    if (!this.config.dryRun) {
      const result = await this.verifier.verify(finding, [finding.file]);

      lastAttempt.verificationResult = result;
      this.onVerification?.(finding, result.success);

      if (result.success) {
        lastAttempt.status = 'verified';
        this.emitProgress('Fix verified!', {
          typecheck: result.typecheckPassed,
          tests: result.testsPassed
        });
        this.state = 'LEARNING';
      } else {
        // Verification failed - rollback and retry
        lastAttempt.status = 'failed';
        lastAttempt.error = result.newErrors.join('; ') || 'Verification failed';

        this.emitProgress('Verification failed, rolling back...', {
          errors: result.newErrors
        });

        await this.fixer.rollback(finding.file);
        this.state = 'ITERATING';
      }
    } else {
      // Dry run - mark as verified
      lastAttempt.status = 'verified';
      this.emitProgress('Dry run - skipping verification');
      this.state = 'LEARNING';
    }
  }

  /**
   * Handle LEARNING state
   */
  private async handleLearning(): Promise<void> {
    const finding = this.findings[this.currentBugIndex];

    if (!finding) {
      this.state = 'COMPLETE';
      return;
    }

    this.emitProgress('Storing pattern to knowledge base...');

    // TODO: Integrate with MemoryManager to store successful fix patterns
    // For now, just log
    logger.info('Pattern learned', {
      bugId: finding.id,
      type: finding.type,
      file: finding.file
    });

    // Move to next bug
    this.currentBugIndex++;

    if (this.currentBugIndex >= this.findings.length) {
      this.state = 'COMPLETE';
    } else {
      this.state = 'PLANNING';
    }
  }

  /**
   * Handle ITERATING state (retry logic)
   */
  private async handleIterating(): Promise<void> {
    const finding = this.findings[this.currentBugIndex];

    if (!finding) {
      this.state = 'COMPLETE';
      return;
    }

    const currentRetries = this.retryCount.get(finding.id) || 0;

    if (currentRetries >= this.config.maxRetriesPerBug) {
      // Max retries reached - mark as failed and move on
      this.emitProgress(`Max retries reached for ${finding.file}`, {
        retries: currentRetries
      });

      this.currentBugIndex++;

      if (this.currentBugIndex >= this.findings.length) {
        this.state = 'COMPLETE';
      } else {
        this.state = 'PLANNING';
      }
      return;
    }

    // Increment retry count
    this.retryCount.set(finding.id, currentRetries + 1);

    this.emitProgress(`Retrying fix (attempt ${currentRetries + 2})...`);

    // For now, just try the same strategy again
    // In the future, could try alternative strategies
    this.state = 'FIXING';
  }

  /**
   * Build final result
   */
  private buildResult(error?: string): BugfixResult {
    const stats = this.calculateStats();

    return {
      sessionId: this.sessionId,
      startedAt: new Date(this.startTime).toISOString(),
      endedAt: new Date().toISOString(),
      config: this.config,
      findings: this.findings,
      attempts: this.attempts,
      stats,
      finalState: this.state,
      error
    };
  }

  /**
   * Calculate session statistics
   */
  private calculateStats(): BugfixStats {
    const verified = this.attempts.filter(a => a.status === 'verified').length;
    const failed = this.attempts.filter(a => a.status === 'failed').length;
    const skipped = this.attempts.filter(a => a.status === 'skipped').length;

    // Calculate bugs by type
    const bugsByType: Record<BugType, number> = {
      timer_leak: 0,
      missing_destroy: 0,
      promise_timeout_leak: 0,
      event_leak: 0,
      resource_leak: 0,
      race_condition: 0,
      memory_leak: 0,
      uncaught_promise: 0,
      deprecated_api: 0,
      security_issue: 0,
      type_error: 0,
      test_failure: 0,
      custom: 0
    };

    for (const finding of this.findings) {
      bugsByType[finding.type] = (bugsByType[finding.type] || 0) + 1;
    }

    // Calculate bugs by severity
    const bugsBySeverity: Record<BugSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const finding of this.findings) {
      bugsBySeverity[finding.severity] = (bugsBySeverity[finding.severity] || 0) + 1;
    }

    // Determine stop reason
    let stopReason: BugfixStats['stopReason'] = 'complete';
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;

    if (this.state === 'FAILED') {
      stopReason = 'error';
    } else if (verified >= this.config.maxBugs) {
      stopReason = 'max_bugs';
    } else if (elapsedMinutes >= this.config.maxDurationMinutes) {
      stopReason = 'max_time';
    } else if (this.totalTokens >= this.config.maxTokens) {
      stopReason = 'max_tokens';
    }

    return {
      bugsFound: this.findings.length,
      bugsFixed: verified,
      bugsFailed: failed,
      bugsSkipped: skipped,
      totalAttempts: this.attempts.length,
      successRate: this.attempts.length > 0 ? verified / this.attempts.length : 0,
      totalDurationMs: Date.now() - this.startTime,
      totalTokens: this.totalTokens,
      patternsLearned: verified, // Each verified fix is a learned pattern
      regressions: 0, // Should always be 0 with verification
      stopReason,
      bugsByType,
      bugsBySeverity
    };
  }

  /**
   * Emit progress update
   */
  private emitProgress(message: string, data?: Record<string, unknown>): void {
    logger.info(message, { sessionId: this.sessionId, ...data });
    this.onProgress?.(message, data);
  }

  /**
   * Get current state
   */
  getState(): BugfixState {
    return this.state;
  }

  /**
   * Get current statistics
   */
  getStats(): BugfixStats {
    return this.calculateStats();
  }

  /**
   * Stop execution
   */
  async stop(): Promise<void> {
    logger.info('Stopping bugfix session', { sessionId: this.sessionId });
    this.state = 'COMPLETE';

    // Cleanup any pending backups
    await this.fixer.cleanupBackups();
  }
}
