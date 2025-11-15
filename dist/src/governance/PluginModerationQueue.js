/**
 * Plugin Moderation Queue
 * Sprint 6 Day 52: Plugin flagging and moderation system
 */
import { EventEmitter } from 'events';
/**
 * Flag reason
 */
export var FlagReason;
(function (FlagReason) {
    FlagReason["SPAM"] = "spam";
    FlagReason["MALWARE"] = "malware";
    FlagReason["COPYRIGHT"] = "copyright";
    FlagReason["INAPPROPRIATE"] = "inappropriate";
    FlagReason["OUTDATED"] = "outdated";
    FlagReason["BROKEN"] = "broken";
    FlagReason["OTHER"] = "other";
})(FlagReason || (FlagReason = {}));
/**
 * Moderation status
 */
export var ModerationStatus;
(function (ModerationStatus) {
    ModerationStatus["PENDING"] = "pending";
    ModerationStatus["UNDER_REVIEW"] = "under_review";
    ModerationStatus["RESOLVED"] = "resolved";
    ModerationStatus["ESCALATED"] = "escalated";
})(ModerationStatus || (ModerationStatus = {}));
/**
 * Moderation action
 */
export var ModerationAction;
(function (ModerationAction) {
    ModerationAction["NONE"] = "none";
    ModerationAction["WARNING"] = "warning";
    ModerationAction["SUSPENSION"] = "suspension";
    ModerationAction["REMOVAL"] = "removal";
    ModerationAction["BAN"] = "ban";
})(ModerationAction || (ModerationAction = {}));
/**
 * Plugin moderation queue
 */
export class PluginModerationQueue extends EventEmitter {
    flags = new Map();
    queue = [];
    flagIdCounter = 0;
    /**
     * Flag plugin
     */
    flagPlugin(pluginId, userId, reason, description) {
        const flagId = `flag-${++this.flagIdCounter}`;
        const flag = {
            id: flagId,
            pluginId,
            userId,
            reason,
            description,
            flaggedAt: Date.now(),
            status: ModerationStatus.PENDING,
        };
        this.flags.set(flagId, flag);
        this.queue.push(flag);
        this.emit('plugin-flagged', {
            flagId,
            pluginId,
            reason,
            userId,
        });
        return flag;
    }
    /**
     * Start moderation
     */
    startModeration(flagId, moderatorId) {
        const flag = this.flags.get(flagId);
        if (!flag)
            return null;
        if (flag.status !== ModerationStatus.PENDING) {
            throw new Error(`Cannot start moderation for flag ${flagId} with status: ${flag.status}`);
        }
        flag.status = ModerationStatus.UNDER_REVIEW;
        flag.moderatedBy = moderatorId;
        this.emit('moderation-started', {
            flagId,
            moderatorId,
        });
        return flag;
    }
    /**
     * Complete moderation
     */
    completeModeration(decision) {
        const flag = this.flags.get(decision.flagId);
        if (!flag)
            return null;
        if (flag.status !== ModerationStatus.UNDER_REVIEW) {
            throw new Error(`Cannot complete moderation for flag ${decision.flagId} with status: ${flag.status}`);
        }
        if (decision.escalate) {
            flag.status = ModerationStatus.ESCALATED;
            flag.moderatedAt = Date.now();
            flag.moderatedBy = decision.moderatorId;
            flag.comments = decision.comments;
            this.emit('flag-escalated', {
                flagId: flag.id,
                pluginId: flag.pluginId,
                reason: decision.comments,
            });
        }
        else {
            flag.status = ModerationStatus.RESOLVED;
            flag.action = decision.action;
            flag.moderatedAt = Date.now();
            flag.moderatedBy = decision.moderatorId;
            flag.comments = decision.comments;
        }
        // Remove from queue
        this.queue = this.queue.filter((f) => f.id !== flag.id);
        this.emit('moderation-completed', {
            flagId: flag.id,
            pluginId: flag.pluginId,
            action: flag.action,
            escalated: decision.escalate,
        });
        return flag;
    }
    /**
     * Escalate flag
     */
    escalateFlag(flagId, moderatorId, reason) {
        const flag = this.flags.get(flagId);
        if (!flag)
            return null;
        flag.status = ModerationStatus.ESCALATED;
        flag.moderatedBy = moderatorId;
        flag.comments = reason;
        this.emit('flag-escalated', {
            flagId,
            pluginId: flag.pluginId,
            reason,
        });
        return flag;
    }
    /**
     * Get flag
     */
    getFlag(flagId) {
        return this.flags.get(flagId);
    }
    /**
     * Get flags for plugin
     */
    getPluginFlags(pluginId) {
        return Array.from(this.flags.values()).filter((f) => f.pluginId === pluginId);
    }
    /**
     * Get moderation queue
     */
    getModerationQueue(status) {
        if (status) {
            return this.queue.filter((f) => f.status === status);
        }
        return [...this.queue];
    }
    /**
     * Get flags by status
     */
    getFlagsByStatus(status) {
        return Array.from(this.flags.values()).filter((f) => f.status === status);
    }
    /**
     * Get flags by reason
     */
    getFlagsByReason(reason) {
        return Array.from(this.flags.values()).filter((f) => f.reason === reason);
    }
    /**
     * Get escalated flags
     */
    getEscalatedFlags() {
        return Array.from(this.flags.values()).filter((f) => f.status === ModerationStatus.ESCALATED);
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const flags = Array.from(this.flags.values());
        const byReason = {};
        const byAction = {};
        for (const flag of flags) {
            byReason[flag.reason] = (byReason[flag.reason] || 0) + 1;
            if (flag.action) {
                byAction[flag.action] = (byAction[flag.action] || 0) + 1;
            }
        }
        return {
            totalFlags: flags.length,
            pendingFlags: flags.filter((f) => f.status === ModerationStatus.PENDING).length,
            underReview: flags.filter((f) => f.status === ModerationStatus.UNDER_REVIEW).length,
            resolved: flags.filter((f) => f.status === ModerationStatus.RESOLVED).length,
            escalated: flags.filter((f) => f.status === ModerationStatus.ESCALATED).length,
            byReason,
            byAction,
        };
    }
    /**
     * Clear flag
     */
    clearFlag(flagId) {
        this.flags.delete(flagId);
        this.queue = this.queue.filter((f) => f.id !== flagId);
        this.emit('flag-cleared', { flagId });
    }
    /**
     * Clear all flags
     */
    clearAll() {
        this.flags.clear();
        this.queue = [];
        this.flagIdCounter = 0;
        this.emit('all-cleared');
    }
}
/**
 * Create moderation queue
 */
export function createModerationQueue() {
    return new PluginModerationQueue();
}
/**
 * Global moderation queue
 */
let globalQueue = null;
/**
 * Get global moderation queue
 */
export function getGlobalModerationQueue() {
    if (!globalQueue) {
        globalQueue = createModerationQueue();
    }
    return globalQueue;
}
/**
 * Reset global moderation queue
 */
export function resetGlobalModerationQueue() {
    globalQueue = null;
}
//# sourceMappingURL=PluginModerationQueue.js.map