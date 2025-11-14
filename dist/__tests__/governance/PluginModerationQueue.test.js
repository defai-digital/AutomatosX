/**
 * Plugin Moderation Queue Tests
 * Sprint 6 Day 52: Moderation queue tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginModerationQueue, createModerationQueue, getGlobalModerationQueue, resetGlobalModerationQueue, FlagReason, ModerationStatus, ModerationAction, } from '../../governance/PluginModerationQueue.js';
describe('PluginModerationQueue', () => {
    let queue;
    beforeEach(() => {
        queue = createModerationQueue();
    });
    describe('Plugin Flagging', () => {
        it('should flag plugin', () => {
            const listener = vi.fn();
            queue.on('plugin-flagged', listener);
            const flag = queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam content');
            expect(flag.pluginId).toBe('plugin1');
            expect(flag.reason).toBe(FlagReason.SPAM);
            expect(flag.status).toBe(ModerationStatus.PENDING);
            expect(listener).toHaveBeenCalled();
        });
        it('should generate unique flag IDs', () => {
            const flag1 = queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam');
            const flag2 = queue.flagPlugin('plugin2', 'user2', FlagReason.MALWARE, 'Malware');
            expect(flag1.id).not.toBe(flag2.id);
        });
        it('should add flag to queue', () => {
            queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam');
            const moderationQueue = queue.getModerationQueue();
            expect(moderationQueue).toHaveLength(1);
        });
    });
    describe('Moderation Process', () => {
        beforeEach(() => {
            queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam content');
        });
        it('should start moderation', () => {
            const listener = vi.fn();
            queue.on('moderation-started', listener);
            const flags = queue.getPluginFlags('plugin1');
            const flag = queue.startModeration(flags[0].id, 'moderator1');
            expect(flag?.status).toBe(ModerationStatus.UNDER_REVIEW);
            expect(flag?.moderatedBy).toBe('moderator1');
            expect(listener).toHaveBeenCalled();
        });
        it('should complete moderation with action', () => {
            const listener = vi.fn();
            queue.on('moderation-completed', listener);
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            const flag = queue.completeModeration({
                flagId: flags[0].id,
                moderatorId: 'moderator1',
                action: ModerationAction.REMOVAL,
                comments: 'Removed spam content',
            });
            expect(flag?.status).toBe(ModerationStatus.RESOLVED);
            expect(flag?.action).toBe(ModerationAction.REMOVAL);
            expect(listener).toHaveBeenCalled();
        });
        it('should escalate flag', () => {
            const listener = vi.fn();
            queue.on('flag-escalated', listener);
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            const flag = queue.completeModeration({
                flagId: flags[0].id,
                moderatorId: 'moderator1',
                action: ModerationAction.NONE,
                comments: 'Escalating to senior moderator',
                escalate: true,
            });
            expect(flag?.status).toBe(ModerationStatus.ESCALATED);
            expect(listener).toHaveBeenCalled();
        });
        it('should remove from queue after completion', () => {
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            queue.completeModeration({
                flagId: flags[0].id,
                moderatorId: 'moderator1',
                action: ModerationAction.WARNING,
                comments: 'Warning issued',
            });
            const moderationQueue = queue.getModerationQueue();
            expect(moderationQueue).toHaveLength(0);
        });
    });
    describe('Flag Queries', () => {
        beforeEach(() => {
            queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam 1');
            queue.flagPlugin('plugin1', 'user2', FlagReason.MALWARE, 'Malware 1');
            queue.flagPlugin('plugin2', 'user3', FlagReason.SPAM, 'Spam 2');
        });
        it('should get flags for plugin', () => {
            const flags = queue.getPluginFlags('plugin1');
            expect(flags).toHaveLength(2);
            expect(flags.every((f) => f.pluginId === 'plugin1')).toBe(true);
        });
        it('should get moderation queue', () => {
            const moderationQueue = queue.getModerationQueue();
            expect(moderationQueue).toHaveLength(3);
        });
        it('should filter queue by status', () => {
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            const pending = queue.getModerationQueue(ModerationStatus.PENDING);
            const underReview = queue.getModerationQueue(ModerationStatus.UNDER_REVIEW);
            expect(pending).toHaveLength(2);
            expect(underReview).toHaveLength(1);
        });
        it('should get flags by reason', () => {
            const spamFlags = queue.getFlagsByReason(FlagReason.SPAM);
            expect(spamFlags).toHaveLength(2);
            expect(spamFlags.every((f) => f.reason === FlagReason.SPAM)).toBe(true);
        });
        it('should get escalated flags', () => {
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            queue.completeModeration({
                flagId: flags[0].id,
                moderatorId: 'moderator1',
                action: ModerationAction.NONE,
                comments: 'Escalated',
                escalate: true,
            });
            const escalated = queue.getEscalatedFlags();
            expect(escalated).toHaveLength(1);
        });
    });
    describe('Statistics', () => {
        beforeEach(() => {
            queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam 1');
            queue.flagPlugin('plugin2', 'user2', FlagReason.MALWARE, 'Malware 1');
            queue.flagPlugin('plugin3', 'user3', FlagReason.SPAM, 'Spam 2');
            const flags = queue.getPluginFlags('plugin1');
            queue.startModeration(flags[0].id, 'moderator1');
            queue.completeModeration({
                flagId: flags[0].id,
                moderatorId: 'moderator1',
                action: ModerationAction.WARNING,
                comments: 'Resolved',
            });
        });
        it('should get statistics', () => {
            const stats = queue.getStatistics();
            expect(stats).toMatchObject({
                totalFlags: 3,
                pendingFlags: 2,
                resolved: 1,
            });
        });
        it('should count by reason', () => {
            const stats = queue.getStatistics();
            expect(stats.byReason[FlagReason.SPAM]).toBe(2);
            expect(stats.byReason[FlagReason.MALWARE]).toBe(1);
        });
        it('should count by action', () => {
            const stats = queue.getStatistics();
            expect(stats.byAction[ModerationAction.WARNING]).toBe(1);
        });
    });
    describe('Clear Operations', () => {
        beforeEach(() => {
            queue.flagPlugin('plugin1', 'user1', FlagReason.SPAM, 'Spam');
        });
        it('should clear flag', () => {
            const listener = vi.fn();
            queue.on('flag-cleared', listener);
            const flags = queue.getPluginFlags('plugin1');
            queue.clearFlag(flags[0].id);
            const flag = queue.getFlag(flags[0].id);
            expect(flag).toBeUndefined();
            expect(listener).toHaveBeenCalled();
        });
        it('should clear all flags', () => {
            const listener = vi.fn();
            queue.on('all-cleared', listener);
            queue.clearAll();
            const stats = queue.getStatistics();
            expect(stats.totalFlags).toBe(0);
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Global Moderation Queue', () => {
        beforeEach(() => {
            resetGlobalModerationQueue();
        });
        it('should get global queue', () => {
            const global = getGlobalModerationQueue();
            expect(global).toBeInstanceOf(PluginModerationQueue);
        });
        it('should return same instance', () => {
            const queue1 = getGlobalModerationQueue();
            const queue2 = getGlobalModerationQueue();
            expect(queue1).toBe(queue2);
        });
        it('should reset global queue', () => {
            const queue1 = getGlobalModerationQueue();
            resetGlobalModerationQueue();
            const queue2 = getGlobalModerationQueue();
            expect(queue2).not.toBe(queue1);
        });
    });
});
//# sourceMappingURL=PluginModerationQueue.test.js.map