/**
 * Token Budget Allocator Implementation
 *
 * Manages token allocation for embedded instructions to prevent
 * context window overflow.
 */
import { DEFAULT_TOKEN_BUDGET, getPriorityValue, getTypePriorityValue, } from '@automatosx/contracts';
/**
 * Default token budget allocator implementation
 */
export class DefaultTokenBudgetAllocator {
    config;
    currentAllocation = null;
    constructor(config = DEFAULT_TOKEN_BUDGET) {
        this.config = config;
    }
    /**
     * Allocate budget for instructions
     */
    allocate(instructions) {
        const now = new Date().toISOString();
        // Estimate tokens for instructions without estimates
        const instructionsWithTokens = instructions.map((instr) => ({
            ...instr,
            estimatedTokens: instr.estimatedTokens ?? this.estimateTokens(instr.content),
        }));
        // Sort by priority (critical first, then by type priority)
        const sorted = [...instructionsWithTokens].sort((a, b) => {
            const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
            if (priorityDiff !== 0)
                return priorityDiff;
            return getTypePriorityValue(b.type) - getTypePriorityValue(a.type);
        });
        const included = [];
        const excluded = [];
        const usageByType = {
            memory: 0,
            todo: 0,
            session: 0,
            context: 0,
            system: 0,
        };
        let totalTokens = 0;
        let criticalReserveUsed = 0;
        // Allocate instructions
        for (const instruction of sorted) {
            const tokens = instruction.estimatedTokens ?? 0;
            const type = instruction.type;
            // Check type limit
            const typeLimit = this.getTypeLimit(type);
            const typeUsage = usageByType[type];
            const typeRemaining = typeLimit - typeUsage;
            // Check total budget
            const totalRemaining = this.config.maxTotal - totalTokens;
            // Critical instructions can use reserve
            if (instruction.priority === 'critical') {
                const availableWithReserve = totalRemaining + (this.config.criticalReserve - criticalReserveUsed);
                if (tokens <= availableWithReserve && tokens <= typeRemaining) {
                    // Use regular budget first, then reserve
                    const fromRegular = Math.min(tokens, totalRemaining);
                    const fromReserve = tokens - fromRegular;
                    totalTokens += fromRegular;
                    criticalReserveUsed += fromReserve;
                    usageByType[type] += tokens;
                    included.push(instruction);
                }
                else {
                    excluded.push(instruction);
                }
            }
            else {
                // Non-critical: must fit within regular budget
                if (tokens <= totalRemaining && tokens <= typeRemaining) {
                    totalTokens += tokens;
                    usageByType[type] += tokens;
                    included.push(instruction);
                }
                else {
                    excluded.push(instruction);
                }
            }
        }
        const allocation = {
            included,
            excluded,
            totalTokens: totalTokens + criticalReserveUsed,
            remaining: this.config.maxTotal - totalTokens,
            usageByType,
            criticalReserveUsed,
            allocationTimestamp: now,
        };
        this.currentAllocation = allocation;
        return allocation;
    }
    /**
     * Get current budget status
     */
    getStatus() {
        const currentUsage = this.currentAllocation?.totalTokens ?? 0;
        const usageByType = this.currentAllocation?.usageByType ?? {
            memory: 0,
            todo: 0,
            session: 0,
            context: 0,
            system: 0,
        };
        const remaining = this.config.maxTotal - currentUsage;
        const criticalReserveAvailable = this.config.criticalReserve -
            (this.currentAllocation?.criticalReserveUsed ?? 0);
        return {
            config: this.config,
            currentUsage,
            usageByType,
            remaining,
            criticalReserveAvailable,
            utilizationPercent: (currentUsage / this.config.maxTotal) * 100,
            canAcceptMore: remaining > 0,
        };
    }
    /**
     * Update configuration
     */
    setConfig(config) {
        this.config = config;
        this.currentAllocation = null;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Estimate tokens for content using rule-based approximation
     *
     * Uses a simple heuristic: ~4 characters per token for English text.
     * This is a rough approximation - for exact counts, use a tokenizer.
     */
    estimateTokens(content) {
        // Basic heuristic: ~4 characters per token
        // This works reasonably well for English text
        const charCount = content.length;
        const wordCount = content.split(/\s+/).length;
        // Average of character-based and word-based estimates
        const charEstimate = Math.ceil(charCount / 4);
        const wordEstimate = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word
        return Math.ceil((charEstimate + wordEstimate) / 2);
    }
    /**
     * Get type limit from config
     */
    getTypeLimit(type) {
        const limit = this.config.perType[type];
        return limit ?? this.config.maxTotal;
    }
}
/**
 * Token budget error
 */
export class TokenBudgetError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'TokenBudgetError';
    }
}
/**
 * Creates a new token budget allocator
 */
export function createTokenBudgetAllocator(config) {
    return new DefaultTokenBudgetAllocator(config);
}
/**
 * Creates an embedded instruction
 */
export function createInstruction(type, content, priority = 'normal', metadata) {
    return {
        id: crypto.randomUUID(),
        type,
        content,
        priority,
        createdAt: new Date().toISOString(),
        metadata,
    };
}
//# sourceMappingURL=allocator.js.map