/**
 * TaskAuditLogger Unit Tests
 *
 * Tests for audit logging functionality.
 *
 * Part of Phase 4: Production Hardening
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TaskAuditLogger, createAuditLogger } from '@/core/task-engine/audit-logger';

describe('TaskAuditLogger', () => {
  let logger: TaskAuditLogger;
  let tempDir: string;
  let logPath: string;

  beforeEach(() => {
    vi.useRealTimers();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    logPath = path.join(tempDir, 'test-audit.jsonl');
  });

  afterEach(async () => {
    if (logger) {
      await logger.shutdown();
    }
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      logger = new TaskAuditLogger({ logPath });

      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(0);
    });

    it('should create log directory if missing', () => {
      const nestedPath = path.join(tempDir, 'nested', 'path', 'audit.jsonl');
      logger = new TaskAuditLogger({ logPath: nestedPath });

      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });
  });

  describe('log', () => {
    it('should log events to file (sync mode)', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({
        type: 'TASK_CREATED',
        taskId: 'task_123',
        clientId: 'claude-code',
        taskType: 'web_search'
      });

      const content = fs.readFileSync(logPath, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.type).toBe('TASK_CREATED');
      expect(entry.taskId).toBe('task_123');
      expect(entry.clientId).toBe('claude-code');
      expect(entry.timestamp).toBeDefined();
    });

    it('should redact payload and only include size', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({
        type: 'TASK_CREATED',
        taskId: 'task_123',
        clientId: 'claude-code',
        payload: { sensitiveData: 'secret', query: 'test' }
      });

      const content = fs.readFileSync(logPath, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.hasPayload).toBe(true);
      expect(entry.payloadSizeBytes).toBeGreaterThan(0);
      expect(entry.payload).toBeUndefined(); // Should NOT include actual payload
    });

    it('should include error information', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({
        type: 'TASK_FAILED',
        taskId: 'task_123',
        clientId: 'claude-code',
        error: { code: 'TIMEOUT', message: 'Task timed out' }
      });

      const content = fs.readFileSync(logPath, 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.error.code).toBe('TIMEOUT');
      expect(entry.error.message).toBe('Task timed out');
    });

    it('should log multiple events', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'client-1' });
      logger.log({ type: 'TASK_STARTED', taskId: 'task_1', clientId: 'client-1' });
      logger.log({ type: 'TASK_COMPLETED', taskId: 'task_1', clientId: 'client-1', durationMs: 1500 });

      const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
      expect(lines).toHaveLength(3);

      const entries = lines.map(l => JSON.parse(l));
      expect(entries[0].type).toBe('TASK_CREATED');
      expect(entries[1].type).toBe('TASK_STARTED');
      expect(entries[2].type).toBe('TASK_COMPLETED');
      expect(entries[2].durationMs).toBe(1500);
    });
  });

  describe('async writes', () => {
    it('should queue writes in async mode', async () => {
      logger = new TaskAuditLogger({
        logPath,
        asyncWrites: true,
        flushIntervalMs: 50
      });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'client-1' });

      // File may not be written yet
      const stats = logger.getStats();
      expect(stats.pendingWrites).toBeGreaterThanOrEqual(0);

      // Wait for flush
      await new Promise(r => setTimeout(r, 100));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content.trim()).not.toBe('');
    });

    it('should flush on shutdown', async () => {
      logger = new TaskAuditLogger({
        logPath,
        asyncWrites: true,
        flushIntervalMs: 10000 // Long interval
      });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'client-1' });

      // Shutdown should flush
      await logger.shutdown();

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content.trim()).not.toBe('');
    });
  });

  describe('log rotation', () => {
    it('should rotate log when size exceeded', () => {
      logger = new TaskAuditLogger({
        logPath,
        asyncWrites: false,
        enableRotation: true,
        maxFileSizeBytes: 200, // Very small for testing
        maxRotatedFiles: 3
      });

      // Write enough to trigger rotation
      for (let i = 0; i < 10; i++) {
        logger.log({
          type: 'TASK_CREATED',
          taskId: `task_${i}`,
          clientId: 'client-1',
          details: { data: 'some data to make the entry larger' }
        });
      }

      const stats = logger.getStats();
      expect(stats.rotationsPerformed).toBeGreaterThan(0);

      // Check rotated files exist
      expect(fs.existsSync(`${logPath}.1`)).toBe(true);
    });

    it('should limit rotated files', () => {
      logger = new TaskAuditLogger({
        logPath,
        asyncWrites: false,
        enableRotation: true,
        maxFileSizeBytes: 100,
        maxRotatedFiles: 3
      });

      // Write enough to trigger multiple rotations
      for (let i = 0; i < 30; i++) {
        logger.log({
          type: 'TASK_CREATED',
          taskId: `task_${i}`,
          clientId: 'client-1',
          details: { data: 'padding data to make entry larger' }
        });
      }

      const stats = logger.getStats();
      // Should have performed multiple rotations
      expect(stats.rotationsPerformed).toBeGreaterThanOrEqual(3);

      // Should have at most maxRotatedFiles rotated files
      expect(fs.existsSync(`${logPath}.1`)).toBe(true);
      expect(fs.existsSync(`${logPath}.2`)).toBe(true);
      // The 4th rotated file should not exist (maxRotatedFiles: 3)
      expect(fs.existsSync(`${logPath}.4`)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should track event counts', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'c1' });
      logger.log({ type: 'TASK_CREATED', taskId: 'task_2', clientId: 'c2' });
      logger.log({ type: 'TASK_COMPLETED', taskId: 'task_1', clientId: 'c1' });

      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType['TASK_CREATED']).toBe(2);
      expect(stats.eventsByType['TASK_COMPLETED']).toBe(1);
    });

    it('should track bytes written', () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'c1' });

      const stats = logger.getStats();
      expect(stats.totalBytesWritten).toBeGreaterThan(0);
    });
  });

  describe('flush', () => {
    it('should manually flush pending writes', async () => {
      logger = new TaskAuditLogger({
        logPath,
        asyncWrites: true,
        flushIntervalMs: 60000 // Very long
      });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'c1' });

      // Force flush
      logger.flush();

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content.trim()).not.toBe('');
    });
  });

  describe('shutdown', () => {
    it('should be idempotent', async () => {
      logger = new TaskAuditLogger({ logPath });

      await logger.shutdown();
      await logger.shutdown(); // Should not throw
    });

    it('should ignore logs after shutdown', async () => {
      logger = new TaskAuditLogger({ logPath, asyncWrites: false });

      logger.log({ type: 'TASK_CREATED', taskId: 'task_1', clientId: 'c1' });
      await logger.shutdown();

      const beforeBytes = fs.statSync(logPath).size;

      // This should be ignored
      logger.log({ type: 'TASK_CREATED', taskId: 'task_2', clientId: 'c2' });

      const afterBytes = fs.statSync(logPath).size;
      expect(afterBytes).toBe(beforeBytes);
    });
  });

  describe('createAuditLogger', () => {
    it('should create a logger instance', () => {
      logger = createAuditLogger({ logPath });
      expect(logger).toBeInstanceOf(TaskAuditLogger);
    });
  });
});
