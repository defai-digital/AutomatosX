import type { McpToolDefinition } from './surface-types.js';
import { objectSchema } from './tool-schema.js';

export const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'workflow_run',
    description: 'Run a workflow through the shared runtime.',
    inputSchema: objectSchema({
      workflowId: { type: 'string', description: 'Workflow id to execute.' },
      traceId: { type: 'string', description: 'Optional trace id override.' },
      sessionId: { type: 'string', description: 'Optional session id for trace correlation.' },
      workflowDir: { type: 'string', description: 'Optional workflow directory override.' },
      basePath: { type: 'string', description: 'Optional base path override.' },
      provider: { type: 'string', description: 'Optional provider override.' },
      input: objectSchema({}, [], true),
    }, ['workflowId']),
  },
  {
    name: 'workflow_list',
    description: 'List workflows available to the shared runtime.',
    inputSchema: objectSchema({
      workflowDir: { type: 'string' },
      basePath: { type: 'string' },
    }),
  },
  {
    name: 'workflow_describe',
    description: 'Describe a workflow and its steps.',
    inputSchema: objectSchema({
      workflowId: { type: 'string' },
      workflowDir: { type: 'string' },
      basePath: { type: 'string' },
    }, ['workflowId']),
  },
  {
    name: 'trace_get',
    description: 'Load a single trace by id.',
    inputSchema: objectSchema({
      traceId: { type: 'string' },
    }, ['traceId']),
  },
  {
    name: 'trace_list',
    description: 'List recent traces from the shared trace store.',
    inputSchema: objectSchema({
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'trace_analyze',
    description: 'Analyze a stored trace and summarize execution health.',
    inputSchema: objectSchema({
      traceId: { type: 'string' },
    }, ['traceId']),
  },
  {
    name: 'trace_by_session',
    description: 'List traces associated with a session id.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      limit: { type: 'integer' },
    }, ['sessionId']),
  },
  {
    name: 'trace_close_stuck',
    description: 'Auto-close stale running traces.',
    inputSchema: objectSchema({
      maxAgeMs: { type: 'integer' },
    }),
  },
  {
    name: 'trace_tree',
    description: 'Reconstruct the parent/child trace hierarchy for a trace.',
    inputSchema: objectSchema({
      traceId: { type: 'string' },
    }, ['traceId']),
  },
  {
    name: 'agent_register',
    description: 'Register an agent in the shared state store.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
      name: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string' } },
      metadata: objectSchema({}, [], true),
    }, ['agentId', 'name']),
  },
  {
    name: 'agent_get',
    description: 'Get a registered agent by id.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
    }, ['agentId']),
  },
  {
    name: 'agent_list',
    description: 'List registered agents.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'agent_remove',
    description: 'Remove a registered agent by id.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
    }, ['agentId']),
  },
  {
    name: 'agent_capabilities',
    description: 'List all unique agent capabilities.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'agent_run',
    description: 'Execute a registered agent through the shared runtime.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
      task: { type: 'string' },
      input: objectSchema({}, [], true),
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
      timeoutMs: { type: 'integer' },
      parentTraceId: { type: 'string' },
      rootTraceId: { type: 'string' },
    }, ['agentId']),
  },
  {
    name: 'agent_recommend',
    description: 'Recommend registered agents for a task.',
    inputSchema: objectSchema({
      task: { type: 'string' },
      requiredCapabilities: { type: 'array', items: { type: 'string' } },
      limit: { type: 'integer' },
      team: { type: 'string' },
    }, ['task']),
  },
  {
    name: 'discuss_run',
    description: 'Run a top-level multi-provider discussion.',
    inputSchema: objectSchema({
      topic: { type: 'string' },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
      provider: { type: 'string' },
      pattern: { type: 'string' },
      rounds: { type: 'integer' },
      providers: { type: 'array', items: { type: 'string' } },
      consensusMethod: { type: 'string' },
      context: { type: 'string' },
      minProviders: { type: 'integer' },
      verbose: { type: 'boolean' },
    }, ['topic']),
  },
  {
    name: 'discuss_quick',
    description: 'Run a single-round fast-path discussion.',
    inputSchema: objectSchema({
      topic: { type: 'string' },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
      provider: { type: 'string' },
      pattern: { type: 'string' },
      providers: { type: 'array', items: { type: 'string' } },
      consensusMethod: { type: 'string' },
      context: { type: 'string' },
      minProviders: { type: 'integer' },
      verbose: { type: 'boolean' },
    }, ['topic']),
  },
  {
    name: 'discuss_recursive',
    description: 'Run a root discussion plus nested child discussions for explicit subtopics.',
    inputSchema: objectSchema({
      topic: { type: 'string' },
      subtopics: { type: 'array', items: { type: 'string' } },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
      provider: { type: 'string' },
      pattern: { type: 'string' },
      rounds: { type: 'integer' },
      providers: { type: 'array', items: { type: 'string' } },
      consensusMethod: { type: 'string' },
      context: { type: 'string' },
      minProviders: { type: 'integer' },
      verbose: { type: 'boolean' },
    }, ['topic', 'subtopics']),
  },
  {
    name: 'session_create',
    description: 'Create a collaboration session.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      task: { type: 'string' },
      initiator: { type: 'string' },
      workspace: { type: 'string' },
      metadata: objectSchema({}, [], true),
    }, ['task', 'initiator']),
  },
  {
    name: 'session_get',
    description: 'Get a collaboration session by id.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
    }, ['sessionId']),
  },
  {
    name: 'session_list',
    description: 'List collaboration sessions.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'session_join',
    description: 'Join a session with an agent and role.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      agentId: { type: 'string' },
      role: { type: 'string', enum: ['initiator', 'collaborator', 'delegate'] },
    }, ['sessionId', 'agentId']),
  },
  {
    name: 'session_leave',
    description: 'Leave an active session.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      agentId: { type: 'string' },
    }, ['sessionId', 'agentId']),
  },
  {
    name: 'session_complete',
    description: 'Mark a session as completed.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      summary: { type: 'string' },
    }, ['sessionId']),
  },
  {
    name: 'session_fail',
    description: 'Mark a session as failed.',
    inputSchema: objectSchema({
      sessionId: { type: 'string' },
      message: { type: 'string' },
    }, ['sessionId', 'message']),
  },
  {
    name: 'review_analyze',
    description: 'Run deterministic v14 review heuristics and persist artifacts.',
    inputSchema: objectSchema({
      paths: { type: 'array', items: { type: 'string' } },
      focus: { type: 'string', enum: ['all', 'security', 'correctness', 'maintainability'] },
      maxFiles: { type: 'integer' },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
    }, ['paths']),
  },
  {
    name: 'review_list',
    description: 'List prior review traces.',
    inputSchema: objectSchema({
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'bridge_list',
    description: 'List local bridge definitions available under the current AutomatosX workspace.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'governance_get',
    description: 'Return the shared runtime governance aggregate, including runtime policy blocks and denied imported skills.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'bridge_inspect',
    description: 'Inspect a local bridge definition by bridge id or explicit path.',
    inputSchema: objectSchema({
      reference: { type: 'string' },
      basePath: { type: 'string' },
    }, ['reference']),
  },
  {
    name: 'bridge_install',
    description: 'Install a local bridge bundle or bridge.json into the current AutomatosX workspace.',
    inputSchema: objectSchema({
      sourcePath: { type: 'string' },
      requireTrusted: { type: 'boolean' },
      basePath: { type: 'string' },
    }, ['sourcePath']),
  },
  {
    name: 'bridge_run',
    description: 'Execute a local command/script bridge and capture stdout, stderr, and exit code.',
    inputSchema: objectSchema({
      reference: { type: 'string' },
      args: { type: 'array', items: { type: 'string' } },
      basePath: { type: 'string' },
      sessionId: { type: 'string', description: 'Optional session id for trace correlation.' },
    }, ['reference']),
  },
  {
    name: 'skill_list',
    description: 'List local skill definitions available under the current AutomatosX workspace.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'skill_resolve',
    description: 'Resolve local skills against a query using skill metadata and body text.',
    inputSchema: objectSchema({
      query: { type: 'string' },
      basePath: { type: 'string' },
      limit: { type: 'integer' },
    }, ['query']),
  },
  {
    name: 'skill_run',
    description: 'Run a local skill through the shared runtime using bridge or delegate dispatch.',
    inputSchema: objectSchema({
      reference: { type: 'string' },
      args: { type: 'array', items: { type: 'string' } },
      task: { type: 'string' },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      basePath: { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
    }, ['reference']),
  },
  {
    name: 'memory_retrieve',
    description: 'Retrieve a single memory entry by key.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
    }, ['key']),
  },
  {
    name: 'memory_search',
    description: 'Search memory entries by query.',
    inputSchema: objectSchema({
      query: { type: 'string' },
      namespace: { type: 'string' },
    }, ['query']),
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory entry by key.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
    }, ['key']),
  },
  {
    name: 'memory_store',
    description: 'Store a memory entry.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
      value: objectSchema({}, [], true),
    }, ['key']),
  },
  {
    name: 'memory_list',
    description: 'List memory entries.',
    inputSchema: objectSchema({
      namespace: { type: 'string' },
    }),
  },
  {
    name: 'semantic_store',
    description: 'Store semantic content for later similarity search.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
      content: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      metadata: objectSchema({}, [], true),
    }, ['key', 'content']),
  },
  {
    name: 'semantic_search',
    description: 'Search semantic content by similarity.',
    inputSchema: objectSchema({
      query: { type: 'string' },
      namespace: { type: 'string' },
      filterTags: { type: 'array', items: { type: 'string' } },
      topK: { type: 'integer' },
      minSimilarity: { type: 'number' },
    }, ['query']),
  },
  {
    name: 'semantic_get',
    description: 'Retrieve a semantic item by key.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
    }, ['key']),
  },
  {
    name: 'semantic_list',
    description: 'List semantic items by namespace or key prefix.',
    inputSchema: objectSchema({
      namespace: { type: 'string' },
      keyPrefix: { type: 'string' },
      filterTags: { type: 'array', items: { type: 'string' } },
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'semantic_delete',
    description: 'Delete a semantic item by key.',
    inputSchema: objectSchema({
      key: { type: 'string' },
      namespace: { type: 'string' },
    }, ['key']),
  },
  {
    name: 'semantic_stats',
    description: 'Return semantic namespace statistics.',
    inputSchema: objectSchema({
      namespace: { type: 'string' },
    }),
  },
  {
    name: 'semantic_clear',
    description: 'Clear all semantic items in a namespace.',
    inputSchema: objectSchema({
      namespace: { type: 'string' },
      confirm: { type: 'boolean' },
    }, ['namespace', 'confirm']),
  },
  {
    name: 'feedback_submit',
    description: 'Submit a durable feedback event for an agent run or task.',
    inputSchema: objectSchema({
      selectedAgent: { type: 'string' },
      recommendedAgent: { type: 'string' },
      rating: { type: 'integer' },
      feedbackType: { type: 'string' },
      taskDescription: { type: 'string' },
      userComment: { type: 'string' },
      outcome: { type: 'string' },
      durationMs: { type: 'integer' },
      sessionId: { type: 'string' },
      metadata: objectSchema({}, [], true),
    }, ['selectedAgent', 'taskDescription']),
  },
  {
    name: 'feedback_history',
    description: 'List recent feedback entries.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
      limit: { type: 'integer' },
      since: { type: 'string' },
    }),
  },
  {
    name: 'feedback_stats',
    description: 'Return aggregate feedback stats for an agent.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
    }, ['agentId']),
  },
  {
    name: 'feedback_overview',
    description: 'Return overall feedback overview statistics.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'feedback_adjustments',
    description: 'Return bounded score adjustments derived from feedback.',
    inputSchema: objectSchema({
      agentId: { type: 'string' },
    }, ['agentId']),
  },
  {
    name: 'ability_list',
    description: 'List built-in runtime abilities.',
    inputSchema: objectSchema({
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    }),
  },
  {
    name: 'ability_inject',
    description: 'Inject matched ability context for a task.',
    inputSchema: objectSchema({
      task: { type: 'string' },
      requiredAbilities: { type: 'array', items: { type: 'string' } },
      category: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      maxAbilities: { type: 'integer' },
      includeMetadata: { type: 'boolean' },
    }, ['task']),
  },
  {
    name: 'config_get',
    description: 'Get a config value by dot-separated path.',
    inputSchema: objectSchema({
      path: { type: 'string' },
    }, ['path']),
  },
  {
    name: 'config_set',
    description: 'Set a config value by dot-separated path.',
    inputSchema: objectSchema({
      path: { type: 'string' },
    }, ['path'], true),
  },
  {
    name: 'config_show',
    description: 'Show the full workspace config.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'file_exists',
    description: 'Check whether a workspace-relative path exists.',
    inputSchema: objectSchema({
      path: { type: 'string' },
      basePath: { type: 'string' },
    }, ['path']),
  },
  {
    name: 'file_write',
    description: 'Write content to a workspace-relative file path.',
    inputSchema: objectSchema({
      path: { type: 'string' },
      content: { type: 'string' },
      overwrite: { type: 'boolean' },
      createDirectories: { type: 'boolean' },
      basePath: { type: 'string' },
    }, ['path', 'content']),
  },
  {
    name: 'directory_create',
    description: 'Create a workspace-relative directory.',
    inputSchema: objectSchema({
      path: { type: 'string' },
      recursive: { type: 'boolean' },
      basePath: { type: 'string' },
    }, ['path']),
  },
  {
    name: 'git_status',
    description: 'Read git status for the current workspace.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
    }),
  },
  {
    name: 'git_diff',
    description: 'Read git diff output for the current workspace.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      paths: { type: 'array', items: { type: 'string' } },
      staged: { type: 'boolean' },
      commit: { type: 'string' },
      stat: { type: 'boolean' },
    }),
  },
  {
    name: 'commit_prepare',
    description: 'Prepare a conventional commit message from local changes.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      paths: { type: 'array', items: { type: 'string' } },
      stageAll: { type: 'boolean' },
      type: { type: 'string' },
      scope: { type: 'string' },
    }),
  },
  {
    name: 'pr_review',
    description: 'Review a local branch diff against a base ref.',
    inputSchema: objectSchema({
      basePath: { type: 'string' },
      base: { type: 'string' },
      head: { type: 'string' },
    }),
  },
  {
    name: 'pr_create',
    description: 'Create a pull request through the local gh CLI.',
    inputSchema: objectSchema({
      title: { type: 'string' },
      body: { type: 'string' },
      base: { type: 'string' },
      head: { type: 'string' },
      draft: { type: 'boolean' },
      basePath: { type: 'string' },
    }, ['title']),
  },
  {
    name: 'guard_list',
    description: 'List available trust policies.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'guard_apply',
    description: 'Apply a built-in or custom trust policy.',
    inputSchema: objectSchema({
      policyId: { type: 'string' },
      definition: objectSchema({}, [], true),
      enabled: { type: 'boolean' },
    }),
  },
  {
    name: 'guard_check',
    description: 'Evaluate trust policies against a step context.',
    inputSchema: objectSchema({
      policyId: { type: 'string' },
      position: { type: 'string', enum: ['before', 'after'] },
      agentId: { type: 'string' },
      executionId: { type: 'string' },
      sessionId: { type: 'string' },
      workflowId: { type: 'string' },
      stepId: { type: 'string' },
      stepType: { type: 'string' },
      stepIndex: { type: 'integer' },
      totalSteps: { type: 'integer' },
      previousOutputs: objectSchema({}, [], true),
      stepConfig: objectSchema({}, [], true),
    }, ['stepId', 'stepType']),
  },
  {
    name: 'policy_register',
    description: 'Register a policy in the shared state store.',
    inputSchema: objectSchema({
      policyId: { type: 'string' },
      name: { type: 'string' },
      enabled: { type: 'boolean' },
      metadata: objectSchema({}, [], true),
    }, ['policyId', 'name']),
  },
  {
    name: 'policy_list',
    description: 'List registered policies.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'session_close_stuck',
    description: 'Auto-close stale active sessions.',
    inputSchema: objectSchema({
      maxAgeMs: { type: 'integer' },
    }),
  },
  {
    name: 'dashboard_list',
    description: 'List workflow executions for the dashboard.',
    inputSchema: objectSchema({
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'parallel_plan',
    description: 'Validate and plan a bounded parallel agent DAG.',
    inputSchema: objectSchema({
      tasks: {
        type: 'array',
        items: objectSchema({
          taskId: { type: 'string' },
          agentId: { type: 'string' },
          task: { type: 'string' },
          input: objectSchema({}, [], true),
          dependencies: { type: 'array', items: { type: 'string' } },
          priority: { type: 'integer' },
          provider: { type: 'string' },
          model: { type: 'string' },
          timeoutMs: { type: 'integer' },
        }, ['taskId', 'agentId']),
      },
    }, ['tasks']),
  },
  {
    name: 'parallel_run',
    description: 'Execute a bounded parallel agent DAG through the shared runtime.',
    inputSchema: objectSchema({
      tasks: {
        type: 'array',
        items: objectSchema({
          taskId: { type: 'string' },
          agentId: { type: 'string' },
          task: { type: 'string' },
          input: objectSchema({}, [], true),
          dependencies: { type: 'array', items: { type: 'string' } },
          priority: { type: 'integer' },
          provider: { type: 'string' },
          model: { type: 'string' },
          timeoutMs: { type: 'integer' },
        }, ['taskId', 'agentId']),
      },
      traceId: { type: 'string' },
      sessionId: { type: 'string' },
      maxConcurrent: { type: 'integer' },
      failureStrategy: { type: 'string', enum: ['failFast', 'failSafe'] },
      resultAggregation: { type: 'string', enum: ['list', 'merge'] },
    }, ['tasks']),
  },
  {
    name: 'memory_stats',
    description: 'Return count of memory entries per namespace.',
    inputSchema: objectSchema({ namespace: { type: 'string' } }),
  },
  {
    name: 'memory_clear',
    description: 'Delete all memory entries in a namespace.',
    inputSchema: objectSchema({ namespace: { type: 'string' } }, ['namespace']),
  },
  {
    name: 'memory_bulk_delete',
    description: 'Delete multiple memory entries by key list.',
    inputSchema: objectSchema({
      keys: { type: 'array', items: { type: 'string' } },
      namespace: { type: 'string' },
    }, ['keys']),
  },
  {
    name: 'metrics_record',
    description: 'Record a named metric value (stored in memory namespace "ax.metrics").',
    inputSchema: objectSchema({
      name: { type: 'string' },
      value: { type: 'number' },
      tags: { type: 'array', items: { type: 'string' } },
    }, ['name', 'value']),
  },
  {
    name: 'metrics_increment',
    description: 'Increment a counter metric by a given amount (default 1).',
    inputSchema: objectSchema({
      name: { type: 'string' },
      amount: { type: 'number' },
      tags: { type: 'array', items: { type: 'string' } },
    }, ['name']),
  },
  {
    name: 'metrics_list',
    description: 'List all recorded metric names.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'metrics_query',
    description: 'Query recorded values for a specific metric name.',
    inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
  },
  {
    name: 'telemetry_summary',
    description: 'Return a summary of all metrics (count, sum, avg, min, max per metric).',
    inputSchema: objectSchema({}),
  },
  {
    name: 'task_submit',
    description: 'Submit a task to the in-process task queue.',
    inputSchema: objectSchema({
      taskId: { type: 'string' },
      type: { type: 'string' },
      payload: objectSchema({}, [], true),
      priority: { type: 'integer' },
    }, ['taskId', 'type']),
  },
  {
    name: 'task_status',
    description: 'Get the status of a submitted task.',
    inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
  },
  {
    name: 'task_list',
    description: 'List tasks in the queue, optionally filtered by status.',
    inputSchema: objectSchema({
      status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
      limit: { type: 'integer' },
    }),
  },
  {
    name: 'task_cancel',
    description: 'Cancel a pending task.',
    inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
  },
  {
    name: 'task_retry',
    description: 'Retry a failed task.',
    inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
  },
  {
    name: 'scaffold_contract',
    description: 'Generate Zod schema and invariants doc for a new domain contract.',
    inputSchema: objectSchema({
      name: { type: 'string' },
      description: { type: 'string' },
      output: { type: 'string' },
      dryRun: { type: 'boolean' },
    }, ['name']),
  },
  {
    name: 'scaffold_domain',
    description: 'Generate a full domain package (types, service, tests, trust policy).',
    inputSchema: objectSchema({
      name: { type: 'string' },
      scope: { type: 'string' },
      output: { type: 'string' },
      noTests: { type: 'boolean' },
      noGuard: { type: 'boolean' },
      dryRun: { type: 'boolean' },
    }, ['name']),
  },
  {
    name: 'scaffold_guard',
    description: 'Generate a trust policy YAML file.',
    inputSchema: objectSchema({
      policyId: { type: 'string' },
      domain: { type: 'string' },
      radius: { type: 'integer' },
      gates: { type: 'string' },
      dryRun: { type: 'boolean' },
    }, ['policyId']),
  },
  {
    name: 'ability_get',
    description: 'Get a registered custom ability by ID.',
    inputSchema: objectSchema({ abilityId: { type: 'string' } }, ['abilityId']),
  },
  {
    name: 'ability_register',
    description: 'Register a custom ability into the ability registry.',
    inputSchema: objectSchema({
      abilityId: { type: 'string' },
      displayName: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      content: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      enabled: { type: 'boolean' },
    }, ['abilityId', 'displayName', 'description', 'content']),
  },
  {
    name: 'ability_remove',
    description: 'Remove a registered custom ability by ID.',
    inputSchema: objectSchema({ abilityId: { type: 'string' } }, ['abilityId']),
  },
  {
    name: 'memory_export',
    description: 'Export all memory entries (optionally filtered by namespace) as JSON.',
    inputSchema: objectSchema({ namespace: { type: 'string' } }),
  },
  {
    name: 'memory_import',
    description: 'Import memory entries from a JSON array.',
    inputSchema: objectSchema({
      entries: { type: 'array', items: objectSchema({ key: { type: 'string' }, namespace: { type: 'string' }, value: objectSchema({}, [], true) }, ['key']) },
      overwrite: { type: 'boolean' },
    }, ['entries']),
  },
  {
    name: 'timer_start',
    description: 'Start a named timer.',
    inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
  },
  {
    name: 'timer_stop',
    description: 'Stop a named timer and return elapsed milliseconds.',
    inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
  },
  {
    name: 'queue_create',
    description: 'Create a named job queue.',
    inputSchema: objectSchema({ queueId: { type: 'string' }, maxSize: { type: 'integer' } }, ['queueId']),
  },
  {
    name: 'queue_list',
    description: 'List all queues and their sizes.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'research_query',
    description: 'Execute a research query using available provider reasoning.',
    inputSchema: objectSchema({
      query: { type: 'string' },
      maxSources: { type: 'integer' },
      provider: { type: 'string' },
      sessionId: { type: 'string' },
    }, ['query']),
  },
  {
    name: 'research_fetch',
    description: 'Fetch and extract content from a URL for research purposes.',
    inputSchema: objectSchema({
      url: { type: 'string' },
      selector: { type: 'string' },
    }, ['url']),
  },
  {
    name: 'research_synthesize',
    description: 'Synthesize multiple sources into a coherent answer.',
    inputSchema: objectSchema({
      topic: { type: 'string' },
      sources: { type: 'array', items: objectSchema({ url: { type: 'string' }, content: { type: 'string' } }, ['content']) },
      provider: { type: 'string' },
      sessionId: { type: 'string' },
    }, ['topic', 'sources']),
  },
  {
    name: 'mcp_server_list',
    description: 'List registered external MCP servers.',
    inputSchema: objectSchema({}),
  },
  {
    name: 'mcp_server_register',
    description: 'Register an external MCP server.',
    inputSchema: objectSchema({
      serverId: { type: 'string' },
      command: { type: 'string' },
      args: { type: 'array', items: { type: 'string' } },
      description: { type: 'string' },
    }, ['serverId', 'command']),
  },
  {
    name: 'mcp_server_unregister',
    description: 'Unregister an external MCP server.',
    inputSchema: objectSchema({ serverId: { type: 'string' } }, ['serverId']),
  },
  {
    name: 'mcp_tools_list',
    description: 'List all available tools on this MCP server.',
    inputSchema: objectSchema({ prefix: { type: 'string' } }),
  },
  {
    name: 'mcp_tools_discover',
    description: 'Discover tools matching a search query.',
    inputSchema: objectSchema({ query: { type: 'string' } }, ['query']),
  },
  {
    name: 'design_api',
    description: 'Generate an API design for a given domain and requirements.',
    inputSchema: objectSchema({
      domain: { type: 'string' },
      requirements: { type: 'string' },
      style: { type: 'string', enum: ['rest', 'rpc', 'graphql', 'event'] },
      sessionId: { type: 'string' },
    }, ['domain', 'requirements']),
  },
  {
    name: 'design_architecture',
    description: 'Generate an architecture design for a given system description.',
    inputSchema: objectSchema({
      system: { type: 'string' },
      constraints: { type: 'string' },
      pattern: { type: 'string' },
      sessionId: { type: 'string' },
    }, ['system']),
  },
  {
    name: 'design_component',
    description: 'Generate a component design specification.',
    inputSchema: objectSchema({
      name: { type: 'string' },
      purpose: { type: 'string' },
      dependencies: { type: 'array', items: { type: 'string' } },
      sessionId: { type: 'string' },
    }, ['name', 'purpose']),
  },
  {
    name: 'design_schema',
    description: 'Generate a data schema for a given domain entity.',
    inputSchema: objectSchema({
      entity: { type: 'string' },
      fields: { type: 'string' },
      constraints: { type: 'string' },
      sessionId: { type: 'string' },
    }, ['entity', 'fields']),
  },
  {
    name: 'design_list',
    description: 'List stored design artifacts.',
    inputSchema: objectSchema({ domain: { type: 'string' } }),
  },
];
