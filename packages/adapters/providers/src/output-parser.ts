/**
 * Output parser for CLI responses
 *
 * Handles different output formats:
 * - json: Single JSON object
 * - stream-json: JSON Lines (one JSON object per line)
 * - text: Plain text output
 */

import type { ParsedOutput, TokenUsage, CLIProviderConfig } from './types.js';

/**
 * Parses CLI output based on the expected format
 *
 * @param stdout - Raw stdout from CLI process
 * @param format - Expected output format
 * @returns Parsed output with content and optional metadata
 */
export function parseOutput(
  stdout: string,
  format: CLIProviderConfig['outputFormat']
): ParsedOutput {
  switch (format) {
    case 'json':
      return parseJSON(stdout);
    case 'stream-json':
      return parseStreamJSON(stdout);
    case 'text':
      return parseText(stdout);
  }
}

/**
 * Parses a single JSON object from stdout
 */
function parseJSON(stdout: string): ParsedOutput {
  try {
    const trimmed = stdout.trim();
    if (trimmed.length === 0) {
      return { content: '' };
    }

    const data = JSON.parse(trimmed) as Record<string, unknown>;

    // Try common response fields
    const content = extractContent(data);

    return {
      content,
      metadata: data,
    };
  } catch {
    // If JSON parsing fails, treat as text
    return { content: stdout.trim() };
  }
}

/**
 * Parses JSON Lines format (one JSON object per line)
 * Used by streaming CLI outputs
 */
function parseStreamJSON(stdout: string): ParsedOutput {
  const lines = stdout.trim().split('\n');
  const contentChunks: string[] = [];
  let lastMetadata: Record<string, unknown> | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }

    try {
      const data = JSON.parse(trimmedLine) as Record<string, unknown>;
      const chunk = extractContent(data);
      if (chunk.length > 0) {
        contentChunks.push(chunk);
      }
      lastMetadata = data;
    } catch {
      // Non-JSON line, might be raw content
      contentChunks.push(trimmedLine);
    }
  }

  return {
    content: contentChunks.join(''),
    metadata: lastMetadata,
  };
}

/**
 * Parses plain text output
 */
function parseText(stdout: string): ParsedOutput {
  return {
    content: stdout.trim(),
  };
}

/**
 * Extracts content from a parsed JSON response
 * Tries common field names used by different providers
 */
function extractContent(data: Record<string, unknown>): string {
  // Common response field names
  const contentFields = ['content', 'text', 'response', 'message', 'output', 'result'];

  for (const field of contentFields) {
    const value = data[field];
    if (typeof value === 'string') {
      return value;
    }
    // Handle nested content (e.g., { message: { content: "..." } })
    if (typeof value === 'object' && value !== null) {
      const nested = value as Record<string, unknown>;
      if (typeof nested.content === 'string') {
        return nested.content;
      }
      if (typeof nested.text === 'string') {
        return nested.text;
      }
    }
  }

  // Handle array of content blocks (Anthropic style)
  if (Array.isArray(data.content)) {
    const textBlocks = data.content
      .filter((block): block is { type: string; text: string } => {
        if (typeof block !== 'object' || block === null) {
          return false;
        }
        const obj = block as Record<string, unknown>;
        return obj.type === 'text' && typeof obj.text === 'string';
      })
      .map((block) => block.text);
    if (textBlocks.length > 0) {
      return textBlocks.join('');
    }
  }

  // Handle choices array (OpenAI style)
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const firstChoice = data.choices[0] as Record<string, unknown>;
    if (typeof firstChoice.message === 'object' && firstChoice.message !== null) {
      const message = firstChoice.message as Record<string, unknown>;
      if (typeof message.content === 'string') {
        return message.content;
      }
    }
    if (typeof firstChoice.text === 'string') {
      return firstChoice.text;
    }
  }

  return '';
}

/**
 * Estimates token usage from prompt and completion text
 * Uses approximate ratio of 4 characters per token
 *
 * @param prompt - Input prompt text
 * @param completion - Generated completion text
 * @returns Estimated token usage
 */
export function estimateTokenUsage(prompt: string, completion: string): TokenUsage {
  // Conservative estimate: ~4 characters per token
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(completion.length / 4);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Extracts token usage from CLI response metadata if available
 * Falls back to estimation if not present
 *
 * @param metadata - Parsed metadata from CLI response
 * @param prompt - Input prompt for estimation fallback
 * @param completion - Completion text for estimation fallback
 * @returns Token usage (extracted or estimated)
 */
export function extractOrEstimateTokenUsage(
  metadata: Record<string, unknown> | undefined,
  prompt: string,
  completion: string
): TokenUsage {
  if (metadata === undefined) {
    return estimateTokenUsage(prompt, completion);
  }

  // Try to extract usage from metadata
  const usage = metadata.usage as Record<string, unknown> | undefined;
  if (usage !== undefined) {
    const inputTokens = typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
        ? usage.prompt_tokens
        : undefined;

    const outputTokens = typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : undefined;

    if (inputTokens !== undefined && outputTokens !== undefined) {
      return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      };
    }
  }

  // Fallback to estimation
  return estimateTokenUsage(prompt, completion);
}
