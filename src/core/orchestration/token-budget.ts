/**
 * Token Budget Manager
 *
 * Manages token budgets for embedded instructions to ensure
 * they don't exceed limits and are prioritized correctly.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionType,
  type TokenBudgetConfig,
  DEFAULT_TOKEN_BUDGET
} from './types.js';

/**
 * Token estimation result
 */
export interface TokenEstimation {
  /** Estimated token count */
  tokens: number;
  /** Characters in content */
  characters: number;
  /** Whether this is an exact count or estimate */
  isEstimate: boolean;
}

/**
 * Budget allocation result
 */
export interface BudgetAllocation {
  /** Instructions that fit within budget */
  included: EmbeddedInstruction[];
  /** Instructions that were excluded due to budget */
  excluded: EmbeddedInstruction[];
  /** Total tokens used */
  tokensUsed: number;
  /** Remaining budget */
  remaining: number;
  /** Per-type token usage */
  perTypeUsage: Record<InstructionType, number>;
}

/**
 * Token Budget Manager
 *
 * Handles token estimation and budget allocation for embedded instructions.
 * Uses a simple character-based estimation (4 characters ≈ 1 token).
 */
export class TokenBudgetManager {
  private config: TokenBudgetConfig;

  /** Characters per token estimate (conservative) */
  private static readonly CHARS_PER_TOKEN = 4;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = {
      ...DEFAULT_TOKEN_BUDGET,
      ...config,
      perType: {
        ...DEFAULT_TOKEN_BUDGET.perType,
        ...config?.perType
      }
    };

    logger.debug('TokenBudgetManager initialized', {
      maxTotal: this.config.maxTotal,
      criticalReserve: this.config.criticalReserve
    });
  }

  /**
   * Estimate tokens for a string
   */
  estimateTokens(content: string): TokenEstimation {
    const characters = content.length;
    const tokens = Math.ceil(characters / TokenBudgetManager.CHARS_PER_TOKEN);

    return {
      tokens,
      characters,
      isEstimate: true
    };
  }

  /**
   * Estimate tokens for an instruction (including formatting overhead)
   */
  estimateInstructionTokens(instruction: EmbeddedInstruction): number {
    // Include overhead for XML tags and formatting
    const overhead = 50; // ~50 tokens for <system-reminder> tags and metadata
    const contentTokens = this.estimateTokens(instruction.content).tokens;
    return contentTokens + overhead;
  }

  /**
   * Allocate budget for instructions
   *
   * Priority order:
   * 1. Critical instructions (always included, use reserve)
   * 2. High priority (included if budget allows)
   * 3. Normal priority (included if budget allows)
   * 4. Low priority (only if significant budget remains)
   */
  allocateBudget(instructions: EmbeddedInstruction[]): BudgetAllocation {
    const included: EmbeddedInstruction[] = [];
    const excluded: EmbeddedInstruction[] = [];
    const perTypeUsage: Record<InstructionType, number> = {
      task: 0,
      memory: 0,
      session: 0,
      delegation: 0,
      mode: 0
    };

    let tokensUsed = 0;
    const availableBudget = this.config.maxTotal;

    // Sort by priority (critical first, then high, normal, low)
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    const sorted = [...instructions].sort((a, b) => {
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      const priorityDiff = aPriority - bPriority;
      if (priorityDiff !== 0) return priorityDiff;
      // Within same priority, sort by creation time (oldest first)
      return a.createdAt - b.createdAt;
    });

    for (const instruction of sorted) {
      const instructionTokens = this.estimateInstructionTokens(instruction);
      const typeLimit = this.config.perType[instruction.type] || 0;
      const currentTypeUsage = perTypeUsage[instruction.type] || 0;

      // Check if we have budget
      const wouldExceedTotal = tokensUsed + instructionTokens > availableBudget;
      const wouldExceedTypeLimit = currentTypeUsage + instructionTokens > typeLimit;

      // Critical instructions use reserve and bypass type limits
      if (instruction.priority === 'critical') {
        const criticalBudget = availableBudget + this.config.criticalReserve;
        if (tokensUsed + instructionTokens <= criticalBudget) {
          included.push(instruction);
          tokensUsed += instructionTokens;
          perTypeUsage[instruction.type] = currentTypeUsage + instructionTokens;
          continue;
        }
      }

      // Non-critical: check both total and type limits
      if (!wouldExceedTotal && !wouldExceedTypeLimit) {
        included.push(instruction);
        tokensUsed += instructionTokens;
        perTypeUsage[instruction.type] = currentTypeUsage + instructionTokens;
      } else {
        excluded.push(instruction);
        logger.debug('Instruction excluded from budget', {
          type: instruction.type,
          priority: instruction.priority,
          tokens: instructionTokens,
          reason: wouldExceedTotal ? 'total_limit' : 'type_limit'
        });
      }
    }

    const result: BudgetAllocation = {
      included,
      excluded,
      tokensUsed,
      remaining: availableBudget - tokensUsed,
      perTypeUsage
    };

    logger.debug('Budget allocation complete', {
      included: included.length,
      excluded: excluded.length,
      tokensUsed,
      remaining: result.remaining
    });

    return result;
  }

  /**
   * Check if an instruction fits within budget
   */
  fitsInBudget(
    instruction: EmbeddedInstruction,
    currentUsage: number,
    typeUsage: Record<InstructionType, number>
  ): boolean {
    const instructionTokens = this.estimateInstructionTokens(instruction);
    const typeLimit = this.config.perType[instruction.type] || 0;
    const currentTypeUsage = typeUsage[instruction.type] || 0;

    // Critical instructions have more lenient checking
    if (instruction.priority === 'critical') {
      return currentUsage + instructionTokens <= this.config.maxTotal + this.config.criticalReserve;
    }

    return (
      currentUsage + instructionTokens <= this.config.maxTotal &&
      currentTypeUsage + instructionTokens <= typeLimit
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TokenBudgetConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      perType: {
        ...this.config.perType,
        ...updates.perType
      }
    };

    logger.debug('TokenBudgetManager config updated', {
      maxTotal: this.config.maxTotal
    });
  }

  /**
   * Get remaining budget for a specific type
   */
  getRemainingTypeBudget(
    type: InstructionType,
    currentTypeUsage: Record<InstructionType, number>
  ): number {
    const limit = this.config.perType[type] || 0;
    const used = currentTypeUsage[type] || 0;
    return Math.max(0, limit - used);
  }

  /**
   * Format budget status for debugging
   */
  formatBudgetStatus(allocation: BudgetAllocation): string {
    const lines = [
      `Token Budget Status:`,
      `  Total: ${allocation.tokensUsed}/${this.config.maxTotal} (${allocation.remaining} remaining)`,
      `  Per-Type Usage:`
    ];

    for (const [type, used] of Object.entries(allocation.perTypeUsage)) {
      const limit = this.config.perType[type as InstructionType] || 0;
      lines.push(`    ${type}: ${used}/${limit}`);
    }

    if (allocation.excluded.length > 0) {
      lines.push(`  Excluded: ${allocation.excluded.length} instruction(s)`);
    }

    return lines.join('\n');
  }
}
