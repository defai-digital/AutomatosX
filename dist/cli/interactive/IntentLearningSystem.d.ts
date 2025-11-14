/**
 * AutomatosX v8.0.0 - Intent Learning System
 *
 * Learns from user corrections to improve intent classification
 * Persists learning data to SQLite for continuous improvement
 */
import type { Database } from 'better-sqlite3';
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
export declare class IntentLearningSystem {
    private db;
    private userId;
    private correctionCache;
    private cacheSize;
    constructor(db: Database, userId?: string);
    /**
     * Initialize database table for corrections
     */
    private initializeDatabase;
    /**
     * Load recent corrections into cache
     */
    private loadRecentCorrections;
    /**
     * Record a user correction
     */
    recordCorrection(query: string, predictedIntent: IntentType, correctedIntent: IntentType, confidence: number): void;
    /**
     * Get learned intent for a query
     * Returns corrected intent if this query was previously corrected
     */
    getLearnedIntent(query: string): IntentType | null;
    /**
     * Get similar corrections (for fuzzy matching)
     */
    getSimilarCorrections(query: string, threshold?: number): IntentCorrection[];
    /**
     * Apply learning to improve intent classification
     */
    applyLearning(query: string, baseIntent: Intent): Intent;
    /**
     * Get learning statistics
     */
    getStatistics(): LearningStats;
    /**
     * Display learning statistics
     */
    displayStatistics(): void;
    /**
     * Calculate similarity between two strings (0-1)
     */
    private calculateSimilarity;
    /**
     * Format percentage for display
     */
    private formatPercentage;
    /**
     * Clear all corrections (for testing/reset)
     */
    clearCorrections(): void;
}
//# sourceMappingURL=IntentLearningSystem.d.ts.map