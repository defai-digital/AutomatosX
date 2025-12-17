/**
 * Iterate CLI Integration Tests
 *
 * Tests for the iterate mode CLI integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseArgs, parseTime } from '@automatosx/cli';

describe('Iterate CLI Integration', () => {
  describe('Parser: Iterate Flags', () => {
    it('should parse --iterate flag', () => {
      const result = parseArgs(['node', 'ax', 'call', '--iterate', 'claude', 'test']);
      expect(result.options.iterate).toBe(true);
      expect(result.command).toBe('call');
    });

    it('should parse --max-iterations flag', () => {
      const result = parseArgs(['node', 'ax', 'call', '--max-iterations', '50', 'claude', 'test']);
      expect(result.options.maxIterations).toBe(50);
    });

    it('should parse --max-time flag', () => {
      const result = parseArgs(['node', 'ax', 'call', '--max-time', '10m', 'claude', 'test']);
      expect(result.options.maxTime).toBe('10m');
    });

    it('should parse --no-context flag', () => {
      const result = parseArgs(['node', 'ax', 'call', '--no-context', 'claude', 'test']);
      expect(result.options.noContext).toBe(true);
    });

    it('should parse combined iterate flags', () => {
      const result = parseArgs([
        'node', 'ax', 'call',
        '--iterate',
        '--max-iterations', '100',
        '--max-time', '30m',
        '--no-context',
        'claude',
        'implement auth'
      ]);

      expect(result.options.iterate).toBe(true);
      expect(result.options.maxIterations).toBe(100);
      expect(result.options.maxTime).toBe('30m');
      expect(result.options.noContext).toBe(true);
      expect(result.command).toBe('call');
    });

    it('should default iterate options to false/undefined', () => {
      const result = parseArgs(['node', 'ax', 'call', 'claude', 'test']);
      expect(result.options.iterate).toBe(false);
      expect(result.options.maxIterations).toBeUndefined();
      expect(result.options.maxTime).toBeUndefined();
      expect(result.options.noContext).toBe(false);
    });
  });

  describe('Parser: Time Parsing', () => {
    it('should parse seconds', () => {
      expect(parseTime('30s')).toBe(30000);
      expect(parseTime('60s')).toBe(60000);
    });

    it('should parse minutes', () => {
      expect(parseTime('5m')).toBe(300000);
      expect(parseTime('10m')).toBe(600000);
    });

    it('should parse hours', () => {
      expect(parseTime('1h')).toBe(3600000);
      expect(parseTime('2h')).toBe(7200000);
    });

    it('should throw on invalid format', () => {
      expect(() => parseTime('invalid')).toThrow('Invalid time format');
      expect(() => parseTime('5')).toThrow('Invalid time format');
      expect(() => parseTime('5d')).toThrow('Invalid time format');
    });
  });

  describe('Iterate Command Parsing', () => {
    it('should recognize iterate command', () => {
      const result = parseArgs(['node', 'ax', 'iterate', 'claude', 'test task']);
      expect(result.command).toBe('iterate');
      expect(result.args).toContain('claude');
    });

    it('should pass through options to iterate command', () => {
      const result = parseArgs([
        'node', 'ax', 'iterate',
        '--max-iterations', '25',
        'gemini',
        'complex task'
      ]);
      expect(result.command).toBe('iterate');
      expect(result.options.maxIterations).toBe(25);
    });
  });
});

describe('Context Loading Integration', () => {
  let testDir: string;
  let contextDir: string;

  beforeEach(async () => {
    // Create temp directory structure
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iterate-test-'));
    contextDir = path.join(testDir, '.automatosx', 'context');
    await fs.mkdir(contextDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect context directory exists', async () => {
    const { hasProjectContext } = await import('@automatosx/context-domain');
    const result = await hasProjectContext(testDir);
    expect(result).toBe(true);
  });

  it('should load context files', async () => {
    const { ContextLoader } = await import('@automatosx/context-domain');

    // Create a test context file
    await fs.writeFile(
      path.join(contextDir, 'conventions.md'),
      '# Conventions\n\nUse TypeScript.'
    );

    const loader = new ContextLoader();
    const result = await loader.load(testDir);

    expect(result.success).toBe(true);
    expect(result.filesLoaded).toBe(1);
    expect(result.context?.combinedContent).toContain('Use TypeScript');
  });

  it('should return empty context when directory does not exist', async () => {
    const { ContextLoader } = await import('@automatosx/context-domain');

    const loader = new ContextLoader();
    const result = await loader.load('/non-existent-path');

    expect(result.success).toBe(true);
    expect(result.filesLoaded).toBe(0);
  });
});

describe('Iterate Controller Integration', () => {
  it('should create controller with budget', async () => {
    const { IterateController } = await import('@automatosx/iterate-domain');

    const controller = new IterateController({
      maxIterations: 10,
      maxTimeMs: 60000,
    });

    const state = controller.start({
      task: 'Test task',
      budget: { maxIterations: 10, maxTimeMs: 60000 },
    });

    expect(state.status).toBe('running');
    expect(state.iteration).toBe(0);
    expect(state.budget.maxIterations).toBe(10);
  });

  it('should map intents to actions', async () => {
    const { IterateController } = await import('@automatosx/iterate-domain');

    const controller = new IterateController();
    const state = controller.start({ task: 'Test' });

    // Test continue intent
    const continueResult = controller.handleResponse(state, 'continue');
    expect(continueResult.action.type).toBe('CONTINUE');

    // Test complete intent
    const completeResult = controller.handleResponse(state, 'complete');
    expect(completeResult.action.type).toBe('STOP');

    // Test question intent
    const questionResult = controller.handleResponse(state, 'question');
    expect(questionResult.action.type).toBe('PAUSE');
  });

  it('should enforce budget limits', async () => {
    const { IterateController } = await import('@automatosx/iterate-domain');

    const controller = new IterateController({
      maxIterations: 2,
      maxTimeMs: 60000,
    });

    let state = controller.start({
      task: 'Test',
      budget: { maxIterations: 2, maxTimeMs: 60000 },
    });

    // First iteration
    let result = controller.handleResponse(state, 'continue');
    state = result.newState;

    // Second iteration - should exceed budget
    result = controller.handleResponse(state, 'continue');

    expect(result.action.type).toBe('STOP');
    expect(result.newState.status).toBe('budget_exceeded');
  });
});

describe('CLI Command Registry', () => {
  it('should have iterate command registered', async () => {
    const { createCLI } = await import('@automatosx/cli');
    const cli = createCLI();

    // Parse iterate command
    const result = cli.parseArgs(['node', 'ax', 'iterate', 'claude', 'test']);
    expect(result.command).toBe('iterate');
  });

  it('should have call command with iterate support', async () => {
    const { createCLI } = await import('@automatosx/cli');
    const cli = createCLI();

    // Parse call with iterate
    const result = cli.parseArgs(['node', 'ax', 'call', '--iterate', 'claude', 'test']);
    expect(result.command).toBe('call');
    expect(result.options.iterate).toBe(true);
  });
});
