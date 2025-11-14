/**
 * MemoryAnalytics - Analytics and metrics for memory system
 * Tracks usage patterns, performance, and provides insights
 */
import type { MemoryService } from './MemoryService.js';
export interface ConversationMetrics {
    conversationId: string;
    agentId: string;
    messageCount: number;
    totalTokens: number;
    durationMs: number;
    averageTokensPerMessage: number;
    createdAt: number;
    lastActivityAt: number;
}
export interface AgentMetrics {
    agentId: string;
    conversationCount: number;
    totalMessages: number;
    totalTokens: number;
    averageMessagesPerConversation: number;
    averageTokensPerMessage: number;
    averageConversationDuration: number;
}
export interface TimeRangeMetrics {
    startTime: number;
    endTime: number;
    conversationCount: number;
    messageCount: number;
    totalTokens: number;
    activeAgents: string[];
    peakHour: number | null;
}
export interface MemoryUsageMetrics {
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    deletedConversations: number;
    totalMessages: number;
    totalTokens: number;
    averageMessagesPerConversation: number;
    averageTokensPerMessage: number;
    storageEstimateMB: number;
}
export interface AnalyticsEvent {
    eventType: 'conversation_created' | 'message_added' | 'search_performed' | 'conversation_archived' | 'conversation_deleted';
    conversationId?: string;
    agentId?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export declare class MemoryAnalytics {
    private memoryService;
    private events;
    private maxEvents;
    constructor(memoryService: MemoryService, maxEvents?: number);
    /**
     * Track analytics event
     */
    trackEvent(event: AnalyticsEvent): void;
    /**
     * Track conversation created
     */
    trackConversationCreated(conversationId: string, agentId: string): void;
    /**
     * Track message added
     */
    trackMessageAdded(conversationId: string, agentId: string, tokens?: number): void;
    /**
     * Track search performed
     */
    trackSearchPerformed(query: string, resultCount: number): void;
    /**
     * Track conversation archived
     */
    trackConversationArchived(conversationId: string, agentId: string): void;
    /**
     * Track conversation deleted
     */
    trackConversationDeleted(conversationId: string, agentId: string): void;
    /**
     * Get metrics for a specific conversation
     */
    getConversationMetrics(conversationId: string): Promise<ConversationMetrics | null>;
    /**
     * Get top conversations by message count
     */
    getTopConversationsByMessages(limit?: number): Promise<ConversationMetrics[]>;
    /**
     * Get top conversations by tokens
     */
    getTopConversationsByTokens(limit?: number): Promise<ConversationMetrics[]>;
    /**
     * Get metrics for a specific agent
     */
    getAgentMetrics(agentId: string): Promise<AgentMetrics>;
    /**
     * Get all agent metrics
     */
    getAllAgentMetrics(): Promise<AgentMetrics[]>;
    /**
     * Get metrics for a time range
     */
    getTimeRangeMetrics(startTime: number, endTime: number): Promise<TimeRangeMetrics>;
    /**
     * Get daily metrics
     */
    getDailyMetrics(date?: Date): Promise<TimeRangeMetrics>;
    /**
     * Get weekly metrics
     */
    getWeeklyMetrics(date?: Date): Promise<TimeRangeMetrics>;
    /**
     * Get monthly metrics
     */
    getMonthlyMetrics(date?: Date): Promise<TimeRangeMetrics>;
    /**
     * Get overall memory usage metrics
     */
    getMemoryUsageMetrics(): Promise<MemoryUsageMetrics>;
    /**
     * Get event counts by type
     */
    getEventCounts(): Record<string, number>;
    /**
     * Get events for time range
     */
    getEventsInRange(startTime: number, endTime: number): AnalyticsEvent[];
    /**
     * Get recent events
     */
    getRecentEvents(limit?: number): AnalyticsEvent[];
    /**
     * Clear all events
     */
    clearEvents(): void;
    /**
     * Export events to JSON
     */
    exportEvents(): string;
}
//# sourceMappingURL=MemoryAnalytics.d.ts.map