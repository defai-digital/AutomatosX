/**
 * Agent Guide MCP Prompt
 *
 * Provides comprehensive documentation for using the AutomatosX agent system.
 * Teaches Claude Code (and other consumers) how to effectively use agents.
 */

import type { MCPPrompt, MCPPromptMessage, PromptHandler } from '../types.js';

/**
 * Agent guide prompt definition
 */
export const agentGuidePrompt: MCPPrompt = {
  name: 'agent-guide',
  description: 'Comprehensive guide for using the AutomatosX agent system - registration, execution, multi-agent workflows, and parallel processing',
  arguments: [
    {
      name: 'topic',
      description: 'Specific topic to focus on: overview, registration, execution, workflows, parallel, delegation, or all',
      required: false,
    },
  ],
};

/**
 * Handler for agent-guide prompt
 */
export const handleAgentGuide: PromptHandler = async (args) => {
  const topic = (args.topic as string | undefined) ?? 'all';

  const sections: string[] = [];

  // Overview section
  if (topic === 'all' || topic === 'overview') {
    sections.push(`
# AutomatosX Agent System Guide

## Overview

AutomatosX provides a powerful multi-agent orchestration system that enables:
- **Specialized Agents**: Domain-specific AI assistants (backend, frontend, security, etc.)
- **Workflow Execution**: Step-by-step task processing with dependencies
- **Multi-Agent Delegation**: Agents can delegate to other specialists
- **Parallel Processing**: Independent steps run concurrently
- **Checkpointing**: Resumable workflows with automatic state persistence
- **Real LLM Integration**: Agents call actual providers (Claude, Gemini, etc.)

## Quick Start

1. **List available agents**:
   \`\`\`
   agent_list
   \`\`\`

2. **Run an agent**:
   \`\`\`
   agent_run { agentId: "backend", input: { task: "Design REST API" } }
   \`\`\`

3. **Get agent details**:
   \`\`\`
   agent_get { agentId: "backend" }
   \`\`\`
`);
  }

  // Registration section
  if (topic === 'all' || topic === 'registration') {
    sections.push(`
## Registering Agents

Agents are registered with profiles that define their capabilities and workflows.

### Basic Registration

\`\`\`json
{
  "agentId": "my-reviewer",
  "description": "Code review specialist",
  "systemPrompt": "You are an expert code reviewer...",
  "capabilities": ["code-review", "best-practices"],
  "team": "engineering",
  "enabled": true
}
\`\`\`

### Registration with Workflow

For agents to execute actual tasks, they need workflow steps:

\`\`\`json
{
  "agentId": "doc-reviewer",
  "description": "Documentation reviewer",
  "systemPrompt": "You are a technical documentation expert. Review documents for completeness, clarity, and accuracy.",
  "workflow": [
    {
      "stepId": "analyze",
      "name": "Analyze Document",
      "type": "prompt",
      "config": {
        "prompt": "Review this document for completeness and clarity:\\n\\n\${input}"
      }
    },
    {
      "stepId": "suggest",
      "name": "Suggest Improvements",
      "type": "prompt",
      "config": {
        "prompt": "Based on the analysis, suggest specific improvements:\\n\\n\${previousOutputs.analyze.content}"
      },
      "dependencies": ["analyze"]
    }
  ]
}
\`\`\`

### MCP Tool Usage

\`\`\`
agent_register {
  agentId: "reviewer",
  description: "Code reviewer",
  systemPrompt: "You are an expert...",
  workflow: [
    { stepId: "review", name: "Review", type: "prompt", config: { prompt: "Review: \${input}" } }
  ]
}
\`\`\`
`);
  }

  // Execution section
  if (topic === 'all' || topic === 'execution') {
    sections.push(`
## Executing Agents

### Basic Execution

\`\`\`
agent_run {
  agentId: "backend",
  input: { task: "Implement user authentication" }
}
\`\`\`

### With Session Tracking

\`\`\`
agent_run {
  agentId: "backend",
  input: { task: "Continue the API work" },
  sessionId: "session-uuid-here"
}
\`\`\`

### Execution Result

Agents return structured results:

\`\`\`json
{
  "success": true,
  "agentId": "backend",
  "output": {
    "analyze": { "content": "..." },
    "implement": { "content": "..." }
  },
  "stepResults": [
    { "stepId": "analyze", "success": true, "durationMs": 1234 },
    { "stepId": "implement", "success": true, "durationMs": 5678 }
  ],
  "totalDurationMs": 6912
}
\`\`\`
`);
  }

  // Workflows section
  if (topic === 'all' || topic === 'workflows') {
    sections.push(`
## Workflow Step Types

### prompt - LLM Generation

Execute prompts via LLM providers:

\`\`\`json
{
  "stepId": "generate",
  "name": "Generate Code",
  "type": "prompt",
  "config": {
    "prompt": "Write a function that \${input.task}",
    "systemPrompt": "You are an expert programmer",
    "provider": "claude",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "keyQuestions": [
    "What edge cases should be handled?",
    "What's the time complexity?"
  ]
}
\`\`\`

### Variable Substitution

Templates support these variables:
- \`\${input}\` - The full input object or string
- \`\${input.fieldName}\` - Specific input field
- \`\${previousOutputs.stepId}\` - Output from a previous step
- \`\${previousOutputs.stepId.content}\` - Nested field from previous step
- \`\${agent.description}\` - Agent profile fields

### delegate - Multi-Agent

Delegate to another agent:

\`\`\`json
{
  "stepId": "security-check",
  "name": "Security Review",
  "type": "delegate",
  "config": {
    "targetAgentId": "security",
    "input": { "code": "\${previousOutputs.generate.content}" }
  },
  "dependencies": ["generate"]
}
\`\`\`

### conditional - Branching

Execute based on conditions:

\`\`\`json
{
  "stepId": "optimize",
  "name": "Optimize if Needed",
  "type": "conditional",
  "condition": "\${previousOutputs.analyze.needsOptimization}",
  "config": {
    "thenSteps": ["run-optimizer"],
    "elseSteps": ["skip-optimization"]
  }
}
\`\`\`

### loop - Iteration

Process arrays of items:

\`\`\`json
{
  "stepId": "process-files",
  "name": "Process Each File",
  "type": "loop",
  "config": {
    "itemsPath": "previousOutputs.scan.files",
    "maxIterations": 100
  }
}
\`\`\`
`);
  }

  // Parallel section
  if (topic === 'all' || topic === 'parallel') {
    sections.push(`
## Parallel Execution

### How It Works

AutomatosX uses DAG-based (Directed Acyclic Graph) parallel execution:

1. Steps with no dependencies run concurrently
2. Steps wait for their dependencies to complete
3. Concurrency is limited (default: 5 concurrent steps)

### Enabling Parallel Execution

\`\`\`
agent_run {
  agentId: "analyzer",
  input: { ... },
  parallel: true
}
\`\`\`

### Workflow with Parallel Steps

\`\`\`json
{
  "workflow": [
    { "stepId": "parse", "name": "Parse Input", "type": "prompt", "config": {...} },
    { "stepId": "analyze-security", "name": "Security Analysis", "type": "prompt", "dependencies": ["parse"] },
    { "stepId": "analyze-performance", "name": "Perf Analysis", "type": "prompt", "dependencies": ["parse"] },
    { "stepId": "analyze-style", "name": "Style Analysis", "type": "prompt", "dependencies": ["parse"] },
    { "stepId": "combine", "name": "Combine Results", "type": "prompt", "dependencies": ["analyze-security", "analyze-performance", "analyze-style"] }
  ]
}
\`\`\`

Execution order:
1. \`parse\` runs first
2. \`analyze-security\`, \`analyze-performance\`, \`analyze-style\` run in parallel
3. \`combine\` runs after all analyses complete

### Failure Strategies

- **failFast** (default): Stop on first failure
- **failSafe**: Wait for all, collect errors
- **continueOnError**: Continue despite failures
`);
  }

  // Delegation section
  if (topic === 'all' || topic === 'delegation') {
    sections.push(`
## Multi-Agent Delegation

### How Delegation Works

Agents can delegate tasks to specialized agents using the \`delegate\` step type.

**Invariants Enforced:**
- **INV-DT-001**: Maximum delegation depth (default: 5) prevents infinite chains
- **INV-DT-002**: Circular delegation is prevented (agent can't delegate to itself or ancestors)

### Example: Orchestrator Pattern

\`\`\`json
{
  "agentId": "orchestrator",
  "description": "Coordinates complex tasks across specialists",
  "workflow": [
    {
      "stepId": "plan",
      "name": "Create Plan",
      "type": "prompt",
      "config": { "prompt": "Create a plan for: \${input.task}" }
    },
    {
      "stepId": "backend-work",
      "name": "Backend Implementation",
      "type": "delegate",
      "config": {
        "targetAgentId": "backend",
        "input": { "spec": "\${previousOutputs.plan.content}" }
      },
      "dependencies": ["plan"]
    },
    {
      "stepId": "frontend-work",
      "name": "Frontend Implementation",
      "type": "delegate",
      "config": {
        "targetAgentId": "frontend",
        "input": { "spec": "\${previousOutputs.plan.content}" }
      },
      "dependencies": ["plan"]
    },
    {
      "stepId": "integrate",
      "name": "Integration",
      "type": "prompt",
      "config": {
        "prompt": "Integrate backend and frontend: \${previousOutputs.backend-work.result} \${previousOutputs.frontend-work.result}"
      },
      "dependencies": ["backend-work", "frontend-work"]
    }
  ]
}
\`\`\`

### Delegation Context

When delegating, the context tracks:
- Current depth in the delegation chain
- Maximum allowed depth
- Full chain of agent IDs (for circular detection)
- Root task ID for correlation
`);
  }

  // Build the response
  const content = sections.join('\n');

  const messages: MCPPromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: content,
      },
    },
  ];

  return {
    description: 'AutomatosX Agent System Guide',
    messages,
  };
};
