import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MCPTool, ToolHandler, MCPToolResult } from '../types.js';
import {
  createWorkflowRunner,
  createWorkflowLoader,
  findWorkflowDir,
  defaultStepExecutor,
  type WorkflowInfo,
  type StepExecutor,
  type WorkflowResult,
} from '@defai.digital/workflow-engine';
import { LIMIT_WORKFLOWS, getErrorMessage, type TraceEvent } from '@defai.digital/contracts';
import { getTraceStore, getStepExecutor } from '../shared-dependencies.js';

// Get the directory of this module (for finding bundled examples)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're in test environment
const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ============================================================================
// Workflow Loader Singleton
// ============================================================================

/**
 * Find the example workflows directory.
 * Searches multiple locations to work correctly regardless of working directory:
 * 1. Bundled workflows in npm package (for npm install)
 * 2. Package's examples directory (for development/source)
 * 3. Monorepo root (for pnpm workspace)
 * 4. Relative to cwd as fallback (for backward compatibility)
 *
 * This is the same pattern used for agents (see shared-registry.ts)
 */
function getExampleWorkflowsDir(): string {
  // Try bundled workflows first (when installed via npm)
  // __dirname is 'dist/tools/', bundled is at '../../bundled/workflows'
  const bundledPath = path.join(__dirname, '..', '..', 'bundled', 'workflows');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Try development path (when running from source repo)
  // __dirname is packages/mcp-server/src/tools, so go up 4 levels to repo root
  const devPath = path.join(__dirname, '..', '..', '..', '..', 'examples', 'workflows');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Try monorepo root (for pnpm workspace, when running from dist)
  const monorepoPath = path.join(__dirname, '..', '..', '..', '..', '..', 'examples', 'workflows');
  if (fs.existsSync(monorepoPath)) {
    return monorepoPath;
  }

  // Try relative to cwd as fallback (for backward compatibility)
  const cwdPath = findWorkflowDir(process.cwd());
  if (cwdPath) {
    return cwdPath;
  }

  // Return bundled path as default (most common case for npm install)
  return bundledPath;
}

let _workflowLoader: ReturnType<typeof createWorkflowLoader> | null = null;

function getWorkflowLoader(): ReturnType<typeof createWorkflowLoader> {
  if (_workflowLoader === null) {
    const workflowDir = getExampleWorkflowsDir();
    _workflowLoader = createWorkflowLoader({ workflowsDir: workflowDir });
  }
  return _workflowLoader;
}

/**
 * Get the appropriate step executor based on environment
 * Uses placeholder in tests, production executor otherwise
 */
async function getWorkflowStepExecutor(): Promise<StepExecutor> {
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
 * INV-TR-013: Workflow executions MUST produce a complete event chain
 */
export const handleWorkflowRun: ToolHandler = async (args): Promise<MCPToolResult> => {
  const workflowId = args.workflowId as string;
  const input = (args.input as Record<string, unknown> | undefined) ?? {};

  // Get trace store for workflow event emission
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();

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

    // Emit workflow.start event (INV-TR-013)
    const startEvent: TraceEvent = {
      eventId: randomUUID(),
      traceId,
      type: 'workflow.start',
      timestamp: startTime,
      context: {
        workflowId: workflow.workflowId,
      },
      payload: {
        workflowId: workflow.workflowId,
        workflowName: workflow.name,
        workflowVersion: workflow.version,
        stepCount: workflow.steps.length,
        input,
      },
    };
    await traceStore.write(startEvent);

    const runStartTime = Date.now();
    let stepIndex = 0;

    // Create workflow runner with production step executor and step callbacks
    const stepExecutor = await getWorkflowStepExecutor();
    const runner = createWorkflowRunner({
      stepExecutor,
      onStepStart: (_step, context) => {
        // Track step index for use in onStepComplete
        stepIndex = context.stepIndex;
      },
      onStepComplete: (step, stepResult) => {
        // Emit workflow.step event for this step (INV-TR-013)
        const stepEvent: TraceEvent = {
          eventId: randomUUID(),
          traceId,
          type: 'workflow.step',
          timestamp: new Date().toISOString(),
          durationMs: stepResult.durationMs,
          status: stepResult.success ? 'success' : 'failure',
          context: {
            workflowId: workflow.workflowId,
            stepId: step.stepId,
          },
          payload: {
            stepId: step.stepId,
            stepName: step.name,
            stepType: step.type,
            stepIndex,
            success: stepResult.success,
            durationMs: stepResult.durationMs,
            output: stepResult.output as Record<string, unknown> | undefined,
            error: stepResult.error ? {
              code: stepResult.error.code,
              message: stepResult.error.message,
            } : undefined,
            retryCount: stepResult.retryCount,
          },
        };
        // Fire-and-forget write with error handling
        traceStore.write(stepEvent).catch((err) => {
          console.error('[workflow] Failed to write step trace event:', err);
        });
      },
    });

    // Execute workflow
    const result: WorkflowResult = await runner.run(workflow, input);

    // Emit workflow.end event (INV-TR-013)
    const endEvent: TraceEvent = {
      eventId: randomUUID(),
      traceId,
      type: 'workflow.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - runStartTime,
      status: result.success ? 'success' : 'failure',
      context: {
        workflowId: workflow.workflowId,
      },
      payload: {
        workflowId: workflow.workflowId,
        success: result.success,
        totalSteps: workflow.steps.length,
        completedSteps: result.stepResults.length,
        failedSteps: result.stepResults.filter(s => !s.success).length,
        totalDurationMs: result.totalDurationMs,
        output: result.output as Record<string, unknown> | undefined,
        error: result.error ? {
          code: result.error.code,
          message: result.error.message,
          failedStepId: result.error.failedStepId,
        } : undefined,
      },
    };
    await traceStore.write(endEvent);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            workflowId: workflow.workflowId,
            name: workflow.name,
            version: workflow.version,
            traceId, // Include traceId for dashboard linking
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
    // Emit workflow.end event with error (INV-TR-013)
    const errorMessage = getErrorMessage(error);
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'workflow.end',
      timestamp: new Date().toISOString(),
      status: 'failure',
      context: {
        workflowId,
      },
      payload: {
        workflowId,
        success: false,
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        totalDurationMs: Date.now() - new Date(startTime).getTime(),
        error: {
          code: 'WORKFLOW_EXECUTION_ERROR',
          message: errorMessage,
        },
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: `Error executing workflow: ${errorMessage}`,
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
          text: `Error listing workflows: ${getErrorMessage(error)}`,
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
          text: `Error describing workflow: ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    };
  }
};
