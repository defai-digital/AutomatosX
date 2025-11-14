/**
 * Onboarding Analytics
 * Sprint 5 Day 48: Track user onboarding and funnel metrics
 */
import { EventEmitter } from 'events';
/**
 * Onboarding funnel stages
 */
export declare enum FunnelStage {
    LANDING = "landing",
    INSTALL = "install",
    FIRST_COMMAND = "first_command",
    FIRST_INDEX = "first_index",
    FIRST_SEARCH = "first_search",
    TUTORIAL_START = "tutorial_start",
    TUTORIAL_COMPLETE = "tutorial_complete",
    PLUGIN_INSTALL = "plugin_install",
    PLUGIN_CREATE = "plugin_create",
    RETENTION_7D = "retention_7d",
    RETENTION_30D = "retention_30d"
}
/**
 * Analytics event
 */
export interface AnalyticsEvent {
    userId: string;
    sessionId: string;
    event: string;
    properties: Record<string, any>;
    timestamp: number;
}
/**
 * Funnel metrics
 */
export interface FunnelMetrics {
    stage: FunnelStage;
    users: number;
    conversions: number;
    conversionRate: number;
    averageTime: number;
    dropoffRate: number;
}
/**
 * User journey
 */
export interface UserJourney {
    userId: string;
    sessionId: string;
    stages: Array<{
        stage: FunnelStage;
        timestamp: number;
        duration?: number;
    }>;
    currentStage: FunnelStage;
    startTime: number;
    lastActivityTime: number;
    completed: boolean;
}
/**
 * Onboarding analytics
 */
export declare class OnboardingAnalytics extends EventEmitter {
    private events;
    private journeys;
    private enabled;
    /**
     * Track an event
     */
    track(userId: string, sessionId: string, event: string, properties?: Record<string, any>): void;
    /**
     * Track funnel stage
     */
    trackStage(userId: string, sessionId: string, stage: FunnelStage): void;
    /**
     * Get user journey
     */
    getJourney(userId: string): UserJourney | undefined;
    /**
     * Get all journeys
     */
    getAllJourneys(): UserJourney[];
    /**
     * Get funnel metrics
     */
    getFunnelMetrics(): FunnelMetrics[];
    /**
     * Get events for user
     */
    getUserEvents(userId: string): AnalyticsEvent[];
    /**
     * Get events by type
     */
    getEventsByType(eventType: string): AnalyticsEvent[];
    /**
     * Get all events
     */
    getAllEvents(): AnalyticsEvent[];
    /**
     * Clear events
     */
    clearEvents(): void;
    /**
     * Clear journeys
     */
    clearJourneys(): void;
    /**
     * Clear all data
     */
    clearAll(): void;
    /**
     * Get statistics
     */
    getStatistics(): {
        totalEvents: number;
        totalJourneys: number;
        completedJourneys: number;
        averageJourneyDuration: number;
        mostCommonEvents: Array<{
            event: string;
            count: number;
        }>;
    };
    /**
     * Export events as JSON
     */
    exportEvents(): string;
    /**
     * Export journeys as JSON
     */
    exportJourneys(): string;
    /**
     * Enable analytics
     */
    enable(): void;
    /**
     * Disable analytics
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Get conversion rate between two stages
     */
    getConversionRate(fromStage: FunnelStage, toStage: FunnelStage): number;
    /**
     * Get dropoff rate at stage
     */
    getDropoffRate(stage: FunnelStage): number;
}
/**
 * Create onboarding analytics
 */
export declare function createOnboardingAnalytics(): OnboardingAnalytics;
/**
 * Get global analytics
 */
export declare function getGlobalAnalytics(): OnboardingAnalytics;
/**
 * Reset global analytics
 */
export declare function resetGlobalAnalytics(): void;
//# sourceMappingURL=OnboardingAnalytics.d.ts.map