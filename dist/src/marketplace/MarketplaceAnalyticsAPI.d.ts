/**
 * Marketplace Analytics API
 * Sprint 6 Day 52: API layer for analytics dashboard and plugin metrics
 */
import { EventEmitter } from 'events';
import { MarketplaceAnalytics, type PluginAnalytics, type TrendData } from './MarketplaceAnalytics.js';
/**
 * Community overview data
 */
export interface CommunityOverview {
    totalPlugins: number;
    totalDownloads: number;
    totalActiveInstalls: number;
    totalRatings: number;
    averageRating: number;
    topPluginsByDownloads: PluginAnalytics[];
    topPluginsByRating: PluginAnalytics[];
    categoryDistribution: Record<string, number>;
    downloadsOverTime: TrendData;
    ratingsOverTime: {
        timestamp: number;
        average: number;
        count: number;
    }[];
}
/**
 * Plugin detail analytics
 */
export interface PluginDetailAnalytics {
    pluginId: string;
    metrics: PluginAnalytics;
    downloadsTrend: TrendData;
    versionAdoption: {
        version: string;
        installs: number;
        percentage: number;
    }[];
    ratingBreakdown: {
        stars: number;
        count: number;
        percentage: number;
    }[];
    activeUsersByPlatform: Record<string, number>;
    geographicDistribution?: Record<string, number>;
}
/**
 * Export format
 */
export declare enum ExportFormat {
    CSV = "csv",
    JSON = "json",
    PDF = "pdf"
}
/**
 * Marketplace analytics API
 */
export declare class MarketplaceAnalyticsAPI extends EventEmitter {
    private analytics;
    constructor(analytics: MarketplaceAnalytics);
    /**
     * Get community overview
     */
    getCommunityOverview(period?: 'daily' | 'weekly' | 'monthly'): CommunityOverview;
    /**
     * Get plugin detail analytics
     */
    getPluginDetailAnalytics(pluginId: string): PluginDetailAnalytics | null;
    /**
     * Export plugin analytics
     */
    exportPluginAnalytics(pluginId: string, format: ExportFormat): Promise<string | Buffer>;
    /**
     * Export community overview
     */
    exportCommunityOverview(format: ExportFormat, period?: 'daily' | 'weekly' | 'monthly'): Promise<string | Buffer>;
    /**
     * Get trending plugins with metadata
     */
    getTrendingPlugins(period: 'daily' | 'weekly' | 'monthly', limit?: number): {
        trendData: TrendData;
        pluginId: string;
        totalDownloads: number;
        activeInstalls: number;
        averageRating: number;
        totalRatings: number;
        lastUpdated: number;
        createdAt: number;
    }[];
    /**
     * Aggregate downloads trend across all plugins
     */
    private aggregateDownloadsTrend;
    /**
     * Aggregate ratings trend
     */
    private aggregateRatingsTrend;
    /**
     * Convert detail analytics to CSV
     */
    private convertToCSV;
    /**
     * Convert overview to CSV
     */
    private convertOverviewToCSV;
}
/**
 * Create marketplace analytics API
 */
export declare function createMarketplaceAnalyticsAPI(analytics: MarketplaceAnalytics): MarketplaceAnalyticsAPI;
/**
 * Get global analytics API
 */
export declare function getGlobalAPI(analytics: MarketplaceAnalytics): MarketplaceAnalyticsAPI;
/**
 * Reset global API
 */
export declare function resetGlobalAPI(): void;
//# sourceMappingURL=MarketplaceAnalyticsAPI.d.ts.map