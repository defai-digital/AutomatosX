/**
 * Refactor Controller
 * Main orchestrator for the autonomous refactoring workflow
 * @module core/refactor/refactor-controller
 * @version 12.7.0
 */

import { randomUUID } from 'crypto';
import type {
  RefactorConfig,
  RefactorState,
  RefactorFinding,
  RefactorAttempt,
  RefactorResult,
  RefactorStats,
  RefactorMetrics,
  RefactorControllerOptions,
  MetricImprovement,
  RefactorType,
  RefactorSeverity,
} from './types.js';
import { createDefaultRefactorConfig } from './types.js';
import { RefactorDetector } from './refactor-detector.js';
import { MetricsCollector } from './metrics-collector.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ROOT_DIR = process.cwd();

// ============================================================================
// RefactorController Class
// ============================================================================

export class RefactorController {
  private sessionId: string;
  private rootDir: string;
  private config: RefactorConfig;
  private state: RefactorState = 'IDLE';
  private startTime: Date;
  private findings: RefactorFinding[] = [];
  private attempts: RefactorAttempt[] = [];
  private metricsBefore: RefactorMetrics | null = null;
  private metricsAfter: RefactorMetrics | null = null;
  private currentIteration = 0;
  private stopReason = '';

  // Components
  private detector: RefactorDetector;
  private metricsCollector: MetricsCollector;

  // Callbacks
  private onProgress?: RefactorControllerOptions['onProgress'];
  private onFindingFound?: RefactorControllerOptions['onFindingFound'];
  private onRefactorApplied?: RefactorControllerOptions['onRefactorApplied'];
  private onVerification?: RefactorControllerOptions['onVerification'];

  constructor(options: RefactorControllerOptions = {}) {
    this.sessionId = randomUUID();
    this.rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    this.config = createDefaultRefactorConfig(options.config);
    this.startTime = new Date();

    // Set file filter if provided
    if (options.fileFilter) {
      this.config.fileFilter = options.fileFilter;
    }

    // Initialize components
    this.detector = new RefactorDetector(this.config);
    this.metricsCollector = new MetricsCollector(this.config.excludePatterns);

    // Register callbacks
    this.onProgress = options.onProgress;
    this.onFindingFound = options.onFindingFound;
    this.onRefactorApplied = options.onRefactorApplied;
    this.onVerification = options.onVerification;
  }

  /**
   * Execute the refactoring workflow
   */
  async execute(): Promise<RefactorResult> {
    this.startTime = new Date();
    this.state = 'IDLE';

    try {
      while (this.shouldContinue()) {
        await this.handleState();
      }
    } catch (error) {
      this.state = 'FAILED';
      this.stopReason = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress(`Workflow failed: ${this.stopReason}`);
    }

    return this.buildResult();
  }

  /**
   * Scan only - don't apply any changes
   */
  async scan(): Promise<{ findings: RefactorFinding[]; metrics: RefactorMetrics }> {
    // Collect metrics
    this.emitProgress('Collecting metrics...');
    const metrics = await this.metricsCollector.collect(this.rootDir);

    // Scan for findings
    this.emitProgress('Scanning for refactoring opportunities...');
    const findings = await this.detector.scan(this.rootDir, this.config.fileFilter);

    return { findings, metrics };
  }

  // ============================================================================
  // State Machine
  // ============================================================================

  private shouldContinue(): boolean {
    // Check terminal states
    if (this.state === 'COMPLETE' || this.state === 'FAILED') {
      return false;
    }

    // Check time limit
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / 1000 / 60;
    if (elapsedMinutes >= this.config.maxDurationMinutes) {
      this.stopReason = 'Time limit exceeded';
      this.state = 'COMPLETE';
      return false;
    }

    // Check iteration limit
    if (this.currentIteration >= this.config.maxIterations && this.state === 'ITERATING') {
      this.stopReason = 'Max iterations reached';
      this.state = 'COMPLETE';
      return false;
    }

    return true;
  }

  private async handleState(): Promise<void> {
    this.emitProgress(`State: ${this.state}`);

    switch (this.state) {
      case 'IDLE':
        this.state = 'COLLECTING_METRICS';
        break;

      case 'COLLECTING_METRICS':
        await this.handleCollectingMetrics();
        break;

      case 'SCANNING':
        await this.handleScanning();
        break;

      case 'ANALYZING':
        await this.handleAnalyzing();
        break;

      case 'PLANNING':
        await this.handlePlanning();
        break;

      case 'REFACTORING':
        await this.handleRefactoring();
        break;

      case 'VERIFYING':
        await this.handleVerifying();
        break;

      case 'COMPARING_METRICS':
        await this.handleComparingMetrics();
        break;

      case 'ITERATING':
        await this.handleIterating();
        break;

      default:
        this.state = 'FAILED';
        this.stopReason = `Unknown state: ${this.state}`;
    }
  }

  // ============================================================================
  // State Handlers
  // ============================================================================

  private async handleCollectingMetrics(): Promise<void> {
    this.emitProgress('Collecting baseline metrics...');

    try {
      this.metricsBefore = await this.metricsCollector.collect(this.rootDir);
      this.emitProgress('Baseline metrics collected', { metrics: this.metricsBefore });
      this.state = 'SCANNING';
    } catch (error) {
      this.state = 'FAILED';
      this.stopReason = `Failed to collect metrics: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleScanning(): Promise<void> {
    this.emitProgress('Scanning for refactoring opportunities...');

    try {
      this.findings = await this.detector.scan(this.rootDir, this.config.fileFilter);

      for (const finding of this.findings) {
        this.onFindingFound?.(finding);
      }

      this.emitProgress(`Found ${this.findings.length} opportunities`, {
        count: this.findings.length,
        byType: this.groupByType(this.findings),
      });

      if (this.findings.length === 0) {
        this.stopReason = 'No refactoring opportunities found';
        this.state = 'COMPLETE';
      } else {
        this.state = 'ANALYZING';
      }
    } catch (error) {
      this.state = 'FAILED';
      this.stopReason = `Scanning failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleAnalyzing(): Promise<void> {
    this.emitProgress('Analyzing findings...');

    // Filter findings based on configuration
    const filteredFindings = this.findings.filter((f) => {
      // Check confidence threshold
      if (f.confidence < this.config.minConfidence) return false;

      // Check if LLM is required but disabled
      if (!this.config.useLLMForRefactoring) {
        const rules = this.detector.getRules().get(f.type);
        const rule = rules?.find((r) => r.id === f.ruleId);
        if (rule?.requiresLLM) return false;
      }

      return true;
    });

    this.findings = filteredFindings;
    this.emitProgress(`${this.findings.length} findings after filtering`);

    if (this.findings.length === 0) {
      this.stopReason = 'No actionable findings after filtering';
      this.state = 'COMPLETE';
    } else {
      this.state = 'PLANNING';
    }
  }

  private async handlePlanning(): Promise<void> {
    this.emitProgress('Planning refactoring...');

    // Group findings by file to respect maxChangesPerFile
    const findingsByFile = new Map<string, RefactorFinding[]>();
    for (const finding of this.findings) {
      if (!findingsByFile.has(finding.file)) {
        findingsByFile.set(finding.file, []);
      }
      findingsByFile.get(finding.file)!.push(finding);
    }

    // Limit findings per file
    const plannedFindings: RefactorFinding[] = [];
    for (const [file, fileFindings] of findingsByFile) {
      const limited = fileFindings.slice(0, this.config.maxChangesPerFile);
      plannedFindings.push(...limited);
    }

    this.findings = plannedFindings;
    this.emitProgress(`Planned ${this.findings.length} refactorings`);

    if (this.config.dryRun) {
      this.stopReason = 'Dry run - no changes applied';
      this.state = 'COMPLETE';
    } else {
      this.state = 'REFACTORING';
    }
  }

  private async handleRefactoring(): Promise<void> {
    this.emitProgress('Applying refactorings...');

    // For now, we only report findings (LLM integration would be Phase 3)
    // This implements the scan-and-report functionality

    for (const finding of this.findings) {
      const attempt: RefactorAttempt = {
        id: randomUUID(),
        findingId: finding.id,
        status: 'skipped',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      };

      // Without LLM, we can only auto-fix certain patterns
      if (!this.config.useLLMForRefactoring) {
        attempt.status = 'skipped';
        attempt.error = 'LLM disabled - manual fix required';
      } else {
        // TODO: Phase 3 - LLM-based refactoring
        attempt.status = 'skipped';
        attempt.error = 'LLM refactoring not yet implemented';
      }

      this.attempts.push(attempt);
    }

    this.state = 'VERIFYING';
  }

  private async handleVerifying(): Promise<void> {
    this.emitProgress('Verifying changes...');

    // Run TypeScript typecheck if required
    if (this.config.requireTypecheck) {
      const typecheckResult = await this.runTypecheck();
      if (!typecheckResult.success) {
        this.emitProgress('Typecheck failed - would rollback in full implementation');
      }
    }

    // Run tests if required
    if (this.config.requireTests) {
      const testResult = await this.runTests();
      if (!testResult.success) {
        this.emitProgress('Tests failed - would rollback in full implementation');
      }
    }

    this.state = 'COMPARING_METRICS';
  }

  private async handleComparingMetrics(): Promise<void> {
    this.emitProgress('Comparing metrics...');

    try {
      this.metricsAfter = await this.metricsCollector.collect(this.rootDir);

      if (this.metricsBefore && this.metricsAfter) {
        const improvements = MetricsCollector.compareMetrics(
          this.metricsBefore,
          this.metricsAfter,
          this.config.minImprovementThreshold
        );

        const hasImprovement = MetricsCollector.hasOverallImprovement(improvements);

        this.emitProgress('Metrics comparison complete', {
          improved: hasImprovement,
          improvements: improvements.filter((i) => i.improvementPercent !== 0),
        });
      }

      // Check if we should iterate
      if (this.currentIteration < this.config.maxIterations - 1) {
        this.state = 'ITERATING';
      } else {
        this.stopReason = 'Refactoring complete';
        this.state = 'COMPLETE';
      }
    } catch (error) {
      this.emitProgress(`Metrics comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.state = 'COMPLETE';
    }
  }

  private async handleIterating(): Promise<void> {
    this.currentIteration++;
    this.emitProgress(`Starting iteration ${this.currentIteration + 1}`);

    // Clear findings for next iteration
    this.findings = [];

    // Go back to scanning
    this.state = 'SCANNING';
  }

  // ============================================================================
  // Verification Helpers
  // ============================================================================

  private async runTypecheck(): Promise<{ success: boolean; errors: string[] }> {
    // Simplified typecheck - in production would use tsc
    try {
      const { execSync } = await import('child_process');
      execSync('npx tsc --noEmit', {
        cwd: this.rootDir,
        stdio: 'pipe',
        timeout: 60000,
      });
      return { success: true, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, errors: [message] };
    }
  }

  private async runTests(): Promise<{ success: boolean; failed: string[] }> {
    // Simplified test run - in production would use vitest/jest
    try {
      const { execSync } = await import('child_process');
      execSync('npm test --if-present', {
        cwd: this.rootDir,
        stdio: 'pipe',
        timeout: 120000,
      });
      return { success: true, failed: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, failed: [message] };
    }
  }

  // ============================================================================
  // Result Building
  // ============================================================================

  private buildResult(): RefactorResult {
    const endTime = new Date();

    // Calculate stats
    const stats = this.calculateStats();

    // Calculate improvements
    const improvements: MetricImprovement[] =
      this.metricsBefore && this.metricsAfter
        ? MetricsCollector.compareMetrics(
            this.metricsBefore,
            this.metricsAfter,
            this.config.minImprovementThreshold
          )
        : [];

    return {
      sessionId: this.sessionId,
      startedAt: this.startTime.toISOString(),
      endedAt: endTime.toISOString(),
      config: this.config,
      findings: this.findings,
      attempts: this.attempts,
      metricsBefore: this.metricsBefore || this.createEmptyMetrics(),
      metricsAfter: this.metricsAfter || this.createEmptyMetrics(),
      improvements,
      stats,
      finalState: this.state,
    };
  }

  private calculateStats(): RefactorStats {
    const successfulAttempts = this.attempts.filter((a) => a.status === 'success');
    const failedAttempts = this.attempts.filter((a) => a.status === 'failed');
    const skippedAttempts = this.attempts.filter((a) => a.status === 'skipped');

    const opportunitiesByType: Record<RefactorType, number> = {
      duplication: 0,
      readability: 0,
      performance: 0,
      hardcoded_values: 0,
      naming: 0,
      conditionals: 0,
      dead_code: 0,
      type_safety: 0,
    };

    const opportunitiesBySeverity: Record<RefactorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const finding of this.findings) {
      opportunitiesByType[finding.type]++;
      opportunitiesBySeverity[finding.severity]++;
    }

    return {
      opportunitiesFound: this.findings.length,
      refactorsApplied: successfulAttempts.length,
      refactorsFailed: failedAttempts.length,
      refactorsSkipped: skippedAttempts.length,
      totalAttempts: this.attempts.length,
      successRate:
        this.attempts.length > 0
          ? successfulAttempts.length / this.attempts.length
          : 0,
      totalDurationMs: Date.now() - this.startTime.getTime(),
      complexityReduced: this.calculateComplexityReduction(),
      duplicationRemoved: this.calculateDuplicationRemoved(),
      maintainabilityImproved: this.calculateMaintainabilityImprovement(),
      linesRemoved: this.calculateLinesRemoved(),
      stopReason: this.stopReason,
      opportunitiesByType,
      opportunitiesBySeverity,
      iterationsCompleted: this.currentIteration,
    };
  }

  private calculateComplexityReduction(): number {
    if (!this.metricsBefore || !this.metricsAfter) return 0;
    return Math.max(
      0,
      this.metricsBefore.avgCyclomaticComplexity - this.metricsAfter.avgCyclomaticComplexity
    );
  }

  private calculateDuplicationRemoved(): number {
    if (!this.metricsBefore || !this.metricsAfter) return 0;
    return Math.max(
      0,
      this.metricsBefore.duplicationPercentage - this.metricsAfter.duplicationPercentage
    );
  }

  private calculateMaintainabilityImprovement(): number {
    if (!this.metricsBefore || !this.metricsAfter) return 0;
    return Math.max(
      0,
      this.metricsAfter.maintainabilityIndex - this.metricsBefore.maintainabilityIndex
    );
  }

  private calculateLinesRemoved(): number {
    if (!this.metricsBefore || !this.metricsAfter) return 0;
    return Math.max(0, this.metricsBefore.linesOfCode - this.metricsAfter.linesOfCode);
  }

  private createEmptyMetrics(): RefactorMetrics {
    return {
      linesOfCode: 0,
      numberOfFunctions: 0,
      numberOfClasses: 0,
      avgCyclomaticComplexity: 0,
      maxCyclomaticComplexity: 0,
      avgCognitiveComplexity: 0,
      maxCognitiveComplexity: 0,
      duplicationPercentage: 0,
      maintainabilityIndex: 0,
      maxNestingDepth: 0,
      avgNestingDepth: 0,
      anyTypeCount: 0,
      unusedExports: 0,
      unusedImports: 0,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private groupByType(findings: RefactorFinding[]): Record<RefactorType, number> {
    const result: Record<RefactorType, number> = {
      duplication: 0,
      readability: 0,
      performance: 0,
      hardcoded_values: 0,
      naming: 0,
      conditionals: 0,
      dead_code: 0,
      type_safety: 0,
    };

    for (const finding of findings) {
      result[finding.type]++;
    }

    return result;
  }

  private emitProgress(message: string, data?: Record<string, unknown>): void {
    this.onProgress?.(this.state, message, data);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getState(): RefactorState {
    return this.state;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getConfig(): RefactorConfig {
    return this.config;
  }
}

export default RefactorController;
