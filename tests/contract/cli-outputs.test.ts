/**
 * CLI Output Consumer-Driven Contract Tests
 *
 * These tests validate that the output-parser and error-classifier
 * correctly handle real CLI outputs from all providers.
 *
 * Invariants tested:
 * - INV-CLI-PARSE-001: Parse without exception
 * - INV-CLI-PARSE-002: Content extraction accuracy
 * - INV-CLI-PARSE-003: Error classification coverage
 * - INV-CLI-PARSE-004: ANSI stripping
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  CLIOutputFixtureSchema,
  type CLIOutputFixture,
  type CLIOutputFormat,
} from '@defai.digital/contracts';

import {
  parseOutput,
  classifyError,
  type ParsedOutput,
  type ClassifiedError,
} from '@defai.digital/provider-adapters';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/cli-outputs');

// Provider IDs to test
const PROVIDERS = ['claude', 'gemini', 'codex', 'qwen', 'glm', 'grok'] as const;

/**
 * Loads all fixtures for a provider
 */
function loadProviderFixtures(provider: string): CLIOutputFixture[] {
  const providerDir = join(FIXTURES_DIR, provider);

  if (!existsSync(providerDir)) {
    return [];
  }

  const files = readdirSync(providerDir).filter((f) => f.endsWith('.json'));
  const fixtures: CLIOutputFixture[] = [];

  for (const file of files) {
    const filePath = join(providerDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as unknown;

    // Validate fixture against schema
    const result = CLIOutputFixtureSchema.safeParse(data);
    if (result.success) {
      fixtures.push(result.data);
    } else {
      console.warn(`Invalid fixture ${filePath}:`, result.error.message);
    }
  }

  return fixtures;
}

describe('CLI Output Consumer-Driven Contracts', () => {
  describe('Fixture Schema Validation', () => {
    for (const provider of PROVIDERS) {
      it(`${provider} fixtures should be valid`, () => {
        const providerDir = join(FIXTURES_DIR, provider);

        if (!existsSync(providerDir)) {
          // Skip if directory doesn't exist yet
          return;
        }

        const files = readdirSync(providerDir).filter((f) => f.endsWith('.json'));

        for (const file of files) {
          const filePath = join(providerDir, file);
          const content = readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content) as unknown;

          const result = CLIOutputFixtureSchema.safeParse(data);
          expect(
            result.success,
            `Fixture ${file} should be valid: ${result.success ? '' : result.error.message}`
          ).toBe(true);
        }
      });
    }
  });

  describe('INV-CLI-PARSE-001: Parse Without Exception', () => {
    it('should not throw on empty input', () => {
      expect(() => parseOutput('', 'text')).not.toThrow();
      expect(() => parseOutput('', 'json')).not.toThrow();
      expect(() => parseOutput('', 'stream-json')).not.toThrow();
    });

    it('should not throw on malformed JSON', () => {
      expect(() => parseOutput('{invalid json', 'json')).not.toThrow();
      expect(() => parseOutput('{invalid}\n{also invalid}', 'stream-json')).not.toThrow();
    });

    it('should not throw on binary garbage', () => {
      const garbage = Buffer.from([0x00, 0x01, 0xff, 0xfe]).toString();
      expect(() => parseOutput(garbage, 'text')).not.toThrow();
    });

    for (const provider of PROVIDERS) {
      const fixtures = loadProviderFixtures(provider);

      for (const fixture of fixtures) {
        it(`${provider}/${fixture.scenario} should parse without exception`, () => {
          expect(() =>
            parseOutput(fixture.rawOutput.stdout, fixture.outputFormat)
          ).not.toThrow();
        });
      }
    }
  });

  describe('INV-CLI-PARSE-002: Content Extraction Accuracy', () => {
    for (const provider of PROVIDERS) {
      const fixtures = loadProviderFixtures(provider);
      const successFixtures = fixtures.filter((f) => !f.expected.isError);

      for (const fixture of successFixtures) {
        it(`${provider}/${fixture.scenario} should extract correct content`, () => {
          const result = parseOutput(fixture.rawOutput.stdout, fixture.outputFormat);

          expect(result.content).toBe(fixture.expected.content);
        });
      }
    }

    it('should extract content from Anthropic-style content blocks', () => {
      const anthropicOutput = JSON.stringify({
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World!' },
        ],
      });

      const result = parseOutput(anthropicOutput, 'json');
      expect(result.content).toBe('Hello World!');
    });

    it('should extract content from OpenAI-style choices', () => {
      const openaiOutput = JSON.stringify({
        choices: [{ message: { content: 'Hello from OpenAI!' } }],
      });

      const result = parseOutput(openaiOutput, 'json');
      expect(result.content).toBe('Hello from OpenAI!');
    });

    it('should extract content from assistant role messages', () => {
      const assistantOutput = '{"role":"assistant","content":"Hello from assistant!"}';

      const result = parseOutput(assistantOutput, 'stream-json');
      expect(result.content).toBe('Hello from assistant!');
    });

    it('should skip user role messages', () => {
      const mixedOutput = [
        '{"role":"user","content":"What is 2+2?"}',
        '{"role":"assistant","content":"4"}',
      ].join('\n');

      const result = parseOutput(mixedOutput, 'stream-json');
      expect(result.content).toBe('4');
    });
  });

  describe('INV-CLI-PARSE-003: Error Classification Coverage', () => {
    // Test all error categories have correct guidance
    const errorCategoryTests: {
      category: string;
      patterns: string[];
      shouldRetry: boolean;
      shouldFallback: boolean;
    }[] = [
      {
        category: 'quota',
        patterns: ['insufficient_quota', 'RESOURCE_EXHAUSTED', 'quota_exceeded'],
        shouldRetry: false,
        shouldFallback: true,
      },
      {
        category: 'rate_limit',
        patterns: ['rate_limit', 'too_many_requests', '429'],
        shouldRetry: true,
        shouldFallback: false,
      },
      {
        category: 'authentication',
        patterns: ['invalid_api_key', 'unauthorized', '401', '403'],
        shouldRetry: false,
        shouldFallback: false,
      },
      {
        category: 'validation',
        patterns: ['invalid_request', 'bad_request', '400'],
        shouldRetry: false,
        shouldFallback: false,
      },
      {
        category: 'network',
        patterns: ['ECONNRESET', 'ETIMEDOUT', 'socket_hang_up'],
        shouldRetry: true,
        shouldFallback: true,
      },
      {
        category: 'server',
        patterns: ['internal_server_error', '500', '503'],
        shouldRetry: true,
        shouldFallback: true,
      },
      {
        category: 'timeout',
        patterns: ['timed_out', 'timeout', 'SIGTERM'],
        shouldRetry: true,
        shouldFallback: true,
      },
      {
        category: 'not_found',
        patterns: ['command_not_found', 'ENOENT', '404'],
        shouldRetry: false,
        shouldFallback: true,
      },
      {
        category: 'configuration',
        patterns: ['not_configured', 'missing_config'],
        shouldRetry: false,
        shouldFallback: false,
      },
    ];

    for (const test of errorCategoryTests) {
      describe(`${test.category} category`, () => {
        for (const pattern of test.patterns) {
          it(`should classify "${pattern}" correctly`, () => {
            const error = classifyError(`Error: ${pattern} occurred`);

            expect(error.category).toBe(test.category);
            expect(error.shouldRetry).toBe(test.shouldRetry);
            expect(error.shouldFallback).toBe(test.shouldFallback);
          });
        }
      });
    }

    it('should classify unknown errors with fallback enabled', () => {
      const error = classifyError('Something unexpected happened');

      expect(error.category).toBe('unknown');
      expect(error.shouldRetry).toBe(false);
      expect(error.shouldFallback).toBe(true);
    });

    // Test error fixtures
    for (const provider of PROVIDERS) {
      const fixtures = loadProviderFixtures(provider);
      const errorFixtures = fixtures.filter((f) => f.expected.isError);

      for (const fixture of errorFixtures) {
        it(`${provider}/${fixture.scenario} should classify error correctly`, () => {
          const errorText = fixture.rawOutput.stderr || fixture.rawOutput.stdout;
          const error = classifyError(errorText);

          expect(error.category).toBe(fixture.expected.errorCategory);
        });
      }
    }
  });

  describe('INV-CLI-PARSE-004: ANSI Stripping', () => {
    it('should strip ANSI color codes', () => {
      const coloredOutput = '\x1b[32mSuccess!\x1b[0m';
      const result = parseOutput(coloredOutput, 'text');

      expect(result.content).toBe('Success!');
    });

    it('should strip ANSI cursor movement codes', () => {
      const cursorOutput = '\x1b[2K\x1b[1GProcessing... Done!';
      const result = parseOutput(cursorOutput, 'text');

      expect(result.content).toBe('Processing... Done!');
    });

    it('should strip multiple ANSI sequences', () => {
      const complexOutput = '\x1b[1m\x1b[34mBlue Bold\x1b[0m and \x1b[31mRed\x1b[0m';
      const result = parseOutput(complexOutput, 'text');

      expect(result.content).toBe('Blue Bold and Red');
    });

    it('should handle JSON with embedded ANSI codes', () => {
      const jsonWithAnsi = '\x1b[0m{"content":"Hello"}\x1b[0m';
      const result = parseOutput(jsonWithAnsi, 'json');

      expect(result.content).toBe('Hello');
    });
  });

  describe('Provider Output Format Documentation', () => {
    it('should have fixtures for all providers', () => {
      for (const provider of PROVIDERS) {
        const fixtures = loadProviderFixtures(provider);
        expect(
          fixtures.length,
          `Provider ${provider} should have at least one fixture`
        ).toBeGreaterThan(0);
      }
    });

    it('should have at least one success fixture per provider', () => {
      for (const provider of PROVIDERS) {
        const fixtures = loadProviderFixtures(provider);
        const successFixtures = fixtures.filter((f) => !f.expected.isError);

        expect(
          successFixtures.length,
          `Provider ${provider} should have at least one success fixture`
        ).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty JSON object', () => {
      const result = parseOutput('{}', 'json');
      expect(result.content).toBe('');
    });

    it('should handle empty array', () => {
      const result = parseOutput('[]', 'json');
      expect(result.content).toBe('');
    });

    it('should handle nested content field', () => {
      const nested = JSON.stringify({
        message: { content: 'Nested content' },
      });
      const result = parseOutput(nested, 'json');
      expect(result.content).toBe('Nested content');
    });

    it('should handle stream-json with only metadata events', () => {
      const metadataOnly = [
        '{"type":"thread.started"}',
        '{"type":"turn.started"}',
        '{"type":"turn.completed"}',
      ].join('\n');

      const result = parseOutput(metadataOnly, 'stream-json');
      expect(result.content).toBe('');
    });

    it('should handle mixed valid and invalid JSON lines', () => {
      // Note: The parser includes non-JSON lines that look like content (>10 chars, no "...")
      // This is intentional - CLI output might have some non-JSON lines mixed in
      const mixed = [
        '{invalid',
        '{"role":"assistant","content":"Valid content"}',
        '...',  // Short or progress-like lines are skipped
      ].join('\n');

      const result = parseOutput(mixed, 'stream-json');
      expect(result.content).toBe('Valid content');
    });
  });
});
