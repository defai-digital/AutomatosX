/**
 * Tests for DebouncedSaver utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DebouncedSaver,
  createDebouncedSaver,
} from '../../../../src/shared/utils/debounced-saver.js';

describe('DebouncedSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should create a saver with default options', () => {
      const saver = new DebouncedSaver();
      expect(saver.hasPendingChanges()).toBe(false);
      saver.destroy();
    });

    it('should create a saver with custom options', () => {
      const saver = new DebouncedSaver({
        delayMs: 500,
        maxPending: 50,
        name: 'test-saver',
      });
      expect(saver.hasPendingChanges()).toBe(false);
      saver.destroy();
    });
  });

  describe('markDirty', () => {
    it('should schedule a save after delay', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 1000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      expect(saver.hasPendingChanges()).toBe(true);
      expect(saveFn).not.toHaveBeenCalled();

      // Advance time
      await vi.advanceTimersByTimeAsync(1000);

      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saver.hasPendingChanges()).toBe(false);

      saver.destroy();
    });

    it('should debounce multiple markDirty calls', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 1000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      saver.markDirty();
      saver.markDirty();

      // Only one save should happen
      await vi.advanceTimersByTimeAsync(1000);

      expect(saveFn).toHaveBeenCalledTimes(1);

      saver.destroy();
    });

    it('should track statistics', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 1000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      saver.markDirty();
      saver.markDirty();

      await vi.advanceTimersByTimeAsync(1000);

      const stats = saver.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.actualSaves).toBe(1);
      expect(stats.debouncedSaves).toBe(2);

      saver.destroy();
    });

    it('should force flush when maxPending is reached', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 10000, maxPending: 3 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      saver.markDirty();
      saver.markDirty(); // This should trigger flush

      // Should flush immediately without waiting
      await vi.advanceTimersByTimeAsync(0);

      expect(saveFn).toHaveBeenCalledTimes(1);

      saver.destroy();
    });
  });

  describe('flush', () => {
    it('should save immediately', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 10000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      expect(saveFn).not.toHaveBeenCalled();

      await saver.flush();

      expect(saveFn).toHaveBeenCalledTimes(1);

      saver.destroy();
    });

    it('should do nothing if no pending changes', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver();
      saver.setSaveFunction(saveFn);

      await saver.flush();

      expect(saveFn).not.toHaveBeenCalled();

      saver.destroy();
    });

    it('should cancel pending timeout', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 1000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      await saver.flush();

      // Advance past the original timeout
      await vi.advanceTimersByTimeAsync(2000);

      // Should only have been called once (by flush)
      expect(saveFn).toHaveBeenCalledTimes(1);

      saver.destroy();
    });
  });

  describe('error handling', () => {
    it('should retry on failure', async () => {
      const saveFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce(undefined);

      const saver = new DebouncedSaver({
        delayMs: 100,
        retryOnFailure: true,
        maxRetries: 3,
      });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      await vi.advanceTimersByTimeAsync(100);

      // Wait for retries with backoff
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      expect(saveFn).toHaveBeenCalledTimes(3);
      expect(saver.getStats().actualSaves).toBe(1);
      expect(saver.getStats().failures).toBe(0);

      saver.destroy();
    });

    it('should record failure after max retries', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('Always fails'));

      const saver = new DebouncedSaver({
        delayMs: 100,
        retryOnFailure: true,
        maxRetries: 2,
      });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      await vi.advanceTimersByTimeAsync(100);

      // Wait for retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      expect(saveFn).toHaveBeenCalledTimes(2);
      expect(saver.getStats().failures).toBe(1);

      saver.destroy();
    });

    it('should not retry when retryOnFailure is false', async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error('Fails'));

      const saver = new DebouncedSaver({
        delayMs: 100,
        retryOnFailure: false,
      });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      await vi.advanceTimersByTimeAsync(100);

      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saver.getStats().failures).toBe(1);

      saver.destroy();
    });
  });

  describe('destroy', () => {
    it('should cancel pending timeout', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 1000 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      saver.destroy();

      await vi.advanceTimersByTimeAsync(2000);

      expect(saveFn).not.toHaveBeenCalled();
    });

    it('should ignore markDirty after destroy', () => {
      const saver = new DebouncedSaver();
      saver.destroy();

      // Should not throw
      saver.markDirty();
      expect(saver.hasPendingChanges()).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = new DebouncedSaver({ delayMs: 100 });
      saver.setSaveFunction(saveFn);

      saver.markDirty();
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(100);

      expect(saver.getStats().totalRequests).toBe(2);

      saver.resetStats();

      expect(saver.getStats().totalRequests).toBe(0);
      expect(saver.getStats().actualSaves).toBe(0);

      saver.destroy();
    });
  });

  describe('createDebouncedSaver', () => {
    it('should create a saver with save function', async () => {
      const saveFn = vi.fn().mockResolvedValue(undefined);
      const saver = createDebouncedSaver(saveFn, { delayMs: 100 });

      saver.markDirty();
      await vi.advanceTimersByTimeAsync(100);

      expect(saveFn).toHaveBeenCalledTimes(1);

      saver.destroy();
    });
  });
});
