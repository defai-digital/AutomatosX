/**
 * Task Engine Module Exports Tests
 *
 * Verifies all expected exports are available from the module
 */

import { describe, it, expect } from 'vitest';
import * as TaskEngineModule from '@/core/task-engine';

describe('Task Engine Module Exports', () => {
  describe('Types', () => {
    it('should export type schemas', () => {
      expect(TaskEngineModule.TaskTypeSchema).toBeDefined();
      expect(TaskEngineModule.TaskEngineSchema).toBeDefined();
      expect(TaskEngineModule.TaskStatusSchema).toBeDefined();
      expect(TaskEngineModule.OriginClientSchema).toBeDefined();
      expect(TaskEngineModule.CreateTaskInputSchema).toBeDefined();
      expect(TaskEngineModule.TaskFilterSchema).toBeDefined();
      expect(TaskEngineModule.RunTaskOptionsSchema).toBeDefined();
    });

    it('should export error classes', () => {
      expect(TaskEngineModule.TaskEngineError).toBeDefined();
      expect(TaskEngineModule.LoopPreventionError).toBeDefined();
    });

    it('should export type guards', () => {
      expect(TaskEngineModule.isTaskStatus).toBeDefined();
      expect(TaskEngineModule.isTaskType).toBeDefined();
      expect(TaskEngineModule.isTaskEngine).toBeDefined();
      expect(TaskEngineModule.isTaskEngineError).toBeDefined();
      expect(TaskEngineModule.isLoopPreventionError).toBeDefined();
    });
  });

  describe('LoopGuard', () => {
    it('should export LoopGuard class', () => {
      expect(TaskEngineModule.LoopGuard).toBeDefined();
    });

    it('should export LoopGuard factory functions', () => {
      expect(TaskEngineModule.getLoopGuard).toBeDefined();
      expect(TaskEngineModule.resetLoopGuard).toBeDefined();
      expect(TaskEngineModule.createLoopGuard).toBeDefined();
    });
  });

  describe('Compression', () => {
    it('should export compression functions', () => {
      expect(TaskEngineModule.compressPayload).toBeDefined();
      expect(TaskEngineModule.decompressPayload).toBeDefined();
      expect(TaskEngineModule.compressWithInfo).toBeDefined();
      expect(TaskEngineModule.decompressWithInfo).toBeDefined();
      expect(TaskEngineModule.estimateCompressedSize).toBeDefined();
      expect(TaskEngineModule.isGzipCompressed).toBeDefined();
      expect(TaskEngineModule.calculateCompressionRatio).toBeDefined();
      expect(TaskEngineModule.getCompressionLevel).toBeDefined();
    });

    it('should export compression constants', () => {
      expect(TaskEngineModule.DEFAULT_COMPRESSION_LEVEL).toBeDefined();
      expect(TaskEngineModule.MIN_COMPRESSION_THRESHOLD).toBeDefined();
    });
  });

  describe('TaskStore', () => {
    it('should export TaskStore class', () => {
      expect(TaskEngineModule.TaskStore).toBeDefined();
    });

    it('should export TaskStore factory', () => {
      expect(TaskEngineModule.createTaskStore).toBeDefined();
    });
  });

  describe('TaskEngine', () => {
    it('should export TaskEngine class', () => {
      expect(TaskEngineModule.TaskEngine).toBeDefined();
    });

    it('should export TaskEngine factory functions', () => {
      expect(TaskEngineModule.getTaskEngine).toBeDefined();
      expect(TaskEngineModule.resetTaskEngine).toBeDefined();
      expect(TaskEngineModule.createTaskEngine).toBeDefined();
    });
  });
});

describe('Type Guards', () => {
  describe('isTaskStatus', () => {
    it('should validate valid statuses', () => {
      expect(TaskEngineModule.isTaskStatus('pending')).toBe(true);
      expect(TaskEngineModule.isTaskStatus('running')).toBe(true);
      expect(TaskEngineModule.isTaskStatus('completed')).toBe(true);
      expect(TaskEngineModule.isTaskStatus('failed')).toBe(true);
      expect(TaskEngineModule.isTaskStatus('expired')).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(TaskEngineModule.isTaskStatus('invalid')).toBe(false);
      expect(TaskEngineModule.isTaskStatus('')).toBe(false);
      expect(TaskEngineModule.isTaskStatus(null)).toBe(false);
    });
  });

  describe('isTaskType', () => {
    it('should validate valid types', () => {
      expect(TaskEngineModule.isTaskType('web_search')).toBe(true);
      expect(TaskEngineModule.isTaskType('code_review')).toBe(true);
      expect(TaskEngineModule.isTaskType('code_generation')).toBe(true);
      expect(TaskEngineModule.isTaskType('analysis')).toBe(true);
      expect(TaskEngineModule.isTaskType('custom')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(TaskEngineModule.isTaskType('invalid')).toBe(false);
      expect(TaskEngineModule.isTaskType('')).toBe(false);
    });
  });

  describe('isTaskEngine', () => {
    it('should validate valid engines', () => {
      expect(TaskEngineModule.isTaskEngine('auto')).toBe(true);
      expect(TaskEngineModule.isTaskEngine('gemini')).toBe(true);
      expect(TaskEngineModule.isTaskEngine('claude')).toBe(true);
      expect(TaskEngineModule.isTaskEngine('codex')).toBe(true);
      expect(TaskEngineModule.isTaskEngine('glm')).toBe(true);
      expect(TaskEngineModule.isTaskEngine('grok')).toBe(true);
    });

    it('should reject invalid engines', () => {
      expect(TaskEngineModule.isTaskEngine('invalid')).toBe(false);
      expect(TaskEngineModule.isTaskEngine('')).toBe(false);
    });
  });

  describe('isTaskEngineError', () => {
    it('should identify TaskEngineError', () => {
      const error = new TaskEngineModule.TaskEngineError('test', 'TASK_NOT_FOUND');
      expect(TaskEngineModule.isTaskEngineError(error)).toBe(true);
    });

    it('should identify LoopPreventionError', () => {
      const error = new TaskEngineModule.LoopPreventionError('test', []);
      expect(TaskEngineModule.isTaskEngineError(error)).toBe(true);
    });

    it('should reject regular errors', () => {
      const error = new Error('test');
      expect(TaskEngineModule.isTaskEngineError(error)).toBe(false);
    });
  });

  describe('isLoopPreventionError', () => {
    it('should identify LoopPreventionError', () => {
      const error = new TaskEngineModule.LoopPreventionError('test', []);
      expect(TaskEngineModule.isLoopPreventionError(error)).toBe(true);
    });

    it('should reject TaskEngineError', () => {
      const error = new TaskEngineModule.TaskEngineError('test', 'TASK_NOT_FOUND');
      expect(TaskEngineModule.isLoopPreventionError(error)).toBe(false);
    });
  });
});
