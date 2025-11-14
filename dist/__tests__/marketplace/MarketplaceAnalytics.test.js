/**
 * Marketplace Analytics Tests
 * Sprint 6 Day 51: Marketplace analytics tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceAnalytics, createMarketplaceAnalytics, getGlobalAnalytics, resetGlobalAnalytics, LifecycleEvent, } from '../../marketplace/MarketplaceAnalytics.js';
describe('MarketplaceAnalytics', () => {
    let analytics;
    beforeEach(() => {
        analytics = createMarketplaceAnalytics();
    });
    describe('Download Tracking', () => {
        it('should track download', () => {
            const listener = vi.fn();
            analytics.on('download-tracked', listener);
            const download = {
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            };
            analytics.trackDownload(download);
            expect(listener).toHaveBeenCalledWith(download);
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.totalDownloads).toBe(1);
        });
        it('should emit analytics-updated event', () => {
            const listener = vi.fn();
            analytics.on('analytics-updated', listener);
            const download = {
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            };
            analytics.trackDownload(download);
            expect(listener).toHaveBeenCalledWith({
                pluginId: 'plugin1',
                analytics: expect.objectContaining({
                    pluginId: 'plugin1',
                    totalDownloads: 1,
                }),
            });
        });
        it('should track multiple downloads', () => {
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user2',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.totalDownloads).toBe(2);
        });
        it('should get downloads for plugin', () => {
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            analytics.trackDownload({
                pluginId: 'plugin2',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            const downloads = analytics.getDownloads('plugin1');
            expect(downloads).toHaveLength(1);
            expect(downloads[0].pluginId).toBe('plugin1');
        });
    });
    describe('Install Tracking', () => {
        it('should track install', () => {
            const listener = vi.fn();
            analytics.on('install-tracked', listener);
            const install = {
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            };
            analytics.trackInstall(install);
            expect(listener).toHaveBeenCalledWith(install);
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.activeInstalls).toBe(1);
        });
        it('should track multiple installs', () => {
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user2',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.activeInstalls).toBe(2);
        });
        it('should get active installs', () => {
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user2',
                version: '1.0.0',
                installedAt: Date.now(),
                active: false,
            });
            const activeInstalls = analytics.getActiveInstalls('plugin1');
            expect(activeInstalls).toHaveLength(1);
            expect(activeInstalls[0].userId).toBe('user1');
        });
    });
    describe('Uninstall Tracking', () => {
        it('should track uninstall', () => {
            const listener = vi.fn();
            analytics.on('uninstall-tracked', listener);
            // First install
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            // Then uninstall
            analytics.trackUninstall('plugin1', 'user1');
            expect(listener).toHaveBeenCalledWith({
                pluginId: 'plugin1',
                userId: 'user1',
            });
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.activeInstalls).toBe(0);
        });
        it('should not affect other users', () => {
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user2',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackUninstall('plugin1', 'user1');
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.activeInstalls).toBe(1);
        });
    });
    describe('Rating Tracking', () => {
        it('should track rating', () => {
            const listener = vi.fn();
            analytics.on('rating-tracked', listener);
            const rating = {
                pluginId: 'plugin1',
                userId: 'user1',
                rating: 5,
                timestamp: Date.now(),
            };
            analytics.trackRating(rating);
            expect(listener).toHaveBeenCalledWith(rating);
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.averageRating).toBe(5);
            expect(pluginAnalytics?.totalRatings).toBe(1);
        });
        it('should calculate average rating', () => {
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user1',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user2',
                rating: 3,
                timestamp: Date.now(),
            });
            const pluginAnalytics = analytics.getAnalytics('plugin1');
            expect(pluginAnalytics?.averageRating).toBe(4);
            expect(pluginAnalytics?.totalRatings).toBe(2);
        });
        it('should reject invalid rating', () => {
            expect(() => {
                analytics.trackRating({
                    pluginId: 'plugin1',
                    userId: 'user1',
                    rating: 6,
                    timestamp: Date.now(),
                });
            }).toThrow('Rating must be between 1 and 5');
        });
        it('should get ratings for plugin', () => {
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user1',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user1',
                rating: 4,
                timestamp: Date.now(),
            });
            const ratings = analytics.getRatings('plugin1');
            expect(ratings).toHaveLength(1);
            expect(ratings[0].rating).toBe(5);
        });
    });
    describe('Event Tracking', () => {
        it('should track lifecycle event', () => {
            const listener = vi.fn();
            analytics.on('event-tracked', listener);
            analytics.trackEvent({
                pluginId: 'plugin1',
                userId: 'user1',
                event: LifecycleEvent.ACTIVATED,
                timestamp: Date.now(),
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                event: LifecycleEvent.ACTIVATED,
            }));
        });
    });
    describe('Top Plugins', () => {
        beforeEach(() => {
            // Plugin 1: 5 downloads
            for (let i = 0; i < 5; i++) {
                analytics.trackDownload({
                    pluginId: 'plugin1',
                    userId: `user${i}`,
                    timestamp: Date.now(),
                    version: '1.0.0',
                });
            }
            // Plugin 2: 3 downloads
            for (let i = 0; i < 3; i++) {
                analytics.trackDownload({
                    pluginId: 'plugin2',
                    userId: `user${i}`,
                    timestamp: Date.now(),
                    version: '1.0.0',
                });
            }
            // Plugin 3: 1 download
            analytics.trackDownload({
                pluginId: 'plugin3',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
        });
        it('should get top plugins by downloads', () => {
            const top = analytics.getTopByDownloads(2);
            expect(top).toHaveLength(2);
            expect(top[0].pluginId).toBe('plugin1');
            expect(top[0].totalDownloads).toBe(5);
            expect(top[1].pluginId).toBe('plugin2');
            expect(top[1].totalDownloads).toBe(3);
        });
        it('should get top plugins by rating', () => {
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user1',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user2',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user3',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user4',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user5',
                rating: 5,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user1',
                rating: 3,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user2',
                rating: 3,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user3',
                rating: 3,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user4',
                rating: 3,
                timestamp: Date.now(),
            });
            analytics.trackRating({
                pluginId: 'plugin2',
                userId: 'user5',
                rating: 3,
                timestamp: Date.now(),
            });
            const top = analytics.getTopByRating(2, 5);
            expect(top).toHaveLength(2);
            expect(top[0].averageRating).toBeGreaterThan(top[1].averageRating);
        });
        it('should get top plugins by active installs', () => {
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user2',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackInstall({
                pluginId: 'plugin2',
                userId: 'user3',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            const top = analytics.getTopByActiveInstalls(2);
            expect(top).toHaveLength(2);
            expect(top[0].pluginId).toBe('plugin1');
            expect(top[0].activeInstalls).toBe(2);
        });
    });
    describe('Trending Plugins', () => {
        it('should get trending plugins', () => {
            const now = Date.now();
            // Recent downloads
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: now - 3600000, // 1 hour ago
                version: '1.0.0',
            });
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user2',
                timestamp: now - 1800000, // 30 min ago
                version: '1.0.0',
            });
            // Old download
            analytics.trackDownload({
                pluginId: 'plugin2',
                userId: 'user3',
                timestamp: now - 604800000, // 7 days ago
                version: '1.0.0',
            });
            const trending = analytics.getTrending('daily', 2);
            expect(trending.length).toBeGreaterThanOrEqual(1);
            expect(trending[0].pluginId).toBe('plugin1');
        });
    });
    describe('Trend Data', () => {
        it('should get trend data', () => {
            const now = Date.now();
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: now - 3600000,
                version: '1.0.0',
            });
            const trendData = analytics.getTrendData('plugin1', 'daily');
            expect(trendData.pluginId).toBe('plugin1');
            expect(trendData.period).toBe('daily');
            expect(trendData.downloads).toBeInstanceOf(Array);
            expect(trendData.timestamps).toBeInstanceOf(Array);
        });
    });
    describe('Statistics', () => {
        beforeEach(() => {
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            analytics.trackDownload({
                pluginId: 'plugin2',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            analytics.trackInstall({
                pluginId: 'plugin1',
                userId: 'user1',
                version: '1.0.0',
                installedAt: Date.now(),
                active: true,
            });
            analytics.trackRating({
                pluginId: 'plugin1',
                userId: 'user1',
                rating: 5,
                timestamp: Date.now(),
            });
        });
        it('should get statistics', () => {
            const stats = analytics.getStatistics();
            expect(stats).toMatchObject({
                totalPlugins: 2,
                totalDownloads: 2,
                totalActiveInstalls: 1,
                totalRatings: 1,
            });
            expect(stats.averageRating).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Clear Operations', () => {
        beforeEach(() => {
            analytics.trackDownload({
                pluginId: 'plugin1',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
            analytics.trackDownload({
                pluginId: 'plugin2',
                userId: 'user1',
                timestamp: Date.now(),
                version: '1.0.0',
            });
        });
        it('should clear analytics for plugin', () => {
            const listener = vi.fn();
            analytics.on('analytics-cleared', listener);
            analytics.clearAnalytics('plugin1');
            expect(listener).toHaveBeenCalledWith({ pluginId: 'plugin1' });
            expect(analytics.getAnalytics('plugin1')).toBeUndefined();
            expect(analytics.getAnalytics('plugin2')).toBeDefined();
        });
        it('should clear all analytics', () => {
            const listener = vi.fn();
            analytics.on('all-cleared', listener);
            analytics.clearAll();
            expect(listener).toHaveBeenCalled();
            expect(analytics.getAllAnalytics()).toHaveLength(0);
        });
    });
    describe('Global Analytics', () => {
        beforeEach(() => {
            resetGlobalAnalytics();
        });
        it('should get global analytics', () => {
            const global = getGlobalAnalytics();
            expect(global).toBeInstanceOf(MarketplaceAnalytics);
        });
        it('should return same instance', () => {
            const analytics1 = getGlobalAnalytics();
            const analytics2 = getGlobalAnalytics();
            expect(analytics1).toBe(analytics2);
        });
        it('should reset global analytics', () => {
            const analytics1 = getGlobalAnalytics();
            resetGlobalAnalytics();
            const analytics2 = getGlobalAnalytics();
            expect(analytics2).not.toBe(analytics1);
        });
    });
});
//# sourceMappingURL=MarketplaceAnalytics.test.js.map