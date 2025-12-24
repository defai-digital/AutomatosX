import type { MCPTool, ToolHandler, MCPToolResult } from '../types.js';
import {
  createWorkflowRunner,
  createWorkflowLoader,
  findWorkflowDir,
  defaultStepExecutor,
  type WorkflowInfo,
  type StepExecutor,
} from '@automatosx/workflow-engine';
import { LIMIT_WORKFLOWS } from '@automatosx/contracts';
import { getStepExecutor } from '../bootstrap.js';

// Check if we're in test environment
const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ============================================================================
// Workflow Loader Singleton
// ============================================================================

let _workflowLoader: ReturnType<typeof createWorkflowLoader> | null = null;

function getWorkflowLoader(): ReturnType<typeof createWorkflowLoader> {
  if (_workflowLoader === null) {
    const workflowDir = findWorkflowDir(process.cwd()) ?? 'examples/workflows';
    _workflowLoader = createWorkflowLoader({ workflowsDir: workflowDir });
  }
  return _workflowLoader;
}

/**
 * Get the appropriate step executor based on environment
 * Uses placeholder in tests, production executor otherwise
 */
function getWorkflowStepExecutor(): StepExecutor {
  if (isTestEnv) {
    return defaultStepExecutor;
  }
  return getStepExecutor();
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Workflow run tool definition
 */
export const workflowRunTool: MCPTool = {
  name: 'workflow_run',
  description: 'Execute a workflow by ID with optional input parameters',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'The ID of the workflow to execute',
      },
      input: {
        type: 'object',
        description: 'Optional input parameters for the workflow',
      },
    },
    required: ['workflowId'],
  },
};

/**
 * Workflow list tool definition
 */
export const workflowListTool: MCPTool = {
  name: 'workflow_list',
  description: 'List all available workflows',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status (active, inactive, draft)',
        enum: ['active', 'inactive', 'draft'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of workflows to return',
        default: LIMIT_WORKFLOWS,
      },
    },
  },
};

/**
 * Workflow describe tool definition
 */
export const workflowDescribeTool: MCPTool = {
  name: 'workflow_describe',
  description: 'Get detailed information about a specific workflow',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'The ID of the workflow to describe',
      },
    },
    required: ['workflowId'],
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handler for workflow_run tool
 */
export const handleWorkflowRun: ToolHandler = async (args): Promise<MCPToolResult> => {
  const workflowId = args.workflowId as string;
  const input = (args.input as Record<string, unknown> | undefined) ?? {};

  try {
    // Load workflow from file
    const loader = getWorkflowLoader();
    const workflow = await loader.load(workflowId);

    if (!workflow) {
      const available = await loader.loadAll();
      const ids = available.map(w => w.workflowId).slice(0, 5).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Workflow "${workflowId}" not found`,
              availableWorkflows: ids,
              hint: 'Use workflow_list to see all available workflows',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    // Create workflow runner with production step executor
    // Uses placeholder executor in test environment to avoid real LLM calls
    const runner = createWorkflowRunner({
      stepExecutor: getWorkflowStepExecutor(),
    });

    // Execute workflow
    const result = await runner.run(workflow, input);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            workflowId: workflow.workflowId,
            name: workflow.name,
            version: workflow.version,
            stepsCompleted: result.stepResults.map((s) => ({
              stepId: s.stepId,
              success: s.success,
              durationMs: s.durationMs,
            })),
            output: result.output,
            totalDurationMs: result.totalDurationMs,
            error: result.error,
          }, null, 2),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for workflow_list tool
 */
export const handleWorkflowList: ToolHandler = async (args): Promise<MCPToolResult> => {
  const status = args.status as 'active' | 'inactive' | 'draft' | undefined;
  const limit = (args.limit as number | undefined) ?? LIMIT_WORKFLOWS;

  try {
    const loader = getWorkflowLoader();
    const allWorkflows = await loader.listAll();

    // Filter by status if specified
    const filtered = status !== undefined
      ? allWorkflows.filter((w: WorkflowInfo) => w.status === status)
      : allWorkflows;

    // Apply limit
    const limited = filtered.slice(0, limit);

    // Format for output
    const workflows = limited.map((w: WorkflowInfo) => ({
      id: w.id,
      name: w.name,
      version: w.version,
      description: w.description,
      stepCount: w.stepCount,
      status: w.status,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: workflows.length,
            total: allWorkflows.length,
            workflows,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing workflows: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for workflow_describe tool
 */
export const handleWorkflowDescribe: ToolHandler = async (args): Promise<MCPToolResult> => {
  const workflowId = args.workflowId as string;

  try {
    const loader = getWorkflowLoader();
    const workflow = await loader.load(workflowId);

    if (!workflow) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Workflow "${workflowId}" not found`,
              hint: 'Use workflow_list to see all available workflows',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    // Format workflow for output
    const description = {
      workflowId: workflow.workflowId,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      steps: workflow.steps.map((step) => ({
        stepId: step.stepId,
        name: step.name,
        type: step.type,
        timeout: step.timeout,
        config: step.config,
      })),
      metadata: workflow.metadata,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(description, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error describing workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
};
