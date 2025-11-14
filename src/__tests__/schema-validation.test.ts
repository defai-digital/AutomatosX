/**
 * Schema validation tests
 * Sprint 3 Day 27: Zod schema tests
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  ProviderConfigSchema,
  ProviderRequestSchema,
  ProviderResponseSchema,
} from '../providers/ProviderBase.js'

describe('Schema Validation', () => {
  describe('ProviderConfigSchema', () => {
    it('should validate valid configuration', () => {
      const config = {
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'test-model',
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should provide defaults for optional fields', () => {
      const config = {
        enabled: true,
        priority: 1,
      }

      const result = ProviderConfigSchema.parse(config)
      expect(result.maxRetries).toBe(3)
      expect(result.timeout).toBe(60000)
    })

    it('should reject invalid enabled type', () => {
      const config = {
        enabled: 'yes',
        priority: 1,
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('should reject negative maxRetries', () => {
      const config = {
        enabled: true,
        priority: 1,
        maxRetries: -1,
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('should reject zero or negative timeout', () => {
      const config = {
        enabled: true,
        priority: 1,
        timeout: 0,
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('should reject negative priority', () => {
      const config = {
        enabled: true,
        priority: -1,
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('should accept extra fields with passthrough', () => {
      const config = {
        enabled: true,
        priority: 1,
        customField: 'custom-value',
      }

      const result = ProviderConfigSchema.parse(config)
      expect(result).toHaveProperty('customField')
    })

    it('should validate apiKey as string', () => {
      const config = {
        enabled: true,
        priority: 1,
        apiKey: 123,
      }

      const result = ProviderConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })
  })

  describe('ProviderRequestSchema', () => {
    it('should validate valid request', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        maxTokens: 4096,
        temperature: 1.0,
        streaming: false,
        timeout: 60000,
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should provide defaults for optional fields', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      }

      const result = ProviderRequestSchema.parse(request)
      expect(result.maxTokens).toBe(4096)
      expect(result.temperature).toBe(1.0)
      expect(result.streaming).toBe(false)
      expect(result.timeout).toBe(60000)
    })

    it('should validate message roles', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
          { role: 'system', content: 'System message' },
        ],
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should reject invalid message role', () => {
      const request = {
        messages: [
          { role: 'invalid', content: 'Hello' },
        ],
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject empty messages array', () => {
      const request = {
        messages: [],
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject negative maxTokens', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: -100,
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject temperature out of range', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 3.0, // Max is 2.0
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should accept temperature = 0', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0,
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should accept temperature = 2', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 2.0,
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    it('should reject message without content', () => {
      const request = {
        messages: [
          { role: 'user' },
        ],
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should reject message without role', () => {
      const request = {
        messages: [
          { content: 'Hello' },
        ],
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    it('should validate optional model field', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBe('gpt-4')
      }
    })

    it('should validate streaming boolean', () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: true,
      }

      const result = ProviderRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })
  })

  describe('ProviderResponseSchema', () => {
    it('should validate valid response', () => {
      const response = {
        content: 'Hello, world!',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
        latency: 1500,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate usage object', () => {
      const response = {
        content: 'Response',
        model: 'claude-3',
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
        finishReason: 'stop',
        latency: 2000,
        provider: 'claude',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should reject negative token counts', () => {
      const response = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: -10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
        latency: 1500,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should reject negative latency', () => {
      const response = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
        latency: -100,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should validate finish reason enum', () => {
      const validReasons = ['stop', 'length', 'tool_use', 'content_filter', 'error']

      for (const reason of validReasons) {
        const response = {
          content: 'Response',
          model: 'gpt-4',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          finishReason: reason,
          latency: 1500,
          provider: 'openai',
        }

        const result = ProviderResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid finish reason', () => {
      const response = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'invalid_reason',
        latency: 1500,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should require all usage fields', () => {
      const response = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          // Missing completionTokens and totalTokens
        },
        finishReason: 'stop',
        latency: 1500,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })

    it('should accept empty content string', () => {
      const response = {
        content: '',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 0,
          totalTokens: 10,
        },
        finishReason: 'stop',
        latency: 500,
        provider: 'openai',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate provider name', () => {
      const response = {
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
        latency: 1500,
        provider: 'custom-provider',
      }

      const result = ProviderResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('Schema Integration', () => {
    it('should validate request-response cycle', () => {
      const request = ProviderRequestSchema.parse({
        messages: [{ role: 'user', content: 'Calculate 2+2' }],
      })

      expect(request).toBeDefined()
      expect(request.messages).toHaveLength(1)

      const response = ProviderResponseSchema.parse({
        content: '4',
        model: 'gpt-4',
        usage: {
          promptTokens: 5,
          completionTokens: 1,
          totalTokens: 6,
        },
        finishReason: 'stop',
        latency: 500,
        provider: 'openai',
      })

      expect(response).toBeDefined()
      expect(response.content).toBe('4')
    })

    it('should provide type safety', () => {
      const request = ProviderRequestSchema.parse({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      // TypeScript should infer these types
      expect(typeof request.messages[0].role).toBe('string')
      expect(typeof request.messages[0].content).toBe('string')
      expect(typeof request.maxTokens).toBe('number')
      expect(typeof request.temperature).toBe('number')
      expect(typeof request.streaming).toBe('boolean')
      expect(typeof request.timeout).toBe('number')
    })

    it('should validate at runtime boundaries', () => {
      // This simulates receiving data from external source
      const externalData: any = {
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 'invalid', // Wrong type
      }

      const result = ProviderRequestSchema.safeParse(externalData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Error Messages', () => {
    it('should provide descriptive error messages', () => {
      const invalidRequest = {
        messages: [], // Empty array not allowed
      }

      const result = ProviderRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errorMessage = result.error.issues[0].message
        expect(errorMessage).toBeTruthy()
      }
    })

    it('should identify which field failed validation', () => {
      const invalidConfig = {
        enabled: true,
        priority: 1,
        maxRetries: -1, // Invalid
      }

      const result = ProviderConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errorPath = result.error.issues[0].path
        expect(errorPath).toContain('maxRetries')
      }
    })
  })
})
