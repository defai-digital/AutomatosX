/**
 * Marketplace Analytics API Tests
 * Sprint 6 Day 52: Analytics API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MarketplaceAnalyticsAPI,
  createMarketplaceAnalyticsAPI,
  getGlobalAPI,
  resetGlobalAPI,
  ExportFormat,
} from '../../marketplace/MarketplaceAnalyticsAPI.js'
import { createMarketplaceAnalytics } from '../../marketplace/MarketplaceAnalytics.js'

describe('MarketplaceAnalyticsAPI', () => {
  let analyticsAPI: MarketplaceAnalyticsAPI

  beforeEach(() => {
    const analytics = createMarketplaceAnalytics()
    analyticsAPI = createMarketplaceAnalyticsAPI(analytics)
  })

  describe('Community Overview', () => {
    it('should get community overview', () => {
      const overview = analyticsAPI.getCommunityOverview('weekly')

      expect(overview).toMatchObject({
        totalPlugins: 0,
        totalDownloads: 0,
        totalActiveInstalls: 0,
        totalRatings: 0,
        averageRating: 0,
      })
      expect(overview.topPluginsByDownloads).toBeInstanceOf(Array)
      expect(overview.categoryDistribution).toBeInstanceOf(Object)
    })

    it('should emit overview-requested event', () => {
      const listener = vi.fn()
      analyticsAPI.on('overview-requested', listener)

      analyticsAPI.getCommunityOverview('daily')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'daily',
        })
      )
    })

    it('should calculate category distribution', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      // Add plugins with categories
      analytics.trackDownload({
        pluginId: 'agent:test1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      analytics.trackDownload({
        pluginId: 'agent:test2',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      analytics.trackDownload({
        pluginId: 'tool:test3',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      const overview = api.getCommunityOverview()

      expect(overview.categoryDistribution['agent']).toBe(2)
      expect(overview.categoryDistribution['tool']).toBe(1)
    })

    it('should include top plugins by downloads', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      // Add downloads
      for (let i = 0; i < 5; i++) {
        analytics.trackDownload({
          pluginId: 'plugin1',
          userId: `user${i}`,
          timestamp: Date.now(),
          version: '1.0.0',
        })
      }

      const overview = api.getCommunityOverview()

      expect(overview.topPluginsByDownloads.length).toBeGreaterThan(0)
      expect(overview.topPluginsByDownloads[0].pluginId).toBe('plugin1')
      expect(overview.topPluginsByDownloads[0].totalDownloads).toBe(5)
    })

    it('should include top plugins by rating', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      // Add ratings (need 5+ for min threshold)
      for (let i = 0; i < 6; i++) {
        analytics.trackRating({
          pluginId: 'plugin1',
          userId: `user${i}`,
          rating: 5,
          timestamp: Date.now(),
        })
      }

      const overview = api.getCommunityOverview()

      expect(overview.topPluginsByRating.length).toBeGreaterThan(0)
      expect(overview.topPluginsByRating[0].averageRating).toBe(5)
    })
  })

  describe('Plugin Detail Analytics', () => {
    it('should get plugin detail analytics', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      const detail = api.getPluginDetailAnalytics('plugin1')

      expect(detail).toBeDefined()
      expect(detail?.pluginId).toBe('plugin1')
      expect(detail?.metrics).toBeDefined()
      expect(detail?.downloadsTrend).toBeDefined()
      expect(detail?.versionAdoption).toBeInstanceOf(Array)
      expect(detail?.ratingBreakdown).toBeInstanceOf(Array)
    })

    it('should return null for non-existent plugin', () => {
      const detail = analyticsAPI.getPluginDetailAnalytics('non-existent')

      expect(detail).toBeNull()
    })

    it('should emit plugin-detail-requested event', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      const listener = vi.fn()
      api.on('plugin-detail-requested', listener)

      api.getPluginDetailAnalytics('plugin1')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'plugin1',
        })
      )
    })

    it('should calculate version adoption', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackInstall({
        pluginId: 'plugin1',
        userId: 'user1',
        version: '1.0.0',
        installedAt: Date.now(),
        active: true,
      })

      analytics.trackInstall({
        pluginId: 'plugin1',
        userId: 'user2',
        version: '1.0.0',
        installedAt: Date.now(),
        active: true,
      })

      analytics.trackInstall({
        pluginId: 'plugin1',
        userId: 'user3',
        version: '2.0.0',
        installedAt: Date.now(),
        active: true,
      })

      const detail = api.getPluginDetailAnalytics('plugin1')

      expect(detail?.versionAdoption).toHaveLength(2)
      expect(detail?.versionAdoption[0].version).toBe('1.0.0')
      expect(detail?.versionAdoption[0].installs).toBe(2)
      expect(detail?.versionAdoption[0].percentage).toBeCloseTo(66.67, 1)
    })

    it('should calculate rating breakdown', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackRating({
        pluginId: 'plugin1',
        userId: 'user1',
        rating: 5,
        timestamp: Date.now(),
      })

      analytics.trackRating({
        pluginId: 'plugin1',
        userId: 'user2',
        rating: 4,
        timestamp: Date.now(),
      })

      analytics.trackRating({
        pluginId: 'plugin1',
        userId: 'user3',
        rating: 4,
        timestamp: Date.now(),
      })

      const detail = api.getPluginDetailAnalytics('plugin1')

      const fiveStars = detail?.ratingBreakdown.find((r) => r.stars === 5)
      const fourStars = detail?.ratingBreakdown.find((r) => r.stars === 4)

      expect(fiveStars?.count).toBe(1)
      expect(fourStars?.count).toBe(2)
    })

    it('should calculate platform distribution', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
        platform: 'darwin',
      })

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user2',
        timestamp: Date.now(),
        version: '1.0.0',
        platform: 'linux',
      })

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user3',
        timestamp: Date.now(),
        version: '1.0.0',
        platform: 'darwin',
      })

      const detail = api.getPluginDetailAnalytics('plugin1')

      expect(detail?.activeUsersByPlatform['darwin']).toBe(2)
      expect(detail?.activeUsersByPlatform['linux']).toBe(1)
    })
  })

  describe('Export Functionality', () => {
    it('should export plugin analytics as JSON', async () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      const exported = await api.exportPluginAnalytics('plugin1', ExportFormat.JSON)

      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported as string)
      expect(parsed.pluginId).toBe('plugin1')
    })

    it('should export plugin analytics as CSV', async () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: Date.now(),
        version: '1.0.0',
      })

      const exported = await api.exportPluginAnalytics('plugin1', ExportFormat.CSV)

      expect(typeof exported).toBe('string')
      expect((exported as string).includes('Plugin Analytics Report')).toBe(true)
    })

    it('should throw error for non-existent plugin export', async () => {
      await expect(
        analyticsAPI.exportPluginAnalytics('non-existent', ExportFormat.JSON)
      ).rejects.toThrow('No analytics found')
    })

    it('should export community overview as JSON', async () => {
      const exported = await analyticsAPI.exportCommunityOverview(ExportFormat.JSON)

      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported as string)
      expect(parsed.totalPlugins).toBeDefined()
    })

    it('should export community overview as CSV', async () => {
      const exported = await analyticsAPI.exportCommunityOverview(ExportFormat.CSV)

      expect(typeof exported).toBe('string')
      expect((exported as string).includes('Community Overview Report')).toBe(true)
    })
  })

  describe('Trending Plugins', () => {
    it('should get trending plugins with metadata', () => {
      const analytics = createMarketplaceAnalytics()
      const api = createMarketplaceAnalyticsAPI(analytics)

      const now = Date.now()

      analytics.trackDownload({
        pluginId: 'plugin1',
        userId: 'user1',
        timestamp: now - 3600000, // 1 hour ago
        version: '1.0.0',
      })

      const trending = api.getTrendingPlugins('daily', 5)

      expect(trending).toBeInstanceOf(Array)
      if (trending.length > 0) {
        expect(trending[0].trendData).toBeDefined()
      }
    })
  })

  describe('Global API', () => {
    beforeEach(() => {
      resetGlobalAPI()
    })

    it('should get global API', () => {
      const analytics = createMarketplaceAnalytics()
      const global = getGlobalAPI(analytics)

      expect(global).toBeInstanceOf(MarketplaceAnalyticsAPI)
    })

    it('should reset global API', () => {
      const analytics = createMarketplaceAnalytics()
      const api1 = getGlobalAPI(analytics)

      resetGlobalAPI()

      const api2 = getGlobalAPI(analytics)

      expect(api2).not.toBe(api1)
    })
  })
})
