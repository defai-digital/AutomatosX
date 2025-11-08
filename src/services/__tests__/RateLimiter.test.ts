/**
 * RateLimiter.test.ts
 *
 * Tests for token bucket rate limiter
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from '../RateLimiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  // Helper to wait for milliseconds
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create limiter with specified rate and burst', () => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });

      expect(limiter.getRate()).toBe(60);
      expect(limiter.getBurst()).toBe(10);
    });

    it('should start with full bucket', () => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });

      expect(limiter.getAvailableTokens()).toBe(10);
    });

    it('should handle high rate', () => {
      limiter = new RateLimiter({ rate: 6000, burst: 100 });

      expect(limiter.getRate()).toBe(6000);
      expect(limiter.getBurst()).toBe(100);
    });

    it('should handle low rate', () => {
      limiter = new RateLimiter({ rate: 1, burst: 1 });

      expect(limiter.getRate()).toBe(1);
      expect(limiter.getBurst()).toBe(1);
    });
  });

  describe('canSubmit', () => {
    beforeEach(() => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should allow submission when tokens available', () => {
      expect(limiter.canSubmit(1)).toBe(true);
      expect(limiter.canSubmit(5)).toBe(true);
      expect(limiter.canSubmit(10)).toBe(true);
    });

    it('should reject when insufficient tokens', () => {
      expect(limiter.canSubmit(11)).toBe(false);
      expect(limiter.canSubmit(100)).toBe(false);
    });

    it('should not consume tokens when checking', () => {
      limiter.canSubmit(5);
      expect(limiter.getAvailableTokens()).toBe(10); // Still full
    });

    it('should allow checking multiple times', () => {
      expect(limiter.canSubmit(5)).toBe(true);
      expect(limiter.canSubmit(5)).toBe(true);
      expect(limiter.canSubmit(5)).toBe(true);
    });
  });

  describe('consume', () => {
    beforeEach(() => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should consume tokens successfully', () => {
      expect(limiter.consume(1)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(9);
    });

    it('should consume multiple tokens', () => {
      expect(limiter.consume(5)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(5);
    });

    it('should reject when insufficient tokens', () => {
      expect(limiter.consume(11)).toBe(false);
      expect(limiter.getAvailableTokens()).toBe(10); // No tokens consumed
    });

    it('should not consume tokens on failed attempt', () => {
      limiter.consume(5); // Success, 5 left
      expect(limiter.consume(10)).toBe(false); // Fail, still 5 left
      expect(limiter.getAvailableTokens()).toBe(5);
    });

    it('should handle consuming all tokens', () => {
      expect(limiter.consume(10)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(0);
      expect(limiter.consume(1)).toBe(false);
    });

    it('should handle sequential consumption', () => {
      expect(limiter.consume(3)).toBe(true); // 7 left
      expect(limiter.consume(3)).toBe(true); // 4 left
      expect(limiter.consume(3)).toBe(true); // 1 left
      expect(limiter.consume(3)).toBe(false); // Rejected
      expect(limiter.getAvailableTokens()).toBe(1);
    });
  });

  describe('token refill', () => {
    beforeEach(() => {
      // 60 events/min = 1 event/second = 1 token per 1000ms
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should refill tokens over time', () => {
      limiter.consume(10); // Empty bucket
      expect(limiter.getAvailableTokens()).toBe(0);

      // Advance 1 second = 1 token
      vi.advanceTimersByTime(1000);
      expect(limiter.getAvailableTokens()).toBe(1);
    });

    it('should refill at correct rate', () => {
      limiter.consume(10); // Empty bucket

      // 60 events/min = 1 event/sec
      vi.advanceTimersByTime(5000); // 5 seconds
      expect(limiter.getAvailableTokens()).toBe(5);
    });

    it('should not exceed burst capacity', () => {
      limiter.consume(5); // 5 left

      // Wait long enough to overflow
      vi.advanceTimersByTime(10000); // 10 seconds would add 10 tokens
      expect(limiter.getAvailableTokens()).toBe(10); // Capped at burst
    });

    it('should refill incrementally', () => {
      limiter.consume(10);

      vi.advanceTimersByTime(1000); // +1 token
      expect(limiter.getAvailableTokens()).toBe(1);

      vi.advanceTimersByTime(1000); // +1 token
      expect(limiter.getAvailableTokens()).toBe(2);

      vi.advanceTimersByTime(1000); // +1 token
      expect(limiter.getAvailableTokens()).toBe(3);
    });

    it('should handle partial refills', () => {
      limiter.consume(10);

      // 500ms = 0.5 tokens (floor to 0)
      vi.advanceTimersByTime(500);
      expect(limiter.getAvailableTokens()).toBe(0);

      // Another 500ms = total 1 token
      vi.advanceTimersByTime(500);
      expect(limiter.getAvailableTokens()).toBe(1);
    });
  });

  describe('getWaitTime', () => {
    beforeEach(() => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should return 0 when tokens available', () => {
      expect(limiter.getWaitTime()).toBe(0);
    });

    it('should return wait time when no tokens', () => {
      limiter.consume(10);

      // 60 events/min = 1 event/sec = 1000ms per token
      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(1000);
    });

    it('should decrease wait time as time passes', () => {
      limiter.consume(10);

      const wait1 = limiter.getWaitTime();

      vi.advanceTimersByTime(500); // Half the time

      const wait2 = limiter.getWaitTime();
      expect(wait2).toBeLessThan(wait1);
    });

    it('should return 0 after sufficient wait', () => {
      limiter.consume(10);

      vi.advanceTimersByTime(1000); // 1 token refilled

      expect(limiter.getWaitTime()).toBe(0);
    });
  });

  describe('getAvailableTokens', () => {
    beforeEach(() => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should return floor of token count', () => {
      limiter.consume(10);
      vi.advanceTimersByTime(500); // 0.5 tokens

      expect(limiter.getAvailableTokens()).toBe(0); // Floor(0.5) = 0
    });

    it('should reflect consumption', () => {
      expect(limiter.getAvailableTokens()).toBe(10);
      limiter.consume(3);
      expect(limiter.getAvailableTokens()).toBe(7);
    });

    it('should reflect refills', () => {
      limiter.consume(10);
      expect(limiter.getAvailableTokens()).toBe(0);

      vi.advanceTimersByTime(3000);
      expect(limiter.getAvailableTokens()).toBe(3);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
    });

    it('should reset to full bucket', () => {
      limiter.consume(7);
      expect(limiter.getAvailableTokens()).toBe(3);

      limiter.reset();
      expect(limiter.getAvailableTokens()).toBe(10);
    });

    it('should reset from empty bucket', () => {
      limiter.consume(10);
      expect(limiter.getAvailableTokens()).toBe(0);

      limiter.reset();
      expect(limiter.getAvailableTokens()).toBe(10);
    });

    it('should reset refill timer', () => {
      limiter.consume(10);
      vi.advanceTimersByTime(500);

      limiter.reset();

      // Should not have accumulated partial tokens
      expect(limiter.getAvailableTokens()).toBe(10);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle burst then sustained rate', () => {
      // 60 events/min, burst 10
      limiter = new RateLimiter({ rate: 60, burst: 10 });

      // Burst: consume 10 immediately
      for (let i = 0; i < 10; i++) {
        expect(limiter.consume(1)).toBe(true);
      }
      expect(limiter.consume(1)).toBe(false); // 11th fails

      // Wait 1 second, get 1 more token
      vi.advanceTimersByTime(1000);
      expect(limiter.consume(1)).toBe(true);
      expect(limiter.consume(1)).toBe(false);

      // Wait 1 more second
      vi.advanceTimersByTime(1000);
      expect(limiter.consume(1)).toBe(true);
    });

    it('should handle high-rate scenario', () => {
      // 600 events/min = 10 events/second
      limiter = new RateLimiter({ rate: 600, burst: 20 });

      limiter.consume(20); // Empty

      // Every 100ms should get 1 token
      vi.advanceTimersByTime(100);
      expect(limiter.getAvailableTokens()).toBe(1);

      vi.advanceTimersByTime(100);
      expect(limiter.getAvailableTokens()).toBe(2);
    });

    it('should handle low-rate scenario', () => {
      // 6 events/min = 1 event per 10 seconds
      limiter = new RateLimiter({ rate: 6, burst: 2 });

      limiter.consume(2); // Empty

      vi.advanceTimersByTime(10000); // 10 seconds
      expect(limiter.getAvailableTokens()).toBe(1);

      vi.advanceTimersByTime(10000); // 10 more seconds
      expect(limiter.getAvailableTokens()).toBe(2); // Capped at burst
    });

    it('should handle batch submission with rate limiting', () => {
      limiter = new RateLimiter({ rate: 60, burst: 5 });

      // Try to submit batch of 10, but only 5 fit
      expect(limiter.consume(10)).toBe(false);

      // Submit 5 successfully
      expect(limiter.consume(5)).toBe(true);

      // Wait for 5 more tokens
      vi.advanceTimersByTime(5000);

      // Submit remaining 5
      expect(limiter.consume(5)).toBe(true);
    });

    it('should enforce rate over extended period', () => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });

      let submitted = 0;

      // Simulate 60 seconds of submissions at max rate
      for (let sec = 0; sec < 60; sec++) {
        while (limiter.canSubmit(1)) {
          limiter.consume(1);
          submitted++;
        }
        vi.advanceTimersByTime(1000);
      }

      // Should have submitted approximately 60 events over 60 seconds
      // Initial burst of 10 + 60 from refills = 70 total
      expect(submitted).toBeGreaterThanOrEqual(60);
      expect(submitted).toBeLessThanOrEqual(70);
    });
  });

  describe('configuration getters', () => {
    it('should return configured rate', () => {
      limiter = new RateLimiter({ rate: 120, burst: 20 });
      expect(limiter.getRate()).toBe(120);
    });

    it('should return configured burst', () => {
      limiter = new RateLimiter({ rate: 60, burst: 15 });
      expect(limiter.getBurst()).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('should handle zero consumption', () => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
      expect(limiter.consume(0)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(10);
    });

    it('should handle rate of 1 event/min', () => {
      limiter = new RateLimiter({ rate: 1, burst: 1 });

      limiter.consume(1);
      expect(limiter.getAvailableTokens()).toBe(0);

      vi.advanceTimersByTime(60000); // 1 minute
      expect(limiter.getAvailableTokens()).toBe(1);
    });

    it('should handle very high burst', () => {
      limiter = new RateLimiter({ rate: 60, burst: 1000 });
      expect(limiter.getAvailableTokens()).toBe(1000);

      expect(limiter.consume(500)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(500);
    });

    it('should handle fractional token accumulation correctly', () => {
      limiter = new RateLimiter({ rate: 60, burst: 10 });
      limiter.consume(10);

      // Advance by small increments
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100); // Total 1 second
      }

      expect(limiter.getAvailableTokens()).toBe(1);
    });
  });
});
