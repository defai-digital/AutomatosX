/**
 * MemoryAnalytics - Analytics and metrics for memory system
 * Tracks usage patterns, performance, and provides insights
 */
export class MemoryAnalytics {
    memoryService;
    events = [];
    maxEvents;
    constructor(memoryService, maxEvents = 10000) {
        this.memoryService = memoryService;
        this.maxEvents = maxEvents;
    }
    // ============================================================================
    // Event Tracking
    // ============================================================================
    /**
     * Track analytics event
     */
    trackEvent(event) {
        this.events.push(event);
        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
    }
    /**
     * Track conversation created
     */
    trackConversationCreated(conversationId, agentId) {
        this.trackEvent({
            eventType: 'conversation_created',
            conversationId,
            agentId,
            timestamp: Date.now(),
        });
    }
    /**
     * Track message added
     */
    trackMessageAdded(conversationId, agentId, tokens) {
        this.trackEvent({
            eventType: 'message_added',
            conversationId,
            agentId,
            timestamp: Date.now(),
            metadata: { tokens },
        });
    }
    /**
     * Track search performed
     */
    trackSearchPerformed(query, resultCount) {
        this.trackEvent({
            eventType: 'search_performed',
            timestamp: Date.now(),
            metadata: { query, resultCount },
        });
    }
    /**
     * Track conversation archived
     */
    trackConversationArchived(conversationId, agentId) {
        this.trackEvent({
            eventType: 'conversation_archived',
            conversationId,
            agentId,
            timestamp: Date.now(),
        });
    }
    /**
     * Track conversation deleted
     */
    trackConversationDeleted(conversationId, agentId) {
        this.trackEvent({
            eventType: 'conversation_deleted',
            conversationId,
            agentId,
            timestamp: Date.now(),
        });
    }
    // ============================================================================
    // Conversation Metrics
    // ============================================================================
    /**
     * Get metrics for a specific conversation
     */
    async getConversationMetrics(conversationId) {
        const conversation = await this.memoryService.getConversation(conversationId);
        if (!conversation) {
            return null;
        }
        const messageCount = await this.memoryService.getMessageCount(conversationId);
        const totalTokens = await this.memoryService.getTotalTokens(conversationId);
        const durationMs = conversation.updatedAt - conversation.createdAt;
        const averageTokensPerMessage = messageCount > 0 ? totalTokens / messageCount : 0;
        return {
            conversationId,
            agentId: conversation.agentId,
            messageCount,
            totalTokens,
            durationMs,
            averageTokensPerMessage,
            createdAt: conversation.createdAt,
            lastActivityAt: conversation.updatedAt,
        };
    }
    /**
     * Get top conversations by message count
     */
    async getTopConversationsByMessages(limit = 10) {
        const conversations = await this.memoryService.listConversations({
            limit: 1000,
            offset: 0,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
        const metrics = [];
        for (const conv of conversations.conversations) {
            const metric = await this.getConversationMetrics(conv.id);
            if (metric) {
                metrics.push(metric);
            }
        }
        // Sort by message count
        return metrics.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
    }
    /**
     * Get top conversations by tokens
     */
    async getTopConversationsByTokens(limit = 10) {
        const conversations = await this.memoryService.listConversations({
            limit: 1000,
            offset: 0,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
        const metrics = [];
        for (const conv of conversations.conversations) {
            const metric = await this.getConversationMetrics(conv.id);
            if (metric) {
                metrics.push(metric);
            }
        }
        // Sort by total tokens
        return metrics.sort((a, b) => b.totalTokens - a.totalTokens).slice(0, limit);
    }
    // ============================================================================
    // Agent Metrics
    // ============================================================================
    /**
     * Get metrics for a specific agent
     */
    async getAgentMetrics(agentId) {
        const conversations = await this.memoryService.getConversationsByAgent(agentId, 10000);
        let totalMessages = 0;
        let totalTokens = 0;
        let totalDuration = 0;
        for (const conv of conversations) {
            const messageCount = await this.memoryService.getMessageCount(conv.id);
            const tokens = await this.memoryService.getTotalTokens(conv.id);
            totalMessages += messageCount;
            totalTokens += tokens;
            totalDuration += conv.updatedAt - conv.createdAt;
        }
        const conversationCount = conversations.length;
        const averageMessagesPerConversation = conversationCount > 0 ? totalMessages / conversationCount : 0;
        const averageTokensPerMessage = totalMessages > 0 ? totalTokens / totalMessages : 0;
        const averageConversationDuration = conversationCount > 0 ? totalDuration / conversationCount : 0;
        return {
            agentId,
            conversationCount,
            totalMessages,
            totalTokens,
            averageMessagesPerConversation,
            averageTokensPerMessage,
            averageConversationDuration,
        };
    }
    /**
     * Get all agent metrics
     */
    async getAllAgentMetrics() {
        const conversations = await this.memoryService.listConversations({
            limit: 100,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
        // Get unique agents
        const agentIds = [...new Set(conversations.conversations.map((c) => c.agentId))];
        const metrics = [];
        for (const agentId of agentIds) {
            const metric = await this.getAgentMetrics(agentId);
            metrics.push(metric);
        }
        // Sort by total tokens
        return metrics.sort((a, b) => b.totalTokens - a.totalTokens);
    }
    // ============================================================================
    // Time Range Metrics
    // ============================================================================
    /**
     * Get metrics for a time range
     */
    async getTimeRangeMetrics(startTime, endTime) {
        const conversations = await this.memoryService.listConversations({
            limit: 100,
            offset: 0,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
        // Filter by time range
        const filteredConversations = conversations.conversations.filter((c) => c.createdAt >= startTime && c.createdAt <= endTime);
        let totalMessages = 0;
        let totalTokens = 0;
        const activeAgents = new Set();
        const hourlyActivity = new Map();
        for (const conv of filteredConversations) {
            const messageCount = await this.memoryService.getMessageCount(conv.id);
            const tokens = await this.memoryService.getTotalTokens(conv.id);
            totalMessages += messageCount;
            totalTokens += tokens;
            activeAgents.add(conv.agentId);
            // Track hourly activity
            const hour = new Date(conv.createdAt).getHours();
            hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
        }
        // Find peak hour
        let peakHour = null;
        let peakActivity = 0;
        for (const [hour, activity] of hourlyActivity) {
            if (activity > peakActivity) {
                peakActivity = activity;
                peakHour = hour;
            }
        }
        return {
            startTime,
            endTime,
            conversationCount: filteredConversations.length,
            messageCount: totalMessages,
            totalTokens,
            activeAgents: Array.from(activeAgents),
            peakHour,
        };
    }
    /**
     * Get daily metrics
     */
    async getDailyMetrics(date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        return this.getTimeRangeMetrics(startOfDay.getTime(), endOfDay.getTime());
    }
    /**
     * Get weekly metrics
     */
    async getWeeklyMetrics(date = new Date()) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return this.getTimeRangeMetrics(startOfWeek.getTime(), endOfWeek.getTime());
    }
    /**
     * Get monthly metrics
     */
    async getMonthlyMetrics(date = new Date()) {
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        return this.getTimeRangeMetrics(startOfMonth.getTime(), endOfMonth.getTime());
    }
    // ============================================================================
    // Memory Usage Metrics
    // ============================================================================
    /**
     * Get overall memory usage metrics
     */
    async getMemoryUsageMetrics() {
        const stats = await this.memoryService.getMemoryStats();
        // Estimate storage size (rough approximation)
        const avgMessageSize = 500; // bytes
        const avgConversationSize = 200; // bytes
        const storageEstimateBytes = stats.totalMessages * avgMessageSize + stats.totalConversations * avgConversationSize;
        const storageEstimateMB = storageEstimateBytes / (1024 * 1024);
        return {
            ...stats,
            storageEstimateMB: Math.round(storageEstimateMB * 100) / 100,
        };
    }
    // ============================================================================
    // Event Analytics
    // ============================================================================
    /**
     * Get event counts by type
     */
    getEventCounts() {
        const counts = {};
        for (const event of this.events) {
            counts[event.eventType] = (counts[event.eventType] || 0) + 1;
        }
        return counts;
    }
    /**
     * Get events for time range
     */
    getEventsInRange(startTime, endTime) {
        return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
    }
    /**
     * Get recent events
     */
    getRecentEvents(limit = 100) {
        return this.events.slice(-limit);
    }
    /**
     * Clear all events
     */
    clearEvents() {
        this.events = [];
    }
    /**
     * Export events to JSON
     */
    exportEvents() {
        return JSON.stringify(this.events, null, 2);
    }
}
//# sourceMappingURL=MemoryAnalytics.js.map