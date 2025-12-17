/**
 * Explain Workflow Prompt
 *
 * User-controlled prompt template for explaining workflow execution.
 */

import type { MCPPrompt, MCPPromptMessage, PromptHandler } from '../types.js';

// ============================================================================
// Sample Workflow Data
// ============================================================================

const SAMPLE_WORKFLOWS: Record<string, {
  name: string;
  description: string;
  steps: { stepId: string; name: string; type: string; description: string }[];
}> = {
  'data-pipeline': {
    name: 'Data Pipeline',
    description: 'Automated data processing pipeline for ETL operations',
    steps: [
      { stepId: 'step-1', name: 'Extract', type: 'tool', description: 'Extract data from source systems' },
      { stepId: 'step-2', name: 'Transform', type: 'tool', description: 'Apply transformations and validations' },
      { stepId: 'step-3', name: 'Load', type: 'tool', description: 'Load data into target systems' },
    ],
  },
  'code-review': {
    name: 'Code Review',
    description: 'Automated code review workflow with agent assistance',
    steps: [
      { stepId: 'step-1', name: 'Lint', type: 'tool', description: 'Run linting checks on changed files' },
      { stepId: 'step-2', name: 'Test', type: 'tool', description: 'Execute test suite for affected code' },
      { stepId: 'step-3', name: 'Review', type: 'agent', description: 'AI-powered code review and suggestions' },
    ],
  },
  'deploy-staging': {
    name: 'Deploy to Staging',
    description: 'Deployment workflow for staging environment',
    steps: [
      { stepId: 'step-1', name: 'Build', type: 'tool', description: 'Build application artifacts' },
      { stepId: 'step-2', name: 'Test', type: 'tool', description: 'Run integration tests' },
      { stepId: 'step-3', name: 'Deploy', type: 'tool', description: 'Deploy to staging environment' },
    ],
  },
};

// ============================================================================
// Prompt Definition
// ============================================================================

/**
 * Explain workflow prompt definition
 */
export const explainWorkflowPrompt: MCPPrompt = {
  name: 'explain-workflow',
  description: 'Generate a prompt to explain how a workflow executes',
  arguments: [
    {
      name: 'workflowId',
      description: 'ID of the workflow to explain',
      required: true,
    },
    {
      name: 'detail',
      description: 'Level of detail: "brief", "standard", or "detailed"',
      required: false,
    },
  ],
};

// ============================================================================
// Prompt Handler
// ============================================================================

/**
 * Handler for explain-workflow prompt
 */
export const handleExplainWorkflow: PromptHandler = async (args) => {
  const workflowId = args.workflowId ?? '';
  const detail = args.detail ?? 'standard';

  const workflow = SAMPLE_WORKFLOWS[workflowId];

  if (workflow === undefined) {
    const availableWorkflows = Object.keys(SAMPLE_WORKFLOWS).join(', ');
    const messages: MCPPromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Error: Workflow "${workflowId}" not found. Available workflows: ${availableWorkflows}`,
        },
      },
    ];
    return { description: 'Workflow not found', messages };
  }

  let promptText = `# Explain Workflow: ${workflow.name}

## Overview
${workflow.description}

## Workflow Steps (${workflow.steps.length} steps)

`;

  if (detail === 'brief') {
    promptText += workflow.steps
      .map((s, i) => `${i + 1}. **${s.name}** (${s.type})`)
      .join('\n');
    promptText += `

Please provide a brief explanation of what this workflow does and when it should be used.`;
  } else if (detail === 'detailed') {
    workflow.steps.forEach((step, index) => {
      promptText += `### Step ${index + 1}: ${step.name}
- **ID:** ${step.stepId}
- **Type:** ${step.type}
- **Description:** ${step.description}

`;
    });
    promptText += `## Questions to Answer

1. What is the purpose of this workflow?
2. When should this workflow be triggered?
3. What are the inputs and outputs of each step?
4. What happens if a step fails?
5. Are there any dependencies between steps?
6. What permissions or resources does this workflow need?

Please provide a comprehensive explanation covering all these aspects.`;
  } else {
    // standard detail
    workflow.steps.forEach((step, index) => {
      promptText += `### ${index + 1}. ${step.name} (${step.type})
${step.description}

`;
    });
    promptText += `Please explain how this workflow operates, including the purpose of each step and how they work together.`;
  }

  const messages: MCPPromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: promptText,
      },
    },
  ];

  return {
    description: `Explanation prompt for "${workflow.name}" workflow (${detail} detail)`,
    messages,
  };
};
