import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryProfiler } from '../../../src/utils/memory-profiler';

describe('MemoryProfiler', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.AUTOMATOSX_PROFILE;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUTOMATOSX_PROFILE;
    } else {
      process.env.AUTOMATOSX_PROFILE = originalEnv;
    }
  });

  describe('constructor', () => {
    it('should be enabled when AUTOMATOSX_PROFILE=true', () => {
      process.env.AUTOMATOSX_PROFILE = 'true';
      const profiler = new MemoryProfiler();
      expect(profiler.isEnabled()).toBe(true);
    });

    it('should be disabled when AUTOMATOSX_PROFILE is not set', () => {
      delete process.env.AUTOMATOSX_PROFILE;
      const profiler = new MemoryProfiler();
      expect(profiler.isEnabled()).toBe(false);
    });

    it('should respect explicit enabled parameter', () => {
      const profiler = new MemoryProfiler(true);
      expect(profiler.isEnabled()).toBe(true);
    });
  });

  describe('takeSnapshot', () => {
    it('should capture memory snapshot when enabled', () => {
      const profiler = new MemoryProfiler(true);
      const snapshot = profiler.takeSnapshot('test');

      expect(snapshot).toBeDefined();
      expect(snapshot?.label).toBe('test');
      expect(snapshot?.heapUsed).toBeGreaterThan(0);
      expect(snapshot?.heapTotal).toBeGreaterThan(0);
      expect(snapshot?.rss).toBeGreaterThan(0);
      expect(snapshot?.timestamp).toBeGreaterThan(0);
    });

    it('should return undefined when disabled', () => {
      const profiler = new MemoryProfiler(false);
      const snapshot = profiler.takeSnapshot('test');

      expect(snapshot).toBeUndefined();
    });

    it('should capture multiple snapshots', () => {
      const profiler = new MemoryProfiler(true);
      profiler.takeSnapshot('snapshot1');
      profiler.takeSnapshot('snapshot2');

      const snapshots = profiler.getSnapshots();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]?.label).toBe('snapshot1');
      expect(snapshots[1]?.label).toBe('snapshot2');
    });
  });

  describe('generateReport', () => {
    it('should generate report with snapshots', () => {
      const profiler = new MemoryProfiler(true);
      profiler.takeSnapshot('before');
      profiler.takeSnapshot('after');

      const report = profiler.generateReport();

      expect(report).toContain('Memory Profile Report');
      expect(report).toContain('before');
      expect(report).toContain('after');
      expect(report).toContain('Heap Used');
      expect(report).toContain('Heap Delta');
    });

    it('should return message when no snapshots', () => {
      const profiler = new MemoryProfiler(true);
      const report = profiler.generateReport();

      expect(report).toBe('No memory snapshots captured.\n');
    });
  });

  describe('getSnapshots', () => {
    it('should return all snapshots', () => {
      const profiler = new MemoryProfiler(true);
      profiler.takeSnapshot('s1');
      profiler.takeSnapshot('s2');

      const snapshots = profiler.getSnapshots();
      expect(snapshots).toHaveLength(2);
    });

    it('should return empty array when no snapshots', () => {
      const profiler = new MemoryProfiler(true);
      expect(profiler.getSnapshots()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all snapshots', () => {
      const profiler = new MemoryProfiler(true);
      profiler.takeSnapshot('s1');
      profiler.takeSnapshot('s2');

      expect(profiler.getSnapshots()).toHaveLength(2);

      profiler.clear();
      expect(profiler.getSnapshots()).toHaveLength(0);
    });
  });
});
