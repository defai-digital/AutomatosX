/**
 * Feedback Collector
 *
 * Collect and store feedback records.
 *
 * Invariants:
 * - INV-FBK-001: Feedback records immutable
 * - INV-FBK-100: No duplicate feedback
 */

import type {
  FeedbackRecord,
  SubmitFeedbackInput,
  AgentFeedbackStats,
  FeedbackOverview,
} from '@defai.digital/contracts';
import {
  createDefaultFeedbackLearningConfig,
  createTaskHash,
} from '@defai.digital/contracts';
import type {
  FeedbackCollector,
  FeedbackCollectorOptions,
  FeedbackStoragePort,
} from './types.js';

/**
 * Create in-memory feedback storage
 */
export function createInMemoryFeedbackStorage(): FeedbackStoragePort {
  const records = new Map<string, FeedbackRecord>();

  return {
    async store(record: FeedbackRecord): Promise<void> {
      // INV-FBK-001: Records are immutable - just store, never update
      records.set(record.feedbackId, record);
    },

    async get(feedbackId: string): Promise<FeedbackRecord | null> {
      return records.get(feedbackId) ?? null;
    },

    async list(options?: {
      agentId?: string;
      limit?: number;
      offset?: number;
      since?: string;
    }): Promise<FeedbackRecord[]> {
      let results = Array.from(records.values());

      // Filter by agent
      if (options?.agentId) {
        results = results.filter((r) => r.selectedAgent === options.agentId);
      }

      // Filter by date
      if (options?.since) {
        const sinceDate = new Date(options.since);
        results = results.filter((r) => new Date(r.timestamp) >= sinceDate);
      }

      // Sort by timestamp (newest first)
      results.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply pagination
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? 100;
      return results.slice(offset, offset + limit);
    },

    async count(options?: { agentId?: string; since?: string }): Promise<number> {
      let count = 0;
      for (const record of records.values()) {
        if (options?.agentId && record.selectedAgent !== options.agentId) {
          continue;
        }
        if (options?.since && new Date(record.timestamp) < new Date(options.since)) {
          continue;
        }
        count++;
      }
      return count;
    },

    async deleteOlderThan(date: string): Promise<number> {
      const threshold = new Date(date);
      let deleted = 0;
      for (const [id, record] of records) {
        if (new Date(record.timestamp) < threshold) {
          records.delete(id);
          deleted++;
        }
      }
      return deleted;
    },
  };
}

/**
 * Create feedback collector
 */
export function createFeedbackCollector(
  options: FeedbackCollectorOptions
): FeedbackCollector {
  const { storage } = options;
  // Config is available for future use - call it to get defaults
  void (options.config ?? createDefaultFeedbackLearningConfig());

  // Track recent submissions for deduplication
  // INV-FBK-100: No duplicate feedback
  const recentSubmissions = new Map<string, number>();
  const DEDUP_WINDOW_MS = 60000; // 1 minute

  return {
    async submit(input: SubmitFeedbackInput): Promise<FeedbackRecord> {
      // INV-FBK-100: Check for duplicates
      const dedupKey = `${input.selectedAgent}:${createTaskHash(input.taskDescription)}`;
      const lastSubmit = recentSubmissions.get(dedupKey);
      const now = Date.now();

      if (lastSubmit && now - lastSubmit < DEDUP_WINDOW_MS) {
        throw new Error('Duplicate feedback submission detected');
      }

      // Create feedback record
      const record: FeedbackRecord = {
        feedbackId: crypto.randomUUID(),
        taskDescription: input.taskDescription,
        taskHash: createTaskHash(input.taskDescription),
        selectedAgent: input.selectedAgent,
        feedbackType: input.feedbackType,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      // Add optional fields only if defined
      if (input.recommendedAgent !== undefined) {
        record.recommendedAgent = input.recommendedAgent;
      }
      if (input.rating !== undefined) {
        record.rating = input.rating;
      }
      if (input.outcome !== undefined) {
        record.outcome = input.outcome;
      }
      if (input.durationMs !== undefined) {
        record.durationMs = input.durationMs;
      }
      if (input.userComment !== undefined) {
        record.userComment = input.userComment;
      }
      if (input.sessionId !== undefined) {
        record.sessionId = input.sessionId;
      }

      // Store the record
      // INV-FBK-001: Immutable after this point
      await storage.store(record);

      // Track for deduplication
      recentSubmissions.set(dedupKey, now);

      // Cleanup old dedup entries - collect keys first to avoid concurrent modification
      const keysToDelete: string[] = [];
      for (const [key, time] of recentSubmissions) {
        if (now - time > DEDUP_WINDOW_MS) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        recentSubmissions.delete(key);
      }

      return record;
    },

    async getHistory(options?: {
      agentId?: string;
      limit?: number;
      since?: string;
    }): Promise<FeedbackRecord[]> {
      return storage.list(options);
    },

    async getAgentStats(agentId: string): Promise<AgentFeedbackStats> {
      const records = await storage.list({ agentId });

      const totalFeedback = records.length;
      const ratings = records.filter((r) => r.rating !== undefined).map((r) => r.rating!);
      const avgRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;

      const outcomes = records.filter((r) => r.outcome !== undefined);
      const successCount = outcomes.filter((r) => r.outcome === 'success').length;
      const successRate = outcomes.length > 0 ? successCount / outcomes.length : 1;

      const recommended = records.filter((r) => r.recommendedAgent !== undefined);
      const acceptedCount = recommended.filter(
        (r) => r.recommendedAgent === r.selectedAgent
      ).length;
      const recommendationAcceptRate =
        recommended.length > 0 ? acceptedCount / recommended.length : 1;

      const durations = records
        .filter((r) => r.durationMs !== undefined)
        .map((r) => r.durationMs!);
      const avgDurationMs =
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : undefined;

      // Extract top patterns
      const patternCounts = new Map<string, number>();
      for (const record of records) {
        const count = patternCounts.get(record.taskHash) ?? 0;
        patternCounts.set(record.taskHash, count + 1);
      }
      const topPatterns = Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern]) => pattern);

      const lastFeedback =
        records.length > 0
          ? records.reduce((latest, r) =>
              new Date(r.timestamp) > new Date(latest.timestamp) ? r : latest
            ).timestamp
          : undefined;

      return {
        agentId,
        totalFeedback,
        avgRating,
        successRate,
        recommendationAcceptRate,
        avgDurationMs,
        topPatterns,
        lastFeedback,
      };
    },

    async getOverview(): Promise<FeedbackOverview> {
      const allRecords = await storage.list({ limit: 10000 });
      const totalFeedback = allRecords.length;

      // Count by type
      const feedbackByType: Record<string, number> = {
        explicit: 0,
        implicit: 0,
        outcome: 0,
      };
      for (const record of allRecords) {
        feedbackByType[record.feedbackType] =
          (feedbackByType[record.feedbackType] ?? 0) + 1;
      }

      // Average rating
      const ratings = allRecords
        .filter((r) => r.rating !== undefined)
        .map((r) => r.rating!);
      const avgRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;

      // Success rate
      const outcomes = allRecords.filter((r) => r.outcome !== undefined);
      const successCount = outcomes.filter((r) => r.outcome === 'success').length;
      const overallSuccessRate = outcomes.length > 0 ? successCount / outcomes.length : 1;

      // Top agents
      const agentScores = new Map<string, number>();
      for (const record of allRecords) {
        const score = agentScores.get(record.selectedAgent) ?? 0;
        const delta = record.rating ?? (record.outcome === 'success' ? 5 : 1);
        agentScores.set(record.selectedAgent, score + delta);
      }
      const topAgents = Array.from(agentScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([agentId, score]) => ({ agentId, score }));

      // Calculate trend (simplified)
      const recentRecords = allRecords.slice(0, 20);
      const olderRecords = allRecords.slice(20, 40);
      const recentSuccessRate =
        recentRecords.length > 0
          ? recentRecords.filter((r) => r.outcome === 'success').length / recentRecords.length
          : 1;
      const olderSuccessRate =
        olderRecords.length > 0
          ? olderRecords.filter((r) => r.outcome === 'success').length / olderRecords.length
          : 1;

      let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentSuccessRate > olderSuccessRate + 0.1) {
        recentTrend = 'improving';
      } else if (recentSuccessRate < olderSuccessRate - 0.1) {
        recentTrend = 'declining';
      }

      return {
        totalFeedback,
        feedbackByType: feedbackByType as Record<'explicit' | 'implicit' | 'outcome', number>,
        avgRating,
        overallSuccessRate,
        topAgents,
        recentTrend,
        lastUpdated: new Date().toISOString(),
      };
    },
  };
}
