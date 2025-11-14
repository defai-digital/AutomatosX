/**
 * Tests for OpenAI provider implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider, OPENAI_MODELS, createOpenAIProvider } from '../OpenAIProvider.js';
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError, ProviderNetworkError, } from '../ProviderBase.js';
import OpenAI from 'openai';
// Mock the OpenAI SDK
vi.mock('openai', () => {
    const mockCreate = vi.fn();
    const mockList = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
        models: {
            list: mockList,
        },
    }));
    // Add error class
    MockOpenAI.APIError = class APIError extends Error {
        status;
        headers;
        constructor(status, message, headers) {
            super(message);
            this.status = status;
            this.headers = headers;
            this.name = 'APIError';
        }
    };
    return {
        default: MockOpenAI,
        __mockCreate: mockCreate,
        __mockList: mockList,
    };
});
const { __mockCreate: mockCreate, __mockList: mockList } = await import('openai');
describe('OpenAIProvider', () => {
    let provider;
    beforeEach(() => {
        vi.clearAllMocks();
        provider = new OpenAIProvider({
            enabled: true,
            apiKey: 'test-api-key',
            timeout: 5000,
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('constructor', () => {
        it('should create provider with default config', () => {
            expect(provider.name).toBe('openai');
            expect(provider.config.enabled).toBe(true);
            expect(provider.config.defaultModel).toBe(OPENAI_MODELS['gpt-4o']);
        });
        it('should use custom model from config', () => {
            const customProvider = new OpenAIProvider({
                enabled: true,
                apiKey: 'test-key',
                defaultModel: OPENAI_MODELS['gpt-4-turbo'],
            });
            expect(customProvider.config.defaultModel).toBe(OPENAI_MODELS['gpt-4-turbo']);
        });
        it('should fall back to environment variable for API key', () => {
            process.env.OPENAI_API_KEY = 'env-api-key';
            const envProvider = new OpenAIProvider({
                enabled: true,
            });
            expect(envProvider.config.apiKey).toBe('env-api-key');
            delete process.env.OPENAI_API_KEY;
        });
        it('should support organization config', () => {
            const orgProvider = new OpenAIProvider({
                enabled: true,
                apiKey: 'test-key',
                organization: 'org-123',
            });
            expect(orgProvider.config).toHaveProperty('organization', 'org-123');
        });
    });
    describe('request', () => {
        it('should make successful request', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'Hello, world!' },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            const request = {
                messages: [{ role: 'user', content: 'Hello' }],
                maxTokens: 100,
                temperature: 1.0,
            };
            const response = await provider.request(request);
            expect(response.content).toBe('Hello, world!');
            expect(response.model).toBe(OPENAI_MODELS['gpt-4o']);
            expect(response.usage.inputTokens).toBe(10);
            expect(response.usage.outputTokens).toBe(5);
            expect(response.usage.totalTokens).toBe(15);
            expect(response.finishReason).toBe('stop');
            expect(response.provider).toBe('openai');
            expect(response.latency).toBeGreaterThanOrEqual(0);
        });
        it('should handle null content in response', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: null },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 0,
                    total_tokens: 10,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.content).toBe('');
        });
        it('should use custom model from request', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o-mini'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'Response' },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            await provider.request({
                model: OPENAI_MODELS['gpt-4o-mini'],
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                model: OPENAI_MODELS['gpt-4o-mini'],
            }));
        });
        it('should map length finish reason', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'Truncated...' },
                        finish_reason: 'length',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 100,
                    total_tokens: 110,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.finishReason).toBe('length');
        });
        it('should map tool_calls finish reason', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'Using tools...' },
                        finish_reason: 'tool_calls',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.finishReason).toBe('tool_use');
        });
        it('should throw ProviderAuthError on 401', async () => {
            const apiError = new OpenAI.APIError(401, 'Invalid API key');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderAuthError);
        });
        it('should throw ProviderRateLimitError on 429', async () => {
            const apiError = new OpenAI.APIError(429, 'Rate limit exceeded', {
                'retry-after': '60',
            });
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderRateLimitError);
        });
        it('should throw ProviderTimeoutError on 408', async () => {
            const apiError = new OpenAI.APIError(408, 'Request timeout');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderTimeoutError);
        });
        it('should throw ProviderNetworkError on 500', async () => {
            const apiError = new OpenAI.APIError(500, 'Internal server error');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderNetworkError);
        });
        it('should retry on retryable errors', async () => {
            const apiError = new OpenAI.APIError(503, 'Service unavailable');
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'Success' },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            };
            mockCreate
                .mockRejectedValueOnce(apiError)
                .mockRejectedValueOnce(apiError)
                .mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.content).toBe('Success');
            expect(mockCreate).toHaveBeenCalledTimes(3);
        });
        it('should not retry on non-retryable errors', async () => {
            const apiError = new OpenAI.APIError(401, 'Invalid API key');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderAuthError);
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });
    });
    describe('streamRequest', () => {
        it('should handle streaming response', async () => {
            const mockStream = [
                {
                    id: 'chatcmpl-123',
                    model: OPENAI_MODELS['gpt-4o'],
                    choices: [
                        {
                            delta: { content: 'Hello' },
                            finish_reason: null,
                        },
                    ],
                    usage: null,
                },
                {
                    id: 'chatcmpl-123',
                    model: OPENAI_MODELS['gpt-4o'],
                    choices: [
                        {
                            delta: { content: ' world' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 5,
                    },
                },
            ];
            mockCreate.mockResolvedValueOnce({
                [Symbol.asyncIterator]: async function* () {
                    for (const chunk of mockStream) {
                        yield chunk;
                    }
                },
            });
            const chunks = [];
            const onChunk = vi.fn((chunk) => chunks.push(chunk.delta));
            const response = await provider.streamRequest({
                messages: [{ role: 'user', content: 'Test' }],
            }, onChunk);
            expect(response.content).toBe('Hello world');
            expect(response.usage.inputTokens).toBe(10);
            expect(response.usage.outputTokens).toBe(5);
            expect(response.finishReason).toBe('stop');
            expect(onChunk).toHaveBeenCalledTimes(2);
            expect(chunks).toEqual(['Hello', ' world']);
        });
        it('should handle empty deltas in stream', async () => {
            const mockStream = [
                {
                    id: 'chatcmpl-123',
                    model: OPENAI_MODELS['gpt-4o'],
                    choices: [
                        {
                            delta: { content: '' },
                            finish_reason: null,
                        },
                    ],
                },
                {
                    id: 'chatcmpl-123',
                    model: OPENAI_MODELS['gpt-4o'],
                    choices: [
                        {
                            delta: { content: 'Hello' },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: {
                        prompt_tokens: 5,
                        completion_tokens: 2,
                    },
                },
            ];
            mockCreate.mockResolvedValueOnce({
                [Symbol.asyncIterator]: async function* () {
                    for (const chunk of mockStream) {
                        yield chunk;
                    }
                },
            });
            const onChunk = vi.fn();
            const response = await provider.streamRequest({
                messages: [{ role: 'user', content: 'Test' }],
            }, onChunk);
            expect(response.content).toBe('Hello');
            expect(onChunk).toHaveBeenCalledTimes(1);
        });
        it('should handle streaming errors', async () => {
            const apiError = new OpenAI.APIError(500, 'Streaming error');
            mockCreate.mockRejectedValueOnce(apiError);
            await expect(provider.streamRequest({
                messages: [{ role: 'user', content: 'Test' }],
            }, () => { })).rejects.toThrow(ProviderNetworkError);
        });
    });
    describe('healthCheck', () => {
        it('should return healthy status on success', async () => {
            const mockResponse = {
                id: 'chatcmpl-123',
                model: OPENAI_MODELS['gpt-4o'],
                choices: [
                    {
                        message: { role: 'assistant', content: 'pong' },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 1,
                    completion_tokens: 1,
                    total_tokens: 2,
                },
            };
            mockCreate.mockResolvedValueOnce(mockResponse);
            const health = await provider.healthCheck();
            expect(health.available).toBe(true);
            expect(health.latency).toBeGreaterThanOrEqual(0);
            expect(health.errorRate).toBe(0);
            expect(health.lastError).toBeUndefined();
        });
        it('should return unhealthy status on error', async () => {
            const apiError = new OpenAI.APIError(500, 'Service down');
            mockCreate.mockRejectedValueOnce(apiError);
            const health = await provider.healthCheck();
            expect(health.available).toBe(false);
            expect(health.errorRate).toBe(1.0);
            expect(health.lastError).toBeDefined();
        });
    });
    describe('getAvailableModels', () => {
        it('should return list of GPT models from API', async () => {
            const mockModels = {
                data: [
                    { id: 'gpt-4o', created: 1234567890 },
                    { id: 'gpt-4-turbo', created: 1234567890 },
                    { id: 'gpt-3.5-turbo', created: 1234567890 },
                    { id: 'whisper-1', created: 1234567890 }, // Should be filtered out
                ],
            };
            mockList.mockResolvedValueOnce(mockModels);
            const models = await provider.getAvailableModels();
            expect(models).toContain('gpt-4o');
            expect(models).toContain('gpt-4-turbo');
            expect(models).toContain('gpt-3.5-turbo');
            expect(models).not.toContain('whisper-1');
        });
        it('should fallback to hardcoded list on API error', async () => {
            mockList.mockRejectedValueOnce(new Error('API error'));
            const models = await provider.getAvailableModels();
            expect(models).toContain(OPENAI_MODELS['gpt-4o']);
            expect(models).toContain(OPENAI_MODELS['gpt-4-turbo']);
        });
    });
    describe('validateConfig', () => {
        it('should validate enabled provider with API key', async () => {
            const result = await provider.validateConfig();
            expect(result).toBe(true);
        });
        it('should return false for disabled provider', async () => {
            const disabledProvider = new OpenAIProvider({
                enabled: false,
                apiKey: 'test-key',
            });
            const result = await disabledProvider.validateConfig();
            expect(result).toBe(false);
        });
        it('should throw error if no API key', async () => {
            const noKeyProvider = new OpenAIProvider({
                enabled: true,
            });
            await expect(noKeyProvider.validateConfig()).rejects.toThrow(ProviderAuthError);
        });
    });
    describe('createOpenAIProvider', () => {
        it('should create provider with factory function', () => {
            process.env.OPENAI_API_KEY = 'env-key';
            const provider = createOpenAIProvider();
            expect(provider).toBeInstanceOf(OpenAIProvider);
            expect(provider.config.enabled).toBe(true);
            delete process.env.OPENAI_API_KEY;
        });
        it('should merge custom config', () => {
            const provider = createOpenAIProvider({
                apiKey: 'custom-key',
                timeout: 30000,
                organization: 'org-456',
            });
            expect(provider.config.apiKey).toBe('custom-key');
            expect(provider.config.timeout).toBe(30000);
        });
    });
});
//# sourceMappingURL=OpenAIProvider.test.js.map