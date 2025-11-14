/**
 * Onboarding Analytics Tests
 * Sprint 5 Day 48: Onboarding funnel tracking tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingAnalytics, FunnelStage, createOnboardingAnalytics, getGlobalAnalytics, resetGlobalAnalytics, } from '../../community/OnboardingAnalytics.js';
describe('OnboardingAnalytics', () => {
    let analytics;
    beforeEach(() => {
        analytics = createOnboardingAnalytics();
    });
    describe('Event Tracking', () => {
        it('should track an event', () => {
            analytics.track('user1', 'session1', 'test-event', { key: 'value' });
            const events = analytics.getAllEvents();
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                userId: 'user1',
                sessionId: 'session1',
                event: 'test-event',
                properties: { key: 'value' },
            });
        });
        it('should emit event-tracked', () => {
            const listener = vi.fn();
            analytics.on('event-tracked', listener);
            analytics.track('user1', 'session1', 'test-event');
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user1',
                event: 'test-event',
            }));
        });
        it('should not track when disabled', () => {
            analytics.disable();
            analytics.track('user1', 'session1', 'test-event');
            expect(analytics.getAllEvents()).toHaveLength(0);
        });
        it('should get events for user', () => {
            analytics.track('user1', 'session1', 'event1');
            analytics.track('user2', 'session2', 'event2');
            analytics.track('user1', 'session1', 'event3');
            const userEvents = analytics.getUserEvents('user1');
            expect(userEvents).toHaveLength(2);
            expect(userEvents[0].event).toBe('event1');
            expect(userEvents[1].event).toBe('event3');
        });
        it('should get events by type', () => {
            analytics.track('user1', 'session1', 'click');
            analytics.track('user2', 'session2', 'view');
            analytics.track('user3', 'session3', 'click');
            const clickEvents = analytics.getEventsByType('click');
            expect(clickEvents).toHaveLength(2);
        });
    });
    describe('Funnel Stage Tracking', () => {
        it('should track funnel stage', () => {
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            const journey = analytics.getJourney('user1');
            expect(journey).toMatchObject({
                userId: 'user1',
                sessionId: 'session1',
                currentStage: FunnelStage.LANDING,
                completed: false,
            });
            expect(journey?.stages).toHaveLength(1);
        });
        it('should emit stage-tracked event', () => {
            const listener = vi.fn();
            analytics.on('stage-tracked', listener);
            analytics.trackStage('user1', 'session1', FunnelStage.INSTALL);
            expect(listener).toHaveBeenCalledWith({
                userId: 'user1',
                sessionId: 'session1',
                stage: FunnelStage.INSTALL,
            });
        });
        it('should create journey on first stage', () => {
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            const journey = analytics.getJourney('user1');
            expect(journey).toBeDefined();
            expect(journey?.userId).toBe('user1');
        });
        it('should append stages to existing journey', () => {
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            analytics.trackStage('user1', 'session1', FunnelStage.INSTALL);
            const journey = analytics.getJourney('user1');
            expect(journey?.stages).toHaveLength(2);
            expect(journey?.currentStage).toBe(FunnelStage.INSTALL);
        });
        it('should mark journey as completed at final stage', () => {
            analytics.trackStage('user1', 'session1', FunnelStage.RETENTION_30D);
            const journey = analytics.getJourney('user1');
            expect(journey?.completed).toBe(true);
        });
        it('should track stage as event', () => {
            analytics.trackStage('user1', 'session1', FunnelStage.TUTORIAL_START);
            const events = analytics.getEventsByType('funnel:tutorial_start');
            expect(events).toHaveLength(1);
        });
    });
    describe('Journey Management', () => {
        beforeEach(() => {
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            analytics.trackStage('user1', 'session1', FunnelStage.INSTALL);
        });
        it('should get user journey', () => {
            const journey = analytics.getJourney('user1');
            expect(journey).toBeDefined();
            expect(journey?.stages).toHaveLength(2);
        });
        it('should get all journeys', () => {
            analytics.trackStage('user2', 'session2', FunnelStage.LANDING);
            const journeys = analytics.getAllJourneys();
            expect(journeys).toHaveLength(2);
        });
        it('should return undefined for non-existent journey', () => {
            const journey = analytics.getJourney('non-existent');
            expect(journey).toBeUndefined();
        });
    });
    describe('Funnel Metrics', () => {
        beforeEach(() => {
            // User 1: Complete funnel
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            analytics.trackStage('user1', 'session1', FunnelStage.INSTALL);
            analytics.trackStage('user1', 'session1', FunnelStage.FIRST_COMMAND);
            // User 2: Drops off after install
            analytics.trackStage('user2', 'session2', FunnelStage.LANDING);
            analytics.trackStage('user2', 'session2', FunnelStage.INSTALL);
            // User 3: Drops off at landing
            analytics.trackStage('user3', 'session3', FunnelStage.LANDING);
        });
        it('should calculate funnel metrics', () => {
            const metrics = analytics.getFunnelMetrics();
            expect(metrics.length).toBeGreaterThan(0);
            const landingMetrics = metrics.find((m) => m.stage === FunnelStage.LANDING);
            expect(landingMetrics?.users).toBe(3);
        });
        it('should calculate conversion rates', () => {
            const metrics = analytics.getFunnelMetrics();
            const landingMetrics = metrics.find((m) => m.stage === FunnelStage.LANDING);
            expect(landingMetrics?.conversionRate).toBeCloseTo(2 / 3); // 2 out of 3 moved to next stage
        });
        it('should calculate dropoff rates', () => {
            const metrics = analytics.getFunnelMetrics();
            const landingMetrics = metrics.find((m) => m.stage === FunnelStage.LANDING);
            expect(landingMetrics?.dropoffRate).toBeCloseTo(1 / 3); // 1 out of 3 dropped off
        });
        it('should calculate average time between stages', () => {
            const metrics = analytics.getFunnelMetrics();
            const landingMetrics = metrics.find((m) => m.stage === FunnelStage.LANDING);
            expect(landingMetrics?.averageTime).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Conversion and Dropoff Rates', () => {
        beforeEach(() => {
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            analytics.trackStage('user1', 'session1', FunnelStage.INSTALL);
            analytics.trackStage('user2', 'session2', FunnelStage.LANDING);
        });
        it('should get conversion rate between stages', () => {
            const rate = analytics.getConversionRate(FunnelStage.LANDING, FunnelStage.INSTALL);
            expect(rate).toBe(0.5); // 1 out of 2
        });
        it('should get dropoff rate at stage', () => {
            const rate = analytics.getDropoffRate(FunnelStage.LANDING);
            expect(rate).toBe(0.5); // 1 out of 2 dropped
        });
        it('should return 0 for dropoff at last stage', () => {
            const rate = analytics.getDropoffRate(FunnelStage.RETENTION_30D);
            expect(rate).toBe(0);
        });
    });
    describe('Statistics', () => {
        beforeEach(() => {
            analytics.track('user1', 'session1', 'event1');
            analytics.track('user2', 'session2', 'event2');
            analytics.track('user3', 'session3', 'event1');
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
            analytics.trackStage('user1', 'session1', FunnelStage.RETENTION_30D);
            analytics.trackStage('user2', 'session2', FunnelStage.LANDING);
        });
        it('should get statistics', () => {
            const stats = analytics.getStatistics();
            // trackStage() also creates events via track(), so 3 explicit + 3 from trackStage = 6
            expect(stats).toMatchObject({
                totalEvents: 6,
                totalJourneys: 2,
                completedJourneys: 1,
            });
            expect(stats.averageJourneyDuration).toBeGreaterThanOrEqual(0);
        });
        it('should track most common events', () => {
            const stats = analytics.getStatistics();
            // Total unique event types: event1, event2, funnel:landing, funnel:retention_30d
            expect(stats.mostCommonEvents.length).toBeGreaterThanOrEqual(2);
            expect(stats.mostCommonEvents[0].event).toBe('event1');
            expect(stats.mostCommonEvents[0].count).toBe(2);
        });
    });
    describe('Data Management', () => {
        beforeEach(() => {
            analytics.track('user1', 'session1', 'event');
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
        });
        it('should clear events', () => {
            analytics.clearEvents();
            expect(analytics.getAllEvents()).toHaveLength(0);
        });
        it('should emit events-cleared event', () => {
            const listener = vi.fn();
            analytics.on('events-cleared', listener);
            analytics.clearEvents();
            expect(listener).toHaveBeenCalled();
        });
        it('should clear journeys', () => {
            analytics.clearJourneys();
            expect(analytics.getAllJourneys()).toHaveLength(0);
        });
        it('should emit journeys-cleared event', () => {
            const listener = vi.fn();
            analytics.on('journeys-cleared', listener);
            analytics.clearJourneys();
            expect(listener).toHaveBeenCalled();
        });
        it('should clear all data', () => {
            analytics.clearAll();
            expect(analytics.getAllEvents()).toHaveLength(0);
            expect(analytics.getAllJourneys()).toHaveLength(0);
        });
    });
    describe('Export', () => {
        beforeEach(() => {
            analytics.track('user1', 'session1', 'event');
            analytics.trackStage('user1', 'session1', FunnelStage.LANDING);
        });
        it('should export events as JSON', () => {
            const json = analytics.exportEvents();
            expect(() => JSON.parse(json)).not.toThrow();
            const events = JSON.parse(json);
            expect(events).toHaveLength(2); // track() + trackStage() both create events
        });
        it('should export journeys as JSON', () => {
            const json = analytics.exportJourneys();
            expect(() => JSON.parse(json)).not.toThrow();
            const journeys = JSON.parse(json);
            expect(journeys).toHaveLength(1);
        });
    });
    describe('Enable/Disable', () => {
        it('should start enabled', () => {
            expect(analytics.isEnabled()).toBe(true);
        });
        it('should disable analytics', () => {
            analytics.disable();
            expect(analytics.isEnabled()).toBe(false);
        });
        it('should emit disabled event', () => {
            const listener = vi.fn();
            analytics.on('disabled', listener);
            analytics.disable();
            expect(listener).toHaveBeenCalled();
        });
        it('should enable analytics', () => {
            analytics.disable();
            analytics.enable();
            expect(analytics.isEnabled()).toBe(true);
        });
        it('should emit enabled event', () => {
            const listener = vi.fn();
            analytics.on('enabled', listener);
            analytics.disable();
            analytics.enable();
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Global Analytics', () => {
        beforeEach(() => {
            resetGlobalAnalytics();
        });
        it('should get global analytics', () => {
            const global = getGlobalAnalytics();
            expect(global).toBeInstanceOf(OnboardingAnalytics);
        });
        it('should return same instance', () => {
            const global1 = getGlobalAnalytics();
            const global2 = getGlobalAnalytics();
            expect(global1).toBe(global2);
        });
        it('should reset global analytics', () => {
            const global1 = getGlobalAnalytics();
            resetGlobalAnalytics();
            const global2 = getGlobalAnalytics();
            expect(global2).not.toBe(global1);
        });
    });
    describe('Edge Cases', () => {
        it('should handle empty funnel metrics', () => {
            const metrics = analytics.getFunnelMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.length).toBeGreaterThan(0);
        });
        it('should handle conversion rate with no users', () => {
            const rate = analytics.getConversionRate(FunnelStage.LANDING, FunnelStage.INSTALL);
            expect(rate).toBe(0);
        });
        it('should handle statistics with no data', () => {
            const stats = analytics.getStatistics();
            expect(stats.totalEvents).toBe(0);
            expect(stats.averageJourneyDuration).toBe(0);
        });
    });
});
//# sourceMappingURL=OnboardingAnalytics.test.js.map