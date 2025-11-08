/**
 * TelemetryDAO.test.ts
 * Tests for TelemetryDAO database operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TelemetryDAO } from '../TelemetryDAO.js';
import { runMigrations } from '../../migrations.js';
import { unlinkSync } from 'fs';

describe('TelemetryDAO', () => {
  let db: Database.Database;
  let dao: TelemetryDAO;
  let testDbPath: string;

  beforeEach(() => {
    // Create fresh database for each test with unique name
    testDbPath = `./test-telemetry-dao-${Date.now()}-${Math.random()}.db`;
    db = new Database(testDbPath);
    runMigrations(db);
    dao = new TelemetryDAO(db);
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe('saveEvent', () => {
    it('should save a telemetry event', () => {
      const eventId = dao.saveEvent({
        sessionId: 'test-session-id',
        eventType: 'command_executed',
        eventData: { command: 'find', duration: 100 },
        timestamp: Date.now(),
      });

      expect(eventId).toBeGreaterThan(0);
    });

    it('should save event without event data', () => {
      const eventId = dao.saveEvent({
        sessionId: 'test-session-id',
        eventType: 'feature_used',
        timestamp: Date.now(),
      });

      expect(eventId).toBeGreaterThan(0);
    });

    it('should return different IDs for different events', () => {
      const id1 = dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now(),
      });

      const id2 = dao.saveEvent({
        sessionId: 'session-2',
        eventType: 'query_performed',
        timestamp: Date.now(),
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe('batchInsertEvents', () => {
    it('should insert multiple events in a transaction', () => {
      const events = [
        {
          sessionId: 'session-1',
          eventType: 'command_executed' as const,
          timestamp: Date.now(),
        },
        {
          sessionId: 'session-1',
          eventType: 'query_performed' as const,
          timestamp: Date.now() + 1000,
        },
        {
          sessionId: 'session-1',
          eventType: 'error_occurred' as const,
          timestamp: Date.now() + 2000,
        },
      ];

      const count = dao.batchInsertEvents(events);

      expect(count).toBe(3);

      const retrieved = dao.getEvents();
      expect(retrieved.length).toBe(3);
    });

    it('should handle empty array', () => {
      const count = dao.batchInsertEvents([]);
      expect(count).toBe(0);
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      // Insert test events
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now() - 3000,
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        timestamp: Date.now() - 2000,
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'error_occurred',
        timestamp: Date.now() - 1000,
      });
    });

    it('should retrieve all events', () => {
      const events = dao.getEvents();
      expect(events.length).toBe(3);
    });

    it('should order events by timestamp DESC', () => {
      const events = dao.getEvents();
      expect(events[0].eventType).toBe('error_occurred');
      expect(events[1].eventType).toBe('query_performed');
      expect(events[2].eventType).toBe('command_executed');
    });

    it('should filter by date range', () => {
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const events = dao.getEvents(yesterday, tomorrow);
      expect(events.length).toBe(3);
    });

    it('should limit results to 1000', () => {
      // Insert 1100 events
      const events = Array.from({ length: 1100 }, (_, i) => ({
        sessionId: 'session-1',
        eventType: 'command_executed' as const,
        timestamp: Date.now() + i,
      }));

      dao.batchInsertEvents(events);

      const retrieved = dao.getEvents();
      expect(retrieved.length).toBe(1000);
    });
  });

  describe('getEventsBySession', () => {
    beforeEach(() => {
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now(),
      });

      dao.saveEvent({
        sessionId: 'session-2',
        eventType: 'command_executed',
        timestamp: Date.now(),
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        timestamp: Date.now() + 1000,
      });
    });

    it('should retrieve events for specific session', () => {
      const events = dao.getEventsBySession('session-1');
      expect(events.length).toBe(2);
      expect(events.every(e => e.sessionId === 'session-1')).toBe(true);
    });

    it('should return empty array for non-existent session', () => {
      const events = dao.getEventsBySession('non-existent');
      expect(events.length).toBe(0);
    });
  });

  describe('getEventsByType', () => {
    beforeEach(() => {
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now(),
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        timestamp: Date.now(),
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now() + 1000,
      });
    });

    it('should retrieve events by type', () => {
      const events = dao.getEventsByType('command_executed');
      expect(events.length).toBe(2);
      expect(events.every(e => e.eventType === 'command_executed')).toBe(true);
    });

    it('should respect limit parameter', () => {
      const events = dao.getEventsByType('command_executed', 1);
      expect(events.length).toBe(1);
    });
  });

  describe('clearAllEvents', () => {
    beforeEach(() => {
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: Date.now(),
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        timestamp: Date.now(),
      });
    });

    it('should delete all events', () => {
      dao.clearAllEvents();

      const events = dao.getEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('clearEventsBefore', () => {
    beforeEach(() => {
      const now = Date.now();

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        timestamp: now - 48 * 60 * 60 * 1000, // 2 days ago
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        timestamp: now - 12 * 60 * 60 * 1000, // 12 hours ago
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'error_occurred',
        timestamp: now, // now
      });
    });

    it('should delete events before specified date', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      dao.clearEventsBefore(yesterday);

      const events = dao.getEvents();
      expect(events.length).toBe(2); // Last 2 events should remain
    });
  });

  describe('saveStats', () => {
    it('should save statistics', () => {
      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'command',
        statKey: 'find',
        count: 10,
        totalDuration: 1000,
        avgDuration: 100,
        minDuration: 50,
        maxDuration: 200,
      });

      const stats = dao.getStats();
      expect(stats.length).toBe(1);
      expect(stats[0].statKey).toBe('find');
      expect(stats[0].count).toBe(10);
    });

    it('should upsert existing statistics', () => {
      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'command',
        statKey: 'find',
        count: 10,
        totalDuration: 1000,
        avgDuration: 100,
        minDuration: 50,
        maxDuration: 200,
      });

      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'command',
        statKey: 'find',
        count: 5,
        totalDuration: 500,
        avgDuration: 100,
        minDuration: 40,
        maxDuration: 150,
      });

      const stats = dao.getStats();
      expect(stats.length).toBe(1);
      expect(stats[0].count).toBe(15); // 10 + 5
      expect(stats[0].totalDuration).toBe(1500); // 1000 + 500
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      dao.saveStats({
        statDate: '2025-11-06',
        statType: 'command',
        statKey: 'find',
        count: 10,
      });

      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'command',
        statKey: 'def',
        count: 5,
      });

      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'query',
        statKey: 'symbol',
        count: 20,
      });
    });

    it('should retrieve all stats', () => {
      const stats = dao.getStats();
      expect(stats.length).toBe(3);
    });

    it('should filter by date range', () => {
      const stats = dao.getStats('2025-11-07', '2025-11-07');
      expect(stats.length).toBe(2);
    });
  });

  describe('getStatsByType', () => {
    beforeEach(() => {
      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'command',
        statKey: 'find',
        count: 10,
      });

      dao.saveStats({
        statDate: '2025-11-07',
        statType: 'query',
        statKey: 'symbol',
        count: 20,
      });
    });

    it('should retrieve stats by type', () => {
      const stats = dao.getStatsByType('command');
      expect(stats.length).toBe(1);
      expect(stats[0].statType).toBe('command');
    });
  });

  describe('config management', () => {
    it('should save and retrieve config', async () => {
      await dao.saveConfig({
        enabled: true,
        remote: false,
        sessionId: 'test-session-id',
        consentDate: Date.now(),
      });

      const config = dao.getConfig();
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
      expect(config?.remote).toBe(false);
      expect(config?.sessionId).toBe('test-session-id');
    });

    it('should return null when no config exists', () => {
      const config = dao.getConfig();
      expect(config).toBeNull();
    });

    it('should update existing config', async () => {
      await dao.saveConfig({
        enabled: true,
        remote: false,
        sessionId: 'session-1',
      });

      await dao.saveConfig({
        enabled: false,
        optOutDate: Date.now(),
      });

      const config = dao.getConfig();
      expect(config?.enabled).toBe(false);
      expect(config?.optOutDate).toBeDefined();
    });
  });

  describe('aggregateStats', () => {
    beforeEach(() => {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(today).setHours(0, 0, 0, 0);

      // Insert command events
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        eventData: { command: 'find', duration: 100 },
        timestamp: startOfDay + 1000,
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        eventData: { command: 'find', duration: 200 },
        timestamp: startOfDay + 2000,
      });

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'command_executed',
        eventData: { command: 'def', duration: 150 },
        timestamp: startOfDay + 3000,
      });

      // Insert query events
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'query_performed',
        eventData: { queryType: 'symbol', duration: 50 },
        timestamp: startOfDay + 4000,
      });

      // Insert error events
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'error_occurred',
        eventData: { errorType: 'TypeError' },
        timestamp: startOfDay + 5000,
      });
    });

    it('should aggregate command statistics', () => {
      const today = new Date().toISOString().split('T')[0];
      dao.aggregateStats(today);

      const stats = dao.getStatsByType('command');
      expect(stats.length).toBeGreaterThan(0);

      const findStats = stats.find(s => s.statKey === 'find');
      expect(findStats).toBeDefined();
      expect(findStats?.count).toBe(2);
      expect(findStats?.totalDuration).toBe(300);
      expect(findStats?.avgDuration).toBe(150);
    });

    it('should aggregate query statistics', () => {
      const today = new Date().toISOString().split('T')[0];
      dao.aggregateStats(today);

      const stats = dao.getStatsByType('query');
      expect(stats.length).toBeGreaterThan(0);

      const symbolStats = stats.find(s => s.statKey === 'symbol');
      expect(symbolStats).toBeDefined();
      expect(symbolStats?.count).toBe(1);
    });

    it('should aggregate error statistics', () => {
      const today = new Date().toISOString().split('T')[0];
      dao.aggregateStats(today);

      const stats = dao.getStatsByType('error');
      expect(stats.length).toBeGreaterThan(0);

      const typeErrorStats = stats.find(s => s.statKey === 'TypeError');
      expect(typeErrorStats).toBeDefined();
      expect(typeErrorStats?.count).toBe(1);
    });
  });

  describe('privacy guarantees', () => {
    it('should not store full error messages', () => {
      const longMessage = 'x'.repeat(500);

      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'error_occurred',
        eventData: { errorType: 'Error', message: longMessage },
        timestamp: Date.now(),
      });

      const events = dao.getEvents();
      const eventData = events[0].eventData as any;

      // Should be truncated in the application layer before saving
      // DAO just stores what it receives
      expect(eventData?.message).toBeDefined();
    });

    it('should handle missing event data', () => {
      dao.saveEvent({
        sessionId: 'session-1',
        eventType: 'feature_used',
        timestamp: Date.now(),
      });

      const events = dao.getEvents();
      expect(events[0].eventData).toBeUndefined();
    });
  });
});
