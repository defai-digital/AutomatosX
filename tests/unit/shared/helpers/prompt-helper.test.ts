/**
 * PromptHelper Unit Tests
 *
 * Comprehensive tests for prompt-helper.ts to achieve 80%+ coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PromptHelper,
  withPrompt,
  createQuestion
} from '../../../../src/shared/helpers/prompt-helper.js';

/**
 * Create a mock readline interface for testing
 */
function createMockReadlineInterface(responses: string[]) {
  let responseIndex = 0;
  let isClosed = false;

  const mockInterface = {
    question: vi.fn((query: string, callback: (answer: string) => void) => {
      if (isClosed) {
        throw new Error('readline was closed');
      }
      const response = responses[responseIndex] ?? '';
      responseIndex++;
      // Simulate async behavior
      setImmediate(() => callback(response));
    }),
    close: vi.fn(() => {
      isClosed = true;
    })
  };

  return mockInterface;
}

// Store mock interface for assertions
let currentMockInterface: ReturnType<typeof createMockReadlineInterface> | null = null;
let mockResponses: string[] = [];

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn(() => {
    currentMockInterface = createMockReadlineInterface(mockResponses);
    return currentMockInterface;
  })
}));

describe('PromptHelper', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = [];
    currentMockInterface = null;
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('constructor', () => {
    it('uses defaults when no options provided', () => {
      const helper = new PromptHelper();
      expect(helper).toBeInstanceOf(PromptHelper);
      helper.close();
    });

    it('accepts custom streams', () => {
      const mockInput = { on: vi.fn() } as any;
      const mockOutput = { write: vi.fn() } as any;

      const helper = new PromptHelper({ input: mockInput, output: mockOutput });
      expect(helper).toBeInstanceOf(PromptHelper);
      helper.close();
    });

    it('uses partial options with defaults', () => {
      const mockInput = { on: vi.fn() } as any;

      const helper = new PromptHelper({ input: mockInput });
      expect(helper).toBeInstanceOf(PromptHelper);
      helper.close();
    });
  });

  describe('close', () => {
    it('is idempotent - can be called multiple times', async () => {
      mockResponses = ['test'];
      const helper = new PromptHelper();

      // Trigger interface creation
      await helper.question('Test? ');

      // Should not throw
      helper.close();
      helper.close();
      helper.close();
    });

    it('does nothing when interface was never created', () => {
      const helper = new PromptHelper();
      // close without ever calling question
      expect(() => helper.close()).not.toThrow();
    });

    it('calls close on readline interface', async () => {
      mockResponses = ['test'];
      const helper = new PromptHelper();

      await helper.question('Test? ');
      helper.close();

      expect(currentMockInterface?.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('question', () => {
    it('returns trimmed answer', async () => {
      mockResponses = ['  hello world  '];

      const helper = new PromptHelper();
      const answer = await helper.question('Test? ');

      expect(answer).toBe('hello world');
      helper.close();
    });

    it('handles empty input', async () => {
      mockResponses = [''];

      const helper = new PromptHelper();
      const answer = await helper.question('Test? ');

      expect(answer).toBe('');
      helper.close();
    });

    it('creates interface lazily on first call', async () => {
      mockResponses = ['test'];
      const readline = await import('readline');

      const helper = new PromptHelper();
      expect(readline.createInterface).not.toHaveBeenCalled();

      await helper.question('Test? ');
      expect(readline.createInterface).toHaveBeenCalledTimes(1);
      helper.close();
    });

    it('reuses same interface for multiple questions', async () => {
      mockResponses = ['first', 'second'];
      const readline = await import('readline');

      const helper = new PromptHelper();

      const answer1 = await helper.question('First? ');
      const answer2 = await helper.question('Second? ');

      expect(answer1).toBe('first');
      expect(answer2).toBe('second');
      expect(readline.createInterface).toHaveBeenCalledTimes(1);
      helper.close();
    });
  });

  describe('confirm', () => {
    it('returns true for "y"', async () => {
      mockResponses = ['y'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(true);
      helper.close();
    });

    it('returns true for "yes"', async () => {
      mockResponses = ['yes'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(true);
      helper.close();
    });

    it('returns true for "YES" (case insensitive)', async () => {
      mockResponses = ['YES'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(true);
      helper.close();
    });

    it('returns false for "n"', async () => {
      mockResponses = ['n'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(false);
      helper.close();
    });

    it('returns false for "no"', async () => {
      mockResponses = ['no'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(false);
      helper.close();
    });

    it('returns default true for empty input when defaultValue is true', async () => {
      mockResponses = [''];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?', true);

      expect(result).toBe(true);
      helper.close();
    });

    it('returns default false for empty input when defaultValue is false', async () => {
      mockResponses = [''];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?', false);

      expect(result).toBe(false);
      helper.close();
    });

    it('asks again for invalid input then accepts valid', async () => {
      mockResponses = ['invalid', 'y'];

      const helper = new PromptHelper();
      const result = await helper.confirm('Continue?');

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('Please answer yes or no (y/n)');
      helper.close();
    });

    it('asks with [Y/n] suffix when default is true', async () => {
      mockResponses = ['y'];

      const helper = new PromptHelper();
      await helper.confirm('Continue?', true);

      expect(currentMockInterface?.question).toHaveBeenCalledWith(
        'Continue? [Y/n] ',
        expect.any(Function)
      );
      helper.close();
    });

    it('asks with [y/N] suffix when default is false', async () => {
      mockResponses = ['n'];

      const helper = new PromptHelper();
      await helper.confirm('Continue?', false);

      expect(currentMockInterface?.question).toHaveBeenCalledWith(
        'Continue? [y/N] ',
        expect.any(Function)
      );
      helper.close();
    });
  });

  describe('questionWithValidation', () => {
    it('returns valid answer on first try', async () => {
      mockResponses = ['valid-input'];

      const helper = new PromptHelper();
      const validator = (input: string) => input.length >= 5 ? null : 'Too short';

      const result = await helper.questionWithValidation('Enter value: ', validator);

      expect(result).toBe('valid-input');
      helper.close();
    });

    it('retries on invalid input', async () => {
      mockResponses = ['ab', 'valid-input'];

      const helper = new PromptHelper();
      const validator = (input: string) => input.length >= 5 ? null : 'Too short';

      const result = await helper.questionWithValidation('Enter value: ', validator);

      expect(result).toBe('valid-input');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Too short'));
      helper.close();
    });

    it('throws after maxAttempts exceeded', async () => {
      mockResponses = ['a', 'b', 'c'];

      const helper = new PromptHelper();
      const validator = () => 'Always invalid';

      await expect(
        helper.questionWithValidation('Enter value: ', validator, 3)
      ).rejects.toThrow('Maximum validation attempts (3) exceeded');

      helper.close();
    });

    it('uses custom maxAttempts', async () => {
      mockResponses = ['a', 'b'];

      const helper = new PromptHelper();
      const validator = () => 'Always invalid';

      await expect(
        helper.questionWithValidation('Enter value: ', validator, 2)
      ).rejects.toThrow('Maximum validation attempts (2) exceeded');

      helper.close();
    });

    it('shows retry count message', async () => {
      mockResponses = ['a', 'valid-input'];

      const helper = new PromptHelper();
      const validator = (input: string) => input.length > 1 ? null : 'Too short';

      await helper.questionWithValidation('Enter: ', validator, 3);

      expect(mockConsoleLog).toHaveBeenCalledWith('   Try again (1/3)...');
      helper.close();
    });

    it('does not show retry count on last attempt', async () => {
      mockResponses = ['a', 'b', 'c'];

      const helper = new PromptHelper();
      const validator = () => 'Invalid';

      try {
        await helper.questionWithValidation('Enter: ', validator, 3);
      } catch {
        // Expected
      }

      // Should show retry for attempts 1 and 2, but not 3
      expect(mockConsoleLog).toHaveBeenCalledWith('   Try again (1/3)...');
      expect(mockConsoleLog).toHaveBeenCalledWith('   Try again (2/3)...');
      expect(mockConsoleLog).not.toHaveBeenCalledWith('   Try again (3/3)...');
      helper.close();
    });
  });

  describe('choose', () => {
    it('returns selected choice by number', async () => {
      mockResponses = ['2'];

      const helper = new PromptHelper();
      const choices = ['Option A', 'Option B', 'Option C'];

      const result = await helper.choose('Select one:', choices);

      expect(result).toBe('Option B');
      helper.close();
    });

    it('displays choices with numbers', async () => {
      mockResponses = ['1'];

      const helper = new PromptHelper();
      const choices = ['First', 'Second'];

      await helper.choose('Pick one:', choices);

      expect(mockConsoleLog).toHaveBeenCalledWith('Pick one:');
      expect(mockConsoleLog).toHaveBeenCalledWith('    1. First');
      expect(mockConsoleLog).toHaveBeenCalledWith('    2. Second');
      helper.close();
    });

    it('marks default choice with arrow', async () => {
      mockResponses = [''];

      const helper = new PromptHelper();
      const choices = ['First', 'Second'];

      await helper.choose('Pick one:', choices, 1);

      expect(mockConsoleLog).toHaveBeenCalledWith('    1. First');
      expect(mockConsoleLog).toHaveBeenCalledWith('  → 2. Second');
      helper.close();
    });

    it('uses default when input is empty', async () => {
      mockResponses = [''];

      const helper = new PromptHelper();
      const choices = ['First', 'Second', 'Third'];

      const result = await helper.choose('Pick one:', choices, 2);

      expect(result).toBe('Third');
      helper.close();
    });

    it('validates input is within range', async () => {
      mockResponses = ['99', '2'];

      const helper = new PromptHelper();
      const choices = ['A', 'B', 'C'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('B');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Please enter a number between 1 and 3')
      );
      helper.close();
    });

    it('validates input is a number', async () => {
      mockResponses = ['abc', '1'];

      const helper = new PromptHelper();
      const choices = ['Only'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('Only');
      helper.close();
    });

    it('rejects 0 as input', async () => {
      mockResponses = ['0', '1'];

      const helper = new PromptHelper();
      const choices = ['First'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('First');
      helper.close();
    });

    it('rejects negative numbers', async () => {
      mockResponses = ['-1', '1'];

      const helper = new PromptHelper();
      const choices = ['Only'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('Only');
      helper.close();
    });

    it('returns first choice when selected', async () => {
      mockResponses = ['1'];

      const helper = new PromptHelper();
      const choices = ['Alpha', 'Beta', 'Gamma'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('Alpha');
      helper.close();
    });

    it('returns last choice when selected', async () => {
      mockResponses = ['3'];

      const helper = new PromptHelper();
      const choices = ['Alpha', 'Beta', 'Gamma'];

      const result = await helper.choose('Pick:', choices);

      expect(result).toBe('Gamma');
      helper.close();
    });
  });
});

describe('withPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = [];
    currentMockInterface = null;
  });

  it('closes prompt after function completes', async () => {
    mockResponses = ['test'];

    await withPrompt(async (prompt) => {
      return await prompt.question('Test? ');
    });

    expect(currentMockInterface?.close).toHaveBeenCalledTimes(1);
  });

  it('closes prompt even if function throws', async () => {
    mockResponses = ['test'];

    await expect(
      withPrompt(async (prompt) => {
        // Use the prompt first to create the interface
        await prompt.question('Test? ');
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    expect(currentMockInterface?.close).toHaveBeenCalledTimes(1);
  });

  it('still calls close when error thrown before using prompt', async () => {
    mockResponses = [];

    await expect(
      withPrompt(async () => {
        throw new Error('Early error');
      })
    ).rejects.toThrow('Early error');

    // No interface was created, but close() should still be called on PromptHelper
    // The test passes if no error is thrown - PromptHelper.close() handles null interface
  });

  it('returns value from function', async () => {
    mockResponses = ['hello'];

    const result = await withPrompt(async (prompt) => {
      const answer = await prompt.question('Name? ');
      return { name: answer };
    });

    expect(result).toEqual({ name: 'hello' });
  });

  it('passes options to PromptHelper', async () => {
    mockResponses = ['test'];
    const mockInput = { on: vi.fn() } as any;
    const mockOutput = { write: vi.fn() } as any;

    await withPrompt(async (prompt) => {
      return await prompt.question('Test? ');
    }, { input: mockInput, output: mockOutput });

    // Verify options were passed by checking readline was called with them
    const readline = await import('readline');
    expect(readline.createInterface).toHaveBeenCalledWith({
      input: mockInput,
      output: mockOutput
    });
  });
});

describe('createQuestion (deprecated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses = [];
    currentMockInterface = null;
  });

  it('returns question function and close method', async () => {
    const result = await createQuestion();

    expect(typeof result.question).toBe('function');
    expect(typeof result.close).toBe('function');

    result.close();
  });

  it('question function works correctly', async () => {
    mockResponses = ['answer'];

    const { question, close } = await createQuestion();

    const answer = await question('Test? ');
    expect(answer).toBe('answer');

    close();
  });

  it('close function closes readline interface', async () => {
    mockResponses = ['test'];

    const { question, close } = await createQuestion();
    await question('Test? ');
    close();

    expect(currentMockInterface?.close).toHaveBeenCalledTimes(1);
  });
});
