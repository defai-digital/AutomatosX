/**
 * Output Formatter - Format execution results in different formats
 */

import chalk from 'chalk';
import type { ExecutionResult } from '../agents/executor.js';

export type OutputFormat = 'text' | 'json' | 'markdown';

/**
 * Format execution result based on output format
 */
export function formatOutput(
  result: ExecutionResult,
  format: OutputFormat,
  verbose: boolean = false
): string {
  switch (format) {
    case 'json':
      return formatAsJson(result);

    case 'markdown':
      return formatAsMarkdown(result, verbose);

    case 'text':
    default:
      return formatAsText(result, verbose);
  }
}

/**
 * Format as JSON
 */
function formatAsJson(result: ExecutionResult): string {
  return JSON.stringify({
    content: result.response.content,
    tokensUsed: result.response.tokensUsed,
    latencyMs: result.response.latencyMs,
    model: result.response.model,
    finishReason: result.response.finishReason
  }, null, 2);
}

/**
 * Format as Markdown
 */
function formatAsMarkdown(result: ExecutionResult, verbose: boolean): string {
  const md: string[] = [
    `# Execution Result\n`,
    `**Model**: ${result.response.model}`,
    `**Latency**: ${result.response.latencyMs}ms`,
    `**Tokens**: ${result.response.tokensUsed?.total || 'N/A'}\n`,
    `## Response\n`,
    result.response.content,
    `\n`
  ];

  if (verbose && result.response.tokensUsed) {
    md.push(`## Token Usage\n`);
    md.push(`- Prompt: ${result.response.tokensUsed.prompt || 'N/A'}`);
    md.push(`- Completion: ${result.response.tokensUsed.completion || 'N/A'}`);
    md.push(`- Total: ${result.response.tokensUsed.total || 'N/A'}\n`);
  }

  return md.join('\n');
}

/**
 * Format as plain text
 */
function formatAsText(result: ExecutionResult, verbose: boolean): string {
  const output: string[] = [];

  if (!verbose) {
    output.push(chalk.cyan('\n📝 Result:\n'));
    output.push(result.response.content);
    output.push('\n');
  }

  if (verbose) {
    output.push(chalk.gray(`\nModel: ${result.response.model}`));
    output.push(chalk.gray(`Latency: ${result.response.latencyMs}ms`));
    if (result.response.tokensUsed) {
      output.push(chalk.gray(`Tokens: ${result.response.tokensUsed.total || 'N/A'}`));
    }
  }

  return output.join('\n');
}

/**
 * Format for file save (includes metadata)
 */
export function formatForSave(
  result: ExecutionResult,
  format: OutputFormat,
  metadata: {
    agent: string;
    task: string;
    timestamp?: string;
  }
): string {
  if (format === 'json') {
    return JSON.stringify({
      agent: metadata.agent,
      task: metadata.task,
      timestamp: metadata.timestamp || new Date().toISOString(),
      result: {
        content: result.response.content,
        tokensUsed: result.response.tokensUsed,
        latencyMs: result.response.latencyMs,
        model: result.response.model,
        finishReason: result.response.finishReason
      }
    }, null, 2);
  }

  // For text and markdown, just return the formatted output
  return formatOutput(result, format, true);
}
