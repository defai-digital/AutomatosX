/**
 * Streaming Progress Parser (v8.5.1)
 *
 * Parses raw CLI output and extracts user-friendly progress information
 * instead of showing raw JSON protocol messages.
 *
 * Usage:
 * - When AUTOMATOSX_SHOW_PROVIDER_OUTPUT=true, shows user-friendly progress
 * - When AUTOMATOSX_DEBUG=true, shows raw JSON output for debugging
 * - Converts JSON protocol messages into spinner-based progress indicators
 * - Displays tool calls as activity messages (e.g., "Reading project files...")
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface ProgressUpdate {
  type: 'thinking' | 'tool_call' | 'response' | 'error' | 'raw';
  message: string;
  details?: string;
}

export class StreamingProgressParser {
  private spinner: Ora | null = null;
  private lastActivity: string = 'Starting...';
  private debugMode: boolean;
  private quietMode: boolean; // v8.5.8: Suppress all output in quiet mode

  constructor(debugMode: boolean = false, quietMode: boolean = false) {
    this.debugMode = debugMode;
    this.quietMode = quietMode;
  }

  /**
   * Initialize the progress spinner
   */
  start(initialMessage: string = 'Initializing agent...') {
    // v8.5.8: Skip spinner in quiet mode
    if (this.quietMode) {
      return;
    }

    if (!this.spinner) {
      this.spinner = ora({
        text: initialMessage,
        color: 'cyan'
      }).start();
    }
  }

  /**
   * Parse a line of output and extract progress information
   */
  parseLine(line: string): ProgressUpdate | null {
    // In debug mode, show raw output
    if (this.debugMode) {
      return {
        type: 'raw',
        message: line
      };
    }

    try {
      const parsed = JSON.parse(line);

      // Parse user message (task description)
      if (parsed.role === 'user') {
        return {
          type: 'thinking',
          message: 'Processing task...'
        };
      }

      // Parse assistant response
      if (parsed.role === 'assistant' && parsed.content) {
        // Extract actual content, skip empty thinking patterns
        const content = parsed.content.trim();
        if (content && !content.startsWith('\n')) {
          return {
            type: 'response',
            message: 'Generating response...',
            details: content.substring(0, 100) // First 100 chars
          };
        }
      }

      // Parse tool calls (actions the agent is taking)
      if (parsed.role === 'assistant' && parsed.tool_calls) {
        const toolCall = parsed.tool_calls[0];
        if (toolCall) {
          const functionName = toolCall.function?.name || 'unknown';
          return {
            type: 'tool_call',
            message: this.formatToolCallMessage(functionName)
          };
        }
      }

      // Parse tool results
      if (parsed.role === 'tool') {
        return {
          type: 'thinking',
          message: 'Processing results...'
        };
      }

      return null;
    } catch (error) {
      // Not JSON, might be plain text output
      if (line.trim().length > 0 && !line.startsWith('{')) {
        return {
          type: 'response',
          message: line.trim()
        };
      }
      return null;
    }
  }

  /**
   * Convert tool call names to user-friendly messages
   */
  private formatToolCallMessage(toolName: string): string {
    const messages: Record<string, string> = {
      'view_file': 'Reading project files...',
      'search': 'Searching codebase...',
      'bash': 'Executing command...',
      'write_file': 'Writing file...',
      'edit_file': 'Modifying code...',
      'run_tests': 'Running tests...',
      'analyze_code': 'Analyzing code structure...',
      'check_syntax': 'Checking syntax...',
      'format_code': 'Formatting code...',
      'git_diff': 'Checking changes...',
      'install_deps': 'Installing dependencies...'
    };

    return messages[toolName] || `Executing ${toolName}...`;
  }

  /**
   * Update progress display
   */
  update(progress: ProgressUpdate) {
    // v8.5.8: Skip updates in quiet mode
    if (this.quietMode) {
      return;
    }

    if (!this.spinner) {
      this.start();
    }

    switch (progress.type) {
      case 'thinking':
      case 'tool_call':
        this.lastActivity = progress.message;
        this.spinner!.text = chalk.cyan(progress.message);
        break;

      case 'response':
        if (progress.details) {
          // Show a preview of the response
          this.spinner!.text = chalk.green(`${progress.message} ${chalk.dim(progress.details.substring(0, 50) + '...')}`);
        } else {
          this.spinner!.text = chalk.green(progress.message);
        }
        break;

      case 'error':
        this.spinner!.fail(chalk.red(progress.message));
        break;

      case 'raw':
        // In debug mode, show raw output with prefix
        this.spinner!.stop();
        console.log(chalk.gray('  │ ') + progress.message);
        this.spinner!.start(this.lastActivity);
        break;
    }
  }

  /**
   * Mark as complete
   */
  succeed(message: string = 'Complete!') {
    // v8.5.8: Skip success message in quiet mode
    if (this.quietMode) {
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(chalk.green(message));
      this.spinner = null;
    }
  }

  /**
   * Mark as failed
   */
  fail(message: string = 'Failed!') {
    // v8.5.8: Always show failures (even in quiet mode)
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    } else if (this.quietMode) {
      // If no spinner but in quiet mode, still output error to stderr
      console.error(chalk.red(`✖ ${message}`));
    }
  }

  /**
   * Stop the spinner without marking success/failure
   */
  stop() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}
