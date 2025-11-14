/**
 * Tests for Gemini provider implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider, GEMINI_MODELS, createGeminiProvider } from '../GeminiProvider.js';
import { ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError, ProviderNetworkError, } from '../ProviderBase.js';
// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
    const mockGenerateContent = vi.fn();
    const mockGenerateContentStream = vi.fn();
    const mockGetGenerativeModel = vi.fn();
    const MockGoogleGenerativeAI = vi.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
    }));
    mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
    });
    return {
        GoogleGenerativeAI: MockGoogleGenerativeAI,
        __mockGenerateContent: mockGenerateContent,
        __mockGenerateContentStream: mockGenerateContentStream,
        __mockGetGenerativeModel: mockGetGenerativeModel,
    };
});
const { __mockGenerateContent: mockGenerateContent, __mockGenerateContentStream: mockGenerateContentStream } = await import('@google/generative-ai');
describe('GeminiProvider', () => {
    let provider;
    beforeEach(() => {
        vi.clearAllMocks();
        provider = new GeminiProvider({
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
            expect(provider.name).toBe('gemini');
            expect(provider.config.enabled).toBe(true);
            expect(provider.config.defaultModel).toBe(GEMINI_MODELS['gemini-2.0-flash-exp']);
        });
        it('should use custom model from config', () => {
            const customProvider = new GeminiProvider({
                enabled: true,
                apiKey: 'test-key',
                defaultModel: GEMINI_MODELS['gemini-1.5-pro'],
            });
            expect(customProvider.config.defaultModel).toBe(GEMINI_MODELS['gemini-1.5-pro']);
        });
        it('should fall back to environment variable for API key', () => {
            process.env.GOOGLE_API_KEY = 'env-api-key';
            const envProvider = new GeminiProvider({
                enabled: true,
            });
            expect(envProvider.config.apiKey).toBe('env-api-key');
            delete process.env.GOOGLE_API_KEY;
        });
    });
    describe('request', () => {
        it('should make successful request', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Hello, world!',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            };
            mockGenerateContent.mockResolvedValueOnce(mockResponse);
            const request = {
                messages: [{ role: 'user', content: 'Hello' }],
                maxTokens: 100,
                temperature: 1.0,
            };
            const response = await provider.request(request);
            expect(response.content).toBe('Hello, world!');
            expect(response.model).toBe(GEMINI_MODELS['gemini-2.0-flash-exp']);
            expect(response.usage.inputTokens).toBe(10);
            expect(response.usage.outputTokens).toBe(5);
            expect(response.usage.totalTokens).toBe(15);
            expect(response.finishReason).toBe('stop');
            expect(response.provider).toBe('gemini');
            expect(response.latency).toBeGreaterThanOrEqual(0);
        });
        it('should convert system messages to user messages', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Response',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            };
            mockGenerateContent.mockResolvedValueOnce(mockResponse);
            await provider.request({
                messages: [
                    { role: 'system', content: 'You are helpful' },
                    { role: 'user', content: 'Hello' },
                ],
            });
            // Verify system message was converted
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: expect.arrayContaining([
                    expect.objectContaining({ role: 'user' }),
                ]),
            }));
        });
        it('should use custom model from request', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Response',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            };
            mockGenerateContent.mockResolvedValueOnce(mockResponse);
            await provider.request({
                model: GEMINI_MODELS['gemini-1.5-flash'],
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(mockGenerateContent).toHaveBeenCalled();
        });
        it('should map MAX_TOKENS finish reason to length', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Truncated...',
                    candidates: [{ finishReason: 'MAX_TOKENS' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 100,
                        totalTokenCount: 110,
                    },
                },
            };
            mockGenerateContent.mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.finishReason).toBe('length');
        });
        it('should throw ProviderAuthError on auth failure', async () => {
            const authError = new Error('API_KEY invalid');
            mockGenerateContent.mockRejectedValueOnce(authError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderAuthError);
        });
        it('should throw ProviderRateLimitError on quota exceeded', async () => {
            const quotaError = new Error('quota exceeded');
            mockGenerateContent.mockRejectedValueOnce(quotaError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderRateLimitError);
        });
        it('should throw ProviderTimeoutError on timeout', async () => {
            const timeoutError = new Error('timeout');
            mockGenerateContent.mockRejectedValueOnce(timeoutError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderTimeoutError);
        });
        it('should throw ProviderNetworkError on network error', async () => {
            const networkError = new Error('ECONNREFUSED');
            mockGenerateContent.mockRejectedValueOnce(networkError);
            await expect(provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            })).rejects.toThrow(ProviderNetworkError);
        });
        it('should retry on retryable errors', async () => {
            const networkError = new Error('500 Internal Server Error');
            const mockResponse = {
                response: {
                    text: () => 'Success',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            };
            mockGenerateContent
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockResponse);
            const response = await provider.request({
                messages: [{ role: 'user', content: 'Test' }],
            });
            expect(response.content).toBe('Success');
            expect(mockGenerateContent).toHaveBeenCalledTimes(3);
        });
    });
    describe('streamRequest', () => {
        it('should handle streaming response', async () => {
            const mockStream = [
                {
                    text: () => 'Hello',
                    candidates: [{ finishReason: undefined }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 0,
                        totalTokenCount: 10,
                    },
                },
                {
                    text: () => ' world',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            ];
            mockGenerateContentStream.mockResolvedValueOnce({
                stream: {
                    [Symbol.asyncIterator]: async function* () {
                        for (const chunk of mockStream) {
                            yield chunk;
                        }
                    },
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
        it('should handle streaming errors', async () => {
            const streamError = new Error('500 Server error');
            mockGenerateContentStream.mockRejectedValueOnce(streamError);
            await expect(provider.streamRequest({
                messages: [{ role: 'user', content: 'Test' }],
            }, () => { })).rejects.toThrow(ProviderNetworkError);
        });
    });
    describe('healthCheck', () => {
        it('should return healthy status on success', async () => {
            const mockResponse = {
                response: {
                    text: () => 'pong',
                    candidates: [{ finishReason: 'STOP' }],
                    usageMetadata: {
                        promptTokenCount: 1,
                        candidatesTokenCount: 1,
                        totalTokenCount: 2,
                    },
                },
            };
            mockGenerateContent.mockResolvedValueOnce(mockResponse);
            const health = await provider.healthCheck();
            expect(health.available).toBe(true);
            expect(health.latency).toBeGreaterThanOrEqual(0);
            expect(health.errorRate).toBe(0);
            expect(health.lastError).toBeUndefined();
        });
        it('should return unhealthy status on error', async () => {
            const apiError = new Error('Service down');
            mockGenerateContent.mockRejectedValueOnce(apiError);
            const health = await provider.healthCheck();
            expect(health.available).toBe(false);
            expect(health.errorRate).toBe(1.0);
            expect(health.lastError).toBeDefined();
        });
    });
    describe('getAvailableModels', () => {
        it('should return list of Gemini models', async () => {
            const models = await provider.getAvailableModels();
            expect(models).toContain(GEMINI_MODELS['gemini-2.0-flash-exp']);
            expect(models).toContain(GEMINI_MODELS['gemini-1.5-pro']);
            expect(models).toContain(GEMINI_MODELS['gemini-1.5-flash']);
        });
    });
    describe('validateConfig', () => {
        it('should validate enabled provider with API key', async () => {
            const result = await provider.validateConfig();
            expect(result).toBe(true);
        });
        it('should return false for disabled provider', async () => {
            const disabledProvider = new GeminiProvider({
                enabled: false,
                apiKey: 'test-key',
            });
            const result = await disabledProvider.validateConfig();
            expect(result).toBe(false);
        });
        it('should throw error if no API key', async () => {
            const noKeyProvider = new GeminiProvider({
                enabled: true,
            });
            await expect(noKeyProvider.validateConfig()).rejects.toThrow(ProviderAuthError);
        });
    });
    describe('createGeminiProvider', () => {
        it('should create provider with factory function', () => {
            process.env.GOOGLE_API_KEY = 'env-key';
            const provider = createGeminiProvider();
            expect(provider).toBeInstanceOf(GeminiProvider);
            expect(provider.config.enabled).toBe(true);
            delete process.env.GOOGLE_API_KEY;
        });
        it('should merge custom config', () => {
            const provider = createGeminiProvider({
                apiKey: 'custom-key',
                timeout: 30000,
            });
            expect(provider.config.apiKey).toBe('custom-key');
            expect(provider.config.timeout).toBe(30000);
        });
    });
});
//# sourceMappingURL=GeminiProvider.test.js.map