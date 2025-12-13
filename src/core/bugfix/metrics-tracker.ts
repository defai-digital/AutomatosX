/**
 * Bugfix Metrics Tracker
 *
 * Tracks detection and fix metrics for quality measurement.
 * Stores metrics in SQLite for persistence across sessions.
 *
 * v12.9.0: PRD-018 - Metrics tracking implementation
 * v12.9.0: PRD-020 - LLM Triage metrics tracking
 *
 * @module core/bugfix/metrics-tracker
 * @since v12.9.0
 * @updated v12.9.0 - Added triage metrics (PRD-020)
 */

import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import type { BugFinding, BugType, BugSeverity } from './types.js';
import type { TriageMetrics, TriageResult } from './llm-triage/types.js';

// Lazy-load better-sqlite3 to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;

/**
 * Metrics entry for a single detection
 */
export interface DetectionMetric {
  id: number;
  ruleId: string;
  bugType: BugType;
  file: string;
  line: number;
  confidence: number;
  detectionMethod: 'regex' | 'ast';
  severity: BugSeverity;
  /** Was this a false positive? null = not yet classified */
  isFalsePositive: boolean | null;
  /** Was the fix successful? */
  fixSuccessful: boolean | null;
  /** User feedback */
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Aggregated metrics by rule
 */
export interface RuleMetrics {
  ruleId: string;
  bugType: BugType;
  totalDetections: number;
  truePositives: number;
  falsePositives: number;
  unclassified: number;
  fixesAttempted: number;
  fixesSuccessful: number;
  averageConfidence: number;
  /** Precision = TP / (TP + FP) */
  precision: number;
  /** Recall is harder to measure without a ground truth dataset */
  lastUpdated: string;
}

/**
 * Aggregated metrics summary
 */
export interface MetricsSummary {
  totalDetections: number;
  totalTruePositives: number;
  totalFalsePositives: number;
  totalUnclassified: number;
  overallPrecision: number;
  byRule: RuleMetrics[];
  byType: Record<BugType, {
    detections: number;
    truePositives: number;
    falsePositives: number;
    precision: number;
  }>;
  bySeverity: Record<BugSeverity, number>;
  recentFalsePositives: DetectionMetric[];
}

/**
 * Triage run record stored in database (v12.9.0)
 *
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */
export interface TriageRunRecord {
  id: number;
  sessionId: string;
  findingsTotal: number;
  findingsTriaged: number;
  findingsAccepted: number;
  findingsRejected: number;
  findingsSkipped: number;
  findingsFallback: number;
  llmRequests: number;
  llmTokensUsed: number;
  llmCostEstimateUsd: number;
  triageDurationMs: number;
  provider: string;
  createdAt: string;
}

/**
 * Triage summary for reports (v12.9.0)
 *
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */
export interface TriageSummary {
  enabled: boolean;
  provider?: string;
  findingsTotal: number;
  findingsTriaged: number;
  findingsAccepted: number;
  findingsRejected: number;
  findingsSkipped: number;
  findingsFallback: number;
  llmRequests: number;
  llmTokensUsed: number;
  llmCostEstimateUsd: number;
  triageDurationMs: number;
  /** Precision improvement from triage (false positives removed / total triaged) */
  precisionImprovement?: number;
}

/**
 * Metrics database schema version
 * v1: Initial schema (detection_metrics)
 * v2: Added triage_runs table and LLM columns (PRD-020)
 */
const SCHEMA_VERSION = 2;

/**
 * MetricsTracker class
 *
 * Provides metrics tracking for bug detection accuracy.
 */
export class MetricsTracker {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;
  private dbPath: string;
  private initialized = false;

  constructor(dataDir?: string) {
    const baseDir = dataDir || join(process.cwd(), '.automatosx');
    this.dbPath = join(baseDir, 'bugfix-metrics.db');
  }

  /**
   * Initialize the database connection and schema
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Lazy load better-sqlite3
      if (!Database) {
        const module = await import('better-sqlite3');
        Database = module.default;
      }

      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 5000');

      // Create schema
      this.createSchema();

      this.initialized = true;
      logger.debug('MetricsTracker initialized', { dbPath: this.dbPath });
    } catch (error) {
      logger.warn('Failed to initialize MetricsTracker', {
        error: (error as Error).message
      });
      // Continue without metrics tracking
    }
  }

  /**
   * Create database schema
   */
  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS detection_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        bug_type TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        confidence REAL NOT NULL,
        detection_method TEXT NOT NULL,
        severity TEXT NOT NULL,
        is_false_positive INTEGER,
        fix_successful INTEGER,
        feedback TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        -- v12.9.0: LLM triage columns (PRD-020)
        llm_triaged INTEGER DEFAULT NULL,
        llm_accepted INTEGER DEFAULT NULL,
        llm_confidence REAL DEFAULT NULL,
        llm_reason TEXT DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_rule ON detection_metrics(rule_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON detection_metrics(bug_type);
      CREATE INDEX IF NOT EXISTS idx_metrics_fp ON detection_metrics(is_false_positive);
      CREATE INDEX IF NOT EXISTS idx_metrics_created ON detection_metrics(created_at);

      -- v12.9.0: Triage runs table (PRD-020)
      CREATE TABLE IF NOT EXISTS triage_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        findings_total INTEGER NOT NULL,
        findings_triaged INTEGER NOT NULL,
        findings_accepted INTEGER NOT NULL,
        findings_rejected INTEGER NOT NULL,
        findings_skipped INTEGER NOT NULL,
        findings_fallback INTEGER NOT NULL DEFAULT 0,
        llm_requests INTEGER NOT NULL,
        llm_tokens_used INTEGER DEFAULT 0,
        llm_cost_estimate_usd REAL DEFAULT 0,
        triage_duration_ms INTEGER NOT NULL,
        provider TEXT DEFAULT 'claude',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_triage_session ON triage_runs(session_id);
      CREATE INDEX IF NOT EXISTS idx_triage_created ON triage_runs(created_at);
    `);

    // Check/update schema version
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get();
    if (!versionRow) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    } else {
      // Run migrations if needed
      this.runMigrations((versionRow as { version: number }).version);
    }
  }

  /**
   * Run schema migrations
   */
  private runMigrations(currentVersion: number): void {
    if (currentVersion < 2) {
      // Migrate to v2: Add LLM triage columns and table
      logger.info('Migrating metrics schema to v2 (PRD-020 triage support)');

      try {
        // Add LLM columns to detection_metrics (SQLite doesn't support IF NOT EXISTS for columns)
        const columns = this.db.prepare("PRAGMA table_info(detection_metrics)").all() as Array<{ name: string }>;
        const columnNames = new Set(columns.map(c => c.name));

        if (!columnNames.has('llm_triaged')) {
          this.db.exec('ALTER TABLE detection_metrics ADD COLUMN llm_triaged INTEGER DEFAULT NULL');
        }
        if (!columnNames.has('llm_accepted')) {
          this.db.exec('ALTER TABLE detection_metrics ADD COLUMN llm_accepted INTEGER DEFAULT NULL');
        }
        if (!columnNames.has('llm_confidence')) {
          this.db.exec('ALTER TABLE detection_metrics ADD COLUMN llm_confidence REAL DEFAULT NULL');
        }
        if (!columnNames.has('llm_reason')) {
          this.db.exec('ALTER TABLE detection_metrics ADD COLUMN llm_reason TEXT DEFAULT NULL');
        }

        // Create triage_runs table (IF NOT EXISTS handles this)
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS triage_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            findings_total INTEGER NOT NULL,
            findings_triaged INTEGER NOT NULL,
            findings_accepted INTEGER NOT NULL,
            findings_rejected INTEGER NOT NULL,
            findings_skipped INTEGER NOT NULL,
            findings_fallback INTEGER NOT NULL DEFAULT 0,
            llm_requests INTEGER NOT NULL,
            llm_tokens_used INTEGER DEFAULT 0,
            llm_cost_estimate_usd REAL DEFAULT 0,
            triage_duration_ms INTEGER NOT NULL,
            provider TEXT DEFAULT 'claude',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_triage_session ON triage_runs(session_id);
          CREATE INDEX IF NOT EXISTS idx_triage_created ON triage_runs(created_at);
        `);

        // Update schema version
        this.db.prepare('UPDATE schema_version SET version = ?').run(2);

        logger.info('Schema migration to v2 complete');
      } catch (error) {
        logger.warn('Schema migration failed (may already be at v2)', {
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Record a bug detection
   */
  recordDetection(finding: BugFinding): number {
    if (!this.initialized || !this.db) {
      logger.debug('MetricsTracker not initialized, skipping recordDetection');
      return -1;
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO detection_metrics (
          rule_id, bug_type, file, line, confidence,
          detection_method, severity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const ruleId = (finding.metadata?.ruleId as string) || 'unknown';
      const result = stmt.run(
        ruleId,
        finding.type,
        finding.file,
        finding.lineStart,
        finding.confidence,
        finding.detectionMethod || 'regex',
        finding.severity
      );

      logger.debug('Detection metric recorded', {
        id: result.lastInsertRowid,
        ruleId,
        type: finding.type
      });

      return Number(result.lastInsertRowid);
    } catch (error) {
      logger.warn('Failed to record detection metric', {
        error: (error as Error).message
      });
      return -1;
    }
  }

  /**
   * Mark a detection as false positive
   */
  markFalsePositive(metricId: number, feedback?: string): void {
    if (!this.initialized || !this.db) return;

    try {
      this.db.prepare(`
        UPDATE detection_metrics
        SET is_false_positive = 1, feedback = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(feedback || null, metricId);

      logger.debug('Marked as false positive', { metricId, feedback });
    } catch (error) {
      logger.warn('Failed to mark false positive', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Mark a detection as true positive
   */
  markTruePositive(metricId: number): void {
    if (!this.initialized || !this.db) return;

    try {
      this.db.prepare(`
        UPDATE detection_metrics
        SET is_false_positive = 0, updated_at = datetime('now')
        WHERE id = ?
      `).run(metricId);

      logger.debug('Marked as true positive', { metricId });
    } catch (error) {
      logger.warn('Failed to mark true positive', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Record fix result
   */
  recordFixResult(metricId: number, successful: boolean): void {
    if (!this.initialized || !this.db) return;

    try {
      this.db.prepare(`
        UPDATE detection_metrics
        SET fix_successful = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(successful ? 1 : 0, metricId);

      logger.debug('Fix result recorded', { metricId, successful });
    } catch (error) {
      logger.warn('Failed to record fix result', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get aggregated metrics summary
   */
  getSummary(): MetricsSummary | null {
    if (!this.initialized || !this.db) return null;

    try {
      // Overall totals
      const totals = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_false_positive = 0 THEN 1 ELSE 0 END) as true_positives,
          SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as false_positives,
          SUM(CASE WHEN is_false_positive IS NULL THEN 1 ELSE 0 END) as unclassified
        FROM detection_metrics
      `).get() as { total: number; true_positives: number; false_positives: number; unclassified: number };

      // By rule
      const byRule = this.db.prepare(`
        SELECT
          rule_id,
          bug_type,
          COUNT(*) as total_detections,
          SUM(CASE WHEN is_false_positive = 0 THEN 1 ELSE 0 END) as true_positives,
          SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as false_positives,
          SUM(CASE WHEN is_false_positive IS NULL THEN 1 ELSE 0 END) as unclassified,
          SUM(CASE WHEN fix_successful IS NOT NULL THEN 1 ELSE 0 END) as fixes_attempted,
          SUM(CASE WHEN fix_successful = 1 THEN 1 ELSE 0 END) as fixes_successful,
          AVG(confidence) as avg_confidence,
          MAX(updated_at) as last_updated
        FROM detection_metrics
        GROUP BY rule_id
      `).all() as Array<{
        rule_id: string;
        bug_type: string;
        total_detections: number;
        true_positives: number;
        false_positives: number;
        unclassified: number;
        fixes_attempted: number;
        fixes_successful: number;
        avg_confidence: number;
        last_updated: string;
      }>;

      // By type
      const byTypeRows = this.db.prepare(`
        SELECT
          bug_type,
          COUNT(*) as detections,
          SUM(CASE WHEN is_false_positive = 0 THEN 1 ELSE 0 END) as true_positives,
          SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as false_positives
        FROM detection_metrics
        GROUP BY bug_type
      `).all() as Array<{
        bug_type: string;
        detections: number;
        true_positives: number;
        false_positives: number;
      }>;

      // By severity
      const bySeverityRows = this.db.prepare(`
        SELECT severity, COUNT(*) as count
        FROM detection_metrics
        GROUP BY severity
      `).all() as Array<{ severity: string; count: number }>;

      // Recent false positives
      const recentFP = this.db.prepare(`
        SELECT * FROM detection_metrics
        WHERE is_false_positive = 1
        ORDER BY updated_at DESC
        LIMIT 10
      `).all() as Array<{
        id: number;
        rule_id: string;
        bug_type: string;
        file: string;
        line: number;
        confidence: number;
        detection_method: string;
        severity: string;
        is_false_positive: number;
        fix_successful: number | null;
        feedback: string | null;
        created_at: string;
        updated_at: string;
      }>;

      // Calculate precision
      const totalClassified = totals.true_positives + totals.false_positives;
      const overallPrecision = totalClassified > 0
        ? totals.true_positives / totalClassified
        : 1.0;

      // Build byType map
      const byType: Record<BugType, { detections: number; truePositives: number; falsePositives: number; precision: number }> = {} as Record<BugType, { detections: number; truePositives: number; falsePositives: number; precision: number }>;
      for (const row of byTypeRows) {
        const classified = row.true_positives + row.false_positives;
        byType[row.bug_type as BugType] = {
          detections: row.detections,
          truePositives: row.true_positives,
          falsePositives: row.false_positives,
          precision: classified > 0 ? row.true_positives / classified : 1.0
        };
      }

      // Build bySeverity map
      const bySeverity: Record<BugSeverity, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      };
      for (const row of bySeverityRows) {
        bySeverity[row.severity as BugSeverity] = row.count;
      }

      // Build byRule array
      const ruleMetrics: RuleMetrics[] = byRule.map(row => {
        const classified = row.true_positives + row.false_positives;
        return {
          ruleId: row.rule_id,
          bugType: row.bug_type as BugType,
          totalDetections: row.total_detections,
          truePositives: row.true_positives,
          falsePositives: row.false_positives,
          unclassified: row.unclassified,
          fixesAttempted: row.fixes_attempted,
          fixesSuccessful: row.fixes_successful,
          averageConfidence: row.avg_confidence,
          precision: classified > 0 ? row.true_positives / classified : 1.0,
          lastUpdated: row.last_updated
        };
      });

      // Build recentFalsePositives array
      const recentFalsePositives: DetectionMetric[] = recentFP.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        bugType: row.bug_type as BugType,
        file: row.file,
        line: row.line,
        confidence: row.confidence,
        detectionMethod: row.detection_method as 'regex' | 'ast',
        severity: row.severity as BugSeverity,
        isFalsePositive: row.is_false_positive === 1,
        fixSuccessful: row.fix_successful === null ? null : row.fix_successful === 1,
        feedback: row.feedback || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        totalDetections: totals.total,
        totalTruePositives: totals.true_positives,
        totalFalsePositives: totals.false_positives,
        totalUnclassified: totals.unclassified,
        overallPrecision,
        byRule: ruleMetrics,
        byType,
        bySeverity,
        recentFalsePositives
      };
    } catch (error) {
      logger.warn('Failed to get metrics summary', {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Get metrics for a specific rule
   */
  getRuleMetrics(ruleId: string): RuleMetrics | null {
    if (!this.initialized || !this.db) return null;

    try {
      const row = this.db.prepare(`
        SELECT
          rule_id,
          bug_type,
          COUNT(*) as total_detections,
          SUM(CASE WHEN is_false_positive = 0 THEN 1 ELSE 0 END) as true_positives,
          SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as false_positives,
          SUM(CASE WHEN is_false_positive IS NULL THEN 1 ELSE 0 END) as unclassified,
          SUM(CASE WHEN fix_successful IS NOT NULL THEN 1 ELSE 0 END) as fixes_attempted,
          SUM(CASE WHEN fix_successful = 1 THEN 1 ELSE 0 END) as fixes_successful,
          AVG(confidence) as avg_confidence,
          MAX(updated_at) as last_updated
        FROM detection_metrics
        WHERE rule_id = ?
        GROUP BY rule_id
      `).get(ruleId) as {
        rule_id: string;
        bug_type: string;
        total_detections: number;
        true_positives: number;
        false_positives: number;
        unclassified: number;
        fixes_attempted: number;
        fixes_successful: number;
        avg_confidence: number;
        last_updated: string;
      } | undefined;

      if (!row) return null;

      const classified = row.true_positives + row.false_positives;

      return {
        ruleId: row.rule_id,
        bugType: row.bug_type as BugType,
        totalDetections: row.total_detections,
        truePositives: row.true_positives,
        falsePositives: row.false_positives,
        unclassified: row.unclassified,
        fixesAttempted: row.fixes_attempted,
        fixesSuccessful: row.fixes_successful,
        averageConfidence: row.avg_confidence,
        precision: classified > 0 ? row.true_positives / classified : 1.0,
        lastUpdated: row.last_updated
      };
    } catch (error) {
      logger.warn('Failed to get rule metrics', {
        error: (error as Error).message,
        ruleId
      });
      return null;
    }
  }

  /**
   * Find a detection metric by file and line
   */
  findByLocation(file: string, line: number): DetectionMetric | null {
    if (!this.initialized || !this.db) return null;

    try {
      const row = this.db.prepare(`
        SELECT * FROM detection_metrics
        WHERE file = ? AND line = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(file, line) as {
        id: number;
        rule_id: string;
        bug_type: string;
        file: string;
        line: number;
        confidence: number;
        detection_method: string;
        severity: string;
        is_false_positive: number | null;
        fix_successful: number | null;
        feedback: string | null;
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!row) return null;

      return {
        id: row.id,
        ruleId: row.rule_id,
        bugType: row.bug_type as BugType,
        file: row.file,
        line: row.line,
        confidence: row.confidence,
        detectionMethod: row.detection_method as 'regex' | 'ast',
        severity: row.severity as BugSeverity,
        isFalsePositive: row.is_false_positive === null ? null : row.is_false_positive === 1,
        fixSuccessful: row.fix_successful === null ? null : row.fix_successful === 1,
        feedback: row.feedback || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.warn('Failed to find metric by location', {
        error: (error as Error).message,
        file,
        line
      });
      return null;
    }
  }

  // ==========================================================================
  // v12.9.0: LLM Triage Metrics (PRD-020)
  // ==========================================================================

  /**
   * Record triage results for a bugfix session (v12.9.0)
   *
   * Stores both the triage run summary and updates individual detection metrics
   * with LLM verdict information.
   *
   * @param sessionId - Bugfix session ID
   * @param metrics - Triage metrics from LLMTriageFilter
   * @param results - Individual triage results
   * @param provider - LLM provider used (claude, gemini, openai)
   * @returns Record ID or -1 on failure
   *
   * @since v12.9.0
   * @see PRD-020: LLM Triage Filter for Bugfix Tool
   */
  recordTriageResults(
    sessionId: string,
    metrics: TriageMetrics,
    results: TriageResult[],
    provider: string = 'claude'
  ): number {
    if (!this.initialized || !this.db) {
      logger.debug('MetricsTracker not initialized, skipping recordTriageResults');
      return -1;
    }

    try {
      // Insert triage run summary
      const stmt = this.db.prepare(`
        INSERT INTO triage_runs (
          session_id, findings_total, findings_triaged, findings_accepted,
          findings_rejected, findings_skipped, findings_fallback,
          llm_requests, llm_tokens_used, llm_cost_estimate_usd,
          triage_duration_ms, provider
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionId,
        metrics.findingsTotal,
        metrics.findingsTriaged,
        metrics.findingsAccepted,
        metrics.findingsRejected,
        metrics.findingsSkipped,
        metrics.findingsFallback,
        metrics.llmRequests,
        metrics.llmTokensUsed,
        metrics.llmCostEstimateUsd,
        metrics.triageDurationMs,
        provider
      );

      const triageRunId = Number(result.lastInsertRowid);

      logger.debug('Triage run recorded', {
        id: triageRunId,
        sessionId,
        findingsTotal: metrics.findingsTotal,
        rejected: metrics.findingsRejected,
        provider
      });

      // Update individual detection metrics with LLM verdicts
      for (const triageResult of results) {
        if (triageResult.verdict) {
          this.updateDetectionWithTriageVerdict(
            triageResult.original.file,
            triageResult.original.lineStart,
            triageResult.verdict.accepted,
            triageResult.verdict.confidence,
            triageResult.verdict.reason
          );
        }
      }

      return triageRunId;
    } catch (error) {
      logger.warn('Failed to record triage results', {
        error: (error as Error).message,
        sessionId
      });
      return -1;
    }
  }

  /**
   * Update a detection metric with LLM triage verdict (v12.9.0)
   *
   * @private
   */
  private updateDetectionWithTriageVerdict(
    file: string,
    line: number,
    accepted: boolean,
    confidence: number,
    reason?: string
  ): void {
    try {
      this.db.prepare(`
        UPDATE detection_metrics
        SET llm_triaged = 1,
            llm_accepted = ?,
            llm_confidence = ?,
            llm_reason = ?,
            updated_at = datetime('now')
        WHERE file = ? AND line = ?
      `).run(
        accepted ? 1 : 0,
        confidence,
        reason || null,
        file,
        line
      );
    } catch (error) {
      logger.debug('Failed to update detection with triage verdict', {
        error: (error as Error).message,
        file,
        line
      });
    }
  }

  /**
   * Get triage run by session ID (v12.9.0)
   *
   * @param sessionId - Bugfix session ID
   * @returns Triage run record or null
   *
   * @since v12.9.0
   */
  getTriageRun(sessionId: string): TriageRunRecord | null {
    if (!this.initialized || !this.db) return null;

    try {
      const row = this.db.prepare(`
        SELECT * FROM triage_runs WHERE session_id = ? ORDER BY id DESC LIMIT 1
      `).get(sessionId) as {
        id: number;
        session_id: string;
        findings_total: number;
        findings_triaged: number;
        findings_accepted: number;
        findings_rejected: number;
        findings_skipped: number;
        findings_fallback: number;
        llm_requests: number;
        llm_tokens_used: number;
        llm_cost_estimate_usd: number;
        triage_duration_ms: number;
        provider: string;
        created_at: string;
      } | undefined;

      if (!row) return null;

      return {
        id: row.id,
        sessionId: row.session_id,
        findingsTotal: row.findings_total,
        findingsTriaged: row.findings_triaged,
        findingsAccepted: row.findings_accepted,
        findingsRejected: row.findings_rejected,
        findingsSkipped: row.findings_skipped,
        findingsFallback: row.findings_fallback,
        llmRequests: row.llm_requests,
        llmTokensUsed: row.llm_tokens_used,
        llmCostEstimateUsd: row.llm_cost_estimate_usd,
        triageDurationMs: row.triage_duration_ms,
        provider: row.provider,
        createdAt: row.created_at
      };
    } catch (error) {
      logger.warn('Failed to get triage run', {
        error: (error as Error).message,
        sessionId
      });
      return null;
    }
  }

  /**
   * Get recent triage runs (v12.9.0)
   *
   * @param limit - Maximum number of runs to return (default 10)
   * @returns Array of triage run records
   *
   * @since v12.9.0
   */
  getRecentTriageRuns(limit: number = 10): TriageRunRecord[] {
    if (!this.initialized || !this.db) return [];

    try {
      const rows = this.db.prepare(`
        SELECT * FROM triage_runs ORDER BY created_at DESC LIMIT ?
      `).all(limit) as Array<{
        id: number;
        session_id: string;
        findings_total: number;
        findings_triaged: number;
        findings_accepted: number;
        findings_rejected: number;
        findings_skipped: number;
        findings_fallback: number;
        llm_requests: number;
        llm_tokens_used: number;
        llm_cost_estimate_usd: number;
        triage_duration_ms: number;
        provider: string;
        created_at: string;
      }>;

      return rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        findingsTotal: row.findings_total,
        findingsTriaged: row.findings_triaged,
        findingsAccepted: row.findings_accepted,
        findingsRejected: row.findings_rejected,
        findingsSkipped: row.findings_skipped,
        findingsFallback: row.findings_fallback,
        llmRequests: row.llm_requests,
        llmTokensUsed: row.llm_tokens_used,
        llmCostEstimateUsd: row.llm_cost_estimate_usd,
        triageDurationMs: row.triage_duration_ms,
        provider: row.provider,
        createdAt: row.created_at
      }));
    } catch (error) {
      logger.warn('Failed to get recent triage runs', {
        error: (error as Error).message
      });
      return [];
    }
  }

  /**
   * Get triage summary statistics (v12.9.0)
   *
   * @returns Summary of all triage runs
   *
   * @since v12.9.0
   */
  getTriageSummary(): TriageSummary | null {
    if (!this.initialized || !this.db) return null;

    try {
      const row = this.db.prepare(`
        SELECT
          COUNT(*) as run_count,
          SUM(findings_total) as total_findings,
          SUM(findings_triaged) as total_triaged,
          SUM(findings_accepted) as total_accepted,
          SUM(findings_rejected) as total_rejected,
          SUM(findings_skipped) as total_skipped,
          SUM(findings_fallback) as total_fallback,
          SUM(llm_requests) as total_requests,
          SUM(llm_tokens_used) as total_tokens,
          SUM(llm_cost_estimate_usd) as total_cost,
          SUM(triage_duration_ms) as total_duration
        FROM triage_runs
      `).get() as {
        run_count: number;
        total_findings: number | null;
        total_triaged: number | null;
        total_accepted: number | null;
        total_rejected: number | null;
        total_skipped: number | null;
        total_fallback: number | null;
        total_requests: number | null;
        total_tokens: number | null;
        total_cost: number | null;
        total_duration: number | null;
      };

      if (!row || row.run_count === 0) {
        return {
          enabled: false,
          findingsTotal: 0,
          findingsTriaged: 0,
          findingsAccepted: 0,
          findingsRejected: 0,
          findingsSkipped: 0,
          findingsFallback: 0,
          llmRequests: 0,
          llmTokensUsed: 0,
          llmCostEstimateUsd: 0,
          triageDurationMs: 0
        };
      }

      // Calculate precision improvement
      const totalTriaged = row.total_triaged || 0;
      const totalRejected = row.total_rejected || 0;
      const precisionImprovement = totalTriaged > 0
        ? totalRejected / totalTriaged
        : 0;

      return {
        enabled: true,
        findingsTotal: row.total_findings || 0,
        findingsTriaged: totalTriaged,
        findingsAccepted: row.total_accepted || 0,
        findingsRejected: totalRejected,
        findingsSkipped: row.total_skipped || 0,
        findingsFallback: row.total_fallback || 0,
        llmRequests: row.total_requests || 0,
        llmTokensUsed: row.total_tokens || 0,
        llmCostEstimateUsd: row.total_cost || 0,
        triageDurationMs: row.total_duration || 0,
        precisionImprovement
      };
    } catch (error) {
      logger.warn('Failed to get triage summary', {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Export metrics to JSON
   */
  exportToJSON(): string | null {
    const summary = this.getSummary();
    if (!summary) return null;

    return JSON.stringify(summary, null, 2);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.debug('MetricsTracker closed');
    }
  }
}

/**
 * Singleton instance
 */
let metricsTrackerInstance: MetricsTracker | null = null;

/**
 * Get or create the metrics tracker instance
 */
export function getMetricsTracker(dataDir?: string): MetricsTracker {
  if (!metricsTrackerInstance) {
    metricsTrackerInstance = new MetricsTracker(dataDir);
  }
  return metricsTrackerInstance;
}

/**
 * Reset the metrics tracker (for testing)
 */
export function resetMetricsTracker(): void {
  if (metricsTrackerInstance) {
    metricsTrackerInstance.close();
    metricsTrackerInstance = null;
  }
}
