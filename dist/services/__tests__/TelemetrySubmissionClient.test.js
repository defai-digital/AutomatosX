/**
 * TelemetrySubmissionClient.test.ts
 *
 * Tests for remote telemetry submission client
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetrySubmissionClient } from '../TelemetrySubmissionClient.js';
describe('TelemetrySubmissionClient', () => {
    let client;
    let mockFetch;
    const testConfig = {
        endpoint: 'https://telemetry.example.com/api/events',
        apiKey: 'test-api-key-12345',
        timeout: 30000,
        maxRetries: 3,
    };
    beforeEach(() => {
        // Mock global fetch
        mockFetch = vi.fn();
        global.fetch = mockFetch;
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('constructor', () => {
        it('should create client with valid config', () => {
            client = new TelemetrySubmissionClient(testConfig);
            expect(client).toBeInstanceOf(TelemetrySubmissionClient);
            expect(client.getEndpoint()).toBe(testConfig.endpoint);
            expect(client.getTimeout()).toBe(testConfig.timeout);
            expect(client.hasApiKey()).toBe(true);
        });
        it('should create client without API key', () => {
            const configWithoutKey = { ...testConfig, apiKey: undefined };
            client = new TelemetrySubmissionClient(configWithoutKey);
            expect(client.hasApiKey()).toBe(false);
        });
        it('should apply default timeout if not provided', () => {
            const configWithoutTimeout = {
                endpoint: 'https://telemetry.example.com/api/events',
            };
            client = new TelemetrySubmissionClient(configWithoutTimeout);
            expect(client.getTimeout()).toBe(30000); // Default
        });
        it('should throw error for non-HTTPS endpoint (not localhost)', () => {
            const httpConfig = {
                ...testConfig,
                endpoint: 'http://telemetry.example.com/api/events',
            };
            expect(() => new TelemetrySubmissionClient(httpConfig)).toThrow('Telemetry endpoint must use HTTPS for security');
        });
        it('should allow HTTP for localhost', () => {
            const localhostConfig = {
                ...testConfig,
                endpoint: 'http://localhost:3000/api/events',
            };
            expect(() => new TelemetrySubmissionClient(localhostConfig)).not.toThrow();
        });
        it('should allow HTTP for 127.0.0.1', () => {
            const localhostConfig = {
                ...testConfig,
                endpoint: 'http://127.0.0.1:3000/api/events',
            };
            expect(() => new TelemetrySubmissionClient(localhostConfig)).not.toThrow();
        });
        it('should throw error for invalid URL', () => {
            const invalidConfig = {
                ...testConfig,
                endpoint: 'not-a-url',
            };
            expect(() => new TelemetrySubmissionClient(invalidConfig)).toThrow();
        });
        it('should throw error for negative timeout', () => {
            const invalidConfig = {
                ...testConfig,
                timeout: -1000,
            };
            expect(() => new TelemetrySubmissionClient(invalidConfig)).toThrow();
        });
        it('should throw error for negative maxRetries', () => {
            const invalidConfig = {
                ...testConfig,
                maxRetries: -1,
            };
            expect(() => new TelemetrySubmissionClient(invalidConfig)).toThrow();
        });
    });
    describe('submitBatch', () => {
        beforeEach(() => {
            client = new TelemetrySubmissionClient(testConfig);
        });
        it('should successfully submit batch of events', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: { command: 'find', duration: 100 },
                    timestamp: Date.now(),
                },
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'query_performed',
                    eventData: { queryType: 'text', query: 'test', resultCount: 5, duration: 50, cached: false },
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    accepted: 2,
                    rejected: 0,
                }),
            });
            const result = await client.submitBatch(events);
            expect(result.success).toBe(true);
            expect(result.accepted).toBe(2);
            expect(result.rejected).toBe(0);
            // Verify fetch was called correctly
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(testConfig.endpoint, expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'User-Agent': 'AutomatosX-Telemetry/2.0',
                    'X-API-Key': testConfig.apiKey,
                }),
                body: JSON.stringify({ events }),
            }));
        });
        it('should handle empty events array', async () => {
            const result = await client.submitBatch([]);
            expect(result.success).toBe(true);
            expect(result.accepted).toBe(0);
            expect(result.rejected).toBe(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });
        it('should omit API key header if not configured', async () => {
            const clientWithoutKey = new TelemetrySubmissionClient({
                ...testConfig,
                apiKey: undefined,
            });
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: { command: 'find' },
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    accepted: 1,
                    rejected: 0,
                }),
            });
            await clientWithoutKey.submitBatch(events);
            const callArgs = mockFetch.mock.calls[0][1];
            expect(callArgs.headers['X-API-Key']).toBeUndefined();
        });
        it('should handle HTTP 500 error', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error details',
            });
            const result = await client.submitBatch(events);
            expect(result.success).toBe(false);
            expect(result.accepted).toBe(0);
            expect(result.rejected).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('HTTP 500');
        });
        it('should handle HTTP 401 Unauthorized', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => 'Invalid API key',
            });
            const result = await client.submitBatch(events);
            expect(result.success).toBe(false);
            expect(result.rejected).toBe(1);
            expect(result.errors[0]).toContain('401');
        });
        it('should handle timeout error', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
            ];
            const timeoutError = new Error('The operation was aborted');
            timeoutError.name = 'AbortError';
            mockFetch.mockRejectedValue(timeoutError);
            const result = await client.submitBatch(events);
            expect(result.success).toBe(false);
            expect(result.accepted).toBe(0);
            expect(result.rejected).toBe(1);
            expect(result.errors[0]).toContain('timeout');
        });
        it('should handle network error', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
            ];
            const networkError = new TypeError('fetch failed');
            mockFetch.mockRejectedValue(networkError);
            const result = await client.submitBatch(events);
            expect(result.success).toBe(false);
            expect(result.rejected).toBe(1);
            expect(result.errors[0]).toContain('Network error');
        });
        it('should handle invalid JSON response', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                },
            });
            const result = await client.submitBatch(events);
            expect(result.success).toBe(false);
            expect(result.rejected).toBe(1);
        });
        it('should handle partial success (some events rejected)', async () => {
            const events = [
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'command_executed',
                    eventData: {},
                    timestamp: Date.now(),
                },
                {
                    sessionId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'query_performed',
                    eventData: { queryType: 'text', query: 'test', resultCount: 0, duration: 10, cached: false },
                    timestamp: Date.now(),
                },
            ];
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    success: true,
                    accepted: 1,
                    rejected: 1,
                    errors: ['Event 2 has invalid data'],
                }),
            });
            const result = await client.submitBatch(events);
            expect(result.success).toBe(true);
            expect(result.accepted).toBe(1);
            expect(result.rejected).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });
    describe('ping', () => {
        beforeEach(() => {
            client = new TelemetrySubmissionClient(testConfig);
        });
        it('should return true if server is reachable', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
            });
            const isReachable = await client.ping();
            expect(isReachable).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith('https://telemetry.example.com/ping', expect.objectContaining({
                method: 'GET',
            }));
        });
        it('should return false if server returns non-200', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
            });
            const isReachable = await client.ping();
            expect(isReachable).toBe(false);
        });
        it('should return false on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            const isReachable = await client.ping();
            expect(isReachable).toBe(false);
        });
        it('should return false on timeout', async () => {
            const timeoutError = new Error('Timeout');
            timeoutError.name = 'AbortError';
            mockFetch.mockRejectedValue(timeoutError);
            const isReachable = await client.ping();
            expect(isReachable).toBe(false);
        });
    });
    describe('getServerInfo', () => {
        beforeEach(() => {
            client = new TelemetrySubmissionClient(testConfig);
        });
        it('should return server info on success', async () => {
            const serverInfo = {
                version: '2.0.0',
                status: 'healthy',
                acceptingEvents: true,
                maxBatchSize: 100,
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => serverInfo,
            });
            const result = await client.getServerInfo();
            expect(result).toEqual(serverInfo);
            expect(mockFetch).toHaveBeenCalledWith('https://telemetry.example.com/info', expect.objectContaining({
                method: 'GET',
            }));
        });
        it('should throw error if server returns non-200', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
            });
            await expect(client.getServerInfo()).rejects.toThrow('HTTP 503');
        });
        it('should throw error on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            await expect(client.getServerInfo()).rejects.toThrow('Failed to get server info');
        });
        it('should throw error on invalid response schema', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    // Missing required fields
                    version: '2.0.0',
                }),
            });
            await expect(client.getServerInfo()).rejects.toThrow();
        });
    });
    describe('utility methods', () => {
        it('getEndpoint should return configured endpoint', () => {
            client = new TelemetrySubmissionClient(testConfig);
            expect(client.getEndpoint()).toBe(testConfig.endpoint);
        });
        it('getTimeout should return configured timeout', () => {
            client = new TelemetrySubmissionClient(testConfig);
            expect(client.getTimeout()).toBe(testConfig.timeout);
        });
        it('hasApiKey should return true when key is set', () => {
            client = new TelemetrySubmissionClient(testConfig);
            expect(client.hasApiKey()).toBe(true);
        });
        it('hasApiKey should return false when key is not set', () => {
            const configWithoutKey = { ...testConfig, apiKey: undefined };
            client = new TelemetrySubmissionClient(configWithoutKey);
            expect(client.hasApiKey()).toBe(false);
        });
    });
});
//# sourceMappingURL=TelemetrySubmissionClient.test.js.map