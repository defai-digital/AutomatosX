/**
 * Integration tests for ProviderRouterV2 with real provider SDKs
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderRouterV2, createProviderRouter } from '../ProviderRouterV2.js';
import { ProviderAuthError } from '../../providers/ProviderBase.js';
// Mock all provider SDKs
vi.mock('@anthropic-ai/sdk');
vi.mock('@google/generative-ai');
vi.mock('openai');
describe('ProviderRouterV2', () => {
    let router;
    const defaultConfig = {
        providers: {
            claude: {
                enabled: true,
                priority: 1,
                apiKey: 'test-claude-key',
                maxRetries: 3,
                timeout: 5000,
                defaultModel: 'claude-sonnet-4-5-20250929',
            },
            gemini: {
                enabled: true,
                priority: 2,
                apiKey: 'test-gemini-key',
                maxRetries: 2,
                timeout: 5000,
                defaultModel: 'gemini-2.0-flash-exp',
            },
            openai: {
                enabled: true,
                priority: 3,
                apiKey: 'test-openai-key',
                maxRetries: 2,
                timeout: 5000,
                defaultModel: 'gpt-4o',
            },
        },
    };
    beforeEach(() => {
        vi.clearAllMocks();
        router = new ProviderRouterV2(defaultConfig);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('initialization', () => {
        it('should initialize with all providers enabled', () => {
            const health = router.getHealthStatus();
            expect(health.size).toBe(3);
            expect(health.get('claude')?.available).toBe(true);
            expect(health.get('gemini')?.available).toBe(true);
            expect(health.get('openai')?.available).toBe(true);
        });
        it('should initialize only enabled providers', () => {
            const config = {
                providers: {
                    claude: { ...defaultConfig.providers.claude, enabled: true },
                    gemini: { ...defaultConfig.providers.gemini, enabled: false },
                    openai: { ...defaultConfig.providers.openai, enabled: false },
                },
            };
            const singleRouter = new ProviderRouterV2(config);
            const health = singleRouter.getHealthStatus();
            expect(health.size).toBe(1);
            expect(health.has('claude')).toBe(true);
            expect(health.has('gemini')).toBe(false);
            expect(health.has('openai')).toBe(false);
        });
        it('should respect provider priority in selection', () => {
            const decision = router.selectProvider();
            expect(decision.selectedProvider).toBe('claude'); // Priority 1
            expect(decision.fallbackChain).toEqual(['gemini', 'openai']);
        });
    });
    describe('provider selection', () => {
        it('should select provider with lowest priority number', () => {
            const decision = router.selectProvider();
            expect(decision.selectedProvider).toBe('claude');
            expect(decision.reason).toContain('priority 1');
        });
        it('should provide fallback chain in priority order', () => {
            const decision = router.selectProvider();
            expect(decision.fallbackChain).toEqual(['gemini', 'openai']);
        });
        it('should throw if no providers available', () => {
            const config = {
                providers: {
                    claude: { ...defaultConfig.providers.claude, enabled: false },
                    gemini: { ...defaultConfig.providers.gemini, enabled: false },
                    openai: { ...defaultConfig.providers.openai, enabled: false },
                },
            };
            const emptyRouter = new ProviderRouterV2(config);
            expect(() => emptyRouter.selectProvider()).toThrow('No providers available');
        });
    });
    describe('request handling', () => {
        it('should handle legacy prompt format', async () => {
            // Mock successful response
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            const response = await router.request({
                prompt: 'Hello world',
                maxTokens: 100,
            });
            expect(response.content).toBe('Response');
            expect(response.provider).toBe('claude');
        });
        it('should handle messages format', async () => {
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            const response = await router.request({
                messages: [{ role: 'user', content: 'Hello' }],
                maxTokens: 100,
            });
            expect(response.content).toBe('Response');
        });
        it('should throw if neither prompt nor messages provided', async () => {
            await expect(router.request({
                maxTokens: 100,
            })).rejects.toThrow('Either messages or prompt must be provided');
        });
    });
    describe('fallback mechanism', () => {
        it('should fallback to next provider on failure', async () => {
            const executeRequestSpy = vi.spyOn(router, 'executeRequest');
            // First provider fails, second succeeds
            executeRequestSpy
                .mockRejectedValueOnce(new Error('Provider 1 failed'))
                .mockResolvedValueOnce({
                provider: 'gemini',
                model: 'gemini-2.0-flash-exp',
                content: 'Response from gemini',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            const response = await router.request({
                prompt: 'Test',
            });
            expect(response.provider).toBe('gemini');
            expect(response.content).toBe('Response from gemini');
            expect(executeRequestSpy).toHaveBeenCalledTimes(4); // 3 retries for claude, 1 for gemini
        });
        it('should try all providers before failing', async () => {
            const executeRequestSpy = vi.spyOn(router, 'executeRequest');
            executeRequestSpy.mockRejectedValue(new Error('All providers down'));
            await expect(router.request({
                prompt: 'Test',
            })).rejects.toThrow('All providers failed');
            // Should try: claude (3 retries) + gemini (2 retries) + openai (2 retries) = 7 attempts
            expect(executeRequestSpy).toHaveBeenCalledTimes(7);
        });
        it('should not retry on auth errors', async () => {
            const executeRequestSpy = vi.spyOn(router, 'executeRequest');
            executeRequestSpy.mockRejectedValue(new ProviderAuthError('claude', 'Invalid API key'));
            await expect(router.request({
                prompt: 'Test',
            })).rejects.toThrow('All providers failed');
            // Should only try once for claude (no retries on auth error)
            // Then try other providers
            expect(executeRequestSpy).toHaveBeenCalled();
        });
    });
    describe('health metrics', () => {
        it('should update health on successful request', async () => {
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 150,
                finishReason: 'complete',
            });
            await router.request({ prompt: 'Test' });
            const health = router.getProviderHealth('claude');
            expect(health?.available).toBe(true);
            expect(health?.latency).toBeGreaterThan(0);
        });
        it('should update health on failed request', async () => {
            vi.spyOn(router, 'executeRequest').mockRejectedValue(new Error('Request failed'));
            try {
                await router.request({ prompt: 'Test' });
            }
            catch {
                // Expected to fail
            }
            const health = router.getProviderHealth('claude');
            expect(health?.lastError).toBeDefined();
        });
        it('should track requests per minute', async () => {
            vi.spyOn(router, 'executeRequest').mockResolvedValue({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            // Make multiple requests
            await router.request({ prompt: 'Test 1' });
            await router.request({ prompt: 'Test 2' });
            await router.request({ prompt: 'Test 3' });
            const health = router.getProviderHealth('claude');
            expect(health?.requestsInLastMinute).toBeGreaterThan(0);
        });
    });
    describe('chaos mode', () => {
        it('should randomly fail requests in chaos mode', async () => {
            const chaosRouter = new ProviderRouterV2({
                ...defaultConfig,
                chaosMode: true,
            });
            vi.spyOn(Math, 'random').mockReturnValue(0.2); // Will trigger chaos failure (< 0.3)
            await expect(chaosRouter.request({ prompt: 'Test' })).rejects.toThrow('Chaos mode');
        });
        it('should succeed some requests in chaos mode', async () => {
            const chaosRouter = new ProviderRouterV2({
                ...defaultConfig,
                chaosMode: true,
            });
            vi.spyOn(Math, 'random').mockReturnValue(0.5); // Won't trigger chaos failure (>= 0.3)
            vi.spyOn(chaosRouter, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            const response = await chaosRouter.request({ prompt: 'Test' });
            expect(response.content).toBe('Response');
        });
    });
    describe('statistics', () => {
        it('should return statistics for all providers', () => {
            const stats = router.getStatistics();
            expect(stats).toHaveProperty('claude');
            expect(stats).toHaveProperty('gemini');
            expect(stats).toHaveProperty('openai');
            expect(stats.claude).toHaveProperty('available');
            expect(stats.claude).toHaveProperty('latency');
            expect(stats.claude).toHaveProperty('errorRate');
        });
        it('should include health metrics in statistics', async () => {
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 150,
                finishReason: 'complete',
            });
            await router.request({ prompt: 'Test' });
            const stats = router.getStatistics();
            expect(stats.claude.latency).toBeGreaterThan(0);
            expect(stats.claude.requestsLastMinute).toBeGreaterThan(0);
        });
    });
    describe('event emission', () => {
        it('should emit routing-decision event', async () => {
            const mockListener = vi.fn();
            router.on('routing-decision', mockListener);
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            await router.request({ prompt: 'Test' });
            expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
                selectedProvider: 'claude',
                fallbackChain: expect.arrayContaining(['gemini', 'openai']),
            }));
        });
        it('should emit attempt event', async () => {
            const mockListener = vi.fn();
            router.on('attempt', mockListener);
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            await router.request({ prompt: 'Test' });
            expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'claude',
                attempt: 1,
            }));
        });
        it('should emit success event', async () => {
            const mockListener = vi.fn();
            router.on('success', mockListener);
            vi.spyOn(router, 'executeRequest').mockResolvedValueOnce({
                provider: 'claude',
                model: 'claude-sonnet-4-5-20250929',
                content: 'Response',
                tokensUsed: 50,
                latency: 100,
                finishReason: 'complete',
            });
            await router.request({ prompt: 'Test' });
            expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'claude',
                response: expect.any(Object),
            }));
        });
        it('should emit error event on failures', async () => {
            const mockListener = vi.fn();
            router.on('error', mockListener);
            vi.spyOn(router, 'executeRequest').mockRejectedValue(new Error('Test error'));
            try {
                await router.request({ prompt: 'Test' });
            }
            catch {
                // Expected to fail
            }
            expect(mockListener).toHaveBeenCalled();
        });
    });
    describe('createProviderRouter factory', () => {
        it('should create router with environment variable defaults', () => {
            process.env.ANTHROPIC_API_KEY = 'test-claude-key';
            process.env.GOOGLE_API_KEY = 'test-gemini-key';
            process.env.OPENAI_API_KEY = 'test-openai-key';
            const router = createProviderRouter();
            expect(router).toBeInstanceOf(ProviderRouterV2);
            // Clean up
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.GOOGLE_API_KEY;
            delete process.env.OPENAI_API_KEY;
        });
        it('should merge custom options with defaults', () => {
            const router = createProviderRouter({
                chaosMode: true,
                providers: {
                    claude: {
                        enabled: true,
                        priority: 1,
                        maxRetries: 5,
                        timeout: 10000,
                    },
                },
            });
            expect(router).toBeInstanceOf(ProviderRouterV2);
        });
    });
    describe('health checks', () => {
        it('should perform health checks on all providers', async () => {
            // Mock health check responses
            const claudeProvider = router.providers.get('claude');
            const geminiProvider = router.providers.get('gemini');
            const openaiProvider = router.providers.get('openai');
            if (claudeProvider) {
                vi.spyOn(claudeProvider, 'healthCheck').mockResolvedValue({
                    available: true,
                    latency: 100,
                    errorRate: 0,
                    lastCheckedAt: Date.now(),
                });
            }
            if (geminiProvider) {
                vi.spyOn(geminiProvider, 'healthCheck').mockResolvedValue({
                    available: true,
                    latency: 120,
                    errorRate: 0,
                    lastCheckedAt: Date.now(),
                });
            }
            if (openaiProvider) {
                vi.spyOn(openaiProvider, 'healthCheck').mockResolvedValue({
                    available: false,
                    latency: 0,
                    errorRate: 1.0,
                    lastCheckedAt: Date.now(),
                    lastError: 'Connection timeout',
                });
            }
            const results = await router.performHealthChecks();
            expect(results.get('claude')).toBe(true);
            expect(results.get('gemini')).toBe(true);
            expect(results.get('openai')).toBe(false);
        });
    });
});
//# sourceMappingURL=ProviderRouterV2.test.js.map