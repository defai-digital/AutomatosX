/**
 * Orchestration Instruction Injector
 *
 * Core class for injecting embedded instructions into tool results.
 * Manages instruction providers, token budgets, and formatting.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import { TokenBudgetManager, type BudgetAllocation } from './token-budget.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  type OrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG
} from './types.js';

/**
 * Options for instruction injection
 */
export interface InjectionOptions {
  /** Skip budget allocation (include all instructions) */
  skipBudget?: boolean;
  /** Additional context to pass to providers */
  additionalContext?: Record<string, unknown>;
  /** Filter specific instruction types */
  includeTypes?: string[];
  /** Exclude specific instruction types */
  excludeTypes?: string[];
}

/**
 * Result of instruction injection
 */
export interface InjectionResult {
  /** Formatted instruction text to append to tool result */
  formattedText: string;
  /** All instructions that were included */
  instructions: EmbeddedInstruction[];
  /** Budget allocation details */
  allocation: BudgetAllocation;
  /** Whether any instructions were generated */
  hasInstructions: boolean;
}

/**
 * Orchestration Instruction Injector
 *
 * Coordinates instruction providers, manages token budgets,
 * and formats embedded instructions for injection.
 */
export class OrchestrationInstructionInjector {
  private providers: Map<string, InstructionProvider> = new Map();
  private budgetManager: TokenBudgetManager;
  private config: OrchestrationConfig;
  private lastInjectionTime: number = 0;
  private instructionCache: Map<string, EmbeddedInstruction[]> = new Map();

  constructor(config?: Partial<OrchestrationConfig>) {
    this.config = {
      ...DEFAULT_ORCHESTRATION_CONFIG,
      ...config
    };
    this.budgetManager = new TokenBudgetManager(this.config.tokenBudget);

    logger.debug('OrchestrationInstructionInjector initialized', {
      enabled: this.config.enabled,
      providers: this.providers.size
    });
  }

  /**
   * Register an instruction provider
   */
  registerProvider(provider: InstructionProvider): void {
    if (this.providers.has(provider.name)) {
      logger.warn('Provider already registered, replacing', {
        name: provider.name
      });
    }

    this.providers.set(provider.name, provider);
    logger.debug('Instruction provider registered', {
      name: provider.name,
      totalProviders: this.providers.size
    });
  }

  /**
   * Unregister an instruction provider
   */
  unregisterProvider(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      logger.debug('Instruction provider unregistered', { name });
    }
    return removed;
  }

  /**
   * Get all registered providers
   */
  getProviders(): InstructionProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Generate and inject instructions based on context
   */
  async inject(
    context: OrchestrationContext,
    options: InjectionOptions = {}
  ): Promise<InjectionResult> {
    // Check if enabled
    if (!this.config.enabled) {
      return this.emptyResult();
    }

    const startTime = Date.now();
    const allInstructions: EmbeddedInstruction[] = [];

    // Collect instructions from all providers
    for (const provider of this.providers.values()) {
      try {
        // Check if provider should generate
        if (!provider.shouldGenerate(context)) {
          continue;
        }

        const instructions = await provider.getInstructions(context);

        // Filter by type if specified
        let filtered = instructions;
        if (options.includeTypes) {
          filtered = filtered.filter(i => options.includeTypes!.includes(i.type));
        }
        if (options.excludeTypes) {
          filtered = filtered.filter(i => !options.excludeTypes!.includes(i.type));
        }

        allInstructions.push(...filtered);
      } catch (error) {
        logger.error('Provider failed to generate instructions', {
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Filter expired instructions
    const activeInstructions = this.filterExpiredInstructions(
      allInstructions,
      context.turnCount
    );

    // Allocate budget
    let allocation: BudgetAllocation;
    if (options.skipBudget) {
      allocation = {
        included: activeInstructions,
        excluded: [],
        tokensUsed: activeInstructions.reduce(
          (sum, i) => sum + this.budgetManager.estimateInstructionTokens(i),
          0
        ),
        remaining: 0,
        perTypeUsage: this.calculateTypeUsage(activeInstructions)
      };
    } else {
      allocation = this.budgetManager.allocateBudget(activeInstructions);
    }

    // Format instructions
    const formattedText = this.formatInstructions(allocation.included);

    // Update timing
    this.lastInjectionTime = Date.now();

    const duration = Date.now() - startTime;
    logger.debug('Instruction injection complete', {
      providers: this.providers.size,
      instructionsGenerated: allInstructions.length,
      instructionsIncluded: allocation.included.length,
      tokensUsed: allocation.tokensUsed,
      durationMs: duration
    });

    return {
      formattedText,
      instructions: allocation.included,
      allocation,
      hasInstructions: allocation.included.length > 0
    };
  }

  /**
   * Format instructions as system reminder tags
   */
  formatInstructions(instructions: EmbeddedInstruction[]): string {
    if (instructions.length === 0) {
      return '';
    }

    // Group by type for better organization
    const grouped = new Map<string, EmbeddedInstruction[]>();
    for (const instruction of instructions) {
      const existing = grouped.get(instruction.type) || [];
      existing.push(instruction);
      grouped.set(instruction.type, existing);
    }

    const parts: string[] = [];

    // Process in priority order: mode, task, memory, session, delegation
    const typeOrder = ['mode', 'task', 'memory', 'session', 'delegation'];

    for (const type of typeOrder) {
      const typeInstructions = grouped.get(type);
      if (!typeInstructions || typeInstructions.length === 0) continue;

      for (const instruction of typeInstructions) {
        parts.push(this.formatSingleInstruction(instruction));
      }
    }

    return parts.join('\n');
  }

  /**
   * Format a single instruction as a system reminder
   */
  private formatSingleInstruction(instruction: EmbeddedInstruction): string {
    return `<system-reminder>\n${instruction.content}\n</system-reminder>`;
  }

  /**
   * Filter out expired instructions
   */
  private filterExpiredInstructions(
    instructions: EmbeddedInstruction[],
    currentTurn: number
  ): EmbeddedInstruction[] {
    return instructions.filter(instruction => {
      if (instruction.expiresAfter === undefined) {
        return true; // No expiry
      }

      // Calculate turn when instruction was created (approximate)
      // Expiry is based on turns since creation
      const turnsSinceCreation = currentTurn; // Simplified: assume created at turn 0
      return turnsSinceCreation < instruction.expiresAfter;
    });
  }

  /**
   * Calculate per-type token usage
   */
  private calculateTypeUsage(
    instructions: EmbeddedInstruction[]
  ): Record<string, number> {
    const usage: Record<string, number> = {
      task: 0,
      memory: 0,
      session: 0,
      delegation: 0,
      mode: 0
    };

    for (const instruction of instructions) {
      const tokens = this.budgetManager.estimateInstructionTokens(instruction);
      usage[instruction.type] = (usage[instruction.type] || 0) + tokens;
    }

    return usage;
  }

  /**
   * Create an empty result
   */
  private emptyResult(): InjectionResult {
    return {
      formattedText: '',
      instructions: [],
      allocation: {
        included: [],
        excluded: [],
        tokensUsed: 0,
        remaining: this.budgetManager.getConfig().maxTotal,
        perTypeUsage: {
          task: 0,
          memory: 0,
          session: 0,
          delegation: 0,
          mode: 0
        }
      },
      hasInstructions: false
    };
  }

  /**
   * Clear instruction cache
   */
  clearCache(): void {
    this.instructionCache.clear();
    logger.debug('Instruction cache cleared');
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestrationConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    if (updates.tokenBudget) {
      this.budgetManager.updateConfig(updates.tokenBudget);
    }

    logger.debug('OrchestrationInstructionInjector config updated', {
      enabled: this.config.enabled
    });
  }

  /**
   * Get budget manager for direct access
   */
  getBudgetManager(): TokenBudgetManager {
    return this.budgetManager;
  }

  /**
   * Check if orchestration is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable orchestration
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.debug('Orchestration enabled state changed', { enabled });
  }
}

/**
 * Create a simple instruction manually
 */
export function createInstruction(
  type: EmbeddedInstruction['type'],
  content: string,
  priority: EmbeddedInstruction['priority'] = 'normal',
  options?: {
    expiresAfter?: number;
    id?: string;
  }
): EmbeddedInstruction {
  return {
    type,
    priority,
    content,
    source: 'automatosx',
    createdAt: Date.now(),
    expiresAfter: options?.expiresAfter,
    id: options?.id || `${type}-${Date.now()}`
  };
}
