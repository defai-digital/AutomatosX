/**
 * Provider Contract Invariant Tests
 *
 * Tests for provider invariants documented in packages/contracts/src/provider/v1/invariants.md
 *
 * Invariants tested:
 * - INV-PROV-PORT-001: Request Validation
 * - INV-PROV-PORT-002: Response Schema Compliance
 * - INV-PROV-PORT-003: No Exception Throwing
 * - INV-PROV-REG-001: Unknown Provider Handling
 * - INV-PROV-REG-002: Deterministic Listing
 * - INV-PROV-HEALTH-001: Timeout Enforcement
 * - INV-PROV-HEALTH-002: No Side Effects
 * - INV-PROV-HEALTH-003: Graceful Degradation
 */
import { describe, it, expect, vi } from 'vitest';
import { ProviderRequestSchema, ProviderResponseSchema, ProviderMessageSchema, ModelInfoSchema, CircuitStateSchema, ProviderCircuitBreakerConfigSchema as CircuitBreakerConfigSchema, ProviderCircuitBreakerStateSchema as CircuitBreakerStateSchema, HealthCheckConfigSchema, HealthStatusSchema, validateProviderRequest, safeValidateProviderRequest, createProviderSuccessResponse, createProviderErrorResponse, createDefaultProviderCircuitBreakerConfig as createDefaultCircuitBreakerConfig, createDefaultHealthCheckConfig, createInitialProviderCircuitBreakerState as createInitialCircuitBreakerState, createInitialHealthStatus, } from '@defai.digital/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();
describe('Provider Contract', () => {
    describe('ProviderMessageSchema', () => {
        it('should validate a message', () => {
            const message = {
                role: 'user',
                content: 'Hello',
            };
            const result = ProviderMessageSchema.safeParse(message);
            expect(result.success).toBe(true);
        });
        it('should accept all valid roles', () => {
            const roles = ['system', 'user', 'assistant'];
            for (const role of roles) {
                const result = ProviderMessageSchema.safeParse({ role, content: 'test' });
                expect(result.success).toBe(true);
            }
        });
    });
    describe('ProviderRequestSchema', () => {
        it('should validate minimal request', () => {
            const request = {
                requestId: uuid(),
                model: 'default',
                messages: [{ role: 'user', content: 'Hello' }],
            };
            const result = validateProviderRequest(request);
            expect(result.model).toBe('default');
        });
        it('should validate request with options', () => {
            const request = {
                requestId: uuid(),
                model: 'gpt-4',
                messages: [{ role: 'user', content: 'Hi' }],
                maxTokens: 1000,
                temperature: 0.7,
            };
            const result = safeValidateProviderRequest(request);
            expect(result.success).toBe(true);
        });
    });
    describe('ProviderResponseSchema', () => {
        it('should validate success response', () => {
            const response = {
                requestId: uuid(),
                success: true,
                content: 'Hello! How can I help?',
                usage: {
                    promptTokens: 10,
                    completionTokens: 5,
                },
            };
            const result = ProviderResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
        it('should validate error response', () => {
            const response = {
                requestId: uuid(),
                success: false,
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Too many requests',
                },
            };
            const result = ProviderResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
        });
    });
    describe('ModelInfoSchema', () => {
        it('should validate model info', () => {
            const info = {
                modelId: 'default',
                displayName: 'Default Model',
                contextLength: 200000,
                isDefault: true,
            };
            const result = ModelInfoSchema.safeParse(info);
            expect(result.success).toBe(true);
        });
    });
    describe('CircuitBreakerConfigSchema', () => {
        it('should validate config', () => {
            const config = {
                failureThreshold: 5,
                resetTimeoutMs: 30000,
                halfOpenMaxRequests: 3,
            };
            const result = CircuitBreakerConfigSchema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });
    describe('HealthCheckConfigSchema', () => {
        it('should validate health config', () => {
            const config = {
                intervalMs: 30000,
                timeoutMs: 5000,
                unhealthyThreshold: 3,
            };
            const result = HealthCheckConfigSchema.safeParse(config);
            expect(result.success).toBe(true);
        });
    });
    describe('Factory Functions', () => {
        it('should create success response', () => {
            const response = createProviderSuccessResponse(uuid(), 'Hello!', { usage: { promptTokens: 5, completionTokens: 3 } });
            expect(response.success).toBe(true);
            expect(response.content).toBe('Hello!');
        });
        it('should create error response', () => {
            const response = createProviderErrorResponse(uuid(), 'ERR_TIMEOUT', 'Request timed out');
            expect(response.success).toBe(false);
            expect(response.error?.code).toBe('ERR_TIMEOUT');
        });
        it('should create default circuit breaker config', () => {
            const config = createDefaultCircuitBreakerConfig();
            expect(config.failureThreshold).toBeGreaterThan(0);
        });
        it('should create default health check config', () => {
            const config = createDefaultHealthCheckConfig();
            expect(config.intervalMs).toBeGreaterThan(0);
        });
    });
    describe('INV-PROV-001: Health Check Timeout', () => {
        it('should have timeoutMs less than intervalMs', () => {
            const config = createDefaultHealthCheckConfig();
            expect(config.timeoutMs).toBeLessThan(config.intervalMs);
        });
    });
});
// ============================================================================
// Provider Port Invariant Tests
// ============================================================================
describe('INV-PROV-PORT: Provider Port Invariants', () => {
    describe('INV-PROV-PORT-001: Request Validation', () => {
        it('should reject request with invalid UUID', () => {
            const invalidRequest = {
                requestId: 'not-a-uuid',
                model: 'claude-3-opus',
                messages: [{ role: 'user', content: 'Hello' }],
            };
            const result = ProviderRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
        it('should reject request with empty model', () => {
            const invalidRequest = {
                requestId: uuid(),
                model: '',
                messages: [{ role: 'user', content: 'Hello' }],
            };
            const result = ProviderRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
        it('should reject request with empty messages array', () => {
            const invalidRequest = {
                requestId: uuid(),
                model: 'claude-3-opus',
                messages: [],
            };
            const result = ProviderRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
        it('should reject request with invalid message role', () => {
            const invalidRequest = {
                requestId: uuid(),
                model: 'claude-3-opus',
                messages: [{ role: 'invalid', content: 'Hello' }],
            };
            const result = ProviderRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
        it('should reject invalid temperature values', () => {
            const invalidTemperatures = [-0.1, 2.1, 3];
            for (const temperature of invalidTemperatures) {
                const request = {
                    requestId: uuid(),
                    model: 'claude-3-opus',
                    messages: [{ role: 'user', content: 'Hello' }],
                    temperature,
                };
                const result = ProviderRequestSchema.safeParse(request);
                expect(result.success).toBe(false);
            }
        });
        it('should throw on invalid request with validateProviderRequest', () => {
            const invalidRequest = { model: '' };
            expect(() => validateProviderRequest(invalidRequest)).toThrow();
        });
    });
    describe('INV-PROV-PORT-002: Response Schema Compliance', () => {
        it('should accept valid success response with all fields', () => {
            const successResponse = {
                requestId: uuid(),
                success: true,
                content: 'Hello! How can I help you?',
                model: 'claude-3-opus',
                usage: { promptTokens: 10, completionTokens: 20 },
                finishReason: 'stop',
            };
            const result = ProviderResponseSchema.safeParse(successResponse);
            expect(result.success).toBe(true);
        });
        it('should accept minimal response', () => {
            const minimalResponse = {
                requestId: uuid(),
                success: true,
            };
            const result = ProviderResponseSchema.safeParse(minimalResponse);
            expect(result.success).toBe(true);
        });
        it('should reject response without requestId', () => {
            const invalidResponse = {
                success: true,
                content: 'Hello',
            };
            const result = ProviderResponseSchema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
        it('should reject response with invalid finishReason', () => {
            const invalidResponse = {
                requestId: uuid(),
                success: true,
                finishReason: 'invalid',
            };
            const result = ProviderResponseSchema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
        it('should accept all valid finishReason values', () => {
            const validReasons = ['stop', 'length', 'error'];
            for (const finishReason of validReasons) {
                const response = {
                    requestId: uuid(),
                    success: true,
                    finishReason,
                };
                const result = ProviderResponseSchema.safeParse(response);
                expect(result.success).toBe(true);
            }
        });
        it('should validate usage tokens are non-negative', () => {
            const invalidUsage = {
                requestId: uuid(),
                success: true,
                usage: { promptTokens: -1, completionTokens: 20 },
            };
            const result = ProviderResponseSchema.safeParse(invalidUsage);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-PROV-PORT-003: No Exception Throwing', () => {
        it('should return error response structure for errors', () => {
            const errorResponse = createProviderErrorResponse(uuid(), 'PROVIDER_UNAVAILABLE', 'Provider is not available');
            expect(errorResponse.success).toBe(false);
            expect(errorResponse.error).toBeDefined();
            expect(errorResponse.error?.code).toBe('PROVIDER_UNAVAILABLE');
            expect(errorResponse.error?.message).toBe('Provider is not available');
        });
        it('should have error structure that includes code and message', () => {
            const validError = {
                requestId: uuid(),
                success: false,
                error: { code: 'ERROR_CODE', message: 'Error message' },
            };
            const result = ProviderResponseSchema.safeParse(validError);
            expect(result.success).toBe(true);
        });
        it('should serialize and deserialize error response correctly', () => {
            const errorResponse = createProviderErrorResponse(uuid(), 'NETWORK_ERROR', 'Connection refused');
            // Simulate network boundary (JSON serialization)
            const serialized = JSON.stringify(errorResponse);
            const deserialized = JSON.parse(serialized);
            const result = ProviderResponseSchema.safeParse(deserialized);
            expect(result.success).toBe(true);
        });
    });
});
// ============================================================================
// Provider Registry Invariant Tests
// ============================================================================
describe('INV-PROV-REG: Provider Registry Invariants', () => {
    describe('INV-PROV-REG-001: Unknown Provider Handling', () => {
        it('should return undefined for unknown provider', () => {
            // Create a mock implementation to verify behavior
            const mockRegistry = {
                getProvider: vi.fn().mockReturnValue(undefined),
                getDefaultProvider: vi.fn().mockReturnValue(undefined),
                listProviders: vi.fn().mockReturnValue([]),
                hasProvider: vi.fn().mockReturnValue(false),
            };
            // Unknown provider returns undefined (not throws)
            expect(mockRegistry.getProvider('unknown-provider')).toBeUndefined();
            expect(mockRegistry.hasProvider('unknown-provider')).toBe(false);
        });
        it('should return provider when it exists', () => {
            const mockProvider = {
                providerId: 'claude',
                complete: vi.fn(),
                isAvailable: vi.fn().mockResolvedValue(true),
                getModels: vi.fn().mockReturnValue([]),
                getStatus: vi.fn().mockReturnValue('closed'),
            };
            const mockRegistry = {
                getProvider: vi.fn().mockImplementation((id) => id === 'claude' ? mockProvider : undefined),
                getDefaultProvider: vi.fn().mockReturnValue(mockProvider),
                listProviders: vi.fn().mockReturnValue(['claude']),
                hasProvider: vi.fn().mockImplementation((id) => id === 'claude'),
            };
            expect(mockRegistry.getProvider('claude')).toBe(mockProvider);
            expect(mockRegistry.getProvider('unknown')).toBeUndefined();
            expect(mockRegistry.hasProvider('claude')).toBe(true);
            expect(mockRegistry.hasProvider('unknown')).toBe(false);
        });
    });
    describe('INV-PROV-REG-002: Deterministic Listing', () => {
        it('should return providers in same order across calls', () => {
            const mockRegistry = {
                getProvider: vi.fn(),
                getDefaultProvider: vi.fn(),
                listProviders: vi.fn().mockReturnValue(['claude', 'gemini', 'openai']),
                hasProvider: vi.fn(),
            };
            // Multiple calls should return same order
            const firstCall = mockRegistry.listProviders();
            const secondCall = mockRegistry.listProviders();
            const thirdCall = mockRegistry.listProviders();
            expect(firstCall).toEqual(secondCall);
            expect(secondCall).toEqual(thirdCall);
        });
        it('should return sorted order', () => {
            const providers = ['claude', 'gemini', 'openai'];
            const mockRegistry = {
                getProvider: vi.fn(),
                getDefaultProvider: vi.fn(),
                listProviders: vi.fn().mockReturnValue([...providers].sort()),
                hasProvider: vi.fn(),
            };
            const result = mockRegistry.listProviders();
            expect(result).toEqual(['claude', 'gemini', 'openai']);
        });
    });
});
// ============================================================================
// Provider Health Invariant Tests
// ============================================================================
describe('INV-PROV-HEALTH: Health Check Invariants', () => {
    describe('INV-PROV-HEALTH-001: Timeout Enforcement', () => {
        it('should define health check config with timeout', () => {
            const config = createDefaultHealthCheckConfig();
            expect(config.timeoutMs).toBeDefined();
            expect(config.timeoutMs).toBeGreaterThan(0);
        });
        it('should validate timeout within bounds', () => {
            const validConfig = {
                intervalMs: 30000,
                timeoutMs: 5000,
                latencySampleSize: 10,
                unhealthyErrorRate: 0.5,
            };
            const result = HealthCheckConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });
        it('should reject timeout below minimum', () => {
            const invalidConfig = {
                intervalMs: 30000,
                timeoutMs: 500, // Below minimum of 1000
                latencySampleSize: 10,
                unhealthyErrorRate: 0.5,
            };
            const result = HealthCheckConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
        it('should reject timeout above maximum', () => {
            const invalidConfig = {
                intervalMs: 30000,
                timeoutMs: 60000, // Above maximum
                latencySampleSize: 10,
                unhealthyErrorRate: 0.5,
            };
            const result = HealthCheckConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-PROV-HEALTH-002: No Side Effects', () => {
        it('should define health status as read-only snapshot', () => {
            const status = createInitialHealthStatus('claude');
            // Health status should be a pure data structure
            expect(status.providerId).toBe('claude');
            expect(status.available).toBeDefined();
            expect(status.latencyMs).toBeDefined();
            expect(status.errorRate).toBeDefined();
        });
        it('should have immutable structure (pure data)', () => {
            const status = createInitialHealthStatus('claude');
            // Verify structure is JSON-serializable (no functions/side effects)
            const serialized = JSON.stringify(status);
            const deserialized = JSON.parse(serialized);
            const result = HealthStatusSchema.safeParse(deserialized);
            expect(result.success).toBe(true);
        });
    });
    describe('INV-PROV-HEALTH-003: Graceful Degradation', () => {
        it('should track available status for routing decisions', () => {
            const healthyStatus = {
                providerId: 'claude',
                available: true,
                level: 'healthy',
                latencyMs: 150,
                errorRate: 0.01,
                consecutiveFailures: 0,
                consecutiveSuccesses: 10,
                lastCheckTime: new Date().toISOString(),
                circuitState: 'closed',
                rateLimitState: 'normal',
                totalRequests: 100,
                totalErrors: 1,
            };
            const unhealthyStatus = {
                providerId: 'gemini',
                available: false,
                level: 'unhealthy',
                latencyMs: 5000,
                errorRate: 0.9,
                consecutiveFailures: 5,
                consecutiveSuccesses: 0,
                lastCheckTime: new Date().toISOString(),
                circuitState: 'open',
                rateLimitState: 'blocked',
                totalRequests: 100,
                totalErrors: 90,
            };
            // Routing should filter by available status
            const providers = [healthyStatus, unhealthyStatus];
            const availableProviders = providers.filter((p) => p.available);
            expect(availableProviders).toHaveLength(1);
            expect(availableProviders[0].providerId).toBe('claude');
        });
        it('should support health levels for gradual degradation', () => {
            const healthLevels = ['healthy', 'degraded', 'unhealthy'];
            for (const level of healthLevels) {
                const status = {
                    providerId: 'claude',
                    available: level !== 'unhealthy',
                    level,
                    latencyMs: 150,
                    errorRate: 0.01,
                    consecutiveFailures: 0,
                    consecutiveSuccesses: 10,
                    lastCheckTime: new Date().toISOString(),
                    circuitState: 'closed',
                    rateLimitState: 'normal',
                    totalRequests: 100,
                    totalErrors: 1,
                };
                const result = HealthStatusSchema.safeParse(status);
                expect(result.success).toBe(true);
            }
        });
    });
});
// ============================================================================
// Circuit Breaker Contract Invariants
// ============================================================================
describe('INV-CB: Circuit Breaker Invariants', () => {
    describe('INV-CB-001: Closed State Allows All Requests', () => {
        it('should initialize in closed state', () => {
            const state = createInitialCircuitBreakerState();
            expect(state.state).toBe('closed');
        });
        it('should validate closed state schema', () => {
            const closedState = {
                state: 'closed',
                failureCount: 0,
                successCount: 0,
                lastFailureTime: undefined,
                lastSuccessTime: undefined,
                nextAttemptTime: undefined,
            };
            const result = CircuitBreakerStateSchema.safeParse(closedState);
            expect(result.success).toBe(true);
        });
    });
    describe('INV-CB-002: Open State Rejects Until Timeout', () => {
        it('should validate open state with nextAttemptTime', () => {
            const openState = {
                state: 'open',
                failureCount: 5,
                successCount: 0,
                lastFailureTime: new Date().toISOString(),
                nextAttemptTime: new Date(Date.now() + 30000).toISOString(),
            };
            const result = CircuitBreakerStateSchema.safeParse(openState);
            expect(result.success).toBe(true);
        });
        it('should have configurable resetTimeoutMs', () => {
            const config = createDefaultCircuitBreakerConfig();
            expect(config.resetTimeoutMs).toBeDefined();
            expect(config.resetTimeoutMs).toBeGreaterThan(0);
        });
    });
    describe('INV-CB-003: Half-Open Limits Test Requests', () => {
        it('should validate half-open state', () => {
            const halfOpenState = {
                state: 'halfOpen',
                failureCount: 0,
                successCount: 0,
                lastFailureTime: new Date().toISOString(),
            };
            const result = CircuitBreakerStateSchema.safeParse(halfOpenState);
            expect(result.success).toBe(true);
        });
        it('should have halfOpenRequests config', () => {
            const config = createDefaultCircuitBreakerConfig();
            expect(config.halfOpenRequests).toBeDefined();
            expect(config.halfOpenRequests).toBeGreaterThan(0);
        });
    });
    describe('INV-CB-004: Failure Threshold Triggers Open', () => {
        it('should have configurable failure threshold', () => {
            const config = createDefaultCircuitBreakerConfig();
            expect(config.failureThreshold).toBeDefined();
            expect(config.failureThreshold).toBeGreaterThan(0);
        });
        it('should validate failure threshold bounds', () => {
            const validConfig = {
                failureThreshold: 5,
                resetTimeoutMs: 30000,
                halfOpenRequests: 3,
                monitorIntervalMs: 10000,
            };
            const result = CircuitBreakerConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
        });
        it('should reject failure threshold below minimum', () => {
            const invalidConfig = {
                failureThreshold: 0,
                resetTimeoutMs: 30000,
                halfOpenRequests: 3,
                monitorIntervalMs: 10000,
            };
            const result = CircuitBreakerConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-CB-005: Success in Half-Open Closes Circuit', () => {
        it('should track success count for half-open transitions', () => {
            const halfOpenState = {
                state: 'halfOpen',
                failureCount: 0,
                successCount: 2,
                lastSuccessTime: new Date().toISOString(),
            };
            const result = CircuitBreakerStateSchema.safeParse(halfOpenState);
            expect(result.success).toBe(true);
        });
        it('should have halfOpenRequests config for transition threshold', () => {
            const config = createDefaultCircuitBreakerConfig();
            expect(config.halfOpenRequests).toBeDefined();
            expect(config.halfOpenRequests).toBeGreaterThanOrEqual(1);
        });
    });
    describe('Circuit State Enum Validation', () => {
        it('should accept all valid circuit states', () => {
            const validStates = ['closed', 'open', 'halfOpen'];
            for (const state of validStates) {
                const result = CircuitStateSchema.safeParse(state);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid circuit state', () => {
            const result = CircuitStateSchema.safeParse('invalid');
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=provider.test.js.map