/**
 * SEO Optimizer
 * Sprint 5 Day 49: Marketplace and documentation SEO optimization
 */
import { EventEmitter } from 'events';
/**
 * SEO metadata
 */
export interface SEOMetadata {
    title: string;
    description: string;
    keywords: string[];
    author?: string;
    canonical?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
}
/**
 * Sitemap entry
 */
export interface SitemapEntry {
    url: string;
    lastmod: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}
/**
 * Schema.org structured data
 */
export interface StructuredData {
    '@context': string;
    '@type': string;
    [key: string]: any;
}
/**
 * SEO validation result
 */
export interface SEOValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
}
/**
 * SEO optimizer
 */
export declare class SEOOptimizer extends EventEmitter {
    private metadata;
    private sitemapEntries;
    private structuredData;
    /**
     * Set page metadata
     */
    setMetadata(path: string, metadata: SEOMetadata): void;
    /**
     * Get page metadata
     */
    getMetadata(path: string): SEOMetadata | undefined;
    /**
     * Get all metadata
     */
    getAllMetadata(): Map<string, SEOMetadata>;
    /**
     * Add sitemap entry
     */
    addSitemapEntry(entry: SitemapEntry): void;
    /**
     * Get sitemap entries
     */
    getSitemapEntries(): SitemapEntry[];
    /**
     * Generate sitemap XML
     */
    generateSitemap(): string;
    /**
     * Set structured data
     */
    setStructuredData(path: string, data: StructuredData): void;
    /**
     * Get structured data
     */
    getStructuredData(path: string): StructuredData | undefined;
    /**
     * Generate meta tags HTML
     */
    generateMetaTags(path: string): string;
    /**
     * Generate structured data JSON-LD
     */
    generateStructuredDataScript(path: string): string;
    /**
     * Validate metadata
     */
    validateMetadata(metadata: SEOMetadata): SEOValidationResult;
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Get SEO statistics
     */
    getStatistics(): {
        totalPages: number;
        totalSitemapEntries: number;
        totalStructuredData: number;
        averageScore: number;
        pagesWithWarnings: number;
        pagesWithErrors: number;
    };
}
/**
 * Create SEO optimizer
 */
export declare function createSEOOptimizer(): SEOOptimizer;
/**
 * Get global SEO optimizer
 */
export declare function getGlobalOptimizer(): SEOOptimizer;
/**
 * Reset global SEO optimizer
 */
export declare function resetGlobalOptimizer(): void;
//# sourceMappingURL=SEOOptimizer.d.ts.map