/**
 * MSW (Mock Service Worker) Handlers for Provider API Mocking
 *
 * Provides HTTP handlers for mocking external AI provider APIs in tests.
 * These handlers can be used for integration tests without hitting real APIs.
 *
 * @module tests/helpers/msw-handlers
 * @since v12.8.3
 */

import { http, HttpResponse, delay } from 'msw';
import { faker } from '@faker-js/faker';

// ============================================================================
// Types
// ============================================================================

export interface MockResponseOptions {
  /** Artificial delay in ms (default: 50-200ms random) */
  latency?: number;
  /** Should the request fail? */
  shouldFail?: boolean;
  /** Error status code if shouldFail is true */
  errorStatus?: number;
  /** Error message if shouldFail is true */
  errorMessage?: string;
  /** Custom response content */
  content?: string;
  /** Model name to return */
  model?: string;
  /** Token counts to return */
  tokens?: { prompt: number; completion: number };
}

// ============================================================================
// Response Generators
// ============================================================================

/**
 * Generate a mock OpenAI chat completion response
 */
function generateOpenAIChatResponse(options: MockResponseOptions = {}) {
  const promptTokens = options.tokens?.prompt ?? faker.number.int({ min: 50, max: 500 });
  const completionTokens = options.tokens?.completion ?? faker.number.int({ min: 100, max: 1000 });

  return {
    id: `chatcmpl-${faker.string.alphanumeric(29)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: options.model ?? 'gpt-4o-2024-05-13',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: options.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
        },
        logprobs: null,
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    system_fingerprint: `fp_${faker.string.alphanumeric(10)}`,
  };
}

/**
 * Generate a mock OpenAI embedding response
 */
function generateOpenAIEmbeddingResponse(inputCount: number = 1) {
  return {
    object: 'list',
    data: Array.from({ length: inputCount }, (_, i) => ({
      object: 'embedding',
      index: i,
      embedding: faker.helpers.multiple(
        () => faker.number.float({ min: -1, max: 1, fractionDigits: 8 }),
        { count: 1536 }
      ),
    })),
    model: 'text-embedding-3-small',
    usage: {
      prompt_tokens: inputCount * faker.number.int({ min: 5, max: 20 }),
      total_tokens: inputCount * faker.number.int({ min: 5, max: 20 }),
    },
  };
}

/**
 * Generate a mock Anthropic message response
 */
function generateAnthropicMessageResponse(options: MockResponseOptions = {}) {
  const inputTokens = options.tokens?.prompt ?? faker.number.int({ min: 50, max: 500 });
  const outputTokens = options.tokens?.completion ?? faker.number.int({ min: 100, max: 1000 });

  return {
    id: `msg_${faker.string.alphanumeric(24)}`,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: options.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
      },
    ],
    model: options.model ?? 'claude-3-opus-20240229',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/**
 * Generate a mock Google Gemini response
 */
function generateGeminiResponse(options: MockResponseOptions = {}) {
  const promptTokens = options.tokens?.prompt ?? faker.number.int({ min: 50, max: 500 });
  const completionTokens = options.tokens?.completion ?? faker.number.int({ min: 100, max: 1000 });

  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: options.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
            },
          ],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: [
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' },
        ],
      },
    ],
    promptFeedback: {
      safetyRatings: [
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' },
      ],
    },
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: completionTokens,
      totalTokenCount: promptTokens + completionTokens,
    },
    modelVersion: options.model ?? 'gemini-1.5-pro',
  };
}

/**
 * Generate a mock Zhipu AI (GLM) response
 */
function generateGLMResponse(options: MockResponseOptions = {}) {
  const promptTokens = options.tokens?.prompt ?? faker.number.int({ min: 50, max: 500 });
  const completionTokens = options.tokens?.completion ?? faker.number.int({ min: 100, max: 1000 });

  return {
    id: faker.string.alphanumeric(32),
    created: Math.floor(Date.now() / 1000),
    model: options.model ?? 'glm-4',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: options.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
        },
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate a mock xAI (Grok) response
 */
function generateGrokResponse(options: MockResponseOptions = {}) {
  const promptTokens = options.tokens?.prompt ?? faker.number.int({ min: 50, max: 500 });
  const completionTokens = options.tokens?.completion ?? faker.number.int({ min: 100, max: 1000 });

  return {
    id: `grok-${faker.string.alphanumeric(24)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: options.model ?? 'grok-2',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: options.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Generate an error response
 */
function generateErrorResponse(status: number, message: string, provider: string) {
  const errorTemplates: Record<string, (msg: string) => object> = {
    openai: (msg) => ({
      error: {
        message: msg,
        type: status === 429 ? 'rate_limit_error' : 'api_error',
        code: status === 429 ? 'rate_limit_exceeded' : 'internal_error',
      },
    }),
    anthropic: (msg) => ({
      type: 'error',
      error: {
        type: status === 429 ? 'rate_limit_error' : 'api_error',
        message: msg,
      },
    }),
    gemini: (msg) => ({
      error: {
        code: status,
        message: msg,
        status: status === 429 ? 'RESOURCE_EXHAUSTED' : 'INTERNAL',
      },
    }),
    glm: (msg) => ({
      error: {
        code: status.toString(),
        message: msg,
      },
    }),
    grok: (msg) => ({
      error: {
        message: msg,
        type: status === 429 ? 'rate_limit_error' : 'api_error',
      },
    }),
  };

  return errorTemplates[provider]?.(message) ?? { error: { message } };
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create handlers with configurable behavior
 */
export function createProviderHandlers(defaultOptions: MockResponseOptions = {}) {
  const getLatency = (options: MockResponseOptions) =>
    options.latency ?? defaultOptions.latency ?? faker.number.int({ min: 50, max: 200 });

  return [
    // ========================================================================
    // OpenAI API Handlers
    // ========================================================================

    // Chat completions
    http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
      await delay(getLatency(defaultOptions));

      if (defaultOptions.shouldFail) {
        return HttpResponse.json(
          generateErrorResponse(
            defaultOptions.errorStatus ?? 500,
            defaultOptions.errorMessage ?? 'Internal server error',
            'openai'
          ),
          { status: defaultOptions.errorStatus ?? 500 }
        );
      }

      return HttpResponse.json(generateOpenAIChatResponse(defaultOptions));
    }),

    // Embeddings
    http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
      await delay(getLatency(defaultOptions));

      if (defaultOptions.shouldFail) {
        return HttpResponse.json(
          generateErrorResponse(
            defaultOptions.errorStatus ?? 500,
            defaultOptions.errorMessage ?? 'Internal server error',
            'openai'
          ),
          { status: defaultOptions.errorStatus ?? 500 }
        );
      }

      const body = (await request.json()) as { input: string | string[] };
      const inputCount = Array.isArray(body.input) ? body.input.length : 1;
      return HttpResponse.json(generateOpenAIEmbeddingResponse(inputCount));
    }),

    // ========================================================================
    // Anthropic API Handlers
    // ========================================================================

    http.post('https://api.anthropic.com/v1/messages', async () => {
      await delay(getLatency(defaultOptions));

      if (defaultOptions.shouldFail) {
        return HttpResponse.json(
          generateErrorResponse(
            defaultOptions.errorStatus ?? 500,
            defaultOptions.errorMessage ?? 'Internal server error',
            'anthropic'
          ),
          { status: defaultOptions.errorStatus ?? 500 }
        );
      }

      return HttpResponse.json(generateAnthropicMessageResponse(defaultOptions));
    }),

    // ========================================================================
    // Google Gemini API Handlers
    // ========================================================================

    // Gemini generateContent - use regex pattern for path with colon
    http.post(
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/[^/]+:generateContent$/,
      async () => {
        await delay(getLatency(defaultOptions));

        if (defaultOptions.shouldFail) {
          return HttpResponse.json(
            generateErrorResponse(
              defaultOptions.errorStatus ?? 500,
              defaultOptions.errorMessage ?? 'Internal server error',
              'gemini'
            ),
            { status: defaultOptions.errorStatus ?? 500 }
          );
        }

        return HttpResponse.json(generateGeminiResponse(defaultOptions));
      }
    ),

    // ========================================================================
    // Zhipu AI (GLM) API Handlers
    // ========================================================================

    http.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', async () => {
      await delay(getLatency(defaultOptions));

      if (defaultOptions.shouldFail) {
        return HttpResponse.json(
          generateErrorResponse(
            defaultOptions.errorStatus ?? 500,
            defaultOptions.errorMessage ?? 'Internal server error',
            'glm'
          ),
          { status: defaultOptions.errorStatus ?? 500 }
        );
      }

      return HttpResponse.json(generateGLMResponse(defaultOptions));
    }),

    // ========================================================================
    // xAI (Grok) API Handlers
    // ========================================================================

    http.post('https://api.x.ai/v1/chat/completions', async () => {
      await delay(getLatency(defaultOptions));

      if (defaultOptions.shouldFail) {
        return HttpResponse.json(
          generateErrorResponse(
            defaultOptions.errorStatus ?? 500,
            defaultOptions.errorMessage ?? 'Internal server error',
            'grok'
          ),
          { status: defaultOptions.errorStatus ?? 500 }
        );
      }

      return HttpResponse.json(generateGrokResponse(defaultOptions));
    }),
  ];
}

// ============================================================================
// Preset Handler Collections
// ============================================================================

/**
 * Default handlers with realistic latency
 */
export const defaultHandlers = createProviderHandlers();

/**
 * Fast handlers with minimal latency (for quick tests)
 */
export const fastHandlers = createProviderHandlers({ latency: 10 });

/**
 * Slow handlers for timeout testing
 */
export const slowHandlers = createProviderHandlers({ latency: 5000 });

/**
 * Error handlers that always fail
 */
export const errorHandlers = createProviderHandlers({
  shouldFail: true,
  errorStatus: 500,
  errorMessage: 'Simulated server error',
});

/**
 * Rate limit handlers
 */
export const rateLimitHandlers = createProviderHandlers({
  shouldFail: true,
  errorStatus: 429,
  errorMessage: 'Rate limit exceeded. Please retry after 60 seconds.',
});

// ============================================================================
// Custom Handler Builders
// ============================================================================

/**
 * Create a handler that fails after N successful requests
 */
export function createFailAfterNHandler(n: number, options: MockResponseOptions = {}) {
  let requestCount = 0;

  return http.post('*', async ({ request }) => {
    requestCount++;
    await delay(options.latency ?? 50);

    if (requestCount > n) {
      return HttpResponse.json(
        generateErrorResponse(
          options.errorStatus ?? 500,
          options.errorMessage ?? 'Server error after quota',
          'openai'
        ),
        { status: options.errorStatus ?? 500 }
      );
    }

    return HttpResponse.json(generateOpenAIChatResponse(options));
  });
}

/**
 * Create a handler with random failures
 */
export function createFlakyHandler(failureRate: number = 0.3, options: MockResponseOptions = {}) {
  return http.post('*', async () => {
    await delay(options.latency ?? faker.number.int({ min: 50, max: 200 }));

    if (Math.random() < failureRate) {
      return HttpResponse.json(
        generateErrorResponse(500, 'Random failure', 'openai'),
        { status: 500 }
      );
    }

    return HttpResponse.json(generateOpenAIChatResponse(options));
  });
}

/**
 * Create a streaming response handler for OpenAI
 */
export function createStreamingHandler(options: MockResponseOptions = {}) {
  return http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = (await request.json()) as { stream?: boolean };

    if (!body.stream) {
      return HttpResponse.json(generateOpenAIChatResponse(options));
    }

    const content = options.content ?? faker.lorem.paragraphs(2);
    const words = content.split(' ');
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          if (word === undefined) continue;
          const chunk = {
            id: `chatcmpl-${faker.string.alphanumeric(29)}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: options.model ?? 'gpt-4o',
            choices: [
              {
                index: 0,
                delta: { content: (i === 0 ? '' : ' ') + word },
                finish_reason: null,
              },
            ],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        // Final chunk
        const finalChunk = {
          id: `chatcmpl-${faker.string.alphanumeric(29)}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: options.model ?? 'gpt-4o',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
}

// ============================================================================
// Test Setup Utilities
// ============================================================================

export { http, HttpResponse, delay };

/**
 * Re-export setupServer for convenience
 * Usage in tests:
 *
 * import { setupServer } from 'msw/node';
 * import { defaultHandlers } from './msw-handlers';
 *
 * const server = setupServer(...defaultHandlers);
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 */
