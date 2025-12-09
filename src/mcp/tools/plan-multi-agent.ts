/**
 * MCP Tool: plan_multi_agent (Option C)
 *
 * Analyzes a complex task and returns an orchestration plan with:
 * - Agent assignments for subtasks
 * - Dependency analysis (which tasks depend on others)
 * - Parallelization recommendations
 *
 * Returns plan data for the AI client to execute via multiple run_agent calls.
 * Does NOT execute - just plans.
 *
 * @version 12.6.0
 */

import type { ToolHandler } from '../types.js';
import type { ProfileLoader } from '../../agents/profile-loader.js';
import type { IMemoryManager } from '../../types/memory.js';
import { AgentSelector, scoreAgent, buildRationale } from '../../agents/agent-selector.js';
import { logger } from '../../shared/logging/logger.js';

/**
 * Subtask with agent assignment
 */
export interface PlannedSubtask {
  /** Unique identifier for this subtask */
  id: string;
  /** Human-readable subtask description */
  task: string;
  /** Assigned agent name */
  agent: string;
  /** Agent's role/specialty */
  agentRole: string;
  /** Why this agent was selected */
  rationale: string[];
  /** Selection confidence */
  confidence: 'high' | 'medium' | 'low';
  /** IDs of subtasks this depends on (must complete first) */
  dependencies: string[];
  /** Estimated complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Suggested priority (1 = highest) */
  priority: number;
}

/**
 * Execution group - tasks that can run in parallel
 */
export interface ExecutionGroup {
  /** Group number (execution order) */
  level: number;
  /** Tasks in this group */
  tasks: string[];
  /** Whether tasks in this group can run in parallel */
  canParallelize: boolean;
  /** Reason for parallelization decision */
  parallelizationReason: string;
}

/**
 * Input for plan_multi_agent tool
 */
export interface PlanMultiAgentInput {
  /** Complex task to analyze and plan */
  task: string;
  /** Optional: Preferred agents to consider */
  preferredAgents?: string[];
  /** Optional: Max number of subtasks to generate */
  maxSubtasks?: number;
  /** Optional: Include memory context in planning */
  includeMemory?: boolean;
}

/**
 * Output of plan_multi_agent tool
 */
export interface PlanMultiAgentOutput {
  /** Original task */
  originalTask: string;
  /** Analysis summary */
  summary: string;
  /** Planned subtasks with agent assignments */
  subtasks: PlannedSubtask[];
  /** Execution groups (for parallel/sequential guidance) */
  executionPlan: ExecutionGroup[];
  /** Total estimated agents needed */
  totalAgents: number;
  /** Unique agents involved */
  uniqueAgents: string[];
  /** Whether parallel execution is recommended */
  recommendParallel: boolean;
  /** Parallelization explanation */
  parallelizationAdvice: string;
  /** Example run_agent calls (for AI client reference) */
  exampleCalls: string[];
  /** Relevant memory context (if requested) */
  memoryContext?: Array<{ content: string; relevance: number }>;
}

/**
 * Task decomposition patterns
 */
const TASK_PATTERNS = {
  // Full-stack patterns
  fullStack: {
    pattern: /\b(full[- ]?stack|end[- ]?to[- ]?end|complete\s+(?:feature|system|application))\b/i,
    subtasks: ['architecture', 'backend', 'frontend', 'quality']
  },
  // Authentication/Security patterns
  authentication: {
    pattern: /\b(auth(?:entication)?|login|sign[- ]?(?:in|up)|oauth|jwt|security)\b/i,
    subtasks: ['security', 'backend', 'frontend']
  },
  // API patterns
  api: {
    pattern: /\b(api|rest|graphql|endpoint|microservice)\b/i,
    subtasks: ['architecture', 'backend', 'quality']
  },
  // UI patterns
  ui: {
    pattern: /\b(ui|ux|user\s+interface|frontend|component|page|form)\b/i,
    subtasks: ['frontend', 'quality']
  },
  // Database patterns
  database: {
    pattern: /\b(database|db|sql|migration|schema|model)\b/i,
    subtasks: ['backend', 'quality']
  },
  // DevOps patterns
  devops: {
    pattern: /\b(deploy|ci[\/\-]?cd|docker|kubernetes|infrastructure|pipeline)\b/i,
    subtasks: ['devops', 'quality']
  },
  // Refactoring patterns
  refactor: {
    pattern: /\b(refactor|restructure|optimize|improve|clean[- ]?up)\b/i,
    subtasks: ['architecture', 'quality']
  }
};

/**
 * Analyze task complexity
 */
function analyzeComplexity(task: string): 'low' | 'medium' | 'high' {
  const words = task.split(/\s+/).length;
  const hasMultipleConcepts = (task.match(/\b(and|with|including|plus|also)\b/gi) || []).length;

  if (words > 50 || hasMultipleConcepts >= 3) return 'high';
  if (words > 20 || hasMultipleConcepts >= 1) return 'medium';
  return 'low';
}

/**
 * Extract subtasks from a complex task description
 */
function extractSubtasks(task: string): string[] {
  const subtasks: string[] = [];
  const taskLower = task.toLowerCase();

  // Check for explicit subtask markers
  const explicitMarkers = task.match(/(?:^|\n)\s*[-•*\d.]+\s*(.+?)(?=\n|$)/gm);
  if (explicitMarkers && explicitMarkers.length >= 2) {
    return explicitMarkers.map(m => m.replace(/^[\s\-•*\d.]+/, '').trim());
  }

  // Check for "and" separated tasks
  const andSplit = task.split(/\s+and\s+/i);
  if (andSplit.length >= 2 && andSplit.every(s => s.length > 10)) {
    return andSplit.map(s => s.trim());
  }

  // Use pattern matching
  for (const [name, config] of Object.entries(TASK_PATTERNS)) {
    if (config.pattern.test(taskLower)) {
      // Generate subtasks based on pattern
      if (name === 'fullStack') {
        subtasks.push(
          `Design system architecture for: ${task}`,
          `Implement backend services for: ${task}`,
          `Build frontend UI for: ${task}`,
          `Write tests and review quality for: ${task}`
        );
        break;
      } else if (name === 'authentication') {
        subtasks.push(
          `Design security requirements for: ${task}`,
          `Implement authentication backend for: ${task}`,
          `Build authentication UI for: ${task}`
        );
        break;
      } else if (name === 'api') {
        subtasks.push(
          `Design API architecture for: ${task}`,
          `Implement API endpoints for: ${task}`,
          `Write API tests for: ${task}`
        );
        break;
      }
    }
  }

  // Default: break into design, implement, test phases
  if (subtasks.length === 0) {
    subtasks.push(
      `Analyze and design approach for: ${task}`,
      `Implement solution for: ${task}`,
      `Test and validate: ${task}`
    );
  }

  return subtasks;
}

/**
 * Determine dependencies between subtasks
 */
function analyzeDependencies(subtasks: PlannedSubtask[]): void {
  // Simple heuristic: architecture/design tasks have no deps
  // Implementation depends on design
  // Testing depends on implementation

  const designTasks = subtasks.filter(t =>
    t.agent === 'architecture' ||
    t.task.toLowerCase().includes('design') ||
    t.task.toLowerCase().includes('analyze')
  );

  const implTasks = subtasks.filter(t =>
    t.agent === 'backend' ||
    t.agent === 'frontend' ||
    t.task.toLowerCase().includes('implement') ||
    t.task.toLowerCase().includes('build')
  );

  const testTasks = subtasks.filter(t =>
    t.agent === 'quality' ||
    t.task.toLowerCase().includes('test') ||
    t.task.toLowerCase().includes('review')
  );

  // Set dependencies
  for (const impl of implTasks) {
    impl.dependencies = designTasks.map(d => d.id);
  }

  for (const test of testTasks) {
    test.dependencies = implTasks.map(i => i.id);
  }
}

/**
 * Build execution groups based on dependencies
 */
function buildExecutionGroups(subtasks: PlannedSubtask[]): ExecutionGroup[] {
  const groups: ExecutionGroup[] = [];
  const completed = new Set<string>();
  let level = 0;

  while (completed.size < subtasks.length) {
    // Find tasks whose dependencies are all completed
    const ready = subtasks.filter(t =>
      !completed.has(t.id) &&
      t.dependencies.every(dep => completed.has(dep))
    );

    if (ready.length === 0) {
      // Circular dependency or error - add remaining tasks
      const remaining = subtasks.filter(t => !completed.has(t.id));
      groups.push({
        level,
        tasks: remaining.map(t => t.id),
        canParallelize: false,
        parallelizationReason: 'Unresolved dependencies'
      });
      break;
    }

    // Check if tasks can run in parallel
    const canParallelize = ready.length > 1;
    const agents = new Set(ready.map(t => t.agent));
    const parallelizationReason = canParallelize
      ? `${ready.length} independent tasks with ${agents.size} different agents`
      : 'Single task at this level';

    groups.push({
      level,
      tasks: ready.map(t => t.id),
      canParallelize,
      parallelizationReason
    });

    // Mark as completed
    for (const task of ready) {
      completed.add(task.id);
    }

    level++;
  }

  return groups;
}

export interface PlanMultiAgentDependencies {
  profileLoader: ProfileLoader;
  memoryManager?: IMemoryManager;
}

export function createPlanMultiAgentHandler(
  deps: PlanMultiAgentDependencies
): ToolHandler<PlanMultiAgentInput, PlanMultiAgentOutput> {
  return async (input: PlanMultiAgentInput): Promise<PlanMultiAgentOutput> => {
    const { task, preferredAgents, maxSubtasks = 6, includeMemory = false } = input;

    logger.info('[MCP] plan_multi_agent called', {
      taskPreview: task.substring(0, 100),
      maxSubtasks,
      includeMemory
    });

    // Extract subtasks from complex task
    let rawSubtasks = extractSubtasks(task);

    // Limit subtasks
    if (rawSubtasks.length > maxSubtasks) {
      rawSubtasks = rawSubtasks.slice(0, maxSubtasks);
    }

    // Load agent profiles for scoring
    const agentNames = await deps.profileLoader.listProfiles();
    const profiles = await Promise.all(
      agentNames.map(async (name) => {
        try {
          return { name, profile: await deps.profileLoader.loadProfile(name) };
        } catch {
          return null;
        }
      })
    );
    const validProfiles = profiles.filter((p): p is NonNullable<typeof p> => p !== null);

    // Create selector for agent matching
    const selector = new AgentSelector(deps.profileLoader);

    // Plan each subtask
    const plannedSubtasks: PlannedSubtask[] = [];

    for (let i = 0; i < rawSubtasks.length; i++) {
      const subtask = rawSubtasks[i]!;
      const id = `task_${i + 1}`;

      // Select best agent for this subtask
      let selectedAgent: string;
      let agentRole: string;
      let rationale: string[];
      let confidence: 'high' | 'medium' | 'low';

      // Check if preferred agent matches
      if (preferredAgents && preferredAgents.length > 0) {
        const preferredScores = preferredAgents.map(name => {
          const p = validProfiles.find(vp => vp.name === name);
          return p ? { name, score: scoreAgent(subtask, p.profile), profile: p.profile } : null;
        }).filter((s): s is NonNullable<typeof s> => s !== null);

        if (preferredScores.length > 0) {
          preferredScores.sort((a, b) => b.score - a.score);
          const best = preferredScores[0]!;
          if (best.score >= 5) {
            selectedAgent = best.name;
            agentRole = best.profile.role;
            rationale = buildRationale(subtask, best.profile);
            confidence = best.score >= 30 ? 'high' : best.score >= 15 ? 'medium' : 'low';
          } else {
            // Fall back to auto-selection
            const selection = await selector.selectAgent(subtask);
            selectedAgent = selection.agent;
            agentRole = selection.role;
            rationale = selection.rationale;
            confidence = selection.confidence;
          }
        } else {
          const selection = await selector.selectAgent(subtask);
          selectedAgent = selection.agent;
          agentRole = selection.role;
          rationale = selection.rationale;
          confidence = selection.confidence;
        }
      } else {
        const selection = await selector.selectAgent(subtask);
        selectedAgent = selection.agent;
        agentRole = selection.role;
        rationale = selection.rationale;
        confidence = selection.confidence;
      }

      plannedSubtasks.push({
        id,
        task: subtask,
        agent: selectedAgent,
        agentRole,
        rationale,
        confidence,
        dependencies: [], // Will be filled by analyzeDependencies
        complexity: analyzeComplexity(subtask),
        priority: i + 1
      });
    }

    // Analyze dependencies between subtasks
    analyzeDependencies(plannedSubtasks);

    // Build execution groups
    const executionPlan = buildExecutionGroups(plannedSubtasks);

    // Calculate unique agents
    const uniqueAgents = [...new Set(plannedSubtasks.map(t => t.agent))];

    // Determine if parallel execution is recommended
    const hasParallelGroups = executionPlan.some(g => g.canParallelize);
    const recommendParallel = hasParallelGroups && uniqueAgents.length > 1;

    // Build parallelization advice
    let parallelizationAdvice: string;
    if (recommendParallel) {
      const parallelGroups = executionPlan.filter(g => g.canParallelize);
      parallelizationAdvice = `Parallel execution recommended. ${parallelGroups.length} groups can run tasks in parallel. ` +
        `Call run_agent for tasks in the same group simultaneously to reduce total execution time.`;
    } else {
      parallelizationAdvice = 'Sequential execution recommended due to task dependencies.';
    }

    // Generate example run_agent calls
    const exampleCalls: string[] = [];
    for (const group of executionPlan) {
      if (group.canParallelize && group.tasks.length > 1) {
        exampleCalls.push(`// Level ${group.level}: Run these IN PARALLEL`);
        for (const taskId of group.tasks) {
          const subtask = plannedSubtasks.find(t => t.id === taskId)!;
          exampleCalls.push(`run_agent({ agent: "${subtask.agent}", task: "${subtask.task.substring(0, 50)}..." })`);
        }
      } else {
        exampleCalls.push(`// Level ${group.level}: Run sequentially`);
        for (const taskId of group.tasks) {
          const subtask = plannedSubtasks.find(t => t.id === taskId)!;
          exampleCalls.push(`run_agent({ agent: "${subtask.agent}", task: "${subtask.task.substring(0, 50)}..." })`);
        }
      }
    }

    // Fetch memory context if requested
    let memoryContext: Array<{ content: string; relevance: number }> | undefined;
    if (includeMemory && deps.memoryManager) {
      try {
        const results = await deps.memoryManager.search({ text: task, limit: 5 });
        memoryContext = results.map(r => ({
          content: r.entry.content.substring(0, 300),
          relevance: r.similarity || 0
        }));
      } catch (error) {
        logger.debug('[plan_multi_agent] Memory search failed', { error });
      }
    }

    // Build summary
    const summary = `Analyzed task and identified ${plannedSubtasks.length} subtasks requiring ${uniqueAgents.length} agents. ` +
      `${executionPlan.length} execution levels with ${recommendParallel ? 'parallel' : 'sequential'} execution recommended.`;

    logger.info('[MCP] plan_multi_agent completed', {
      subtaskCount: plannedSubtasks.length,
      uniqueAgents: uniqueAgents.length,
      executionLevels: executionPlan.length,
      recommendParallel
    });

    return {
      originalTask: task,
      summary,
      subtasks: plannedSubtasks,
      executionPlan,
      totalAgents: plannedSubtasks.length,
      uniqueAgents,
      recommendParallel,
      parallelizationAdvice,
      exampleCalls,
      memoryContext
    };
  };
}

/**
 * JSON Schema for plan_multi_agent tool (for MCP registration)
 */
export const planMultiAgentSchema = {
  name: 'plan_multi_agent',
  description: `Analyze a complex task and create a multi-agent execution plan.

**When to use**: Before executing a complex task that may benefit from multiple agents working together. This tool helps you:
- Break down complex tasks into subtasks
- Assign the best agent for each subtask
- Identify which subtasks can run in parallel
- Get ready-to-use run_agent examples

**What it returns**:
- subtasks: List of subtasks with agent assignments and rationale
- executionPlan: Groups of tasks showing which can run in parallel
- exampleCalls: Copy-paste ready run_agent calls
- parallelizationAdvice: Guidance on parallel vs sequential execution

**IMPORTANT**: This tool PLANS but does NOT execute. After reviewing the plan, execute it by calling run_agent for each subtask. For parallel groups, call run_agent multiple times in a single response.

**Example**:
plan_multi_agent({ task: "Build a user authentication system with login UI and security audit" })

Returns plan with:
- Task 1: security agent → Design security requirements
- Task 2: backend agent → Implement auth API (depends on Task 1)
- Task 3: frontend agent → Build login UI (depends on Task 1)
- Task 4: quality agent → Review and test (depends on Tasks 2, 3)

Then execute: Tasks 2 and 3 can run IN PARALLEL after Task 1 completes.`,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Complex task to analyze and plan. Be detailed about requirements.'
      },
      preferredAgents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: Prefer these agents when assigning subtasks'
      },
      maxSubtasks: {
        type: 'number',
        description: 'Maximum subtasks to generate (default: 6)',
        default: 6
      },
      includeMemory: {
        type: 'boolean',
        description: 'Include relevant memory context in planning (default: false)',
        default: false
      }
    },
    required: ['task']
  }
};
