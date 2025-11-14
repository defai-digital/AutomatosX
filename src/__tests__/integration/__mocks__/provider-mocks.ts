/**
 * Mock implementations for provider SDKs
 * Used by integration tests to simulate provider responses
 */

import { vi } from 'vitest'

/**
 * Mock Anthropic SDK
 */
export class MockAnthropic {
  messages = {
    create: vi.fn().mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Mock Claude response',
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    }),
  }
}

/**
 * Mock Google Generative AI
 */
export class MockGoogleGenerativeAI {
  getGenerativeModel() {
    return {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'Mock Gemini response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        },
      }),
    }
  }
}

/**
 * Mock OpenAI SDK
 */
export class MockOpenAI {
  chat = {
    completions: {
      create: vi.fn().mockResolvedValue({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mock OpenAI response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      }),
    },
  }
}

/**
 * Set up all provider mocks
 */
export function setupProviderMocks() {
  // Mock @anthropic-ai/sdk
  vi.mock('@anthropic-ai/sdk', () => {
    return {
      default: MockAnthropic,
    }
  })

  // Mock @google/generative-ai
  vi.mock('@google/generative-ai', () => {
    return {
      GoogleGenerativeAI: MockGoogleGenerativeAI,
    }
  })

  // Mock openai
  vi.mock('openai', () => {
    return {
      default: MockOpenAI,
    }
  })
}
