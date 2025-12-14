import type { MCPTool, ToolHandler } from '../types.js';
import { createWorkflowRunner } from '@automatosx/workflow-engine';
import type { StepContext } from '@automatosx/workflow-engine';
import type { Workflow, WorkflowStep } from '@automatosx/contracts';

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
        default: 10,
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

/**
 * Handler for workflow_run tool
 */
export const handleWorkflowRun: ToolHandler = async (args) => {
  const workflowId = args.workflowId as string;
  const input = (args.input as Record<string, unknown> | undefined) ?? {};

  try {
    const runner = createWorkflowRunner({
      stepExecutor: (step: WorkflowStep, context: StepContext) => {
        const startTime = Date.now();
        return Promise.resolve({
          stepId: step.stepId,
          success: true,
          output: { [`${step.stepId}_result`]: 'completed', ...context.input as Record<string, unknown> },
          durationMs: Date.now() - startTime,
          retryCount: 0,
        });
      },
    });

    // Create sample workflow
    const workflow: Workflow = {
      workflowId,
      version: '1.0.0',
      name: `Workflow ${workflowId}`,
      steps: [
        { stepId: 'step-1', name: 'Initialize', type: 'tool', config: { action: 'init' } },
        { stepId: 'step-2', name: 'Process', type: 'tool', config: { action: 'process' } },
        { stepId: 'step-3', name: 'Complete', type: 'tool', config: { action: 'complete' } },
      ],
    };

    // Execute workflow
    const result = await runner.run(workflow, input);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            workflowId,
            stepsCompleted: result.stepResults.map((s) => s.stepId),
            output: result.output,
          }, null, 2),
        },
      ],
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
export const handleWorkflowList: ToolHandler = (args) => {
  const status = args.status as string | undefined;
  const limit = (args.limit as number | undefined) ?? 10;

  // Sample workflows
  const workflows = [
    { id: 'data-pipeline', name: 'Data Pipeline', version: '1.0.0', status: 'active', stepCount: 5 },
    { id: 'code-review', name: 'Code Review', version: '2.1.0', status: 'active', stepCount: 3 },
    { id: 'deploy-staging', name: 'Deploy to Staging', version: '1.2.0', status: 'active', stepCount: 7 },
    { id: 'test-suite', name: 'Test Suite', version: '1.0.0', status: 'draft', stepCount: 4 },
  ];

  const filtered = status !== undefined
    ? workflows.filter((w) => w.status === status)
    : workflows;

  const limited = filtered.slice(0, limit);

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ workflows: limited }, null, 2),
      },
    ],
  });
};

/**
 * Handler for workflow_describe tool
 */
export const handleWorkflowDescribe: ToolHandler = (args) => {
  const workflowId = args.workflowId as string;

  // Sample workflow details
  const workflow = {
    id: workflowId,
    name: `Workflow ${workflowId}`,
    version: '1.0.0',
    description: `Automated workflow for ${workflowId}`,
    status: 'active',
    steps: [
      { stepId: 'step-1', name: 'Initialize', type: 'tool', description: 'Set up the workflow context' },
      { stepId: 'step-2', name: 'Process', type: 'tool', description: 'Main processing step' },
      { stepId: 'step-3', name: 'Complete', type: 'tool', description: 'Finalize and cleanup' },
    ],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input data for the workflow' },
      },
    },
  };

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      },
    ],
  });
};
