/**
 * Discussion Contract Invariant Tests
 *
 * Tests for discussion invariants documented in packages/contracts/src/discussion/v1/invariants.md
 *
 * Invariants tested:
 * - INV-DISC-001: Pattern Determines Execution Flow
 * - INV-DISC-002: All Patterns Produce Final Synthesis
 * - INV-DISC-003: Moderator Method Requires Synthesizer
 * - INV-DISC-004: Confidence Threshold Range
 * - INV-DISC-005: Minimum Providers
 * - INV-DISC-006: Maximum Providers
 * - INV-DISC-007: Rounds Bounds
 * - INV-DISC-008: Debate Pattern Requires Roles
 * - INV-DISC-009: Result Always Contains Synthesis
 * - INV-DISC-010: Participating Providers >= minProviders (when successful)
 */
import { describe, it, expect } from 'vitest';
import { 
// Schemas
DiscussionPatternSchema, ConsensusMethodSchema, ConsensusConfigSchema, DebateRoleSchema, ProviderCapabilitySchema, DiscussStepConfigSchema, DiscussionProviderResponseSchema, VotingResultsSchema, DiscussionResultSchema, DiscussionRequestSchema, 
// Constants
MAX_PROVIDERS, MIN_PROVIDERS, MAX_ROUNDS, DEFAULT_ROUNDS, DEFAULT_PROVIDERS, PATTERN_DESCRIPTIONS, PROVIDER_STRENGTHS, DiscussionErrorCodes, 
// Validation
validateDiscussStepConfig, safeValidateDiscussStepConfig, 
// Factory Functions
createDefaultDiscussStepConfig, createDebateConfig, createVotingConfig, createEmptyDiscussionResult, createFailedDiscussionResult, } from '@defai.digital/contracts';
describe('Discussion Contract', () => {
    describe('Constants', () => {
        it('should have correct provider limits', () => {
            expect(MIN_PROVIDERS).toBe(2);
            expect(MAX_PROVIDERS).toBe(6);
        });
        it('should have correct round limits', () => {
            expect(MAX_ROUNDS).toBe(10);
            expect(DEFAULT_ROUNDS).toBe(2);
        });
        it('should have default providers ordered by reasoning strength', () => {
            expect(DEFAULT_PROVIDERS).toEqual(['claude', 'grok', 'gemini']);
        });
        it('should have pattern descriptions for all patterns', () => {
            const patterns = ['round-robin', 'debate', 'critique', 'voting', 'synthesis'];
            for (const pattern of patterns) {
                expect(PATTERN_DESCRIPTIONS[pattern]).toBeDefined();
                expect(typeof PATTERN_DESCRIPTIONS[pattern]).toBe('string');
            }
        });
        it('should define provider strengths for default providers', () => {
            for (const provider of DEFAULT_PROVIDERS) {
                expect(PROVIDER_STRENGTHS[provider]).toBeDefined();
                expect(Array.isArray(PROVIDER_STRENGTHS[provider])).toBe(true);
            }
        });
        it('should have Grok as reasoning and research provider', () => {
            const grokStrengths = PROVIDER_STRENGTHS.grok;
            expect(grokStrengths).toContain('reasoning');
            expect(grokStrengths).toContain('realtime');
            expect(grokStrengths).toContain('research');
        });
    });
    describe('DiscussionPatternSchema', () => {
        it('should accept all valid patterns', () => {
            const patterns = ['round-robin', 'debate', 'critique', 'voting', 'synthesis'];
            for (const pattern of patterns) {
                const result = DiscussionPatternSchema.safeParse(pattern);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid patterns', () => {
            const result = DiscussionPatternSchema.safeParse('invalid-pattern');
            expect(result.success).toBe(false);
        });
    });
    describe('ConsensusMethodSchema', () => {
        it('should accept all valid consensus methods', () => {
            const methods = ['synthesis', 'voting', 'moderator', 'unanimous', 'majority'];
            for (const method of methods) {
                const result = ConsensusMethodSchema.safeParse(method);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('ConsensusConfigSchema - INV-DISC-003 & INV-DISC-004', () => {
        it('should require synthesizer for moderator method (INV-DISC-003)', () => {
            const config = {
                method: 'moderator',
                // Missing synthesizer
            };
            const result = ConsensusConfigSchema.safeParse(config);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toContain('INV-DISC-003');
            }
        });
        it('should accept moderator method with synthesizer', () => {
            const config = {
                method: 'moderator',
                synthesizer: 'claude',
            };
            const result = ConsensusConfigSchema.safeParse(config);
            expect(result.success).toBe(true);
        });
        it('should enforce threshold range 0-1 (INV-DISC-004)', () => {
            const invalidThreshold = {
                method: 'voting',
                threshold: 1.5, // Invalid: > 1
            };
            const result = ConsensusConfigSchema.safeParse(invalidThreshold);
            expect(result.success).toBe(false);
        });
        it('should accept valid threshold', () => {
            const validThreshold = {
                method: 'voting',
                threshold: 0.7,
            };
            const result = ConsensusConfigSchema.safeParse(validThreshold);
            expect(result.success).toBe(true);
        });
        it('should default includeDissent to true', () => {
            const config = { method: 'synthesis' };
            const result = ConsensusConfigSchema.parse(config);
            expect(result.includeDissent).toBe(true);
        });
    });
    describe('DiscussStepConfigSchema - INV-DISC-005 through INV-DISC-008', () => {
        const validConfig = {
            prompt: 'Discuss the best architecture for a chat app',
            providers: ['claude', 'grok', 'gemini'],
        };
        it('should require minimum 2 providers (INV-DISC-005)', () => {
            const config = {
                ...validConfig,
                providers: ['claude'], // Only 1 provider
            };
            const result = DiscussStepConfigSchema.safeParse(config);
            expect(result.success).toBe(false);
        });
        it('should enforce maximum 6 providers (INV-DISC-006)', () => {
            const config = {
                ...validConfig,
                providers: ['claude', 'grok', 'gemini', 'codex', 'a', 'b', 'extra'], // 7 providers
            };
            const result = DiscussStepConfigSchema.safeParse(config);
            expect(result.success).toBe(false);
        });
        it('should enforce rounds between 1-10 (INV-DISC-007)', () => {
            const invalidRounds = {
                ...validConfig,
                rounds: 15, // > MAX_ROUNDS
            };
            const result = DiscussStepConfigSchema.safeParse(invalidRounds);
            expect(result.success).toBe(false);
        });
        it('should require roles for debate pattern (INV-DISC-008)', () => {
            const debateWithoutRoles = {
                ...validConfig,
                pattern: 'debate',
                providers: ['claude', 'grok', 'gemini'],
                // Missing roles
            };
            const result = DiscussStepConfigSchema.safeParse(debateWithoutRoles);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toContain('INV-DISC-008');
            }
        });
        it('should accept debate pattern with roles', () => {
            const debateWithRoles = {
                ...validConfig,
                pattern: 'debate',
                providers: ['claude', 'grok', 'gemini'],
                roles: {
                    claude: 'proponent',
                    grok: 'opponent',
                    gemini: 'judge',
                },
            };
            const result = DiscussStepConfigSchema.safeParse(debateWithRoles);
            expect(result.success).toBe(true);
        });
        it('should validate minProviders <= providers.length', () => {
            const config = {
                ...validConfig,
                providers: ['claude', 'grok'],
                minProviders: 5, // More than providers array length
            };
            const result = DiscussStepConfigSchema.safeParse(config);
            expect(result.success).toBe(false);
        });
        it('should default to synthesis pattern', () => {
            const result = DiscussStepConfigSchema.parse(validConfig);
            expect(result.pattern).toBe('synthesis');
        });
        it('should default to 2 rounds', () => {
            const result = DiscussStepConfigSchema.parse(validConfig);
            expect(result.rounds).toBe(2);
        });
        it('should default continueOnProviderFailure to true', () => {
            const result = DiscussStepConfigSchema.parse(validConfig);
            expect(result.continueOnProviderFailure).toBe(true);
        });
    });
    describe('DiscussionProviderResponseSchema', () => {
        it('should validate a complete provider response', () => {
            const response = {
                provider: 'claude',
                content: 'This is my perspective on the topic...',
                round: 1,
                timestamp: new Date().toISOString(),
                durationMs: 1500,
            };
            const result = DiscussionProviderResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
        it('should validate response with voting data', () => {
            const response = {
                provider: 'grok',
                content: 'I vote for option A because...',
                round: 1,
                confidence: 0.85,
                vote: 'Option A',
                timestamp: new Date().toISOString(),
                durationMs: 2000,
            };
            const result = DiscussionProviderResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
        it('should enforce confidence range 0-1', () => {
            const response = {
                provider: 'grok',
                content: 'Response content',
                round: 1,
                confidence: 1.5, // Invalid
                timestamp: new Date().toISOString(),
                durationMs: 1000,
            };
            const result = DiscussionProviderResponseSchema.safeParse(response);
            expect(result.success).toBe(false);
        });
    });
    describe('DiscussionResultSchema - INV-DISC-009 & INV-DISC-010', () => {
        const validResult = {
            success: true,
            pattern: 'synthesis',
            topic: 'Architecture discussion',
            participatingProviders: ['claude', 'grok', 'gemini'],
            failedProviders: [],
            rounds: [],
            synthesis: 'Final synthesized conclusion...',
            consensus: { method: 'synthesis' },
            totalDurationMs: 5000,
            metadata: {
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
            },
        };
        it('should require synthesis field (INV-DISC-009)', () => {
            const result = { ...validResult };
            // @ts-ignore - Testing runtime validation
            delete result.synthesis;
            const parsed = DiscussionResultSchema.safeParse(result);
            expect(parsed.success).toBe(false);
        });
        it('should validate successful result', () => {
            const result = DiscussionResultSchema.safeParse(validResult);
            expect(result.success).toBe(true);
        });
        it('should validate failed result with error', () => {
            const failedResult = {
                ...validResult,
                success: false,
                synthesis: '',
                error: {
                    code: DiscussionErrorCodes.ALL_PROVIDERS_FAILED,
                    message: 'All providers failed to respond',
                },
            };
            const result = DiscussionResultSchema.safeParse(failedResult);
            expect(result.success).toBe(true);
        });
    });
    describe('DiscussionRequestSchema', () => {
        it('should validate minimal request', () => {
            const request = {
                topic: 'What is the best approach for real-time chat?',
            };
            const result = DiscussionRequestSchema.safeParse(request);
            expect(result.success).toBe(true);
        });
        it('should validate full request', () => {
            const request = {
                topic: 'Evaluate microservices vs monolith architecture',
                pattern: 'debate',
                providers: ['claude', 'grok', 'gemini'],
                rounds: 3,
                consensusMethod: 'moderator',
                context: 'This is for a startup with 5 developers',
                verbose: true,
            };
            const result = DiscussionRequestSchema.safeParse(request);
            expect(result.success).toBe(true);
        });
        it('should enforce topic length limits', () => {
            const request = {
                topic: '', // Empty not allowed
            };
            const result = DiscussionRequestSchema.safeParse(request);
            expect(result.success).toBe(false);
        });
    });
    describe('VotingResultsSchema', () => {
        it('should validate voting results', () => {
            const results = {
                winner: 'Option A',
                votes: { 'Option A': 3, 'Option B': 1 },
                weightedVotes: { 'Option A': 2.5, 'Option B': 0.8 },
                voteRecords: [
                    { provider: 'claude', choice: 'Option A', confidence: 0.9 },
                    { provider: 'gemini', choice: 'Option A', confidence: 0.8 },
                    { provider: 'grok', choice: 'Option A', confidence: 0.8 },
                    { provider: 'gemini', choice: 'Option B', confidence: 0.8 },
                ],
                unanimous: false,
                margin: 0.5,
            };
            const result = VotingResultsSchema.safeParse(results);
            expect(result.success).toBe(true);
        });
    });
    describe('Factory Functions', () => {
        it('createDefaultDiscussStepConfig should create valid config', () => {
            const config = createDefaultDiscussStepConfig('Discuss best practices');
            expect(config.pattern).toBe('synthesis');
            expect(config.providers).toEqual([...DEFAULT_PROVIDERS]);
            expect(config.rounds).toBe(DEFAULT_ROUNDS);
            expect(config.consensus.method).toBe('synthesis');
            expect(config.consensus.synthesizer).toBe('claude');
        });
        it('createDebateConfig should create valid debate config', () => {
            const config = createDebateConfig('Should we use microservices?');
            expect(config.pattern).toBe('debate');
            expect(config.providers).toHaveLength(3);
            expect(config.roles).toBeDefined();
            expect(config.roles.claude).toBe('proponent');
            expect(config.roles.grok).toBe('opponent');
            expect(config.roles.gemini).toBe('judge');
        });
        it('createVotingConfig should create valid voting config', () => {
            const options = ['Option A', 'Option B', 'Option C'];
            const config = createVotingConfig('Which option is best?', options);
            expect(config.pattern).toBe('voting');
            expect(config.consensus.method).toBe('voting');
            expect(config.prompt).toContain('Option A');
            expect(config.prompt).toContain('Option B');
            expect(config.prompt).toContain('Option C');
        });
        it('createEmptyDiscussionResult should create valid result', () => {
            const result = createEmptyDiscussionResult('synthesis', 'Test topic');
            expect(result.success).toBe(true);
            expect(result.pattern).toBe('synthesis');
            expect(result.topic).toBe('Test topic');
            expect(result.synthesis).toBe('');
            expect(result.participatingProviders).toEqual([]);
        });
        it('createFailedDiscussionResult should create valid failed result', () => {
            const startedAt = new Date().toISOString();
            const result = createFailedDiscussionResult('debate', 'Failed topic', DiscussionErrorCodes.ALL_PROVIDERS_FAILED, 'All providers failed', startedAt);
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(DiscussionErrorCodes.ALL_PROVIDERS_FAILED);
            expect(result.error?.message).toBe('All providers failed');
        });
    });
    describe('Validation Functions', () => {
        it('validateDiscussStepConfig should throw on invalid config', () => {
            const invalidConfig = {
                prompt: 'Test',
                providers: ['only-one'], // Invalid: need at least 2
            };
            expect(() => validateDiscussStepConfig(invalidConfig)).toThrow();
        });
        it('safeValidateDiscussStepConfig should return error on invalid', () => {
            const invalidConfig = {
                prompt: 'Test',
                providers: ['only-one'],
            };
            const result = safeValidateDiscussStepConfig(invalidConfig);
            expect(result.success).toBe(false);
        });
        it('safeValidateDiscussStepConfig should return data on valid', () => {
            const validConfig = {
                prompt: 'Test discussion',
                providers: ['claude', 'grok'],
            };
            const result = safeValidateDiscussStepConfig(validConfig);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.prompt).toBe('Test discussion');
            }
        });
    });
    describe('Error Codes', () => {
        it('should have all expected error codes', () => {
            expect(DiscussionErrorCodes.INSUFFICIENT_PROVIDERS).toBeDefined();
            expect(DiscussionErrorCodes.PROVIDER_TIMEOUT).toBeDefined();
            expect(DiscussionErrorCodes.ALL_PROVIDERS_FAILED).toBeDefined();
            expect(DiscussionErrorCodes.CONSENSUS_FAILED).toBeDefined();
            expect(DiscussionErrorCodes.INVALID_PATTERN).toBeDefined();
            expect(DiscussionErrorCodes.INVALID_ROLES).toBeDefined();
            expect(DiscussionErrorCodes.SYNTHESIS_FAILED).toBeDefined();
            expect(DiscussionErrorCodes.INVALID_CONFIG).toBeDefined();
            expect(DiscussionErrorCodes.PROVIDER_NOT_FOUND).toBeDefined();
        });
    });
    describe('ProviderCapabilitySchema', () => {
        it('should accept all valid capabilities', () => {
            const capabilities = [
                'reasoning', 'coding', 'agentic', 'research', 'writing',
                'math', 'ocr', 'translation', 'multilingual', 'realtime',
                'tool-use', 'long-context',
            ];
            for (const cap of capabilities) {
                const result = ProviderCapabilitySchema.safeParse(cap);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('DebateRoleSchema', () => {
        it('should accept all valid debate roles', () => {
            const roles = ['proponent', 'opponent', 'judge', 'moderator', 'neutral'];
            for (const role of roles) {
                const result = DebateRoleSchema.safeParse(role);
                expect(result.success).toBe(true);
            }
        });
    });
});
//# sourceMappingURL=discussion.test.js.map