/**
 * Prompt Manager (v5.3.0)
 *
 * Abstract user prompt system for interactive stage execution.
 * Supports CLI, future UI clients, and localization.
 */

import * as readline from 'readline';
import type { PromptConfig, PromptResponse, CheckpointAction } from '../types/stage-execution.js';

/**
 * Default warning threshold before timeout (in milliseconds)
 * When timeout > 30s, a warning will be shown this many ms before timeout
 */
const DEFAULT_TIMEOUT_WARNING_THRESHOLD_MS = 30000;

/**
 * Prompt Manager Interface
 *
 * Abstract interface for user prompts. Allows different implementations:
 * - CLIPromptAdapter: Terminal-based prompts (readline)
 * - WebPromptAdapter: Browser-based prompts (future)
 * - IPCPromptAdapter: IPC/WebSocket prompts (future)
 */
export interface IPromptManager {
  /**
   * Ask user for confirmation (yes/no)
   *
   * @param message - Question to ask
   * @param defaultValue - Default value if user presses Enter
   * @returns User's response
   */
  confirm(message: string, defaultValue?: boolean): Promise<PromptResponse<boolean>>;

  /**
   * Ask user to select from options
   *
   * @param message - Question to ask
   * @param options - Available options
   * @param defaultValue - Default option if user presses Enter
   * @returns Selected option
   */
  select<T extends string>(
    message: string,
    options: T[],
    defaultValue?: T
  ): Promise<PromptResponse<T>>;

  /**
   * Ask user for text input
   *
   * @param message - Question to ask
   * @param defaultValue - Default value if user presses Enter
   * @returns User's text input
   */
  text(message: string, defaultValue?: string): Promise<PromptResponse<string>>;

  /**
   * Close prompt interface
   */
  close(): void;
}

/**
 * CLI Prompt Adapter
 *
 * Terminal-based prompt implementation using Node.js readline.
 */
export class CLIPromptAdapter implements IPromptManager {
  private readonly config: PromptConfig;
  private rl: readline.Interface | null = null;

  // Prompt templates (en/zh)
  private readonly templates = {
    en: {
      yes: 'y',
      no: 'n',
      defaultIndicator: (value: string) => `(default: ${value})`,
      timeoutWarning: (seconds: number) =>
        `⏱️  Timeout in ${seconds}s - will use default`,
      timedOut: '⏱️  Timed out - using default value',
    },
    zh: {
      yes: 'y',
      no: 'n',
      defaultIndicator: (value: string) => `(預設: ${value})`,
      timeoutWarning: (seconds: number) => `⏱️  ${seconds}秒後超時 - 將使用預設值`,
      timedOut: '⏱️  已超時 - 使用預設值',
    },
  };

  constructor(config: PromptConfig) {
    this.config = config;
  }

  /**
   * Initialize readline interface
   */
  private getReadline(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }

  /**
   * Get localized template
   */
  private getTemplate() {
    return this.templates[this.config.locale] || this.templates.en;
  }

  /**
   * Ask user for confirmation (yes/no)
   */
  async confirm(message: string, defaultValue: boolean = true): Promise<PromptResponse<boolean>> {
    const template = this.getTemplate();
    const defaultStr = defaultValue ? template.yes : template.no;
    const prompt = `${message} [${template.yes}/${template.no}] ${template.defaultIndicator(defaultStr)}: `;

    return this.promptWithTimeout(
      prompt,
      (input) => {
        const normalized = input.trim().toLowerCase();
        if (normalized === '' || normalized === defaultStr) {
          return defaultValue;
        }
        if (normalized === template.yes || normalized === 'yes') {
          return true;
        }
        if (normalized === template.no || normalized === 'no') {
          return false;
        }
        // Invalid input, return default
        return defaultValue;
      },
      defaultValue
    );
  }

  /**
   * Ask user to select from options
   */
  async select<T extends string>(
    message: string,
    options: T[],
    defaultValue?: T
  ): Promise<PromptResponse<T>> {
    const template = this.getTemplate();

    // Build options display
    const optionsDisplay = options.map((opt, index) => `  ${index + 1}. ${opt}`).join('\n');
    const defaultDisplay = defaultValue
      ? ` ${template.defaultIndicator(defaultValue)}`
      : '';

    const prompt = `${message}\n${optionsDisplay}\n${this.config.locale === 'zh' ? '請選擇' : 'Select'}${defaultDisplay}: `;

    return this.promptWithTimeout(
      prompt,
      (input) => {
        const normalized = input.trim();

        // Empty input - use default
        if (normalized === '' && defaultValue) {
          return defaultValue;
        }

        // Check if input is a number (option index)
        const index = parseInt(normalized, 10);
        if (!isNaN(index) && index >= 1 && index <= options.length) {
          const selected = options[index - 1];
          if (selected) {
            return selected;
          }
        }

        // Check if input matches an option directly
        const matchedOption = options.find(
          (opt) => opt.toLowerCase() === normalized.toLowerCase()
        );
        if (matchedOption) {
          return matchedOption;
        }

        // Invalid input - use default or first option
        return defaultValue || options[0] || ('' as T);
      },
      defaultValue || options[0] || ('' as T)
    );
  }

  /**
   * Ask user for text input
   */
  async text(message: string, defaultValue: string = ''): Promise<PromptResponse<string>> {
    const template = this.getTemplate();
    const defaultDisplay = defaultValue
      ? ` ${template.defaultIndicator(defaultValue)}`
      : '';
    const prompt = `${message}${defaultDisplay}: `;

    return this.promptWithTimeout(
      prompt,
      (input) => {
        const normalized = input.trim();
        return normalized === '' ? defaultValue : normalized;
      },
      defaultValue
    );
  }

  /**
   * Prompt with timeout support
   *
   * @param prompt - Prompt message
   * @param parser - Parse user input
   * @param defaultValue - Default value on timeout
   * @returns Prompt response
   */
  private async promptWithTimeout<T>(
    prompt: string,
    parser: (input: string) => T,
    defaultValue: T
  ): Promise<PromptResponse<T>> {
    const rl = this.getReadline();
    const template = this.getTemplate();

    return new Promise<PromptResponse<T>>((resolve) => {
      let resolved = false;
      let timeoutHandle: NodeJS.Timeout;
      let warningHandle: NodeJS.Timeout;

      // Timeout handler
      const handleTimeout = () => {
        if (!resolved) {
          resolved = true;
          console.log(`\n${template.timedOut}`);
          rl.close();
          this.rl = null;
          resolve({
            value: defaultValue,
            timedOut: true,
          });
        }
      };

      // Warning handler (30 seconds before timeout)
      const handleWarning = () => {
        if (!resolved) {
          console.log(`\n${template.timeoutWarning(30)}`);
        }
      };

      // Set timeout (default: 10 minutes)
      timeoutHandle = setTimeout(handleTimeout, this.config.timeout);

      // Set warning (if timeout > warning threshold)
      if (this.config.timeout > DEFAULT_TIMEOUT_WARNING_THRESHOLD_MS) {
        warningHandle = setTimeout(handleWarning, this.config.timeout - DEFAULT_TIMEOUT_WARNING_THRESHOLD_MS);
      }

      // Ask question
      rl.question(prompt, (answer) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutHandle);
          if (warningHandle!) {
            clearTimeout(warningHandle);
          }

          const value = parser(answer);
          resolve({
            value,
            timedOut: false,
          });
        }
      });
    });
  }

  /**
   * Close readline interface
   */
  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

/**
 * Prompt Manager
 *
 * High-level prompt manager that wraps adapter implementations.
 * Provides convenient methods for common prompt scenarios.
 */
export class PromptManager {
  private adapter: IPromptManager;

  constructor(adapter: IPromptManager) {
    this.adapter = adapter;
  }

  /**
   * Ask user for checkpoint action
   *
   * @param stageName - Current stage name
   * @param nextStageName - Next stage name (if any)
   * @returns Checkpoint action
   */
  async promptCheckpointAction(
    stageName: string,
    nextStageName?: string
  ): Promise<CheckpointAction> {
    const message = nextStageName
      ? `Stage "${stageName}" completed. Continue to "${nextStageName}"?`
      : `Stage "${stageName}" completed.`;

    const options = nextStageName
      ? ['continue', 'modify', 'skip', 'abort']
      : ['continue', 'abort'];

    const response = await this.adapter.select(
      message,
      options as ('continue' | 'modify' | 'skip' | 'abort')[],
      'continue'
    );

    switch (response.value) {
      case 'continue':
        return { action: 'continue' };
      case 'modify': {
        const modifications = await this.adapter.text(
          'Enter modifications for next stage:',
          ''
        );
        return {
          action: 'modify',
          modifications: modifications.value,
        };
      }
      case 'skip':
        return { action: 'skip' };
      case 'abort':
        return { action: 'abort' };
      default:
        return { action: 'continue' };
    }
  }

  /**
   * Ask user to confirm stage execution start
   *
   * @param stageName - Stage name
   * @returns True if user confirms
   */
  async confirmStageStart(stageName: string): Promise<boolean> {
    const response = await this.adapter.confirm(
      `Start stage "${stageName}"?`,
      true
    );
    return response.value;
  }

  /**
   * Ask user for retry action on stage failure
   *
   * @param stageName - Failed stage name
   * @param error - Error message
   * @returns Checkpoint action (retry/skip/abort)
   */
  async promptRetryAction(
    stageName: string,
    error: string
  ): Promise<CheckpointAction> {
    console.error(`\n❌ Stage "${stageName}" failed: ${error}\n`);

    const response = await this.adapter.select(
      'What would you like to do?',
      ['retry', 'skip', 'abort'],
      'retry'
    );

    switch (response.value) {
      case 'retry':
        return { action: 'retry' };
      case 'skip':
        return { action: 'skip' };
      case 'abort':
        return { action: 'abort' };
      default:
        return { action: 'retry' };
    }
  }

  /**
   * Ask user to confirm resume
   *
   * @param runId - Run identifier
   * @param stageName - Stage to resume from
   * @returns True if user confirms
   */
  async confirmResume(runId: string, stageName: string): Promise<boolean> {
    const response = await this.adapter.confirm(
      `Resume run "${runId}" from stage "${stageName}"?`,
      true
    );
    return response.value;
  }

  /**
   * Close prompt manager
   */
  close(): void {
    this.adapter.close();
  }
}

/**
 * Create default CLI prompt manager
 *
 * @param config - Prompt configuration
 * @returns PromptManager instance
 */
export function createCLIPromptManager(config: PromptConfig): PromptManager {
  const adapter = new CLIPromptAdapter(config);
  return new PromptManager(adapter);
}
