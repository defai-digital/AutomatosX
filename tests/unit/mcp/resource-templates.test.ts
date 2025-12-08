import { describe, it, expect, vi } from 'vitest';
import {
  listResourceTemplates,
  resolveResourceTemplate
} from '../../../src/mcp/resource-templates.js';

describe('resource templates', () => {
  it('lists built-in templates', () => {
    const names = listResourceTemplates().map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['agent_profile', 'workspace_prd_file', 'workspace_tmp_file'])
    );
  });

  it('renders agent profile template', async () => {
    const profileLoader = {
      loadProfile: vi.fn().mockResolvedValue({
        role: 'Helper',
        abilities: ['plan', 'code'],
        systemPrompt: 'Be helpful.'
      })
    };
    const workspaceManager = {
      readPRD: vi.fn(),
      readTmp: vi.fn()
    };

    const result = await resolveResourceTemplate(
      'agent/{agent}',
      { agent: 'alice' },
      profileLoader as any,
      workspaceManager as any
    );

    expect(profileLoader.loadProfile).toHaveBeenCalledWith('alice');
    expect(result.uri).toBe('agent/alice');
    expect(result.contents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({ type: 'application/json' })
      ])
    );
  });

  it('reads workspace PRD template', async () => {
    const profileLoader = { loadProfile: vi.fn() };
    const workspaceManager = {
      readPRD: vi.fn().mockResolvedValue('# PRD content'),
      readTmp: vi.fn()
    };

    const result = await resolveResourceTemplate(
      'workspace/prd/{path}',
      { path: 'spec.md' },
      profileLoader as any,
      workspaceManager as any
    );

    expect(workspaceManager.readPRD).toHaveBeenCalledWith('spec.md');
    expect(result.uri).toBe('prd/spec.md');
    expect(result.contents[0]).toEqual({ type: 'text', text: '# PRD content' });
  });

  it('reads workspace tmp template', async () => {
    const profileLoader = { loadProfile: vi.fn() };
    const workspaceManager = {
      readPRD: vi.fn(),
      readTmp: vi.fn().mockResolvedValue('tmp content')
    };

    const result = await resolveResourceTemplate(
      'workspace/tmp/{path}',
      { path: 'note.txt' },
      profileLoader as any,
      workspaceManager as any
    );

    expect(workspaceManager.readTmp).toHaveBeenCalledWith('note.txt');
    expect(result.uri).toBe('tmp/note.txt');
    expect(result.contents[0]).toEqual({ type: 'text', text: 'tmp content' });
  });

  it('throws for missing variables', async () => {
    const profileLoader = { loadProfile: vi.fn() };
    const workspaceManager = { readPRD: vi.fn(), readTmp: vi.fn() };
    await expect(
      resolveResourceTemplate('agent/{agent}', {}, profileLoader as any, workspaceManager as any)
    ).rejects.toThrow(/Missing required variable/);
  });
});
