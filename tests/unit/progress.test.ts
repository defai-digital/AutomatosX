/**
 * Progress Indicator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressIndicator, createProgress } from '../../src/utils/progress.js';

describe('ProgressIndicator', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Constructor', () => {
    it('should create with default options', () => {
      const progress = new ProgressIndicator();
      expect(progress).toBeDefined();
      expect(progress.isSpinning()).toBe(false);
    });

    it('should create with custom options', () => {
      const progress = new ProgressIndicator({
        spinner: false,
        colors: false
      });
      expect(progress).toBeDefined();
    });
  });

  describe('Without spinner', () => {
    let progress: ProgressIndicator;

    beforeEach(() => {
      progress = new ProgressIndicator({ spinner: false });
    });

    it('should print message on start', () => {
      progress.start('Starting...');
      expect(consoleSpy).toHaveBeenCalledWith('Starting...');
    });

    it('should print message on update', () => {
      progress.start('Starting...');
      progress.update('Processing...');
      expect(consoleSpy).toHaveBeenCalledWith('Processing...');
    });

    it('should print success message', () => {
      progress.succeed('Done!');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should print failure message', () => {
      progress.fail('Failed!');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should print warning message', () => {
      progress.warn('Warning!');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should print info message', () => {
      progress.info('Info!');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Status methods', () => {
    it('should handle succeed', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.succeed('Success');
      expect(progress.isSpinning()).toBe(false);
    });

    it('should handle fail', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.fail('Failed');
      expect(progress.isSpinning()).toBe(false);
    });

    it('should handle warn', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.warn('Warning');
      expect(progress.isSpinning()).toBe(false);
    });

    it('should handle info', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.info('Information');
      expect(progress.isSpinning()).toBe(false);
    });

    it('should handle stop', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.start('Starting...');
      progress.stop();
      expect(progress.isSpinning()).toBe(false);
    });

    it('should handle clear', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.start('Starting...');
      progress.clear();
      // Should not throw
    });
  });

  describe('Factory function', () => {
    it('should create and start progress', () => {
      const progress = createProgress('Loading...');
      expect(progress).toBeDefined();
      expect(progress).toBeInstanceOf(ProgressIndicator);
    });

    it('should create with options', () => {
      const progress = createProgress('Loading...', { spinner: false });
      expect(progress).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('Loading...');
    });
  });

  describe('isSpinning', () => {
    it('should return false when not started', () => {
      const progress = new ProgressIndicator({ spinner: false });
      expect(progress.isSpinning()).toBe(false);
    });

    it('should return false after succeed', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.start('Starting...');
      progress.succeed('Done');
      expect(progress.isSpinning()).toBe(false);
    });

    it('should return false after fail', () => {
      const progress = new ProgressIndicator({ spinner: false });
      progress.start('Starting...');
      progress.fail('Error');
      expect(progress.isSpinning()).toBe(false);
    });
  });
});
