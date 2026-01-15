/**
 * CLI Output Protocol Contracts v1
 *
 * Contract schemas for CLI output parsing and error classification.
 * These contracts define the expected formats from CLI provider outputs
 * and enable consumer-driven contract testing.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Output Format Types
// ============================================================================

/**
 * Supported CLI output formats
 *
 * - json: Single JSON object response
 * - stream-json: JSON Lines format (one JSON object per line)
 * - text: Plain text output
 */
export const CLIOutputFormatSchema = z.enum(['json', 'stream-json', 'text']);
export type CLIOutputFormat = z.infer<typeof CLIOutputFormatSchema>;

// ============================================================================
// Token Usage
// ============================================================================

/**
 * Token usage information
 */
export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// ============================================================================
// Parsed Output
// ============================================================================

/**
 * Result of parsing CLI output
 */
export const ParsedCLIOutputSchema = z.object({
  /** Extracted content from the CLI response */
  content: z.string(),

  /** Raw metadata from the response (provider-specific) */
  metadata: z.record(z.unknown()).optional(),

  /** Token usage if available */
  tokenUsage: TokenUsageSchema.optional(),
});
export type ParsedCLIOutput = z.infer<typeof ParsedCLIOutputSchema>;

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Error categories for CLI outputs
 *
 * Each category has specific retry/fallback guidance:
 * - authentication: Don't retry, don't fallback (fix credentials)
 * - quota: Don't retry, fallback to different provider
 * - rate_limit: Retry with backoff, don't fallback
 * - validation: Don't retry, don't fallback (fix request)
 * - network: Retry, then fallback
 * - server: Retry, then fallback
 * - timeout: Retry, then fallback
 * - not_found: Don't retry, fallback
 * - configuration: Don't retry, don't fallback (fix config)
 * - unknown: Don't retry, fallback
 */
export const CLIErrorCategorySchema = z.enum([
  'authentication',
  'quota',
  'rate_limit',
  'validation',
  'network',
  'server',
  'timeout',
  'not_found',
  'configuration',
  'unknown',
]);
export type CLIErrorCategory = z.infer<typeof CLIErrorCategorySchema>;

/**
 * Retry guidance for each error category
 */
export const ERROR_CATEGORY_GUIDANCE: Record<
  CLIErrorCategory,
  { shouldRetry: boolean; shouldFallback: boolean }
> = {
  authentication: { shouldRetry: false, shouldFallback: false },
  quota: { shouldRetry: false, shouldFallback: true },
  rate_limit: { shouldRetry: true, shouldFallback: false },
  validation: { shouldRetry: false, shouldFallback: false },
  network: { shouldRetry: true, shouldFallback: true },
  server: { shouldRetry: true, shouldFallback: true },
  timeout: { shouldRetry: true, shouldFallback: true },
  not_found: { shouldRetry: false, shouldFallback: true },
  configuration: { shouldRetry: false, shouldFallback: false },
  unknown: { shouldRetry: false, shouldFallback: true },
};

// ============================================================================
// Classified Error
// ============================================================================

/**
 * Classified error with retry/fallback guidance
 */
export const ClassifiedCLIErrorSchema = z.object({
  /** Error category */
  category: CLIErrorCategorySchema,

  /** Human-readable error message */
  message: z.string(),

  /** Whether to retry the request */
  shouldRetry: z.boolean(),

  /** Whether to fallback to another provider */
  shouldFallback: z.boolean(),

  /** Suggested retry delay in milliseconds */
  retryAfterMs: z.number().nullable(),
});
export type ClassifiedCLIError = z.infer<typeof ClassifiedCLIErrorSchema>;

// ============================================================================
// Test Fixtures (Consumer-Driven Contract Testing)
// ============================================================================

/**
 * Raw CLI output structure for test fixtures
 */
export const RawCLIOutputSchema = z.object({
  /** stdout from the CLI process */
  stdout: z.string(),

  /** stderr from the CLI process */
  stderr: z.string().default(''),

  /** Exit code from the CLI process */
  exitCode: z.number().int().default(0),
});
export type RawCLIOutput = z.infer<typeof RawCLIOutputSchema>;

/**
 * Expected parsing result for test fixtures
 */
export const ExpectedParseResultSchema = z.object({
  /** Expected extracted content */
  content: z.string(),

  /** Whether this output represents an error */
  isError: z.boolean().default(false),

  /** Expected error category if isError is true */
  errorCategory: CLIErrorCategorySchema.optional(),
});
export type ExpectedParseResult = z.infer<typeof ExpectedParseResultSchema>;

/**
 * CLI output fixture for consumer-driven contract testing
 *
 * Each fixture represents a real or realistic CLI output from a provider,
 * along with the expected parsing result. Tests validate that the
 * output parser correctly extracts content and classifies errors.
 */
export const CLIOutputFixtureSchema = z.object({
  /** Provider ID (claude, gemini, codex, grok) */
  provider: z.string(),

  /** Scenario description */
  scenario: z.string(),

  /** Output format expected from this provider */
  outputFormat: CLIOutputFormatSchema,

  /** When the fixture was captured (ISO 8601 datetime) */
  capturedAt: z.string().datetime().optional(),

  /** Version of the CLI that produced this output */
  cliVersion: z.string().optional(),

  /** Raw CLI output */
  rawOutput: RawCLIOutputSchema,

  /** Expected parsing result */
  expected: ExpectedParseResultSchema,
});
export type CLIOutputFixture = z.infer<typeof CLIOutputFixtureSchema>;

// ============================================================================
// Provider Output Formats Documentation
// ============================================================================

/**
 * Documented provider output formats
 *
 * This constant documents the expected output structures from each provider.
 * Used for reference when creating test fixtures and validating parsers.
 */
export const PROVIDER_OUTPUT_FORMATS = {
  claude: {
    format: 'stream-json' as const,
    description: 'JSON Lines with turn events',
    contentExtraction: 'content field in content events',
    examples: [
      '{"type":"turn.started",...}',
      '{"type":"content","content":"Hello"}',
      '{"type":"turn.completed","usage":{...}}',
    ],
  },
  gemini: {
    format: 'stream-json' as const,
    description: 'JSON Lines with content events',
    contentExtraction: 'content field in response objects',
    examples: ['{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}'],
  },
  codex: {
    format: 'stream-json' as const,
    description: 'JSON Lines with item.completed events',
    contentExtraction: 'item.text or item.agent_message.text in item.completed events',
    examples: ['{"type":"item.completed","item":{"type":"agent_message","text":"Hello"}}'],
  },
  grok: {
    format: 'stream-json' as const,
    description: 'JSON Lines with role:assistant messages',
    contentExtraction: 'content field from assistant role messages',
    examples: ['{"role":"assistant","content":"Hello"}'],
  },
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const CLIOutputErrorCodes = {
  /** Output could not be parsed */
  PARSE_ERROR: 'CLI_OUTPUT_PARSE_ERROR',

  /** Unknown output format */
  UNKNOWN_FORMAT: 'CLI_OUTPUT_UNKNOWN_FORMAT',

  /** Empty output received */
  EMPTY_OUTPUT: 'CLI_OUTPUT_EMPTY',

  /** Fixture validation failed */
  INVALID_FIXTURE: 'CLI_OUTPUT_INVALID_FIXTURE',
} as const;

export type CLIOutputErrorCode =
  (typeof CLIOutputErrorCodes)[keyof typeof CLIOutputErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a CLI output fixture
 */
export function validateCLIOutputFixture(data: unknown): CLIOutputFixture {
  return CLIOutputFixtureSchema.parse(data);
}

/**
 * Safely validates a CLI output fixture
 */
export function safeValidateCLIOutputFixture(
  data: unknown
): { success: true; data: CLIOutputFixture } | { success: false; error: z.ZodError } {
  const result = CLIOutputFixtureSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates a classified CLI error
 */
export function validateClassifiedCLIError(data: unknown): ClassifiedCLIError {
  return ClassifiedCLIErrorSchema.parse(data);
}

/**
 * Validates parsed CLI output
 */
export function validateParsedCLIOutput(data: unknown): ParsedCLIOutput {
  return ParsedCLIOutputSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a CLI output fixture
 */
export function createCLIOutputFixture(
  provider: string,
  scenario: string,
  outputFormat: CLIOutputFormat,
  rawOutput: RawCLIOutput,
  expected: ExpectedParseResult
): CLIOutputFixture {
  return CLIOutputFixtureSchema.parse({
    provider,
    scenario,
    outputFormat,
    rawOutput,
    expected,
    capturedAt: new Date().toISOString(),
  });
}

/**
 * Creates a classified CLI error
 */
export function createClassifiedCLIError(
  category: CLIErrorCategory,
  message: string,
  retryAfterMs: number | null = null
): ClassifiedCLIError {
  const guidance = ERROR_CATEGORY_GUIDANCE[category];
  return {
    category,
    message,
    shouldRetry: guidance.shouldRetry,
    shouldFallback: guidance.shouldFallback,
    retryAfterMs,
  };
}

/**
 * Gets retry guidance for an error category
 */
export function getErrorCategoryGuidance(
  category: CLIErrorCategory
): { shouldRetry: boolean; shouldFallback: boolean } {
  return ERROR_CATEGORY_GUIDANCE[category];
}
