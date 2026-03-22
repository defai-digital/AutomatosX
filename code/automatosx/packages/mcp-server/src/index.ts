import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import type { StepGuardPolicy } from '@defai.digital/contracts';
import { createDashboardService, type DashboardService } from '@defai.digital/monitoring';
import { createSharedRuntimeService, type SharedRuntimeService } from '@defai.digital/shared-runtime';
import type { ReviewFocus } from '@defai.digital/shared-runtime';

export interface MpcToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
  description?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
}

export interface McpPromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface McpPromptResult {
  description: string;
  messages: McpPromptMessage[];
}

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export interface McpServerSurface {
  listTools(): string[];
  listToolDefinitions(): McpToolDefinition[];
  invokeTool(toolName: string, args?: Record<string, unknown>): Promise<MpcToolResult>;
  listResources(): McpResourceDefinition[];
  readResource(uri: string): Promise<McpResourceContent>;
  listPrompts(): McpPromptDefinition[];
  getPrompt(name: string, args?: Record<string, unknown>): Promise<McpPromptResult>;
}

// MCP JSON-RPC 2.0 types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface RateLimitConfig {
  maxRequests?: number;
  windowMs?: number;
}

interface RateLimiter {
  maxRequests: number;
  windowMs: number;
  allow(): boolean;
}

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
} as const;

const PROMPT_DEFINITIONS: McpPromptDefinition[] = [
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

const TOOL_DEFINITIONS: McpToolDefinition[] = [
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
    }, ['path', 'content']),
  },
  {
    name: 'directory.create',
    description: 'Create a workspace-relative directory.',
    inputSchema: objectSchema({
      path: { type: 'string' },
      recursive: { type: 'boolean' },
    }, ['path']),
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
];

export interface McpStdioServer {
  serve(): Promise<void>;
}

export function createMcpStdioServer(config: {
  runtimeService?: SharedRuntimeService;
  dashboardService?: DashboardService;
  basePath?: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  rateLimit?: RateLimitConfig;
  toolPrefix?: string;
} = {}): McpStdioServer {
  const surface = createMcpServerSurface({
    runtimeService: config.runtimeService,
    dashboardService: config.dashboardService,
    basePath: config.basePath,
    toolPrefix: config.toolPrefix,
  });

  const input = config.input ?? process.stdin;
  const output = config.output ?? process.stdout;
  const rateLimiter = createRateLimiter(config.rateLimit);
  let rl: Interface | undefined;
  let shuttingDown = false;

  function send(response: JsonRpcResponse): void {
    output.write(`${JSON.stringify(response)}\n`);
  }

  function sendError(id: string | number | null, code: number, message: string, data?: unknown): void {
    const response: JsonRpcResponse = { jsonrpc: '2.0', id, error: { code, message } };
    if (data !== undefined) {
      response.error!.data = data;
    }
    send(response);
  }

  function buildToolDefinitions(): McpToolDefinition[] {
    return surface.listToolDefinitions();
  }

  async function handleRequest(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request;

    try {
      if (shuttingDown && method !== 'shutdown') {
        sendError(id, RPC_SERVER_SHUTTING_DOWN, 'Server is shutting down');
        return;
      }

      if (isRateLimitedMethod(method) && !rateLimiter.allow()) {
        sendError(
          id,
          RPC_RATE_LIMITED,
          `Rate limit exceeded: max ${rateLimiter.maxRequests} requests per ${rateLimiter.windowMs}ms`,
        );
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
          } else {
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
    } catch (error) {
      sendError(id, RPC_INTERNAL_ERROR, error instanceof Error ? error.message : String(error));
    }
  }

  return {
    serve(): Promise<void> {
      return new Promise((resolve) => {
        rl = createInterface({ input, terminal: false });
        const pending: Promise<void>[] = [];

        rl.on('line', (line) => {
          const trimmed = line.trim();
          if (trimmed.length === 0) {
            return;
          }
          let request: JsonRpcRequest;
          try {
            request = JSON.parse(trimmed) as JsonRpcRequest;
          } catch {
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

export function createMcpServerSurface(config: {
  runtimeService?: SharedRuntimeService;
  dashboardService?: DashboardService;
  basePath?: string;
  toolPrefix?: string;
} = {}): McpServerSurface {
  const basePath = config.basePath ?? process.cwd();
  const runtimeService = config.runtimeService ?? createSharedRuntimeService({ basePath });
  const dashboardService = config.dashboardService ?? createDashboardService({
    traceStore: runtimeService.getStores().traceStore,
  });
  const requestedToolPrefix = resolveToolPrefix(config.toolPrefix);
  const aliasDefinitions = requestedToolPrefix === undefined
    ? []
    : TOOL_DEFINITIONS.map((definition) => ({
      ...definition,
      name: toPrefixedToolName(definition.name, requestedToolPrefix),
      description: `${definition.description} Alias for ${definition.name}.`,
    }));
  const toolDefinitions = [...TOOL_DEFINITIONS, ...aliasDefinitions];
  const canonicalToolDefinitionMap = new Map(TOOL_DEFINITIONS.map((definition) => [definition.name, definition] as const));
  const aliasToCanonicalMap = new Map<string, string>();
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
                  ].filter((line): line is string => line !== undefined).join('\n'),
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
              data: await runtimeService.listTracesBySession(
                asString(args.sessionId, 'sessionId'),
                asOptionalNumber(args.limit),
              ),
            };
          case 'trace.close_stuck':
            return {
              success: true,
              data: await runtimeService.closeStuckTraces(asOptionalNumber(args.maxAgeMs)),
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
                subtopics: asStringArray(args.subtopics) ?? [],
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
              data: await runtimeService.leaveSession(
                asString(args.sessionId, 'sessionId'),
                asString(args.agentId, 'agentId'),
              ),
            };
          case 'session.complete':
            return {
              success: true,
              data: await runtimeService.completeSession(
                asString(args.sessionId, 'sessionId'),
                asOptionalString(args.summary),
              ),
            };
          case 'session.fail':
            return {
              success: true,
              data: await runtimeService.failSession(
                asString(args.sessionId, 'sessionId'),
                asString(args.message, 'message'),
              ),
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
              data: await runtimeService.getMemory(
                asString(args.key, 'key'),
                asOptionalString(args.namespace),
              ),
            };
          case 'memory.search':
            return {
              success: true,
              data: await runtimeService.searchMemory(
                asString(args.query, 'query'),
                asOptionalString(args.namespace),
              ),
            };
          case 'memory.delete':
            return {
              success: true,
              data: { deleted: await runtimeService.deleteMemory(
                asString(args.key, 'key'),
                asOptionalString(args.namespace),
              ) },
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
              data: await runtimeService.getSemantic(
                asString(args.key, 'key'),
                asOptionalString(args.namespace),
              ),
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
          case 'config.get':
            return {
              success: true,
              data: await runtimeService.getConfig(asString(args.path, 'path')),
            };
          case 'config.set':
            return {
              success: true,
              data: await runtimeService.setConfig(
                asString(args.path, 'path'),
                args.value,
              ),
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
                exists: await pathExists(resolveWorkspacePath(basePath, asString(args.path, 'path'))),
              },
            };
          case 'file.write': {
            const filePath = resolveWorkspacePath(basePath, asString(args.path, 'path'));
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
            const directoryPath = resolveWorkspacePath(basePath, asString(args.path, 'path'));
            await mkdir(directoryPath, { recursive: typeof args.recursive === 'boolean' ? args.recursive : true });
            return {
              success: true,
              data: { path: directoryPath, created: true },
            };
          }
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
                definition: isRecord(args.definition) ? args.definition as StepGuardPolicy : undefined,
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
          default:
            return {
              success: false,
              error: `Unknown tool: ${canonicalToolName}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

function resolveToolPrefix(explicitPrefix: string | undefined): string | undefined {
  if (typeof explicitPrefix === 'string') {
    return explicitPrefix.trim().length > 0 ? explicitPrefix : undefined;
  }
  const envPrefix = process.env.AX_MCP_TOOL_PREFIX;
  return typeof envPrefix === 'string' && envPrefix.trim().length > 0 ? envPrefix : undefined;
}

function toPrefixedToolName(toolName: string, prefix: string): string {
  return `${prefix}${toolName.replace(/[.]/g, '_')}`;
}

function createRateLimiter(config: RateLimitConfig | undefined): RateLimiter {
  const maxRequests = config?.maxRequests ?? 60;
  const windowMs = config?.windowMs ?? 60_000;
  let timestamps: number[] = [];

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

function isRateLimitedMethod(method: string): boolean {
  return method === 'tools/list'
    || method === 'tools/call'
    || method === 'resources/list'
    || method === 'resources/read'
    || method === 'prompts/list'
    || method === 'prompts/get';
}

async function readWorkspaceFile(path: string): Promise<string> {
  await access(path);
  return readFile(path, 'utf8');
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  additionalProperties = false,
): JsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties,
  };
}

function resolveWorkspacePath(basePath: string, targetPath: string): string {
  const resolvedBasePath = resolve(basePath);
  const resolvedTargetPath = resolve(resolvedBasePath, targetPath);
  if (resolvedTargetPath !== resolvedBasePath && !resolvedTargetPath.startsWith(`${resolvedBasePath}/`)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return resolvedTargetPath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function validateInput(value: unknown, schema: JsonSchema): string | undefined {
  return validateValue(value, schema, 'arguments');
}

function validateValue(value: unknown, schema: JsonSchema, path: string): string | undefined {
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

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOptionalFloat(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asInput(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function asParallelTasks(value: unknown): Array<{
  taskId: string;
  agentId: string;
  task?: string;
  input?: Record<string, unknown>;
  dependencies?: string[];
  priority?: number;
  provider?: string;
  model?: string;
  timeoutMs?: number;
}> {
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

function asParallelFailureStrategy(value: unknown): 'failFast' | 'failSafe' | undefined {
  return value === 'failFast' || value === 'failSafe' ? value : undefined;
}

function asParallelAggregation(value: unknown): 'list' | 'merge' | undefined {
  return value === 'list' || value === 'merge' ? value : undefined;
}

function asOptionalRole(value: unknown): 'initiator' | 'collaborator' | 'delegate' | undefined {
  return value === 'initiator' || value === 'collaborator' || value === 'delegate'
    ? value
    : undefined;
}

function asOptionalReviewFocus(value: unknown): ReviewFocus | undefined {
  return value === 'all' || value === 'security' || value === 'correctness' || value === 'maintainability'
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
