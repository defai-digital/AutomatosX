/**
 * SEO Optimizer Tests
 * Sprint 5 Day 49: SEO optimization tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SEOOptimizer,
  createSEOOptimizer,
  getGlobalOptimizer,
  resetGlobalOptimizer,
  type SEOMetadata,
} from '../../seo/SEOOptimizer.js'

describe('SEOOptimizer', () => {
  let optimizer: SEOOptimizer

  const sampleMetadata: SEOMetadata = {
    title: 'Test Page Title',
    description: 'This is a test page description that is long enough for SEO validation.',
    keywords: ['test', 'seo', 'optimization'],
    author: 'Test Author',
    canonical: 'https://example.com/test',
  }

  beforeEach(() => {
    optimizer = createSEOOptimizer()
  })

  describe('Metadata Management', () => {
    it('should set metadata for a page', () => {
      optimizer.setMetadata('/test', sampleMetadata)

      const metadata = optimizer.getMetadata('/test')

      expect(metadata).toEqual(sampleMetadata)
    })

    it('should emit metadata-set event', () => {
      const listener = vi.fn()
      optimizer.on('metadata-set', listener)

      optimizer.setMetadata('/test', sampleMetadata)

      expect(listener).toHaveBeenCalledWith({
        path: '/test',
        metadata: sampleMetadata,
      })
    })

    it('should get all metadata', () => {
      optimizer.setMetadata('/page1', sampleMetadata)
      optimizer.setMetadata('/page2', { ...sampleMetadata, title: 'Page 2' })

      const allMetadata = optimizer.getAllMetadata()

      expect(allMetadata.size).toBe(2)
      expect(allMetadata.get('/page1')).toEqual(sampleMetadata)
    })

    it('should return undefined for non-existent page', () => {
      const metadata = optimizer.getMetadata('/nonexistent')

      expect(metadata).toBeUndefined()
    })
  })

  describe('Sitemap Management', () => {
    it('should add sitemap entry', () => {
      optimizer.addSitemapEntry({
        url: 'https://example.com/page1',
        lastmod: '2025-01-01',
      })

      const entries = optimizer.getSitemapEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0].url).toBe('https://example.com/page1')
    })

    it('should emit sitemap-entry-added event', () => {
      const listener = vi.fn()
      optimizer.on('sitemap-entry-added', listener)

      const entry = {
        url: 'https://example.com/page1',
        lastmod: '2025-01-01',
      }

      optimizer.addSitemapEntry(entry)

      expect(listener).toHaveBeenCalledWith({ entry })
    })

    it('should add entry with all fields', () => {
      optimizer.addSitemapEntry({
        url: 'https://example.com/page1',
        lastmod: '2025-01-01',
        changefreq: 'daily',
        priority: 0.8,
      })

      const entries = optimizer.getSitemapEntries()

      expect(entries[0]).toMatchObject({
        changefreq: 'daily',
        priority: 0.8,
      })
    })

    it('should generate sitemap XML', () => {
      optimizer.addSitemapEntry({
        url: 'https://example.com/page1',
        lastmod: '2025-01-01',
        changefreq: 'weekly',
        priority: 0.9,
      })

      const sitemap = optimizer.generateSitemap()

      expect(sitemap).toContain('<?xml version="1.0"')
      expect(sitemap).toContain('<urlset')
      expect(sitemap).toContain('https://example.com/page1')
      expect(sitemap).toContain('<lastmod>2025-01-01</lastmod>')
      expect(sitemap).toContain('<changefreq>weekly</changefreq>')
      expect(sitemap).toContain('<priority>0.9</priority>')
    })
  })

  describe('Structured Data', () => {
    it('should set structured data', () => {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Test Article',
      }

      optimizer.setStructuredData('/test', structuredData)

      const data = optimizer.getStructuredData('/test')

      expect(data).toEqual(structuredData)
    })

    it('should emit structured-data-set event', () => {
      const listener = vi.fn()
      optimizer.on('structured-data-set', listener)

      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
      }

      optimizer.setStructuredData('/test', structuredData)

      expect(listener).toHaveBeenCalledWith({
        path: '/test',
        data: structuredData,
      })
    })

    it('should return undefined for non-existent structured data', () => {
      const data = optimizer.getStructuredData('/nonexistent')

      expect(data).toBeUndefined()
    })
  })

  describe('Meta Tags Generation', () => {
    beforeEach(() => {
      optimizer.setMetadata('/test', sampleMetadata)
    })

    it('should generate basic meta tags', () => {
      const tags = optimizer.generateMetaTags('/test')

      expect(tags).toContain('<title>Test Page Title</title>')
      expect(tags).toContain('<meta name="description"')
      expect(tags).toContain('<meta name="keywords"')
    })

    it('should generate canonical link', () => {
      const tags = optimizer.generateMetaTags('/test')

      expect(tags).toContain('<link rel="canonical" href="https://example.com/test">')
    })

    it('should generate Open Graph tags', () => {
      optimizer.setMetadata('/test', {
        ...sampleMetadata,
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.jpg',
        ogType: 'article',
      })

      const tags = optimizer.generateMetaTags('/test')

      expect(tags).toContain('<meta property="og:title" content="OG Title">')
      expect(tags).toContain('<meta property="og:description"')
      expect(tags).toContain('<meta property="og:image"')
      expect(tags).toContain('<meta property="og:type" content="article">')
    })

    it('should generate Twitter Card tags', () => {
      optimizer.setMetadata('/test', {
        ...sampleMetadata,
        twitterCard: 'summary_large_image',
        twitterTitle: 'Twitter Title',
        twitterDescription: 'Twitter Description',
        twitterImage: 'https://example.com/twitter-image.jpg',
      })

      const tags = optimizer.generateMetaTags('/test')

      expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">')
      expect(tags).toContain('<meta name="twitter:title"')
      expect(tags).toContain('<meta name="twitter:description"')
      expect(tags).toContain('<meta name="twitter:image"')
    })

    it('should return empty string for non-existent page', () => {
      const tags = optimizer.generateMetaTags('/nonexistent')

      expect(tags).toBe('')
    })
  })

  describe('Structured Data Generation', () => {
    it('should generate JSON-LD script', () => {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Test Article',
        author: 'John Doe',
      }

      optimizer.setStructuredData('/test', structuredData)

      const script = optimizer.generateStructuredDataScript('/test')

      expect(script).toContain('<script type="application/ld+json">')
      expect(script).toContain('"@context": "https://schema.org"')
      expect(script).toContain('"@type": "Article"')
      expect(script).toContain('</script>')
    })

    it('should return empty string for non-existent page', () => {
      const script = optimizer.generateStructuredDataScript('/nonexistent')

      expect(script).toBe('')
    })
  })

  describe('Metadata Validation', () => {
    it('should validate complete metadata', () => {
      const result = optimizer.validateMetadata(sampleMetadata)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.score).toBeGreaterThan(80)
    })

    it('should require title', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        title: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Title is required')
    })

    it('should require description', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        description: '',
      })

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Description is required')
    })

    it('should warn about short title', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        title: 'Short',
      })

      expect(result.warnings).toContain('Title should be at least 10 characters')
    })

    it('should warn about long title', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        title: 'A'.repeat(70),
      })

      expect(result.warnings).toContain('Title should be less than 60 characters')
    })

    it('should warn about short description', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        description: 'Too short',
      })

      expect(result.warnings).toContain('Description should be at least 50 characters')
    })

    it('should warn about long description', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        description: 'A'.repeat(200),
      })

      expect(result.warnings).toContain('Description should be less than 160 characters')
    })

    it('should warn about missing keywords', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        keywords: [],
      })

      expect(result.warnings).toContain('Keywords are recommended')
    })

    it('should warn about too many keywords', () => {
      const result = optimizer.validateMetadata({
        ...sampleMetadata,
        keywords: Array(15).fill('keyword'),
      })

      expect(result.warnings).toContain('Too many keywords (recommended: 5-10)')
    })

    it('should calculate score correctly', () => {
      const perfect = optimizer.validateMetadata(sampleMetadata)
      const missing = optimizer.validateMetadata({
        title: '',
        description: '',
        keywords: [],
      })

      expect(perfect.score).toBeGreaterThan(80)
      expect(missing.score).toBeLessThan(70)
    })
  })

  describe('Clear', () => {
    beforeEach(() => {
      optimizer.setMetadata('/test', sampleMetadata)
      optimizer.addSitemapEntry({
        url: 'https://example.com/test',
        lastmod: '2025-01-01',
      })
      optimizer.setStructuredData('/test', {
        '@context': 'https://schema.org',
        '@type': 'Article',
      })
    })

    it('should clear all data', () => {
      optimizer.clear()

      expect(optimizer.getAllMetadata().size).toBe(0)
      expect(optimizer.getSitemapEntries()).toHaveLength(0)
      expect(optimizer.getStructuredData('/test')).toBeUndefined()
    })

    it('should emit cleared event', () => {
      const listener = vi.fn()
      optimizer.on('cleared', listener)

      optimizer.clear()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      optimizer.setMetadata('/page1', sampleMetadata)
      optimizer.setMetadata('/page2', {
        ...sampleMetadata,
        title: 'Page 2',
      })
      optimizer.setMetadata('/page3', {
        title: '',
        description: '',
        keywords: [],
      })

      optimizer.addSitemapEntry({
        url: 'https://example.com/page1',
        lastmod: '2025-01-01',
      })

      optimizer.setStructuredData('/page1', {
        '@context': 'https://schema.org',
        '@type': 'Article',
      })
    })

    it('should calculate statistics', () => {
      const stats = optimizer.getStatistics()

      expect(stats).toMatchObject({
        totalPages: 3,
        totalSitemapEntries: 1,
        totalStructuredData: 1,
      })
      expect(stats.averageScore).toBeGreaterThan(0)
    })

    it('should count pages with warnings', () => {
      const stats = optimizer.getStatistics()

      expect(stats.pagesWithWarnings).toBeGreaterThan(0)
    })

    it('should count pages with errors', () => {
      const stats = optimizer.getStatistics()

      expect(stats.pagesWithErrors).toBe(1) // page3 has errors
    })
  })

  describe('Global Optimizer', () => {
    beforeEach(() => {
      resetGlobalOptimizer()
    })

    it('should get global optimizer', () => {
      const global = getGlobalOptimizer()

      expect(global).toBeInstanceOf(SEOOptimizer)
    })

    it('should return same instance', () => {
      const opt1 = getGlobalOptimizer()
      const opt2 = getGlobalOptimizer()

      expect(opt1).toBe(opt2)
    })

    it('should reset global optimizer', () => {
      const opt1 = getGlobalOptimizer()

      resetGlobalOptimizer()

      const opt2 = getGlobalOptimizer()

      expect(opt2).not.toBe(opt1)
    })
  })
})
