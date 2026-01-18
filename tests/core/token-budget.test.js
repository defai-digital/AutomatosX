/**
 * Token Budget Tests
 *
 * Tests for token budget allocation functionality.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultTokenBudgetAllocator, TokenBudgetError, createTokenBudgetAllocator, createInstruction, } from '@defai.digital/token-budget';
import { DEFAULT_TOKEN_BUDGET, } from '@defai.digital/contracts';
describe('Token Budget', () => {
    describe('DefaultTokenBudgetAllocator', () => {
        let allocator;
        beforeEach(() => {
            allocator = new DefaultTokenBudgetAllocator();
        });
        describe('constructor', () => {
            it('should use default config when none provided', () => {
                const config = allocator.getConfig();
                expect(config).toEqual(DEFAULT_TOKEN_BUDGET);
            });
            it('should use custom config when provided', () => {
                const customConfig = {
                    maxTotal: 8000,
                    perType: {
                        memory: 3000,
                        todo: 1500,
                        session: 1500,
                        context: 1000,
                        system: 1000,
                    },
                    criticalReserve: 1000,
                };
                const customAllocator = new DefaultTokenBudgetAllocator(customConfig);
                expect(customAllocator.getConfig()).toEqual(customConfig);
            });
        });
        describe('estimateTokens', () => {
            it('should estimate tokens for short text', () => {
                const tokens = allocator.estimateTokens('Hello world');
                expect(tokens).toBeGreaterThan(0);
                expect(tokens).toBeLessThan(10);
            });
            it('should estimate tokens for longer text', () => {
                const text = 'This is a longer piece of text that contains multiple words and should result in more tokens being estimated.';
                const tokens = allocator.estimateTokens(text);
                expect(tokens).toBeGreaterThan(10);
                expect(tokens).toBeLessThan(100);
            });
            it('should estimate higher tokens for longer content', () => {
                const short = allocator.estimateTokens('Short');
                const long = allocator.estimateTokens('This is a much longer piece of text');
                expect(long).toBeGreaterThan(short);
            });
            it('should handle empty string', () => {
                const tokens = allocator.estimateTokens('');
                expect(tokens).toBeGreaterThanOrEqual(0);
            });
        });
        describe('allocate', () => {
            it('should allocate all instructions within budget', () => {
                const instructions = [
                    createInstruction('system', 'System prompt', 'critical'),
                    createInstruction('memory', 'Memory context', 'normal'),
                    createInstruction('todo', 'Task list', 'low'),
                ];
                const result = allocator.allocate(instructions);
                expect(result.included).toHaveLength(3);
                expect(result.excluded).toHaveLength(0);
                expect(result.totalTokens).toBeGreaterThan(0);
            });
            it('should prioritize critical instructions', () => {
                const config = {
                    maxTotal: 50, // Very small budget
                    perType: {
                        memory: 100,
                        todo: 100,
                        session: 100,
                        context: 100,
                        system: 100,
                    },
                    criticalReserve: 50,
                };
                const allocator = new DefaultTokenBudgetAllocator(config);
                const instructions = [
                    createInstruction('system', 'Critical system prompt', 'critical'),
                    createInstruction('todo', 'Low priority task', 'low'),
                ];
                const result = allocator.allocate(instructions);
                // Critical should be included even with reserve
                const criticalIncluded = result.included.some((i) => i.priority === 'critical');
                expect(criticalIncluded).toBe(true);
            });
            it('should exclude instructions that exceed budget', () => {
                const config = {
                    maxTotal: 100,
                    perType: {
                        memory: 50,
                        todo: 50,
                        session: 50,
                        context: 50,
                        system: 50,
                    },
                    criticalReserve: 20,
                };
                const allocator = new DefaultTokenBudgetAllocator(config);
                // Create instruction with known token count
                const longContent = 'x'.repeat(1000); // Will exceed budget
                const instructions = [
                    {
                        id: crypto.randomUUID(),
                        type: 'memory',
                        content: longContent,
                        priority: 'normal',
                        estimatedTokens: 500, // Exceeds budget
                    },
                ];
                const result = allocator.allocate(instructions);
                expect(result.excluded).toHaveLength(1);
                expect(result.included).toHaveLength(0);
            });
            it('should respect type limits', () => {
                const config = {
                    maxTotal: 1000,
                    perType: {
                        memory: 10, // Very low type limit
                        todo: 500,
                        session: 500,
                        context: 500,
                        system: 500,
                    },
                    criticalReserve: 100,
                };
                const allocator = new DefaultTokenBudgetAllocator(config);
                const instructions = [
                    {
                        id: crypto.randomUUID(),
                        type: 'memory',
                        content: 'Long memory content',
                        priority: 'normal',
                        estimatedTokens: 50, // Exceeds memory type limit
                    },
                ];
                const result = allocator.allocate(instructions);
                expect(result.excluded).toHaveLength(1);
            });
            it('should track usage by type', () => {
                const instructions = [
                    createInstruction('system', 'System', 'critical'),
                    createInstruction('memory', 'Memory', 'normal'),
                    createInstruction('todo', 'Todo', 'normal'),
                ];
                const result = allocator.allocate(instructions);
                expect(result.usageByType.system).toBeGreaterThan(0);
                expect(result.usageByType.memory).toBeGreaterThan(0);
                expect(result.usageByType.todo).toBeGreaterThan(0);
            });
            it('should sort by priority then by type', () => {
                const instructions = [
                    createInstruction('todo', 'Low todo', 'low'),
                    createInstruction('system', 'Critical system', 'critical'),
                    createInstruction('memory', 'High memory', 'high'),
                    createInstruction('session', 'Normal session', 'normal'),
                ];
                const result = allocator.allocate(instructions);
                // Critical should be first
                expect(result.included[0].priority).toBe('critical');
            });
            it('should record allocation timestamp', () => {
                const instructions = [
                    createInstruction('system', 'Test', 'normal'),
                ];
                const result = allocator.allocate(instructions);
                expect(result.allocationTimestamp).toBeDefined();
                expect(new Date(result.allocationTimestamp).getTime()).toBeLessThanOrEqual(Date.now());
            });
            it('should track critical reserve usage', () => {
                const config = {
                    maxTotal: 10,
                    perType: {
                        memory: 100,
                        todo: 100,
                        session: 100,
                        context: 100,
                        system: 100,
                    },
                    criticalReserve: 100,
                };
                const allocator = new DefaultTokenBudgetAllocator(config);
                const instructions = [
                    {
                        id: crypto.randomUUID(),
                        type: 'system',
                        content: 'Critical instruction',
                        priority: 'critical',
                        estimatedTokens: 50, // Exceeds regular budget, needs reserve
                    },
                ];
                const result = allocator.allocate(instructions);
                expect(result.criticalReserveUsed).toBeGreaterThan(0);
            });
        });
        describe('getStatus', () => {
            it('should return initial status with zero usage', () => {
                const status = allocator.getStatus();
                expect(status.currentUsage).toBe(0);
                expect(status.remaining).toBe(DEFAULT_TOKEN_BUDGET.maxTotal);
                expect(status.utilizationPercent).toBe(0);
                expect(status.canAcceptMore).toBe(true);
            });
            it('should update status after allocation', () => {
                const instructions = [
                    createInstruction('system', 'Test content', 'normal'),
                ];
                allocator.allocate(instructions);
                const status = allocator.getStatus();
                expect(status.currentUsage).toBeGreaterThan(0);
                expect(status.utilizationPercent).toBeGreaterThan(0);
            });
            it('should track critical reserve availability', () => {
                const status = allocator.getStatus();
                expect(status.criticalReserveAvailable).toBe(DEFAULT_TOKEN_BUDGET.criticalReserve);
            });
        });
        describe('setConfig', () => {
            it('should update configuration', () => {
                const newConfig = {
                    maxTotal: 10000,
                    perType: {
                        memory: 4000,
                        todo: 2000,
                        session: 2000,
                        context: 1000,
                        system: 1000,
                    },
                    criticalReserve: 500,
                };
                allocator.setConfig(newConfig);
                expect(allocator.getConfig()).toEqual(newConfig);
            });
            it('should reset allocation after config change', () => {
                // First allocate something
                allocator.allocate([createInstruction('system', 'Test', 'normal')]);
                expect(allocator.getStatus().currentUsage).toBeGreaterThan(0);
                // Change config
                allocator.setConfig({
                    ...DEFAULT_TOKEN_BUDGET,
                    maxTotal: 5000,
                });
                // Allocation should be reset
                expect(allocator.getStatus().currentUsage).toBe(0);
            });
        });
        describe('getConfig', () => {
            it('should return a copy of the config', () => {
                const config = allocator.getConfig();
                config.maxTotal = 999999; // Modify the returned object
                // Original should be unchanged
                expect(allocator.getConfig().maxTotal).toBe(DEFAULT_TOKEN_BUDGET.maxTotal);
            });
        });
    });
    describe('createTokenBudgetAllocator', () => {
        it('should create allocator with default config', () => {
            const allocator = createTokenBudgetAllocator();
            expect(allocator.getConfig()).toEqual(DEFAULT_TOKEN_BUDGET);
        });
        it('should create allocator with custom config', () => {
            const customConfig = {
                maxTotal: 6000,
                perType: {
                    memory: 2000,
                    todo: 1000,
                    session: 1000,
                    context: 1000,
                    system: 1000,
                },
                criticalReserve: 300,
            };
            const allocator = createTokenBudgetAllocator(customConfig);
            expect(allocator.getConfig()).toEqual(customConfig);
        });
    });
    describe('createInstruction', () => {
        it('should create instruction with required fields', () => {
            const instruction = createInstruction('memory', 'Test content', 'normal');
            expect(instruction.id).toBeDefined();
            expect(instruction.type).toBe('memory');
            expect(instruction.content).toBe('Test content');
            expect(instruction.priority).toBe('normal');
            expect(instruction.createdAt).toBeDefined();
        });
        it('should use default priority of normal', () => {
            const instruction = createInstruction('system', 'System prompt');
            expect(instruction.priority).toBe('normal');
        });
        it('should include metadata when provided', () => {
            const instruction = createInstruction('todo', 'Task list', 'high', { source: 'user' });
            expect(instruction.metadata).toEqual({ source: 'user' });
        });
        it('should generate unique IDs', () => {
            const inst1 = createInstruction('memory', 'Content 1');
            const inst2 = createInstruction('memory', 'Content 2');
            expect(inst1.id).not.toBe(inst2.id);
        });
    });
    describe('TokenBudgetError', () => {
        it('should have correct properties', () => {
            const error = new TokenBudgetError('BUDGET_EXCEEDED', 'Token budget exceeded', { current: 5000, max: 4000 });
            expect(error.code).toBe('BUDGET_EXCEEDED');
            expect(error.message).toBe('Token budget exceeded');
            expect(error.details).toEqual({ current: 5000, max: 4000 });
            expect(error.name).toBe('TokenBudgetError');
        });
        it('should work without details', () => {
            const error = new TokenBudgetError('ERROR', 'Some error');
            expect(error.code).toBe('ERROR');
            expect(error.details).toBeUndefined();
        });
    });
    describe('Integration scenarios', () => {
        it('should handle typical agent context allocation', () => {
            const allocator = createTokenBudgetAllocator();
            const instructions = [
                createInstruction('system', 'You are an AI assistant...', 'critical'),
                createInstruction('memory', 'Previous conversation: User asked about TypeScript...', 'high'),
                createInstruction('session', 'Current session started at 10:00 AM', 'normal'),
                createInstruction('todo', '1. Review code\n2. Write tests\n3. Update docs', 'normal'),
                createInstruction('context', 'Working in /project directory', 'low'),
            ];
            const result = allocator.allocate(instructions);
            // All should fit in default budget
            expect(result.included).toHaveLength(5);
            expect(result.excluded).toHaveLength(0);
            const status = allocator.getStatus();
            expect(status.canAcceptMore).toBe(true);
        });
        it('should handle budget overflow gracefully', () => {
            const allocator = createTokenBudgetAllocator({
                maxTotal: 100,
                perType: {
                    memory: 50,
                    todo: 30,
                    session: 30,
                    context: 30,
                    system: 50,
                },
                criticalReserve: 20,
            });
            // Create many instructions that will overflow
            const instructions = [];
            for (let i = 0; i < 10; i++) {
                instructions.push(createInstruction('memory', `Memory item ${i}: Some content that takes up tokens`, 'normal'));
            }
            const result = allocator.allocate(instructions);
            // Some should be excluded
            expect(result.excluded.length).toBeGreaterThan(0);
            expect(result.totalTokens).toBeLessThanOrEqual(100 + 20 // maxTotal + criticalReserve
            );
        });
        it('should preserve critical instructions under pressure', () => {
            const allocator = createTokenBudgetAllocator({
                maxTotal: 50,
                perType: {
                    memory: 100,
                    todo: 100,
                    session: 100,
                    context: 100,
                    system: 100,
                },
                criticalReserve: 50,
            });
            const instructions = [
                {
                    id: crypto.randomUUID(),
                    type: 'system',
                    content: 'Critical system',
                    priority: 'critical',
                    estimatedTokens: 30,
                },
                {
                    id: crypto.randomUUID(),
                    type: 'memory',
                    content: 'Normal memory',
                    priority: 'normal',
                    estimatedTokens: 40,
                },
                {
                    id: crypto.randomUUID(),
                    type: 'todo',
                    content: 'Low todo',
                    priority: 'low',
                    estimatedTokens: 40,
                },
            ];
            const result = allocator.allocate(instructions);
            // Critical should always be included
            const criticalIncluded = result.included.some((i) => i.priority === 'critical');
            expect(criticalIncluded).toBe(true);
        });
    });
});
//# sourceMappingURL=token-budget.test.js.map