/**
 * Token Budget Allocator Implementation
 *
 * Manages token allocation for embedded instructions to prevent
 * context window overflow.
 */
import { type EmbeddedInstruction, type TokenBudgetConfig, type BudgetAllocation, type BudgetStatus, type InstructionType, type InstructionPriority } from '@automatosx/contracts';
/**
 * Token budget allocator interface
 */
export interface TokenBudgetAllocator {
    /**
     * Allocate budget for instructions
     */
    allocate(instructions: EmbeddedInstruction[]): BudgetAllocation;
    /**
     * Get current budget status
     */
    getStatus(): BudgetStatus;
    /**
     * Update configuration
     */
    setConfig(config: TokenBudgetConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): TokenBudgetConfig;
    /**
     * Estimate tokens for content
     */
    estimateTokens(content: string): number;
}
/**
 * Default token budget allocator implementation
 */
export declare class DefaultTokenBudgetAllocator implements TokenBudgetAllocator {
    private config;
    private currentAllocation;
    constructor(config?: TokenBudgetConfig);
    /**
     * Allocate budget for instructions
     */
    allocate(instructions: EmbeddedInstruction[]): BudgetAllocation;
    /**
     * Get current budget status
     */
    getStatus(): BudgetStatus;
    /**
     * Update configuration
     */
    setConfig(config: TokenBudgetConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): TokenBudgetConfig;
    /**
     * Estimate tokens for content using rule-based approximation
     *
     * Uses a simple heuristic: ~4 characters per token for English text.
     * This is a rough approximation - for exact counts, use a tokenizer.
     */
    estimateTokens(content: string): number;
    /**
     * Get type limit from config
     */
    private getTypeLimit;
}
/**
 * Token budget error
 */
export declare class TokenBudgetError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
/**
 * Creates a new token budget allocator
 */
export declare function createTokenBudgetAllocator(config?: TokenBudgetConfig): TokenBudgetAllocator;
/**
 * Creates an embedded instruction
 */
export declare function createInstruction(type: InstructionType, content: string, priority?: InstructionPriority, metadata?: Record<string, unknown>): EmbeddedInstruction;
//# sourceMappingURL=allocator.d.ts.map