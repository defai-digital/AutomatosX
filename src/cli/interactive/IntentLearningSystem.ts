/**
 * AutomatosX v8.0.0 - Intent Learning System
 *
 * Learns from user corrections to improve intent classification
 * Persists learning data to SQLite for continuous improvement
 */

import type { Database } from 'better-sqlite3';
import chalk from 'chalk';
import type { IntentType, Intent } from './IntentClassifier.js';

/**
 * Intent correction record
 */
export interface IntentCorrection {
  id?: number;
  query: string;
  predictedIntent: IntentType;
  correctedIntent: IntentType;
  confidence: number;
  timestamp: number;
  userId: string;
}

/**
 * Learning statistics
 */
export interface LearningStats {
  totalCorrections: number;
  accuracyImprovement: number;
  commonMisclassifications: Array<{
    pattern: string;
    predictedIntent: IntentType;
    correctedIntent: IntentType;
    count: number;
  }>;
  recentAccuracy: number;
}

/**
 * Intent Learning System
 *
 * Uses SQLite to persist user corrections and improve classification
 * Implements pattern matching based on historical corrections
 */
export class IntentLearningSystem {
  private db: Database;
  private userId: string;

  // In-memory cache of recent corrections
  private correctionCache: Map<string, IntentCorrection[]> = new Map();
  private cacheSize: number = 100;

  constructor(db: Database, userId: string = 'default-user') {
    this.db = db;
    this.userId = userId;

    // Initialize database table
    this.initializeDatabase();

    // Load recent corrections into cache
    this.loadRecentCorrections();
  }

  /**
   * Initialize database table for corrections
   */
  private initializeDatabase(): void {
    const createTable = `
      CREATE TABLE IF NOT EXISTS intent_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        predicted_intent TEXT NOT NULL,
        corrected_intent TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_intent_corrections_query
      ON intent_corrections(query);
    `;

    const createIndexUser = `
      CREATE INDEX IF NOT EXISTS idx_intent_corrections_user
      ON intent_corrections(user_id);
    `;

    this.db.exec(createTable);
    this.db.exec(createIndexQuery);
    this.db.exec(createIndexUser);
  }

  /**
   * Load recent corrections into cache
   */
  private loadRecentCorrections(): void {
    const stmt = this.db.prepare(`
      SELECT query, predicted_intent, corrected_intent, confidence, timestamp, user_id
      FROM intent_corrections
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(this.userId, this.cacheSize) as Array<{
      query: string;
      predicted_intent: string;
      corrected_intent: string;
      confidence: number;
      timestamp: number;
      user_id: string;
    }>;

    // Group by query
    for (const row of rows) {
      const corrections = this.correctionCache.get(row.query) || [];
      corrections.push({
        query: row.query,
        predictedIntent: row.predicted_intent as IntentType,
        correctedIntent: row.corrected_intent as IntentType,
        confidence: row.confidence,
        timestamp: row.timestamp,
        userId: row.user_id
      });
      this.correctionCache.set(row.query, corrections);
    }
  }

  /**
   * Record a user correction
   */
  recordCorrection(
    query: string,
    predictedIntent: IntentType,
    correctedIntent: IntentType,
    confidence: number
  ): void {
    const timestamp = Date.now();

    // Insert into database
    const stmt = this.db.prepare(`
      INSERT INTO intent_corrections
      (query, predicted_intent, corrected_intent, confidence, timestamp, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(query, predictedIntent, correctedIntent, confidence, timestamp, this.userId);

    // Update cache
    const corrections = this.correctionCache.get(query) || [];
    corrections.unshift({
      query,
      predictedIntent,
      correctedIntent,
      confidence,
      timestamp,
      userId: this.userId
    });

    // Limit cache size
    if (corrections.length > 10) {
      corrections.length = 10;
    }

    this.correctionCache.set(query, corrections);

    console.log(chalk.green('✓ Intent correction recorded and learned'));
  }

  /**
   * Get learned intent for a query
   * Returns corrected intent if this query was previously corrected
   */
  getLearnedIntent(query: string): IntentType | null {
    // Check cache first
    const corrections = this.correctionCache.get(query);
    if (corrections && corrections.length > 0) {
      // Return most recent correction
      return corrections[0].correctedIntent;
    }

    // Check database
    const stmt = this.db.prepare(`
      SELECT corrected_intent
      FROM intent_corrections
      WHERE query = ? AND user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const row = stmt.get(query, this.userId) as { corrected_intent: string } | undefined;

    if (row) {
      return row.corrected_intent as IntentType;
    }

    return null;
  }

  /**
   * Get similar corrections (for fuzzy matching)
   */
  getSimilarCorrections(query: string, threshold: number = 0.7): IntentCorrection[] {
    const allCorrections: IntentCorrection[] = [];

    // Get all corrections from database
    const stmt = this.db.prepare(`
      SELECT query, predicted_intent, corrected_intent, confidence, timestamp, user_id
      FROM intent_corrections
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 500
    `);

    const rows = stmt.all(this.userId) as Array<{
      query: string;
      predicted_intent: string;
      corrected_intent: string;
      confidence: number;
      timestamp: number;
      user_id: string;
    }>;

    for (const row of rows) {
      // Calculate similarity (simple Levenshtein-based)
      const similarity = this.calculateSimilarity(query, row.query);

      if (similarity >= threshold) {
        allCorrections.push({
          query: row.query,
          predictedIntent: row.predicted_intent as IntentType,
          correctedIntent: row.corrected_intent as IntentType,
          confidence: row.confidence,
          timestamp: row.timestamp,
          userId: row.user_id
        });
      }
    }

    return allCorrections;
  }

  /**
   * Apply learning to improve intent classification
   */
  applyLearning(query: string, baseIntent: Intent): Intent {
    // Check for exact match first
    const learnedIntent = this.getLearnedIntent(query);
    if (learnedIntent) {
      return {
        ...baseIntent,
        type: learnedIntent,
        confidence: Math.min(baseIntent.confidence + 0.2, 1.0) // Boost confidence
      };
    }

    // Check for similar corrections
    const similarCorrections = this.getSimilarCorrections(query, 0.8);
    if (similarCorrections.length > 0) {
      // Find most common corrected intent
      const intentCounts = new Map<IntentType, number>();
      for (const correction of similarCorrections) {
        const count = intentCounts.get(correction.correctedIntent) || 0;
        intentCounts.set(correction.correctedIntent, count + 1);
      }

      // Get intent with highest count
      let maxCount = 0;
      let mostCommonIntent: IntentType | null = null;
      for (const [intent, count] of intentCounts) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonIntent = intent;
        }
      }

      if (mostCommonIntent && mostCommonIntent !== baseIntent.type) {
        return {
          ...baseIntent,
          type: mostCommonIntent,
          confidence: Math.min(baseIntent.confidence + 0.1, 0.95)
        };
      }
    }

    // No learning applied
    return baseIntent;
  }

  /**
   * Get learning statistics
   */
  getStatistics(): LearningStats {
    // Total corrections
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM intent_corrections
      WHERE user_id = ?
    `);
    const totalRow = totalStmt.get(this.userId) as { count: number };
    const totalCorrections = totalRow.count;

    // Common misclassifications
    const commonStmt = this.db.prepare(`
      SELECT
        query,
        predicted_intent,
        corrected_intent,
        COUNT(*) as count
      FROM intent_corrections
      WHERE user_id = ?
      GROUP BY predicted_intent, corrected_intent
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    const commonRows = commonStmt.all(this.userId) as Array<{
      query: string;
      predicted_intent: string;
      corrected_intent: string;
      count: number;
    }>;

    const commonMisclassifications = commonRows.map(row => ({
      pattern: row.query,
      predictedIntent: row.predicted_intent as IntentType,
      correctedIntent: row.corrected_intent as IntentType,
      count: row.count
    }));

    // Recent accuracy (last 100 classifications)
    const recentStmt = this.db.prepare(`
      SELECT
        SUM(CASE WHEN predicted_intent = corrected_intent THEN 1 ELSE 0 END) as correct,
        COUNT(*) as total
      FROM (
        SELECT * FROM intent_corrections
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT 100
      )
    `);

    const recentRow = recentStmt.get(this.userId) as { correct: number; total: number } | undefined;
    const recentAccuracy = recentRow && recentRow.total > 0
      ? recentRow.correct / recentRow.total
      : 0;

    // Accuracy improvement (compare first 50 vs last 50)
    const improvementStmt = this.db.prepare(`
      WITH
        first_50 AS (
          SELECT
            SUM(CASE WHEN predicted_intent = corrected_intent THEN 1 ELSE 0 END) as correct,
            COUNT(*) as total
          FROM (
            SELECT * FROM intent_corrections
            WHERE user_id = ?
            ORDER BY timestamp ASC
            LIMIT 50
          )
        ),
        last_50 AS (
          SELECT
            SUM(CASE WHEN predicted_intent = corrected_intent THEN 1 ELSE 0 END) as correct,
            COUNT(*) as total
          FROM (
            SELECT * FROM intent_corrections
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 50
          )
        )
      SELECT
        (last_50.correct * 1.0 / last_50.total) - (first_50.correct * 1.0 / first_50.total) as improvement
      FROM first_50, last_50
    `);

    const improvementRow = improvementStmt.get(this.userId, this.userId) as { improvement: number } | undefined;
    const accuracyImprovement = improvementRow?.improvement || 0;

    return {
      totalCorrections,
      accuracyImprovement,
      commonMisclassifications,
      recentAccuracy
    };
  }

  /**
   * Display learning statistics
   */
  displayStatistics(): void {
    const stats = this.getStatistics();

    console.log(chalk.bold.cyan('\n╔═══ Intent Learning Statistics ═══╗\n'));

    console.log(chalk.white(`Total Corrections: ${chalk.yellow(stats.totalCorrections)}`));
    console.log(chalk.white(`Recent Accuracy: ${this.formatPercentage(stats.recentAccuracy)}`));
    console.log(chalk.white(`Accuracy Improvement: ${this.formatPercentage(stats.accuracyImprovement)}`));

    if (stats.commonMisclassifications.length > 0) {
      console.log(chalk.white('\nCommon Misclassifications:'));
      for (const misc of stats.commonMisclassifications) {
        console.log(chalk.gray(`  • ${misc.predictedIntent} → ${misc.correctedIntent} (${misc.count} times)`));
      }
    }

    console.log(chalk.gray('\n─────────────────────────────────────\n'));
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    // Simple word overlap similarity
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Format percentage for display
   */
  private formatPercentage(value: number): string {
    const percent = (value * 100).toFixed(1);
    const num = parseFloat(percent);

    if (num >= 90) {
      return chalk.green(`${percent}%`);
    } else if (num >= 70) {
      return chalk.yellow(`${percent}%`);
    } else {
      return chalk.red(`${percent}%`);
    }
  }

  /**
   * Clear all corrections (for testing/reset)
   */
  clearCorrections(): void {
    const stmt = this.db.prepare(`
      DELETE FROM intent_corrections
      WHERE user_id = ?
    `);

    stmt.run(this.userId);
    this.correctionCache.clear();

    console.log(chalk.yellow('⚠ All intent corrections cleared'));
  }
}
