/**
 * Plugin Governance
 * Sprint 6 Day 52: Verification tiers and community governance
 */
import { EventEmitter } from 'events';
/**
 * Verification tier
 */
export var VerificationTier;
(function (VerificationTier) {
    VerificationTier["UNVERIFIED"] = "unverified";
    VerificationTier["COMMUNITY"] = "community";
    VerificationTier["OFFICIAL"] = "official";
})(VerificationTier || (VerificationTier = {}));
/**
 * Review status
 */
export var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "pending";
    ReviewStatus["IN_REVIEW"] = "in_review";
    ReviewStatus["APPROVED"] = "approved";
    ReviewStatus["REJECTED"] = "rejected";
    ReviewStatus["CHANGES_REQUESTED"] = "changes_requested";
})(ReviewStatus || (ReviewStatus = {}));
/**
 * Plugin governance
 */
export class PluginGovernance extends EventEmitter {
    verifications = new Map();
    reviewQueue = [];
    /**
     * Submit plugin for verification
     */
    submitForVerification(submission) {
        // Check if already exists
        const existing = this.verifications.get(submission.pluginId);
        if (existing && existing.status === ReviewStatus.PENDING) {
            throw new Error(`Plugin ${submission.pluginId} already has a pending verification request`);
        }
        const record = {
            pluginId: submission.pluginId,
            tier: submission.targetTier,
            status: ReviewStatus.PENDING,
            submittedAt: Date.now(),
        };
        this.verifications.set(submission.pluginId, record);
        this.reviewQueue.push(record);
        this.emit('verification-submitted', {
            pluginId: submission.pluginId,
            tier: submission.targetTier,
            submittedBy: submission.submittedBy,
        });
        return record;
    }
    /**
     * Start review process
     */
    startReview(pluginId, reviewerId) {
        const record = this.verifications.get(pluginId);
        if (!record)
            return null;
        if (record.status !== ReviewStatus.PENDING) {
            throw new Error(`Cannot start review for plugin ${pluginId} with status: ${record.status}`);
        }
        record.status = ReviewStatus.IN_REVIEW;
        record.reviewedBy = reviewerId;
        this.emit('review-started', {
            pluginId,
            reviewerId,
        });
        return record;
    }
    /**
     * Complete review
     */
    completeReview(decision) {
        const record = Array.from(this.verifications.values()).find((r) => `${r.pluginId}:${r.submittedAt}` === decision.verificationId);
        if (!record)
            return null;
        if (record.status !== ReviewStatus.IN_REVIEW) {
            throw new Error(`Cannot complete review for plugin ${record.pluginId} with status: ${record.status}`);
        }
        switch (decision.decision) {
            case 'approve':
                record.status = ReviewStatus.APPROVED;
                record.reviewedAt = Date.now();
                record.comments = decision.comments;
                if (decision.checklist) {
                    record.checklist = decision.checklist;
                }
                break;
            case 'reject':
                record.status = ReviewStatus.REJECTED;
                record.reviewedAt = Date.now();
                record.comments = decision.comments;
                break;
            case 'request_changes':
                record.status = ReviewStatus.CHANGES_REQUESTED;
                record.comments = decision.comments;
                break;
        }
        // Remove from review queue
        this.reviewQueue = this.reviewQueue.filter((r) => r.pluginId !== record.pluginId);
        this.emit('review-completed', {
            pluginId: record.pluginId,
            decision: decision.decision,
            tier: record.tier,
        });
        return record;
    }
    /**
     * Update verification tier
     */
    updateVerificationTier(pluginId, tier, adminId) {
        const record = this.verifications.get(pluginId);
        if (!record) {
            // Create new verification record
            const newRecord = {
                pluginId,
                tier,
                status: ReviewStatus.APPROVED,
                submittedAt: Date.now(),
                reviewedAt: Date.now(),
                reviewedBy: adminId,
            };
            this.verifications.set(pluginId, newRecord);
        }
        else {
            // Update existing
            record.tier = tier;
            record.reviewedAt = Date.now();
            record.reviewedBy = adminId;
        }
        this.emit('tier-updated', {
            pluginId,
            tier,
            updatedBy: adminId,
        });
    }
    /**
     * Get verification record
     */
    getVerification(pluginId) {
        return this.verifications.get(pluginId);
    }
    /**
     * Get verification tier
     */
    getVerificationTier(pluginId) {
        const record = this.verifications.get(pluginId);
        return record?.tier || VerificationTier.UNVERIFIED;
    }
    /**
     * Get review queue
     */
    getReviewQueue(tier) {
        if (tier) {
            return this.reviewQueue.filter((r) => r.tier === tier);
        }
        return [...this.reviewQueue];
    }
    /**
     * Get verified plugins
     */
    getVerifiedPlugins(tier) {
        const verified = Array.from(this.verifications.values()).filter((r) => r.status === ReviewStatus.APPROVED);
        if (tier) {
            return verified.filter((r) => r.tier === tier);
        }
        return verified.filter((r) => r.tier !== VerificationTier.UNVERIFIED);
    }
    /**
     * Get plugins by status
     */
    getPluginsByStatus(status) {
        return Array.from(this.verifications.values()).filter((r) => r.status === status);
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const verifications = Array.from(this.verifications.values());
        return {
            totalVerifications: verifications.length,
            pendingReviews: this.reviewQueue.length,
            approvedPlugins: verifications.filter((r) => r.status === ReviewStatus.APPROVED).length,
            rejectedPlugins: verifications.filter((r) => r.status === ReviewStatus.REJECTED).length,
            communityVerified: verifications.filter((r) => r.tier === VerificationTier.COMMUNITY && r.status === ReviewStatus.APPROVED).length,
            officialVerified: verifications.filter((r) => r.tier === VerificationTier.OFFICIAL && r.status === ReviewStatus.APPROVED).length,
        };
    }
    /**
     * Clear verification
     */
    clearVerification(pluginId) {
        this.verifications.delete(pluginId);
        this.reviewQueue = this.reviewQueue.filter((r) => r.pluginId !== pluginId);
        this.emit('verification-cleared', { pluginId });
    }
    /**
     * Clear all verifications
     */
    clearAll() {
        this.verifications.clear();
        this.reviewQueue = [];
        this.emit('all-cleared');
    }
}
/**
 * Create plugin governance
 */
export function createPluginGovernance() {
    return new PluginGovernance();
}
/**
 * Global governance instance
 */
let globalGovernance = null;
/**
 * Get global governance
 */
export function getGlobalGovernance() {
    if (!globalGovernance) {
        globalGovernance = createPluginGovernance();
    }
    return globalGovernance;
}
/**
 * Reset global governance
 */
export function resetGlobalGovernance() {
    globalGovernance = null;
}
//# sourceMappingURL=PluginGovernance.js.map