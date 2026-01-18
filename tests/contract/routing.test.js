import { describe, it, expect } from 'vitest';
import { RoutingInputSchema, RoutingDecisionSchema, RoutingConstraintsSchema, ModelRequirementsSchema, validateRoutingInput, validateRoutingRecord, } from '@defai.digital/contracts';
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
                riskLevel: 'high',
                requirements: {
                    minContextLength: 8000,
                    maxLatencyMs: 5000,
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
                reasoning: 'Selected based on task complexity and capability requirements',
                fallbackModels: ['claude-3-sonnet', 'gpt-4'],
                constraints: {
                    capabilitiesMet: true,
                    riskCompliant: true,
                },
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
                    isExperimental: false,
                    reasoning: 'Optimal for analysis tasks',
                    fallbackModels: [],
                    constraints: {
                        capabilitiesMet: true,
                        riskCompliant: true,
                    },
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
    describe('INV-RT-002: Risk Gating', () => {
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
    describe('INV-RT-003: Reasoning Requirement', () => {
        it('should require non-empty reasoning', () => {
            const decisionWithoutReasoning = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                fallbackModels: [],
                constraints: { capabilitiesMet: true, riskCompliant: true },
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
                fallbackModels: [],
                constraints: { capabilitiesMet: true, riskCompliant: true },
            };
            const result = RoutingDecisionSchema.safeParse(decisionWithEmptyReasoning);
            expect(result.success).toBe(false);
        });
        it('should accept valid reasoning', () => {
            const decision = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: 'Selected for optimal capability-performance balance',
                fallbackModels: [],
                constraints: { capabilitiesMet: true, riskCompliant: true },
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(true);
        });
    });
    describe('INV-RT-004: Fallback Consistency', () => {
        it('should require fallbackModels array', () => {
            const decisionWithoutFallbacks = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: 'Test reasoning',
                constraints: { capabilitiesMet: true, riskCompliant: true },
                // fallbackModels is missing
            };
            const result = RoutingDecisionSchema.safeParse(decisionWithoutFallbacks);
            expect(result.success).toBe(false);
        });
        it('should accept empty fallbackModels array', () => {
            const decision = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: 'Test reasoning',
                fallbackModels: [],
                constraints: { capabilitiesMet: true, riskCompliant: true },
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(true);
        });
    });
    describe('INV-RT-005: Capability Match (Constraints)', () => {
        it('should require constraints object', () => {
            const decisionWithoutConstraints = {
                selectedModel: 'claude-3',
                provider: 'anthropic',
                reasoning: 'Test reasoning',
                fallbackModels: [],
                // constraints is missing
            };
            const result = RoutingDecisionSchema.safeParse(decisionWithoutConstraints);
            expect(result.success).toBe(false);
        });
        it('should validate constraints schema', () => {
            const validConstraints = { capabilitiesMet: true, riskCompliant: true };
            const result = RoutingConstraintsSchema.safeParse(validConstraints);
            expect(result.success).toBe(true);
        });
        it('should reject invalid constraints', () => {
            const invalidConstraints = { capabilitiesMet: 'yes', riskCompliant: 1 };
            const result = RoutingConstraintsSchema.safeParse(invalidConstraints);
            expect(result.success).toBe(false);
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
        it('should validate maxLatencyMs', () => {
            const requirements = {
                maxLatencyMs: 5000,
            };
            const result = ModelRequirementsSchema.safeParse(requirements);
            expect(result.success).toBe(true);
        });
        it('should reject invalid maxLatencyMs', () => {
            const invalidValues = [0, -1, -100];
            for (const maxLatencyMs of invalidValues) {
                const result = ModelRequirementsSchema.safeParse({ maxLatencyMs });
                expect(result.success).toBe(false);
            }
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
                    fallbackModels: [],
                    constraints: { capabilitiesMet: true, riskCompliant: true },
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
                fallbackModels: [],
                constraints: { capabilitiesMet: true, riskCompliant: true },
            };
            const result = RoutingDecisionSchema.safeParse(decision);
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=routing.test.js.map