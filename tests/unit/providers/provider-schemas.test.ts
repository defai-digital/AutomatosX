/**
 * Tests for Zod Provider Schemas
 */

import { describe, it, expect } from 'vitest';
import {
  executionRequestSchema,
  executionResponseSchema,
  healthStatusSchema,
  providerCapabilitiesSchema,
  rateLimitStatusSchema,
  costEstimateSchema,
  usageStatsSchema,
  providerErrorSchema,
  validateExecutionRequest,
  validateExecutionResponse,
  validateHealthStatus,
  safeValidateExecutionRequest,
  safeValidateExecutionResponse
} from '../../../src/providers/provider-schemas.js';

describe('Provider Schemas - Zod Validation', () => {
  describe('Execution Request Schema', () => {
    it('should validate valid execution request', () => {
      const request = {
        prompt: 'Hello, world!',
        systemPrompt: 'You are a helpful assistant',
        model: 'claude-3-opus',
        maxTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        stream: false
      };

      const result = safeValidateExecutionRequest(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty prompt', () => {
      const request = {
        prompt: ''  // Empty not allowed
      };

      const result = safeValidateExecutionRequest(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('empty');
      }
    });

    it('should reject invalid temperature', () => {
      const request = {
        prompt: 'test',
        temperature: 3.0  // Must be 0-2
      };

      const result = safeValidateExecutionRequest(request);
      expect(result.success).toBe(false);
    });

    it('should reject invalid topP', () => {
      const request = {
        prompt: 'test',
        topP: 1.5  // Must be 0-1
      };

      const result = safeValidateExecutionRequest(request);
      expect(result.success).toBe(false);
    });

    it('should accept minimal valid request', () => {
      const request = {
        prompt: 'test'
      };

      const result = safeValidateExecutionRequest(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Execution Response Schema', () => {
    it('should validate valid execution response', () => {
      const response = {
        content: 'Response content',
        model: 'claude-3-opus',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latencyMs: 500,
        finishReason: 'stop',
        cached: false
      };

      const result = safeValidateExecutionResponse(response);
      expect(result.success).toBe(true);
    });

    it('should validate token usage consistency', () => {
      const response = {
        content: 'test',
        model: 'test',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 25  // Should be 30
        },
        latencyMs: 100,
        finishReason: 'stop',
        cached: false
      };

      const result = safeValidateExecutionResponse(response);
      expect(result.success).toBe(false);
    });

    it('should reject negative latency', () => {
      const response = {
        content: 'test',
        model: 'test',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latencyMs: -100,  // Negative not allowed
        finishReason: 'stop',
        cached: false
      };

      const result = safeValidateExecutionResponse(response);
      expect(result.success).toBe(false);
    });

    it('should validate finish reason enum', () => {
      const response = {
        content: 'test',
        model: 'test',
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latencyMs: 100,
        finishReason: 'invalid_reason',  // Not in enum
        cached: false
      };

      const result = safeValidateExecutionResponse(response as any);
      expect(result.success).toBe(false);
    });
  });

  describe('Health Status Schema', () => {
    it('should validate valid health status', () => {
      const status = {
        available: true,
        latencyMs: 50,
        errorRate: 0.05,
        consecutiveFailures: 0,
        lastCheckTime: Date.now()
      };

      const result = safeValidateExecutionResponse(status);
      expect(result.success).toBe(true);
    });

    it('should reject invalid error rate', () => {
      const status = {
        available: true,
        latencyMs: 50,
        errorRate: 1.5,  // Must be 0-1
        consecutiveFailures: 0
      };

      const result = safeValidateExecutionResponse(status);
      expect(result.success).toBe(false);
    });

    it('should reject negative consecutive failures', () => {
      const status = {
        available: true,
        latencyMs: 50,
        errorRate: 0.1,
        consecutiveFailures: -1  // Must be non-negative
      };

      const result = safeValidateExecutionResponse(status);
      expect(result.success).toBe(false);
    });
  });

  describe('Provider Capabilities Schema', () => {
    it('should validate valid capabilities', () => {
      const capabilities = {
        supportsStreaming: true,
        supportsEmbedding: false,
        supportsVision: true,
        supportsFunctionCalling: true,
        maxContextTokens: 200000,
        supportedModels: ['claude-3-opus', 'claude-3-sonnet']
      };

      const result = providerCapabilitiesSchema.safeParse(capabilities);
      expect(result.success).toBe(true);
    });

    it('should require at least one supported model', () => {
      const capabilities = {
        supportsStreaming: false,
        supportsEmbedding: false,
        supportsVision: false,
        supportsFunctionCalling: false,
        maxContextTokens: 128000,
        supportedModels: []  // Must have at least one
      };

      const result = providerCapabilitiesSchema.safeParse(capabilities);
      expect(result.success).toBe(false);
    });
  });

  describe('Rate Limit Status Schema', () => {
    it('should validate valid rate limit status', () => {
      const status = {
        hasCapacity: true,
        requestsRemaining: 100,
        tokensRemaining: 50000,
        resetAtMs: Date.now() + 3600000
      };

      const result = rateLimitStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });

    it('should reject negative remaining values', () => {
      const status = {
        hasCapacity: false,
        requestsRemaining: -1,  // Must be non-negative
        tokensRemaining: 0,
        resetAtMs: Date.now()
      };

      const result = rateLimitStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    });
  });

  describe('Cost Estimate Schema', () => {
    it('should validate valid cost estimate', () => {
      const estimate = {
        amount: 0.05,
        currency: 'USD',
        breakdown: {
          prompt: 0.02,
          completion: 0.03
        }
      };

      const result = costEstimateSchema.safeParse(estimate);
      expect(result.success).toBe(true);
    });

    it('should validate currency code length', () => {
      const estimate = {
        amount: 0.05,
        currency: 'US',  // Must be 3 characters
        breakdown: {
          prompt: 0.02,
          completion: 0.03
        }
      };

      const result = costEstimateSchema.safeParse(estimate);
      expect(result.success).toBe(false);
    });

    it('should reject negative costs', () => {
      const estimate = {
        amount: -0.05,  // Negative not allowed
        currency: 'USD',
        breakdown: {
          prompt: 0.02,
          completion: 0.03
        }
      };

      const result = costEstimateSchema.safeParse(estimate);
      expect(result.success).toBe(false);
    });
  });

  describe('Usage Stats Schema', () => {
    it('should validate valid usage stats', () => {
      const stats = {
        totalRequests: 1000,
        totalTokens: 50000,
        totalCost: 2.50,
        successRate: 0.98,
        averageLatencyMs: 250,
        lastRequestTime: Date.now()
      };

      const result = usageStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });

    it('should reject invalid success rate', () => {
      const stats = {
        totalRequests: 1000,
        totalTokens: 50000,
        totalCost: 2.50,
        successRate: 1.5  // Must be 0-1
      };

      const result = usageStatsSchema.safeParse(stats);
      expect(result.success).toBe(false);
    });
  });

  describe('Provider Error Schema', () => {
    it('should validate valid provider error', () => {
      const error = {
        type: 'timeout',
        message: 'Request timed out',
        code: 'ETIMEDOUT',
        retryable: true,
        details: {
          timeout: 30000,
          elapsed: 35000
        }
      };

      const result = providerErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate error type enum', () => {
      const error = {
        type: 'invalid_type',  // Not in enum
        message: 'Error',
        retryable: false
      };

      const result = providerErrorSchema.safeParse(error as any);
      expect(result.success).toBe(false);
    });
  });
});
