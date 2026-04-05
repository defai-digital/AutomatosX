import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listDefaultAgentCatalog } from '../src/agent-catalog.js';
import { ADVANCED_COMMANDS, getCommandMetadata, WORKFLOW_COMMAND_NAMES } from '../src/command-metadata.js';
import { DEFAULT_SETUP_MCP_TOOL_FAMILIES, STABLE_V15_MCP_TOOL_FAMILIES } from '@defai.digital/mcp-server';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REGISTRY_PATH = join(WORKSPACE_ROOT, 'automatosx', 'product-surface', 'v15-surface-registry.json');

interface V15SurfaceRegistry {
  stable: {
    cli_workflows: string[];
    cli_support: string[];
    built_in_agents: string[];
    mcp_tools: string[];
  };
  advanced: {
    cli_commands: string[];
  };
  explicit_decisions: {
    monitor: string;
    bridge: string;
    skill: string;
    remote_bridge_install: string;
    remote_skill_import: string;
    distribution_model: string;
  };
}

function loadRegistry(): V15SurfaceRegistry {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as V15SurfaceRegistry;
}

describe('v15 surface registry', () => {
  it('keeps stable workflow and support commands aligned with CLI metadata', () => {
    const registry = loadRegistry();

    expect(new Set(registry.stable.cli_workflows)).toEqual(new Set(['setup', ...WORKFLOW_COMMAND_NAMES]));

    for (const command of registry.stable.cli_workflows) {
      expect(getCommandMetadata(command)?.productTier).toBe('stable');
    }

    for (const command of registry.stable.cli_support) {
      expect(getCommandMetadata(command)?.productTier).toBe('stable');
    }
  });

  it('keeps advanced extension decisions aligned with CLI metadata', () => {
    const registry = loadRegistry();
    const advancedCommands = new Set(ADVANCED_COMMANDS.map((entry) => entry.command));

    expect(registry.explicit_decisions.monitor).toBe('advanced');
    expect(registry.explicit_decisions.bridge).toBe('advanced_local_first');
    expect(registry.explicit_decisions.skill).toBe('advanced_local_first');
    expect(registry.explicit_decisions.remote_bridge_install).toBe('out_of_scope_for_v15');
    expect(registry.explicit_decisions.remote_skill_import).toBe('out_of_scope_for_v15');

    for (const command of registry.advanced.cli_commands) {
      expect(advancedCommands.has(command)).toBe(true);
    }
  });

  it('keeps the stable built-in agent catalog aligned with the registry', () => {
    const registry = loadRegistry();

    expect(registry.stable.built_in_agents).toEqual(
      listDefaultAgentCatalog().map((entry) => entry.agentId),
    );
  });

  it('keeps the stable MCP tool registry aligned with the shared MCP export', () => {
    const registry = loadRegistry();

    expect(registry.stable.mcp_tools).toEqual([...STABLE_V15_MCP_TOOL_FAMILIES]);
    expect([...DEFAULT_SETUP_MCP_TOOL_FAMILIES]).toEqual(registry.stable.mcp_tools);
  });
});
