/**
 * Plugin Moderation Queue
 * Sprint 6 Day 52: Plugin flagging and moderation system
 */

import { EventEmitter } from 'events'

/**
 * Flag reason
 */
export enum FlagReason {
  SPAM = 'spam',
  MALWARE = 'malware',
  COPYRIGHT = 'copyright',
  INAPPROPRIATE = 'inappropriate',
  OUTDATED = 'outdated',
  BROKEN = 'broken',
  OTHER = 'other',
}

/**
 * Moderation status
 */
export enum ModerationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

/**
 * Moderation action
 */
export enum ModerationAction {
  NONE = 'none',
  WARNING = 'warning',
  SUSPENSION = 'suspension',
  REMOVAL = 'removal',
  BAN = 'ban',
}

/**
 * Flag record
 */
export interface FlagRecord {
  id: string
  pluginId: string
  userId: string
  reason: FlagReason
  description: string
  flaggedAt: number
  status: ModerationStatus
  moderatedBy?: string
  moderatedAt?: number
  action?: ModerationAction
  comments?: string
}

/**
 * Moderation decision
 */
export interface ModerationDecision {
  flagId: string
  moderatorId: string
  action: ModerationAction
  comments: string
  escalate?: boolean
}

/**
 * Plugin moderation queue
 */
export class PluginModerationQueue extends EventEmitter {
  private flags = new Map<string, FlagRecord>()
  private queue: FlagRecord[] = []
  private flagIdCounter = 0

  /**
   * Flag plugin
   */
  flagPlugin(
    pluginId: string,
    userId: string,
    reason: FlagReason,
    description: string
  ): FlagRecord {
    const flagId = `flag-${++this.flagIdCounter}`

    const flag: FlagRecord = {
      id: flagId,
      pluginId,
      userId,
      reason,
      description,
      flaggedAt: Date.now(),
      status: ModerationStatus.PENDING,
    }

    this.flags.set(flagId, flag)
    this.queue.push(flag)

    this.emit('plugin-flagged', {
      flagId,
      pluginId,
      reason,
      userId,
    })

    return flag
  }

  /**
   * Start moderation
   */
  startModeration(flagId: string, moderatorId: string): FlagRecord | null {
    const flag = this.flags.get(flagId)
    if (!flag) return null

    if (flag.status !== ModerationStatus.PENDING) {
      throw new Error(`Cannot start moderation for flag ${flagId} with status: ${flag.status}`)
    }

    flag.status = ModerationStatus.UNDER_REVIEW
    flag.moderatedBy = moderatorId

    this.emit('moderation-started', {
      flagId,
      moderatorId,
    })

    return flag
  }

  /**
   * Complete moderation
   */
  completeModeration(decision: ModerationDecision): FlagRecord | null {
    const flag = this.flags.get(decision.flagId)
    if (!flag) return null

    if (flag.status !== ModerationStatus.UNDER_REVIEW) {
      throw new Error(
        `Cannot complete moderation for flag ${decision.flagId} with status: ${flag.status}`
      )
    }

    if (decision.escalate) {
      flag.status = ModerationStatus.ESCALATED
      flag.moderatedAt = Date.now()
      flag.moderatedBy = decision.moderatorId
      flag.comments = decision.comments

      this.emit('flag-escalated', {
        flagId: flag.id,
        pluginId: flag.pluginId,
        reason: decision.comments,
      })
    } else {
      flag.status = ModerationStatus.RESOLVED
      flag.action = decision.action
      flag.moderatedAt = Date.now()
      flag.moderatedBy = decision.moderatorId
      flag.comments = decision.comments
    }

    // Remove from queue
    this.queue = this.queue.filter((f) => f.id !== flag.id)

    this.emit('moderation-completed', {
      flagId: flag.id,
      pluginId: flag.pluginId,
      action: flag.action,
      escalated: decision.escalate,
    })

    return flag
  }

  /**
   * Escalate flag
   */
  escalateFlag(flagId: string, moderatorId: string, reason: string): FlagRecord | null {
    const flag = this.flags.get(flagId)
    if (!flag) return null

    flag.status = ModerationStatus.ESCALATED
    flag.moderatedBy = moderatorId
    flag.comments = reason

    this.emit('flag-escalated', {
      flagId,
      pluginId: flag.pluginId,
      reason,
    })

    return flag
  }

  /**
   * Get flag
   */
  getFlag(flagId: string): FlagRecord | undefined {
    return this.flags.get(flagId)
  }

  /**
   * Get flags for plugin
   */
  getPluginFlags(pluginId: string): FlagRecord[] {
    return Array.from(this.flags.values()).filter((f) => f.pluginId === pluginId)
  }

  /**
   * Get moderation queue
   */
  getModerationQueue(status?: ModerationStatus): FlagRecord[] {
    if (status) {
      return this.queue.filter((f) => f.status === status)
    }
    return [...this.queue]
  }

  /**
   * Get flags by status
   */
  getFlagsByStatus(status: ModerationStatus): FlagRecord[] {
    return Array.from(this.flags.values()).filter((f) => f.status === status)
  }

  /**
   * Get flags by reason
   */
  getFlagsByReason(reason: FlagReason): FlagRecord[] {
    return Array.from(this.flags.values()).filter((f) => f.reason === reason)
  }

  /**
   * Get escalated flags
   */
  getEscalatedFlags(): FlagRecord[] {
    return Array.from(this.flags.values()).filter(
      (f) => f.status === ModerationStatus.ESCALATED
    )
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalFlags: number
    pendingFlags: number
    underReview: number
    resolved: number
    escalated: number
    byReason: Record<FlagReason, number>
    byAction: Record<ModerationAction, number>
  } {
    const flags = Array.from(this.flags.values())

    const byReason = {} as Record<FlagReason, number>
    const byAction = {} as Record<ModerationAction, number>

    for (const flag of flags) {
      byReason[flag.reason] = (byReason[flag.reason] || 0) + 1
      if (flag.action) {
        byAction[flag.action] = (byAction[flag.action] || 0) + 1
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
    }
  }

  /**
   * Clear flag
   */
  clearFlag(flagId: string): void {
    this.flags.delete(flagId)
    this.queue = this.queue.filter((f) => f.id !== flagId)

    this.emit('flag-cleared', { flagId })
  }

  /**
   * Clear all flags
   */
  clearAll(): void {
    this.flags.clear()
    this.queue = []
    this.flagIdCounter = 0

    this.emit('all-cleared')
  }
}

/**
 * Create moderation queue
 */
export function createModerationQueue(): PluginModerationQueue {
  return new PluginModerationQueue()
}

/**
 * Global moderation queue
 */
let globalQueue: PluginModerationQueue | null = null

/**
 * Get global moderation queue
 */
export function getGlobalModerationQueue(): PluginModerationQueue {
  if (!globalQueue) {
    globalQueue = createModerationQueue()
  }
  return globalQueue
}

/**
 * Reset global moderation queue
 */
export function resetGlobalModerationQueue(): void {
  globalQueue = null
}
