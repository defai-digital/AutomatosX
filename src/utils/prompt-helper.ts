/**
 * Prompt Helper Utility - Standardizes readline/prompt operations
 *
 * v9.0.2: Extracted from duplicated code across 12 files
 *
 * Provides consistent user input handling with automatic cleanup.
 */

import * as readline from 'readline';

export interface PromptOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * Helper class for interactive prompts
 *
 * Manages readline interface lifecycle with automatic cleanup.
 */
export class PromptHelper {
  private rl: readline.Interface | null = null;
  private options: PromptOptions;

  constructor(options: PromptOptions = {}) {
    this.options = {
      input: options.input ?? process.stdin,
      output: options.output ?? process.stdout
    };
  }

  /**
   * Create readline interface lazily
   */
  private ensureInterface(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: this.options.input!,
        output: this.options.output!
      });
    }
    return this.rl;
  }

  /**
   * Ask a question and wait for user input
   */
  async question(query: string): Promise<string> {
    const rl = this.ensureInterface();
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Ask a yes/no confirmation question
   *
   * @param message - The question to ask
   * @param defaultValue - Default value if user presses Enter (default: true)
   * @returns true for yes, false for no
   */
  async confirm(message: string, defaultValue = true): Promise<boolean> {
    const suffix = defaultValue ? ' [Y/n] ' : ' [y/N] ';
    const answer = await this.question(message + suffix);

    // Empty answer uses default
    if (!answer) return defaultValue;

    // Check for yes/no
    const normalized = answer.toLowerCase();
    if (['y', 'yes'].includes(normalized)) return true;
    if (['n', 'no'].includes(normalized)) return false;

    // Invalid input, ask again
    console.log('Please answer yes or no (y/n)');
    return this.confirm(message, defaultValue);
  }

  /**
   * Ask for input with validation
   *
   * @param query - The question to ask
   * @param validator - Function to validate input (return error message or null if valid)
   * @param maxAttempts - Maximum retry attempts (default: 3)
   */
  async questionWithValidation(
    query: string,
    validator: (input: string) => string | null,
    maxAttempts = 3
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const answer = await this.question(query);
      const error = validator(answer);

      if (!error) {
        return answer;
      }

      console.log(`❌ ${error}`);
      if (attempt < maxAttempts) {
        console.log(`   Try again (${attempt}/${maxAttempts})...`);
      }
    }

    throw new Error(`Maximum validation attempts (${maxAttempts}) exceeded`);
  }

  /**
   * Ask user to choose from a list of options
   *
   * @param message - The question to ask
   * @param choices - Array of choices
   * @param defaultIndex - Default choice index (optional)
   */
  async choose<T extends string>(
    message: string,
    choices: T[],
    defaultIndex?: number
  ): Promise<T> {
    console.log(message);
    choices.forEach((choice, index) => {
      const marker = index === defaultIndex ? '→' : ' ';
      console.log(`  ${marker} ${index + 1}. ${choice}`);
    });

    const validator = (input: string): string | null => {
      const num = parseInt(input, 10);
      if (isNaN(num) || num < 1 || num > choices.length) {
        return `Please enter a number between 1 and ${choices.length}`;
      }
      return null;
    };

    const defaultSuffix = defaultIndex !== undefined
      ? ` [default: ${defaultIndex + 1}]`
      : '';

    const answer = await this.questionWithValidation(
      `\nYour choice${defaultSuffix}: `,
      (input) => {
        if (!input && defaultIndex !== undefined) {
          return null; // Allow empty for default
        }
        return validator(input);
      }
    );

    // Handle empty answer with default
    if (!answer && defaultIndex !== undefined) {
      return choices[defaultIndex]!;
    }

    const index = parseInt(answer, 10) - 1;
    return choices[index]!;
  }

  /**
   * Close readline interface and cleanup resources
   */
  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}

/**
 * Execute function with automatic prompt cleanup (try-with-resources pattern)
 *
 * @param fn - Function that receives PromptHelper instance
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const answer = await withPrompt(async (prompt) => {
 *   const name = await prompt.question('What is your name? ');
 *   const confirmed = await prompt.confirm('Continue?');
 *   return { name, confirmed };
 * });
 * ```
 */
export async function withPrompt<T>(
  fn: (prompt: PromptHelper) => Promise<T>,
  options?: PromptOptions
): Promise<T> {
  const prompt = new PromptHelper(options);
  try {
    return await fn(prompt);
  } finally {
    prompt.close();
  }
}

/**
 * Create a simple question function (for backward compatibility)
 *
 * @deprecated Use withPrompt() or PromptHelper directly
 */
export async function createQuestion(): Promise<{
  question: (query: string) => Promise<string>;
  close: () => void;
}> {
  const prompt = new PromptHelper();
  return {
    question: (query: string) => prompt.question(query),
    close: () => prompt.close()
  };
}
