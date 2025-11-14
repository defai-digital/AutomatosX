/**
 * Marketplace Analytics
 * Sprint 6 Day 51: Analytics schema and tracking for plugin marketplace
 */
import { EventEmitter } from 'events';
/**
 * Plugin lifecycle event
 */
export var LifecycleEvent;
(function (LifecycleEvent) {
    LifecycleEvent["INSTALLED"] = "installed";
    LifecycleEvent["UNINSTALLED"] = "uninstalled";
    LifecycleEvent["ACTIVATED"] = "activated";
    LifecycleEvent["DEACTIVATED"] = "deactivated";
    LifecycleEvent["UPDATED"] = "updated";
    LifecycleEvent["RATED"] = "rated";
    LifecycleEvent["DOWNLOADED"] = "downloaded";
})(LifecycleEvent || (LifecycleEvent = {}));
/**
 * Marketplace analytics
 */
export class MarketplaceAnalytics extends EventEmitter {
    analytics = new Map();
    downloads = [];
    ratings = [];
    installs = new Map();
    events = [];
    /**
     * Track download
     */
    trackDownload(record) {
        this.downloads.push(record);
        // Update analytics
        this.updateAnalytics(record.pluginId, (analytics) => {
            analytics.totalDownloads++;
            analytics.lastUpdated = Date.now();
        });
        // Record event
        this.trackEvent({
            pluginId: record.pluginId,
            userId: record.userId,
            event: LifecycleEvent.DOWNLOADED,
            timestamp: record.timestamp,
            metadata: { version: record.version, platform: record.platform },
        });
        this.emit('download-tracked', record);
    }
    /**
     * Track install
     */
    trackInstall(record) {
        let pluginInstalls = this.installs.get(record.pluginId);
        if (!pluginInstalls) {
            pluginInstalls = [];
            this.installs.set(record.pluginId, pluginInstalls);
        }
        pluginInstalls.push(record);
        // Update analytics
        this.updateAnalytics(record.pluginId, (analytics) => {
            analytics.activeInstalls = this.getActiveInstalls(record.pluginId).length;
            analytics.lastUpdated = Date.now();
        });
        // Record event
        this.trackEvent({
            pluginId: record.pluginId,
            userId: record.userId,
            event: LifecycleEvent.INSTALLED,
            timestamp: record.installedAt,
            metadata: { version: record.version },
        });
        this.emit('install-tracked', record);
    }
    /**
     * Track uninstall
     */
    trackUninstall(pluginId, userId) {
        const pluginInstalls = this.installs.get(pluginId);
        if (!pluginInstalls)
            return;
        const install = pluginInstalls.find((i) => i.userId === userId);
        if (install) {
            install.active = false;
        }
        // Update analytics
        this.updateAnalytics(pluginId, (analytics) => {
            analytics.activeInstalls = this.getActiveInstalls(pluginId).length;
            analytics.lastUpdated = Date.now();
        });
        // Record event
        this.trackEvent({
            pluginId,
            userId,
            event: LifecycleEvent.UNINSTALLED,
            timestamp: Date.now(),
        });
        this.emit('uninstall-tracked', { pluginId, userId });
    }
    /**
     * Track rating
     */
    trackRating(record) {
        // Validate rating
        if (record.rating < 1 || record.rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }
        this.ratings.push(record);
        // Update analytics
        this.updateAnalytics(record.pluginId, (analytics) => {
            const pluginRatings = this.getRatings(record.pluginId);
            const totalRating = pluginRatings.reduce((sum, r) => sum + r.rating, 0);
            analytics.averageRating = totalRating / pluginRatings.length;
            analytics.totalRatings = pluginRatings.length;
            analytics.lastUpdated = Date.now();
        });
        // Record event
        this.trackEvent({
            pluginId: record.pluginId,
            userId: record.userId,
            event: LifecycleEvent.RATED,
            timestamp: record.timestamp,
            metadata: { rating: record.rating, hasReview: !!record.review },
        });
        this.emit('rating-tracked', record);
    }
    /**
     * Track lifecycle event
     */
    trackEvent(event) {
        this.events.push(event);
        this.emit('event-tracked', event);
    }
    /**
     * Get plugin analytics
     */
    getAnalytics(pluginId) {
        return this.analytics.get(pluginId);
    }
    /**
     * Get all plugin analytics
     */
    getAllAnalytics() {
        return Array.from(this.analytics.values());
    }
    /**
     * Get downloads for plugin
     */
    getDownloads(pluginId) {
        return this.downloads.filter((d) => d.pluginId === pluginId);
    }
    /**
     * Get ratings for plugin
     */
    getRatings(pluginId) {
        return this.ratings.filter((r) => r.pluginId === pluginId);
    }
    /**
     * Get active installs for plugin
     */
    getActiveInstalls(pluginId) {
        const pluginInstalls = this.installs.get(pluginId);
        if (!pluginInstalls)
            return [];
        return pluginInstalls.filter((i) => i.active);
    }
    /**
     * Get top plugins by downloads
     */
    getTopByDownloads(limit = 10) {
        return Array.from(this.analytics.values())
            .sort((a, b) => b.totalDownloads - a.totalDownloads)
            .slice(0, limit);
    }
    /**
     * Get top plugins by rating
     */
    getTopByRating(limit = 10, minRatings = 5) {
        return Array.from(this.analytics.values())
            .filter((a) => a.totalRatings >= minRatings)
            .sort((a, b) => b.averageRating - a.averageRating)
            .slice(0, limit);
    }
    /**
     * Get top plugins by active installs
     */
    getTopByActiveInstalls(limit = 10) {
        return Array.from(this.analytics.values())
            .sort((a, b) => b.activeInstalls - a.activeInstalls)
            .slice(0, limit);
    }
    /**
     * Get trending plugins
     */
    getTrending(period, limit = 10) {
        const now = Date.now();
        const periodMs = this.getPeriodMs(period);
        const startTime = now - periodMs;
        // Calculate downloads in period
        const pluginDownloads = new Map();
        for (const download of this.downloads) {
            if (download.timestamp >= startTime) {
                const count = pluginDownloads.get(download.pluginId) || 0;
                pluginDownloads.set(download.pluginId, count + 1);
            }
        }
        // Sort by downloads in period
        const trending = Array.from(this.analytics.values())
            .map((analytics) => ({
            analytics,
            recentDownloads: pluginDownloads.get(analytics.pluginId) || 0,
        }))
            .sort((a, b) => b.recentDownloads - a.recentDownloads)
            .slice(0, limit)
            .map((item) => item.analytics);
        return trending;
    }
    /**
     * Get trend data for plugin
     */
    getTrendData(pluginId, period) {
        const now = Date.now();
        const periodMs = this.getPeriodMs(period);
        const bucketSize = period === 'daily' ? 3600000 : period === 'weekly' ? 86400000 : 2592000000; // 1h, 1d, 30d
        const downloads = [];
        const installs = [];
        const ratings = [];
        const timestamps = [];
        // Create time buckets
        const bucketCount = Math.ceil(periodMs / bucketSize);
        for (let i = 0; i < bucketCount; i++) {
            const bucketStart = now - (bucketCount - i) * bucketSize;
            const bucketEnd = bucketStart + bucketSize;
            timestamps.push(bucketStart);
            // Count downloads in bucket
            const bucketDownloads = this.downloads.filter((d) => d.pluginId === pluginId &&
                d.timestamp >= bucketStart &&
                d.timestamp < bucketEnd).length;
            downloads.push(bucketDownloads);
            // Count installs in bucket
            const pluginInstalls = this.installs.get(pluginId) || [];
            const bucketInstalls = pluginInstalls.filter((i) => i.installedAt >= bucketStart && i.installedAt < bucketEnd).length;
            installs.push(bucketInstalls);
            // Count ratings in bucket
            const bucketRatings = this.ratings.filter((r) => r.pluginId === pluginId &&
                r.timestamp >= bucketStart &&
                r.timestamp < bucketEnd).length;
            ratings.push(bucketRatings);
        }
        return {
            pluginId,
            period,
            downloads,
            installs,
            ratings,
            timestamps,
        };
    }
    /**
     * Get marketplace statistics
     */
    getStatistics() {
        const analyticsArray = Array.from(this.analytics.values());
        const totalDownloads = analyticsArray.reduce((sum, a) => sum + a.totalDownloads, 0);
        const totalActiveInstalls = analyticsArray.reduce((sum, a) => sum + a.activeInstalls, 0);
        const totalRatings = analyticsArray.reduce((sum, a) => sum + a.totalRatings, 0);
        const ratingsSum = analyticsArray.reduce((sum, a) => sum + a.averageRating * a.totalRatings, 0);
        const averageRating = totalRatings > 0 ? ratingsSum / totalRatings : 0;
        return {
            totalPlugins: analyticsArray.length,
            totalDownloads,
            totalActiveInstalls,
            totalRatings,
            averageRating,
        };
    }
    /**
     * Clear analytics for plugin
     */
    clearAnalytics(pluginId) {
        this.analytics.delete(pluginId);
        this.downloads = this.downloads.filter((d) => d.pluginId !== pluginId);
        this.ratings = this.ratings.filter((r) => r.pluginId !== pluginId);
        this.installs.delete(pluginId);
        this.events = this.events.filter((e) => e.pluginId !== pluginId);
        this.emit('analytics-cleared', { pluginId });
    }
    /**
     * Clear all analytics
     */
    clearAll() {
        this.analytics.clear();
        this.downloads = [];
        this.ratings = [];
        this.installs.clear();
        this.events = [];
        this.emit('all-cleared');
    }
    /**
     * Update analytics
     */
    updateAnalytics(pluginId, updater) {
        let analytics = this.analytics.get(pluginId);
        if (!analytics) {
            analytics = {
                pluginId,
                totalDownloads: 0,
                activeInstalls: 0,
                averageRating: 0,
                totalRatings: 0,
                lastUpdated: Date.now(),
                createdAt: Date.now(),
            };
            this.analytics.set(pluginId, analytics);
        }
        updater(analytics);
        this.emit('analytics-updated', { pluginId, analytics });
    }
    /**
     * Get period in milliseconds
     */
    getPeriodMs(period) {
        switch (period) {
            case 'daily':
                return 86400000; // 24 hours
            case 'weekly':
                return 604800000; // 7 days
            case 'monthly':
                return 2592000000; // 30 days
        }
    }
}
/**
 * Create marketplace analytics
 */
export function createMarketplaceAnalytics() {
    return new MarketplaceAnalytics();
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
        globalAnalytics = createMarketplaceAnalytics();
    }
    return globalAnalytics;
}
/**
 * Reset global analytics
 */
export function resetGlobalAnalytics() {
    globalAnalytics = null;
}
//# sourceMappingURL=MarketplaceAnalytics.js.map