/**
 * Marketplace Analytics API
 * Sprint 6 Day 52: API layer for analytics dashboard and plugin metrics
 */
import { EventEmitter } from 'events';
/**
 * Export format
 */
export var ExportFormat;
(function (ExportFormat) {
    ExportFormat["CSV"] = "csv";
    ExportFormat["JSON"] = "json";
    ExportFormat["PDF"] = "pdf";
})(ExportFormat || (ExportFormat = {}));
/**
 * Marketplace analytics API
 */
export class MarketplaceAnalyticsAPI extends EventEmitter {
    analytics;
    constructor(analytics) {
        super();
        this.analytics = analytics;
    }
    /**
     * Get community overview
     */
    getCommunityOverview(period = 'weekly') {
        const stats = this.analytics.getStatistics();
        const topByDownloads = this.analytics.getTopByDownloads(10);
        const topByRating = this.analytics.getTopByRating(10, 5);
        // Calculate category distribution
        const allAnalytics = this.analytics.getAllAnalytics();
        const categoryDistribution = {};
        for (const plugin of allAnalytics) {
            // Extract category from plugin ID (e.g., "category:name" → "category")
            const category = plugin.pluginId.includes(':')
                ? plugin.pluginId.split(':')[0]
                : 'uncategorized';
            categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
        }
        // Aggregate downloads over time
        const downloadsOverTime = this.aggregateDownloadsTrend(period);
        // Calculate ratings over time
        const ratingsOverTime = this.aggregateRatingsTrend(period);
        const overview = {
            totalPlugins: stats.totalPlugins,
            totalDownloads: stats.totalDownloads,
            totalActiveInstalls: stats.totalActiveInstalls,
            totalRatings: stats.totalRatings,
            averageRating: stats.averageRating,
            topPluginsByDownloads: topByDownloads,
            topPluginsByRating: topByRating,
            categoryDistribution,
            downloadsOverTime,
            ratingsOverTime,
        };
        this.emit('overview-requested', { period, stats: overview });
        return overview;
    }
    /**
     * Get plugin detail analytics
     */
    getPluginDetailAnalytics(pluginId) {
        const metrics = this.analytics.getAnalytics(pluginId);
        if (!metrics)
            return null;
        const downloadsTrend = this.analytics.getTrendData(pluginId, 'monthly');
        // Calculate version adoption
        const installs = this.analytics.getActiveInstalls(pluginId);
        const versionCounts = new Map();
        for (const install of installs) {
            versionCounts.set(install.version, (versionCounts.get(install.version) || 0) + 1);
        }
        const totalInstalls = installs.length;
        const versionAdoption = Array.from(versionCounts.entries())
            .map(([version, count]) => ({
            version,
            installs: count,
            percentage: totalInstalls > 0 ? (count / totalInstalls) * 100 : 0,
        }))
            .sort((a, b) => b.installs - a.installs);
        // Calculate rating breakdown
        const ratings = this.analytics.getRatings(pluginId);
        const ratingCounts = new Map();
        for (const rating of ratings) {
            ratingCounts.set(rating.rating, (ratingCounts.get(rating.rating) || 0) + 1);
        }
        const totalRatings = ratings.length;
        const ratingBreakdown = [1, 2, 3, 4, 5].map((stars) => ({
            stars,
            count: ratingCounts.get(stars) || 0,
            percentage: totalRatings > 0 ? ((ratingCounts.get(stars) || 0) / totalRatings) * 100 : 0,
        }));
        // Calculate active users by platform
        const downloads = this.analytics.getDownloads(pluginId);
        const platformCounts = {};
        for (const download of downloads) {
            if (download.platform) {
                platformCounts[download.platform] = (platformCounts[download.platform] || 0) + 1;
            }
        }
        const detail = {
            pluginId,
            metrics,
            downloadsTrend,
            versionAdoption,
            ratingBreakdown,
            activeUsersByPlatform: platformCounts,
        };
        this.emit('plugin-detail-requested', { pluginId, detail });
        return detail;
    }
    /**
     * Export plugin analytics
     */
    async exportPluginAnalytics(pluginId, format) {
        const detail = this.getPluginDetailAnalytics(pluginId);
        if (!detail) {
            throw new Error(`No analytics found for plugin: ${pluginId}`);
        }
        switch (format) {
            case ExportFormat.JSON:
                return JSON.stringify(detail, null, 2);
            case ExportFormat.CSV:
                return this.convertToCSV(detail);
            case ExportFormat.PDF:
                throw new Error('PDF export not yet implemented');
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    /**
     * Export community overview
     */
    async exportCommunityOverview(format, period = 'weekly') {
        const overview = this.getCommunityOverview(period);
        switch (format) {
            case ExportFormat.JSON:
                return JSON.stringify(overview, null, 2);
            case ExportFormat.CSV:
                return this.convertOverviewToCSV(overview);
            case ExportFormat.PDF:
                throw new Error('PDF export not yet implemented');
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    /**
     * Get trending plugins with metadata
     */
    getTrendingPlugins(period, limit = 10) {
        const trending = this.analytics.getTrending(period, limit);
        return trending.map((plugin) => ({
            ...plugin,
            trendData: this.analytics.getTrendData(plugin.pluginId, period),
        }));
    }
    /**
     * Aggregate downloads trend across all plugins
     */
    aggregateDownloadsTrend(period) {
        const allAnalytics = this.analytics.getAllAnalytics();
        const pluginId = 'all-plugins';
        if (allAnalytics.length === 0) {
            return {
                pluginId,
                period,
                downloads: [],
                installs: [],
                ratings: [],
                timestamps: [],
            };
        }
        // Get trend data for first plugin to get timestamps
        const sampleTrend = this.analytics.getTrendData(allAnalytics[0].pluginId, period);
        // Aggregate downloads across all plugins
        const aggregateDownloads = sampleTrend.timestamps.map((timestamp, index) => {
            return allAnalytics.reduce((sum, plugin) => {
                const pluginTrend = this.analytics.getTrendData(plugin.pluginId, period);
                return sum + (pluginTrend.downloads[index] || 0);
            }, 0);
        });
        const aggregateInstalls = sampleTrend.timestamps.map((timestamp, index) => {
            return allAnalytics.reduce((sum, plugin) => {
                const pluginTrend = this.analytics.getTrendData(plugin.pluginId, period);
                return sum + (pluginTrend.installs[index] || 0);
            }, 0);
        });
        const aggregateRatings = sampleTrend.timestamps.map((timestamp, index) => {
            return allAnalytics.reduce((sum, plugin) => {
                const pluginTrend = this.analytics.getTrendData(plugin.pluginId, period);
                return sum + (pluginTrend.ratings[index] || 0);
            }, 0);
        });
        return {
            pluginId,
            period,
            downloads: aggregateDownloads,
            installs: aggregateInstalls,
            ratings: aggregateRatings,
            timestamps: sampleTrend.timestamps,
        };
    }
    /**
     * Aggregate ratings trend
     */
    aggregateRatingsTrend(period) {
        const allAnalytics = this.analytics.getAllAnalytics();
        if (allAnalytics.length === 0)
            return [];
        const sampleTrend = this.analytics.getTrendData(allAnalytics[0].pluginId, period);
        return sampleTrend.timestamps.map((timestamp, index) => {
            const allRatings = allAnalytics.flatMap((plugin) => {
                const ratings = this.analytics.getRatings(plugin.pluginId);
                return ratings.filter((r) => r.timestamp >= timestamp && r.timestamp < (sampleTrend.timestamps[index + 1] || Date.now()));
            });
            const average = allRatings.length > 0
                ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
                : 0;
            return {
                timestamp,
                average,
                count: allRatings.length,
            };
        });
    }
    /**
     * Convert detail analytics to CSV
     */
    convertToCSV(detail) {
        const lines = [];
        // Header
        lines.push('Plugin Analytics Report');
        lines.push(`Plugin ID: ${detail.pluginId}`);
        lines.push('');
        // Metrics
        lines.push('Metric,Value');
        lines.push(`Total Downloads,${detail.metrics.totalDownloads}`);
        lines.push(`Active Installs,${detail.metrics.activeInstalls}`);
        lines.push(`Average Rating,${detail.metrics.averageRating.toFixed(2)}`);
        lines.push(`Total Ratings,${detail.metrics.totalRatings}`);
        lines.push('');
        // Version adoption
        lines.push('Version,Installs,Percentage');
        for (const version of detail.versionAdoption) {
            lines.push(`${version.version},${version.installs},${version.percentage.toFixed(1)}%`);
        }
        lines.push('');
        // Rating breakdown
        lines.push('Stars,Count,Percentage');
        for (const rating of detail.ratingBreakdown) {
            lines.push(`${rating.stars},${rating.count},${rating.percentage.toFixed(1)}%`);
        }
        return lines.join('\n');
    }
    /**
     * Convert overview to CSV
     */
    convertOverviewToCSV(overview) {
        const lines = [];
        // Header
        lines.push('Community Overview Report');
        lines.push('');
        // Stats
        lines.push('Metric,Value');
        lines.push(`Total Plugins,${overview.totalPlugins}`);
        lines.push(`Total Downloads,${overview.totalDownloads}`);
        lines.push(`Active Installs,${overview.totalActiveInstalls}`);
        lines.push(`Average Rating,${overview.averageRating.toFixed(2)}`);
        lines.push('');
        // Top plugins by downloads
        lines.push('Top Plugins by Downloads');
        lines.push('Plugin ID,Downloads');
        for (const plugin of overview.topPluginsByDownloads) {
            lines.push(`${plugin.pluginId},${plugin.totalDownloads}`);
        }
        lines.push('');
        // Category distribution
        lines.push('Category Distribution');
        lines.push('Category,Count');
        for (const [category, count] of Object.entries(overview.categoryDistribution)) {
            lines.push(`${category},${count}`);
        }
        return lines.join('\n');
    }
}
/**
 * Create marketplace analytics API
 */
export function createMarketplaceAnalyticsAPI(analytics) {
    return new MarketplaceAnalyticsAPI(analytics);
}
/**
 * Global API instance
 */
let globalAPI = null;
/**
 * Get global analytics API
 */
export function getGlobalAPI(analytics) {
    if (!globalAPI) {
        globalAPI = createMarketplaceAnalyticsAPI(analytics);
    }
    return globalAPI;
}
/**
 * Reset global API
 */
export function resetGlobalAPI() {
    globalAPI = null;
}
//# sourceMappingURL=MarketplaceAnalyticsAPI.js.map