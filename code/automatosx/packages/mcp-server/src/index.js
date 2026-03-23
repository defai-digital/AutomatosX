import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createDashboardService } from '@defai.digital/monitoring';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'automatosx';
const SERVER_VERSION = '14.0.0';
const DEFAULT_TOOL_PREFIX = 'ax_';
// JSON-RPC error codes
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS = -32602;
const RPC_INTERNAL_ERROR = -32603;
const RPC_RATE_LIMITED = -32001;
const RPC_SERVER_SHUTTING_DOWN = -32000;
const RESOURCE_URIS = {
    workspaceConfig: 'ax://workspace/config',
    workspaceMcp: 'ax://workspace/mcp',
    workspaceContext: 'ax://workspace/ax-md',
    workflowCatalog: 'ax://workflow/catalog',
    recentTraces: 'ax://trace/recent',
};
const PROMPT_DEFINITIONS = [
    {
        name: 'workflow.run',
        description: 'Guide a client to call the v14 workflow runtime with explicit workflow and input context.',
        arguments: [
            { name: 'workflowId', description: 'Workflow id to execute.', required: true },
            { name: 'goal', description: 'Goal or request for the workflow run.', required: true },
        ],
    },
    {
        name: 'workflow.architect',
        description: 'Prepare an architecture-planning request for the architect workflow.',
        arguments: [
            { name: 'requirement', description: 'Architecture requirement or change request.', required: true },
        ],
    },
    {
        name: 'review.analyze',
        description: 'Prepare a deterministic v14 review request for one or more paths.',
        arguments: [
            { name: 'paths', description: 'Comma-separated file or directory paths.', required: true },
            { name: 'focus', description: 'Review focus such as security or correctness.' },
        ],
    },
    {
        name: 'discuss.synthesize',
        description: 'Prepare a top-level discussion request with topic, providers, and optional context.',
        arguments: [
            { name: 'topic', description: 'Discussion topic.', required: true },
            { name: 'providers', description: 'Comma-separated providers to use.' },
            { name: 'context', description: 'Optional discussion context.' },
        ],
    },
];
const TOOL_DEFINITIONS = [
    {
        name: 'workflow.run',
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
        name: 'workflow.list',
        description: 'List workflows available to the shared runtime.',
        inputSchema: objectSchema({
            workflowDir: { type: 'string' },
            basePath: { type: 'string' },
        }),
    },
    {
        name: 'workflow.describe',
        description: 'Describe a workflow and its steps.',
        inputSchema: objectSchema({
            workflowId: { type: 'string' },
            workflowDir: { type: 'string' },
            basePath: { type: 'string' },
        }, ['workflowId']),
    },
    {
        name: 'trace.get',
        description: 'Load a single trace by id.',
        inputSchema: objectSchema({
            traceId: { type: 'string' },
        }, ['traceId']),
    },
    {
        name: 'trace.list',
        description: 'List recent traces from the shared trace store.',
        inputSchema: objectSchema({
            limit: { type: 'integer' },
        }),
    },
    {
        name: 'trace.analyze',
        description: 'Analyze a stored trace and summarize execution health.',
        inputSchema: objectSchema({
            traceId: { type: 'string' },
        }, ['traceId']),
    },
    {
        name: 'trace.by_session',
        description: 'List traces associated with a session id.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
            limit: { type: 'integer' },
        }, ['sessionId']),
    },
    {
        name: 'trace.close_stuck',
        description: 'Auto-close stale running traces.',
        inputSchema: objectSchema({
            maxAgeMs: { type: 'integer' },
        }),
    },
    {
        name: 'trace.tree',
        description: 'Reconstruct the parent/child trace hierarchy for a trace.',
        inputSchema: objectSchema({
            traceId: { type: 'string' },
        }, ['traceId']),
    },
    {
        name: 'agent.register',
        description: 'Register an agent in the shared state store.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
            name: { type: 'string' },
            capabilities: { type: 'array', items: { type: 'string' } },
            metadata: objectSchema({}, [], true),
        }, ['agentId', 'name']),
    },
    {
        name: 'agent.get',
        description: 'Get a registered agent by id.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
        }, ['agentId']),
    },
    {
        name: 'agent.list',
        description: 'List registered agents.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'agent.remove',
        description: 'Remove a registered agent by id.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
        }, ['agentId']),
    },
    {
        name: 'agent.capabilities',
        description: 'List all unique agent capabilities.',
        inputSchema: objectSchema({}),
    },
  {
    name: 'agent.run',
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
        name: 'agent.recommend',
        description: 'Recommend registered agents for a task.',
        inputSchema: objectSchema({
            task: { type: 'string' },
            requiredCapabilities: { type: 'array', items: { type: 'string' } },
            limit: { type: 'integer' },
            team: { type: 'string' },
        }, ['task']),
    },
    {
        name: 'discuss.run',
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
        name: 'discuss.quick',
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
        name: 'discuss.recursive',
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
        name: 'session.create',
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
        name: 'session.get',
        description: 'Get a collaboration session by id.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
        }, ['sessionId']),
    },
    {
        name: 'session.list',
        description: 'List collaboration sessions.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'session.join',
        description: 'Join a session with an agent and role.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
            agentId: { type: 'string' },
            role: { type: 'string', enum: ['initiator', 'collaborator', 'delegate'] },
        }, ['sessionId', 'agentId']),
    },
    {
        name: 'session.leave',
        description: 'Leave an active session.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
            agentId: { type: 'string' },
        }, ['sessionId', 'agentId']),
    },
    {
        name: 'session.complete',
        description: 'Mark a session as completed.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
            summary: { type: 'string' },
        }, ['sessionId']),
    },
    {
        name: 'session.fail',
        description: 'Mark a session as failed.',
        inputSchema: objectSchema({
            sessionId: { type: 'string' },
            message: { type: 'string' },
        }, ['sessionId', 'message']),
    },
    {
        name: 'review.analyze',
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
        name: 'review.list',
        description: 'List prior review traces.',
        inputSchema: objectSchema({
            limit: { type: 'integer' },
        }),
    },
    {
        name: 'memory.retrieve',
        description: 'Retrieve a single memory entry by key.',
        inputSchema: objectSchema({
            key: { type: 'string' },
            namespace: { type: 'string' },
        }, ['key']),
    },
    {
        name: 'memory.search',
        description: 'Search memory entries by query.',
        inputSchema: objectSchema({
            query: { type: 'string' },
            namespace: { type: 'string' },
        }, ['query']),
    },
    {
        name: 'memory.delete',
        description: 'Delete a memory entry by key.',
        inputSchema: objectSchema({
            key: { type: 'string' },
            namespace: { type: 'string' },
        }, ['key']),
    },
    {
        name: 'memory.store',
        description: 'Store a memory entry.',
        inputSchema: objectSchema({
            key: { type: 'string' },
            namespace: { type: 'string' },
            value: objectSchema({}, [], true),
        }, ['key']),
    },
    {
        name: 'memory.list',
        description: 'List memory entries.',
        inputSchema: objectSchema({
            namespace: { type: 'string' },
        }),
    },
    {
        name: 'semantic.store',
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
        name: 'semantic.search',
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
        name: 'semantic.get',
        description: 'Retrieve a semantic item by key.',
        inputSchema: objectSchema({
            key: { type: 'string' },
            namespace: { type: 'string' },
        }, ['key']),
    },
    {
        name: 'semantic.list',
        description: 'List semantic items by namespace or key prefix.',
        inputSchema: objectSchema({
            namespace: { type: 'string' },
            keyPrefix: { type: 'string' },
            filterTags: { type: 'array', items: { type: 'string' } },
            limit: { type: 'integer' },
        }),
    },
    {
        name: 'semantic.delete',
        description: 'Delete a semantic item by key.',
        inputSchema: objectSchema({
            key: { type: 'string' },
            namespace: { type: 'string' },
        }, ['key']),
    },
    {
        name: 'semantic.stats',
        description: 'Return semantic namespace statistics.',
        inputSchema: objectSchema({
            namespace: { type: 'string' },
        }),
    },
    {
        name: 'semantic.clear',
        description: 'Clear all semantic items in a namespace.',
        inputSchema: objectSchema({
            namespace: { type: 'string' },
            confirm: { type: 'boolean' },
        }, ['namespace', 'confirm']),
    },
    {
        name: 'feedback.submit',
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
        name: 'feedback.history',
        description: 'List recent feedback entries.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
            limit: { type: 'integer' },
            since: { type: 'string' },
        }),
    },
    {
        name: 'feedback.stats',
        description: 'Return aggregate feedback stats for an agent.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
        }, ['agentId']),
    },
    {
        name: 'feedback.overview',
        description: 'Return overall feedback overview statistics.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'feedback.adjustments',
        description: 'Return bounded score adjustments derived from feedback.',
        inputSchema: objectSchema({
            agentId: { type: 'string' },
        }, ['agentId']),
    },
    {
        name: 'ability.list',
        description: 'List built-in runtime abilities.',
        inputSchema: objectSchema({
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
        }),
    },
    {
        name: 'ability.inject',
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
        name: 'config.get',
        description: 'Get a config value by dot-separated path.',
        inputSchema: objectSchema({
            path: { type: 'string' },
        }, ['path']),
    },
    {
        name: 'config.set',
        description: 'Set a config value by dot-separated path.',
        inputSchema: objectSchema({
            path: { type: 'string' },
            value: { type: 'string' },
        }, ['path', 'value']),
    },
    {
        name: 'config.show',
        description: 'Show the full workspace config.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'file.exists',
        description: 'Check whether a workspace-relative path exists.',
        inputSchema: objectSchema({
            path: { type: 'string' },
            basePath: { type: 'string' },
        }, ['path']),
    },
    {
        name: 'file.write',
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
        name: 'directory.create',
        description: 'Create a workspace-relative directory.',
        inputSchema: objectSchema({
            path: { type: 'string' },
            recursive: { type: 'boolean' },
            basePath: { type: 'string' },
        }, ['path']),
    },
    {
        name: 'git.status',
        description: 'Read git status for the current workspace.',
        inputSchema: objectSchema({
            basePath: { type: 'string' },
        }),
    },
    {
        name: 'git.diff',
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
        name: 'commit.prepare',
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
        name: 'pr.review',
        description: 'Review a local branch diff against a base ref.',
        inputSchema: objectSchema({
            basePath: { type: 'string' },
            base: { type: 'string' },
            head: { type: 'string' },
        }),
    },
    {
        name: 'pr.create',
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
        name: 'guard.list',
        description: 'List available workflow guard policies.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'guard.apply',
        description: 'Apply a built-in or custom guard policy.',
        inputSchema: objectSchema({
            policyId: { type: 'string' },
            definition: objectSchema({}, [], true),
            enabled: { type: 'boolean' },
        }),
    },
    {
        name: 'guard.check',
        description: 'Evaluate guard policies against a step context.',
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
        name: 'policy.register',
        description: 'Register a policy in the shared state store.',
        inputSchema: objectSchema({
            policyId: { type: 'string' },
            name: { type: 'string' },
            enabled: { type: 'boolean' },
            metadata: objectSchema({}, [], true),
        }, ['policyId', 'name']),
    },
    {
        name: 'policy.list',
        description: 'List registered policies.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'session.close_stuck',
        description: 'Auto-close stale active sessions.',
        inputSchema: objectSchema({
            maxAgeMs: { type: 'integer' },
        }),
    },
    {
        name: 'dashboard.list',
        description: 'List workflow executions for the dashboard.',
        inputSchema: objectSchema({
            limit: { type: 'integer' },
        }),
    },
    {
        name: 'parallel.plan',
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
        name: 'parallel.run',
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
    // ── Memory extras ──────────────────────────────────────────────────────────
    {
        name: 'memory.stats',
        description: 'Return count of memory entries per namespace.',
        inputSchema: objectSchema({ namespace: { type: 'string' } }),
    },
    {
        name: 'memory.clear',
        description: 'Delete all memory entries in a namespace.',
        inputSchema: objectSchema({ namespace: { type: 'string' } }, ['namespace']),
    },
    {
        name: 'memory.bulk_delete',
        description: 'Delete multiple memory entries by key list.',
        inputSchema: objectSchema({
            keys: { type: 'array', items: { type: 'string' } },
            namespace: { type: 'string' },
        }, ['keys']),
    },
    // ── Telemetry / metrics ────────────────────────────────────────────────────
    {
        name: 'metrics.record',
        description: 'Record a named metric value (stored in memory namespace "ax.metrics").',
        inputSchema: objectSchema({
            name: { type: 'string' },
            value: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
        }, ['name', 'value']),
    },
    {
        name: 'metrics.increment',
        description: 'Increment a counter metric by a given amount (default 1).',
        inputSchema: objectSchema({
            name: { type: 'string' },
            amount: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
        }, ['name']),
    },
    {
        name: 'metrics.list',
        description: 'List all recorded metric names.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'metrics.query',
        description: 'Query recorded values for a specific metric name.',
        inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
    },
    {
        name: 'telemetry.summary',
        description: 'Return a summary of all metrics (count, sum, avg, min, max per metric).',
        inputSchema: objectSchema({}),
    },
    // ── Task queue ─────────────────────────────────────────────────────────────
    {
        name: 'task.submit',
        description: 'Submit a task to the in-process task queue.',
        inputSchema: objectSchema({
            taskId: { type: 'string' },
            type: { type: 'string' },
            payload: objectSchema({}, [], true),
            priority: { type: 'integer' },
        }, ['taskId', 'type']),
    },
    {
        name: 'task.status',
        description: 'Get the status of a submitted task.',
        inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
    },
    {
        name: 'task.list',
        description: 'List tasks in the queue, optionally filtered by status.',
        inputSchema: objectSchema({
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
            limit: { type: 'integer' },
        }),
    },
    {
        name: 'task.cancel',
        description: 'Cancel a pending task.',
        inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
    },
    {
        name: 'task.retry',
        description: 'Retry a failed task.',
        inputSchema: objectSchema({ taskId: { type: 'string' } }, ['taskId']),
    },
    // ── Scaffold (MCP surface) ─────────────────────────────────────────────────
    {
        name: 'scaffold.contract',
        description: 'Generate Zod schema and invariants doc for a new domain contract.',
        inputSchema: objectSchema({
            name: { type: 'string' },
            description: { type: 'string' },
            output: { type: 'string' },
            dryRun: { type: 'boolean' },
        }, ['name']),
    },
    {
        name: 'scaffold.domain',
        description: 'Generate a full domain package (types, service, tests, guard policy).',
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
        name: 'scaffold.guard',
        description: 'Generate a guard policy YAML file.',
        inputSchema: objectSchema({
            policyId: { type: 'string' },
            domain: { type: 'string' },
            radius: { type: 'integer' },
            gates: { type: 'string' },
            dryRun: { type: 'boolean' },
        }, ['policyId']),
    },
    // ── Ability registry (custom abilities stored in semantic namespace) ────────
    {
        name: 'ability.get',
        description: 'Get a registered custom ability by ID.',
        inputSchema: objectSchema({ abilityId: { type: 'string' } }, ['abilityId']),
    },
    {
        name: 'ability.register',
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
        name: 'ability.remove',
        description: 'Remove a registered custom ability by ID.',
        inputSchema: objectSchema({ abilityId: { type: 'string' } }, ['abilityId']),
    },
    // ── Memory import/export ───────────────────────────────────────────────────
    {
        name: 'memory.export',
        description: 'Export all memory entries (optionally filtered by namespace) as JSON.',
        inputSchema: objectSchema({ namespace: { type: 'string' } }),
    },
    {
        name: 'memory.import',
        description: 'Import memory entries from a JSON array.',
        inputSchema: objectSchema({
            entries: { type: 'array', items: objectSchema({ key: { type: 'string' }, namespace: { type: 'string' }, value: objectSchema({}, [], true) }, ['key']) },
            overwrite: { type: 'boolean' },
        }, ['entries']),
    },
    // ── Timer ──────────────────────────────────────────────────────────────────
    {
        name: 'timer.start',
        description: 'Start a named timer.',
        inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
    },
    {
        name: 'timer.stop',
        description: 'Stop a named timer and return elapsed milliseconds.',
        inputSchema: objectSchema({ name: { type: 'string' } }, ['name']),
    },
    // ── Queue (named job queues) ───────────────────────────────────────────────
    {
        name: 'queue.create',
        description: 'Create a named job queue.',
        inputSchema: objectSchema({ queueId: { type: 'string' }, maxSize: { type: 'integer' } }, ['queueId']),
    },
    {
        name: 'queue.list',
        description: 'List all queues and their sizes.',
        inputSchema: objectSchema({}),
    },
    // ── Research ───────────────────────────────────────────────────────────────
    {
        name: 'research.query',
        description: 'Execute a research query using available provider reasoning.',
        inputSchema: objectSchema({
            query: { type: 'string' },
            maxSources: { type: 'integer' },
            provider: { type: 'string' },
        }, ['query']),
    },
    {
        name: 'research.fetch',
        description: 'Fetch and extract content from a URL for research purposes.',
        inputSchema: objectSchema({
            url: { type: 'string' },
            selector: { type: 'string' },
        }, ['url']),
    },
    {
        name: 'research.synthesize',
        description: 'Synthesize multiple sources into a coherent answer.',
        inputSchema: objectSchema({
            topic: { type: 'string' },
            sources: { type: 'array', items: objectSchema({ url: { type: 'string' }, content: { type: 'string' } }, ['content']) },
            provider: { type: 'string' },
        }, ['topic', 'sources']),
    },
    // ── MCP ecosystem ──────────────────────────────────────────────────────────
    {
        name: 'mcp.server_list',
        description: 'List registered external MCP servers.',
        inputSchema: objectSchema({}),
    },
    {
        name: 'mcp.server_register',
        description: 'Register an external MCP server.',
        inputSchema: objectSchema({
            serverId: { type: 'string' },
            command: { type: 'string' },
            args: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
        }, ['serverId', 'command']),
    },
    {
        name: 'mcp.server_unregister',
        description: 'Unregister an external MCP server.',
        inputSchema: objectSchema({ serverId: { type: 'string' } }, ['serverId']),
    },
    {
        name: 'mcp.tools_list',
        description: 'List all available tools on this MCP server.',
        inputSchema: objectSchema({ prefix: { type: 'string' } }),
    },
    {
        name: 'mcp.tools_discover',
        description: 'Discover tools matching a search query.',
        inputSchema: objectSchema({ query: { type: 'string' } }, ['query']),
    },
    // ── Design (architecture guidance) ────────────────────────────────────────
    {
        name: 'design.api',
        description: 'Generate an API design for a given domain and requirements.',
        inputSchema: objectSchema({
            domain: { type: 'string' },
            requirements: { type: 'string' },
            style: { type: 'string', enum: ['rest', 'rpc', 'graphql', 'event'] },
        }, ['domain', 'requirements']),
    },
    {
        name: 'design.architecture',
        description: 'Generate an architecture design for a given system description.',
        inputSchema: objectSchema({
            system: { type: 'string' },
            constraints: { type: 'string' },
            pattern: { type: 'string' },
        }, ['system']),
    },
    {
        name: 'design.component',
        description: 'Generate a component design specification.',
        inputSchema: objectSchema({
            name: { type: 'string' },
            purpose: { type: 'string' },
            dependencies: { type: 'array', items: { type: 'string' } },
        }, ['name', 'purpose']),
    },
    {
        name: 'design.schema',
        description: 'Generate a data schema for a given domain entity.',
        inputSchema: objectSchema({
            entity: { type: 'string' },
            fields: { type: 'string' },
            constraints: { type: 'string' },
        }, ['entity']),
    },
    {
        name: 'design.list',
        description: 'List stored design artifacts.',
        inputSchema: objectSchema({ domain: { type: 'string' } }),
    },
];
export function createMcpStdioServer(config = {}) {
    const surface = createMcpServerSurface({
        runtimeService: config.runtimeService,
        dashboardService: config.dashboardService,
        basePath: config.basePath,
        toolPrefix: config.toolPrefix,
    });
    const input = config.input ?? process.stdin;
    const output = config.output ?? process.stdout;
    const rateLimiter = createRateLimiter(config.rateLimit);
    let rl;
    let shuttingDown = false;
    function send(response) {
        output.write(`${JSON.stringify(response)}\n`);
    }
    function sendError(id, code, message, data) {
        const response = { jsonrpc: '2.0', id, error: { code, message } };
        if (data !== undefined) {
            response.error.data = data;
        }
        send(response);
    }
    function buildToolDefinitions() {
        return surface.listToolDefinitions();
    }
    async function handleRequest(request) {
        const { id, method, params } = request;
        try {
            if (shuttingDown && method !== 'shutdown') {
                sendError(id, RPC_SERVER_SHUTTING_DOWN, 'Server is shutting down');
                return;
            }
            if (isRateLimitedMethod(method) && !rateLimiter.allow()) {
                sendError(id, RPC_RATE_LIMITED, `Rate limit exceeded: max ${rateLimiter.maxRequests} requests per ${rateLimiter.windowMs}ms`);
                return;
            }
            switch (method) {
                case 'initialize': {
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            protocolVersion: MCP_VERSION,
                            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
                            capabilities: {
                                tools: { listChanged: false },
                                resources: { listChanged: false, subscribe: false },
                                prompts: { listChanged: false },
                            },
                        },
                    });
                    break;
                }
                case 'notifications/initialized':
                    break;
                case 'tools/list': {
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: { tools: buildToolDefinitions() },
                    });
                    break;
                }
                case 'tools/call': {
                    const toolName = params?.name;
                    if (typeof toolName !== 'string' || toolName.length === 0) {
                        sendError(id, RPC_INVALID_PARAMS, 'tools/call requires params.name');
                        break;
                    }
                    const toolArgs = isRecord(params?.arguments) ? params.arguments : {};
                    const result = await surface.invokeTool(toolName, toolArgs);
                    if (result.success) {
                        send({
                            jsonrpc: '2.0',
                            id,
                            result: {
                                content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
                            },
                        });
                    }
                    else {
                        send({
                            jsonrpc: '2.0',
                            id,
                            result: {
                                content: [{ type: 'text', text: result.error ?? 'Tool failed' }],
                                isError: true,
                            },
                        });
                    }
                    break;
                }
                case 'resources/list': {
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: { resources: surface.listResources() },
                    });
                    break;
                }
                case 'resources/read': {
                    const uri = params?.uri;
                    if (typeof uri !== 'string' || uri.length === 0) {
                        sendError(id, RPC_INVALID_PARAMS, 'resources/read requires params.uri');
                        break;
                    }
                    const content = await surface.readResource(uri);
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: { contents: [content] },
                    });
                    break;
                }
                case 'prompts/list': {
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: { prompts: surface.listPrompts() },
                    });
                    break;
                }
                case 'prompts/get': {
                    const name = params?.name;
                    if (typeof name !== 'string' || name.length === 0) {
                        sendError(id, RPC_INVALID_PARAMS, 'prompts/get requires params.name');
                        break;
                    }
                    const prompt = await surface.getPrompt(name, isRecord(params?.arguments) ? params.arguments : {});
                    send({
                        jsonrpc: '2.0',
                        id,
                        result: prompt,
                    });
                    break;
                }
                case 'shutdown': {
                    shuttingDown = true;
                    send({ jsonrpc: '2.0', id, result: {} });
                    queueMicrotask(() => rl?.close());
                    break;
                }
                case 'ping': {
                    send({ jsonrpc: '2.0', id, result: {} });
                    break;
                }
                default:
                    sendError(id, RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
            }
        }
        catch (error) {
            sendError(id, RPC_INTERNAL_ERROR, error instanceof Error ? error.message : String(error));
        }
    }
    return {
        serve() {
            return new Promise((resolve) => {
                rl = createInterface({ input, terminal: false });
                const pending = [];
                rl.on('line', (line) => {
                    const trimmed = line.trim();
                    if (trimmed.length === 0) {
                        return;
                    }
                    let request;
                    try {
                        request = JSON.parse(trimmed);
                    }
                    catch {
                        sendError(null, -32700, 'Parse error');
                        return;
                    }
                    pending.push(handleRequest(request));
                });
                rl.on('close', () => {
                    void Promise.all(pending).then(() => { resolve(); });
                });
            });
        },
    };
}
export function createMcpServerSurface(config = {}) {
    const basePath = config.basePath ?? process.cwd();
    const runtimeService = config.runtimeService ?? createSharedRuntimeService({ basePath });
    const dashboardService = config.dashboardService ?? createDashboardService({
        traceStore: runtimeService.getStores().traceStore,
    });
    // ── In-process timer state ────────────────────────────────────────────────
    const timerStore = new Map(); // name → startTime ms
    const namedQueues = new Map();
    const mcpServerRegistry = new Map();
    const designArtifacts = [];
    const taskQueue = new Map();
    const metricsStore = new Map();
    function recordMetric(name, value, tags) {
        const samples = metricsStore.get(name) ?? [];
        samples.push({ ts: new Date().toISOString(), value, tags });
        metricsStore.set(name, samples);
    }
    const requestedToolPrefix = resolveToolPrefix(config.toolPrefix);
    const aliasDefinitions = requestedToolPrefix === undefined
        ? []
        : TOOL_DEFINITIONS.map((definition) => ({
            ...definition,
            name: toPrefixedToolName(definition.name, requestedToolPrefix),
            description: `${definition.description} Alias for ${definition.name}.`,
        }));
    const toolDefinitions = [...TOOL_DEFINITIONS, ...aliasDefinitions];
    const canonicalToolDefinitionMap = new Map(TOOL_DEFINITIONS.map((definition) => [definition.name, definition]));
    const aliasToCanonicalMap = new Map();
    for (const definition of TOOL_DEFINITIONS) {
        aliasToCanonicalMap.set(toPrefixedToolName(definition.name, DEFAULT_TOOL_PREFIX), definition.name);
        if (requestedToolPrefix !== undefined) {
            aliasToCanonicalMap.set(toPrefixedToolName(definition.name, requestedToolPrefix), definition.name);
        }
    }
    return {
        listTools() {
            return toolDefinitions.map((definition) => definition.name);
        },
        listToolDefinitions() {
            return toolDefinitions.map((definition) => ({ ...definition }));
        },
        listResources() {
            return [
                {
                    uri: RESOURCE_URIS.workspaceConfig,
                    name: 'Workspace Config',
                    description: 'The local AutomatosX workspace configuration file.',
                    mimeType: 'application/json',
                },
                {
                    uri: RESOURCE_URIS.workspaceMcp,
                    name: 'Local MCP Config',
                    description: 'The local AutomatosX MCP metadata file.',
                    mimeType: 'application/json',
                },
                {
                    uri: RESOURCE_URIS.workspaceContext,
                    name: 'Project AX Context',
                    description: 'The AX.md project context file written by ax init.',
                    mimeType: 'text/markdown',
                },
                {
                    uri: RESOURCE_URIS.workflowCatalog,
                    name: 'Workflow Catalog',
                    description: 'Shared-runtime view of discovered workflows.',
                    mimeType: 'application/json',
                },
                {
                    uri: RESOURCE_URIS.recentTraces,
                    name: 'Recent Traces',
                    description: 'Recent trace summary from the shared trace store.',
                    mimeType: 'application/json',
                },
            ];
        },
        async readResource(uri) {
            switch (uri) {
                case RESOURCE_URIS.workspaceConfig:
                    return {
                        uri,
                        mimeType: 'application/json',
                        text: await readWorkspaceFile(join(basePath, '.automatosx', 'config.json')),
                    };
                case RESOURCE_URIS.workspaceMcp:
                    return {
                        uri,
                        mimeType: 'application/json',
                        text: await readWorkspaceFile(join(basePath, '.automatosx', 'mcp.json')),
                    };
                case RESOURCE_URIS.workspaceContext:
                    return {
                        uri,
                        mimeType: 'text/markdown',
                        text: await readWorkspaceFile(join(basePath, 'AX.md')),
                    };
                case RESOURCE_URIS.workflowCatalog:
                    return {
                        uri,
                        mimeType: 'application/json',
                        text: `${JSON.stringify(await runtimeService.listWorkflows({ basePath }), null, 2)}\n`,
                    };
                case RESOURCE_URIS.recentTraces:
                    return {
                        uri,
                        mimeType: 'application/json',
                        text: `${JSON.stringify(await runtimeService.listTraces(10), null, 2)}\n`,
                    };
                default:
                    throw new Error(`Unknown resource: ${uri}`);
            }
        },
        listPrompts() {
            return PROMPT_DEFINITIONS.map((prompt) => ({
                ...prompt,
                arguments: prompt.arguments?.map((argument) => ({ ...argument })),
            }));
        },
        async getPrompt(name, args = {}) {
            switch (name) {
                case 'workflow.run': {
                    const workflowId = asString(args.workflowId, 'workflowId');
                    const goal = asString(args.goal, 'goal');
                    return {
                        description: 'Prompt a client to run a v14 workflow with explicit runtime context.',
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: [
                                        `Run workflow "${workflowId}" through the v14 shared runtime.`,
                                        `Goal: ${goal}`,
                                        'Use the workflow.run tool and pass a structured input object.',
                                    ].join('\n'),
                                },
                            },
                        ],
                    };
                }
                case 'workflow.architect': {
                    const requirement = asString(args.requirement, 'requirement');
                    return {
                        description: 'Prompt a client to plan architecture work through the architect workflow.',
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: [
                                        'Prepare an architecture plan using the architect workflow.',
                                        `Requirement: ${requirement}`,
                                        'Include decision framing, boundaries, risks, and implementation sequencing.',
                                    ].join('\n'),
                                },
                            },
                        ],
                    };
                }
                case 'review.analyze': {
                    const paths = asString(args.paths, 'paths');
                    const focus = asOptionalString(args.focus) ?? 'all';
                    return {
                        description: 'Prompt a client to run a deterministic v14 review.',
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: [
                                        'Run a deterministic review with the v14 review surface.',
                                        `Paths: ${paths}`,
                                        `Focus: ${focus}`,
                                        'Persist findings and review artifacts.',
                                    ].join('\n'),
                                },
                            },
                        ],
                    };
                }
                case 'discuss.synthesize': {
                    const topic = asString(args.topic, 'topic');
                    const providers = asOptionalString(args.providers) ?? 'default providers';
                    const context = asOptionalString(args.context);
                    return {
                        description: 'Prompt a client to run a top-level multi-provider discussion.',
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: [
                                        'Run a v14 discussion and synthesize the result.',
                                        `Topic: ${topic}`,
                                        `Providers: ${providers}`,
                                        context === undefined ? undefined : `Context: ${context}`,
                                    ].filter((line) => line !== undefined).join('\n'),
                                },
                            },
                        ],
                    };
                }
                default:
                    throw new Error(`Unknown prompt: ${name}`);
            }
        },
        async invokeTool(toolName, args = {}) {
            try {
                const canonicalToolName = aliasToCanonicalMap.get(toolName) ?? toolName;
                const definition = canonicalToolDefinitionMap.get(canonicalToolName);
                if (definition === undefined) {
                    return {
                        success: false,
                        error: `Unknown tool: ${toolName}`,
                    };
                }
                const validationError = validateInput(args, definition.inputSchema);
                if (validationError !== undefined) {
                    return {
                        success: false,
                        error: validationError,
                    };
                }
                switch (canonicalToolName) {
                    case 'workflow.run':
                        return {
                            success: true,
                            data: await runtimeService.runWorkflow({
                                workflowId: asString(args.workflowId, 'workflowId'),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                workflowDir: asOptionalString(args.workflowDir),
                                basePath: asOptionalString(args.basePath),
                                provider: asOptionalString(args.provider),
                                input: asInput(args.input),
                                surface: 'mcp',
                            }),
                        };
                    case 'workflow.list':
                        return {
                            success: true,
                            data: await runtimeService.listWorkflows({
                                workflowDir: asOptionalString(args.workflowDir),
                                basePath: asOptionalString(args.basePath),
                            }),
                        };
                    case 'workflow.describe':
                        return {
                            success: true,
                            data: await runtimeService.describeWorkflow({
                                workflowId: asString(args.workflowId, 'workflowId'),
                                workflowDir: asOptionalString(args.workflowDir),
                                basePath: asOptionalString(args.basePath),
                            }),
                        };
                    case 'trace.get':
                        return {
                            success: true,
                            data: await runtimeService.getTrace(asString(args.traceId, 'traceId')),
                        };
                    case 'trace.list':
                        return {
                            success: true,
                            data: await runtimeService.listTraces(asOptionalNumber(args.limit)),
                        };
                    case 'trace.analyze':
                        return {
                            success: true,
                            data: await runtimeService.analyzeTrace(asString(args.traceId, 'traceId')),
                        };
                    case 'trace.by_session':
                        return {
                            success: true,
                            data: await runtimeService.listTracesBySession(asString(args.sessionId, 'sessionId'), asOptionalNumber(args.limit)),
                        };
                    case 'trace.close_stuck':
                        return {
                            success: true,
                            data: await runtimeService.closeStuckTraces(asOptionalNumber(args.maxAgeMs)),
                        };
                    case 'trace.tree':
                        return {
                            success: true,
                            data: await runtimeService.getTraceTree(asString(args.traceId, 'traceId')),
                        };
                    case 'agent.register':
                        return {
                            success: true,
                            data: await runtimeService.registerAgent({
                                agentId: asString(args.agentId, 'agentId'),
                                name: asString(args.name, 'name'),
                                capabilities: asStringArray(args.capabilities),
                                metadata: isRecord(args.metadata) ? args.metadata : undefined,
                            }),
                        };
                    case 'agent.get':
                        return {
                            success: true,
                            data: await runtimeService.getAgent(asString(args.agentId, 'agentId')),
                        };
                    case 'agent.list':
                        return {
                            success: true,
                            data: await runtimeService.listAgents(),
                        };
                    case 'agent.remove':
                        return {
                            success: true,
                            data: { removed: await runtimeService.removeAgent(asString(args.agentId, 'agentId')) },
                        };
                    case 'agent.capabilities':
                        return {
                            success: true,
                            data: await runtimeService.listAgentCapabilities(),
                        };
          case 'agent.run':
            return {
              success: true,
              data: await runtimeService.runAgent({
                agentId: asString(args.agentId, 'agentId'),
                task: asOptionalString(args.task),
                input: isRecord(args.input) ? args.input : undefined,
                traceId: asOptionalString(args.traceId),
                sessionId: asOptionalString(args.sessionId),
                basePath: asOptionalString(args.basePath),
                provider: asOptionalString(args.provider),
                model: asOptionalString(args.model),
                timeoutMs: asOptionalNumber(args.timeoutMs),
                parentTraceId: asOptionalString(args.parentTraceId),
                rootTraceId: asOptionalString(args.rootTraceId),
                                surface: 'mcp',
                            }),
                        };
                    case 'agent.recommend':
                        return {
                            success: true,
                            data: await runtimeService.recommendAgents({
                                task: asString(args.task, 'task'),
                                requiredCapabilities: asStringArray(args.requiredCapabilities),
                                limit: asOptionalNumber(args.limit),
                                team: asOptionalString(args.team),
                            }),
                        };
                    case 'discuss.run':
                        return {
                            success: true,
                            data: await runtimeService.runDiscussion({
                                topic: asString(args.topic, 'topic'),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                basePath: asOptionalString(args.basePath),
                                provider: asOptionalString(args.provider),
                                surface: 'mcp',
                                pattern: asOptionalString(args.pattern),
                                rounds: asOptionalNumber(args.rounds),
                                providers: asStringArray(args.providers),
                                consensusMethod: asOptionalString(args.consensusMethod),
                                context: asOptionalString(args.context),
                                minProviders: asOptionalNumber(args.minProviders),
                                verbose: typeof args.verbose === 'boolean' ? args.verbose : undefined,
                            }),
                        };
                    case 'discuss.quick':
                        return {
                            success: true,
                            data: await runtimeService.runDiscussionQuick({
                                topic: asString(args.topic, 'topic'),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                basePath: asOptionalString(args.basePath),
                                provider: asOptionalString(args.provider),
                                surface: 'mcp',
                                pattern: asOptionalString(args.pattern),
                                providers: asStringArray(args.providers),
                                consensusMethod: asOptionalString(args.consensusMethod),
                                context: asOptionalString(args.context),
                                minProviders: asOptionalNumber(args.minProviders),
                                verbose: typeof args.verbose === 'boolean' ? args.verbose : undefined,
                            }),
                        };
                    case 'discuss.recursive':
                        return {
                            success: true,
                            data: await runtimeService.runDiscussionRecursive({
                                topic: asString(args.topic, 'topic'),
                                subtopics: (() => { const v = asStringArray(args.subtopics); if (!v || v.length === 0)
                                    throw new Error('subtopics is required and must be a non-empty array'); return v; })(),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                basePath: asOptionalString(args.basePath),
                                provider: asOptionalString(args.provider),
                                surface: 'mcp',
                                pattern: asOptionalString(args.pattern),
                                rounds: asOptionalNumber(args.rounds),
                                providers: asStringArray(args.providers),
                                consensusMethod: asOptionalString(args.consensusMethod),
                                context: asOptionalString(args.context),
                                minProviders: asOptionalNumber(args.minProviders),
                                verbose: typeof args.verbose === 'boolean' ? args.verbose : undefined,
                            }),
                        };
                    case 'session.create':
                        return {
                            success: true,
                            data: await runtimeService.createSession({
                                sessionId: asOptionalString(args.sessionId),
                                task: asString(args.task, 'task'),
                                initiator: asString(args.initiator, 'initiator'),
                                workspace: asOptionalString(args.workspace),
                                metadata: isRecord(args.metadata) ? args.metadata : undefined,
                            }),
                        };
                    case 'session.get':
                        return {
                            success: true,
                            data: await runtimeService.getSession(asString(args.sessionId, 'sessionId')),
                        };
                    case 'session.list':
                        return {
                            success: true,
                            data: await runtimeService.listSessions(),
                        };
                    case 'session.join':
                        return {
                            success: true,
                            data: await runtimeService.joinSession({
                                sessionId: asString(args.sessionId, 'sessionId'),
                                agentId: asString(args.agentId, 'agentId'),
                                role: asOptionalRole(args.role),
                            }),
                        };
                    case 'session.leave':
                        return {
                            success: true,
                            data: await runtimeService.leaveSession(asString(args.sessionId, 'sessionId'), asString(args.agentId, 'agentId')),
                        };
                    case 'session.complete':
                        return {
                            success: true,
                            data: await runtimeService.completeSession(asString(args.sessionId, 'sessionId'), asOptionalString(args.summary)),
                        };
                    case 'session.fail':
                        return {
                            success: true,
                            data: await runtimeService.failSession(asString(args.sessionId, 'sessionId'), asString(args.message, 'message')),
                        };
                    case 'session.close_stuck':
                        return {
                            success: true,
                            data: await runtimeService.closeStuckSessions(asOptionalNumber(args.maxAgeMs)),
                        };
                    case 'review.analyze':
                        return {
                            success: true,
                            data: await runtimeService.analyzeReview({
                                paths: asStringArray(args.paths) ?? [],
                                focus: asOptionalReviewFocus(args.focus),
                                maxFiles: asOptionalNumber(args.maxFiles),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                basePath: asOptionalString(args.basePath),
                                surface: 'mcp',
                            }),
                        };
                    case 'review.list':
                        return {
                            success: true,
                            data: await runtimeService.listReviewTraces(asOptionalNumber(args.limit)),
                        };
                    case 'memory.retrieve':
                        return {
                            success: true,
                            data: await runtimeService.getMemory(asString(args.key, 'key'), asOptionalString(args.namespace)),
                        };
                    case 'memory.search':
                        return {
                            success: true,
                            data: await runtimeService.searchMemory(asString(args.query, 'query'), asOptionalString(args.namespace)),
                        };
                    case 'memory.delete':
                        return {
                            success: true,
                            data: { deleted: await runtimeService.deleteMemory(asString(args.key, 'key'), asOptionalString(args.namespace)) },
                        };
                    case 'memory.store':
                        return {
                            success: true,
                            data: await runtimeService.storeMemory({
                                key: asString(args.key, 'key'),
                                namespace: asOptionalString(args.namespace),
                                value: args.value,
                            }),
                        };
                    case 'memory.list':
                        return {
                            success: true,
                            data: await runtimeService.listMemory(asOptionalString(args.namespace)),
                        };
                    case 'semantic.store':
                        return {
                            success: true,
                            data: await runtimeService.storeSemantic({
                                key: asString(args.key, 'key'),
                                namespace: asOptionalString(args.namespace),
                                content: asString(args.content, 'content'),
                                tags: asStringArray(args.tags),
                                metadata: isRecord(args.metadata) ? args.metadata : undefined,
                            }),
                        };
                    case 'semantic.search':
                        return {
                            success: true,
                            data: await runtimeService.searchSemantic(asString(args.query, 'query'), {
                                namespace: asOptionalString(args.namespace),
                                filterTags: asStringArray(args.filterTags),
                                topK: asOptionalNumber(args.topK),
                                minSimilarity: asOptionalFloat(args.minSimilarity),
                            }),
                        };
                    case 'semantic.get':
                        return {
                            success: true,
                            data: await runtimeService.getSemantic(asString(args.key, 'key'), asOptionalString(args.namespace)),
                        };
                    case 'semantic.list':
                        return {
                            success: true,
                            data: await runtimeService.listSemantic({
                                namespace: asOptionalString(args.namespace),
                                keyPrefix: asOptionalString(args.keyPrefix),
                                filterTags: asStringArray(args.filterTags),
                                limit: asOptionalNumber(args.limit),
                            }),
                        };
                    case 'semantic.delete':
                        return {
                            success: true,
                            data: { deleted: await runtimeService.deleteSemantic(asString(args.key, 'key'), asOptionalString(args.namespace)) },
                        };
                    case 'semantic.stats':
                        return {
                            success: true,
                            data: await runtimeService.semanticStats(asOptionalString(args.namespace)),
                        };
                    case 'semantic.clear':
                        if (args.confirm !== true) {
                            throw new Error('semantic.clear requires confirm=true');
                        }
                        return {
                            success: true,
                            data: { cleared: await runtimeService.clearSemantic(asString(args.namespace, 'namespace')) },
                        };
                    case 'feedback.submit':
                        return {
                            success: true,
                            data: await runtimeService.submitFeedback({
                                selectedAgent: asString(args.selectedAgent, 'selectedAgent'),
                                recommendedAgent: asOptionalString(args.recommendedAgent),
                                rating: asOptionalNumber(args.rating),
                                feedbackType: asOptionalString(args.feedbackType),
                                taskDescription: asString(args.taskDescription, 'taskDescription'),
                                userComment: asOptionalString(args.userComment),
                                outcome: asOptionalString(args.outcome),
                                durationMs: asOptionalNumber(args.durationMs),
                                sessionId: asOptionalString(args.sessionId),
                                metadata: isRecord(args.metadata) ? args.metadata : undefined,
                            }),
                        };
                    case 'feedback.history':
                        return {
                            success: true,
                            data: await runtimeService.listFeedbackHistory({
                                agentId: asOptionalString(args.agentId),
                                limit: asOptionalNumber(args.limit),
                                since: asOptionalString(args.since),
                            }),
                        };
                    case 'feedback.stats':
                        return {
                            success: true,
                            data: await runtimeService.getFeedbackStats(asString(args.agentId, 'agentId')),
                        };
                    case 'feedback.overview':
                        return {
                            success: true,
                            data: await runtimeService.getFeedbackOverview(),
                        };
                    case 'feedback.adjustments':
                        return {
                            success: true,
                            data: await runtimeService.getFeedbackAdjustments(asString(args.agentId, 'agentId')),
                        };
                    case 'ability.list':
                        return {
                            success: true,
                            data: await runtimeService.listAbilities({
                                category: asOptionalString(args.category),
                                tags: asStringArray(args.tags),
                            }),
                        };
                    case 'ability.inject':
                        return {
                            success: true,
                            data: await runtimeService.injectAbilities({
                                task: asString(args.task, 'task'),
                                requiredAbilities: asStringArray(args.requiredAbilities),
                                category: asOptionalString(args.category),
                                tags: asStringArray(args.tags),
                                maxAbilities: asOptionalNumber(args.maxAbilities),
                                includeMetadata: typeof args.includeMetadata === 'boolean' ? args.includeMetadata : undefined,
                            }),
                        };
                    case 'config.get':
                        return {
                            success: true,
                            data: await runtimeService.getConfig(asString(args.path, 'path')),
                        };
                    case 'config.set':
                        return {
                            success: true,
                            data: await runtimeService.setConfig(asString(args.path, 'path'), args.value),
                        };
                    case 'config.show':
                        return {
                            success: true,
                            data: await runtimeService.showConfig(),
                        };
            case 'file.exists':
                return {
                    success: true,
                    data: {
                        exists: await pathExists(resolveWorkspacePath(asOptionalString(args.basePath) ?? basePath, asString(args.path, 'path'))),
                    },
                };
            case 'file.write': {
                const filePath = resolveWorkspacePath(asOptionalString(args.basePath) ?? basePath, asString(args.path, 'path'));
                        const overwrite = typeof args.overwrite === 'boolean' ? args.overwrite : false;
                        const createDirectories = typeof args.createDirectories === 'boolean' ? args.createDirectories : false;
                        if (!overwrite && await pathExists(filePath)) {
                            throw new Error(`File already exists: ${asString(args.path, 'path')}`);
                        }
                        if (createDirectories) {
                            await mkdir(dirname(filePath), { recursive: true });
                        }
                        await writeFile(filePath, asString(args.content, 'content'), 'utf8');
                        return {
                            success: true,
                            data: { path: filePath, written: true },
                        };
            }
            case 'directory.create': {
                const directoryPath = resolveWorkspacePath(asOptionalString(args.basePath) ?? basePath, asString(args.path, 'path'));
                await mkdir(directoryPath, { recursive: typeof args.recursive === 'boolean' ? args.recursive : true });
                        return {
                            success: true,
                            data: { path: directoryPath, created: true },
                        };
                    }
                    case 'git.status':
                        return {
                            success: true,
                            data: await runtimeService.gitStatus({
                                basePath: asOptionalString(args.basePath),
                            }),
                        };
                    case 'git.diff':
                        return {
                            success: true,
                            data: await runtimeService.gitDiff({
                                basePath: asOptionalString(args.basePath),
                                paths: asStringArray(args.paths),
                                staged: typeof args.staged === 'boolean' ? args.staged : undefined,
                                commit: asOptionalString(args.commit),
                                stat: typeof args.stat === 'boolean' ? args.stat : undefined,
                            }),
                        };
                    case 'commit.prepare':
                        return {
                            success: true,
                            data: await runtimeService.commitPrepare({
                                basePath: asOptionalString(args.basePath),
                                paths: asStringArray(args.paths),
                                stageAll: typeof args.stageAll === 'boolean' ? args.stageAll : undefined,
                                type: asOptionalString(args.type),
                                scope: asOptionalString(args.scope),
                            }),
                        };
                    case 'pr.review':
                        return {
                            success: true,
                            data: await runtimeService.reviewPullRequest({
                                basePath: asOptionalString(args.basePath),
                                base: asOptionalString(args.base),
                                head: asOptionalString(args.head),
                            }),
                        };
                    case 'pr.create':
                        return {
                            success: true,
                            data: await runtimeService.createPullRequest({
                                title: asString(args.title, 'title'),
                                body: asOptionalString(args.body),
                                base: asOptionalString(args.base),
                                head: asOptionalString(args.head),
                                draft: typeof args.draft === 'boolean' ? args.draft : undefined,
                                basePath: asOptionalString(args.basePath),
                            }),
                        };
                    case 'guard.list':
                        return {
                            success: true,
                            data: await runtimeService.listGuardPolicies(),
                        };
                    case 'guard.apply':
                        return {
                            success: true,
                            data: await runtimeService.applyGuardPolicy({
                                policyId: asOptionalString(args.policyId),
                                definition: isRecord(args.definition) ? args.definition : undefined,
                                enabled: typeof args.enabled === 'boolean' ? args.enabled : undefined,
                            }),
                        };
                    case 'guard.check':
                        return {
                            success: true,
                            data: await runtimeService.checkGuards({
                                policyId: asOptionalString(args.policyId),
                                position: args.position === 'after' ? 'after' : 'before',
                                agentId: asOptionalString(args.agentId),
                                executionId: asOptionalString(args.executionId),
                                sessionId: asOptionalString(args.sessionId),
                                workflowId: asOptionalString(args.workflowId),
                                stepId: asString(args.stepId, 'stepId'),
                                stepType: asString(args.stepType, 'stepType'),
                                stepIndex: asOptionalNumber(args.stepIndex),
                                totalSteps: asOptionalNumber(args.totalSteps),
                                previousOutputs: isRecord(args.previousOutputs) ? args.previousOutputs : undefined,
                                stepConfig: isRecord(args.stepConfig) ? args.stepConfig : undefined,
                            }),
                        };
                    case 'policy.register':
                        return {
                            success: true,
                            data: await runtimeService.registerPolicy({
                                policyId: asString(args.policyId, 'policyId'),
                                name: asString(args.name, 'name'),
                                enabled: typeof args.enabled === 'boolean' ? args.enabled : true,
                                metadata: isRecord(args.metadata) ? args.metadata : undefined,
                            }),
                        };
                    case 'policy.list':
                        return {
                            success: true,
                            data: await runtimeService.listPolicies(),
                        };
                    case 'dashboard.list':
                        return {
                            success: true,
                            data: await dashboardService.listWorkflowExecutions(asOptionalNumber(args.limit)),
                        };
                    case 'parallel.plan':
                        return {
                            success: true,
                            data: await runtimeService.planParallel({
                                tasks: asParallelTasks(args.tasks),
                            }),
                        };
                    case 'parallel.run':
                        return {
                            success: true,
                            data: await runtimeService.runParallel({
                                tasks: asParallelTasks(args.tasks),
                                traceId: asOptionalString(args.traceId),
                                sessionId: asOptionalString(args.sessionId),
                                maxConcurrent: asOptionalNumber(args.maxConcurrent),
                                failureStrategy: asParallelFailureStrategy(args.failureStrategy),
                                resultAggregation: asParallelAggregation(args.resultAggregation),
                                surface: 'mcp',
                            }),
                        };
                    // ── Ability registry ───────────────────────────────────────────
                    case 'ability.get': {
                        const abilityId = asString(args.abilityId, 'abilityId');
                        const entry = await runtimeService.getSemantic(abilityId, 'ax.abilities');
                        if (entry === undefined)
                            return { success: false, error: `Ability "${abilityId}" not found` };
                        return { success: true, data: entry.metadata ?? { abilityId, content: entry.content } };
                    }
                    case 'ability.register': {
                        const abilityId = asString(args.abilityId, 'abilityId');
                        const entry = await runtimeService.storeSemantic({
                            key: abilityId,
                            namespace: 'ax.abilities',
                            content: asString(args.content, 'content'),
                            tags: asStringArray(args.tags) ?? [],
                            metadata: {
                                abilityId,
                                displayName: asString(args.displayName, 'displayName'),
                                description: asString(args.description, 'description'),
                                category: asOptionalString(args.category),
                                enabled: typeof args.enabled === 'boolean' ? args.enabled : true,
                                registeredAt: new Date().toISOString(),
                            },
                        });
                        return { success: true, data: entry };
                    }
                    case 'ability.remove': {
                        const abilityId = asString(args.abilityId, 'abilityId');
                        const removed = await runtimeService.deleteSemantic(abilityId, 'ax.abilities');
                        return { success: true, data: { abilityId, removed } };
                    }
                    // ── Memory import/export ────────────────────────────────────────
                    case 'memory.export': {
                        const entries = await runtimeService.listMemory(asOptionalString(args.namespace));
                        return { success: true, data: { entries, count: entries.length } };
                    }
                    case 'memory.import': {
                        const rawEntries = Array.isArray(args.entries) ? args.entries : [];
                        const overwrite = args.overwrite === true;
                        let imported = 0;
                        let skipped = 0;
                        for (const e of rawEntries) {
                            const key = asOptionalString(e['key']);
                            if (key === undefined) {
                                skipped++;
                                continue;
                            }
                            if (!overwrite) {
                                const existing = await runtimeService.getMemory(key, asOptionalString(e['namespace']));
                                if (existing !== undefined) {
                                    skipped++;
                                    continue;
                                }
                            }
                            await runtimeService.storeMemory({ key, namespace: asOptionalString(e['namespace']), value: e['value'] });
                            imported++;
                        }
                        return { success: true, data: { imported, skipped } };
                    }
                    // ── Timers ──────────────────────────────────────────────────────
                    case 'timer.start': {
                        const name = asString(args.name, 'name');
                        timerStore.set(name, Date.now());
                        return { success: true, data: { name, startedAt: new Date().toISOString() } };
                    }
                    case 'timer.stop': {
                        const name = asString(args.name, 'name');
                        const start = timerStore.get(name);
                        if (start === undefined)
                            return { success: false, error: `Timer "${name}" not found` };
                        const elapsedMs = Date.now() - start;
                        timerStore.delete(name);
                        return { success: true, data: { name, elapsedMs } };
                    }
                    // ── Named queues ────────────────────────────────────────────────
                    case 'queue.create': {
                        const queueId = asString(args.queueId, 'queueId');
                        if (namedQueues.has(queueId))
                            return { success: false, error: `Queue "${queueId}" already exists` };
                        const q = { queueId, maxSize: asOptionalNumber(args.maxSize) ?? 1000, items: [], createdAt: new Date().toISOString() };
                        namedQueues.set(queueId, q);
                        return { success: true, data: { queueId, maxSize: q.maxSize } };
                    }
                    case 'queue.list':
                        return { success: true, data: { queues: [...namedQueues.values()].map((q) => ({ queueId: q.queueId, size: q.items.length, maxSize: q.maxSize, createdAt: q.createdAt })) } };
                    // ── Research ────────────────────────────────────────────────────
          case 'research.query': {
            const query = asString(args.query, 'query');
            const result = await runtimeService.callProvider({
                provider: asOptionalString(args.provider),
                prompt: `Research query: ${query}\n\nProvide a thorough, sourced answer with key findings and confidence assessment.`,
                systemPrompt: 'You are a research assistant. Provide accurate, well-structured answers with clear confidence indicators.',
                maxTokens: 2000,
            });
            return { success: true, data: { query, answer: result.content, provider: result.provider, timestamp: new Date().toISOString() } };
                    }
                    case 'research.fetch': {
                        const url = asString(args.url, 'url');
                        // Security: only allow http/https URLs
                        if (!/^https?:\/\//i.test(url))
                            return { success: false, error: 'Only http/https URLs are allowed' };
                        const { readFile: _rf } = await import('node:fs/promises');
                        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((e) => { throw new Error(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`); });
                        const text = await response.text();
                        const truncated = text.length > 8000 ? `${text.slice(0, 8000)}\n[truncated]` : text;
                        return { success: true, data: { url, content: truncated, status: response.status, contentType: response.headers.get('content-type') } };
                    }
          case 'research.synthesize': {
            const topic = asString(args.topic, 'topic');
            const sources = Array.isArray(args.sources) ? args.sources : [];
            const sourceSummary = sources.map((s, i) => `Source ${i + 1}: ${asOptionalString(s['content']) ?? ''}`).join('\n\n');
            const result = await runtimeService.callProvider({
                provider: asOptionalString(args.provider),
                prompt: `Synthesize the following sources on the topic: "${topic}"\n\n${sourceSummary}\n\nProvide a coherent synthesis with key insights.`,
                systemPrompt: 'You are a research synthesizer. Create clear, accurate syntheses that fairly represent all provided sources.',
                maxTokens: 2000,
            });
            return { success: true, data: { topic, synthesis: result.content, sourceCount: sources.length, provider: result.provider } };
                    }
                    // ── MCP ecosystem ───────────────────────────────────────────────
                    case 'mcp.server_list':
                        return { success: true, data: { servers: [...mcpServerRegistry.values()] } };
                    case 'mcp.server_register': {
                        const serverId = asString(args.serverId, 'serverId');
                        const rec = { serverId, command: asString(args.command, 'command'), args: asStringArray(args.args) ?? [], description: asOptionalString(args.description) ?? '', registeredAt: new Date().toISOString() };
                        mcpServerRegistry.set(serverId, rec);
                        return { success: true, data: rec };
                    }
                    case 'mcp.server_unregister': {
                        const serverId = asString(args.serverId, 'serverId');
                        const existed = mcpServerRegistry.delete(serverId);
                        return { success: true, data: { serverId, removed: existed } };
                    }
                    case 'mcp.tools_list': {
                        const prefix = asOptionalString(args.prefix);
                        const tools = toolDefinitions
                            .filter((t) => prefix === undefined || t.name.startsWith(prefix))
                            .map((t) => ({ name: t.name, description: t.description }));
                        return { success: true, data: { tools, count: tools.length } };
                    }
                    case 'mcp.tools_discover': {
                        const query = asString(args.query, 'query').toLowerCase();
                        const tools = toolDefinitions
                            .filter((t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query))
                            .map((t) => ({ name: t.name, description: t.description }));
                        return { success: true, data: { query, tools, count: tools.length } };
                    }
                    // ── Design ──────────────────────────────────────────────────────
                    case 'design.api':
                    case 'design.architecture':
                    case 'design.component':
                    case 'design.schema': {
                        const designType = canonicalToolName.split('.')[1];
                        const prompts = {
                            api: `Design a ${asOptionalString(args.style) ?? 'REST'} API for the "${asString(args.domain ?? args.name, 'domain')}" domain.\nRequirements: ${asString(args.requirements ?? args.purpose, 'requirements')}`,
                            architecture: `Design the architecture for: ${asString(args.system, 'system')}${args.constraints ? `\nConstraints: ${asString(args.constraints, 'constraints')}` : ''}${args.pattern ? `\nPreferred pattern: ${asString(args.pattern, 'pattern')}` : ''}`,
                            component: `Design the "${asString(args.name, 'name')}" component.\nPurpose: ${asString(args.purpose, 'purpose')}${args.dependencies ? `\nDependencies: ${(asStringArray(args.dependencies) ?? []).join(', ')}` : ''}`,
                            schema: `Design a data schema for "${asString(args.entity, 'entity')}".\nFields: ${asString(args.fields, 'fields')}${args.constraints ? `\nConstraints: ${asString(args.constraints, 'constraints')}` : ''}`,
                        };
                        const result = await runtimeService.callProvider({
                            prompt: prompts[designType] ?? `Design: ${JSON.stringify(args)}`,
                            systemPrompt: 'You are a senior software architect. Produce concise, opinionated design specifications with clear rationale.',
                            maxTokens: 2000,
                        });
                        const artifact = { type: designType, domain: asOptionalString(args.domain ?? args.entity ?? args.name) ?? 'unknown', content: result.content, createdAt: new Date().toISOString() };
                        designArtifacts.push(artifact);
                        return { success: true, data: { type: designType, design: result.content, provider: result.provider } };
                    }
                    case 'design.list': {
                        const domain = asOptionalString(args.domain);
                        const filtered = domain ? designArtifacts.filter((a) => a.domain === domain) : designArtifacts;
                        return { success: true, data: { artifacts: filtered, count: filtered.length } };
                    }
                    // ── Memory extras ──────────────────────────────────────────────
                    case 'memory.stats': {
                        const entries = await runtimeService.listMemory(asOptionalString(args.namespace));
                        const byNs = {};
                        for (const e of entries) {
                            const ns = e.namespace ?? 'default';
                            byNs[ns] = (byNs[ns] ?? 0) + 1;
                        }
                        return { success: true, data: { stats: Object.entries(byNs).map(([namespace, count]) => ({ namespace, count })) } };
                    }
                    case 'memory.clear': {
                        const ns = asString(args.namespace, 'namespace');
                        const entries = await runtimeService.listMemory(ns);
                        let deleted = 0;
                        for (const e of entries) {
                            if (await runtimeService.deleteMemory(e.key, ns))
                                deleted++;
                        }
                        return { success: true, data: { namespace: ns, deleted } };
                    }
                    case 'memory.bulk_delete': {
                        const keys = asStringArray(args.keys) ?? [];
                        const ns = asOptionalString(args.namespace);
                        let deleted = 0;
                        for (const k of keys) {
                            if (await runtimeService.deleteMemory(k, ns))
                                deleted++;
                        }
                        return { success: true, data: { deleted, requested: keys.length } };
                    }
                    // ── Telemetry / metrics ─────────────────────────────────────────
                    case 'metrics.record': {
                        const name = asString(args.name, 'name');
                        const value = typeof args.value === 'number' ? args.value : 0;
                        recordMetric(name, value, asStringArray(args.tags) ?? []);
                        return { success: true, data: { name, value } };
                    }
                    case 'metrics.increment': {
                        const name = asString(args.name, 'name');
                        const amount = typeof args.amount === 'number' ? args.amount : 1;
                        const existing = metricsStore.get(name) ?? [];
                        const prev = existing.length > 0 ? (existing[existing.length - 1]?.value ?? 0) : 0;
                        recordMetric(name, prev + amount, asStringArray(args.tags) ?? []);
                        return { success: true, data: { name, value: prev + amount } };
                    }
                    case 'metrics.list':
                        return { success: true, data: { metrics: [...metricsStore.keys()] } };
                    case 'metrics.query': {
                        const name = asString(args.name, 'name');
                        return { success: true, data: { name, samples: metricsStore.get(name) ?? [] } };
                    }
                    case 'telemetry.summary': {
                        const summary = {};
                        for (const [name, samples] of metricsStore) {
                            if (samples.length === 0)
                                continue;
                            const values = samples.map((s) => s.value);
                            const sum = values.reduce((a, b) => a + b, 0);
                            summary[name] = { count: samples.length, sum, avg: sum / samples.length, min: Math.min(...values), max: Math.max(...values) };
                        }
                        return { success: true, data: { summary } };
                    }
                    // ── Task queue ──────────────────────────────────────────────────
                    case 'task.submit': {
                        const taskId = asString(args.taskId, 'taskId');
                        if (taskQueue.has(taskId))
                            return { success: false, error: `Task "${taskId}" already exists` };
                        const now = new Date().toISOString();
                        const task = {
                            taskId, type: asString(args.type, 'type'),
                            payload: isRecord(args.payload) ? args.payload : {},
                            priority: typeof args.priority === 'number' ? args.priority : 0,
                            status: 'pending', createdAt: now, updatedAt: now,
                        };
                        taskQueue.set(taskId, task);
                        return { success: true, data: task };
                    }
                    case 'task.status': {
                        const taskId = asString(args.taskId, 'taskId');
                        const task = taskQueue.get(taskId);
                        if (task === undefined)
                            return { success: false, error: `Task "${taskId}" not found` };
                        return { success: true, data: task };
                    }
                    case 'task.list': {
                        const statusFilter = asOptionalString(args.status);
                        const limitN = asOptionalNumber(args.limit) ?? 50;
                        let tasks = [...taskQueue.values()];
                        if (statusFilter !== undefined)
                            tasks = tasks.filter((t) => t.status === statusFilter);
                        tasks.sort((a, b) => b.priority - a.priority);
                        return { success: true, data: { tasks: tasks.slice(0, limitN), total: tasks.length } };
                    }
                    case 'task.cancel': {
                        const taskId = asString(args.taskId, 'taskId');
                        const task = taskQueue.get(taskId);
                        if (task === undefined)
                            return { success: false, error: `Task "${taskId}" not found` };
                        if (task.status !== 'pending')
                            return { success: false, error: `Cannot cancel task with status "${task.status}"` };
                        task.status = 'cancelled';
                        task.updatedAt = new Date().toISOString();
                        return { success: true, data: task };
                    }
                    case 'task.retry': {
                        const taskId = asString(args.taskId, 'taskId');
                        const task = taskQueue.get(taskId);
                        if (task === undefined)
                            return { success: false, error: `Task "${taskId}" not found` };
                        if (task.status !== 'failed')
                            return { success: false, error: `Can only retry failed tasks, got status "${task.status}"` };
                        task.status = 'pending';
                        task.updatedAt = new Date().toISOString();
                        delete task.error;
                        return { success: true, data: task };
                    }
                    // ── Scaffold (MCP surface) ──────────────────────────────────────
                    case 'scaffold.contract':
                    case 'scaffold.domain':
                    case 'scaffold.guard': {
                        // Scaffold tools delegate to the shared scaffold utility
                        const subcommand = canonicalToolName.split('.')[1];
                        const nameArg = asOptionalString(args.name ?? args.policyId);
                        if (nameArg === undefined)
                            return { success: false, error: `scaffold.${subcommand}: "name" is required` };
                        const subArgs = [subcommand, nameArg];
                        if (args.description !== undefined)
                            subArgs.push('-d', asString(args.description, 'description'));
                        if (args.scope !== undefined)
                            subArgs.push('-s', asString(args.scope, 'scope'));
                        if (args.output !== undefined)
                            subArgs.push('-o', asString(args.output, 'output'));
                        if (args.domain !== undefined)
                            subArgs.push('-m', asString(args.domain, 'domain'));
                        if (args.gates !== undefined)
                            subArgs.push('-g', asString(args.gates, 'gates'));
                        if (args.radius !== undefined)
                            subArgs.push('-r', String(asOptionalNumber(args.radius) ?? 3));
                        if (args.noTests === true)
                            subArgs.push('--no-tests');
                        if (args.noGuard === true)
                            subArgs.push('--no-guard');
                        if (args.dryRun === true)
                            subArgs.push('--dry-run');
                        // Scaffold is a file-system operation; return the plan as structured data
                        // so MCP clients can execute the operations themselves if needed.
                        return {
                            success: true,
                            data: {
                                subcommand,
                                args: subArgs,
                                message: `Run: ax scaffold ${subArgs.join(' ')}`,
                            },
                        };
                    }
                    default:
                        return {
                            success: false,
                            error: `Unknown tool: ${canonicalToolName}`,
                        };
                }
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        },
    };
}
function resolveToolPrefix(explicitPrefix) {
    if (typeof explicitPrefix === 'string') {
        return explicitPrefix.trim().length > 0 ? explicitPrefix : undefined;
    }
    const envPrefix = process.env.AX_MCP_TOOL_PREFIX;
    return typeof envPrefix === 'string' && envPrefix.trim().length > 0 ? envPrefix : undefined;
}
function toPrefixedToolName(toolName, prefix) {
    return `${prefix}${toolName.replace(/[.]/g, '_')}`;
}
function createRateLimiter(config) {
    const maxRequests = config?.maxRequests ?? 60;
    const windowMs = config?.windowMs ?? 60_000;
    let timestamps = [];
    return {
        maxRequests,
        windowMs,
        allow() {
            if (maxRequests <= 0) {
                return true;
            }
            const now = Date.now();
            timestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);
            if (timestamps.length >= maxRequests) {
                return false;
            }
            timestamps.push(now);
            return true;
        },
    };
}
function isRateLimitedMethod(method) {
    return method === 'tools/list'
        || method === 'tools/call'
        || method === 'resources/list'
        || method === 'resources/read'
        || method === 'prompts/list'
        || method === 'prompts/get';
}
async function readWorkspaceFile(path) {
    await access(path);
    return readFile(path, 'utf8');
}
function objectSchema(properties, required = [], additionalProperties = false) {
    return {
        type: 'object',
        properties,
        required,
        additionalProperties,
    };
}
function resolveWorkspacePath(basePath, targetPath) {
    const resolvedBasePath = resolve(basePath);
    const resolvedTargetPath = resolve(resolvedBasePath, targetPath);
    const relativePath = relative(resolvedBasePath, resolvedTargetPath);
    if (relativePath === '..' || /^\.\.(?:[\\/]|$)/.test(relativePath)) {
        throw new Error(`Path escapes workspace: ${targetPath}`);
    }
    return resolvedTargetPath;
}
async function pathExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
function validateInput(value, schema) {
    return validateValue(value, schema, 'arguments');
}
function validateValue(value, schema, path) {
    switch (schema.type) {
        case 'object': {
            if (!isRecord(value)) {
                return `${path} must be an object`;
            }
            for (const requiredField of schema.required ?? []) {
                if (!(requiredField in value)) {
                    return `${requiredField} is required`;
                }
            }
            const properties = schema.properties ?? {};
            for (const [key, child] of Object.entries(properties)) {
                if (key in value) {
                    const nested = validateValue(value[key], child, `${path}.${key}`);
                    if (nested !== undefined) {
                        return nested;
                    }
                }
            }
            if (schema.additionalProperties === false) {
                for (const key of Object.keys(value)) {
                    if (!(key in properties)) {
                        return `${key} is not allowed`;
                    }
                }
            }
            return undefined;
        }
        case 'array': {
            if (!Array.isArray(value)) {
                return `${path} must be an array`;
            }
            if (schema.items !== undefined) {
                for (let index = 0; index < value.length; index += 1) {
                    const nested = validateValue(value[index], schema.items, `${path}[${index}]`);
                    if (nested !== undefined) {
                        return nested;
                    }
                }
            }
            return undefined;
        }
        case 'string':
            if (typeof value !== 'string') {
                return `${path} must be a string`;
            }
            if (schema.enum !== undefined && !schema.enum.includes(value)) {
                return `${path} must be one of: ${schema.enum.join(', ')}`;
            }
            return undefined;
        case 'number':
            return typeof value === 'number' && Number.isFinite(value)
                ? undefined
                : `${path} must be a number`;
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value)
                ? undefined
                : `${path} must be an integer`;
        case 'boolean':
            return typeof value === 'boolean'
                ? undefined
                : `${path} must be a boolean`;
    }
}
function asString(value, field) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${field} is required`);
    }
    return value;
}
function asOptionalString(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function asOptionalNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function asOptionalFloat(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function asInput(value) {
    return isRecord(value) ? value : undefined;
}
function asStringArray(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.filter((entry) => typeof entry === 'string' && entry.length > 0);
}
function asParallelTasks(value) {
    if (!Array.isArray(value)) {
        throw new Error('tasks must be an array');
    }
    return value.map((entry, index) => {
        if (!isRecord(entry)) {
            throw new Error(`tasks[${index}] must be an object`);
        }
        return {
            taskId: asString(entry.taskId, `tasks[${index}].taskId`),
            agentId: asString(entry.agentId, `tasks[${index}].agentId`),
            task: asOptionalString(entry.task),
            input: asInput(entry.input),
            dependencies: asStringArray(entry.dependencies),
            priority: asOptionalNumber(entry.priority),
            provider: asOptionalString(entry.provider),
            model: asOptionalString(entry.model),
            timeoutMs: asOptionalNumber(entry.timeoutMs),
        };
    });
}
function asParallelFailureStrategy(value) {
    return value === 'failFast' || value === 'failSafe' ? value : undefined;
}
function asParallelAggregation(value) {
    return value === 'list' || value === 'merge' ? value : undefined;
}
function asOptionalRole(value) {
    return value === 'initiator' || value === 'collaborator' || value === 'delegate'
        ? value
        : undefined;
}
function asOptionalReviewFocus(value) {
    return value === 'all' || value === 'security' || value === 'correctness' || value === 'maintainability'
        ? value
        : undefined;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
