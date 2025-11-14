/**
 * SEO Optimizer
 * Sprint 5 Day 49: Marketplace and documentation SEO optimization
 */
import { EventEmitter } from 'events';
/**
 * SEO optimizer
 */
export class SEOOptimizer extends EventEmitter {
    metadata = new Map();
    sitemapEntries = [];
    structuredData = new Map();
    /**
     * Set page metadata
     */
    setMetadata(path, metadata) {
        this.metadata.set(path, metadata);
        this.emit('metadata-set', { path, metadata });
    }
    /**
     * Get page metadata
     */
    getMetadata(path) {
        return this.metadata.get(path);
    }
    /**
     * Get all metadata
     */
    getAllMetadata() {
        return new Map(this.metadata);
    }
    /**
     * Add sitemap entry
     */
    addSitemapEntry(entry) {
        this.sitemapEntries.push(entry);
        this.emit('sitemap-entry-added', { entry });
    }
    /**
     * Get sitemap entries
     */
    getSitemapEntries() {
        return [...this.sitemapEntries];
    }
    /**
     * Generate sitemap XML
     */
    generateSitemap() {
        const entries = this.sitemapEntries
            .map((entry) => {
            const changefreq = entry.changefreq
                ? `  <changefreq>${entry.changefreq}</changefreq>\n`
                : '';
            const priority = entry.priority !== undefined
                ? `  <priority>${entry.priority}</priority>\n`
                : '';
            return `<url>
  <loc>${entry.url}</loc>
  <lastmod>${entry.lastmod}</lastmod>
${changefreq}${priority}</url>`;
        })
            .join('\n');
        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
    }
    /**
     * Set structured data
     */
    setStructuredData(path, data) {
        this.structuredData.set(path, data);
        this.emit('structured-data-set', { path, data });
    }
    /**
     * Get structured data
     */
    getStructuredData(path) {
        return this.structuredData.get(path);
    }
    /**
     * Generate meta tags HTML
     */
    generateMetaTags(path) {
        const metadata = this.metadata.get(path);
        if (!metadata)
            return '';
        const tags = [];
        // Basic meta tags
        tags.push(`<title>${metadata.title}</title>`);
        tags.push(`<meta name="description" content="${metadata.description}">`);
        tags.push(`<meta name="keywords" content="${metadata.keywords.join(', ')}">`);
        if (metadata.author) {
            tags.push(`<meta name="author" content="${metadata.author}">`);
        }
        if (metadata.canonical) {
            tags.push(`<link rel="canonical" href="${metadata.canonical}">`);
        }
        // Open Graph tags
        if (metadata.ogTitle || metadata.title) {
            tags.push(`<meta property="og:title" content="${metadata.ogTitle || metadata.title}">`);
        }
        if (metadata.ogDescription || metadata.description) {
            tags.push(`<meta property="og:description" content="${metadata.ogDescription || metadata.description}">`);
        }
        if (metadata.ogImage) {
            tags.push(`<meta property="og:image" content="${metadata.ogImage}">`);
        }
        if (metadata.ogType) {
            tags.push(`<meta property="og:type" content="${metadata.ogType}">`);
        }
        // Twitter Card tags
        if (metadata.twitterCard) {
            tags.push(`<meta name="twitter:card" content="${metadata.twitterCard}">`);
        }
        if (metadata.twitterTitle || metadata.title) {
            tags.push(`<meta name="twitter:title" content="${metadata.twitterTitle || metadata.title}">`);
        }
        if (metadata.twitterDescription || metadata.description) {
            tags.push(`<meta name="twitter:description" content="${metadata.twitterDescription || metadata.description}">`);
        }
        if (metadata.twitterImage) {
            tags.push(`<meta name="twitter:image" content="${metadata.twitterImage}">`);
        }
        return tags.join('\n');
    }
    /**
     * Generate structured data JSON-LD
     */
    generateStructuredDataScript(path) {
        const data = this.structuredData.get(path);
        if (!data)
            return '';
        return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`;
    }
    /**
     * Validate metadata
     */
    validateMetadata(metadata) {
        const errors = [];
        const warnings = [];
        let score = 100;
        // Title validation
        if (!metadata.title) {
            errors.push('Title is required');
            score -= 20;
        }
        else if (metadata.title.length < 10) {
            warnings.push('Title should be at least 10 characters');
            score -= 5;
        }
        else if (metadata.title.length > 60) {
            warnings.push('Title should be less than 60 characters');
            score -= 5;
        }
        // Description validation
        if (!metadata.description) {
            errors.push('Description is required');
            score -= 20;
        }
        else if (metadata.description.length < 50) {
            warnings.push('Description should be at least 50 characters');
            score -= 5;
        }
        else if (metadata.description.length > 160) {
            warnings.push('Description should be less than 160 characters');
            score -= 5;
        }
        // Keywords validation
        if (!metadata.keywords || metadata.keywords.length === 0) {
            warnings.push('Keywords are recommended');
            score -= 5;
        }
        else if (metadata.keywords.length > 10) {
            warnings.push('Too many keywords (recommended: 5-10)');
            score -= 5;
        }
        // Open Graph validation
        if (!metadata.ogTitle && !metadata.title) {
            warnings.push('Open Graph title is recommended');
            score -= 5;
        }
        if (!metadata.ogImage) {
            warnings.push('Open Graph image is recommended');
            score -= 5;
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score: Math.max(0, score),
        };
    }
    /**
     * Clear all data
     */
    clear() {
        this.metadata.clear();
        this.sitemapEntries = [];
        this.structuredData.clear();
        this.emit('cleared');
    }
    /**
     * Get SEO statistics
     */
    getStatistics() {
        const metadataArray = Array.from(this.metadata.values());
        const validations = metadataArray.map((m) => this.validateMetadata(m));
        const totalScore = validations.reduce((sum, v) => sum + v.score, 0);
        const averageScore = metadataArray.length > 0 ? totalScore / metadataArray.length : 0;
        const pagesWithWarnings = validations.filter((v) => v.warnings.length > 0).length;
        const pagesWithErrors = validations.filter((v) => v.errors.length > 0).length;
        return {
            totalPages: this.metadata.size,
            totalSitemapEntries: this.sitemapEntries.length,
            totalStructuredData: this.structuredData.size,
            averageScore,
            pagesWithWarnings,
            pagesWithErrors,
        };
    }
}
/**
 * Create SEO optimizer
 */
export function createSEOOptimizer() {
    return new SEOOptimizer();
}
/**
 * Global SEO optimizer
 */
let globalOptimizer = null;
/**
 * Get global SEO optimizer
 */
export function getGlobalOptimizer() {
    if (!globalOptimizer) {
        globalOptimizer = createSEOOptimizer();
    }
    return globalOptimizer;
}
/**
 * Reset global SEO optimizer
 */
export function resetGlobalOptimizer() {
    globalOptimizer = null;
}
//# sourceMappingURL=SEOOptimizer.js.map