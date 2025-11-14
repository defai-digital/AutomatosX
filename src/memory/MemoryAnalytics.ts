/**
 * MemoryAnalytics - Analytics and metrics for memory system
 * Tracks usage patterns, performance, and provides insights
 */

import type { MemoryService } from './MemoryService.js';
import type { Conversation, Message } from '../types/schemas/memory.schema.js';

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

export class MemoryAnalytics {
  private memoryService: MemoryService;
  private events: AnalyticsEvent[] = [];
  private maxEvents: number;

  constructor(memoryService: MemoryService, maxEvents: number = 10000) {
    this.memoryService = memoryService;
    this.maxEvents = maxEvents;
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  /**
   * Track analytics event
   */
  trackEvent(event: AnalyticsEvent): void {
    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Track conversation created
   */
  trackConversationCreated(conversationId: string, agentId: string): void {
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
  trackMessageAdded(conversationId: string, agentId: string, tokens?: number): void {
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
  trackSearchPerformed(query: string, resultCount: number): void {
    this.trackEvent({
      eventType: 'search_performed',
      timestamp: Date.now(),
      metadata: { query, resultCount },
    });
  }

  /**
   * Track conversation archived
   */
  trackConversationArchived(conversationId: string, agentId: string): void {
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
  trackConversationDeleted(conversationId: string, agentId: string): void {
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
  async getConversationMetrics(conversationId: string): Promise<ConversationMetrics | null> {
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
  async getTopConversationsByMessages(limit: number = 10): Promise<ConversationMetrics[]> {
    const conversations = await this.memoryService.listConversations({
      limit: 1000,
      offset: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    const metrics: ConversationMetrics[] = [];

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
  async getTopConversationsByTokens(limit: number = 10): Promise<ConversationMetrics[]> {
    const conversations = await this.memoryService.listConversations({
      limit: 1000,
      offset: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    const metrics: ConversationMetrics[] = [];

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
  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
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
    const averageMessagesPerConversation =
      conversationCount > 0 ? totalMessages / conversationCount : 0;
    const averageTokensPerMessage = totalMessages > 0 ? totalTokens / totalMessages : 0;
    const averageConversationDuration =
      conversationCount > 0 ? totalDuration / conversationCount : 0;

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
  async getAllAgentMetrics(): Promise<AgentMetrics[]> {
    const conversations = await this.memoryService.listConversations({
      limit: 100,
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    // Get unique agents
    const agentIds = [...new Set(conversations.conversations.map((c) => c.agentId))];

    const metrics: AgentMetrics[] = [];
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
  async getTimeRangeMetrics(
    startTime: number,
    endTime: number
  ): Promise<TimeRangeMetrics> {
    const conversations = await this.memoryService.listConversations({
      limit: 100,
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    // Filter by time range
    const filteredConversations = conversations.conversations.filter(
      (c) => c.createdAt >= startTime && c.createdAt <= endTime
    );

    let totalMessages = 0;
    let totalTokens = 0;
    const activeAgents = new Set<string>();
    const hourlyActivity = new Map<number, number>();

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
    let peakHour: number | null = null;
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
  async getDailyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getTimeRangeMetrics(startOfDay.getTime(), endOfDay.getTime());
  }

  /**
   * Get weekly metrics
   */
  async getWeeklyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics> {
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
  async getMonthlyMetrics(date: Date = new Date()): Promise<TimeRangeMetrics> {
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
  async getMemoryUsageMetrics(): Promise<MemoryUsageMetrics> {
    const stats = await this.memoryService.getMemoryStats();

    // Estimate storage size (rough approximation)
    const avgMessageSize = 500; // bytes
    const avgConversationSize = 200; // bytes
    const storageEstimateBytes =
      stats.totalMessages * avgMessageSize + stats.totalConversations * avgConversationSize;
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
  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const event of this.events) {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get events for time range
   */
  getEventsInRange(startTime: number, endTime: number): AnalyticsEvent[] {
    return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): AnalyticsEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Export events to JSON
   */
  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }
}
