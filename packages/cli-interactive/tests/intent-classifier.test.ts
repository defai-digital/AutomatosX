/**
 * Intent Classifier Tests
 *
 * Comprehensive test suite for natural language intent detection
 */

import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  detectConfirmation,
  getIntentExamples,
  getAllIntentPatterns
} from '../src/intent-classifier.js';

describe('Intent Classifier', () => {
  describe('classifyIntent', () => {
    // Testing Commands
    it('should detect "run tests" intent', () => {
      const variations = [
        'run tests',
        'run the tests',
        'execute tests',
        'test this',
        'test',
        'please run tests'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('test');
        expect(result?.confidence).toBeGreaterThan(0.8);
      });
    });

    it('should detect "coverage" intent', () => {
      const variations = [
        'run coverage',
        'show coverage',
        'check coverage',
        'coverage'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('coverage');
      });
    });

    // Build Commands
    it('should detect "build" intent', () => {
      const variations = [
        'build',
        'build this',
        'run build',
        'compile project',
        'bundle'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('build');
      });
    });

    it('should detect "dev server" intent', () => {
      const variations = [
        'start dev server',
        'run dev',
        'dev mode',
        'start development server'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('dev');
      });
    });

    // File Operations
    it('should detect "read" intent with args', () => {
      const result = classifyIntent('read src/app.ts');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('read');
      expect(result?.args).toEqual(['src/app.ts']);
    });

    it('should detect "write" intent with args', () => {
      const result = classifyIntent('write config.json');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('write');
      expect(result?.args).toEqual(['config.json']);
    });

    it('should detect "edit" intent with args', () => {
      const result = classifyIntent('edit package.json');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('edit');
      expect(result?.args).toEqual(['package.json']);
    });

    // Search & Navigation
    it('should detect "find" intent with args', () => {
      const result = classifyIntent('find src/components');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('find');
      expect(result?.args).toEqual(['src/components']);
    });

    it('should detect "search" intent with args', () => {
      const result = classifyIntent('search TODO');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('search');
      expect(result?.args).toEqual(['TODO']);
    });

    it('should detect "tree" intent', () => {
      const variations = [
        'show tree',
        'tree',
        'display structure',
        'show file tree'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('tree');
      });
    });

    // Git Operations
    it('should detect "git status" intent', () => {
      const variations = [
        'git status',
        'status',
        'show status',
        'what files changed'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('status');
      });
    });

    it('should detect "git" intent with args', () => {
      const result = classifyIntent('git commit -m "message"');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('git');
      expect(result?.args).toEqual(['commit -m "message"']);
    });

    // Code Quality
    it('should detect "lint" intent', () => {
      const variations = [
        'lint',
        'run lint',
        'check linting',
        'fix linting'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('lint');
      });
    });

    it('should detect "format" intent', () => {
      const variations = [
        'format',
        'run prettier',
        'beautify',
        'fix formatting'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('format');
      });
    });

    // Package Management
    it('should detect "install" intent with args', () => {
      const variations = [
        'install lodash',
        'add package axios',
        'npm install react'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('install');
        expect(result?.args.length).toBeGreaterThan(0);
      });
    });

    it('should detect "update" intent', () => {
      const variations = [
        'update packages',
        'upgrade',
        'npm update'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('update');
      });
    });

    // Memory & Agents
    it('should detect "memory search" intent with args', () => {
      const result = classifyIntent('search memory for auth');
      expect(result).not.toBeNull();
      expect(result?.command).toBe('memory');
      expect(result?.args).toEqual(['search', 'auth']);
    });

    it('should detect "agents" intent', () => {
      const variations = [
        'list agents',
        'show agents',
        'agents',
        'what agents are available'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('agents');
      });
    });

    // Help & Navigation
    it('should detect "help" intent', () => {
      const variations = [
        'help',
        'what can you do',
        '?',
        'list commands'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('help');
      });
    });

    it('should detect "clear" intent', () => {
      const variations = [
        'clear',
        'clear screen',
        'cls'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('clear');
      });
    });

    // Edge Cases
    it('should return null for empty input', () => {
      const result = classifyIntent('');
      expect(result).toBeNull();
    });

    it('should return null for slash commands (let existing handler deal with it)', () => {
      const result = classifyIntent('/test');
      expect(result).toBeNull();
    });

    it('should return null for unrecognized natural language', () => {
      const result = classifyIntent('tell me a joke about cats');
      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const variations = [
        'RUN TESTS',
        'Run Tests',
        'run tests'
      ];

      variations.forEach(input => {
        const result = classifyIntent(input);
        expect(result).not.toBeNull();
        expect(result?.command).toBe('test');
      });
    });
  });

  describe('detectConfirmation', () => {
    it('should detect "yes" confirmations', () => {
      const yesVariations = [
        'yes',
        'yep',
        'yeah',
        'yup',
        'sure',
        'ok',
        'okay',
        'fine',
        'sounds good',
        'looks good',
        'go ahead',
        'proceed',
        'continue',
        'apply it',
        'do it',
        'approve',
        'accept',
        'confirm',
        'y'
      ];

      yesVariations.forEach(input => {
        const result = detectConfirmation(input);
        expect(result).toBe('yes');
      });
    });

    it('should detect "no" confirmations', () => {
      const noVariations = [
        'no',
        'nope',
        'nah',
        'cancel',
        'stop',
        'abort',
        "don't",
        'dont',
        'do not',
        'n'
      ];

      noVariations.forEach(input => {
        const result = detectConfirmation(input);
        expect(result).toBe('no');
      });
    });

    it('should return null for non-confirmation input', () => {
      const neutralInputs = [
        'maybe',
        'I think so',
        'not sure',
        'tell me more',
        'what does this do?'
      ];

      neutralInputs.forEach(input => {
        const result = detectConfirmation(input);
        expect(result).toBeNull();
      });
    });

    it('should be case-insensitive', () => {
      expect(detectConfirmation('YES')).toBe('yes');
      expect(detectConfirmation('Yes')).toBe('yes');
      expect(detectConfirmation('NO')).toBe('no');
      expect(detectConfirmation('No')).toBe('no');
    });
  });

  describe('getIntentExamples', () => {
    it('should return examples for known commands', () => {
      const examples = getIntentExamples('test');
      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples).toContain('run tests');
    });

    it('should return empty array for unknown commands', () => {
      const examples = getIntentExamples('nonexistent');
      expect(examples).toEqual([]);
    });
  });

  describe('getAllIntentPatterns', () => {
    it('should return all intent patterns', () => {
      const patterns = getAllIntentPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(20); // We defined 20+ patterns
      expect(patterns[0]).toHaveProperty('patterns');
      expect(patterns[0]).toHaveProperty('command');
    });

    it('should have valid pattern structure', () => {
      const patterns = getAllIntentPatterns();

      patterns.forEach(pattern => {
        expect(pattern.patterns).toBeInstanceOf(Array);
        expect(pattern.patterns.length).toBeGreaterThan(0);
        expect(pattern.command).toBeTruthy();
        expect(typeof pattern.command).toBe('string');
      });
    });
  });

  describe('Performance', () => {
    it('should classify intent in < 50ms', () => {
      const start = Date.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        classifyIntent('run tests');
      }

      const end = Date.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(50);
    });

    it('should detect confirmation in < 10ms', () => {
      const start = Date.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        detectConfirmation('yes');
      }

      const end = Date.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(10);
    });
  });
});
