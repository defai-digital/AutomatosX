/**
 * Onboarding Analytics
 * Sprint 5 Day 48: Track user onboarding and funnel metrics
 */
import { EventEmitter } from 'events';
/**
 * Onboarding funnel stages
 */
export var FunnelStage;
(function (FunnelStage) {
    FunnelStage["LANDING"] = "landing";
    FunnelStage["INSTALL"] = "install";
    FunnelStage["FIRST_COMMAND"] = "first_command";
    FunnelStage["FIRST_INDEX"] = "first_index";
    FunnelStage["FIRST_SEARCH"] = "first_search";
    FunnelStage["TUTORIAL_START"] = "tutorial_start";
    FunnelStage["TUTORIAL_COMPLETE"] = "tutorial_complete";
    FunnelStage["PLUGIN_INSTALL"] = "plugin_install";
    FunnelStage["PLUGIN_CREATE"] = "plugin_create";
    FunnelStage["RETENTION_7D"] = "retention_7d";
    FunnelStage["RETENTION_30D"] = "retention_30d";
})(FunnelStage || (FunnelStage = {}));
/**
 * Onboarding analytics
 */
export class OnboardingAnalytics extends EventEmitter {
    events = [];
    journeys = new Map();
    enabled = true;
    /**
     * Track an event
     */
    track(userId, sessionId, event, properties = {}) {
        if (!this.enabled)
            return;
        const analyticsEvent = {
            userId,
            sessionId,
            event,
            properties,
            timestamp: Date.now(),
        };
        this.events.push(analyticsEvent);
        this.emit('event-tracked', analyticsEvent);
    }
    /**
     * Track funnel stage
     */
    trackStage(userId, sessionId, stage) {
        if (!this.enabled)
            return;
        let journey = this.journeys.get(userId);
        if (!journey) {
            journey = {
                userId,
                sessionId,
                stages: [],
                currentStage: stage,
                startTime: Date.now(),
                lastActivityTime: Date.now(),
                completed: false,
            };
            this.journeys.set(userId, journey);
        }
        // Add stage to journey
        journey.stages.push({
            stage,
            timestamp: Date.now(),
        });
        journey.currentStage = stage;
        journey.lastActivityTime = Date.now();
        // Check if completed
        if (stage === FunnelStage.RETENTION_30D) {
            journey.completed = true;
        }
        this.emit('stage-tracked', { userId, sessionId, stage });
        // Track as event
        this.track(userId, sessionId, `funnel:${stage}`, { stage });
    }
    /**
     * Get user journey
     */
    getJourney(userId) {
        return this.journeys.get(userId);
    }
    /**
     * Get all journeys
     */
    getAllJourneys() {
        return Array.from(this.journeys.values());
    }
    /**
     * Get funnel metrics
     */
    getFunnelMetrics() {
        const stages = Object.values(FunnelStage);
        const metrics = [];
        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            const journeysAtStage = this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === stage));
            const nextStage = stages[i + 1];
            const conversions = nextStage
                ? this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === nextStage)).length
                : 0;
            const users = journeysAtStage.length;
            const conversionRate = users > 0 ? conversions / users : 0;
            const dropoffRate = users > 0 ? (users - conversions) / users : 0;
            // Calculate average time to next stage
            const times = journeysAtStage
                .map((j) => {
                const stageIndex = j.stages.findIndex((s) => s.stage === stage);
                if (stageIndex >= 0 && stageIndex < j.stages.length - 1) {
                    return (j.stages[stageIndex + 1].timestamp - j.stages[stageIndex].timestamp);
                }
                return null;
            })
                .filter((t) => t !== null);
            const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
            metrics.push({
                stage,
                users,
                conversions,
                conversionRate,
                averageTime,
                dropoffRate,
            });
        }
        return metrics;
    }
    /**
     * Get events for user
     */
    getUserEvents(userId) {
        return this.events.filter((e) => e.userId === userId);
    }
    /**
     * Get events by type
     */
    getEventsByType(eventType) {
        return this.events.filter((e) => e.event === eventType);
    }
    /**
     * Get all events
     */
    getAllEvents() {
        return [...this.events];
    }
    /**
     * Clear events
     */
    clearEvents() {
        this.events = [];
        this.emit('events-cleared');
    }
    /**
     * Clear journeys
     */
    clearJourneys() {
        this.journeys.clear();
        this.emit('journeys-cleared');
    }
    /**
     * Clear all data
     */
    clearAll() {
        this.clearEvents();
        this.clearJourneys();
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const completedJourneys = this.getAllJourneys().filter((j) => j.completed);
        const totalDuration = completedJourneys.reduce((sum, j) => sum + (j.lastActivityTime - j.startTime), 0);
        const averageJourneyDuration = completedJourneys.length > 0 ? totalDuration / completedJourneys.length : 0;
        // Count events
        const eventCounts = new Map();
        for (const event of this.events) {
            eventCounts.set(event.event, (eventCounts.get(event.event) || 0) + 1);
        }
        const mostCommonEvents = Array.from(eventCounts.entries())
            .map(([event, count]) => ({ event, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            totalEvents: this.events.length,
            totalJourneys: this.journeys.size,
            completedJourneys: completedJourneys.length,
            averageJourneyDuration,
            mostCommonEvents,
        };
    }
    /**
     * Export events as JSON
     */
    exportEvents() {
        return JSON.stringify(this.events, null, 2);
    }
    /**
     * Export journeys as JSON
     */
    exportJourneys() {
        return JSON.stringify(Array.from(this.journeys.values()), null, 2);
    }
    /**
     * Enable analytics
     */
    enable() {
        this.enabled = true;
        this.emit('enabled');
    }
    /**
     * Disable analytics
     */
    disable() {
        this.enabled = false;
        this.emit('disabled');
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get conversion rate between two stages
     */
    getConversionRate(fromStage, toStage) {
        const journeysAtFrom = this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === fromStage)).length;
        const journeysAtTo = this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === toStage)).length;
        return journeysAtFrom > 0 ? journeysAtTo / journeysAtFrom : 0;
    }
    /**
     * Get dropoff rate at stage
     */
    getDropoffRate(stage) {
        const stages = Object.values(FunnelStage);
        const stageIndex = stages.indexOf(stage);
        if (stageIndex < 0 || stageIndex >= stages.length - 1) {
            return 0;
        }
        const journeysAtStage = this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === stage)).length;
        const nextStage = stages[stageIndex + 1];
        const journeysAtNext = this.getAllJourneys().filter((j) => j.stages.some((s) => s.stage === nextStage)).length;
        return journeysAtStage > 0 ? (journeysAtStage - journeysAtNext) / journeysAtStage : 0;
    }
}
/**
 * Create onboarding analytics
 */
export function createOnboardingAnalytics() {
    return new OnboardingAnalytics();
}
/**
 * Global analytics instance
 */
let globalAnalytics = null;
/**
 * Get global analytics
 */
export function getGlobalAnalytics() {
    if (!globalAnalytics) {
        globalAnalytics = createOnboardingAnalytics();
    }
    return globalAnalytics;
}
/**
 * Reset global analytics
 */
export function resetGlobalAnalytics() {
    globalAnalytics = null;
}
//# sourceMappingURL=OnboardingAnalytics.js.map