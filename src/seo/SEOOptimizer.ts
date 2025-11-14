/**
 * SEO Optimizer
 * Sprint 5 Day 49: Marketplace and documentation SEO optimization
 */

import { EventEmitter } from 'events'

/**
 * SEO metadata
 */
export interface SEOMetadata {
  title: string
  description: string
  keywords: string[]
  author?: string
  canonical?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

/**
 * Sitemap entry
 */
export interface SitemapEntry {
  url: string
  lastmod: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

/**
 * Schema.org structured data
 */
export interface StructuredData {
  '@context': string
  '@type': string
  [key: string]: any
}

/**
 * SEO validation result
 */
export interface SEOValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

/**
 * SEO optimizer
 */
export class SEOOptimizer extends EventEmitter {
  private metadata = new Map<string, SEOMetadata>()
  private sitemapEntries: SitemapEntry[] = []
  private structuredData = new Map<string, StructuredData>()

  /**
   * Set page metadata
   */
  setMetadata(path: string, metadata: SEOMetadata): void {
    this.metadata.set(path, metadata)
    this.emit('metadata-set', { path, metadata })
  }

  /**
   * Get page metadata
   */
  getMetadata(path: string): SEOMetadata | undefined {
    return this.metadata.get(path)
  }

  /**
   * Get all metadata
   */
  getAllMetadata(): Map<string, SEOMetadata> {
    return new Map(this.metadata)
  }

  /**
   * Add sitemap entry
   */
  addSitemapEntry(entry: SitemapEntry): void {
    this.sitemapEntries.push(entry)
    this.emit('sitemap-entry-added', { entry })
  }

  /**
   * Get sitemap entries
   */
  getSitemapEntries(): SitemapEntry[] {
    return [...this.sitemapEntries]
  }

  /**
   * Generate sitemap XML
   */
  generateSitemap(): string {
    const entries = this.sitemapEntries
      .map((entry) => {
        const changefreq = entry.changefreq
          ? `  <changefreq>${entry.changefreq}</changefreq>\n`
          : ''
        const priority = entry.priority !== undefined
          ? `  <priority>${entry.priority}</priority>\n`
          : ''

        return `<url>
  <loc>${entry.url}</loc>
  <lastmod>${entry.lastmod}</lastmod>
${changefreq}${priority}</url>`
      })
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`
  }

  /**
   * Set structured data
   */
  setStructuredData(path: string, data: StructuredData): void {
    this.structuredData.set(path, data)
    this.emit('structured-data-set', { path, data })
  }

  /**
   * Get structured data
   */
  getStructuredData(path: string): StructuredData | undefined {
    return this.structuredData.get(path)
  }

  /**
   * Generate meta tags HTML
   */
  generateMetaTags(path: string): string {
    const metadata = this.metadata.get(path)
    if (!metadata) return ''

    const tags: string[] = []

    // Basic meta tags
    tags.push(`<title>${metadata.title}</title>`)
    tags.push(`<meta name="description" content="${metadata.description}">`)
    tags.push(`<meta name="keywords" content="${metadata.keywords.join(', ')}">`)

    if (metadata.author) {
      tags.push(`<meta name="author" content="${metadata.author}">`)
    }

    if (metadata.canonical) {
      tags.push(`<link rel="canonical" href="${metadata.canonical}">`)
    }

    // Open Graph tags
    if (metadata.ogTitle || metadata.title) {
      tags.push(`<meta property="og:title" content="${metadata.ogTitle || metadata.title}">`)
    }

    if (metadata.ogDescription || metadata.description) {
      tags.push(`<meta property="og:description" content="${metadata.ogDescription || metadata.description}">`)
    }

    if (metadata.ogImage) {
      tags.push(`<meta property="og:image" content="${metadata.ogImage}">`)
    }

    if (metadata.ogType) {
      tags.push(`<meta property="og:type" content="${metadata.ogType}">`)
    }

    // Twitter Card tags
    if (metadata.twitterCard) {
      tags.push(`<meta name="twitter:card" content="${metadata.twitterCard}">`)
    }

    if (metadata.twitterTitle || metadata.title) {
      tags.push(`<meta name="twitter:title" content="${metadata.twitterTitle || metadata.title}">`)
    }

    if (metadata.twitterDescription || metadata.description) {
      tags.push(`<meta name="twitter:description" content="${metadata.twitterDescription || metadata.description}">`)
    }

    if (metadata.twitterImage) {
      tags.push(`<meta name="twitter:image" content="${metadata.twitterImage}">`)
    }

    return tags.join('\n')
  }

  /**
   * Generate structured data JSON-LD
   */
  generateStructuredDataScript(path: string): string {
    const data = this.structuredData.get(path)
    if (!data) return ''

    return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`
  }

  /**
   * Validate metadata
   */
  validateMetadata(metadata: SEOMetadata): SEOValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    // Title validation
    if (!metadata.title) {
      errors.push('Title is required')
      score -= 20
    } else if (metadata.title.length < 10) {
      warnings.push('Title should be at least 10 characters')
      score -= 5
    } else if (metadata.title.length > 60) {
      warnings.push('Title should be less than 60 characters')
      score -= 5
    }

    // Description validation
    if (!metadata.description) {
      errors.push('Description is required')
      score -= 20
    } else if (metadata.description.length < 50) {
      warnings.push('Description should be at least 50 characters')
      score -= 5
    } else if (metadata.description.length > 160) {
      warnings.push('Description should be less than 160 characters')
      score -= 5
    }

    // Keywords validation
    if (!metadata.keywords || metadata.keywords.length === 0) {
      warnings.push('Keywords are recommended')
      score -= 5
    } else if (metadata.keywords.length > 10) {
      warnings.push('Too many keywords (recommended: 5-10)')
      score -= 5
    }

    // Open Graph validation
    if (!metadata.ogTitle && !metadata.title) {
      warnings.push('Open Graph title is recommended')
      score -= 5
    }

    if (!metadata.ogImage) {
      warnings.push('Open Graph image is recommended')
      score -= 5
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metadata.clear()
    this.sitemapEntries = []
    this.structuredData.clear()
    this.emit('cleared')
  }

  /**
   * Get SEO statistics
   */
  getStatistics(): {
    totalPages: number
    totalSitemapEntries: number
    totalStructuredData: number
    averageScore: number
    pagesWithWarnings: number
    pagesWithErrors: number
  } {
    const metadataArray = Array.from(this.metadata.values())

    const validations = metadataArray.map((m) => this.validateMetadata(m))

    const totalScore = validations.reduce((sum, v) => sum + v.score, 0)
    const averageScore = metadataArray.length > 0 ? totalScore / metadataArray.length : 0

    const pagesWithWarnings = validations.filter((v) => v.warnings.length > 0).length
    const pagesWithErrors = validations.filter((v) => v.errors.length > 0).length

    return {
      totalPages: this.metadata.size,
      totalSitemapEntries: this.sitemapEntries.length,
      totalStructuredData: this.structuredData.size,
      averageScore,
      pagesWithWarnings,
      pagesWithErrors,
    }
  }
}

/**
 * Create SEO optimizer
 */
export function createSEOOptimizer(): SEOOptimizer {
  return new SEOOptimizer()
}

/**
 * Global SEO optimizer
 */
let globalOptimizer: SEOOptimizer | null = null

/**
 * Get global SEO optimizer
 */
export function getGlobalOptimizer(): SEOOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = createSEOOptimizer()
  }
  return globalOptimizer
}

/**
 * Reset global SEO optimizer
 */
export function resetGlobalOptimizer(): void {
  globalOptimizer = null
}
