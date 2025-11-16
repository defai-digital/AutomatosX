/**
 * OpenAI Embedding Provider Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIEmbeddingProvider } from '../../src/providers/openai-embedding-provider.js';
import { EmbeddingError } from '../../src/types/embedding.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('OpenAIEmbeddingProvider', () => {
  const validApiKey = 'sk-test-key-123';
  const mockEmbedding = new Array(1536).fill(0.1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create provider with valid config', () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      const info = provider.getInfo();
      expect(info.provider).toBe('openai');
      expect(info.model).toBe('text-embedding-3-small');
      expect(info.dimensions).toBe(1536);
    });

    it('should throw error when API key is missing', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          provider: 'openai'
        });
      }).toThrow(EmbeddingError);

      expect(() => {
        new OpenAIEmbeddingProvider({
          provider: 'openai'
        });
      }).toThrow('OpenAI API key is required');
    });

    it('should accept custom model and dimensions', () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        model: 'text-embedding-3-large',
        dimensions: 3072
      });

      const info = provider.getInfo();
      expect(info.model).toBe('text-embedding-3-large');
      expect(info.dimensions).toBe(3072);
    });
  });

  describe('embed()', () => {
    it('should generate embedding for valid text', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 }
        })
      });

      const result = await provider.embed('test text');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.model).toBe('text-embedding-3-small');
      expect(result.dimensions).toBe(1536);
      expect(result.usage).toEqual({
        promptTokens: 5,
        totalTokens: 5
      });

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validApiKey}`
          })
        })
      );
    });

    it('should throw error for empty text', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      await expect(provider.embed('')).rejects.toThrow(EmbeddingError);
      await expect(provider.embed('')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error for whitespace-only text', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      await expect(provider.embed('   ')).rejects.toThrow(EmbeddingError);
    });

    it('should retry on transient errors', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        maxRetries: 3,
        retryDelay: 10
      });

      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 5, total_tokens: 5 }
          })
        });

      const result = await provider.embed('test text');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on invalid API key error', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: 'invalid-key',
        maxRetries: 3
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' }
        })
      });

      await expect(provider.embed('test text')).rejects.toThrow(EmbeddingError);

      // Should only call once (no retries for auth errors)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error after max retries', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        maxRetries: 2,
        retryDelay: 10
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(provider.embed('test text')).rejects.toThrow(EmbeddingError);
      await expect(provider.embed('test text')).rejects.toThrow('Failed after 2 attempts');

      // Each call to embed() makes maxRetries attempts, so 2 * 2 = 4
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle HTTP error responses', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: 'Internal server error' }
        })
      });

      await expect(provider.embed('test text')).rejects.toThrow(EmbeddingError);
    });
  });

  describe('embedBatch()', () => {
    it('should generate embeddings for multiple texts', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      const embedding1 = new Array(1536).fill(0.1);
      const embedding2 = new Array(1536).fill(0.2);
      const embedding3 = new Array(1536).fill(0.3);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: embedding1 },
            { embedding: embedding2 },
            { embedding: embedding3 }
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 15, total_tokens: 15 }
        })
      });

      const results = await provider.embedBatch(['text1', 'text2', 'text3']);

      expect(results).toHaveLength(3);
      expect(results[0]?.embedding).toEqual(embedding1);
      expect(results[1]?.embedding).toEqual(embedding2);
      expect(results[2]?.embedding).toEqual(embedding3);

      // Usage should be divided by number of texts
      expect(results[0]?.usage?.promptTokens).toBe(5);
      expect(results[0]?.usage?.totalTokens).toBe(5);
    });

    it('should return empty array for empty input', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      const results = await provider.embedBatch([]);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error if any text is empty', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      await expect(
        provider.embedBatch(['text1', '', 'text3'])
      ).rejects.toThrow(EmbeddingError);

      await expect(
        provider.embedBatch(['text1', '', 'text3'])
      ).rejects.toThrow('All texts must be non-empty');
    });

    it('should handle batch error', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey
      });

      mockFetch.mockRejectedValueOnce(new Error('API error'));

      await expect(
        provider.embedBatch(['text1', 'text2'])
      ).rejects.toThrow(EmbeddingError);

      await expect(
        provider.embedBatch(['text1', 'text2'])
      ).rejects.toThrow('Batch embedding failed');
    });
  });

  describe('getInfo()', () => {
    it('should return correct provider info', () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        model: 'custom-model',
        dimensions: 2048
      });

      const info = provider.getInfo();

      expect(info).toEqual({
        provider: 'openai',
        model: 'custom-model',
        dimensions: 2048
      });
    });
  });

  describe('Timeout handling', () => {
    it('should timeout long-running requests', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        timeout: 100, // Very short timeout (100ms)
        maxRetries: 0 // No retries to speed up test
      });

      // Mock a delayed response that exceeds timeout
      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  data: [{ embedding: mockEmbedding }]
                })
              }),
            300 // Delay longer than timeout
          )
        )
      );

      // Should timeout and throw error
      // Note: The error message may vary depending on fetch implementation
      await expect(
        provider.embed('test text')
      ).rejects.toThrow(); // Just check that it throws an error
    });
  });

  describe('Error code detection', () => {
    it('should detect rate limit errors', async () => {
      const provider = new OpenAIEmbeddingProvider({
        provider: 'openai',
        apiKey: validApiKey,
        maxRetries: 1
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' }
        })
      });

      await expect(provider.embed('test text')).rejects.toThrow(EmbeddingError);
    });
  });
});
