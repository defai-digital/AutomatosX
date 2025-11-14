/**
 * Plugin Governance
 * Sprint 6 Day 52: Verification tiers and community governance
 */
import { EventEmitter } from 'events';
/**
 * Verification tier
 */
export declare enum VerificationTier {
    UNVERIFIED = "unverified",
    COMMUNITY = "community",
    OFFICIAL = "official"
}
/**
 * Review status
 */
export declare enum ReviewStatus {
    PENDING = "pending",
    IN_REVIEW = "in_review",
    APPROVED = "approved",
    REJECTED = "rejected",
    CHANGES_REQUESTED = "changes_requested"
}
/**
 * Plugin verification record
 */
export interface VerificationRecord {
    pluginId: string;
    tier: VerificationTier;
    status: ReviewStatus;
    submittedAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
    comments?: string;
    checklist?: ReviewChecklist;
}
/**
 * Review checklist
 */
export interface ReviewChecklist {
    codeQuality: boolean;
    securityAudit: boolean;
    documentationComplete: boolean;
    testCoverage: boolean;
    licenseValid: boolean;
    noVulnerabilities: boolean;
}
/**
 * Review submission
 */
export interface ReviewSubmission {
    pluginId: string;
    targetTier: VerificationTier;
    submittedBy: string;
    description: string;
    documentation?: string;
}
/**
 * Review decision
 */
export interface ReviewDecision {
    verificationId: string;
    decision: 'approve' | 'reject' | 'request_changes';
    reviewerId: string;
    comments: string;
    checklist?: Partial<ReviewChecklist>;
}
/**
 * Plugin governance
 */
export declare class PluginGovernance extends EventEmitter {
    private verifications;
    private reviewQueue;
    /**
     * Submit plugin for verification
     */
    submitForVerification(submission: ReviewSubmission): VerificationRecord;
    /**
     * Start review process
     */
    startReview(pluginId: string, reviewerId: string): VerificationRecord | null;
    /**
     * Complete review
     */
    completeReview(decision: ReviewDecision): VerificationRecord | null;
    /**
     * Update verification tier
     */
    updateVerificationTier(pluginId: string, tier: VerificationTier, adminId: string): void;
    /**
     * Get verification record
     */
    getVerification(pluginId: string): VerificationRecord | undefined;
    /**
     * Get verification tier
     */
    getVerificationTier(pluginId: string): VerificationTier;
    /**
     * Get review queue
     */
    getReviewQueue(tier?: VerificationTier): VerificationRecord[];
    /**
     * Get verified plugins
     */
    getVerifiedPlugins(tier?: VerificationTier): VerificationRecord[];
    /**
     * Get plugins by status
     */
    getPluginsByStatus(status: ReviewStatus): VerificationRecord[];
    /**
     * Get statistics
     */
    getStatistics(): {
        totalVerifications: number;
        pendingReviews: number;
        approvedPlugins: number;
        rejectedPlugins: number;
        communityVerified: number;
        officialVerified: number;
    };
    /**
     * Clear verification
     */
    clearVerification(pluginId: string): void;
    /**
     * Clear all verifications
     */
    clearAll(): void;
}
/**
 * Create plugin governance
 */
export declare function createPluginGovernance(): PluginGovernance;
/**
 * Get global governance
 */
export declare function getGlobalGovernance(): PluginGovernance;
/**
 * Reset global governance
 */
export declare function resetGlobalGovernance(): void;
//# sourceMappingURL=PluginGovernance.d.ts.map