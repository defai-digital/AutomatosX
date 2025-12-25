import { describe, it, expect } from 'vitest';
import {
  // Cache schemas
  MCPCacheEntrySchema,
  MCPCacheConfigSchema,
  MCPCacheStatsSchema,
  CacheGetResultSchema,
  EvictionResultSchema,

  // Timeout schemas
  MCPTimeoutConfigSchema,
  TimeoutResultSchema,
  ToolCategorySchema,
  TOOL_CATEGORIES,
  getToolTimeout,

  // Response schemas
  MCPErrorCodeSchema,
  MCPStructuredErrorSchema,
  MCPResponseMetadataSchema,
  MCPPaginationSchema,
  MCPResponseLimitsSchema,
  isRetryableError,
  RETRYABLE_ERRORS,

  // Limits schemas
  MCPRequestLimitsSchema,
  ValidationErrorSchema,
  ValidationResultSchema,
  TOOL_ARRAY_FIELDS,
  getArrayLimit,
} from '@defai.digital/contracts';

describe('MCP Runtime Contracts', () => {
  // ==========================================================================
  // Cache Contracts
  // ==========================================================================
  describe('Cache Contracts', () => {
    describe('MCPCacheEntrySchema', () => {
      it('should validate valid cache entry', () => {
        const entry = {
          key: 'test-key',
          value: { data: 'test' },
          sizeBytes: 100,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 5,
          ttlMs: 3600000,
        };

        expect(() => MCPCacheEntrySchema.parse(entry)).not.toThrow();
      });

      it('should reject entry with empty key', () => {
        const entry = {
          key: '',
          value: 'test',
          sizeBytes: 10,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        };

        expect(() => MCPCacheEntrySchema.parse(entry)).toThrow();
      });

      it('should reject negative sizeBytes', () => {
        const entry = {
          key: 'test',
          value: 'test',
          sizeBytes: -1,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        };

        expect(() => MCPCacheEntrySchema.parse(entry)).toThrow();
      });
    });

    describe('MCPCacheConfigSchema', () => {
      it('should provide sensible defaults', () => {
        const config = MCPCacheConfigSchema.parse({});

        expect(config.maxSizeBytes).toBe(104_857_600); // 100MB
        expect(config.maxEntries).toBe(10_000);
        expect(config.evictionPolicy).toBe('lru');
        expect(config.highWaterMark).toBe(0.9);
        expect(config.lowWaterMark).toBe(0.7);
      });

      it('should reject invalid eviction policy', () => {
        expect(() =>
          MCPCacheConfigSchema.parse({ evictionPolicy: 'invalid' })
        ).toThrow();
      });

      it('should reject high water mark > 1', () => {
        expect(() =>
          MCPCacheConfigSchema.parse({ highWaterMark: 1.5 })
        ).toThrow();
      });
    });

    describe('MCPCacheStatsSchema', () => {
      it('should validate valid stats', () => {
        const stats = {
          entryCount: 100,
          currentSizeBytes: 50_000_000,
          maxSizeBytes: 100_000_000,
          hitCount: 500,
          missCount: 100,
          hitRate: 0.833,
          evictionCount: 50,
          pressureLevel: 'medium',
        };

        expect(() => MCPCacheStatsSchema.parse(stats)).not.toThrow();
      });

      it('should validate all pressure levels', () => {
        for (const level of ['low', 'medium', 'high', 'critical']) {
          const stats = {
            entryCount: 0,
            currentSizeBytes: 0,
            maxSizeBytes: 100,
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            evictionCount: 0,
            pressureLevel: level,
          };

          expect(() => MCPCacheStatsSchema.parse(stats)).not.toThrow();
        }
      });
    });
  });

  // ==========================================================================
  // Timeout Contracts
  // ==========================================================================
  describe('Timeout Contracts', () => {
    describe('MCPTimeoutConfigSchema', () => {
      it('should provide sensible defaults', () => {
        const config = MCPTimeoutConfigSchema.parse({});

        expect(config.defaultTimeoutMs).toBe(30_000);
        expect(config.toolTimeouts.query).toBe(10_000);
        expect(config.toolTimeouts.mutation).toBe(30_000);
        expect(config.toolTimeouts.scan).toBe(120_000);
        expect(config.toolTimeouts.execution).toBe(1_200_000); // 20 minutes
      });

      it('should allow custom timeouts', () => {
        const config = MCPTimeoutConfigSchema.parse({
          toolTimeouts: {
            query: 5_000,
          },
        });

        expect(config.toolTimeouts.query).toBe(5_000);
      });

      it('should allow tool overrides', () => {
        const config = MCPTimeoutConfigSchema.parse({
          toolOverrides: {
            special_tool: 60_000,
          },
        });

        expect(config.toolOverrides.special_tool).toBe(60_000);
      });
    });

    describe('TimeoutResultSchema', () => {
      it('should validate completed result', () => {
        const result = {
          status: 'completed',
          result: { data: 'test' },
          durationMs: 100,
        };

        expect(() => TimeoutResultSchema.parse(result)).not.toThrow();
      });

      it('should validate timeout result', () => {
        const result = {
          status: 'timeout',
          timeoutMs: 5000,
          durationMs: 5001,
        };

        expect(() => TimeoutResultSchema.parse(result)).not.toThrow();
      });

      it('should validate error result', () => {
        const result = {
          status: 'error',
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong',
          },
          durationMs: 50,
        };

        expect(() => TimeoutResultSchema.parse(result)).not.toThrow();
      });
    });

    describe('TOOL_CATEGORIES', () => {
      it('should categorize query tools', () => {
        expect(TOOL_CATEGORIES.memory_retrieve).toBe('query');
        expect(TOOL_CATEGORIES.agent_list).toBe('query');
        expect(TOOL_CATEGORIES.session_status).toBe('query');
      });

      it('should categorize mutation tools', () => {
        expect(TOOL_CATEGORIES.memory_store).toBe('mutation');
        expect(TOOL_CATEGORIES.agent_register).toBe('mutation');
        expect(TOOL_CATEGORIES.session_create).toBe('mutation');
      });

      it('should categorize scan tools', () => {
        expect(TOOL_CATEGORIES.review_analyze).toBe('scan');
        expect(TOOL_CATEGORIES.trace_analyze).toBe('scan');
      });

      it('should categorize execution tools', () => {
        expect(TOOL_CATEGORIES.agent_run).toBe('execution');
        expect(TOOL_CATEGORIES.workflow_run).toBe('execution');
      });
    });

    describe('getToolTimeout', () => {
      it('should return category timeout for known tools', () => {
        const config = MCPTimeoutConfigSchema.parse({});

        expect(getToolTimeout('memory_retrieve', config)).toBe(10_000); // query
        expect(getToolTimeout('memory_store', config)).toBe(30_000); // mutation
        expect(getToolTimeout('review_analyze', config)).toBe(120_000); // scan
        expect(getToolTimeout('agent_run', config)).toBe(1_200_000); // execution
      });

      it('should return override if defined', () => {
        const config = MCPTimeoutConfigSchema.parse({
          toolOverrides: {
            memory_retrieve: 5_000,
          },
        });

        expect(getToolTimeout('memory_retrieve', config)).toBe(5_000);
      });

      it('should return default for unknown tools', () => {
        const config = MCPTimeoutConfigSchema.parse({});

        expect(getToolTimeout('unknown_tool', config)).toBe(30_000);
      });
    });
  });

  // ==========================================================================
  // Response Contracts
  // ==========================================================================
  describe('Response Contracts', () => {
    describe('MCPErrorCodeSchema', () => {
      it('should validate all error codes', () => {
        const codes = [
          'INVALID_INPUT',
          'NOT_FOUND',
          'TOOL_TIMEOUT',
          'INTERNAL_ERROR',
          'RATE_LIMITED',
          'MEMORY_PRESSURE',
        ];

        for (const code of codes) {
          expect(() => MCPErrorCodeSchema.parse(code)).not.toThrow();
        }
      });

      it('should reject invalid codes', () => {
        expect(() => MCPErrorCodeSchema.parse('INVALID_CODE')).toThrow();
      });
    });

    describe('MCPStructuredErrorSchema', () => {
      it('should validate complete error', () => {
        const error = {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          context: { resourceId: '123' },
          retryable: false,
        };

        expect(() => MCPStructuredErrorSchema.parse(error)).not.toThrow();
      });

      it('should default retryable to false', () => {
        const error = {
          code: 'INTERNAL_ERROR',
          message: 'Error',
        };

        const parsed = MCPStructuredErrorSchema.parse(error);
        expect(parsed.retryable).toBe(false);
      });
    });

    describe('isRetryableError', () => {
      it('should identify retryable errors', () => {
        expect(isRetryableError('TOOL_TIMEOUT')).toBe(true);
        expect(isRetryableError('RATE_LIMITED')).toBe(true);
        expect(isRetryableError('MEMORY_PRESSURE')).toBe(true);
        expect(isRetryableError('SERVICE_UNAVAILABLE')).toBe(true);
      });

      it('should identify non-retryable errors', () => {
        expect(isRetryableError('INVALID_INPUT')).toBe(false);
        expect(isRetryableError('NOT_FOUND')).toBe(false);
        expect(isRetryableError('INTERNAL_ERROR')).toBe(false);
      });
    });

    describe('MCPResponseLimitsSchema', () => {
      it('should provide sensible defaults', () => {
        const limits = MCPResponseLimitsSchema.parse({});

        expect(limits.maxResponseBytes).toBe(1_048_576); // 1MB
        expect(limits.maxListItems).toBe(100);
        expect(limits.maxStringLength).toBe(10_000);
      });
    });

    describe('MCPPaginationSchema', () => {
      it('should validate pagination', () => {
        const pagination = {
          total: 100,
          limit: 10,
          offset: 20,
          hasMore: true,
        };

        expect(() => MCPPaginationSchema.parse(pagination)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Limits Contracts
  // ==========================================================================
  describe('Limits Contracts', () => {
    describe('MCPRequestLimitsSchema', () => {
      it('should provide sensible defaults', () => {
        const limits = MCPRequestLimitsSchema.parse({});

        expect(limits.maxArraySize).toBe(100);
        expect(limits.maxStringLength).toBe(100_000);
        expect(limits.maxObjectDepth).toBe(10);
        expect(limits.maxRequestBytes).toBe(10_485_760); // 10MB
      });

      it('should include tool-specific array limits', () => {
        const limits = MCPRequestLimitsSchema.parse({});

        expect(limits.toolArrayLimits.review_analyze).toBe(100);
        expect(limits.toolArrayLimits.memory_bulk_delete).toBe(1000);
      });
    });

    describe('ValidationErrorSchema', () => {
      it('should validate error with all fields', () => {
        const error = {
          path: 'items[0].name',
          code: 'STRING_TOO_LONG',
          message: 'String too long',
          limit: 100,
          actual: 200,
        };

        expect(() => ValidationErrorSchema.parse(error)).not.toThrow();
      });

      it('should validate all error codes', () => {
        const codes = [
          'ARRAY_TOO_LARGE',
          'STRING_TOO_LONG',
          'OBJECT_TOO_DEEP',
          'REQUEST_TOO_LARGE',
          'INVALID_TYPE',
          'REQUIRED_FIELD',
        ];

        for (const code of codes) {
          const error = {
            path: 'test',
            code,
            message: 'Error',
          };

          expect(() => ValidationErrorSchema.parse(error)).not.toThrow();
        }
      });
    });

    describe('ValidationResultSchema', () => {
      it('should validate success result', () => {
        const result = { valid: true };

        expect(() => ValidationResultSchema.parse(result)).not.toThrow();
      });

      it('should validate failure result', () => {
        const result = {
          valid: false,
          errors: [
            {
              path: 'items',
              code: 'ARRAY_TOO_LARGE',
              message: 'Array too large',
              limit: 100,
              actual: 200,
            },
          ],
        };

        expect(() => ValidationResultSchema.parse(result)).not.toThrow();
      });

      it('should require at least one error on failure', () => {
        const result = {
          valid: false,
          errors: [],
        };

        expect(() => ValidationResultSchema.parse(result)).toThrow();
      });
    });

    describe('TOOL_ARRAY_FIELDS', () => {
      it('should define array fields for review_analyze', () => {
        expect(TOOL_ARRAY_FIELDS.review_analyze).toContain('paths');
        expect(TOOL_ARRAY_FIELDS.review_analyze).toContain('excludePatterns');
      });

      it('should define array fields for memory_bulk_delete', () => {
        expect(TOOL_ARRAY_FIELDS.memory_bulk_delete).toContain('keys');
      });
    });

    describe('getArrayLimit', () => {
      it('should return tool-specific limit when defined', () => {
        const limits = MCPRequestLimitsSchema.parse({
          toolArrayLimits: { custom_tool: 50 },
        });

        expect(getArrayLimit('custom_tool', 'items', limits)).toBe(50);
      });

      it('should return global limit for unknown tools', () => {
        const limits = MCPRequestLimitsSchema.parse({});

        expect(getArrayLimit('unknown_tool', 'items', limits)).toBe(100);
      });
    });
  });
});
