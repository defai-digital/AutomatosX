/**
 * Agent Workflow Templates
 *
 * Predefined workflow templates for common agent patterns.
 * These templates can be used when registering agents to provide
 * standard workflow steps without custom configuration.
 *
 * Usage:
 * - Use 'prompt-response' for simple Q&A agents
 * - Use 'research' for agents that need to gather information
 * - Use 'code-review' for agents that analyze code
 * - Use 'multi-step' for agents with sequential processing
 */

import type { AgentWorkflowStep } from '@defai.digital/contracts';

/**
 * Available workflow template names
 */
export type WorkflowTemplateName =
  | 'prompt-response'
  | 'research'
  | 'code-review'
  | 'multi-step'
  | 'delegate-chain'
  | 'agent-selection';

/**
 * Workflow template definition
 */
export interface WorkflowTemplate {
  /** Template identifier */
  name: WorkflowTemplateName;

  /** Human-readable description */
  description: string;

  /** Workflow steps */
  steps: AgentWorkflowStep[];

  /** Required configuration keys */
  requiredConfig?: string[];

  /** Optional configuration with defaults */
  defaultConfig?: Record<string, unknown>;
}

/**
 * Prompt-Response Template
 *
 * Simple single-step workflow for Q&A style interactions.
 * The agent uses its system prompt to respond to user input.
 */
export const PROMPT_RESPONSE_TEMPLATE: WorkflowTemplate = {
  name: 'prompt-response',
  description: 'Simple single-step prompt-response workflow. Uses system prompt to generate response.',
  steps: [
    {
      stepId: 'respond',
      name: 'Generate Response',
      description: 'Process input using system prompt and generate response',
      type: 'prompt',
      config: {
        prompt: '{{input}}',
        useSystemPrompt: true,
      },
    },
  ],
};

/**
 * Research Template
 *
 * Multi-step workflow for research tasks:
 * 1. Analyze the research question
 * 2. Gather information (via tools if available)
 * 3. Synthesize findings into a response
 */
export const RESEARCH_TEMPLATE: WorkflowTemplate = {
  name: 'research',
  description: 'Research workflow with analysis, gathering, and synthesis steps.',
  steps: [
    {
      stepId: 'analyze',
      name: 'Analyze Question',
      description: 'Break down the research question and identify key aspects',
      type: 'prompt',
      config: {
        prompt: 'Analyze this research question and identify the key aspects to investigate:\n\n{{input}}\n\nList the main points to research.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'gather',
      name: 'Gather Information',
      description: 'Collect relevant information based on analysis',
      type: 'prompt',
      dependencies: ['analyze'],
      config: {
        prompt: 'Based on the analysis:\n\n{{steps.analyze.output}}\n\nProvide detailed information on each aspect. Use your knowledge to answer comprehensively.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'synthesize',
      name: 'Synthesize Response',
      description: 'Combine gathered information into a coherent response',
      type: 'prompt',
      dependencies: ['gather'],
      config: {
        prompt: 'Synthesize the following information into a clear, comprehensive response to the original question:\n\nOriginal Question: {{input}}\n\nGathered Information:\n{{steps.gather.output}}\n\nProvide a well-structured response.',
        useSystemPrompt: true,
      },
    },
  ],
};

/**
 * Code Review Template
 *
 * Workflow for reviewing code:
 * 1. Understand the code structure
 * 2. Analyze for issues and patterns
 * 3. Generate review report
 */
export const CODE_REVIEW_TEMPLATE: WorkflowTemplate = {
  name: 'code-review',
  description: 'Code review workflow with structure analysis, issue detection, and report generation.',
  steps: [
    {
      stepId: 'understand',
      name: 'Understand Code',
      description: 'Analyze the structure and purpose of the code',
      type: 'prompt',
      config: {
        prompt: 'Analyze this code and explain its structure, purpose, and main components:\n\n{{input}}',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'analyze',
      name: 'Analyze Issues',
      description: 'Identify potential issues, bugs, and improvement opportunities',
      type: 'prompt',
      dependencies: ['understand'],
      config: {
        prompt: 'Based on the code understanding:\n\n{{steps.understand.output}}\n\nIdentify:\n1. Potential bugs or errors\n2. Performance issues\n3. Security concerns\n4. Code style and best practices\n5. Opportunities for improvement',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'report',
      name: 'Generate Report',
      description: 'Create a structured code review report',
      type: 'prompt',
      dependencies: ['analyze'],
      config: {
        prompt: 'Create a structured code review report based on the analysis:\n\n{{steps.analyze.output}}\n\nFormat the report with:\n- Summary\n- Critical Issues (if any)\n- Warnings\n- Suggestions\n- Overall Assessment',
        useSystemPrompt: true,
      },
    },
  ],
};

/**
 * Multi-Step Template
 *
 * Generic multi-step workflow for sequential processing:
 * 1. Plan the approach
 * 2. Execute the plan
 * 3. Review and refine
 */
export const MULTI_STEP_TEMPLATE: WorkflowTemplate = {
  name: 'multi-step',
  description: 'Generic multi-step workflow with planning, execution, and review phases.',
  steps: [
    {
      stepId: 'plan',
      name: 'Plan Approach',
      description: 'Create a plan for addressing the task',
      type: 'prompt',
      config: {
        prompt: 'Create a step-by-step plan to address this task:\n\n{{input}}\n\nList the concrete steps needed.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'execute',
      name: 'Execute Plan',
      description: 'Execute each step of the plan',
      type: 'prompt',
      dependencies: ['plan'],
      config: {
        prompt: 'Execute the following plan step by step:\n\n{{steps.plan.output}}\n\nProvide the output for each step.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'review',
      name: 'Review Results',
      description: 'Review and refine the execution results',
      type: 'prompt',
      dependencies: ['execute'],
      config: {
        prompt: 'Review the execution results:\n\n{{steps.execute.output}}\n\nProvide:\n1. Summary of what was accomplished\n2. Any refinements or corrections needed\n3. Final response to the original task: {{input}}',
        useSystemPrompt: true,
      },
    },
  ],
};

/**
 * Delegate Chain Template
 *
 * Workflow that demonstrates delegation to other agents.
 * Useful for orchestration patterns.
 */
export const DELEGATE_CHAIN_TEMPLATE: WorkflowTemplate = {
  name: 'delegate-chain',
  description: 'Workflow that delegates to specialized agents for different aspects.',
  steps: [
    {
      stepId: 'analyze-task',
      name: 'Analyze Task',
      description: 'Analyze the task and determine delegation strategy',
      type: 'prompt',
      config: {
        prompt: 'Analyze this task and determine which aspects should be handled:\n\n{{input}}\n\nIdentify the key components and what expertise is needed.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'coordinate',
      name: 'Coordinate Work',
      description: 'Coordinate the work based on analysis',
      type: 'prompt',
      dependencies: ['analyze-task'],
      config: {
        prompt: 'Based on the task analysis:\n\n{{steps.analyze-task.output}}\n\nDetermine how to best address each component. Provide your response.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'finalize',
      name: 'Finalize Response',
      description: 'Combine all results into final response',
      type: 'prompt',
      dependencies: ['coordinate'],
      config: {
        prompt: 'Combine all the work into a final comprehensive response:\n\nOriginal Task: {{input}}\n\nCoordinated Work:\n{{steps.coordinate.output}}\n\nProvide the final response.',
        useSystemPrompt: true,
      },
    },
  ],
  requiredConfig: [],
};

/**
 * Agent Selection Template
 *
 * Workflow for intelligent agent selection:
 * 1. Analyze the task to understand requirements
 * 2. Match task against agent capabilities
 * 3. Select best agent with confidence scoring
 *
 * Invariants enforced:
 * - INV-AGT-SEL-001: Deterministic selection
 * - INV-AGT-SEL-002: Confidence range [0,1]
 * - INV-AGT-SEL-003: Results sorted by confidence
 * - INV-AGT-SEL-004: Fallback to standard agent
 * - INV-AGT-SEL-005: exampleTasks boost scoring
 * - INV-AGT-SEL-006: notForTasks reduce scoring
 */
export const AGENT_SELECTION_TEMPLATE: WorkflowTemplate = {
  name: 'agent-selection',
  description: 'Workflow for selecting the best agent based on task analysis and capability matching.',
  steps: [
    {
      stepId: 'analyze-task',
      name: 'Analyze Task Requirements',
      description: 'Extract key requirements and intent from the task description',
      type: 'prompt',
      config: {
        prompt: 'Analyze this task and extract:\n1. Primary intent (what needs to be done)\n2. Required capabilities\n3. Domain keywords\n4. Task category\n\nTask: {{input}}\n\nProvide a structured analysis.',
        useSystemPrompt: true,
      },
    },
    {
      stepId: 'match-capabilities',
      name: 'Match Against Capabilities',
      description: 'Score available agents based on task requirements',
      type: 'tool',
      dependencies: ['analyze-task'],
      config: {
        tool: 'agent_recommend',
        passTaskAnalysis: true,
      },
    },
    {
      stepId: 'validate-selection',
      name: 'Validate Selection',
      description: 'Verify the selected agent is appropriate and provide reasoning',
      type: 'prompt',
      dependencies: ['match-capabilities'],
      config: {
        prompt: 'Based on the task analysis:\n{{steps.analyze-task.output}}\n\nAnd the agent recommendation:\n{{steps.match-capabilities.output}}\n\nValidate this is the best choice and explain:\n1. Why this agent is suitable\n2. What capabilities match the task\n3. Any limitations to be aware of\n4. Confidence level in the selection',
        useSystemPrompt: true,
      },
    },
  ],
  requiredConfig: [],
  defaultConfig: {
    minConfidence: 0.3,
    maxAlternatives: 3,
  },
};

/**
 * All available workflow templates
 */
export const WORKFLOW_TEMPLATES: Record<WorkflowTemplateName, WorkflowTemplate> = {
  'prompt-response': PROMPT_RESPONSE_TEMPLATE,
  'research': RESEARCH_TEMPLATE,
  'code-review': CODE_REVIEW_TEMPLATE,
  'multi-step': MULTI_STEP_TEMPLATE,
  'delegate-chain': DELEGATE_CHAIN_TEMPLATE,
  'agent-selection': AGENT_SELECTION_TEMPLATE,
};

/**
 * Gets a workflow template by name
 */
export function getWorkflowTemplate(name: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES[name as WorkflowTemplateName];
}

/**
 * Gets all available template names
 */
export function getAvailableTemplates(): WorkflowTemplateName[] {
  return Object.keys(WORKFLOW_TEMPLATES) as WorkflowTemplateName[];
}

/**
 * Creates workflow steps from a template
 * Optionally applies custom configuration to the template
 */
export function createWorkflowFromTemplate(
  templateName: string,
  customConfig?: Record<string, unknown>
): AgentWorkflowStep[] | undefined {
  const template = getWorkflowTemplate(templateName);
  if (template === undefined) {
    return undefined;
  }

  // If no custom config, return template steps directly
  if (customConfig === undefined || Object.keys(customConfig).length === 0) {
    return template.steps.map(step => ({ ...step }));
  }

  // Apply custom configuration to steps
  return template.steps.map(step => {
    const newConfig = { ...step.config };

    // Merge custom config into step config
    for (const [key, value] of Object.entries(customConfig)) {
      if (key in newConfig) {
        newConfig[key] = value;
      }
    }

    return {
      ...step,
      config: newConfig,
    };
  });
}

/**
 * Validates that a template name is valid
 */
export function isValidTemplateName(name: string): name is WorkflowTemplateName {
  return name in WORKFLOW_TEMPLATES;
}

/**
 * Gets template description for display
 */
export function getTemplateDescription(name: string): string | undefined {
  const template = getWorkflowTemplate(name);
  return template?.description;
}
