/**
 * Plugin Governance
 * Sprint 6 Day 52: Verification tiers and community governance
 */

import { EventEmitter } from 'events'

/**
 * Verification tier
 */
export enum VerificationTier {
  UNVERIFIED = 'unverified',
  COMMUNITY = 'community',
  OFFICIAL = 'official',
}

/**
 * Review status
 */
export enum ReviewStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

/**
 * Plugin verification record
 */
export interface VerificationRecord {
  pluginId: string
  tier: VerificationTier
  status: ReviewStatus
  submittedAt: number
  reviewedAt?: number
  reviewedBy?: string
  comments?: string
  checklist?: ReviewChecklist
}

/**
 * Review checklist
 */
export interface ReviewChecklist {
  codeQuality: boolean
  securityAudit: boolean
  documentationComplete: boolean
  testCoverage: boolean
  licenseValid: boolean
  noVulnerabilities: boolean
}

/**
 * Review submission
 */
export interface ReviewSubmission {
  pluginId: string
  targetTier: VerificationTier
  submittedBy: string
  description: string
  documentation?: string
}

/**
 * Review decision
 */
export interface ReviewDecision {
  verificationId: string
  decision: 'approve' | 'reject' | 'request_changes'
  reviewerId: string
  comments: string
  checklist?: Partial<ReviewChecklist>
}

/**
 * Plugin governance
 */
export class PluginGovernance extends EventEmitter {
  private verifications = new Map<string, VerificationRecord>()
  private reviewQueue: VerificationRecord[] = []

  /**
   * Submit plugin for verification
   */
  submitForVerification(submission: ReviewSubmission): VerificationRecord {
    // Check if already exists
    const existing = this.verifications.get(submission.pluginId)
    if (existing && existing.status === ReviewStatus.PENDING) {
      throw new Error(`Plugin ${submission.pluginId} already has a pending verification request`)
    }

    const record: VerificationRecord = {
      pluginId: submission.pluginId,
      tier: submission.targetTier,
      status: ReviewStatus.PENDING,
      submittedAt: Date.now(),
    }

    this.verifications.set(submission.pluginId, record)
    this.reviewQueue.push(record)

    this.emit('verification-submitted', {
      pluginId: submission.pluginId,
      tier: submission.targetTier,
      submittedBy: submission.submittedBy,
    })

    return record
  }

  /**
   * Start review process
   */
  startReview(pluginId: string, reviewerId: string): VerificationRecord | null {
    const record = this.verifications.get(pluginId)
    if (!record) return null

    if (record.status !== ReviewStatus.PENDING) {
      throw new Error(
        `Cannot start review for plugin ${pluginId} with status: ${record.status}`
      )
    }

    record.status = ReviewStatus.IN_REVIEW
    record.reviewedBy = reviewerId

    this.emit('review-started', {
      pluginId,
      reviewerId,
    })

    return record
  }

  /**
   * Complete review
   */
  completeReview(decision: ReviewDecision): VerificationRecord | null {
    const record = Array.from(this.verifications.values()).find(
      (r) => `${r.pluginId}:${r.submittedAt}` === decision.verificationId
    )

    if (!record) return null

    if (record.status !== ReviewStatus.IN_REVIEW) {
      throw new Error(
        `Cannot complete review for plugin ${record.pluginId} with status: ${record.status}`
      )
    }

    switch (decision.decision) {
      case 'approve':
        record.status = ReviewStatus.APPROVED
        record.reviewedAt = Date.now()
        record.comments = decision.comments
        if (decision.checklist) {
          record.checklist = decision.checklist as ReviewChecklist
        }
        break

      case 'reject':
        record.status = ReviewStatus.REJECTED
        record.reviewedAt = Date.now()
        record.comments = decision.comments
        break

      case 'request_changes':
        record.status = ReviewStatus.CHANGES_REQUESTED
        record.comments = decision.comments
        break
    }

    // Remove from review queue
    this.reviewQueue = this.reviewQueue.filter((r) => r.pluginId !== record.pluginId)

    this.emit('review-completed', {
      pluginId: record.pluginId,
      decision: decision.decision,
      tier: record.tier,
    })

    return record
  }

  /**
   * Update verification tier
   */
  updateVerificationTier(pluginId: string, tier: VerificationTier, adminId: string): void {
    const record = this.verifications.get(pluginId)

    if (!record) {
      // Create new verification record
      const newRecord: VerificationRecord = {
        pluginId,
        tier,
        status: ReviewStatus.APPROVED,
        submittedAt: Date.now(),
        reviewedAt: Date.now(),
        reviewedBy: adminId,
      }
      this.verifications.set(pluginId, newRecord)
    } else {
      // Update existing
      record.tier = tier
      record.reviewedAt = Date.now()
      record.reviewedBy = adminId
    }

    this.emit('tier-updated', {
      pluginId,
      tier,
      updatedBy: adminId,
    })
  }

  /**
   * Get verification record
   */
  getVerification(pluginId: string): VerificationRecord | undefined {
    return this.verifications.get(pluginId)
  }

  /**
   * Get verification tier
   */
  getVerificationTier(pluginId: string): VerificationTier {
    const record = this.verifications.get(pluginId)
    return record?.tier || VerificationTier.UNVERIFIED
  }

  /**
   * Get review queue
   */
  getReviewQueue(tier?: VerificationTier): VerificationRecord[] {
    if (tier) {
      return this.reviewQueue.filter((r) => r.tier === tier)
    }
    return [...this.reviewQueue]
  }

  /**
   * Get verified plugins
   */
  getVerifiedPlugins(tier?: VerificationTier): VerificationRecord[] {
    const verified = Array.from(this.verifications.values()).filter(
      (r) => r.status === ReviewStatus.APPROVED
    )

    if (tier) {
      return verified.filter((r) => r.tier === tier)
    }

    return verified.filter((r) => r.tier !== VerificationTier.UNVERIFIED)
  }

  /**
   * Get plugins by status
   */
  getPluginsByStatus(status: ReviewStatus): VerificationRecord[] {
    return Array.from(this.verifications.values()).filter((r) => r.status === status)
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalVerifications: number
    pendingReviews: number
    approvedPlugins: number
    rejectedPlugins: number
    communityVerified: number
    officialVerified: number
  } {
    const verifications = Array.from(this.verifications.values())

    return {
      totalVerifications: verifications.length,
      pendingReviews: this.reviewQueue.length,
      approvedPlugins: verifications.filter((r) => r.status === ReviewStatus.APPROVED).length,
      rejectedPlugins: verifications.filter((r) => r.status === ReviewStatus.REJECTED).length,
      communityVerified: verifications.filter(
        (r) => r.tier === VerificationTier.COMMUNITY && r.status === ReviewStatus.APPROVED
      ).length,
      officialVerified: verifications.filter(
        (r) => r.tier === VerificationTier.OFFICIAL && r.status === ReviewStatus.APPROVED
      ).length,
    }
  }

  /**
   * Clear verification
   */
  clearVerification(pluginId: string): void {
    this.verifications.delete(pluginId)
    this.reviewQueue = this.reviewQueue.filter((r) => r.pluginId !== pluginId)

    this.emit('verification-cleared', { pluginId })
  }

  /**
   * Clear all verifications
   */
  clearAll(): void {
    this.verifications.clear()
    this.reviewQueue = []

    this.emit('all-cleared')
  }
}

/**
 * Create plugin governance
 */
export function createPluginGovernance(): PluginGovernance {
  return new PluginGovernance()
}

/**
 * Global governance instance
 */
let globalGovernance: PluginGovernance | null = null

/**
 * Get global governance
 */
export function getGlobalGovernance(): PluginGovernance {
  if (!globalGovernance) {
    globalGovernance = createPluginGovernance()
  }
  return globalGovernance
}

/**
 * Reset global governance
 */
export function resetGlobalGovernance(): void {
  globalGovernance = null
}
