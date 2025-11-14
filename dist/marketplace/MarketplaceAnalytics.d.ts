/**
 * Marketplace Analytics
 * Sprint 6 Day 51: Analytics schema and tracking for plugin marketplace
 */
import { EventEmitter } from 'events';
/**
 * Plugin lifecycle event
 */
export declare enum LifecycleEvent {
    INSTALLED = "installed",
    UNINSTALLED = "uninstalled",
    ACTIVATED = "activated",
    DEACTIVATED = "deactivated",
    UPDATED = "updated",
    RATED = "rated",
    DOWNLOADED = "downloaded"
}
/**
 * Plugin analytics record
 */
export interface PluginAnalytics {
    pluginId: string;
    totalDownloads: number;
    activeInstalls: number;
    averageRating: number;
    totalRatings: number;
    lastUpdated: number;
    createdAt: number;
}
/**
 * Download record
 */
export interface DownloadRecord {
    pluginId: string;
    userId: string;
    timestamp: number;
    version: string;
    platform?: string;
}
/**
 * Rating record
 */
export interface RatingRecord {
    pluginId: string;
    userId: string;
    rating: number;
    review?: string;
    timestamp: number;
}
/**
 * Install record
 */
export interface InstallRecord {
    pluginId: string;
    userId: string;
    version: string;
    installedAt: number;
    active: boolean;
    lastActivated?: number;
}
/**
 * Analytics event
 */
export interface AnalyticsEvent {
    pluginId: string;
    userId: string;
    event: LifecycleEvent;
    timestamp: number;
    metadata?: Record<string, any>;
}
/**
 * Trend data
 */
export interface TrendData {
    pluginId: string;
    period: 'daily' | 'weekly' | 'monthly';
    downloads: number[];
    installs: number[];
    ratings: number[];
    timestamps: number[];
}
/**
 * Marketplace analytics
 */
export declare class MarketplaceAnalytics extends EventEmitter {
    private analytics;
    private downloads;
    private ratings;
    private installs;
    private events;
    /**
     * Track download
     */
    trackDownload(record: DownloadRecord): void;
    /**
     * Track install
     */
    trackInstall(record: InstallRecord): void;
    /**
     * Track uninstall
     */
    trackUninstall(pluginId: string, userId: string): void;
    /**
     * Track rating
     */
    trackRating(record: RatingRecord): void;
    /**
     * Track lifecycle event
     */
    trackEvent(event: AnalyticsEvent): void;
    /**
     * Get plugin analytics
     */
    getAnalytics(pluginId: string): PluginAnalytics | undefined;
    /**
     * Get all plugin analytics
     */
    getAllAnalytics(): PluginAnalytics[];
    /**
     * Get downloads for plugin
     */
    getDownloads(pluginId: string): DownloadRecord[];
    /**
     * Get ratings for plugin
     */
    getRatings(pluginId: string): RatingRecord[];
    /**
     * Get active installs for plugin
     */
    getActiveInstalls(pluginId: string): InstallRecord[];
    /**
     * Get top plugins by downloads
     */
    getTopByDownloads(limit?: number): PluginAnalytics[];
    /**
     * Get top plugins by rating
     */
    getTopByRating(limit?: number, minRatings?: number): PluginAnalytics[];
    /**
     * Get top plugins by active installs
     */
    getTopByActiveInstalls(limit?: number): PluginAnalytics[];
    /**
     * Get trending plugins
     */
    getTrending(period: 'daily' | 'weekly' | 'monthly', limit?: number): PluginAnalytics[];
    /**
     * Get trend data for plugin
     */
    getTrendData(pluginId: string, period: 'daily' | 'weekly' | 'monthly'): TrendData;
    /**
     * Get marketplace statistics
     */
    getStatistics(): {
        totalPlugins: number;
        totalDownloads: number;
        totalActiveInstalls: number;
        totalRatings: number;
        averageRating: number;
    };
    /**
     * Clear analytics for plugin
     */
    clearAnalytics(pluginId: string): void;
    /**
     * Clear all analytics
     */
    clearAll(): void;
    /**
     * Update analytics
     */
    private updateAnalytics;
    /**
     * Get period in milliseconds
     */
    private getPeriodMs;
}
/**
 * Create marketplace analytics
 */
export declare function createMarketplaceAnalytics(): MarketplaceAnalytics;
/**
 * Get global analytics
 */
export declare function getGlobalAnalytics(): MarketplaceAnalytics;
/**
 * Reset global analytics
 */
export declare function resetGlobalAnalytics(): void;
//# sourceMappingURL=MarketplaceAnalytics.d.ts.map