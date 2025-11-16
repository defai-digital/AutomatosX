/**
 * Tests for structured-logging.ts
 * Verifies structured event logging system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  StructuredLogger,
  initLogger,
  getLogger,
  renderEventTimeline,
  renderEventSummary,
  type LogLevel,
  type EventCategory
} from '../src/structured-logging.js';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let testLogPath: string;

  beforeEach(() => {
    testLogPath = join(process.cwd(), '.automatosx', 'logs', 'test-events.jsonl');
    logger = new StructuredLogger('test-session', {
      enableConsole: false, // Disable console in tests
      enableFile: true,
      logFilePath: testLogPath,
      minLevel: 'debug'
    });
  });

  afterEach(() => {
    // Clean up test log file
    if (existsSync(testLogPath)) {
      try {
        unlinkSync(testLogPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('log', () => {
    it('should log event with all fields', () => {
      logger.log('info', 'command', 'test_event', 'Test message', { key: 'value' });

      const recent = logger.getRecentLogs(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].level).toBe('info');
      expect(recent[0].category).toBe('command');
      expect(recent[0].event).toBe('test_event');
      expect(recent[0].message).toBe('Test message');
      expect(recent[0].metadata).toEqual({ key: 'value' });
    });

    it('should add timestamp automatically', () => {
      const before = Date.now();
      logger.log('info', 'command', 'test_event', 'Test');
      const after = Date.now();

      const recent = logger.getRecentLogs(1);
      const timestamp = recent[0].timestamp.getTime();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should respect minimum log level', () => {
      const restrictedLogger = new StructuredLogger('test', {
        enableConsole: false,
        enableFile: false,
        minLevel: 'warn'
      });

      restrictedLogger.log('debug', 'command', 'debug_event', 'Debug message');
      restrictedLogger.log('info', 'command', 'info_event', 'Info message');
      restrictedLogger.log('warn', 'command', 'warn_event', 'Warn message');

      const recent = restrictedLogger.getRecentLogs();
      expect(recent).toHaveLength(1);
      expect(recent[0].level).toBe('warn');
    });

    it('should track duration when provided', () => {
      logger.log('info', 'command', 'test_event', 'Test', undefined, 1500);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].duration).toBe(1500);
    });
  });

  describe('convenience methods', () => {
    it('should log debug events', () => {
      logger.debug('command', 'debug_event', 'Debug message');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('debug');
    });

    it('should log info events', () => {
      logger.info('command', 'info_event', 'Info message');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('info');
    });

    it('should log warn events', () => {
      logger.warn('command', 'warn_event', 'Warning message');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('warn');
    });

    it('should log error events', () => {
      logger.error('command', 'error_event', 'Error message');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('error');
    });

    it('should log success events', () => {
      logger.success('command', 'success_event', 'Success message');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('success');
    });
  });

  describe('startTimer', () => {
    it('should return duration in milliseconds', async () => {
      const getElapsed = logger.startTimer();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = getElapsed();

      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(100); // Allow some overhead
    });

    it('should track different timers independently', async () => {
      const timer1 = logger.startTimer();
      await new Promise(resolve => setTimeout(resolve, 30));

      const timer2 = logger.startTimer();
      await new Promise(resolve => setTimeout(resolve, 30));

      const duration1 = timer1();
      const duration2 = timer2();

      expect(duration1).toBeGreaterThan(duration2);
    });
  });

  describe('specialized logging methods', () => {
    it('should log command execution', () => {
      logger.logCommand('npm test', ['test'], 0, 5000);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('command');
      expect(recent[0].level).toBe('success');
      expect(recent[0].metadata?.command).toBe('npm test');
      expect(recent[0].duration).toBe(5000);
    });

    it('should log failed commands as errors', () => {
      logger.logCommand('npm test', ['test'], 1, 2000);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].level).toBe('error');
    });

    it('should log AI responses', () => {
      logger.logAIResponse('claude', 1500, 0.002, 1200);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('ai_response');
      expect(recent[0].metadata?.provider).toBe('claude');
      expect(recent[0].metadata?.tokens).toBe(1500);
      expect(recent[0].metadata?.cost).toBe(0.002);
    });

    it('should log file operations', () => {
      logger.logFileOperation('write', 'test.txt', true, 100);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('file_operation');
      expect(recent[0].level).toBe('success');
      expect(recent[0].metadata?.path).toBe('test.txt');
    });

    it('should log agent delegation', () => {
      logger.logAgentDelegation('backend', 'Implement API', 'completed', 45000);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('agent_delegation');
      expect(recent[0].metadata?.agent).toBe('backend');
      expect(recent[0].duration).toBe(45000);
    });

    it('should log approval events', () => {
      logger.logApproval('file write', true, 'User approved');

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('approval');
      expect(recent[0].metadata?.approved).toBe(true);
    });

    it('should log session events', () => {
      logger.logSession('started', { provider: 'claude' });

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('session');
      expect(recent[0].event).toBe('session_started');
    });

    it('should log memory operations', () => {
      logger.logMemory('search', 'authentication', 5);

      const recent = logger.getRecentLogs(1);
      expect(recent[0].category).toBe('memory');
      expect(recent[0].metadata?.query).toBe('authentication');
      expect(recent[0].metadata?.results).toBe(5);
    });
  });

  describe('getRecentLogs', () => {
    it('should return specified number of logs', () => {
      for (let i = 0; i < 30; i++) {
        logger.info('command', `event_${i}`, `Message ${i}`);
      }

      const recent = logger.getRecentLogs(10);
      expect(recent).toHaveLength(10);
    });

    it('should return logs in chronological order', () => {
      logger.info('command', 'event_1', 'First');
      logger.info('command', 'event_2', 'Second');
      logger.info('command', 'event_3', 'Third');

      const recent = logger.getRecentLogs(3);
      expect(recent[0].message).toBe('First');
      expect(recent[1].message).toBe('Second');
      expect(recent[2].message).toBe('Third');
    });

    it('should default to 20 logs', () => {
      for (let i = 0; i < 50; i++) {
        logger.info('command', `event_${i}`, `Message ${i}`);
      }

      const recent = logger.getRecentLogs();
      expect(recent).toHaveLength(20);
    });
  });

  describe('getLogsByCategory', () => {
    beforeEach(() => {
      logger.logCommand('test', [], 0);
      logger.logAIResponse('claude', 100, 0.001);
      logger.logFileOperation('write', 'file.txt', true);
      logger.logAgentDelegation('backend', 'Task', 'completed');
    });

    it('should filter logs by category', () => {
      const commandLogs = logger.getLogsByCategory('command');
      expect(commandLogs).toHaveLength(1);
      expect(commandLogs.every(log => log.category === 'command')).toBe(true);
    });

    it('should return empty array for unused category', () => {
      const errorLogs = logger.getLogsByCategory('error');
      expect(errorLogs).toHaveLength(0);
    });
  });

  describe('getLogsByLevel', () => {
    beforeEach(() => {
      logger.debug('command', 'debug_event', 'Debug');
      logger.info('command', 'info_event', 'Info');
      logger.warn('command', 'warn_event', 'Warning');
      logger.error('command', 'error_event', 'Error');
    });

    it('should filter logs by level', () => {
      const errorLogs = logger.getLogsByLevel('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('error');
    });

    it('should return empty array for unused level', () => {
      const successLogs = logger.getLogsByLevel('success');
      expect(successLogs).toHaveLength(0);
    });
  });

  describe('clearBuffer', () => {
    it('should clear all buffered logs', () => {
      logger.info('command', 'event_1', 'First');
      logger.info('command', 'event_2', 'Second');

      expect(logger.getRecentLogs()).toHaveLength(2);

      logger.clearBuffer();

      expect(logger.getRecentLogs()).toHaveLength(0);
    });
  });

  describe('file logging', () => {
    it('should write logs to file in JSONL format', () => {
      logger.info('command', 'test_event', 'Test message', { key: 'value' });

      // Give file system time to write
      expect(existsSync(testLogPath)).toBe(true);

      const content = readFileSync(testLogPath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('info');
      expect(parsed.category).toBe('command');
      expect(parsed.message).toBe('Test message');
    });

    it('should append multiple logs to same file', () => {
      logger.info('command', 'event_1', 'Message 1');
      logger.info('command', 'event_2', 'Message 2');
      logger.info('command', 'event_3', 'Message 3');

      const content = readFileSync(testLogPath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3);
    });
  });

  describe('buffer management', () => {
    it('should maintain max buffer size of 100', () => {
      for (let i = 0; i < 150; i++) {
        logger.info('command', `event_${i}`, `Message ${i}`);
      }

      const allLogs = logger.getRecentLogs(200);
      expect(allLogs.length).toBeLessThanOrEqual(100);
    });

    it('should keep most recent logs when buffer is full', () => {
      for (let i = 0; i < 150; i++) {
        logger.info('command', `event_${i}`, `Message ${i}`);
      }

      const recent = logger.getRecentLogs(1);
      expect(recent[0].message).toBe('Message 149'); // Most recent
    });
  });
});

describe('Global Logger', () => {
  afterEach(() => {
    // Clean up any test log files
    const testPath = join(process.cwd(), '.automatosx', 'logs', 'test-global.jsonl');
    if (existsSync(testPath)) {
      try {
        unlinkSync(testPath);
      } catch (error) {
        // Ignore
      }
    }
  });

  it('should initialize global logger', () => {
    const logger = initLogger('global-test', {
      enableConsole: false,
      enableFile: true,
      logFilePath: join(process.cwd(), '.automatosx', 'logs', 'test-global.jsonl')
    });

    expect(logger).toBeInstanceOf(StructuredLogger);

    const retrieved = getLogger();
    expect(retrieved).toBe(logger);
  });

  it('should return same instance on subsequent calls', () => {
    const logger1 = initLogger('global-test', { enableConsole: false, enableFile: false });
    const logger2 = getLogger();

    expect(logger1).toBe(logger2);
  });
});

describe('renderEventTimeline', () => {
  it('should render timeline with events', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    logger.info('command', 'event_1', 'First event');
    logger.warn('command', 'event_2', 'Second event');
    logger.success('command', 'event_3', 'Third event');

    const timeline = renderEventTimeline(logger.getRecentLogs());

    expect(timeline).toContain('Event Timeline');
    expect(timeline).toContain('First event');
    expect(timeline).toContain('Second event');
    expect(timeline).toContain('Third event');
  });

  it('should limit to specified max entries', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    for (let i = 0; i < 30; i++) {
      logger.info('command', `event_${i}`, `Message ${i}`);
    }

    const timeline = renderEventTimeline(logger.getRecentLogs(), 10);

    // Count event lines (not header/footer)
    const eventLines = timeline.split('\n').filter(line => line.includes('Message'));
    expect(eventLines.length).toBeLessThanOrEqual(10);
  });

  it('should show duration when available', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    logger.log('info', 'command', 'test_event', 'Test with duration', undefined, 1500);

    const timeline = renderEventTimeline(logger.getRecentLogs());

    expect(timeline).toContain('1500ms');
  });
});

describe('renderEventSummary', () => {
  it('should summarize events by category', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    logger.logCommand('test', [], 0);
    logger.logCommand('build', [], 0);
    logger.logAIResponse('claude', 100, 0.001);
    logger.logFileOperation('write', 'file.txt', true);

    const summary = renderEventSummary(logger.getRecentLogs());

    expect(summary).toContain('Event Summary');
    expect(summary).toContain('By Category:');
    expect(summary).toContain('command: 2');
    expect(summary).toContain('ai_response: 1');
    expect(summary).toContain('file_operation: 1');
  });

  it('should summarize events by level', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    logger.info('command', 'event_1', 'Info 1');
    logger.info('command', 'event_2', 'Info 2');
    logger.warn('command', 'event_3', 'Warning');
    logger.error('command', 'event_4', 'Error');

    const summary = renderEventSummary(logger.getRecentLogs());

    expect(summary).toContain('By Level:');
    expect(summary).toContain('info: 2');
    expect(summary).toContain('warn: 1');
    expect(summary).toContain('error: 1');
  });
});

describe('Edge Cases', () => {
  it('should handle empty metadata', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    logger.log('info', 'command', 'test_event', 'Test', undefined);

    const recent = logger.getRecentLogs(1);
    expect(recent[0].metadata).toBeUndefined();
  });

  it('should handle very long messages', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    const longMessage = 'A'.repeat(10000);
    logger.info('command', 'test_event', longMessage);

    const recent = logger.getRecentLogs(1);
    expect(recent[0].message).toBe(longMessage);
  });

  it('should handle special characters in messages', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    const specialMessage = 'Test with "quotes" and \n newlines \t tabs';
    logger.info('command', 'test_event', specialMessage);

    const recent = logger.getRecentLogs(1);
    expect(recent[0].message).toBe(specialMessage);
  });

  it('should handle metadata with nested objects', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    const complexMetadata = {
      nested: {
        deep: {
          value: 'test'
        }
      },
      array: [1, 2, 3]
    };

    logger.info('command', 'test_event', 'Test', complexMetadata);

    const recent = logger.getRecentLogs(1);
    expect(recent[0].metadata).toEqual(complexMetadata);
  });

  it('should handle concurrent logging', () => {
    const logger = new StructuredLogger('test', { enableConsole: false, enableFile: false });

    // Log many events quickly
    for (let i = 0; i < 100; i++) {
      logger.info('command', `event_${i}`, `Message ${i}`);
    }

    const recent = logger.getRecentLogs(100);
    expect(recent.length).toBe(100);
  });
});
