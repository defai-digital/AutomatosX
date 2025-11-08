/**
 * TelemetryService.test.ts
 * Tests for TelemetryService business logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TelemetryService, initializeTelemetryService } from '../TelemetryService.js';
import { TelemetryDAO } from '../../database/dao/TelemetryDAO.js';
import { runMigrations } from '../../database/migrations.js';
import { unlinkSync } from 'fs';

describe('TelemetryService', () => {
  let db: Database.Database;
  let dao: TelemetryDAO;
  let service: TelemetryService;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = `./test-telemetry-service-${Date.now()}-${Math.random()}.db`;
    db = new Database(testDbPath);
    runMigrations(db);
    dao = new TelemetryDAO(db);
    service = initializeTelemetryService(dao);
    await service.initialize();
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch (e) {}
  });

  describe('initialization', () => {
    it('should initialize with disabled telemetry by default', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should load configuration from database', async () => {
      await dao.saveConfig({
        enabled: true,
        remote: false,
        sessionId: 'test-session',
      });

      const newService = initializeTelemetryService(dao);
      await newService.initialize();

      expect(newService.isEnabled()).toBe(true);
    });

    it('should generate unique session ID', () => {
      const sessionId = service.getSessionId();
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(0);
    });
  });

  describe('enable/disable', () => {
    it('should enable telemetry', async () => {
      await service.enable(false);

      expect(service.isEnabled()).toBe(true);

      const config = dao.getConfig();
      expect(config?.enabled).toBe(true);
      expect(config?.remote).toBe(false);
      expect(config?.consentDate).toBeDefined();
    });

    it('should enable telemetry with remote submission', async () => {
      await service.enable(true);

      const config = dao.getConfig();
      expect(config?.remote).toBe(true);
    });

    it('should disable telemetry', async () => {
      await service.enable();
      await service.disable();

      expect(service.isEnabled()).toBe(false);

      const config = dao.getConfig();
      expect(config?.enabled).toBe(false);
      expect(config?.optOutDate).toBeDefined();
    });
  });

  describe('trackCommand', () => {
    it('should not track when disabled', async () => {
      await service.trackCommand('find', ['test'], 100, 0);

      const events = dao.getEvents();
      expect(events.length).toBe(0);
    });

    it('should track command when enabled', async () => {
      await service.enable();

      await service.trackCommand('find', ['test'], 100, 0);

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('command_executed');
    });

    it('should track command with error', async () => {
      await service.enable();

      await service.trackCommand('find', ['test'], 100, 1, 'Not found');

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.exitCode).toBe(1);
      expect(eventData?.error).toBe('Not found');
    });

    it('should handle tracking failure silently', async () => {
      await service.enable();

      // Close database to cause failure
      db.close();

      // Should not throw
      await expect(service.trackCommand('find', ['test'], 100, 0)).resolves.toBeUndefined();
    });
  });

  describe('trackQuery', () => {
    it('should track query performance', async () => {
      await service.enable();

      await service.trackQuery('symbol', 'MyClass', 5, 50, false, 'typescript');

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('query_performed');

      const eventData = events[0].eventData as any;
      expect(eventData?.queryType).toBe('symbol');
      expect(eventData?.resultCount).toBe(5);
      expect(eventData?.duration).toBe(50);
      expect(eventData?.cached).toBe(false);
      expect(eventData?.language).toBe('typescript');
    });

    it('should truncate long queries to 100 chars', async () => {
      await service.enable();

      const longQuery = 'x'.repeat(200);
      await service.trackQuery('text', longQuery, 10, 100, false);

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.query.length).toBe(100);
    });
  });

  describe('trackParser', () => {
    it('should track parser invocation', async () => {
      await service.enable();

      await service.trackParser('typescript', '.ts', 50, 100, 500);

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('parser_invoked');

      const eventData = events[0].eventData as any;
      expect(eventData?.language).toBe('typescript');
      expect(eventData?.fileExtension).toBe('.ts');
      expect(eventData?.duration).toBe(50);
      expect(eventData?.symbolCount).toBe(100);
      expect(eventData?.lineCount).toBe(500);
    });

    it('should track parser errors', async () => {
      await service.enable();

      await service.trackParser('typescript', '.ts', 50, 0, 500, 'Syntax error');

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.error).toBe('Syntax error');
    });
  });

  describe('trackError', () => {
    it('should track errors', async () => {
      await service.enable();

      await service.trackError('TypeError', 'Cannot read property', 'at line 10', { command: 'find' }, false);

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('error_occurred');

      const eventData = events[0].eventData as any;
      expect(eventData?.errorType).toBe('TypeError');
      expect(eventData?.fatal).toBe(false);
    });

    it('should truncate error messages to 200 chars', async () => {
      await service.enable();

      const longMessage = 'x'.repeat(500);
      await service.trackError('Error', longMessage, undefined, undefined, false);

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.message.length).toBe(200);
    });

    it('should truncate stack traces to 500 chars', async () => {
      await service.enable();

      const longStack = 'x'.repeat(1000);
      await service.trackError('Error', 'message', longStack, undefined, false);

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.stack.length).toBe(500);
    });

    it('should track fatal errors', async () => {
      await service.enable();

      await service.trackError('FatalError', 'Critical failure', undefined, undefined, true);

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData?.fatal).toBe(true);
    });
  });

  describe('trackPerformance', () => {
    it('should track performance metrics', async () => {
      await service.enable();

      await service.trackPerformance('query_time', 50, 'ms', { queryType: 'symbol' });

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('performance_metric');

      const eventData = events[0].eventData as any;
      expect(eventData?.metricName).toBe('query_time');
      expect(eventData?.value).toBe(50);
      expect(eventData?.unit).toBe('ms');
    });

    it('should track different metric units', async () => {
      await service.enable();

      await service.trackPerformance('memory_usage', 1024, 'bytes');
      await service.trackPerformance('file_count', 100, 'count');
      await service.trackPerformance('cache_hit_rate', 0.85, 'percentage');

      const events = dao.getEvents();
      expect(events.length).toBe(3);
    });
  });

  describe('trackFeature', () => {
    it('should track feature usage', async () => {
      await service.enable();

      await service.trackFeature('semantic-search', true, 'variant-a');

      const events = dao.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('feature_used');

      const eventData = events[0].eventData as any;
      expect(eventData?.featureName).toBe('semantic-search');
      expect(eventData?.enabled).toBe(true);
      expect(eventData?.variant).toBe('variant-a');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await service.enable();

      // Create events directly via DAO to ensure proper date alignment
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(today).setHours(0, 0, 0, 0);

      dao.saveEvent({
        sessionId: service.getSessionId(),
        eventType: 'command_executed',
        eventData: { command: 'find', args: ['test'], duration: 100, exitCode: 0 },
        timestamp: startOfDay + 1000,
      });

      dao.saveEvent({
        sessionId: service.getSessionId(),
        eventType: 'command_executed',
        eventData: { command: 'def', args: ['MyClass'], duration: 50, exitCode: 0 },
        timestamp: startOfDay + 2000,
      });

      dao.aggregateStats(today);
    });

    it('should retrieve statistics', async () => {
      const stats = await service.getStats();
      expect(stats.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const stats = await service.getStats(today, today);
      expect(stats.length).toBeGreaterThan(0);
    });
  });

  describe('clearAllData', () => {
    beforeEach(async () => {
      await service.enable();
      await service.trackCommand('find', ['test'], 100, 0);
    });

    it('should clear all telemetry data', async () => {
      await service.clearAllData();

      const events = dao.getEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('exportData', () => {
    beforeEach(async () => {
      await service.enable();

      // Create events directly via DAO to ensure proper date alignment
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(today).setHours(0, 0, 0, 0);

      dao.saveEvent({
        sessionId: service.getSessionId(),
        eventType: 'command_executed',
        eventData: { command: 'find', args: ['test'], duration: 100, exitCode: 0 },
        timestamp: startOfDay + 1000,
      });

      dao.saveEvent({
        sessionId: service.getSessionId(),
        eventType: 'query_performed',
        eventData: { queryType: 'symbol', query: 'MyClass', resultCount: 5, duration: 50, cached: false },
        timestamp: startOfDay + 2000,
      });
    });

    it('should export all telemetry data', async () => {
      const exported = await service.exportData();
      expect(exported.length).toBe(2);
    });

    it('should export data for date range', async () => {
      // Use a range from yesterday to tomorrow to ensure events created today are included
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const exported = await service.exportData(yesterday, tomorrow);
      expect(exported.length).toBe(2);
    });
  });

  describe('privacy guarantees', () => {
    beforeEach(async () => {
      await service.enable();
    });

    it('should not track file paths', async () => {
      // Parser should only track extension, not path
      await service.trackParser('typescript', '.ts', 50, 100, 500);

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;
      expect(eventData).toBeDefined();
      expect(eventData?.fileExtension).toBe('.ts');
      // No 'path' or 'file' field
      expect(eventData?.path).toBeUndefined();
      expect(eventData?.file).toBeUndefined();
    });

    it('should truncate sensitive data', async () => {
      const longQuery = 'x'.repeat(500);
      const longError = 'y'.repeat(500);
      const longStack = 'z'.repeat(1000);

      await service.trackQuery('text', longQuery, 10, 100, false);
      await service.trackError('Error', longError, longStack, undefined, false);

      const events = dao.getEvents();

      const queryEvent = events.find(e => e.eventType === 'query_performed');
      const errorEvent = events.find(e => e.eventType === 'error_occurred');

      const queryData = queryEvent?.eventData as any;
      const errorData = errorEvent?.eventData as any;

      expect(queryData?.query.length).toBeLessThanOrEqual(100);
      expect(errorData?.message.length).toBeLessThanOrEqual(200);
      expect(errorData?.stack.length).toBeLessThanOrEqual(500);
    });

    it('should use anonymous session IDs', async () => {
      const sessionId = service.getSessionId();

      // Session ID should be a UUID (36 chars with dashes)
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      await service.trackCommand('find', ['test'], 100, 0);

      const events = dao.getEvents();
      expect(events[0].sessionId).toBe(sessionId);
    });

    it('should not store code content', async () => {
      // Verify no methods accept code content
      await service.trackCommand('find', ['test'], 100, 0);
      await service.trackQuery('text', 'search term', 10, 100, false);
      await service.trackParser('typescript', '.ts', 50, 100, 500);

      const events = dao.getEvents();

      for (const event of events) {
        const eventData = event.eventData as any;
        // Should not have code, content, or source fields
        expect(eventData?.code).toBeUndefined();
        expect(eventData?.content).toBeUndefined();
        expect(eventData?.source).toBeUndefined();
      }
    });
  });

  describe('performance', () => {
    it('should complete tracking in < 1ms when enabled', async () => {
      await service.enable();

      const start = performance.now();
      await service.trackCommand('find', ['test'], 100, 0);
      const duration = performance.now() - start;

      // Allow some margin for test environment
      expect(duration).toBeLessThan(10); // 10ms max in test environment
    });

    it('should complete immediately when disabled', async () => {
      const start = performance.now();
      await service.trackCommand('find', ['test'], 100, 0);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('silent failure', () => {
    it('should not throw when DAO is unavailable', async () => {
      const serviceWithoutDao = new TelemetryService();

      await expect(serviceWithoutDao.enable()).resolves.toBeUndefined();
      await expect(serviceWithoutDao.disable()).resolves.toBeUndefined();
      await expect(serviceWithoutDao.trackCommand('find', ['test'], 100, 0)).resolves.toBeUndefined();
      await expect(serviceWithoutDao.trackQuery('text', 'test', 10, 100, false)).resolves.toBeUndefined();
    });

    it('should not throw on database errors', async () => {
      await service.enable();

      // Close database to cause errors
      db.close();

      // All methods should complete without throwing
      await expect(service.trackCommand('find', ['test'], 100, 0)).resolves.toBeUndefined();
      await expect(service.trackQuery('text', 'test', 10, 100, false)).resolves.toBeUndefined();
      await expect(service.trackParser('typescript', '.ts', 50, 100, 500)).resolves.toBeUndefined();
      await expect(service.trackError('Error', 'message', undefined, undefined, false)).resolves.toBeUndefined();
      await expect(service.trackPerformance('metric', 100, 'ms')).resolves.toBeUndefined();
      await expect(service.trackFeature('feature', true)).resolves.toBeUndefined();
    });
  });
});
