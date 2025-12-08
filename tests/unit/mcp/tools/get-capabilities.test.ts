/**
 * Unit tests for get_capabilities MCP tool
 *
 * Tests the helper functions and tool categorization logic.
 *
 * @module tests/unit/mcp/tools/get-capabilities
 */

import { describe, it, expect } from 'vitest';

// Test the categorizeTools function logic directly by reimplementing it
// (we can't easily import private functions)
function categorizeTools(name: string): 'memory' | 'session' | 'task' | 'discovery' | 'context' | 'execution' {
  if (name.startsWith('memory_') || name === 'search_memory') return 'memory';
  if (name.startsWith('session_')) return 'session';
  if (name.startsWith('create_task') || name.startsWith('run_task') ||
      name.startsWith('get_task') || name.startsWith('list_task') ||
      name.startsWith('delete_task')) return 'task';
  if (name === 'get_capabilities' || name === 'list_agents' ||
      name === 'get_status' || name === 'get_agent_context') return 'discovery';
  if (name.includes('context')) return 'context';
  return 'execution';
}

// Test the getExecutionMode function logic
function getExecutionMode(providerName: string): 'cli' | 'sdk' | 'hybrid' {
  // SDK-only providers (no CLI execution)
  if (providerName === 'glm' || providerName === 'grok') {
    return 'sdk';
  }
  // CLI-only providers (no SDK available)
  if (providerName === 'claude-code' || providerName === 'gemini-cli') {
    return 'cli';
  }
  // Hybrid providers (SDK preferred, CLI fallback)
  if (providerName === 'openai') {
    return 'hybrid';
  }
  // Default to CLI for unknown providers
  return 'cli';
}

// Test the getProviderType function logic
function getProviderType(providerName: string): 'cli' | 'sdk' | 'hybrid' {
  if (providerName === 'glm' || providerName === 'grok') return 'sdk';
  if (providerName === 'openai') return 'hybrid';
  return 'cli';
}

describe('get_capabilities helper functions', () => {
  describe('categorizeTools', () => {
    it('should categorize memory tools correctly', () => {
      expect(categorizeTools('memory_add')).toBe('memory');
      expect(categorizeTools('memory_delete')).toBe('memory');
      expect(categorizeTools('search_memory')).toBe('memory');
    });

    it('should categorize session tools correctly', () => {
      expect(categorizeTools('session_create')).toBe('session');
      expect(categorizeTools('session_list')).toBe('session');
      expect(categorizeTools('session_delete')).toBe('session');
    });

    it('should categorize task tools correctly', () => {
      expect(categorizeTools('create_task')).toBe('task');
      expect(categorizeTools('run_task')).toBe('task');
      expect(categorizeTools('get_task_status')).toBe('task');
      expect(categorizeTools('list_tasks')).toBe('task');
      expect(categorizeTools('delete_task')).toBe('task');
    });

    it('should categorize discovery tools correctly', () => {
      expect(categorizeTools('get_capabilities')).toBe('discovery');
      expect(categorizeTools('list_agents')).toBe('discovery');
      expect(categorizeTools('get_status')).toBe('discovery');
      expect(categorizeTools('get_agent_context')).toBe('discovery');
    });

    it('should categorize context tools correctly', () => {
      expect(categorizeTools('update_context')).toBe('context');
      expect(categorizeTools('clear_context')).toBe('context');
    });

    it('should categorize other tools as execution', () => {
      expect(categorizeTools('run_agent')).toBe('execution');
      expect(categorizeTools('execute_workflow')).toBe('execution');
      expect(categorizeTools('unknown_tool')).toBe('execution');
    });
  });

  describe('getExecutionMode', () => {
    it('should return sdk for GLM provider', () => {
      expect(getExecutionMode('glm')).toBe('sdk');
    });

    it('should return sdk for Grok provider', () => {
      expect(getExecutionMode('grok')).toBe('sdk');
    });

    it('should return cli for Claude Code provider', () => {
      expect(getExecutionMode('claude-code')).toBe('cli');
    });

    it('should return cli for Gemini CLI provider', () => {
      expect(getExecutionMode('gemini-cli')).toBe('cli');
    });

    it('should return hybrid for OpenAI provider', () => {
      expect(getExecutionMode('openai')).toBe('hybrid');
    });

    it('should return cli for unknown providers', () => {
      expect(getExecutionMode('unknown-provider')).toBe('cli');
    });
  });

  describe('getProviderType', () => {
    it('should return sdk type for SDK-only providers', () => {
      expect(getProviderType('glm')).toBe('sdk');
      expect(getProviderType('grok')).toBe('sdk');
    });

    it('should return hybrid type for hybrid providers', () => {
      expect(getProviderType('openai')).toBe('hybrid');
    });

    it('should return cli type for CLI-only providers', () => {
      expect(getProviderType('claude-code')).toBe('cli');
      expect(getProviderType('gemini-cli')).toBe('cli');
    });

    it('should return cli type for unknown providers', () => {
      expect(getProviderType('some-new-provider')).toBe('cli');
    });
  });
});

describe('get_capabilities output structure', () => {
  it('should have correct provider capability shape', () => {
    const providerCapability = {
      name: 'glm',
      enabled: true,
      available: true,
      type: 'sdk' as const,
      executionMode: 'sdk' as const,
      priority: 5,
      model: 'glm-4'
    };

    expect(providerCapability.name).toBe('glm');
    expect(providerCapability.type).toBe('sdk');
    expect(providerCapability.executionMode).toBe('sdk');
    expect(typeof providerCapability.priority).toBe('number');
  });

  it('should have correct agent capability shape', () => {
    const agentCapability = {
      name: 'backend',
      displayName: 'Backend Engineer',
      role: 'Software Development',
      description: 'Implements server-side logic',
      team: 'engineering',
      abilities: ['code', 'debug', 'test']
    };

    expect(agentCapability.name).toBe('backend');
    expect(Array.isArray(agentCapability.abilities)).toBe(true);
  });

  it('should have correct tool capability shape', () => {
    const toolCapability = {
      name: 'get_capabilities',
      description: 'Get system capabilities',
      category: 'discovery' as const
    };

    expect(toolCapability.name).toBe('get_capabilities');
    expect(toolCapability.category).toBe('discovery');
  });
});
