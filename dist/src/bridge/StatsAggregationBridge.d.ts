import type { Database } from 'better-sqlite3';
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
    startTime: number;
    endTime: number;
    messageCount: number;
    avgTokens: number;
}
/**
 * Aggregation strategy
 */
export type AggregationStrategy = 'DirectSQL' | 'InMemory' | 'Hybrid';
/**
 * Get conversation stats with automatic ReScript/TypeScript selection
 */
export declare function getConversationStats(db: Database, conversationId: string, userId?: string): Promise<ConversationStats>;
/**
 * Get global stats with automatic ReScript/TypeScript selection
 */
export declare function getGlobalStats(db: Database, userId?: string): Promise<GlobalStats>;
/**
 * Get time range stats with automatic ReScript/TypeScript selection
 */
export declare function getTimeRangeStats(db: Database, startTime: number, endTime: number, userId?: string): Promise<TimeRangeStats>;
/**
 * Select aggregation strategy based on estimated data size
 */
export declare function selectAggregationStrategy(estimatedRows: number): AggregationStrategy;
/**
 * Get explanation of aggregation strategy
 */
export declare function explainAggregationStrategy(strategy: AggregationStrategy): string;
/**
 * Compare ReScript vs TypeScript performance
 * (For testing and monitoring)
 */
export declare function comparePerformance(db: Database, conversationId: string): Promise<{
    rescriptMs: number;
    typescriptMs: number;
    speedup: number;
    rescriptStats: ConversationStats;
    typescriptStats: ConversationStats;
}>;
declare const _default: {
    getConversationStats: typeof getConversationStats;
    getGlobalStats: typeof getGlobalStats;
    getTimeRangeStats: typeof getTimeRangeStats;
    selectAggregationStrategy: typeof selectAggregationStrategy;
    explainAggregationStrategy: typeof explainAggregationStrategy;
    comparePerformance: typeof comparePerformance;
};
export default _default;
//# sourceMappingURL=StatsAggregationBridge.d.ts.map