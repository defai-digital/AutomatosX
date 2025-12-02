/**
 * ProgressChannel Unit Tests
 *
 * Tests the event-based progress system with throttling and backpressure handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressChannel, ProgressEvent } from '../../src/core/progress-channel.js';

describe('ProgressChannel', () => {
  let channel: ProgressChannel;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Basic subscription', () => {
    it('should subscribe and receive events', () => {
      channel = new ProgressChannel();
      const listener = vi.fn();

      channel.subscribe(listener);

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      channel.emit(event);

      expect(listener).toHaveBeenCalledWith(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      channel = new ProgressChannel();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      channel.subscribe(listener1);
      channel.subscribe(listener2);

      const event: ProgressEvent = {
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      channel.emit(event);

      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should unsubscribe listeners', () => {
      channel = new ProgressChannel();
      const listener = vi.fn();

      const unsubscribe = channel.subscribe(listener);

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      channel.emit(event);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Emit again - should not be called
      channel.emit(event);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Event throttling', () => {
    it('should NOT throttle critical events (stage-start)', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit 3 critical events in quick succession
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation'
      });

      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 2,
        stageName: 'Testing'
      });

      // All 3 should be emitted immediately
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('should NOT throttle critical events (stage-complete)', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation'
      });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should NOT throttle critical events (stage-error)', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      channel.emit({
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        message: 'Error occurred'
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should NOT throttle critical events (user-prompt)', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      channel.emit({
        type: 'user-prompt',
        timestamp: new Date(),
        message: 'Confirm action?'
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should throttle non-critical events (stage-progress)', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit 3 progress events in quick succession
      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 10
      });

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 20
      });

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 30
      });

      // Only first event should be emitted immediately
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 10 })
      );

      // Fast-forward time to process queue
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 20 })
      );

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 30 })
      );
    });

    it('should throttle token-stream events', () => {
      channel = new ProgressChannel({ throttleMs: 50 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit multiple token events
      channel.emit({
        type: 'token-stream',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        token: 'Hello'
      });

      channel.emit({
        type: 'token-stream',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        token: ' '
      });

      channel.emit({
        type: 'token-stream',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        token: 'world'
      });

      // Only first token should be emitted immediately
      expect(listener).toHaveBeenCalledTimes(1);

      // Process queued tokens
      vi.advanceTimersByTime(50);
      expect(listener).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(50);
      expect(listener).toHaveBeenCalledTimes(3);
    });
  });

  describe('Queue processing', () => {
    it('should process all queued events eventually', () => {
      channel = new ProgressChannel({ throttleMs: 50 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit 5 progress events
      for (let i = 0; i < 5; i++) {
        channel.emit({
          type: 'stage-progress',
          timestamp: new Date(),
          stageIndex: 0,
          stageName: 'Planning',
          progress: i * 10
        });
      }

      // First event emitted immediately
      expect(listener).toHaveBeenCalledTimes(1);

      // Advance time to process all queued events
      vi.advanceTimersByTime(50 * 4); // 4 more events * 50ms each

      // All events should be processed
      expect(listener).toHaveBeenCalledTimes(5);
    });

    it('should handle empty queue gracefully', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit one event
      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 50
      });

      expect(listener).toHaveBeenCalledTimes(1);

      // Advance time when queue is empty
      vi.advanceTimersByTime(100);

      // Should not cause any errors
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should catch and log listener errors', () => {
      channel = new ProgressChannel();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      channel.subscribe(errorListener);
      channel.subscribe(normalListener);

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      channel.emit(event);

      // Error listener should be called
      expect(errorListener).toHaveBeenCalledWith(event);

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ProgressChannel listener error:',
        expect.any(Error)
      );

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalledWith(event);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Clear and cleanup', () => {
    it('should clear all listeners', () => {
      channel = new ProgressChannel();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      channel.subscribe(listener1);
      channel.subscribe(listener2);

      expect(channel.listenerCount).toBe(2);

      channel.clear();

      expect(channel.listenerCount).toBe(0);

      // Emit event - no listeners should be called
      channel.emit({
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should clear pending events', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit multiple progress events (will be queued)
      for (let i = 0; i < 5; i++) {
        channel.emit({
          type: 'stage-progress',
          timestamp: new Date(),
          stageIndex: 0,
          stageName: 'Planning',
          progress: i * 10
        });
      }

      expect(listener).toHaveBeenCalledTimes(1);

      // Clear before queue is processed
      channel.clear();

      // Advance time
      vi.advanceTimersByTime(500);

      // No more events should be processed
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom throttle configuration', () => {
    it('should use custom throttle interval', () => {
      channel = new ProgressChannel({ throttleMs: 200 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit 2 progress events
      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 10
      });

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 20
      });

      expect(listener).toHaveBeenCalledTimes(1);

      // Advance by 100ms (less than throttle)
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(1);

      // Advance by another 100ms (total 200ms)
      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should use default 100ms if not specified', () => {
      channel = new ProgressChannel(); // No throttleMs specified
      const listener = vi.fn();
      channel.subscribe(listener);

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 10
      });

      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 20
      });

      expect(listener).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Listener count', () => {
    it('should report correct listener count', () => {
      channel = new ProgressChannel();

      expect(channel.listenerCount).toBe(0);

      const unsubscribe1 = channel.subscribe(vi.fn());
      expect(channel.listenerCount).toBe(1);

      const unsubscribe2 = channel.subscribe(vi.fn());
      expect(channel.listenerCount).toBe(2);

      unsubscribe1();
      expect(channel.listenerCount).toBe(1);

      unsubscribe2();
      expect(channel.listenerCount).toBe(0);
    });
  });

  describe('Mixed event types', () => {
    it('should handle mixed critical and non-critical events correctly', () => {
      channel = new ProgressChannel({ throttleMs: 100 });
      const listener = vi.fn();
      channel.subscribe(listener);

      // Emit progress event (throttled)
      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 10
      });

      // Emit critical event (not throttled)
      channel.emit({
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      });

      // Both should be emitted immediately
      expect(listener).toHaveBeenCalledTimes(2);

      // Emit another progress event (throttled)
      channel.emit({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation',
        progress: 5
      });

      // Should be queued
      expect(listener).toHaveBeenCalledTimes(2);

      // Advance time
      vi.advanceTimersByTime(100);

      // Queued event should be processed
      expect(listener).toHaveBeenCalledTimes(3);
    });
  });
});
