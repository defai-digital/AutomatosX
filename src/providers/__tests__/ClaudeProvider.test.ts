/**
 * Tests for Claude provider implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeProvider, CLAUDE_MODELS, createClaudeProvider } from '../ClaudeProvider.js'
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderNetworkError,
} from '../ProviderBase.js'
import Anthropic from '@anthropic-ai/sdk'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }))

  // Add error classes
  MockAnthropic.APIError = class APIError extends Error {
    constructor(public status: number, message: string, public headers?: Record<string, string>) {
      super(message)
      this.name = 'APIError'
    }
  }

  return {
    default: MockAnthropic,
    __mockCreate: mockCreate,
  }
})

const { __mockCreate: mockCreate } = await import('@anthropic-ai/sdk')

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new ClaudeProvider({
      enabled: true,
      apiKey: 'test-api-key',
      timeout: 5000,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create provider with default config', () => {
      expect(provider.name).toBe('claude')
      expect(provider.config.enabled).toBe(true)
      expect(provider.config.defaultModel).toBe(CLAUDE_MODELS['claude-sonnet-4-5'])
    })

    it('should use custom model from config', () => {
      const customProvider = new ClaudeProvider({
        enabled: true,
        apiKey: 'test-key',
        defaultModel: CLAUDE_MODELS['claude-opus-4'],
      })

      expect(customProvider.config.defaultModel).toBe(CLAUDE_MODELS['claude-opus-4'])
    })

    it('should fall back to environment variable for API key', () => {
      process.env.ANTHROPIC_API_KEY = 'env-api-key'

      const envProvider = new ClaudeProvider({
        enabled: true,
      })

      expect(envProvider.config.apiKey).toBe('env-api-key')

      delete process.env.ANTHROPIC_API_KEY
    })
  })

  describe('request', () => {
    it('should make successful request', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-sonnet-4-5'],
        content: [{ type: 'text', text: 'Hello, world!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const request = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
        maxTokens: 100,
        temperature: 1.0,
      }

      const response = await provider.request(request)

      expect(response.content).toBe('Hello, world!')
      expect(response.model).toBe(CLAUDE_MODELS['claude-sonnet-4-5'])
      expect(response.usage.inputTokens).toBe(10)
      expect(response.usage.outputTokens).toBe(5)
      expect(response.usage.totalTokens).toBe(15)
      expect(response.finishReason).toBe('stop')
      expect(response.provider).toBe('claude')
      expect(response.latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle multiple text blocks in response', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-sonnet-4-5'],
        content: [
          { type: 'text', text: 'First block' },
          { type: 'text', text: 'Second block' },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const response = await provider.request({
        messages: [{ role: 'user' as const, content: 'Test' }],
      })

      expect(response.content).toBe('First block\nSecond block')
    })

    it('should use custom model from request', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-haiku-4'],
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      await provider.request({
        model: CLAUDE_MODELS['claude-haiku-4'],
        messages: [{ role: 'user' as const, content: 'Test' }],
      })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: CLAUDE_MODELS['claude-haiku-4'],
        })
      )
    })

    it('should map max_tokens stop reason to length', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-sonnet-4-5'],
        content: [{ type: 'text', text: 'Truncated...' }],
        usage: { input_tokens: 10, output_tokens: 100 },
        stop_reason: 'max_tokens',
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const response = await provider.request({
        messages: [{ role: 'user' as const, content: 'Test' }],
      })

      expect(response.finishReason).toBe('length')
    })

    it('should throw ProviderAuthError on 401', async () => {
      const apiError = new (Anthropic as any).APIError(401, 'Invalid API key')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.request({
          messages: [{ role: 'user' as const, content: 'Test' }],
        })
      ).rejects.toThrow(ProviderAuthError)
    })

    it('should throw ProviderRateLimitError on 429', async () => {
      const apiError = new (Anthropic as any).APIError(429, 'Rate limit exceeded', {
        'retry-after': '60',
      })
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.request({
          messages: [{ role: 'user' as const, content: 'Test' }],
        })
      ).rejects.toThrow(ProviderRateLimitError)
    })

    it('should throw ProviderTimeoutError on 408', async () => {
      const apiError = new (Anthropic as any).APIError(408, 'Request timeout')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.request({
          messages: [{ role: 'user' as const, content: 'Test' }],
        })
      ).rejects.toThrow(ProviderTimeoutError)
    })

    it('should throw ProviderNetworkError on 500', async () => {
      const apiError = new (Anthropic as any).APIError(500, 'Internal server error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.request({
          messages: [{ role: 'user' as const, content: 'Test' }],
        })
      ).rejects.toThrow(ProviderNetworkError)
    })

    it('should retry on retryable errors', async () => {
      const apiError = new (Anthropic as any).APIError(503, 'Service unavailable')
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-sonnet-4-5'],
        content: [{ type: 'text', text: 'Success' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      }

      mockCreate
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(mockResponse)

      const response = await provider.request({
        messages: [{ role: 'user' as const, content: 'Test' }],
      })

      expect(response.content).toBe('Success')
      expect(mockCreate).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const apiError = new (Anthropic as any).APIError(401, 'Invalid API key')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.request({
          messages: [{ role: 'user' as const, content: 'Test' }],
        })
      ).rejects.toThrow(ProviderAuthError)

      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe('streamRequest', () => {
    it('should handle streaming response', async () => {
      const mockStream = [
        {
          type: 'message_start',
          message: {
            id: 'msg_123',
            model: CLAUDE_MODELS['claude-sonnet-4-5'],
            usage: { input_tokens: 10, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ' world' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 5 },
        },
      ]

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of mockStream) {
            yield event
          }
        },
      })

      const chunks: string[] = []
      const onChunk = vi.fn((chunk) => chunks.push(chunk.delta))

      const response = await provider.streamRequest(
        {
          messages: [{ role: 'user' as const, content: 'Test' }],
        },
        onChunk
      )

      expect(response.content).toBe('Hello world')
      expect(response.usage.inputTokens).toBe(10)
      expect(response.usage.outputTokens).toBe(5)
      expect(response.finishReason).toBe('stop')
      expect(onChunk).toHaveBeenCalledTimes(2)
      expect(chunks).toEqual(['Hello', ' world'])
    })

    it('should handle streaming errors', async () => {
      const apiError = new (Anthropic as any).APIError(500, 'Streaming error')
      mockCreate.mockRejectedValueOnce(apiError)

      await expect(
        provider.streamRequest(
          {
            messages: [{ role: 'user' as const, content: 'Test' }],
          },
          () => {}
        )
      ).rejects.toThrow(ProviderNetworkError)
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status on success', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: CLAUDE_MODELS['claude-sonnet-4-5'],
        content: [{ type: 'text', text: 'pong' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      }

      mockCreate.mockResolvedValueOnce(mockResponse)

      const health = await provider.healthCheck()

      expect(health.available).toBe(true)
      expect(health.latency).toBeGreaterThanOrEqual(0)
      expect(health.errorRate).toBe(0)
      expect(health.lastError).toBeUndefined()
    })

    it('should return unhealthy status on error', async () => {
      const apiError = new (Anthropic as any).APIError(500, 'Service down')
      mockCreate.mockRejectedValueOnce(apiError)

      const health = await provider.healthCheck()

      expect(health.available).toBe(false)
      expect(health.errorRate).toBe(1.0)
      expect(health.lastError).toBeDefined()
    })
  })

  describe('getAvailableModels', () => {
    it('should return list of Claude models', async () => {
      const models = await provider.getAvailableModels()

      expect(models).toContain(CLAUDE_MODELS['claude-sonnet-4-5'])
      expect(models).toContain(CLAUDE_MODELS['claude-opus-4'])
      expect(models).toContain(CLAUDE_MODELS['claude-haiku-4'])
    })
  })

  describe('validateConfig', () => {
    it('should validate enabled provider with API key', async () => {
      const result = await provider.validateConfig()
      expect(result).toBe(true)
    })

    it('should return false for disabled provider', async () => {
      const disabledProvider = new ClaudeProvider({
        enabled: false,
        apiKey: 'test-key',
      })

      const result = await disabledProvider.validateConfig()
      expect(result).toBe(false)
    })

    it('should throw error if no API key', async () => {
      const noKeyProvider = new ClaudeProvider({
        enabled: true,
      })

      await expect(noKeyProvider.validateConfig()).rejects.toThrow(ProviderAuthError)
    })
  })

  describe('createClaudeProvider', () => {
    it('should create provider with factory function', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key'

      const provider = createClaudeProvider()

      expect(provider).toBeInstanceOf(ClaudeProvider)
      expect(provider.config.enabled).toBe(true)

      delete process.env.ANTHROPIC_API_KEY
    })

    it('should merge custom config', () => {
      const provider = createClaudeProvider({
        apiKey: 'custom-key',
        timeout: 30000,
      })

      expect(provider.config.apiKey).toBe('custom-key')
      expect(provider.config.timeout).toBe(30000)
    })
  })
})
