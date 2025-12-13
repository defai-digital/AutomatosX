/**
 * Bugfix Metrics Tracker
 *
 * Tracks detection and fix metrics for quality measurement.
 * Stores metrics in SQLite for persistence across sessions.
 *
 * v12.9.0: PRD-018 - Metrics tracking implementation
 *
 * @module core/bugfix/metrics-tracker
 * @since v12.9.0
 */

import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import type { BugFinding, BugType, BugSeverity } from './types.js';

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
 * Metrics database schema version
 */
const SCHEMA_VERSION = 1;

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
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_rule ON detection_metrics(rule_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_type ON detection_metrics(bug_type);
      CREATE INDEX IF NOT EXISTS idx_metrics_fp ON detection_metrics(is_false_positive);
      CREATE INDEX IF NOT EXISTS idx_metrics_created ON detection_metrics(created_at);
    `);

    // Check/update schema version
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get();
    if (!versionRow) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
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
