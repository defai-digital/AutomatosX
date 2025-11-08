/**
 * TelemetryServiceIntegration.test.ts
 *
 * End-to-end integration tests for the remote telemetry submission pipeline.
 * Validates queueing, background submission, rate limiting, retries, and resilience.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { unlinkSync } from 'fs';
import path from 'path';
import { initializeTelemetryService } from '../TelemetryService.js';
import { TelemetryDAO } from '../../database/dao/TelemetryDAO.js';
import { runMigrations } from '../../database/migrations.js';
import * as connection from '../../database/connection.js';
import { RetryManager } from '../RetryManager.js';
describe('TelemetryService remote integration', () => {
    let dbPath;
    let db;
    let dao;
    let service;
    let fetchMock;
    const submissionConfig = {
        endpoint: 'https://telemetry.integration.test/api/events',
        apiKey: 'integration-test-key',
        timeout: 120000,
        maxRetries: 3,
    };
    const queueCount = () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM telemetry_queue').get();
        return row.count;
    };
    const getQueueRows = () => {
        return db
            .prepare('SELECT id, event_id, retry_count, next_retry_at as nextRetryAt, last_error as lastError FROM telemetry_queue ORDER BY id')
            .all();
    };
    const getQueueEntry = () => {
        return db
            .prepare('SELECT id, event_id, retry_count as retryCount, next_retry_at as nextRetryAt, last_error as lastError FROM telemetry_queue LIMIT 1')
            .get();
    };
    const trackSampleEvent = async (command = 'index') => {
        await service.trackCommand(command, ['--scan'], 25, 0);
    };
    beforeEach(async () => {
        const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        dbPath = path.join(process.cwd(), `.telemetry-int-${uniqueSuffix}.db`);
        db = new Database(dbPath);
        runMigrations(db);
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock;
        vi.spyOn(connection, 'getDatabase').mockReturnValue(db);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        dao = new TelemetryDAO(db);
        service = initializeTelemetryService(dao, submissionConfig);
        await service.enable(true);
    });
    afterEach(() => {
        service?.stopBackgroundSubmission?.();
        vi.useRealTimers();
        vi.restoreAllMocks();
        try {
            db.close();
        }
        catch (error) { }
        try {
            unlinkSync(dbPath);
        }
        catch (error) { }
    });
    it('enqueues tracked events for remote submission', async () => {
        await trackSampleEvent();
        expect(queueCount()).toBe(1);
    });
    it('forceSubmission sends events and clears queue on success', async () => {
        await trackSampleEvent();
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 1,
                rejected: 0,
            }),
        });
        const result = await service.forceSubmission();
        expect(result?.success).toBe(true);
        expect(queueCount()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it('submissions include correct payload and headers', async () => {
        await trackSampleEvent('lint');
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 1,
                rejected: 0,
            }),
        });
        await service.forceSubmission();
        const [url, options] = fetchMock.mock.calls[0];
        const payload = JSON.parse(options.body);
        expect(url).toBe(submissionConfig.endpoint);
        expect(options.headers['X-API-Key']).toBe(submissionConfig.apiKey);
        expect(payload.events[0].eventType).toBe('command_executed');
        expect(payload.events[0].eventData.command).toBe('lint');
    });
    it('forceSubmission returns null when no events are queued', async () => {
        expect(await service.forceSubmission()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('background timer flushes queue automatically', async () => {
        await trackSampleEvent('background-run');
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 1,
                rejected: 0,
            }),
        });
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(queueCount()).toBe(0);
    });
    it('rate limiter stops submissions when tokens are unavailable', async () => {
        await trackSampleEvent();
        const limiterStub = {
            canSubmit: vi.fn().mockReturnValue(false),
            getWaitTime: vi.fn().mockReturnValue(5000),
            consume: vi.fn().mockReturnValue(false),
        };
        service.rateLimiter = limiterStub;
        const result = await service.forceSubmission();
        expect(result).toBeNull();
        expect(queueCount()).toBe(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('failed HTTP response schedules retry with metadata', async () => {
        await trackSampleEvent();
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'server exploded',
        });
        await service.forceSubmission();
        const entry = getQueueEntry();
        expect(entry.retryCount).toBe(1);
        expect(entry.nextRetryAt).toBeGreaterThan(Date.now());
        expect(entry.lastError).toContain('HTTP 500');
    });
    it('events retry successfully after waiting past nextRetryAt', async () => {
        await trackSampleEvent('retry-success');
        fetchMock
            .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: async () => 'temporary outage',
        })
            .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 1,
                rejected: 0,
            }),
        });
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        await service.forceSubmission();
        const entry = getQueueEntry();
        vi.setSystemTime(entry.nextRetryAt + 10);
        await service.forceSubmission();
        expect(queueCount()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        randomSpy.mockRestore();
    });
    it('events are dropped when retry budget is exhausted', async () => {
        await trackSampleEvent('drop-after-retries');
        const queue = service.queue;
        queue.retryManager = new RetryManager({ maxRetries: 1, baseDelay: 1, jitterFactor: 0 });
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'fail',
            text: async () => 'fatal',
        });
        await service.forceSubmission();
        expect(queueCount()).toBe(0);
    });
    it('queue stats distinguish pending versus retrying entries', async () => {
        await trackSampleEvent('first');
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            text: async () => 'bad gateway',
        });
        await service.forceSubmission();
        await trackSampleEvent('second');
        const stats = service.getQueueStats();
        expect(stats?.pending).toBe(1);
        expect(stats?.retrying).toBe(1);
        expect(stats?.total).toBe(2);
        expect(stats?.oldestQueuedAt).toBeDefined();
    });
    it('clearQueue removes pending events and reports total removed', async () => {
        await trackSampleEvent('first-clear');
        await trackSampleEvent('second-clear');
        const removed = service.clearQueue();
        expect(removed).toBe(2);
        expect(queueCount()).toBe(0);
    });
    it('clearQueue returns zero when nothing is queued', () => {
        expect(service.clearQueue()).toBe(0);
    });
    it('submission client exceptions keep events queued for later processing', async () => {
        await trackSampleEvent();
        service.submissionClient.submitBatch = vi.fn().mockRejectedValue(new Error('boom'));
        const result = await service.forceSubmission();
        expect(result?.success).toBe(false);
        expect(queueCount()).toBe(1);
    });
    it('queued events persist across service reinitialization', async () => {
        await trackSampleEvent('persist-me');
        const refreshed = initializeTelemetryService(dao, submissionConfig);
        service.stopBackgroundSubmission?.();
        service = refreshed;
        await service.enable(true);
        const stats = service.getQueueStats();
        expect(stats?.pending).toBe(1);
    });
    it('submissions are limited to 10 events per batch', async () => {
        for (let i = 0; i < 12; i += 1) {
            await trackSampleEvent(`batch-${i}`);
        }
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 10,
                rejected: 0,
            }),
        });
        await service.forceSubmission();
        const [_, options] = fetchMock.mock.calls[0];
        const payload = JSON.parse(options.body);
        expect(payload.events).toHaveLength(10);
        expect(queueCount()).toBe(2);
    });
    it('network rejection records error and retains queue entry', async () => {
        await trackSampleEvent('offline');
        fetchMock.mockRejectedValueOnce(new Error('network down'));
        const result = await service.forceSubmission();
        const entry = getQueueEntry();
        expect(result?.success).toBe(false);
        expect(entry.lastError).toContain('network down');
        expect(queueCount()).toBe(1);
    });
    it('retry count increments after consecutive failures', async () => {
        await trackSampleEvent('retry-loop');
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Error',
            text: async () => 'fail',
        });
        await service.forceSubmission();
        let entry = getQueueEntry();
        vi.setSystemTime(entry.nextRetryAt + 5);
        await service.forceSubmission();
        entry = getQueueEntry();
        expect(entry.retryCount).toBe(2);
    });
    it('rate limiter allows submission after initial denial', async () => {
        await trackSampleEvent('throttle');
        const limiterStub = {
            canSubmit: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
            getWaitTime: vi.fn().mockReturnValue(2000),
            consume: vi.fn().mockReturnValue(true),
        };
        service.rateLimiter = limiterStub;
        expect(await service.forceSubmission()).toBeNull();
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                accepted: 1,
                rejected: 0,
            }),
        });
        const result = await service.forceSubmission();
        expect(result?.success).toBe(true);
        expect(queueCount()).toBe(0);
    });
    it('clearQueue removes entries even when waiting for retry', async () => {
        await trackSampleEvent('stuck-entry');
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: async () => 'slow down',
        });
        await service.forceSubmission();
        const removed = service.clearQueue();
        expect(removed).toBe(1);
        expect(queueCount()).toBe(0);
    });
    it('forceSubmission after disabling remote returns null but preserves queue', async () => {
        await trackSampleEvent('offline-mode');
        await service.disable();
        const result = await service.forceSubmission();
        expect(result).toBeNull();
        const entries = db
            .prepare('SELECT COUNT(*) as count FROM telemetry_queue')
            .get();
        expect(entries.count).toBe(1);
    });
});
//# sourceMappingURL=TelemetryServiceIntegration.test.js.map