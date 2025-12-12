/**
 * Manifest Generator Unit Tests
 *
 * Tests for Claude Code integration manifest generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { ManifestGenerator, type ManifestGeneratorOptions } from '../../../../src/integrations/claude-code/manifest-generator.js';
import type { ProfileLoader } from '../../../../src/agents/profile-loader.js';
import type { AgentProfile } from '../../../../src/types/agent.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock logger
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ManifestGenerator', () => {
  let generator: ManifestGenerator;
  let mockProfileLoader: ProfileLoader;
  let mockProfiles: Map<string, AgentProfile>;

  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      '/project': null,
    });

    // Create mock profiles
    mockProfiles = new Map<string, AgentProfile>([
      [
        'backend',
        {
          name: 'backend',
          displayName: 'Benny',
          role: 'Backend Developer',
          description: 'Handles server-side development',
          systemPrompt: 'You are a backend developer...',
          abilities: ['api', 'database'],
        },
      ],
      [
        'frontend',
        {
          name: 'frontend',
          displayName: 'Fiona',
          role: 'Frontend Developer',
          description: 'Handles client-side development',
          systemPrompt: 'You are a frontend developer...',
          abilities: ['ui', 'react'],
        },
      ],
      [
        'quality',
        {
          name: 'quality',
          displayName: 'Queenie',
          role: 'QA Engineer',
          description: 'Ensures code quality',
          systemPrompt: 'You are a quality engineer...',
          abilities: ['testing', 'review'],
        },
      ],
    ]);

    // Create mock profile loader
    mockProfileLoader = {
      listProfiles: vi.fn().mockResolvedValue(['backend', 'frontend', 'quality']),
      loadProfile: vi.fn().mockImplementation(async (name: string) => {
        const profile = mockProfiles.get(name);
        if (!profile) {
          throw new Error(`Profile not found: ${name}`);
        }
        return profile;
      }),
      hasProfile: vi.fn().mockImplementation((name: string) => mockProfiles.has(name)),
      getDefaultProfile: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as ProfileLoader;

    generator = new ManifestGenerator({
      profileLoader: mockProfileLoader,
      projectDir: '/project',
    });
  });

  afterEach(() => {
    vol.reset();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create generator with options', () => {
      const options: ManifestGeneratorOptions = {
        profileLoader: mockProfileLoader,
        projectDir: '/my/project',
      };

      const gen = new ManifestGenerator(options);
      expect(gen).toBeDefined();
    });
  });

  describe('generateAll', () => {
    it('should generate all manifest files', async () => {
      await generator.generateAll();

      // Check skills directory was created
      expect(vol.existsSync('/project/.claude/skills/automatosx/SKILL.md')).toBe(true);

      // Check agents directory was created
      expect(
        vol.existsSync('/project/.claude/agents/automatosx-coordinator/AGENT.md')
      ).toBe(true);

      // Check commands were created
      expect(vol.existsSync('/project/.claude/commands/agent-backend.md')).toBe(true);
      expect(vol.existsSync('/project/.claude/commands/agent-frontend.md')).toBe(true);
      expect(vol.existsSync('/project/.claude/commands/agent-quality.md')).toBe(true);
    });

    it('should throw error on failure', async () => {
      // Make listProfiles fail
      (mockProfileLoader.listProfiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database error')
      );

      await expect(generator.generateAll()).rejects.toThrow('Database error');
    });
  });

  describe('generateSkills', () => {
    it('should generate skills file with agent list', async () => {
      await generator.generateSkills();

      const content = vol.readFileSync(
        '/project/.claude/skills/automatosx/SKILL.md',
        'utf-8'
      ) as string;

      expect(content).toContain('name: automatosx-orchestration');
      expect(content).toContain('Benny');
      expect(content).toContain('Fiona');
      expect(content).toContain('Queenie');
      expect(content).toContain('backend');
      expect(content).toContain('frontend');
      expect(content).toContain('quality');
    });

    it('should include MCP tool references', async () => {
      await generator.generateSkills();

      const content = vol.readFileSync(
        '/project/.claude/skills/automatosx/SKILL.md',
        'utf-8'
      ) as string;

      expect(content).toContain('mcp__automatosx__run_agent');
      expect(content).toContain('mcp__automatosx__list_agents');
      expect(content).toContain('mcp__automatosx__search_memory');
    });

    it('should include timestamp', async () => {
      await generator.generateSkills();

      const content = vol.readFileSync(
        '/project/.claude/skills/automatosx/SKILL.md',
        'utf-8'
      ) as string;

      expect(content).toContain('generated:');
      expect(content).toContain('generator: manifest-generator');
    });

    it('should continue loading profiles even if one fails', async () => {
      (mockProfileLoader.loadProfile as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(mockProfiles.get('frontend'))
        .mockResolvedValueOnce(mockProfiles.get('quality'));

      await generator.generateSkills();

      const content = vol.readFileSync(
        '/project/.claude/skills/automatosx/SKILL.md',
        'utf-8'
      ) as string;

      // Should still include the successful profiles
      expect(content).toContain('frontend');
      expect(content).toContain('quality');
    });
  });

  describe('generateCommands', () => {
    it('should generate command file for each agent', async () => {
      await generator.generateCommands();

      expect(vol.existsSync('/project/.claude/commands/agent-backend.md')).toBe(true);
      expect(vol.existsSync('/project/.claude/commands/agent-frontend.md')).toBe(true);
      expect(vol.existsSync('/project/.claude/commands/agent-quality.md')).toBe(true);
    });

    it('should include correct command content', async () => {
      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('description: Run the Benny agent (backend)');
      expect(content).toContain('ax run backend');
      expect(content).toContain('$ARGUMENTS');
      expect(content).toContain('generator: manifest-generator');
    });

    it('should use displayName in command title', async () => {
      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-frontend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('# Fiona Agent');
    });
  });

  describe('generateSubAgent', () => {
    it('should generate sub-agent file', async () => {
      await generator.generateSubAgent();

      expect(
        vol.existsSync('/project/.claude/agents/automatosx-coordinator/AGENT.md')
      ).toBe(true);
    });

    it('should include agent list', async () => {
      await generator.generateSubAgent();

      const content = vol.readFileSync(
        '/project/.claude/agents/automatosx-coordinator/AGENT.md',
        'utf-8'
      ) as string;

      expect(content).toContain('backend');
      expect(content).toContain('frontend');
      expect(content).toContain('quality');
    });

    it('should include coordinator configuration', async () => {
      await generator.generateSubAgent();

      const content = vol.readFileSync(
        '/project/.claude/agents/automatosx-coordinator/AGENT.md',
        'utf-8'
      ) as string;

      expect(content).toContain('name: automatosx-coordinator');
      expect(content).toContain('model: sonnet');
      expect(content).toContain('mcp__automatosx__run_agent');
      expect(content).toContain('mcp__automatosx__search_memory');
    });

    it('should include workflow examples', async () => {
      await generator.generateSubAgent();

      const content = vol.readFileSync(
        '/project/.claude/agents/automatosx-coordinator/AGENT.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Workflow Examples');
      expect(content).toContain('Implement User Authentication');
    });
  });

  describe('getAgentDescription (via generated content)', () => {
    it('should use description field when available', async () => {
      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Handles server-side development');
    });

    it('should fall back to role when description is empty', async () => {
      mockProfiles.set('backend', {
        name: 'backend',
        displayName: 'Benny',
        role: 'Backend Developer',
        description: '',
        systemPrompt: 'test',
        abilities: [],
      });

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Backend Developer');
    });

    it('should fall back to systemPrompt first line when no description or role', async () => {
      mockProfiles.set('backend', {
        name: 'backend',
        displayName: 'Benny',
        role: '',
        description: '',
        systemPrompt: 'Expert backend developer for APIs',
        abilities: [],
      });

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Expert backend developer for APIs');
    });

    it('should fall back to displayName when all else fails', async () => {
      mockProfiles.set('backend', {
        name: 'backend',
        displayName: 'Benny',
        role: '',
        description: '',
        systemPrompt: '',
        abilities: [],
      });

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Benny - specialized agent');
    });

    it('should use final fallback when no info available', async () => {
      mockProfiles.set('backend', {
        name: 'backend',
        role: '',
        description: '',
        systemPrompt: '',
        abilities: [],
      } as AgentProfile);

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      expect(content).toContain('Specialized agent for backend');
    });

    it('should truncate long systemPrompt lines', async () => {
      const longPrompt = 'A'.repeat(250); // More than 200 chars
      mockProfiles.set('backend', {
        name: 'backend',
        displayName: 'Benny',
        role: '',
        description: '',
        systemPrompt: longPrompt,
        abilities: [],
      });

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-backend.md',
        'utf-8'
      ) as string;

      // Should use displayName fallback since systemPrompt line is too long
      expect(content).toContain('Benny - specialized agent');
    });

    it('should handle agents without displayName', async () => {
      mockProfiles.set('simple', {
        name: 'simple',
        role: 'Agent',
        description: 'A simple agent',
        systemPrompt: '',
        abilities: [],
      } as AgentProfile);
      (mockProfileLoader.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue(['simple']);

      await generator.generateCommands();

      const content = vol.readFileSync(
        '/project/.claude/commands/agent-simple.md',
        'utf-8'
      ) as string;

      expect(content).toContain('# simple Agent'); // Uses name when no displayName
    });
  });
});
