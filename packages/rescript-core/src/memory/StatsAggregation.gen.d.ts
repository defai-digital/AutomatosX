export type conversationStats = {
    readonly conversationId: string;
    readonly messageCount: number;
    readonly totalTokens: number;
    readonly avgTokensPerMessage: number;
    readonly userMessageCount: number;
    readonly assistantMessageCount: number;
    readonly systemMessageCount: number;
};
export type globalStats = {
    readonly totalConversations: number;
    readonly totalMessages: number;
    readonly totalTokens: number;
    readonly avgMessagesPerConversation: number;
    readonly avgTokensPerMessage: number;
};
export type timeRangeStats = {
    readonly startTime: number;
    readonly endTime: number;
    readonly messageCount: number;
    readonly avgTokens: number;
};
export type aggregationStrategy = "DirectSQL" | "InMemory" | "Hybrid";
export declare const buildConversationStatsQuery: (conversationId: string) => string;
export declare const buildGlobalStatsQuery: () => string;
export declare const buildTimeRangeStatsQuery: (startTime: number, endTime: number) => string;
export declare const parseConversationStatsRow: (row: {
    readonly assistant_message_count: number;
    readonly avg_tokens_per_message: number;
    readonly conversation_id: string;
    readonly message_count: number;
    readonly system_message_count: number;
    readonly total_tokens: number;
    readonly user_message_count: number;
}) => conversationStats;
export declare const parseGlobalStatsRow: (row: {
    readonly total_conversations: number;
    readonly total_messages: number;
    readonly total_tokens: number;
}) => globalStats;
export declare const parseTimeRangeStatsRow: (row: {
    readonly avg_tokens: number;
    readonly message_count: number;
}, startTime: number, endTime: number) => timeRangeStats;
export declare const selectStrategy: (estimatedRows: number) => aggregationStrategy;
export declare const explainStrategy: (strategy: aggregationStrategy) => string;
//# sourceMappingURL=StatsAggregation.gen.d.ts.map