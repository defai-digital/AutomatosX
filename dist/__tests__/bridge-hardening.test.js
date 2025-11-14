// Sprint 2 Day 15: Bridge Hardening Test Suite
// Regression tests for CLI bridge components
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceProfiler } from '../utils/PerformanceProfiler.js';
import { RunCommandSchema } from '../cli/schemas/RunCommandSchema.js';
import { MemorySearchSchema } from '../cli/schemas/MemorySearchSchema.js';
import { ListAgentsSchema } from '../cli/schemas/ListAgentsSchema.js';
import { StatusSchema } from '../cli/schemas/StatusSchema.js';
import { ConfigShowSchema } from '../cli/schemas/ConfigShowSchema.js';
import { createErrorEnvelope, ErrorCodes } from '../utils/ErrorEnvelope.js';
import { StreamingLogger } from '../utils/StreamingLogger.js';
// ============================================================================
// Performance Tests
// ============================================================================
describe('Bridge Performance', () => {
    let profiler;
    beforeEach(() => {
        profiler = new PerformanceProfiler({ targetOverhead: 10 });
    });
    it('should validate schemas within 10ms overhead', () => {
        const validInput = {
            agent: 'backend',
            task: 'Test task',
            verbose: false,
            debug: false,
            json: false,
        };
        profiler.measure('schema-validation', () => {
            RunCommandSchema.parse(validInput);
        });
        const profile = profiler.getProfile();
        expect(profile.overhead).toBeLessThan(10);
        expect(profile.passes).toBe(true);
    });
    it('should handle multiple validations efficiently', () => {
        const inputs = [
            { agent: 'backend', task: 'Task 1' },
            { agent: 'frontend', task: 'Task 2' },
            { agent: 'devops', task: 'Task 3' },
        ];
        profiler.start('batch-validation');
        inputs.forEach(input => RunCommandSchema.parse(input));
        profiler.end('batch-validation');
        const measurement = profiler.getMeasurement('batch-validation');
        expect(measurement).toBeDefined();
        expect(measurement.duration).toBeLessThan(30); // 3 validations < 30ms
    });
    it('should track overhead statistics', () => {
        for (let i = 0; i < 10; i++) {
            profiler.measure(`validation-${i}`, () => {
                RunCommandSchema.parse({ agent: 'backend', task: `Task ${i}` });
            });
        }
        const stats = profiler.getStatistics();
        expect(stats.count).toBe(10);
        expect(stats.mean).toBeGreaterThan(0);
        expect(stats.p95).toBeLessThan(10);
    });
    it('should measure async operations', async () => {
        const result = await profiler.measureAsync('async-operation', async () => {
            return new Promise(resolve => setTimeout(() => resolve('done'), 10));
        });
        expect(result).toBe('done');
        const measurement = profiler.getMeasurement('async-operation');
        expect(measurement).toBeDefined();
        expect(measurement.duration).toBeGreaterThanOrEqual(10);
    });
    it('should export performance profile', () => {
        profiler.measure('test', () => {
            RunCommandSchema.parse({ agent: 'backend', task: 'Test' });
        });
        const exported = profiler.export();
        const parsed = JSON.parse(exported);
        expect(parsed.profile).toBeDefined();
        expect(parsed.statistics).toBeDefined();
        expect(parsed.timestamp).toBeDefined();
    });
});
// ============================================================================
// Schema Regression Tests
// ============================================================================
describe('Schema Regression', () => {
    describe('RunCommandSchema', () => {
        it('should accept valid minimal input', () => {
            const result = RunCommandSchema.parse({
                agent: 'backend',
                task: 'Implement feature',
            });
            expect(result.agent).toBe('backend');
            expect(result.task).toBe('Implement feature');
            expect(result.streaming).toBe(false);
            expect(result.parallel).toBe(false);
        });
        it('should accept all optional fields', () => {
            const result = RunCommandSchema.parse({
                agent: 'backend',
                task: 'Test',
                streaming: true,
                parallel: true,
                resumable: true,
                provider: 'claude',
                timeout: 60000,
                useMemory: true,
                memoryLimit: 20,
                maxRetries: 5,
                verbose: true,
                debug: true,
                json: true,
            });
            expect(result.streaming).toBe(true);
            expect(result.parallel).toBe(true);
            expect(result.resumable).toBe(true);
            expect(result.provider).toBe('claude');
        });
        it('should reject invalid agent name', () => {
            expect(() => RunCommandSchema.parse({
                agent: 'InvalidAgent', // Uppercase not allowed
                task: 'Test',
            })).toThrow();
        });
        it('should reject empty task', () => {
            expect(() => RunCommandSchema.parse({
                agent: 'backend',
                task: '',
            })).toThrow();
        });
        it('should cap timeout at maximum', () => {
            const result = RunCommandSchema.parse({
                agent: 'backend',
                task: 'Test',
                timeout: 9999999, // Should be capped
            });
            expect(result.timeout).toBeLessThanOrEqual(1800000);
        });
    });
    describe('MemorySearchSchema', () => {
        it('should accept search query', () => {
            const result = MemorySearchSchema.parse({
                query: 'authentication',
            });
            expect(result.query).toBe('authentication');
            expect(result.limit).toBe(10);
            expect(result.exactMatch).toBe(false);
        });
        it('should accept filters', () => {
            const result = MemorySearchSchema.parse({
                query: 'test',
                agent: 'backend',
                tags: ['api', 'auth'],
                after: '2025-01-01',
                before: '2025-01-31',
            });
            expect(result.agent).toBe('backend');
            expect(result.tags).toEqual(['api', 'auth']);
            expect(result.after).toBe('2025-01-01');
        });
        it('should reject invalid date format', () => {
            expect(() => MemorySearchSchema.parse({
                query: 'test',
                after: 'invalid-date',
            })).toThrow();
        });
    });
    describe('ListAgentsSchema', () => {
        it('should accept category filter', () => {
            const result = ListAgentsSchema.parse({
                category: 'development',
            });
            expect(result.category).toBe('development');
        });
        it('should accept sort options', () => {
            const result = ListAgentsSchema.parse({
                sort: 'name',
                enabled: true,
            });
            expect(result.sort).toBe('name');
            expect(result.enabled).toBe(true);
        });
        it('should reject invalid category', () => {
            expect(() => ListAgentsSchema.parse({
                category: 'invalid-category',
            })).toThrow();
        });
    });
    describe('StatusSchema', () => {
        it('should enable all health checks by default', () => {
            const result = StatusSchema.parse({});
            expect(result.memory).toBe(true);
            expect(result.providers).toBe(true);
            expect(result.agents).toBe(true);
        });
        it('should allow selective health checks', () => {
            const result = StatusSchema.parse({
                memory: true,
                providers: false,
                agents: false,
            });
            expect(result.memory).toBe(true);
            expect(result.providers).toBe(false);
            expect(result.agents).toBe(false);
        });
    });
    describe('ConfigShowSchema', () => {
        it('should accept key path', () => {
            const result = ConfigShowSchema.parse({
                key: 'providers.claude.enabled',
            });
            expect(result.key).toBe('providers.claude.enabled');
        });
        it('should accept category filter', () => {
            const result = ConfigShowSchema.parse({
                category: 'providers',
            });
            expect(result.category).toBe('providers');
        });
        it('should reject invalid category', () => {
            expect(() => ConfigShowSchema.parse({
                category: 'invalid',
            })).toThrow();
        });
    });
});
// ============================================================================
// Error Handling Regression
// ============================================================================
describe('Error Handling Regression', () => {
    it('should create error envelope with all fields', () => {
        const envelope = createErrorEnvelope(ErrorCodes.VALIDATION_ERROR, 'Invalid input', {
            details: { field: 'agent', value: 'InvalidAgent' },
            suggestions: ['Use lowercase agent names'],
            stackTrace: 'Error stack trace',
            requestId: 'req-123',
        });
        expect(envelope.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(envelope.error.message).toBe('Invalid input');
        expect(envelope.error.details).toBeDefined();
        expect(envelope.error.suggestions).toContain('Use lowercase agent names');
        expect(envelope.timestamp).toBeDefined();
        expect(envelope.requestId).toBe('req-123');
    });
    it('should handle all error codes', () => {
        const codes = Object.values(ErrorCodes);
        codes.forEach(code => {
            const envelope = createErrorEnvelope(code, `Test error for ${code}`);
            expect(envelope.error.code).toBe(code);
        });
    });
    it('should create minimal error envelope', () => {
        const envelope = createErrorEnvelope(ErrorCodes.AGENT_NOT_FOUND, 'Agent not found');
        expect(envelope.error.code).toBe(ErrorCodes.AGENT_NOT_FOUND);
        expect(envelope.error.details).toBeUndefined();
        expect(envelope.error.suggestions).toBeUndefined();
    });
});
// ============================================================================
// Logging Regression
// ============================================================================
describe('Logging Regression', () => {
    let logger;
    let logEvents;
    beforeEach(() => {
        logger = new StreamingLogger({ minLevel: 'debug' });
        logEvents = [];
        logger.on('log', (event) => logEvents.push(event));
    });
    afterEach(() => {
        logger.removeAllListeners();
    });
    it('should emit log events', () => {
        logger.info('Test message');
        expect(logEvents.length).toBe(1);
        expect(logEvents[0].level).toBe('info');
        expect(logEvents[0].message).toBe('Test message');
    });
    it('should track all log levels', () => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.success('Success message');
        logger.warn('Warning message');
        logger.error('Error message');
        expect(logEvents.length).toBe(5);
        expect(logEvents.map(e => e.level)).toEqual(['debug', 'info', 'success', 'warn', 'error']);
    });
    it('should include metadata', () => {
        logger.info('Test', { userId: 123, action: 'login' });
        expect(logEvents[0].metadata).toEqual({ userId: 123, action: 'login' });
    });
    it('should respect min level', () => {
        const warnLogger = new StreamingLogger({ minLevel: 'warn' });
        const events = [];
        warnLogger.on('log', (event) => events.push(event));
        warnLogger.debug('Should not log');
        warnLogger.info('Should not log');
        warnLogger.warn('Should log');
        warnLogger.error('Should log');
        expect(events.length).toBe(2);
        expect(events[0].level).toBe('warn');
        expect(events[1].level).toBe('error');
    });
    it('should buffer events', () => {
        logger.info('Message 1');
        logger.info('Message 2');
        logger.info('Message 3');
        const buffer = logger.getBuffer();
        expect(buffer.length).toBe(3);
    });
    it('should clear buffer', () => {
        logger.info('Message 1');
        logger.info('Message 2');
        logger.clearBuffer();
        const buffer = logger.getBuffer();
        expect(buffer.length).toBe(0);
    });
});
// ============================================================================
// Integration Tests
// ============================================================================
describe('Bridge Integration', () => {
    it('should handle validation -> logging -> success flow', () => {
        const profiler = new PerformanceProfiler();
        const logger = new StreamingLogger();
        const events = [];
        logger.on('log', (event) => events.push(event));
        profiler.measure('full-flow', () => {
            logger.info('Starting validation');
            const result = RunCommandSchema.parse({
                agent: 'backend',
                task: 'Test task',
            });
            logger.success('Validation complete');
            return result;
        });
        expect(events.length).toBe(2);
        expect(events[0].level).toBe('info');
        expect(events[1].level).toBe('success');
        const profile = profiler.getProfile();
        expect(profile.passes).toBe(true);
    });
    it('should handle validation -> error flow', () => {
        const logger = new StreamingLogger();
        const events = [];
        logger.on('log', (event) => events.push(event));
        logger.info('Starting validation');
        try {
            RunCommandSchema.parse({ agent: 'InvalidAgent', task: 'Test' });
        }
        catch (error) {
            logger.error('Validation failed', { error: error instanceof Error ? error.message : 'Unknown' });
        }
        expect(events.length).toBe(2);
        expect(events[0].level).toBe('info');
        expect(events[1].level).toBe('error');
    });
    it('should maintain performance under load', () => {
        const profiler = new PerformanceProfiler({ targetOverhead: 100 });
        for (let i = 0; i < 100; i++) {
            profiler.measure(`iteration-${i}`, () => {
                RunCommandSchema.parse({
                    agent: 'backend',
                    task: `Task ${i}`,
                });
            });
        }
        const stats = profiler.getStatistics();
        expect(stats.count).toBe(100);
        expect(stats.p95).toBeLessThan(10); // Each validation < 10ms at P95
    });
});
//# sourceMappingURL=bridge-hardening.test.js.map