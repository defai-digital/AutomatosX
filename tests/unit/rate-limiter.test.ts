/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../../src/mcp/middleware/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000,  // 1 second window
      maxRequests: 5   // 5 requests per second
    });
  });

  afterEach(() => {
    rateLimiter.stop();
  });

  describe('checkLimit', () => {
    it('should allow requests under limit', () => {
      const clientId = 'client1';

      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.checkLimit(clientId)).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const clientId = 'client1';

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId);
      }

      // Next request should be blocked
      expect(rateLimiter.checkLimit(clientId)).toBe(false);
    });

    it('should track different clients separately', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client2');

      // Client1 should have 2 requests, client2 should have 1
      expect(rateLimiter.getRemainingRequests('client1')).toBe(3);
      expect(rateLimiter.getRemainingRequests('client2')).toBe(4);
    });

    it('should reset after window expires', async () => {
      const clientId = 'client1';

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId);
      }

      expect(rateLimiter.checkLimit(clientId)).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow requests again
      expect(rateLimiter.checkLimit(clientId)).toBe(true);
    });

    it('should block client for remainder of window', () => {
      const clientId = 'client1';

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId);
      }

      // Check multiple times - should stay blocked
      expect(rateLimiter.checkLimit(clientId)).toBe(false);
      expect(rateLimiter.checkLimit(clientId)).toBe(false);
      expect(rateLimiter.checkLimit(clientId)).toBe(false);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return full limit for new client', () => {
      expect(rateLimiter.getRemainingRequests('new-client')).toBe(5);
    });

    it('should decrease as requests are made', () => {
      const clientId = 'client1';

      rateLimiter.checkLimit(clientId);
      expect(rateLimiter.getRemainingRequests(clientId)).toBe(4);

      rateLimiter.checkLimit(clientId);
      expect(rateLimiter.getRemainingRequests(clientId)).toBe(3);
    });

    it('should return 0 when limit exceeded', () => {
      const clientId = 'client1';

      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId);
      }

      expect(rateLimiter.getRemainingRequests(clientId)).toBe(0);
    });
  });

  describe('getResetTime', () => {
    it('should return 0 for new client', () => {
      expect(rateLimiter.getResetTime('new-client')).toBe(0);
    });

    it('should return time until oldest request expires', () => {
      const clientId = 'client1';

      rateLimiter.checkLimit(clientId);
      const resetTime = rateLimiter.getResetTime(clientId);

      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(1000);
    });
  });

  describe('recordSuccess', () => {
    it('should not count successful requests when skipSuccessfulRequests is true', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5,
        skipSuccessfulRequests: true
      });

      const clientId = 'client1';

      limiter.checkLimit(clientId);
      limiter.recordSuccess(clientId);

      // Request should be removed
      expect(limiter.getRemainingRequests(clientId)).toBe(5);

      limiter.stop();
    });
  });

  describe('recordFailure', () => {
    it('should not count failed requests when skipFailedRequests is true', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5,
        skipFailedRequests: true
      });

      const clientId = 'client1';

      limiter.checkLimit(clientId);
      limiter.recordFailure(clientId);

      // Request should be removed
      expect(limiter.getRemainingRequests(clientId)).toBe(5);

      limiter.stop();
    });
  });

  describe('resetClient', () => {
    it('should reset rate limit for specific client', () => {
      const clientId = 'client1';

      rateLimiter.checkLimit(clientId);
      rateLimiter.checkLimit(clientId);
      expect(rateLimiter.getRemainingRequests(clientId)).toBe(3);

      rateLimiter.resetClient(clientId);
      expect(rateLimiter.getRemainingRequests(clientId)).toBe(5);
    });
  });

  describe('resetAll', () => {
    it('should reset all rate limits', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client2');

      rateLimiter.resetAll();

      expect(rateLimiter.getRemainingRequests('client1')).toBe(5);
      expect(rateLimiter.getRemainingRequests('client2')).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client1');
      rateLimiter.checkLimit('client2');

      const stats = rateLimiter.getStats();

      expect(stats.totalClients).toBe(2);
      expect(stats.activeRequests).toBe(3);
      expect(stats.blockedClients).toBe(0);
    });

    it('should count blocked clients', () => {
      const clientId = 'client1';

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(clientId);
      }

      // Trigger block
      rateLimiter.checkLimit(clientId);

      const stats = rateLimiter.getStats();
      expect(stats.blockedClients).toBe(1);
    });
  });
});
