/**
 * Enhanced Error Handler
 *
 * Provides contextual error messages with recovery suggestions
 * Makes errors actionable and user-friendly
 */

import chalk from 'chalk';

export interface EnhancedError {
  message: string;
  category: 'provider' | 'network' | 'command' | 'validation' | 'system' | 'filesystem';
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  recoveryActions?: string[];
  technicalDetails?: string;
}

export class ErrorHandler {
  /**
   * Create enhanced error from generic error
   */
  static enhance(error: Error | string): EnhancedError {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    // Provider errors
    if (message.includes('provider') || message.includes('Provider')) {
      return {
        message: 'AI Provider Error',
        category: 'provider',
        severity: 'error',
        suggestion: 'The AI provider is unavailable or not configured correctly.',
        recoveryActions: [
          'Check if provider CLI is installed (e.g., `gemini --version`)',
          'Run `ax doctor gemini` to diagnose issues',
          'Set AUTOMATOSX_MOCK_PROVIDERS=true to use mock mode',
          'Try switching to a different provider'
        ],
        technicalDetails: message
      };
    }

    // Network errors
    if (message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('ENOTFOUND') ||
        message.includes('network')) {
      return {
        message: 'Network Connection Error',
        category: 'network',
        severity: 'error',
        suggestion: 'Unable to reach the AI provider API.',
        recoveryActions: [
          'Check your internet connection',
          'Verify firewall settings allow outbound connections',
          'Try again in a few moments',
          'Check provider status page',
          'Use mock mode: AUTOMATOSX_MOCK_PROVIDERS=true'
        ],
        technicalDetails: message
      };
    }

    // API key errors
    if (message.includes('API key') ||
        message.includes('authentication') ||
        message.includes('unauthorized') ||
        message.includes('401')) {
      return {
        message: 'Authentication Error',
        category: 'validation',
        severity: 'error',
        suggestion: 'API key is missing or invalid.',
        recoveryActions: [
          'Set API key: export GEMINI_API_KEY=your_key',
          'Verify key is valid on provider dashboard',
          'Check key has required permissions',
          'Use mock mode for testing: AUTOMATOSX_MOCK_PROVIDERS=true'
        ],
        technicalDetails: message
      };
    }

    // Rate limit errors
    if (message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('quota exceeded')) {
      return {
        message: 'Rate Limit Exceeded',
        category: 'provider',
        severity: 'warning',
        suggestion: 'Too many requests to the API.',
        recoveryActions: [
          'Wait a few minutes before retrying',
          'Check your free tier quota: ax free-tier status',
          'Consider upgrading to paid tier',
          'Use multiple providers to distribute load'
        ],
        technicalDetails: message
      };
    }

    // Command errors
    if (message.includes('command') || message.includes('Command')) {
      return {
        message: 'Invalid Command',
        category: 'command',
        severity: 'warning',
        suggestion: 'The command you entered is not recognized.',
        recoveryActions: [
          'Type /help to see available commands',
          'Check for typos in command name',
          'Commands must start with /',
          'Try natural language instead of commands'
        ],
        technicalDetails: message
      };
    }

    // File system errors
    if (message.includes('ENOENT') ||
        message.includes('EACCES') ||
        message.includes('permission denied')) {
      return {
        message: 'File System Error',
        category: 'filesystem',
        severity: 'error',
        suggestion: 'Cannot access required files or directories.',
        recoveryActions: [
          'Check file permissions',
          'Ensure .automatosx directory exists',
          'Try running with appropriate permissions',
          'Check disk space is available'
        ],
        technicalDetails: message
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return {
        message: 'Request Timeout',
        category: 'network',
        severity: 'warning',
        suggestion: 'The request took too long to complete.',
        recoveryActions: [
          'Try a shorter or simpler request',
          'Check your network connection',
          'The provider might be experiencing high load',
          'Try again in a few moments'
        ],
        technicalDetails: message
      };
    }

    // Agent errors
    if (message.includes('agent') || message.includes('delegation')) {
      return {
        message: 'Agent Delegation Error',
        category: 'system',
        severity: 'warning',
        suggestion: 'Failed to delegate task to agent.',
        recoveryActions: [
          'Check agent name is correct: /agents',
          'Try syntax: @agent task description',
          'Alternative syntax: DELEGATE TO agent: task',
          'Ensure agent is available and configured'
        ],
        technicalDetails: message
      };
    }

    // Conversation/persistence errors
    if (message.includes('conversation') ||
        message.includes('save') ||
        message.includes('load')) {
      return {
        message: 'Conversation Error',
        category: 'filesystem',
        severity: 'warning',
        suggestion: 'Failed to save or load conversation.',
        recoveryActions: [
          'Check .automatosx/cli-conversations directory exists',
          'Verify disk space is available',
          'Try a different conversation name',
          'List saved conversations: /list'
        ],
        technicalDetails: message
      };
    }

    // Generic error
    return {
      message: 'Unexpected Error',
      category: 'system',
      severity: 'error',
      suggestion: 'An unexpected error occurred.',
      recoveryActions: [
        'Try your request again',
        'Restart the CLI with `ax cli`',
        'Check .automatosx/logs/ for details',
        'Report this issue on GitHub if it persists'
      ],
      technicalDetails: message
    };
  }

  /**
   * Format enhanced error for display
   */
  static format(error: EnhancedError, options?: { colors?: boolean }): string {
    const useColors = options?.colors ?? true;
    const lines: string[] = [];

    // Header with emoji and colored title
    const emoji = error.severity === 'error' ? '✗' : error.severity === 'warning' ? '⚠' : 'ℹ';
    const colorFn = error.severity === 'error' ? chalk.red :
                    error.severity === 'warning' ? chalk.yellow : chalk.blue;

    const title = useColors ? colorFn(`${emoji} ${error.message}`) : `${emoji} ${error.message}`;
    lines.push('');
    lines.push(title);

    // Suggestion (if provided)
    if (error.suggestion) {
      const suggestionText = useColors ? chalk.dim(error.suggestion) : error.suggestion;
      lines.push('');
      lines.push(suggestionText);
    }

    // Recovery actions (if provided)
    if (error.recoveryActions && error.recoveryActions.length > 0) {
      lines.push('');
      const header = useColors ? chalk.bold('Suggested actions:') : 'Suggested actions:';
      lines.push(header);

      error.recoveryActions.forEach((action, i) => {
        const num = useColors ? chalk.cyan(`  ${i + 1}.`) : `  ${i + 1}.`;
        const text = useColors ? chalk.dim(action) : action;
        lines.push(`${num} ${text}`);
      });
    }

    // Technical details (dimmed, collapsible)
    if (error.technicalDetails && error.severity === 'error') {
      lines.push('');
      const header = useColors ? chalk.dim('Technical details:') : 'Technical details:';
      const details = useColors ? chalk.dim(error.technicalDetails) : error.technicalDetails;
      lines.push(`${header} ${details}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Quick helpers for common error types
   */
  static providerUnavailable(providerName: string): EnhancedError {
    return {
      message: `Provider Unavailable: ${providerName}`,
      category: 'provider',
      severity: 'error',
      suggestion: `The ${providerName} provider is not available.`,
      recoveryActions: [
        `Install ${providerName} CLI if not installed`,
        `Check provider configuration: ax doctor ${providerName.toLowerCase()}`,
        'Use mock mode: AUTOMATOSX_MOCK_PROVIDERS=true',
        'Try a different provider'
      ]
    };
  }

  static commandNotFound(command: string): EnhancedError {
    return {
      message: 'Command Not Found',
      category: 'command',
      severity: 'warning',
      suggestion: `Unknown command: ${command}`,
      recoveryActions: [
        'Type /help to see all available commands',
        'Check for typos in the command name',
        'Commands must start with /',
        'Use natural language for questions'
      ]
    };
  }

  static conversationNotFound(name: string): EnhancedError {
    return {
      message: 'Conversation Not Found',
      category: 'filesystem',
      severity: 'warning',
      suggestion: `No conversation found with name: ${name}`,
      recoveryActions: [
        'List all conversations: /list',
        'Check for typos in the conversation name',
        'Create a new conversation: /new',
        'Save current conversation: /save <name>'
      ]
    };
  }

  static networkTimeout(): EnhancedError {
    return {
      message: 'Network Timeout',
      category: 'network',
      severity: 'warning',
      suggestion: 'The request timed out.',
      recoveryActions: [
        'Check your internet connection',
        'Try a shorter or simpler request',
        'Wait a moment and try again',
        'Use mock mode if provider is slow'
      ]
    };
  }
}
