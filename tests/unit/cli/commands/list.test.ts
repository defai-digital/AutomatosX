/**
 * Tests for list CLI command
 * Full coverage for handler and all branches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted for stable mocks
const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn()
}));

const fsPromisesMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn()
}));

const jsYamlMock = vi.hoisted(() => ({
  load: vi.fn()
}));

const pathResolverMock = vi.hoisted(() => {
  // Use a class to ensure stable mock implementation
  class MockPathResolver {
    getAgentsDirectory() {
      return '/test/project/.automatosx/agents';
    }
    getAbilitiesDirectory() {
      return '/test/project/.automatosx/abilities';
    }
  }

  return {
    PathResolver: MockPathResolver,
    detectProjectRoot: vi.fn()
  };
});

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    magenta: vi.fn((s: string) => s),
    bold: vi.fn((s: string) => s),
    red: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    }),
    blue: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s)
    })
  }
}));

vi.mock('fs/promises', () => fsPromisesMock);
vi.mock('fs', () => fsMock);
vi.mock('js-yaml', () => jsYamlMock);

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../../src/shared/validation/path-resolver.js', () => pathResolverMock);

describe('List Command', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Setup default mocks
    pathResolverMock.detectProjectRoot.mockResolvedValue('/test/project');
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore();
    vi.resetModules();
  });

  describe('Command Structure', () => {
    it('should have correct command name', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');
      expect(listCommand.command).toBe('list <type>');
    });

    it('should have description', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');
      expect(listCommand.describe).toBe('List available agents, abilities, or providers');
    });

    it('should have builder function', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');
      expect(typeof listCommand.builder).toBe('function');
    });

    it('should have handler function', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');
      expect(typeof listCommand.handler).toBe('function');
    });

    it('should configure options in builder', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis()
      };

      (listCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('type', expect.objectContaining({
        type: 'string',
        choices: ['agents', 'abilities', 'providers'],
        demandOption: true
      }));

      expect(mockYargs.option).toHaveBeenCalledWith('format', expect.objectContaining({
        type: 'string',
        choices: ['text', 'json'],
        default: 'text'
      }));
    });
  });

  describe('Handler - List Providers', () => {
    it('should list providers in text format', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('claude');
      expect(allCalls).toContain('gemini');
      expect(allCalls).toContain('openai-embed');
    });

    it('should list providers in json format', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.providers).toHaveLength(3);
      expect(parsed.total).toBe(3);
      expect(parsed.providers[0].name).toBe('claude');
    });

    it('should default format to text when undefined', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: undefined,
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      // Text format has multiple console.log calls
      expect(mockConsoleLog.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('Handler - List Agents', () => {
    it('should list agents in text format', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml', 'frontend.yml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend\ndescription: Backend dev\nabilities:\n  - api-design');
      jsYamlMock.load.mockReturnValue({
        name: 'backend',
        displayName: 'Benny',
        description: 'Backend developer',
        abilities: ['api-design', 'database']
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(pathResolverMock.detectProjectRoot).toHaveBeenCalled();
    });

    it('should list agents in json format', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend',
        description: 'Backend developer',
        abilities: ['api-design']
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toBeDefined();
      expect(parsed.total).toBeDefined();
    });

    it('should handle agents with displayName', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('displayName: Benny');
      jsYamlMock.load.mockReturnValue({
        displayName: 'Benny',
        description: 'Backend developer'
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents[0].name).toBe('Benny');
    });

    it('should fallback to name when no displayName', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend'
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents[0].name).toBe('backend');
    });

    it('should fallback to filename when no name', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['custom-agent.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('description: Custom agent');
      jsYamlMock.load.mockReturnValue({
        description: 'Custom agent'
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents[0].name).toBe('custom-agent');
    });

    it('should use tier config description when YAML has no description', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend'
        // No description in YAML
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      // v12.9.0: Prefers tier config description for known agents
      expect(parsed.agents[0].description).toBe('API design, databases, server-side logic');
    });

    it('should fall back to No description for unknown agents', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['custom-agent.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: custom-agent');
      jsYamlMock.load.mockReturnValue({
        name: 'custom-agent'
        // No description and not in AGENT_TIER_MAP
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents[0].description).toBe('No description');
    });

    it('should display agents with tier grouping in text format', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend',
        description: 'Backend developer',
        abilities: ['api-design', 'database', 'testing']
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      // v12.9.0: Now shows tier-based grouping instead of abilities
      expect(allCalls).toContain('Core Agents');
    });

    it('should handle agents without abilities in text format', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend',
        description: 'Backend developer'
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should load agents from both directories', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir
        .mockResolvedValueOnce(['backend.yaml'])  // .automatosx/agents
        .mockResolvedValueOnce(['frontend.yaml']); // examples/agents
      fsPromisesMock.readFile.mockResolvedValue('name: agent');
      jsYamlMock.load.mockReturnValue({ name: 'agent' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toHaveLength(2);
    });

    it('should skip duplicates from examples directory', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir
        .mockResolvedValueOnce(['backend.yaml'])  // .automatosx/agents
        .mockResolvedValueOnce(['backend.yaml']); // examples/agents (duplicate)
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({ name: 'backend' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toHaveLength(1);
    });

    it('should filter yaml and yml files only', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml', 'frontend.yml', 'readme.md', 'config.json']);
      fsPromisesMock.readFile.mockResolvedValue('name: agent');
      jsYamlMock.load.mockReturnValue({ name: 'agent' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toHaveLength(2);
    });

    it('should handle no agents found in text format', async () => {
      fsMock.existsSync.mockReturnValue(false);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('No agents found');
    });

    it('should handle no agents found in json format', async () => {
      fsMock.existsSync.mockReturnValue(false);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toEqual([]);
      expect(parsed.total).toBe(0);
    });

    it('should handle ENOENT error when reading agents', async () => {
      fsMock.existsSync.mockReturnValue(true);
      const enoentError = new Error('Directory not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      fsPromisesMock.readdir.mockRejectedValue(enoentError);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Agents directory not found');
    });

    it('should rethrow non-ENOENT errors when reading agents', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockRejectedValue(new Error('Permission denied'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should skip agents that fail to load in json mode', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['valid.yaml', 'invalid.yaml']);
      fsPromisesMock.readFile
        .mockResolvedValueOnce('name: valid')
        .mockRejectedValueOnce(new Error('Parse error'));
      jsYamlMock.load.mockReturnValue({ name: 'valid' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents).toHaveLength(1);
      expect(parsed.agents[0].name).toBe('valid');
    });

    it('should sort agents by filename', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['frontend.yaml', 'backend.yaml', 'quality.yaml']);
      fsPromisesMock.readFile.mockImplementation((path: string) => {
        if (path.includes('backend')) return Promise.resolve('name: backend');
        if (path.includes('frontend')) return Promise.resolve('name: frontend');
        return Promise.resolve('name: quality');
      });
      jsYamlMock.load.mockImplementation((content: string) => {
        if (content.includes('backend')) return { name: 'backend' };
        if (content.includes('frontend')) return { name: 'frontend' };
        return { name: 'quality' };
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.agents[0].name).toBe('backend');
      expect(parsed.agents[1].name).toBe('frontend');
      expect(parsed.agents[2].name).toBe('quality');
    });

    it('should track agent source (.automatosx vs examples)', async () => {
      fsMock.existsSync.mockReturnValue(true);
      // Use filenames where local comes before example alphabetically
      fsPromisesMock.readdir
        .mockResolvedValueOnce(['aaa-local.yaml'])
        .mockResolvedValueOnce(['zzz-example.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: agent');
      jsYamlMock.load.mockReturnValue({ name: 'agent' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      // Sorted alphabetically: aaa-local comes before zzz-example
      expect(parsed.agents[0].source).toBe('.automatosx');
      expect(parsed.agents[1].source).toBe('examples');
    });

    it('should handle empty abilities array', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({
        name: 'backend',
        abilities: []
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      // Empty abilities should not show "Abilities:" line
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Handler - List Abilities', () => {
    it('should list abilities in text format', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['code-review.md', 'testing.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Code Review\n\n## Description\nAnalyze code quality');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Available Abilities');
    });

    it('should list abilities in json format', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['code-review.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Code Review\n\n## Description\nAnalyze code quality');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities).toBeDefined();
      expect(parsed.total).toBeDefined();
    });

    it('should extract title from markdown', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['ability.md']);
      fsPromisesMock.readFile.mockResolvedValue('# My Ability\n\n## Description\nDoes something');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].name).toBe('My Ability');
    });

    it('should fallback to filename when no title', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['custom-ability.md']);
      fsPromisesMock.readFile.mockResolvedValue('Some content without title');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].name).toBe('custom-ability');
    });

    it('should extract description from markdown', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['ability.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Title\n\n## Description\nThis is the description');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].description).toBe('This is the description');
    });

    it('should default description when not found', async () => {
      // Content without empty lines - no ## Description header
      fsPromisesMock.readdir.mockResolvedValue(['ability.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Title\nSome other content without description header');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].description).toBe('No description');
    });

    it('should handle no abilities found in text format', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['config.yaml', 'readme.txt']);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('No abilities found');
    });

    it('should handle no abilities found in json format', async () => {
      fsPromisesMock.readdir.mockResolvedValue([]);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities).toEqual([]);
      expect(parsed.total).toBe(0);
    });

    it('should handle ENOENT error when reading abilities', async () => {
      const enoentError = new Error('Directory not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      fsPromisesMock.readdir.mockRejectedValue(enoentError);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Abilities directory not found');
    });

    it('should rethrow non-ENOENT errors when reading abilities', async () => {
      fsPromisesMock.readdir.mockRejectedValue(new Error('Permission denied'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should skip abilities that fail to load', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['valid.md', 'invalid.md']);
      fsPromisesMock.readFile
        .mockResolvedValueOnce('# Valid\n\n## Description\nValid ability')
        .mockRejectedValueOnce(new Error('Read error'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities).toHaveLength(1);
    });

    it('should sort abilities by filename', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['z-ability.md', 'a-ability.md', 'm-ability.md']);
      fsPromisesMock.readFile.mockImplementation((path: string) => {
        if (path.includes('a-')) return Promise.resolve('# A Ability');
        if (path.includes('m-')) return Promise.resolve('# M Ability');
        return Promise.resolve('# Z Ability');
      });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].name).toBe('A Ability');
      expect(parsed.abilities[1].name).toBe('M Ability');
      expect(parsed.abilities[2].name).toBe('Z Ability');
    });

    it('should filter markdown files only', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['ability1.md', 'ability2.md', 'config.yaml', 'script.js']);
      fsPromisesMock.readFile.mockResolvedValue('# Ability\n\n## Description\nTest');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities).toHaveLength(2);
    });

    it('should handle empty description line after header', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['ability.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Title\n\n## Description\n');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'json',
        _: ['list'],
        $0: 'ax'
      } as any);

      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.abilities[0].description).toBe('No description');
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle detectProjectRoot error', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValue(new Error('Not a project directory'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should display error message on failure', async () => {
      pathResolverMock.detectProjectRoot.mockRejectedValue(new Error('Test error message'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Failed to list');
      expect(allCalls).toContain('Test error message');
    });

    it('should log error with logger on failure', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      pathResolverMock.detectProjectRoot.mockRejectedValue(new Error('Log error'));

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(logger.error).toHaveBeenCalledWith(
        'List command failed',
        expect.objectContaining({
          type: 'providers',
          error: 'Log error'
        })
      );
    });
  });

  describe('PathResolver Integration', () => {
    it('should create PathResolver and detect project root', async () => {
      fsMock.existsSync.mockReturnValue(false);

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      expect(pathResolverMock.detectProjectRoot).toHaveBeenCalled();
    });
  });

  describe('Text Output Formatting', () => {
    it('should display provider capabilities', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('text-generation');
      expect(allCalls).toContain('conversation');
      expect(allCalls).toContain('embeddings');
    });

    it('should display provider status', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Status');
      expect(allCalls).toContain('Available');
    });

    it('should display total count for providers', async () => {
      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'providers',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Total: 3 provider(s)');
    });

    it('should display agent tier labels and count in text output', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsPromisesMock.readdir.mockResolvedValue(['backend.yaml']);
      fsPromisesMock.readFile.mockResolvedValue('name: backend');
      jsYamlMock.load.mockReturnValue({ name: 'backend', description: 'Test' });

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'agents',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      // v12.9.0: Now shows tier labels and agent count instead of source paths
      expect(allCalls).toContain('Showing');
      expect(allCalls).toContain('agent(s)');
    });

    it('should display ability total count', async () => {
      fsPromisesMock.readdir.mockResolvedValue(['a.md', 'b.md', 'c.md']);
      fsPromisesMock.readFile.mockResolvedValue('# Test\n\n## Description\nDesc');

      const { listCommand } = await import('../../../../src/cli/commands/list.js');

      await listCommand.handler({
        type: 'abilities',
        format: 'text',
        _: ['list'],
        $0: 'ax'
      } as any);

      const allCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Total: 3 ability(ies)');
    });
  });
});
