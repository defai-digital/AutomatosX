// ============================================================================
// StatsAggregationBridge.ts - TypeScript bridge to ReScript StatsAggregation
// ============================================================================
//
// Provides SQL-first aggregation with feature flags and fallback
// Prevents BUG #13 (pagination bug) through database-side aggregation
//
// ============================================================================

import * as StatsAggregation from '../../packages/rescript-core/src/memory/StatsAggregation.bs.js';
import {
  shouldUseReScript,
  logFeatureFlagDecision,
  getFeatureFlags,
} from './ReScriptFeatureFlags.js';
import type { Database } from 'better-sqlite3';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Conversation statistics
 */
export interface ConversationStats {
  conversationId: string;
  messageCount: number;
  totalTokens: number;
  avgTokensPerMessage: number;
  userMessageCount: number;
  assistantMessageCount: number;
  systemMessageCount: number;
}

/**
 * Global statistics
 */
export interface GlobalStats {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  avgMessagesPerConversation: number;
  avgTokensPerMessage: number;
}

/**
 * Time range statistics
 */
export interface TimeRangeStats {
  startTime: number; // UNIX seconds
  endTime: number; // UNIX seconds
  messageCount: number;
  avgTokens: number;
}

/**
 * Aggregation strategy
 */
export type AggregationStrategy = 'DirectSQL' | 'InMemory' | 'Hybrid';

// ============================================================================
// RESCRIPT IMPLEMENTATION (prevents BUG #13!)
// ============================================================================

/**
 * Get conversation stats using ReScript (SQL-first approach)
 */
async function getConversationStatsReScript(
  db: Database,
  conversationId: string
): Promise<ConversationStats> {
  const startTime = performance.now();

  try {
    // Build SQL query using ReScript
    const query = StatsAggregation.buildConversationStatsQuery(conversationId);

    // Execute SQL in database (aggregation happens in SQLite!)
    const row = db.prepare(query).get() as any;

    if (!row) {
      throw new Error(`No stats found for conversation ${conversationId}`);
    }

    // Parse result using ReScript (type-safe!)
    const stats = StatsAggregation.parseConversationStatsRow(row);

    const endTime = performance.now();
    if (getFeatureFlags().global.enablePerformanceTracking) {
      console.log(
        `[ReScript] getConversationStats took ${(endTime - startTime).toFixed(2)}ms`
      );
    }

    return stats;
  } catch (error) {
    console.error('[ReScript] getConversationStats error:', error);
    throw error;
  }
}

/**
 * Get global stats using ReScript
 */
async function getGlobalStatsReScript(db: Database): Promise<GlobalStats> {
  const startTime = performance.now();

  try {
    // Build SQL query using ReScript
    const query = StatsAggregation.buildGlobalStatsQuery();

    // Execute in database
    const row = db.prepare(query).get() as any;

    if (!row) {
      throw new Error('No global stats found');
    }

    // Parse result using ReScript
    const stats = StatsAggregation.parseGlobalStatsRow(row);

    const endTime = performance.now();
    if (getFeatureFlags().global.enablePerformanceTracking) {
      console.log(
        `[ReScript] getGlobalStats took ${(endTime - startTime).toFixed(2)}ms`
      );
    }

    return stats;
  } catch (error) {
    console.error('[ReScript] getGlobalStats error:', error);
    throw error;
  }
}

/**
 * Get time range stats using ReScript
 */
async function getTimeRangeStatsReScript(
  db: Database,
  startTime: number,
  endTime: number
): Promise<TimeRangeStats> {
  const perfStart = performance.now();

  try {
    // Build SQL query using ReScript
    const query = StatsAggregation.buildTimeRangeStatsQuery(startTime, endTime);

    // Execute in database
    const row = db.prepare(query).get() as any;

    if (!row) {
      // No messages in range
      return {
        startTime,
        endTime,
        messageCount: 0,
        avgTokens: 0,
      };
    }

    // Parse result using ReScript
    const stats = StatsAggregation.parseTimeRangeStatsRow(row, startTime, endTime);

    const perfEnd = performance.now();
    if (getFeatureFlags().global.enablePerformanceTracking) {
      console.log(
        `[ReScript] getTimeRangeStats took ${(perfEnd - perfStart).toFixed(2)}ms`
      );
    }

    return stats;
  } catch (error) {
    console.error('[ReScript] getTimeRangeStats error:', error);
    throw error;
  }
}

// ============================================================================
// TYPESCRIPT FALLBACK (buggy version for comparison)
// ============================================================================

/**
 * Get conversation stats using TypeScript (BUGGY - fetches ALL messages!)
 */
async function getConversationStatsTypeScript(
  db: Database,
  conversationId: string
): Promise<ConversationStats> {
  const startTime = performance.now();

  // ❌ BUG #13: Fetches ALL messages (could be millions!)
  const messages = db
    .prepare(
      `SELECT role, tokens FROM messages
       WHERE conversation_id = ? AND deleted_at IS NULL`
    )
    .all(conversationId) as Array<{ role: string; tokens: number | null }>;

  // Then counts in-memory (slow!)
  const messageCount = messages.length;
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  const avgTokensPerMessage = messageCount > 0 ? totalTokens / messageCount : 0;

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const assistantMessageCount = messages.filter(
    m => m.role === 'assistant'
  ).length;
  const systemMessageCount = messages.filter(m => m.role === 'system').length;

  const endTime = performance.now();
  if (getFeatureFlags().global.enablePerformanceTracking) {
    console.log(
      `[TypeScript] getConversationStats took ${(endTime - startTime).toFixed(2)}ms (fetched ${messageCount} messages)`
    );
  }

  return {
    conversationId,
    messageCount,
    totalTokens,
    avgTokensPerMessage,
    userMessageCount,
    assistantMessageCount,
    systemMessageCount,
  };
}

/**
 * Get global stats using TypeScript (BUGGY)
 */
async function getGlobalStatsTypeScript(db: Database): Promise<GlobalStats> {
  const startTime = performance.now();

  // ❌ Fetches ALL conversations and messages
  const conversations = db
    .prepare('SELECT DISTINCT conversation_id FROM messages WHERE deleted_at IS NULL')
    .all() as Array<{ conversation_id: string }>;

  const messages = db
    .prepare('SELECT tokens FROM messages WHERE deleted_at IS NULL')
    .all() as Array<{ tokens: number | null }>;

  const totalConversations = conversations.length;
  const totalMessages = messages.length;
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  const avgMessagesPerConversation =
    totalConversations > 0 ? totalMessages / totalConversations : 0;
  const avgTokensPerMessage =
    totalMessages > 0 ? totalTokens / totalMessages : 0;

  const endTime = performance.now();
  if (getFeatureFlags().global.enablePerformanceTracking) {
    console.log(
      `[TypeScript] getGlobalStats took ${(endTime - startTime).toFixed(2)}ms (fetched ${totalMessages} messages)`
    );
  }

  return {
    totalConversations,
    totalMessages,
    totalTokens,
    avgMessagesPerConversation,
    avgTokensPerMessage,
  };
}

/**
 * Get time range stats using TypeScript (BUGGY)
 */
async function getTimeRangeStatsTypeScript(
  db: Database,
  startTime: number,
  endTime: number
): Promise<TimeRangeStats> {
  const perfStart = performance.now();

  // ❌ Fetches ALL messages in range
  const messages = db
    .prepare(
      `SELECT tokens FROM messages
       WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL`
    )
    .all(startTime, endTime) as Array<{ tokens: number | null }>;

  const messageCount = messages.length;
  const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  const avgTokens = messageCount > 0 ? totalTokens / messageCount : 0;

  const perfEnd = performance.now();
  if (getFeatureFlags().global.enablePerformanceTracking) {
    console.log(
      `[TypeScript] getTimeRangeStats took ${(perfEnd - perfStart).toFixed(2)}ms (fetched ${messageCount} messages)`
    );
  }

  return {
    startTime,
    endTime,
    messageCount,
    avgTokens,
  };
}

// ============================================================================
// BRIDGE FUNCTIONS (with feature flags and fallback)
// ============================================================================

/**
 * Get conversation stats with automatic ReScript/TypeScript selection
 */
export async function getConversationStats(
  db: Database,
  conversationId: string,
  userId?: string
): Promise<ConversationStats> {
  const useReScript = shouldUseReScript('statsAggregation', userId);
  logFeatureFlagDecision('statsAggregation', useReScript, userId);

  if (!useReScript) {
    return getConversationStatsTypeScript(db, conversationId);
  }

  try {
    return await getConversationStatsReScript(db, conversationId);
  } catch (error) {
    if (getFeatureFlags().global.fallbackOnError) {
      console.warn('[ReScript] Falling back to TypeScript:', error);
      return getConversationStatsTypeScript(db, conversationId);
    }
    throw error;
  }
}

/**
 * Get global stats with automatic ReScript/TypeScript selection
 */
export async function getGlobalStats(
  db: Database,
  userId?: string
): Promise<GlobalStats> {
  const useReScript = shouldUseReScript('statsAggregation', userId);
  logFeatureFlagDecision('statsAggregation', useReScript, userId);

  if (!useReScript) {
    return getGlobalStatsTypeScript(db);
  }

  try {
    return await getGlobalStatsReScript(db);
  } catch (error) {
    if (getFeatureFlags().global.fallbackOnError) {
      console.warn('[ReScript] Falling back to TypeScript:', error);
      return getGlobalStatsTypeScript(db);
    }
    throw error;
  }
}

/**
 * Get time range stats with automatic ReScript/TypeScript selection
 */
export async function getTimeRangeStats(
  db: Database,
  startTime: number,
  endTime: number,
  userId?: string
): Promise<TimeRangeStats> {
  const useReScript = shouldUseReScript('statsAggregation', userId);
  logFeatureFlagDecision('statsAggregation', useReScript, userId);

  if (!useReScript) {
    return getTimeRangeStatsTypeScript(db, startTime, endTime);
  }

  try {
    return await getTimeRangeStatsReScript(db, startTime, endTime);
  } catch (error) {
    if (getFeatureFlags().global.fallbackOnError) {
      console.warn('[ReScript] Falling back to TypeScript:', error);
      return getTimeRangeStatsTypeScript(db, startTime, endTime);
    }
    throw error;
  }
}

/**
 * Select aggregation strategy based on estimated data size
 */
export function selectAggregationStrategy(
  estimatedRows: number
): AggregationStrategy {
  return StatsAggregation.selectStrategy(estimatedRows) as AggregationStrategy;
}

/**
 * Get explanation of aggregation strategy
 */
export function explainAggregationStrategy(
  strategy: AggregationStrategy
): string {
  return StatsAggregation.explainStrategy(strategy as any);
}

// ============================================================================
// PERFORMANCE COMPARISON UTILITY
// ============================================================================

/**
 * Compare ReScript vs TypeScript performance
 * (For testing and monitoring)
 */
export async function comparePerformance(
  db: Database,
  conversationId: string
): Promise<{
  rescriptMs: number;
  typescriptMs: number;
  speedup: number;
  rescriptStats: ConversationStats;
  typescriptStats: ConversationStats;
}> {
  // Run ReScript version
  const rsStart = performance.now();
  const rescriptStats = await getConversationStatsReScript(db, conversationId);
  const rsEnd = performance.now();
  const rescriptMs = rsEnd - rsStart;

  // Run TypeScript version
  const tsStart = performance.now();
  const typescriptStats = await getConversationStatsTypeScript(db, conversationId);
  const tsEnd = performance.now();
  const typescriptMs = tsEnd - tsStart;

  const speedup = typescriptMs / rescriptMs;

  return {
    rescriptMs,
    typescriptMs,
    speedup,
    rescriptStats,
    typescriptStats,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getConversationStats,
  getGlobalStats,
  getTimeRangeStats,
  selectAggregationStrategy,
  explainAggregationStrategy,
  comparePerformance,
};
