/**
 * Discussion Cost Tracker
 *
 * Tracks costs and resource usage across discussion execution.
 * Enforces budget limits and provides visibility into spending.
 *
 * Invariants:
 * - INV-DISC-620: Total calls ≤ maxTotalCalls
 * - INV-DISC-621: Abort if cost budget exceeded
 */

import type { CostControlConfig } from '@defai.digital/contracts';
import { DEFAULT_MAX_TOTAL_CALLS } from '@defai.digital/contracts';

/**
 * Cost per provider (approximate, in USD per 1K tokens)
 * These are rough estimates for planning purposes
 */
export const PROVIDER_COSTS: Record<string, { input: number; output: number }> = {
  claude: { input: 0.003, output: 0.015 },
  gemini: { input: 0.0005, output: 0.0015 },
  codex: { input: 0.003, output: 0.006 },
  qwen: { input: 0.001, output: 0.002 },
  glm: { input: 0.001, output: 0.002 },
  grok: { input: 0.002, output: 0.004 },
};

/**
 * Default cost per provider if not in the map
 */
const DEFAULT_COST = { input: 0.002, output: 0.004 };

/**
 * Provider call record
 */
export interface ProviderCallRecord {
  /** Provider ID */
  providerId: string;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Estimated cost in USD */
  estimatedCostUsd: number;

  /** Discussion depth where call occurred */
  depth: number;

  /** Timestamp */
  timestamp: string;

  /** Whether call succeeded */
  success: boolean;
}

/**
 * Cost tracking summary
 */
export interface CostSummary {
  /** Total provider calls made */
  totalCalls: number;

  /** Total input tokens */
  totalInputTokens: number;

  /** Total output tokens */
  totalOutputTokens: number;

  /** Total estimated cost in USD */
  totalCostUsd: number;

  /** Cost breakdown by provider */
  byProvider: Record<string, {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;

  /** Cost breakdown by depth level */
  byDepth: Record<number, {
    calls: number;
    costUsd: number;
  }>;

  /** Whether budget limit was exceeded */
  budgetExceeded: boolean;

  /** Whether call limit was exceeded */
  callLimitExceeded: boolean;

  /** Remaining budget (if configured) */
  remainingBudgetUsd: number | undefined;

  /** Remaining calls */
  remainingCalls: number;
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  /** Whether operation is allowed */
  allowed: boolean;

  /** Reason if not allowed */
  reason?: string;

  /** Current usage metrics */
  currentCalls: number;
  currentCostUsd: number;

  /** Estimated cost of proposed operation */
  estimatedCostUsd?: number;
}

/**
 * Discussion cost tracker interface
 */
export interface DiscussionCostTracker {
  /** Record a provider call */
  recordCall(record: Omit<ProviderCallRecord, 'estimatedCostUsd' | 'timestamp'>): void;

  /** Check if a call is within budget */
  checkBudget(providerId: string, estimatedTokens?: number): BudgetCheckResult;

  /** Get current cost summary */
  getSummary(): CostSummary;

  /** Get total calls made */
  getTotalCalls(): number;

  /** Get remaining calls */
  getRemainingCalls(): number;

  /** Check if budget exceeded */
  isBudgetExceeded(): boolean;

  /** Check if call limit exceeded */
  isCallLimitExceeded(): boolean;

  /** Estimate cost for a provider call */
  estimateCost(providerId: string, inputTokens: number, outputTokens: number): number;

  /** Create child tracker for sub-discussion */
  createChildTracker(depth: number): DiscussionCostTracker;
}

/**
 * Create a cost tracker for a discussion
 */
export function createCostTracker(
  config: CostControlConfig,
  parentTracker?: DiscussionCostTracker
): DiscussionCostTracker {
  const calls: ProviderCallRecord[] = [];
  const maxTotalCalls = config.maxTotalCalls ?? DEFAULT_MAX_TOTAL_CALLS;
  const budgetUsd = config.budgetUsd;

  // Track inherited calls from parent
  const parentCalls = parentTracker?.getTotalCalls() ?? 0;

  return {
    recordCall(record): void {
      const cost = estimateCallCost(
        record.providerId,
        record.inputTokens,
        record.outputTokens
      );

      calls.push({
        ...record,
        estimatedCostUsd: cost,
        timestamp: new Date().toISOString(),
      });
    },

    checkBudget(providerId, estimatedTokens = 1000): BudgetCheckResult {
      const currentCalls = calls.length + parentCalls;
      const currentCost = calls.reduce((sum, c) => sum + c.estimatedCostUsd, 0);

      // Check call limit
      if (currentCalls >= maxTotalCalls) {
        return {
          allowed: false,
          reason: `Call limit ${maxTotalCalls} reached`,
          currentCalls,
          currentCostUsd: currentCost,
        };
      }

      // Check budget limit if configured
      if (budgetUsd !== undefined) {
        const estimatedCost = estimateCallCost(providerId, estimatedTokens, estimatedTokens);
        if (currentCost + estimatedCost > budgetUsd) {
          return {
            allowed: false,
            reason: `Budget limit $${budgetUsd.toFixed(2)} would be exceeded`,
            currentCalls,
            currentCostUsd: currentCost,
            estimatedCostUsd: estimatedCost,
          };
        }
      }

      return {
        allowed: true,
        currentCalls,
        currentCostUsd: currentCost,
      };
    },

    getSummary(): CostSummary {
      const byProvider: CostSummary['byProvider'] = {};
      const byDepth: CostSummary['byDepth'] = {};

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostUsd = 0;

      for (const call of calls) {
        // Aggregate by provider
        if (!byProvider[call.providerId]) {
          byProvider[call.providerId] = {
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
          };
        }
        const providerStats = byProvider[call.providerId]!;
        providerStats.calls++;
        providerStats.inputTokens += call.inputTokens;
        providerStats.outputTokens += call.outputTokens;
        providerStats.costUsd += call.estimatedCostUsd;

        // Aggregate by depth
        if (!byDepth[call.depth]) {
          byDepth[call.depth] = { calls: 0, costUsd: 0 };
        }
        const depthStats = byDepth[call.depth]!;
        depthStats.calls++;
        depthStats.costUsd += call.estimatedCostUsd;

        // Totals
        totalInputTokens += call.inputTokens;
        totalOutputTokens += call.outputTokens;
        totalCostUsd += call.estimatedCostUsd;
      }

      const totalCalls = calls.length + parentCalls;

      return {
        totalCalls,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        byProvider,
        byDepth,
        budgetExceeded: budgetUsd !== undefined && totalCostUsd > budgetUsd,
        callLimitExceeded: totalCalls >= maxTotalCalls,
        remainingBudgetUsd: budgetUsd !== undefined ? Math.max(0, budgetUsd - totalCostUsd) : undefined,
        remainingCalls: Math.max(0, maxTotalCalls - totalCalls),
      };
    },

    getTotalCalls(): number {
      return calls.length + parentCalls;
    },

    getRemainingCalls(): number {
      return Math.max(0, maxTotalCalls - (calls.length + parentCalls));
    },

    isBudgetExceeded(): boolean {
      if (budgetUsd === undefined) return false;
      const totalCost = calls.reduce((sum, c) => sum + c.estimatedCostUsd, 0);
      return totalCost > budgetUsd;
    },

    isCallLimitExceeded(): boolean {
      return calls.length + parentCalls > maxTotalCalls;
    },

    estimateCost(providerId, inputTokens, outputTokens): number {
      return estimateCallCost(providerId, inputTokens, outputTokens);
    },

    createChildTracker(depth: number): DiscussionCostTracker {
      // Child tracker inherits call count from parent
      const childConfig = { ...config };
      const childTracker = createCostTracker(childConfig, this);

      // Wrapper to set depth on all recorded calls
      const originalRecord = childTracker.recordCall.bind(childTracker);
      childTracker.recordCall = (record) => {
        originalRecord({ ...record, depth });
      };

      return childTracker;
    },
  };
}

/**
 * Estimate cost for a provider call
 */
function estimateCallCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = PROVIDER_COSTS[providerId] || DEFAULT_COST;

  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;

  return inputCost + outputCost;
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    // Display in cents without dollar sign
    return `${(costUsd * 100).toFixed(2)}¢`;
  }
  return `$${costUsd.toFixed(4)}`;
}

/**
 * Format cost summary for CLI/logs
 */
export function formatCostSummary(summary: CostSummary): string {
  const lines: string[] = [
    `Cost Summary:`,
    `  Total Calls: ${summary.totalCalls}`,
    `  Total Tokens: ${summary.totalInputTokens} in / ${summary.totalOutputTokens} out`,
    `  Estimated Cost: ${formatCost(summary.totalCostUsd)}`,
  ];

  if (summary.remainingBudgetUsd !== undefined) {
    lines.push(`  Remaining Budget: ${formatCost(summary.remainingBudgetUsd)}`);
  }

  lines.push(`  Remaining Calls: ${summary.remainingCalls}`);

  if (Object.keys(summary.byProvider).length > 0) {
    lines.push(`  By Provider:`);
    for (const [provider, data] of Object.entries(summary.byProvider)) {
      lines.push(`    ${provider}: ${data.calls} calls, ${formatCost(data.costUsd)}`);
    }
  }

  return lines.join('\n');
}
