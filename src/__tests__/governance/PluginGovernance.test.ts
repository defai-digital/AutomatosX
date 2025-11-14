/**
 * Plugin Governance Tests
 * Sprint 6 Day 52: Verification tiers and governance tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PluginGovernance,
  createPluginGovernance,
  getGlobalGovernance,
  resetGlobalGovernance,
  VerificationTier,
  ReviewStatus,
  type ReviewSubmission,
} from '../../governance/PluginGovernance.js'

describe('PluginGovernance', () => {
  let governance: PluginGovernance

  beforeEach(() => {
    governance = createPluginGovernance()
  })

  describe('Verification Submission', () => {
    it('should submit plugin for verification', () => {
      const listener = vi.fn()
      governance.on('verification-submitted', listener)

      const submission: ReviewSubmission = {
        pluginId: 'test-plugin',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test plugin submission',
      }

      const record = governance.submitForVerification(submission)

      expect(record.pluginId).toBe('test-plugin')
      expect(record.tier).toBe(VerificationTier.COMMUNITY)
      expect(record.status).toBe(ReviewStatus.PENDING)
      expect(listener).toHaveBeenCalled()
    })

    it('should reject duplicate submissions', () => {
      const submission: ReviewSubmission = {
        pluginId: 'test-plugin',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test plugin submission',
      }

      governance.submitForVerification(submission)

      expect(() => governance.submitForVerification(submission)).toThrow(
        'already has a pending verification request'
      )
    })
  })

  describe('Review Process', () => {
    beforeEach(() => {
      governance.submitForVerification({
        pluginId: 'test-plugin',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test',
      })
    })

    it('should start review', () => {
      const listener = vi.fn()
      governance.on('review-started', listener)

      const record = governance.startReview('test-plugin', 'reviewer1')

      expect(record?.status).toBe(ReviewStatus.IN_REVIEW)
      expect(record?.reviewedBy).toBe('reviewer1')
      expect(listener).toHaveBeenCalled()
    })

    it('should complete review with approval', () => {
      governance.startReview('test-plugin', 'reviewer1')

      const record = governance.submitForVerification({
        pluginId: 'test-plugin',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test',
      })

      governance.startReview('test-plugin', 'reviewer1')

      const decision = {
        verificationId: `${record.pluginId}:${record.submittedAt}`,
        decision: 'approve' as const,
        reviewerId: 'reviewer1',
        comments: 'Approved',
      }

      const completedRecord = governance.completeReview(decision)

      expect(completedRecord?.status).toBe(ReviewStatus.APPROVED)
      expect(completedRecord?.reviewedAt).toBeDefined()
    })

    it('should complete review with rejection', () => {
      governance.startReview('test-plugin', 'reviewer1')

      const record = governance.submitForVerification({
        pluginId: 'test-plugin2',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test',
      })

      governance.startReview('test-plugin2', 'reviewer1')

      const decision = {
        verificationId: `${record.pluginId}:${record.submittedAt}`,
        decision: 'reject' as const,
        reviewerId: 'reviewer1',
        comments: 'Rejected',
      }

      const completedRecord = governance.completeReview(decision)

      expect(completedRecord?.status).toBe(ReviewStatus.REJECTED)
    })

    it('should request changes', () => {
      governance.startReview('test-plugin', 'reviewer1')

      const record = governance.submitForVerification({
        pluginId: 'test-plugin3',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test',
      })

      governance.startReview('test-plugin3', 'reviewer1')

      const decision = {
        verificationId: `${record.pluginId}:${record.submittedAt}`,
        decision: 'request_changes' as const,
        reviewerId: 'reviewer1',
        comments: 'Please improve documentation',
      }

      const completedRecord = governance.completeReview(decision)

      expect(completedRecord?.status).toBe(ReviewStatus.CHANGES_REQUESTED)
      expect(completedRecord?.comments).toContain('documentation')
    })
  })

  describe('Verification Tier Management', () => {
    it('should update verification tier', () => {
      const listener = vi.fn()
      governance.on('tier-updated', listener)

      governance.updateVerificationTier('plugin1', VerificationTier.OFFICIAL, 'admin1')

      const tier = governance.getVerificationTier('plugin1')

      expect(tier).toBe(VerificationTier.OFFICIAL)
      expect(listener).toHaveBeenCalled()
    })

    it('should return unverified for non-existent plugin', () => {
      const tier = governance.getVerificationTier('non-existent')

      expect(tier).toBe(VerificationTier.UNVERIFIED)
    })

    it('should get verified plugins', () => {
      governance.updateVerificationTier('plugin1', VerificationTier.COMMUNITY, 'admin1')
      governance.updateVerificationTier('plugin2', VerificationTier.OFFICIAL, 'admin1')

      const verified = governance.getVerifiedPlugins()

      expect(verified).toHaveLength(2)
    })

    it('should filter verified plugins by tier', () => {
      governance.updateVerificationTier('plugin1', VerificationTier.COMMUNITY, 'admin1')
      governance.updateVerificationTier('plugin2', VerificationTier.OFFICIAL, 'admin1')

      const official = governance.getVerifiedPlugins(VerificationTier.OFFICIAL)

      expect(official).toHaveLength(1)
      expect(official[0].tier).toBe(VerificationTier.OFFICIAL)
    })
  })

  describe('Review Queue', () => {
    beforeEach(() => {
      governance.submitForVerification({
        pluginId: 'plugin1',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test 1',
      })

      governance.submitForVerification({
        pluginId: 'plugin2',
        targetTier: VerificationTier.OFFICIAL,
        submittedBy: 'user2',
        description: 'Test 2',
      })
    })

    it('should get review queue', () => {
      const queue = governance.getReviewQueue()

      expect(queue).toHaveLength(2)
    })

    it('should filter queue by tier', () => {
      const queue = governance.getReviewQueue(VerificationTier.OFFICIAL)

      expect(queue).toHaveLength(1)
      expect(queue[0].tier).toBe(VerificationTier.OFFICIAL)
    })

    it('should remove from queue after completion', () => {
      const record = governance.startReview('plugin1', 'reviewer1')

      governance.completeReview({
        verificationId: `${record!.pluginId}:${record!.submittedAt}`,
        decision: 'approve',
        reviewerId: 'reviewer1',
        comments: 'Approved',
      })

      const queue = governance.getReviewQueue()

      expect(queue).toHaveLength(1)
      expect(queue[0].pluginId).toBe('plugin2')
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      governance.submitForVerification({
        pluginId: 'plugin1',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test 1',
      })

      const record = governance.startReview('plugin1', 'reviewer1')
      governance.completeReview({
        verificationId: `${record!.pluginId}:${record!.submittedAt}`,
        decision: 'approve',
        reviewerId: 'reviewer1',
        comments: 'Approved',
      })

      governance.submitForVerification({
        pluginId: 'plugin2',
        targetTier: VerificationTier.OFFICIAL,
        submittedBy: 'user2',
        description: 'Test 2',
      })
    })

    it('should get statistics', () => {
      const stats = governance.getStatistics()

      expect(stats).toMatchObject({
        totalVerifications: 2,
        pendingReviews: 1,
        approvedPlugins: 1,
      })
    })

    it('should count by tier', () => {
      const stats = governance.getStatistics()

      expect(stats.communityVerified).toBe(1)
      expect(stats.officialVerified).toBe(0)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(() => {
      governance.submitForVerification({
        pluginId: 'plugin1',
        targetTier: VerificationTier.COMMUNITY,
        submittedBy: 'user1',
        description: 'Test',
      })
    })

    it('should clear verification', () => {
      const listener = vi.fn()
      governance.on('verification-cleared', listener)

      governance.clearVerification('plugin1')

      const record = governance.getVerification('plugin1')

      expect(record).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })

    it('should clear all verifications', () => {
      const listener = vi.fn()
      governance.on('all-cleared', listener)

      governance.clearAll()

      const queue = governance.getReviewQueue()

      expect(queue).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Governance', () => {
    beforeEach(() => {
      resetGlobalGovernance()
    })

    it('should get global governance', () => {
      const global = getGlobalGovernance()

      expect(global).toBeInstanceOf(PluginGovernance)
    })

    it('should return same instance', () => {
      const gov1 = getGlobalGovernance()
      const gov2 = getGlobalGovernance()

      expect(gov1).toBe(gov2)
    })

    it('should reset global governance', () => {
      const gov1 = getGlobalGovernance()

      resetGlobalGovernance()

      const gov2 = getGlobalGovernance()

      expect(gov2).not.toBe(gov1)
    })
  })
})
