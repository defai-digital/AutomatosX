import { describe, it, expect } from 'vitest';
import { RoutingInputSchema, RoutingDecisionSchema, BudgetSchema, ModelRequirementsSchema, validateRoutingInput, validateRoutingRecord, } from '@automatosx/contracts';
describe('Routing Decision Contract V1', () => {
    describe('Schema Validation', () => {
        it('should validate a minimal routing input', () => {
            const input = {
                taskType: 'chat',
                riskLevel: 'medium',
            };
            const result = RoutingInputSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
        it('should validate a complete routing input', () => {
            const input = {
                taskType: 'code',
                budget: {
                    maxCostUsd: 0.1,
                    maxTokens: 4000,
                    maxLatencyMs: 5000,
                },
                riskLevel: 'high',
                requirements: {
                    minContextLength: 8000,
                    capabilities: ['function_calling', 'json_mode'],
                    preferredProviders: ['anthropic', 'openai'],
                    excludedModels: ['experimental-model'],
                },
                context: {
                    sessionId: 'abc123',
                },
            };
            const result = validateRoutingInput(input);
            expect(result.taskType).toBe('code');
            expect(result.riskLevel).toBe('high');
        });
        it('should validate a routing decision', () => {
            const decision = {
                selectedModel: 'claude-3-opus',
                provider: 'anthropic',
                isExperimental: false,
                estimatedCostUsd: 0.05,
                reasoning: 'Selected based on task complexity and budget constraints',
                fallbackModels: ['claude-3-sonnet', 'gpt-4'],
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(true);
        });
        it('should validate a complete routing record', () => {
            const record = {
                requestId: '550e8400-e29b-41d4-a716-446655440000',
                input: {
                    taskType: 'analysis',
                    riskLevel: 'low',
                },
                decision: {
                    selectedModel: 'gpt-4',
                    provider: 'openai',
                    reasoning: 'Cost-effective for analysis tasks',
                },
                timestamp: '2024-12-14T12:00:00Z',
                metadata: { source: 'api' },
            };
            const result = validateRoutingRecord(record);
            expect(result.requestId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });
    });
    describe('INV-RT-001: Determinism', () => {
        it('should accept all valid task types', () => {
            const validTypes = ['chat', 'completion', 'code', 'analysis', 'creative'];
            for (const taskType of validTypes) {
                const input = { taskType, riskLevel: 'medium' };
                const result = RoutingInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid task types', () => {
            const input = { taskType: 'invalid', riskLevel: 'medium' };
            const result = RoutingInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-RT-002: Budget Respect', () => {
        it('should validate budget constraints', () => {
            const validBudgets = [
                { maxCostUsd: 0 },
                { maxCostUsd: 1.5 },
                { maxTokens: 1 },
                { maxTokens: 100000 },
                { maxLatencyMs: 1 },
                { maxLatencyMs: 60000 },
            ];
            for (const budget of validBudgets) {
                const result = BudgetSchema.safeParse(budget);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid budget values', () => {
            const invalidBudgets = [
                { maxCostUsd: -1 }, // negative cost
                { maxTokens: 0 }, // zero tokens
                { maxTokens: -100 }, // negative tokens
                { maxLatencyMs: 0 }, // zero latency
            ];
            for (const budget of invalidBudgets) {
                const result = BudgetSchema.safeParse(budget);
                expect(result.success).toBe(false);
            }
        });
    });
    describe('INV-RT-003: Risk Gating', () => {
        it('should accept all valid risk levels', () => {
            const validLevels = ['low', 'medium', 'high'];
            for (const riskLevel of validLevels) {
                const input = { taskType: 'chat', riskLevel };
                const result = RoutingInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid risk levels', () => {
            const input = { taskType: 'chat', riskLevel: 'critical' };
            const result = RoutingInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });
        it('should default risk level to medium', () => {
            const input = { taskType: 'chat' };
            const result = RoutingInputSchema.parse(input);
            expect(result.riskLevel).toBe('medium');
        });
    });
    describe('INV-RT-004: Reasoning Requirement', () => {
        it('should require non-empty reasoning', () => {
            const decisionWithoutReasoning = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                // reasoning is missing
            };
            const result = RoutingDecisionSchema.safeParse(decisionWithoutReasoning);
            expect(result.success).toBe(false);
        });
        it('should reject empty reasoning', () => {
            const decisionWithEmptyReasoning = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: '',
            };
            const result = RoutingDecisionSchema.safeParse(decisionWithEmptyReasoning);
            expect(result.success).toBe(false);
        });
        it('should accept valid reasoning', () => {
            const decision = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: 'Selected for optimal cost-performance balance',
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(true);
        });
    });
    describe('Model Requirements Validation', () => {
        it('should validate model capabilities', () => {
            const validCapabilities = [
                'vision',
                'function_calling',
                'json_mode',
                'streaming',
            ];
            const requirements = {
                capabilities: validCapabilities,
            };
            const result = ModelRequirementsSchema.safeParse(requirements);
            expect(result.success).toBe(true);
        });
        it('should reject invalid capabilities', () => {
            const requirements = {
                capabilities: ['vision', 'invalid_capability'],
            };
            const result = ModelRequirementsSchema.safeParse(requirements);
            expect(result.success).toBe(false);
        });
    });
    describe('Provider Validation', () => {
        it('should accept all valid providers', () => {
            const validProviders = ['anthropic', 'openai', 'google', 'local'];
            for (const provider of validProviders) {
                const decision = {
                    selectedModel: 'test-model',
                    provider,
                    reasoning: 'Test reasoning',
                };
                const result = RoutingDecisionSchema.safeParse(decision);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid providers', () => {
            const decision = {
                selectedModel: 'test-model',
                provider: 'unknown-provider',
                reasoning: 'Test reasoning',
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=routing.test.js.map