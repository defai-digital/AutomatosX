/**
 * Plugin Moderation Queue
 * Sprint 6 Day 52: Plugin flagging and moderation system
 */
import { EventEmitter } from 'events';
/**
 * Flag reason
 */
export declare enum FlagReason {
    SPAM = "spam",
    MALWARE = "malware",
    COPYRIGHT = "copyright",
    INAPPROPRIATE = "inappropriate",
    OUTDATED = "outdated",
    BROKEN = "broken",
    OTHER = "other"
}
/**
 * Moderation status
 */
export declare enum ModerationStatus {
    PENDING = "pending",
    UNDER_REVIEW = "under_review",
    RESOLVED = "resolved",
    ESCALATED = "escalated"
}
/**
 * Moderation action
 */
export declare enum ModerationAction {
    NONE = "none",
    WARNING = "warning",
    SUSPENSION = "suspension",
    REMOVAL = "removal",
    BAN = "ban"
}
/**
 * Flag record
 */
export interface FlagRecord {
    id: string;
    pluginId: string;
    userId: string;
    reason: FlagReason;
    description: string;
    flaggedAt: number;
    status: ModerationStatus;
    moderatedBy?: string;
    moderatedAt?: number;
    action?: ModerationAction;
    comments?: string;
}
/**
 * Moderation decision
 */
export interface ModerationDecision {
    flagId: string;
    moderatorId: string;
    action: ModerationAction;
    comments: string;
    escalate?: boolean;
}
/**
 * Plugin moderation queue
 */
export declare class PluginModerationQueue extends EventEmitter {
    private flags;
    private queue;
    private flagIdCounter;
    /**
     * Flag plugin
     */
    flagPlugin(pluginId: string, userId: string, reason: FlagReason, description: string): FlagRecord;
    /**
     * Start moderation
     */
    startModeration(flagId: string, moderatorId: string): FlagRecord | null;
    /**
     * Complete moderation
     */
    completeModeration(decision: ModerationDecision): FlagRecord | null;
    /**
     * Escalate flag
     */
    escalateFlag(flagId: string, moderatorId: string, reason: string): FlagRecord | null;
    /**
     * Get flag
     */
    getFlag(flagId: string): FlagRecord | undefined;
    /**
     * Get flags for plugin
     */
    getPluginFlags(pluginId: string): FlagRecord[];
    /**
     * Get moderation queue
     */
    getModerationQueue(status?: ModerationStatus): FlagRecord[];
    /**
     * Get flags by status
     */
    getFlagsByStatus(status: ModerationStatus): FlagRecord[];
    /**
     * Get flags by reason
     */
    getFlagsByReason(reason: FlagReason): FlagRecord[];
    /**
     * Get escalated flags
     */
    getEscalatedFlags(): FlagRecord[];
    /**
     * Get statistics
     */
    getStatistics(): {
        totalFlags: number;
        pendingFlags: number;
        underReview: number;
        resolved: number;
        escalated: number;
        byReason: Record<FlagReason, number>;
        byAction: Record<ModerationAction, number>;
    };
    /**
     * Clear flag
     */
    clearFlag(flagId: string): void;
    /**
     * Clear all flags
     */
    clearAll(): void;
}
/**
 * Create moderation queue
 */
export declare function createModerationQueue(): PluginModerationQueue;
/**
 * Get global moderation queue
 */
export declare function getGlobalModerationQueue(): PluginModerationQueue;
/**
 * Reset global moderation queue
 */
export declare function resetGlobalModerationQueue(): void;
//# sourceMappingURL=PluginModerationQueue.d.ts.map