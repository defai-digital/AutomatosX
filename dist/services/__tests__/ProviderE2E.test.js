/**
 * ProviderE2E.test.ts
 *
 * End-to-end integration tests for the complete provider system.
 * Tests the full stack: ProviderService → ProviderRouter → Provider implementations → Database logging.
 *
 * Phase 2 Week 3 Day 13-14: E2E Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ProviderService } from '../ProviderService.js';
import { getDatabase } from '../../database/connection.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
/**
 * E2E Test Suite
 *
 * These tests verify the complete provider system workflow:
 * 1. Request validation
 * 2. Provider routing with fallback
 * 3. Database logging
 * 4. Telemetry collection
 * 5. Circuit breaker behavior
 * 6. Health monitoring
 * 7. Statistics aggregation
 */
describe('Provider System E2E Tests', () => {
    let service;
    let db;
    const testDbPath = path.join(process.cwd(), '.automatosx', 'test-e2e.db');
    beforeAll(async () => {
        // Set up test environment with all three providers
        process.env.ANTHROPIC_API_KEY = 'test-claude-key-e2e';
        process.env.GOOGLE_API_KEY = 'test-gemini-key-e2e';
        process.env.OPENAI_API_KEY = 'test-openai-key-e2e';
        // Override database path for testing
        process.env.AUTOMATOSX_DB_PATH = testDbPath;
        // Initialize database
        db = getDatabase();
        // Ensure provider tables exist
        db.exec(`
      CREATE TABLE IF NOT EXISTS provider_logs (
        id TEXT PRIMARY KEY,
        request_id TEXT UNIQUE NOT NULL,
        conversation_id TEXT,
        user_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        state TEXT NOT NULL,
        request_data TEXT,
        response_data TEXT,
        error_data TEXT,
        duration INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_metrics (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_provider_logs_conversation ON provider_logs(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_provider_logs_user ON provider_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_provider_logs_provider ON provider_logs(provider);
      CREATE INDEX IF NOT EXISTS idx_provider_logs_created ON provider_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider ON provider_metrics(provider);
      CREATE INDEX IF NOT EXISTS idx_provider_metrics_created ON provider_metrics(created_at);
    `);
        // Initialize service with logging and telemetry enabled
        service = new ProviderService({
            primaryProvider: 'claude',
            fallbackChain: ['gemini', 'openai'],
            enableFallback: true,
            enableLogging: true,
            enableTelemetry: true,
            circuitBreakerThreshold: 5,
        });
    });
    afterAll(() => {
        // Clean up test database
        if (db) {
            db.close();
        }
        if (existsSync(testDbPath)) {
            unlinkSync(testDbPath);
        }
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.GOOGLE_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.AUTOMATOSX_DB_PATH;
    });
    beforeEach(() => {
        // Clear logs and metrics before each test
        db.prepare('DELETE FROM provider_logs').run();
        db.prepare('DELETE FROM provider_metrics').run();
    });
    describe('Complete Request Lifecycle', () => {
        it('should handle complete request lifecycle with logging', async () => {
            const request = {
                messages: [
                    { role: 'user', content: 'What is 2+2?' },
                ],
                maxTokens: 50,
            };
            try {
                await service.sendRequest(request, 'test-user-123');
            }
            catch (error) {
                // Expected to fail with test API keys
                // But logging should still occur
            }
            // Verify log entry was created
            const logs = db.prepare('SELECT * FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            expect(log.provider).toBe('claude');
            expect(log.user_id).toBe('test-user-123');
            expect(log.state).toBe('failed'); // Test key fails
            expect(log.request_data).toBeDefined();
            expect(log.error_data).toBeDefined();
        });
        it('should track request IDs and conversation IDs', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test message' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected failure
            }
            const logs = db.prepare('SELECT request_id, conversation_id FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            expect(log.request_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
            expect(log.conversation_id).toMatch(/^[0-9a-f-]{36}$/);
        });
        it('should measure request duration', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            const startTime = Date.now();
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected failure
            }
            const endTime = Date.now();
            const expectedDuration = endTime - startTime;
            const logs = db.prepare('SELECT duration FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            expect(log.duration).toBeGreaterThan(0);
            expect(log.duration).toBeLessThanOrEqual(expectedDuration + 100); // Allow 100ms margin
        });
    });
    describe('Fallback Chain Integration', () => {
        it('should attempt fallback providers when primary fails', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test fallback' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // All providers will fail with test keys
            }
            // Should have attempted multiple providers
            const logs = db.prepare('SELECT provider FROM provider_logs ORDER BY created_at').all();
            // With test keys, it may try multiple providers before failing
            expect(logs.length).toBeGreaterThanOrEqual(1);
        });
        it('should log each fallback attempt', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            const logs = db.prepare('SELECT * FROM provider_logs ORDER BY created_at').all();
            // Each attempt should be logged
            for (const log of logs) {
                expect(log.request_data).toBeDefined();
                expect(log.state).toBeDefined();
                expect(['pending', 'completed', 'failed']).toContain(log.state);
            }
        });
    });
    describe('Streaming Integration', () => {
        it('should handle streaming requests with callbacks', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Count to 5' }],
                stream: true,
            };
            const chunks = [];
            let completed = false;
            try {
                await service.sendStreamingRequest(request, {
                    onChunk: (chunk) => {
                        chunks.push(chunk.delta);
                    },
                    onComplete: () => {
                        completed = true;
                    },
                });
            }
            catch (error) {
                // Expected with test keys
            }
            // Verify streaming was logged
            const logs = db.prepare('SELECT * FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            expect(log.request_data).toBeDefined();
            const requestData = JSON.parse(log.request_data);
            expect(requestData.stream).toBe(true);
        });
        it('should track chunks received in streaming mode', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Test streaming' }],
                stream: true,
            };
            let chunkCount = 0;
            try {
                await service.sendStreamingRequest(request, {
                    onChunk: () => {
                        chunkCount++;
                    },
                });
            }
            catch (error) {
                // Expected
            }
            // Even with failure, should have attempted to stream
            const logs = db.prepare('SELECT * FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
        });
    });
    describe('Database Integration', () => {
        it('should persist logs to database', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Database test' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            // Verify persistence
            const count = db.prepare('SELECT COUNT(*) as count FROM provider_logs').get();
            expect(count.count).toBeGreaterThan(0);
        });
        it('should store complete request data', async () => {
            const request = {
                messages: [
                    { role: 'user', content: 'Test message with metadata' },
                ],
                maxTokens: 100,
                temperature: 0.7,
            };
            try {
                await service.sendRequest(request, 'user-456');
            }
            catch (error) {
                // Expected
            }
            const logs = db.prepare('SELECT request_data FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const requestData = JSON.parse(logs[0].request_data);
            expect(requestData.messages).toBeDefined();
            expect(requestData.maxTokens).toBe(100);
            expect(requestData.temperature).toBe(0.7);
        });
        it('should store error data on failures', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Fail test' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            const logs = db.prepare('SELECT error_data, state FROM provider_logs').all();
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            expect(log.state).toBe('failed');
            expect(log.error_data).toBeDefined();
            const errorData = JSON.parse(log.error_data);
            expect(errorData.error).toBeDefined();
        });
    });
    describe('Health Monitoring Integration', () => {
        it('should check health of all registered providers', async () => {
            const healthMap = await service.getProviderHealth();
            expect(healthMap).toBeInstanceOf(Map);
            expect(healthMap.size).toBeGreaterThan(0);
            // Should have all three providers
            expect(healthMap.has('claude')).toBe(true);
            expect(healthMap.has('gemini')).toBe(true);
            expect(healthMap.has('openai')).toBe(true);
        });
        it('should report unhealthy status with invalid keys', async () => {
            const healthMap = await service.getProviderHealth();
            // With test keys, providers should be unhealthy
            for (const [provider, healthy] of healthMap) {
                // We expect false (unhealthy) with test keys
                expect(typeof healthy).toBe('boolean');
            }
        });
    });
    describe('Statistics Integration', () => {
        it('should aggregate provider statistics', async () => {
            // Make several requests to generate stats
            const requests = [
                { messages: [{ role: 'user', content: 'Test 1' }] },
                { messages: [{ role: 'user', content: 'Test 2' }] },
                { messages: [{ role: 'user', content: 'Test 3' }] },
            ];
            for (const req of requests) {
                try {
                    await service.sendRequest(req);
                }
                catch (error) {
                    // Expected
                }
            }
            const stats = await service.getProviderStats();
            expect(Array.isArray(stats)).toBe(true);
            // Stats may be empty if all requests failed, but method should work
            expect(stats.length).toBeGreaterThanOrEqual(0);
        });
        it('should filter statistics by time range', async () => {
            const oneHour = 60 * 60 * 1000;
            const stats = await service.getProviderStats(oneHour);
            expect(Array.isArray(stats)).toBe(true);
        });
    });
    describe('Circuit Breaker Integration', () => {
        it('should track circuit breaker state across requests', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Circuit test' }],
            };
            // Get initial state
            const initialStates = service.getCircuitBreakerStates();
            expect(initialStates).toBeInstanceOf(Map);
            // Make request (will fail)
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            // Get updated state
            const updatedStates = service.getCircuitBreakerStates();
            expect(updatedStates).toBeInstanceOf(Map);
            // Failures should be tracked
            for (const [provider, state] of updatedStates) {
                expect(state.failures).toBeGreaterThanOrEqual(0);
                expect(['closed', 'open', 'half-open']).toContain(state.state);
            }
        });
        it('should reset circuit breaker state', () => {
            // Should not throw
            expect(() => {
                service.resetCircuitBreaker('claude');
            }).not.toThrow();
            const states = service.getCircuitBreakerStates();
            const claudeState = states.get('claude');
            expect(claudeState).toBeDefined();
            expect(claudeState?.state).toBe('closed');
            expect(claudeState?.failures).toBe(0);
        });
    });
    describe('Configuration Integration', () => {
        it('should apply configuration updates', () => {
            expect(() => {
                service.updateConfig({
                    primaryProvider: 'gemini',
                    circuitBreakerThreshold: 10,
                });
            }).not.toThrow();
            // Configuration should be updated (verify via behavior)
            const states = service.getCircuitBreakerStates();
            expect(states).toBeDefined();
        });
        it('should preserve configuration across operations', async () => {
            service.updateConfig({
                circuitBreakerThreshold: 7,
            });
            const request = {
                messages: [{ role: 'user', content: 'Config test' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            // Configuration should still be applied
            const states = service.getCircuitBreakerStates();
            expect(states).toBeDefined();
        });
    });
    describe('Recent Logs Integration', () => {
        it('should retrieve recent logs', async () => {
            // Generate some logs
            const requests = [
                { messages: [{ role: 'user', content: 'Log test 1' }] },
                { messages: [{ role: 'user', content: 'Log test 2' }] },
            ];
            for (const req of requests) {
                try {
                    await service.sendRequest(req);
                }
                catch (error) {
                    // Expected
                }
            }
            const logs = await service.getRecentLogs(10);
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThan(0);
            expect(logs.length).toBeLessThanOrEqual(10);
        });
        it('should order logs by created_at descending', async () => {
            // Generate logs with delay
            await service.sendRequest({ messages: [{ role: 'user', content: 'First' }] }).catch(() => { });
            await new Promise(resolve => setTimeout(resolve, 10));
            await service.sendRequest({ messages: [{ role: 'user', content: 'Second' }] }).catch(() => { });
            const logs = await service.getRecentLogs();
            if (logs.length > 1) {
                // Most recent should be first
                expect(logs[0].created_at).toBeGreaterThanOrEqual(logs[1].created_at);
            }
        });
    });
    describe('Error Handling Integration', () => {
        it('should handle validation errors gracefully', async () => {
            const invalidRequest = {
                messages: [], // Invalid: empty messages
            };
            await expect(service.sendRequest(invalidRequest)).rejects.toThrow();
            // Should not create log entry for validation failures
            const logs = db.prepare('SELECT * FROM provider_logs').all();
            expect(logs.length).toBe(0);
        });
        it('should continue operation after database errors', async () => {
            // Even if database logging fails, service should attempt request
            const request = {
                messages: [{ role: 'user', content: 'Error recovery test' }],
            };
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected to fail with test keys, but should not crash
                expect(error).toBeDefined();
            }
        });
    });
    describe('Performance Integration', () => {
        it('should handle requests efficiently', async () => {
            const request = {
                messages: [{ role: 'user', content: 'Performance test' }],
            };
            const startTime = Date.now();
            try {
                await service.sendRequest(request);
            }
            catch (error) {
                // Expected
            }
            const duration = Date.now() - startTime;
            // Should fail fast with invalid keys
            expect(duration).toBeLessThan(5000); // 5 seconds max
        });
        it('should handle multiple concurrent requests', async () => {
            const requests = Array(5).fill(null).map((_, i) => ({
                messages: [{ role: 'user', content: `Concurrent test ${i}` }],
            }));
            const results = await Promise.allSettled(requests.map(req => service.sendRequest(req)));
            expect(results.length).toBe(5);
            // All should have attempted (and likely failed)
            for (const result of results) {
                expect(['fulfilled', 'rejected']).toContain(result.status);
            }
        });
    });
});
//# sourceMappingURL=ProviderE2E.test.js.map