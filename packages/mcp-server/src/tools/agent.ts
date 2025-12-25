import type { MCPTool, ToolHandler } from '../types.js';
import type { AgentProfile, AgentResult, AgentCategory } from '@defai.digital/contracts';
import { LIMIT_AGENTS } from '@defai.digital/contracts';
import type { AgentFilter } from '@defai.digital/agent-domain';
import {
  getAvailableTemplates,
  createWorkflowFromTemplate,
  isValidTemplateName,
  createAgentSelectionService,
} from '@defai.digital/agent-domain';
// Import from registry-accessor to avoid circular dependencies
import {
  getSharedRegistry,
  getSharedExecutor,
} from '../registry-accessor.js';

/**
 * Agent list tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const agentListTool: MCPTool = {
  name: 'agent_list',
  description: 'List available agents with optional filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      team: {
        type: 'string',
        description: 'Filter by team name',
      },
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of agents to return',
        default: LIMIT_AGENTS,
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: 'List of agent summaries',
        items: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            displayName: { type: 'string' },
            description: { type: 'string' },
            team: { type: 'string' },
            enabled: { type: 'boolean' },
            capabilities: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      total: { type: 'number', description: 'Total number of agents' },
    },
    required: ['agents', 'total'],
  },
  idempotent: true,
};

/**
 * Agent run tool definition
 * INV-MCP-004: Non-idempotent - creates new execution each call
 * INV-MCP-002: Side effects - executes agent workflow, may modify state
 */
export const agentRunTool: MCPTool = {
  name: 'agent_run',
  description: 'Execute an agent with the given input. SIDE EFFECTS: Creates new agent execution, may modify session state and emit trace events.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The ID of the agent to run',
      },
      input: {
        type: 'object',
        description: 'Input data for the agent',
      },
      sessionId: {
        type: 'string',
        description: 'Optional session ID to associate with the run',
      },
    },
    required: ['agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Whether execution succeeded' },
      agentId: { type: 'string', description: 'Agent that was executed' },
      sessionId: { type: 'string', description: 'Session ID (if provided)' },
      output: { type: 'object', description: 'Agent output data' },
      stepResults: {
        type: 'array',
        description: 'Results from each step',
        items: {
          type: 'object',
          properties: {
            stepId: { type: 'string' },
            success: { type: 'boolean' },
            durationMs: { type: 'number' },
          },
        },
      },
      totalDurationMs: { type: 'number', description: 'Total execution time' },
      error: { type: 'object', description: 'Error details if failed' },
    },
    required: ['success', 'agentId', 'totalDurationMs'],
  },
  idempotent: false,
  retryableErrors: ['AGENT_EXECUTION_FAILED'],
};

/**
 * Agent get tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const agentGetTool: MCPTool = {
  name: 'agent_get',
  description: 'Get detailed information about a specific agent. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The ID of the agent to retrieve',
      },
    },
    required: ['agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      displayName: { type: 'string' },
      version: { type: 'string' },
      description: { type: 'string' },
      role: { type: 'string' },
      expertise: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string' } },
      team: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      enabled: { type: 'boolean' },
      workflow: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            stepId: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
          },
        },
      },
      orchestration: {
        type: 'object',
        properties: {
          maxDelegationDepth: { type: 'number' },
          canReadWorkspaces: { type: 'boolean' },
          canWriteToShared: { type: 'boolean' },
        },
      },
    },
    required: ['agentId', 'description', 'enabled'],
  },
  idempotent: true,
};

/**
 * Agent register tool definition
 * INV-MCP-004: Non-idempotent - creates new agent profile
 * INV-MCP-002: Side effects - modifies agent registry
 */
export const agentRegisterTool: MCPTool = {
  name: 'agent_register',
  description: 'Register a new agent profile. SIDE EFFECTS: Creates new agent in registry. Fails if agent already exists.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Unique identifier for the agent (must start with letter, alphanumeric/dash/underscore only)',
      },
      description: {
        type: 'string',
        description: 'Description of the agent capabilities',
      },
      displayName: {
        type: 'string',
        description: 'Human-readable display name',
      },
      systemPrompt: {
        type: 'string',
        description: 'System prompt for the agent (instructions for how to behave)',
      },
      team: {
        type: 'string',
        description: 'Team the agent belongs to',
      },
      capabilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of agent capabilities',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization',
      },
      workflowTemplate: {
        type: 'string',
        enum: ['prompt-response', 'research', 'code-review', 'multi-step', 'delegate-chain', 'agent-selection'],
        description: 'Use a predefined workflow template instead of custom workflow steps',
      },
      workflow: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            stepId: { type: 'string', description: 'Unique step identifier' },
            name: { type: 'string', description: 'Step name' },
            type: {
              type: 'string',
              enum: ['prompt', 'tool', 'conditional', 'loop', 'parallel', 'delegate'],
              description: 'Step type'
            },
            config: { type: 'object', description: 'Step configuration' },
          },
          required: ['stepId', 'name', 'type'],
        },
        description: 'Workflow steps to execute when agent runs (ignored if workflowTemplate is provided)',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether the agent is enabled',
        default: true,
      },
    },
    required: ['agentId', 'description'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      registered: { type: 'boolean', description: 'Whether registration succeeded' },
      agentId: { type: 'string', description: 'Registered agent ID' },
      message: { type: 'string', description: 'Result message' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
    },
    required: ['registered', 'agentId', 'message'],
  },
  idempotent: false,
};

/**
 * Agent remove tool definition
 * INV-MCP-004: Idempotent - removing non-existent agent returns removed=false
 * INV-MCP-002: Side effects - deletes agent from registry
 */
export const agentRemoveTool: MCPTool = {
  name: 'agent_remove',
  description: 'Remove an agent from the registry. SIDE EFFECTS: Deletes agent profile. Idempotent - removing non-existent agent returns removed=false.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The ID of the agent to remove',
      },
    },
    required: ['agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      removed: { type: 'boolean', description: 'Whether agent was removed' },
      agentId: { type: 'string', description: 'Agent ID' },
      message: { type: 'string', description: 'Result message' },
    },
    required: ['removed', 'agentId', 'message'],
  },
  idempotent: true,
};

/**
 * Handler for agent_list tool
 */
export const handleAgentList: ToolHandler = async (args) => {
  const team = args.team as string | undefined;
  const enabled = args.enabled as boolean | undefined;
  const limit = (args.limit as number | undefined) ?? 50;

  try {
    // Build filter only with defined properties
    const filter: AgentFilter = {};
    if (team !== undefined) {
      filter.team = team;
    }
    if (enabled !== undefined) {
      filter.enabled = enabled;
    }

    const registry = await getSharedRegistry();
    const agents = await registry.list(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    const agentSummaries = agents.slice(0, limit).map((a: AgentProfile) => ({
      agentId: a.agentId,
      displayName: a.displayName,
      description: a.description,
      team: a.team,
      enabled: a.enabled,
      capabilities: a.capabilities,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agents: agentSummaries,
              total: agents.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for agent_run tool
 */
export const handleAgentRun: ToolHandler = async (args) => {
  const agentId = args.agentId as string;
  const input = (args.input as Record<string, unknown>) ?? {};
  const sessionId = args.sessionId as string | undefined;

  const startTime = Date.now();

  try {
    // Check if agent exists
    const registry = await getSharedRegistry();
    const agent = await registry.get(agentId);

    if (agent === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              agentId,
              error: {
                code: 'AGENT_NOT_FOUND',
                message: `Agent "${agentId}" not found`,
              },
              totalDurationMs: Date.now() - startTime,
            }),
          },
        ],
        isError: true,
      };
    }

    // Execute agent - note: execute takes (agentId, input, options)
    const executor = await getSharedExecutor();
    const result: AgentResult = await executor.execute(agentId, input, {
      sessionId,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: result.success,
              agentId: result.agentId,
              sessionId,
              output: result.output,
              stepResults: result.stepResults?.map((s) => ({
                stepId: s.stepId,
                success: s.success,
                durationMs: s.durationMs,
              })),
              totalDurationMs: result.totalDurationMs,
              error: result.error,
            },
            null,
            2
          ),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            agentId,
            error: {
              code: 'AGENT_EXECUTION_FAILED',
              message,
            },
            totalDurationMs: Date.now() - startTime,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for agent_get tool
 */
export const handleAgentGet: ToolHandler = async (args) => {
  const agentId = args.agentId as string;

  try {
    const registry = await getSharedRegistry();
    const agent = await registry.get(agentId);

    if (agent === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'AGENT_NOT_FOUND',
              message: `Agent "${agentId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agentId: agent.agentId,
              displayName: agent.displayName,
              version: agent.version,
              description: agent.description,
              role: agent.role,
              expertise: agent.expertise,
              capabilities: agent.capabilities,
              team: agent.team,
              tags: agent.tags,
              enabled: agent.enabled,
              workflow: agent.workflow?.map((s) => ({
                stepId: s.stepId,
                name: s.name,
                type: s.type,
                config: s.config,
              })),
              orchestration: agent.orchestration
                ? {
                    maxDelegationDepth: agent.orchestration.maxDelegationDepth,
                    canReadWorkspaces: agent.orchestration.canReadWorkspaces,
                    canWriteToShared: agent.orchestration.canWriteToShared,
                  }
                : undefined,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_GET_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for agent_register tool
 */
export const handleAgentRegister: ToolHandler = async (args) => {
  const agentId = args.agentId as string;
  const description = args.description as string;
  const displayName = args.displayName as string | undefined;
  const systemPrompt = args.systemPrompt as string | undefined;
  const team = args.team as string | undefined;
  const capabilities = args.capabilities as string[] | undefined;
  const tags = args.tags as string[] | undefined;
  const workflowTemplate = args.workflowTemplate as string | undefined;
  const workflow = args.workflow as {
    stepId: string;
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }[] | undefined;
  const enabled = (args.enabled as boolean | undefined) ?? true;

  try {
    const registry = await getSharedRegistry();
    // Check if agent already exists
    const existing = await registry.get(agentId);
    if (existing !== undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'AGENT_ALREADY_EXISTS',
              message: `Agent "${agentId}" already exists`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Validate agentId format
    const agentIdPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!agentIdPattern.test(agentId)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'INVALID_AGENT_ID',
              message: 'Agent ID must start with letter and contain only alphanumeric, dash, underscore',
            }),
          },
        ],
        isError: true,
      };
    }

    // Resolve workflow: template takes precedence over custom workflow
    let resolvedWorkflow: {
      stepId: string;
      name: string;
      type: 'prompt' | 'tool' | 'conditional' | 'loop' | 'parallel' | 'delegate' | 'discuss';
      config: Record<string, unknown>;
    }[] | undefined;

    if (workflowTemplate !== undefined) {
      // Validate template name
      if (!isValidTemplateName(workflowTemplate)) {
        const availableTemplates = getAvailableTemplates();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'INVALID_WORKFLOW_TEMPLATE',
                message: `Unknown workflow template "${workflowTemplate}". Available templates: ${availableTemplates.join(', ')}`,
              }),
            },
          ],
          isError: true,
        };
      }

      // Create workflow from template
      const templateWorkflow = createWorkflowFromTemplate(workflowTemplate);
      if (templateWorkflow !== undefined) {
        resolvedWorkflow = templateWorkflow.map(step => ({
          stepId: step.stepId,
          name: step.name,
          type: step.type,
          config: step.config ?? {},
        }));
      }
    } else if (workflow !== undefined && workflow.length > 0) {
      // Use custom workflow
      resolvedWorkflow = workflow.map(step => ({
        stepId: step.stepId,
        name: step.name,
        type: step.type as 'prompt' | 'tool' | 'conditional' | 'loop' | 'parallel' | 'delegate' | 'discuss',
        config: step.config ?? {},
      }));
    }

    // Register the agent with resolved workflow
    const profile: AgentProfile = {
      agentId,
      description,
      displayName,
      systemPrompt,
      team,
      capabilities: capabilities ?? [],
      tags: tags ?? [],
      workflow: resolvedWorkflow,
      enabled,
    };

    await registry.register(profile);

    // Build response message
    const responseMessage = workflowTemplate !== undefined
      ? `Agent "${agentId}" registered successfully with "${workflowTemplate}" workflow template`
      : resolvedWorkflow !== undefined
        ? `Agent "${agentId}" registered successfully with ${resolvedWorkflow.length} workflow step(s)`
        : `Agent "${agentId}" registered successfully`;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              registered: true,
              agentId,
              message: responseMessage,
              workflowTemplate: workflowTemplate ?? null,
              workflowSteps: resolvedWorkflow?.length ?? 0,
              createdAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_REGISTER_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for agent_remove tool
 */
export const handleAgentRemove: ToolHandler = async (args) => {
  const agentId = args.agentId as string;

  try {
    const registry = await getSharedRegistry();
    // Check if agent exists
    const existing = await registry.get(agentId);
    if (existing === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              removed: false,
              agentId,
              message: `Agent "${agentId}" not found`,
            }),
          },
        ],
      };
    }

    // Remove the agent
    await registry.remove(agentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              removed: true,
              agentId,
              message: `Agent "${agentId}" removed successfully`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_REMOVE_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// Agent Recommendation Tool (INV-AGT-SEL-001 through INV-AGT-SEL-006)
// ============================================================================

/**
 * Agent recommend tool definition
 * INV-MCP-004: Idempotent - read-only operation
 * INV-AGT-SEL-001: Selection is deterministic
 * INV-AGT-SEL-004: Always returns at least one result
 */
export const agentRecommendTool: MCPTool = {
  name: 'agent_recommend',
  description: 'Recommend the best agent for a given task. Returns ranked matches with confidence scores. Use this to auto-route tasks to appropriate agents. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Task description to match against agents (max 2000 chars)',
      },
      team: {
        type: 'string',
        description: 'Filter by team name',
      },
      requiredCapabilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Required capabilities the agent must have',
      },
      excludeAgents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Agent IDs to exclude from matching',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of recommendations (default 3)',
        default: 3,
      },
    },
    required: ['task'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      recommended: { type: 'string', description: 'Best matching agent ID' },
      confidence: { type: 'number', description: 'Match confidence 0-1' },
      reason: { type: 'string', description: 'Why this agent was selected' },
      alternatives: {
        type: 'array',
        description: 'Alternative agent matches',
        items: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            confidence: { type: 'number' },
            reason: { type: 'string' },
          },
        },
      },
    },
    required: ['recommended', 'confidence', 'reason', 'alternatives'],
  },
  idempotent: true,
};

/**
 * Handler for agent_recommend tool
 * Implements INV-AGT-SEL-001 through INV-AGT-SEL-006
 * Uses AgentSelectionService domain module for proper separation
 */
export const handleAgentRecommend: ToolHandler = async (args) => {
  const task = args.task as string;
  const team = args.team as string | undefined;
  const requiredCapabilities = args.requiredCapabilities as string[] | undefined;
  const excludeAgents = args.excludeAgents as string[] | undefined;
  const maxResults = (args.maxResults as number | undefined) ?? 3;

  try {
    const registry = await getSharedRegistry();
    // Use domain service for agent selection (INV-AGT-SEL-001 through INV-AGT-SEL-006)
    const selectionService = createAgentSelectionService(registry);

    // INV-AGT-SEL-001: Selection is deterministic (same input = same output)
    const result = await selectionService.recommend({
      task,
      team,
      requiredCapabilities,
      excludeAgents,
      maxResults,
    });

    // INV-AGT-SEL-004: Always returns at least one result (service handles fallback)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              recommended: result.recommended,
              confidence: result.confidence,
              reason: result.reason,
              alternatives: result.alternatives.map(alt => ({
                agentId: alt.agentId,
                confidence: alt.confidence,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_RECOMMEND_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// Agent Capabilities Tool
// ============================================================================

/**
 * Agent capabilities tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const agentCapabilitiesTool: MCPTool = {
  name: 'agent_capabilities',
  description: 'List all unique capabilities across agents with mapping to agent IDs. Use for capability-based routing and discovery. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['orchestrator', 'implementer', 'reviewer', 'specialist', 'generalist'],
        description: 'Filter by agent category',
      },
      includeDisabled: {
        type: 'boolean',
        description: 'Include disabled agents (default false)',
        default: false,
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      capabilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'All unique capabilities',
      },
      agentsByCapability: {
        type: 'object',
        description: 'Capability → agent IDs mapping',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      capabilitiesByAgent: {
        type: 'object',
        description: 'Agent ID → capabilities mapping',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      categoriesByAgent: {
        type: 'object',
        description: 'Agent ID → category mapping',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['capabilities', 'agentsByCapability', 'capabilitiesByAgent'],
  },
  idempotent: true,
};

/**
 * Handler for agent_capabilities tool
 * Uses AgentSelectionService domain module for proper separation
 */
export const handleAgentCapabilities: ToolHandler = async (args) => {
  const category = args.category as AgentCategory | undefined;
  const includeDisabled = (args.includeDisabled as boolean | undefined) ?? false;

  try {
    const registry = await getSharedRegistry();
    // Use domain service for capabilities discovery
    const selectionService = createAgentSelectionService(registry);

    // Delegate to domain service
    const result = await selectionService.getCapabilities({
      category,
      includeDisabled,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              capabilities: result.capabilities,
              agentsByCapability: result.agentsByCapability,
              capabilitiesByAgent: result.capabilitiesByAgent,
              categoriesByAgent: result.categoriesByAgent,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'AGENT_CAPABILITIES_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};
