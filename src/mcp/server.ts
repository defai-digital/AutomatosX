/**
 * AutomatosX MCP Server
 *
 * Implements stdio JSON-RPC server for Model Context Protocol (MCP).
 * Exposes AutomatosX capabilities as MCP tools for Claude Code and other clients.
 */

import { join } from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import { AX_PATHS } from '../core/validation-limits.js';
import addFormats from 'ajv-formats';
import { Mutex } from 'async-mutex'; // BUG FIX (v9.0.1): Added for initialization mutex
import { getVersion } from '../shared/helpers/version.js';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpInitializeRequest,
  McpInitializeResponse,
  McpToolListRequest,
  McpToolListResponse,
  McpToolCallRequest,
  McpToolCallResponse,
  McpTool,
  McpSession,
  ToolHandler,
  McpResourceListRequest,
  McpResourceReadRequest,
  McpResourceReadResponse,
  McpResourceTemplateListRequest,
  McpResourceTemplateReadRequest,
  McpResourceTemplateReadResponse,
  McpPromptListRequest,
  McpPromptGetRequest
} from './types.js';
import {
  McpErrorCode,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_VERSIONS,
  type SupportedMcpProtocolVersion
} from './types.js';
import { logger, setLogLevel } from '../shared/logging/logger.js';
import { loadConfig } from '../core/config/loader.js';
import { Router } from '../core/router/router.js';
import { LazyMemoryManager } from '../core/memory/lazy-manager.js';
import type { IMemoryManager } from '../types/memory.js';
import { SessionManager } from '../core/session/manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ContextManager } from '../agents/context-manager.js';
import { ProfileLoader } from '../agents/profile-loader.js';
import { AbilitiesManager } from '../agents/abilities-manager.js';
import { TeamManager } from '../core/team-manager.js';
import { PathResolver } from '../shared/validation/path-resolver.js';
import { ConversationContextStore } from '../core/session/context-store.js';

// Import tool handlers - Phase 1
import { createRunAgentHandler } from './tools/run-agent.js';
import { createListAgentsHandler } from './tools/list-agents.js';
import { createSearchMemoryHandler } from './tools/search-memory.js';
import { createGetStatusHandler } from './tools/get-status.js';

// Import tool handlers - Phase 2: Sessions
import { createSessionCreateHandler } from './tools/session-create.js';
import { createSessionListHandler } from './tools/session-list.js';
import { createSessionStatusHandler } from './tools/session-status.js';
import { createSessionCompleteHandler } from './tools/session-complete.js';
import { createSessionFailHandler } from './tools/session-fail.js';

// Import tool handlers - Phase 2: Memory
import { createMemoryAddHandler } from './tools/memory-add.js';
import { createMemoryListHandler } from './tools/memory-list.js';
import { createMemoryDeleteHandler } from './tools/memory-delete.js';
import { createMemoryExportHandler } from './tools/memory-export.js';
import { createMemoryImportHandler } from './tools/memory-import.js';
import { createMemoryStatsHandler } from './tools/memory-stats.js';
import { createMemoryClearHandler } from './tools/memory-clear.js';

// Import tool handlers - Phase 3.1: Context Sharing
import { createGetConversationContextHandler } from './tools/get-conversation-context.js';
import { createInjectConversationContextHandler } from './tools/inject-conversation-context.js';

// Import tool handlers - Phase 3.1: Tool Chaining
import { createImplementAndDocumentHandler } from './tools/implement-and-document.js';

// Import tool handlers - v10.5.0: Smart Routing
import { createGetAgentContextHandler } from './tools/get-agent-context.js';

// v12.6.0: Bugfix tools now exposed via MCP for direct client use
// Removed Quality agent integration due to reliability issues
import { createBugfixScanHandler, bugfixScanSchema } from './tools/bugfix-scan.js';
import { createBugfixRunHandler, bugfixRunSchema } from './tools/bugfix-run.js';

// v12.7.0: Refactor tools for autonomous code refactoring
import { createRefactorScanHandler, refactorScanSchema } from './tools/refactor-scan.js';
import { createRefactorRunHandler, refactorRunSchema } from './tools/refactor-run.js';

// Import tool handlers - v13.0.0: Enhanced Service Discovery
import { createGetCapabilitiesHandler } from './tools/get-capabilities.js';

// Import tool handlers - v12.6.0: Multi-Agent Orchestration
import { createPlanMultiAgentHandler, planMultiAgentSchema } from './tools/plan-multi-agent.js';
import { createOrchestrateTaskHandler, orchestrateTaskSchema } from './tools/orchestrate-task.js';

// Import tool handlers - v11.3.5: Task Engine
import {
  createCreateTaskHandler,
  createTaskSchema,
  createRunTaskHandler,
  runTaskSchema,
  createGetTaskResultHandler,
  getTaskResultSchema,
  createListTasksHandler,
  listTasksSchema,
  createDeleteTaskHandler,
  deleteTaskSchema
} from './tools/task/index.js';

// v10.6.0: MCP Client Pool for cross-provider execution
import { McpClientPool, getGlobalPool } from '../providers/mcp/pool-manager.js';

// v11.1.0: Unified Event System
import { getGlobalEventBridge, type EventBridge } from '../core/events/event-bridge.js';
import { McpStreamingNotifier, getGlobalStreamingNotifier, sendMcpProgressBegin, sendMcpProgressEnd } from './streaming-notifier.js';
import { ClaudeEventNormalizer } from '../core/events/normalizers/claude-normalizer.js';
import { GeminiEventNormalizer } from '../core/events/normalizers/gemini-normalizer.js';
import { CodexEventNormalizer } from '../core/events/normalizers/codex-normalizer.js';
// v12.0.0: Removed AxCliEventNormalizer (ax-cli deprecated)
import {
  listResourceTemplates,
  resolveResourceTemplate
} from './resource-templates.js';

export interface McpServerOptions {
  debug?: boolean;
  /** v11.1.0: Enable streaming progress notifications */
  enableStreamingNotifications?: boolean;
  /** Allowlist of tool names; if set, only these tools can be invoked */
  toolAllowlist?: string[];
  /** Shared secret token required to call protected tools */
  authToken?: string;
}

/** Client name patterns for provider detection */
const CLIENT_PATTERNS: Array<[string[], McpSession['normalizedProvider']]> = [
  [['claude'], 'claude'],
  [['gemini'], 'gemini'],
  [['codex', 'openai'], 'codex']
  // v12.0.0: Removed ax-cli (deprecated)
];

/** Stdio buffer safety limits (prevent infinite loops and memory exhaustion) */
const STDIO_MAX_ITERATIONS = 100;
const STDIO_MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
const STDIO_MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Normalize MCP client name to provider identifier
 */
function normalizeClientProvider(clientName: string): McpSession['normalizedProvider'] {
  const name = clientName.toLowerCase();
  for (const [patterns, provider] of CLIENT_PATTERNS) {
    if (patterns.some(p => name.includes(p))) return provider;
  }
  return 'unknown';
}

export class McpServer {
  // Use 'any' for heterogeneous tool handlers to avoid unsafe type casts
  // Runtime validation via validateToolInput provides type safety
  private tools: Map<string, ToolHandler<any, any>> = new Map();
  private toolSchemas: McpTool[] = [];
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationMutex = new Mutex(); // BUG FIX (v9.0.1): Prevent concurrent initialization
  private stdinMutex = new Mutex(); // BUG FIX: Prevent race conditions in stdin message processing
  private version: string;
  private ajv: Ajv;
  private compiledValidators = new Map<string, ValidateFunction>();
  private cancelledRequests = new Set<string | number>(); // Track client-initiated cancellations
  private requestControllers = new Map<string | number, AbortController>(); // Abort long-running handlers
  private toolAllowlist?: Set<string>;
  private authToken?: string;

  // v10.5.0: MCP Session for Smart Routing
  private session: McpSession | null = null;

  // v10.6.0: MCP Client Pool for cross-provider execution
  private mcpPool: McpClientPool | null = null;

  // v11.1.0: Unified Event System
  private eventBridge: EventBridge | null = null;
  private streamingNotifier: McpStreamingNotifier | null = null;
  private enableStreamingNotifications = true;
  private negotiatedProtocolVersion: SupportedMcpProtocolVersion = MCP_PROTOCOL_VERSION;

  // Shared services (initialized once per server)
  private router!: Router;
  private memoryManager!: IMemoryManager;
  private sessionManager!: SessionManager;
  private workspaceManager!: WorkspaceManager;
  private contextManager!: ContextManager;
  private profileLoader!: ProfileLoader;
  private pathResolver!: PathResolver;
  private contextStore!: ConversationContextStore;

  constructor(options: McpServerOptions = {}) {
    if (options.debug) {
      setLogLevel('debug');
    }
    if (options.toolAllowlist?.length) {
      this.toolAllowlist = new Set(options.toolAllowlist);
    }
    if (options.authToken) {
      this.authToken = options.authToken;
    }

    // v11.1.0: Configure streaming notifications
    this.enableStreamingNotifications = options.enableStreamingNotifications ?? true;

    this.version = getVersion();
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    // v12.5.4: Start streaming notifier early so progress messages work during lazy init
    if (this.enableStreamingNotifications) {
      this.streamingNotifier = getGlobalStreamingNotifier({ enabled: true });
      this.streamingNotifier.start();
    }

    logger.info('[MCP Server] Initializing AutomatosX MCP Server', {
      version: this.version,
      streamingNotifications: this.enableStreamingNotifications
    });
  }

  /** Determine if negotiated protocol is v2 */
  private isV2Protocol(): boolean {
    return this.negotiatedProtocolVersion === MCP_SUPPORTED_VERSIONS[0];
  }

  /** Build capability set based on negotiated protocol */
  private buildCapabilities(): McpInitializeResponse['capabilities'] {
    const base = { tools: {} as Record<string, unknown> };
    if (this.isV2Protocol()) {
      return {
        ...base,
        resources: {},
        prompts: {},
        resourceTemplates: {},
        experimental: {}
      };
    }
    return base;
  }

  /**
   * Get static tool schemas (no initialization required)
   * Returns tool schemas that can be provided during MCP handshake
   * before services are initialized.
   *
   * v12.6.0: Enhanced descriptions with examples, return formats, and use cases
   * to improve AI client understanding and tool selection.
   */
  private static getStaticToolSchemas(): McpTool[] {
    return [
      {
        name: 'run_agent',
        description: `Execute an AutomatosX agent with a specific task.

**When to use**: Delegate specialized tasks to expert agents. Each agent has domain expertise:
- "backend": API development, database design, server-side logic
- "frontend": UI/UX, React components, styling, accessibility
- "quality": Testing, debugging, bug detection, code review
- "security": Security audits, vulnerability scanning, auth systems
- "architecture": System design, tech stack decisions, scalability
- "devops": CI/CD, Docker, deployment, infrastructure

**Auto-selection**: If agent is omitted, system analyzes task keywords and selects the best agent.

**Returns**: JSON with execution result, output from the agent, and metadata.

**PARALLEL EXECUTION**: For complex tasks requiring multiple agents, you CAN and SHOULD call run_agent multiple times IN PARALLEL when subtasks are independent. This significantly reduces total execution time.

**Example - Single agent**:
- run_agent({ agent: "backend", task: "Create a REST API endpoint for user authentication with JWT" })

**Example - PARALLEL execution** (call all three simultaneously):
Task: "Build authentication system"
→ run_agent({ agent: "security", task: "Design security requirements and auth flow" })
→ run_agent({ agent: "backend", task: "Implement JWT authentication API" })  // Can run in parallel with frontend
→ run_agent({ agent: "frontend", task: "Build login/signup UI components" })  // Can run in parallel with backend

**Tip**: Use \`plan_multi_agent\` first to get an optimal execution plan, or \`orchestrate_task\` for automatic parallel orchestration.`,
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'Agent name: backend, frontend, quality, security, architecture, devops. If omitted, auto-selected based on task.' },
            task: { type: 'string', description: 'Detailed task description. Be specific about requirements and expected outcomes.' },
            provider: { type: 'string', description: 'AI provider override: claude (best coding), gemini (free tier), openai (balanced)', enum: ['claude', 'gemini', 'openai'] },
            no_memory: { type: 'boolean', description: 'Skip injecting relevant past context into agent prompt', default: false },
            mode: { type: 'string', description: 'auto: smart routing, context: return prompt without executing, execute: always spawn process', enum: ['auto', 'context', 'execute'], default: 'auto' }
          },
          required: ['task']
        }
      },
      {
        name: 'list_agents',
        description: `List all available AutomatosX agents with their profiles.

**When to use**: Discover available agents before delegating tasks, or to understand agent capabilities.

**Returns**: Array of agent profiles, each containing:
- name: Agent identifier (e.g., "backend", "quality")
- displayName: Human-readable name (e.g., "Queenie")
- role: Job title (e.g., "QA Engineer", "Backend Developer")
- description: What the agent specializes in
- abilities: List of capabilities (e.g., ["testing", "debugging"])
- provider: Preferred AI provider
- team: Team membership (e.g., "core", "platform")

**Example response**:
[
  { "name": "backend", "displayName": "Benny", "role": "Backend Developer", "abilities": ["api-design", "database"] },
  { "name": "quality", "displayName": "Queenie", "role": "QA Engineer", "abilities": ["testing", "debugging"] }
]`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'search_memory',
        description: `Search AutomatosX persistent memory using full-text search.

**What memory contains**: Past task executions, code snippets, architectural decisions, debugging sessions, and context from previous conversations. Memory persists across sessions.

**When to use**:
- Find previous work on a similar task
- Retrieve past decisions or implementations
- Check if a bug was fixed before
- Get context before starting new work

**Search tips**:
- Use specific keywords: "authentication JWT" rather than "auth"
- Include file names: "router.ts error handling"
- Search by agent: Results include which agent created the entry

**Returns**: Array of memory entries with content, timestamp, agent, and relevance score.

**Examples**:
- search_memory({ query: "database migration", limit: 5 })
- search_memory({ query: "authentication security audit" })
- search_memory({ query: "React component performance optimization" })`,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search terms. Use specific keywords for better results.' },
            limit: { type: 'number', description: 'Max results to return (default: 10, max: 100)', default: 10 }
          },
          required: ['query']
        }
      },
      {
        name: 'get_status',
        description: `Get AutomatosX system status and health information.

**When to use**: Check system health, verify configuration, or diagnose issues.

**Returns**:
- version: AutomatosX version
- providers: List of configured AI providers and their availability
- memory: Stats (entry count, database size, last access)
- sessions: Active session count and recent activity
- router: Current routing configuration and provider health
- uptime: Server uptime and initialization state

**Example response**:
{
  "version": "12.5.4",
  "providers": { "claude": "available", "gemini": "available", "openai": "unavailable" },
  "memory": { "entries": 1523, "sizeMB": 12.5 },
  "sessions": { "active": 2, "total": 45 }
}`,
        inputSchema: { type: 'object', properties: {} }
      },
      // v13.0.0: Enhanced Service Discovery
      {
        name: 'get_capabilities',
        description: `Get comprehensive AutomatosX capabilities for service discovery.

Returns:
- providers: All AI providers with execution modes (cli/sdk/hybrid)
- agents: All available agent profiles with roles and abilities
- tools: All MCP tools organized by category
- memory: Memory system status (entries, limits)
- sessions: Session management status
- features: Enabled features (smart routing, streaming, etc.)

Use this tool first to understand what AutomatosX offers.`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'session_create',
        description: `Create a new multi-agent collaborative session.

**What sessions are for**: Sessions track complex tasks that involve multiple agents working together. They provide:
- Task state persistence across agent invocations
- History of which agents contributed what
- Ability to resume interrupted work
- Coordination between agents (e.g., backend implements, quality reviews)

**When to use**:
- Multi-step tasks requiring multiple agents
- Long-running work that may span multiple conversations
- Collaborative workflows (design → implement → review → deploy)

**Returns**: Session object with unique ID, state, timestamps, and task list.

**Example workflow**:
1. session_create({ name: "Implement auth system", agent: "architecture" })
2. run_agent({ agent: "backend", task: "Implement JWT auth" })
3. run_agent({ agent: "quality", task: "Review auth implementation" })
4. session_complete({ id: "session-uuid" })`,
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Descriptive session name (e.g., "Implement user authentication")' },
            agent: { type: 'string', description: 'Initial agent to assign (e.g., "backend", "architecture")' }
          },
          required: ['name', 'agent']
        }
      },
      {
        name: 'session_list',
        description: `List all active and recent sessions.

**When to use**: Find existing sessions to resume, check what work is in progress, or audit past work.

**Returns**: Array of session summaries with:
- id: Unique session identifier
- name: Session description
- state: "active", "completed", or "failed"
- createdAt: Session start time
- updatedAt: Last activity time
- agents: List of agents that participated

**Example response**:
[
  { "id": "abc-123", "name": "Auth system", "state": "active", "agents": ["backend", "quality"] },
  { "id": "def-456", "name": "API refactor", "state": "completed", "agents": ["architecture", "backend"] }
]`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'session_status',
        description: `Get detailed status of a specific session including task history.

**When to use**: Check progress of a session, see what agents have done, or decide next steps.

**Returns**: Full session details with:
- id, name, state, timestamps
- tasks: Array of all tasks executed with results
- currentAgent: Which agent is active (if any)
- metadata: Additional context stored with session

**Example**: session_status({ id: "abc-123" })`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Session ID from session_create or session_list' }
          },
          required: ['id']
        }
      },
      {
        name: 'session_complete',
        description: `Mark a session as successfully completed.

**When to use**: After all tasks in a session are done and verified.

**What it does**:
- Updates session state to "completed"
- Records completion timestamp
- Persists session to history for future reference
- Releases any held resources

**Example**: session_complete({ id: "abc-123" })`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Session ID to mark as completed' }
          },
          required: ['id']
        }
      },
      {
        name: 'session_fail',
        description: `Mark a session as failed with an error reason.

**When to use**: When a session cannot be completed due to errors, blockers, or abandonment.

**What it does**:
- Updates session state to "failed"
- Records failure reason for debugging
- Preserves partial work for potential recovery

**Example**: session_fail({ id: "abc-123", reason: "API rate limit exceeded, cannot complete integration" })`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Session ID to mark as failed' },
            reason: { type: 'string', description: 'Detailed explanation of why the session failed' }
          },
          required: ['id', 'reason']
        }
      },
      {
        name: 'memory_add',
        description: `Add a new entry to AutomatosX persistent memory.

**When to use**:
- Save important decisions or implementations for future reference
- Store code snippets that worked well
- Record architectural decisions and their rationale
- Preserve debugging insights

**Memory is searchable**: Entries are indexed for full-text search via search_memory.

**Best practices**:
- Include context: what problem was solved, what approach was used
- Tag with relevant keywords for easier retrieval
- Include agent name if storing agent output

**Example**: memory_add({ content: "Implemented rate limiting using token bucket algorithm. Config: 100 req/min burst, 10 req/s sustained.", metadata: { agent: "backend", tags: ["rate-limiting", "performance"] } })`,
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to store. Be descriptive for better searchability.' },
            metadata: {
              type: 'object',
              description: 'Optional metadata for categorization and filtering',
              properties: {
                agent: { type: 'string', description: 'Agent that created this entry' },
                timestamp: { type: 'string', description: 'Custom timestamp (ISO format)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' }
              }
            }
          },
          required: ['content']
        }
      },
      {
        name: 'memory_list',
        description: `List memory entries with optional filtering.

**When to use**: Browse memory contents, audit what's stored, or filter by agent.

**Returns**: Array of memory entries sorted by recency, with:
- id: Unique identifier (use for memory_delete)
- content: Stored text
- agent: Source agent (if specified)
- createdAt: When entry was added
- metadata: Additional tags/info

**Example**: memory_list({ agent: "backend", limit: 20 })`,
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'Filter to entries from specific agent' },
            limit: { type: 'number', description: 'Max entries to return (default: 50)', default: 50 }
          }
        }
      },
      {
        name: 'memory_delete',
        description: `Delete a specific memory entry by ID.

**When to use**: Remove outdated, incorrect, or sensitive information from memory.

**Note**: Deletion is permanent. Use memory_list to find the ID first.

**Example**: memory_delete({ id: 42 })`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'Memory entry ID from memory_list' }
          },
          required: ['id']
        }
      },
      {
        name: 'memory_export',
        description: `Export all memory entries to a JSON file.

**When to use**:
- Backup memory before major changes
- Transfer memory to another system
- Archive project knowledge
- Audit stored information

**Returns**: Confirmation with entry count and file path.

**Example**: memory_export({ path: "./backup/memory-2024-01-15.json" })`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path for export (JSON format)' }
          },
          required: ['path']
        }
      },
      {
        name: 'memory_import',
        description: `Import memory entries from a JSON file.

**When to use**:
- Restore from backup
- Load memory from another project
- Seed new project with existing knowledge

**Format**: JSON array of memory entries (same format as memory_export).

**Note**: Imported entries are merged with existing memory.

**Example**: memory_import({ path: "./backup/memory-2024-01-15.json" })`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to import from (JSON format)' }
          },
          required: ['path']
        }
      },
      {
        name: 'memory_stats',
        description: `Get detailed memory statistics and health information.

**When to use**: Check memory usage, diagnose performance issues, or monitor growth.

**Returns**:
- totalEntries: Number of memory entries
- totalSizeBytes: Database size
- entriesByAgent: Breakdown by agent
- oldestEntry: Timestamp of oldest entry
- newestEntry: Timestamp of newest entry
- averageEntrySize: Bytes per entry

**Example response**:
{
  "totalEntries": 1523,
  "totalSizeBytes": 1245678,
  "entriesByAgent": { "backend": 456, "quality": 312, "architecture": 89 }
}`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'memory_clear',
        description: `Clear ALL memory entries from the database.

**WARNING**: This permanently deletes all stored memory. Use with caution.

**When to use**:
- Starting fresh on a new project
- Removing sensitive data
- Resetting after major changes

**Recommendation**: Use memory_export first to create a backup.

**Returns**: Confirmation with count of deleted entries.`,
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_conversation_context',
        description: `Retrieve conversation context from the shared cross-assistant context store.

**What this is for**: AutomatosX allows different AI assistants (Claude, Gemini, etc.) to share context. This enables workflows where one assistant's work informs another's.

**When to use**:
- Resume work started by another assistant
- Get context from a different AI provider's session
- Check what information was shared across assistants

**Returns**: Array of context entries with:
- id: Context entry identifier
- source: Which assistant created it (e.g., "gemini-cli", "claude-code")
- content: The shared context/information
- metadata: Topic, participants, tags
- createdAt: When context was stored

**Example**: get_conversation_context({ source: "gemini-cli", limit: 5 })`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Specific context ID to retrieve' },
            source: { type: 'string', description: 'Filter by source assistant (e.g., "gemini-cli", "claude-code")' },
            limit: { type: 'number', description: 'Max entries to return (default: 10)', default: 10 }
          }
        }
      },
      {
        name: 'inject_conversation_context',
        description: `Share conversation context with other AI assistants via the context store.

**What this is for**: Enables cross-assistant collaboration by sharing context between different AI providers.

**When to use**:
- Hand off work to another AI assistant
- Share discoveries or decisions across assistants
- Create checkpoints in multi-assistant workflows

**Best practices**:
- Include enough context for the other assistant to continue
- Use descriptive topics and tags
- List relevant participants (agents involved)

**Example**: inject_conversation_context({
  source: "claude-code",
  content: "Completed auth module implementation. JWT tokens work, need security review.",
  metadata: { topic: "authentication", tags: ["security", "backend"], participants: ["backend", "security"] }
})`,
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Your assistant identifier (e.g., "claude-code", "gemini-cli")' },
            content: { type: 'string', description: 'Context to share - be descriptive for handoffs' },
            metadata: {
              type: 'object',
              description: 'Optional categorization',
              properties: {
                topic: { type: 'string', description: 'Main topic (e.g., "authentication")' },
                participants: { type: 'array', items: { type: 'string' }, description: 'Agents involved' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Searchable tags' }
              }
            }
          },
          required: ['source', 'content']
        }
      },
      {
        name: 'implement_and_document',
        description: `Implement code AND generate documentation in one atomic operation.

**Why this exists**: Prevents "documentation drift" where code changes but docs don't. Both are generated together from the same understanding.

**When to use**:
- New feature implementations that need docs
- API changes that require documentation updates
- Any code change that should be documented

**What it does**:
1. Runs agent to implement the task
2. Generates documentation from the implementation
3. Optionally updates CHANGELOG.md
4. Returns both code and docs together

**Example**: implement_and_document({
  task: "Add rate limiting middleware with configurable limits",
  agent: "backend",
  documentation: { format: "markdown", updateChangelog: true }
})`,
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Implementation task - be specific about requirements' },
            agent: { type: 'string', description: 'Agent to use (default: backend)' },
            documentation: {
              type: 'object',
              description: 'Documentation generation options',
              properties: {
                format: { type: 'string', enum: ['markdown', 'jsdoc'], description: 'Doc format (default: markdown)' },
                outputPath: { type: 'string', description: 'Custom output path for docs' },
                updateChangelog: { type: 'boolean', description: 'Update CHANGELOG.md (default: true)', default: true }
              }
            },
            provider: { type: 'string', enum: ['claude', 'gemini', 'openai'], description: 'AI provider override' }
          },
          required: ['task']
        }
      },
      // v10.5.0: Smart Routing - Explicit context retrieval
      {
        name: 'get_agent_context',
        description: `Get agent profile and context WITHOUT executing. Returns everything needed for YOU to execute the task directly.

**When to use**:
- You want to understand an agent's expertise before deciding to delegate
- You prefer to execute the task yourself with agent guidance
- You need the agent's system prompt and relevant memory

**What it returns**:
- profile: Full agent profile (role, abilities, system prompt)
- memory: Relevant past context from search_memory
- enhancedPrompt: Ready-to-use prompt incorporating agent expertise

**Auto-selection**: If agent is omitted, system analyzes task and selects the best-matching agent.

**Example**: get_agent_context({
  task: "Implement caching layer for database queries",
  includeMemory: true,
  maxMemoryResults: 5
})

**Returns example**:
{
  "selectedAgent": "backend",
  "profile": { "role": "Backend Developer", "abilities": [...], "systemPrompt": "..." },
  "memory": [{ "content": "Previous caching implementation used Redis...", ... }],
  "enhancedPrompt": "You are a Backend Developer. Your task: Implement caching..."
}`,
        inputSchema: {
          type: 'object',
          properties: {
            agent: { type: 'string', description: 'Agent name, or omit for auto-selection based on task' },
            task: { type: 'string', description: 'Task description - used for auto-selection and memory search' },
            includeMemory: { type: 'boolean', description: 'Include relevant memory entries (default: true)', default: true },
            maxMemoryResults: { type: 'number', description: 'Max memory entries to include (default: 5)', default: 5 }
          },
          required: ['task']
        }
      },
      // v11.3.5: Task Engine tools
      createTaskSchema as McpTool,
      runTaskSchema as McpTool,
      getTaskResultSchema as McpTool,
      listTasksSchema as McpTool,
      deleteTaskSchema as McpTool,
      // v12.6.0: Bugfix tools now exposed directly via MCP
      bugfixScanSchema as McpTool,
      bugfixRunSchema as McpTool,
      // v12.7.0: Refactor tools for autonomous code refactoring
      refactorScanSchema as McpTool,
      refactorRunSchema as McpTool,
      // v12.6.0: Multi-Agent Orchestration tools
      planMultiAgentSchema as McpTool,
      orchestrateTaskSchema as McpTool
    ];
  }

  /**
   * Initialize shared services once per server process
   */
  private async initializeServices(): Promise<void> {
    logger.info('[MCP Server] Initializing shared services...');

    const projectDir = process.cwd();
    const config = await loadConfig(projectDir);

    // Initialize TeamManager
    const teamManager = new TeamManager(
      join(projectDir, AX_PATHS.TEAMS)
    );

    // Initialize ProfileLoader
    this.profileLoader = new ProfileLoader(
      join(projectDir, AX_PATHS.AGENTS),
      undefined,
      teamManager
    );

    // Initialize AbilitiesManager
    const abilitiesManager = new AbilitiesManager(
      join(projectDir, AX_PATHS.ABILITIES)
    );

    // Initialize MemoryManager
    this.memoryManager = new LazyMemoryManager({
      dbPath: join(projectDir, AX_PATHS.MEMORY, 'memory.db')
    });

    // Initialize PathResolver
    this.pathResolver = new PathResolver({
      projectDir,
      workingDir: process.cwd(),
      agentWorkspace: join(projectDir, AX_PATHS.WORKSPACES)
    });

    // Initialize Providers
    const providers = [];
    if (config.providers['claude-code']?.enabled) {
      const { ClaudeProvider } = await import('../providers/claude-provider.js');
      const claudeConfig = config.providers['claude-code'];
      providers.push(new ClaudeProvider({ ...claudeConfig, name: 'claude-code', command: claudeConfig.command || 'claude' }));
    }
    if (config.providers['gemini-cli']?.enabled) {
      const { GeminiProvider } = await import('../providers/gemini-provider.js');
      const geminiConfig = config.providers['gemini-cli'];
      providers.push(new GeminiProvider({ ...geminiConfig, name: 'gemini-cli', command: geminiConfig.command || 'gemini' }));
    }
    if (config.providers['openai']?.enabled) {
        const { createOpenAIProviderSync } = await import('../providers/openai-provider-factory.js');
        const openaiConfig = config.providers['openai'];
        providers.push(createOpenAIProviderSync({ ...openaiConfig, name: 'openai', command: openaiConfig.command || 'codex' }, openaiConfig.integration));
    }

    // v12.4.0: Initialize GLM provider (SDK-first)
    if (config.providers['glm']?.enabled) {
      const { GLMProvider } = await import('../providers/glm-provider.js');
      const glmConfig = config.providers['glm'];
      providers.push(new GLMProvider({
        name: 'glm',
        enabled: true,
        priority: glmConfig.priority,
        timeout: glmConfig.timeout,
        mode: 'sdk'
      }));
    }

    // v12.4.0: Initialize Grok provider (SDK-first)
    if (config.providers['grok']?.enabled) {
      const { GrokProvider } = await import('../providers/grok-provider.js');
      const grokConfig = config.providers['grok'];
      providers.push(new GrokProvider({
        name: 'grok',
        enabled: true,
        priority: grokConfig.priority,
        timeout: grokConfig.timeout,
        mode: 'sdk'
      }));
    }

    // Initialize Router
    const healthCheckInterval = config.router?.healthCheckInterval;
    this.router = new Router({
      providers,
      fallbackEnabled: true,
      healthCheckInterval,
      providerCooldownMs: config.router?.providerCooldownMs,
      enableFreeTierPrioritization: config.router?.enableFreeTierPrioritization,
      enableWorkloadAwareRouting: config.router?.enableWorkloadAwareRouting
    });

    // Initialize SessionManager
    this.sessionManager = new SessionManager({
      persistencePath: join(projectDir, '.automatosx', 'sessions', 'sessions.json')
    });
    await this.sessionManager.initialize();

    // Initialize WorkspaceManager
    this.workspaceManager = new WorkspaceManager(projectDir);

    // Initialize ContextManager
    this.contextManager = new ContextManager({
      profileLoader: this.profileLoader,
      abilitiesManager,
      memoryManager: this.memoryManager,
      router: this.router,
      pathResolver: this.pathResolver,
      sessionManager: this.sessionManager,
      workspaceManager: this.workspaceManager
    });

    // Initialize ConversationContextStore (Phase 3.1)
    this.contextStore = new ConversationContextStore({
      storePath: join(projectDir, '.automatosx', 'context'),
      maxEntries: 100,
      ttlMs: 24 * 60 * 60 * 1000  // 24 hours
    });
    await this.contextStore.initialize();

    // v10.6.0: Initialize MCP Client Pool for cross-provider execution
    // Uses global singleton pool with default config (defined in pool-manager.ts)
    this.mcpPool = getGlobalPool();

    // v11.1.0: Initialize Unified Event System
    this.eventBridge = getGlobalEventBridge({
      throttleMs: 100,
      throttledTypes: ['execution.token', 'execution.progress'],
      debug: process.env.AUTOMATOSX_LOG_LEVEL === 'debug'
    });

    // Register provider-specific normalizers
    this.eventBridge.registerNormalizer(new ClaudeEventNormalizer());
    this.eventBridge.registerNormalizer(new GeminiEventNormalizer());
    this.eventBridge.registerNormalizer(new CodexEventNormalizer());

    // v12.5.4: Streaming notifier is started early in constructor
    // Here we just log that services are ready
    if (this.enableStreamingNotifications) {
      logger.info('[MCP Server] Streaming notifications active');
    }

    logger.info('[MCP Server] Services initialized successfully');
  }

  /**
   * Cleanup resources before shutdown
   */
  private async cleanup(): Promise<void> {
    logger.info('[MCP Server] Performing cleanup...');

    // v11.1.0: Stop streaming notifier
    if (this.streamingNotifier) {
      this.streamingNotifier.stop();
    }

    // Stop router health checks and provider timers
    if (this.router) {
      this.router.destroy();
    }

    // Clear request controllers
    this.requestControllers.clear();

    // Flush sessions to disk
    if (this.sessionManager) {
      await this.sessionManager.destroy();
    }

    // Close context store
    if (this.contextStore) {
      this.contextStore.destroy();
    }

    // v11.1.0: Destroy event bridge
    if (this.eventBridge) {
      this.eventBridge.destroy();
    }

    if (this.memoryManager) await this.memoryManager.close();
    // v10.6.0: Drain MCP Client Pool
    if (this.mcpPool) await this.mcpPool.drain();
    logger.info('[MCP Server] Cleanup completed');
  }

  /**
   * v11.1.0: Get the event bridge for external event publishing
   */
  getEventBridge(): EventBridge | null {
    return this.eventBridge;
  }

  /**
   * Register Phase 1 tools
   */
  private registerTools(): void {
    logger.info('[MCP Server] Registering tools...');

    // Use static schemas as single source of truth
    const staticSchemas = McpServer.getStaticToolSchemas();
    const schemaByName = new Map(staticSchemas.map(s => [s.name, s]));

    const register = (name: string, handler: ToolHandler<any, any>) => {
      const schema = schemaByName.get(name);
      if (!schema) {
        throw new Error(`No static schema found for tool: ${name}`);
      }
      this.tools.set(name, handler);
      this.toolSchemas.push(schema);
      this.compiledValidators.set(name, this.ajv.compile(schema.inputSchema));
    };

    // Phase 1: Core tools
    register('run_agent', createRunAgentHandler({
      contextManager: this.contextManager,
      executorConfig: {
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader
      },
      getSession: () => this.session,
      router: this.router,
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager,
      mcpPool: this.mcpPool ?? undefined,
      crossProviderMode: 'auto'
    }));

    register('list_agents', createListAgentsHandler({ profileLoader: this.profileLoader }));
    register('search_memory', createSearchMemoryHandler({ memoryManager: this.memoryManager }));
    register('get_status', createGetStatusHandler({ memoryManager: this.memoryManager, sessionManager: this.sessionManager, router: this.router }));

    // Phase 2: Session tools
    register('session_create', createSessionCreateHandler({ sessionManager: this.sessionManager }));
    register('session_list', createSessionListHandler({ sessionManager: this.sessionManager }));
    register('session_status', createSessionStatusHandler({ sessionManager: this.sessionManager }));
    register('session_complete', createSessionCompleteHandler({ sessionManager: this.sessionManager }));
    register('session_fail', createSessionFailHandler({ sessionManager: this.sessionManager }));

    // Phase 2: Memory tools
    register('memory_add', createMemoryAddHandler({ memoryManager: this.memoryManager }));
    register('memory_list', createMemoryListHandler({ memoryManager: this.memoryManager }));
    register('memory_delete', createMemoryDeleteHandler({ memoryManager: this.memoryManager }));
    register('memory_export', createMemoryExportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }));
    register('memory_import', createMemoryImportHandler({ memoryManager: this.memoryManager, pathResolver: this.pathResolver }));
    register('memory_stats', createMemoryStatsHandler({ memoryManager: this.memoryManager }));
    register('memory_clear', createMemoryClearHandler({ memoryManager: this.memoryManager }));

    // Phase 3.1: Context Sharing
    register('get_conversation_context', createGetConversationContextHandler({ contextStore: this.contextStore }));
    register('inject_conversation_context', createInjectConversationContextHandler({ contextStore: this.contextStore }));

    // Phase 3.1: Tool Chaining
    register('implement_and_document', createImplementAndDocumentHandler({
      contextManager: this.contextManager,
      executorConfig: {
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader
      }
    }));

    // v10.5.0: Smart Routing - Explicit context retrieval
    register('get_agent_context', createGetAgentContextHandler({
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager
    }));

    // v13.0.0: Enhanced Service Discovery
    register('get_capabilities', createGetCapabilitiesHandler({
      memoryManager: this.memoryManager,
      sessionManager: this.sessionManager,
      router: this.router,
      profileLoader: this.profileLoader,
      toolSchemas: staticSchemas
    }));

    // v11.3.5: Task Engine tools
    register('create_task', createCreateTaskHandler({
      getSession: () => this.session
    }));
    register('run_task', createRunTaskHandler({
      getSession: () => this.session
    }));
    register('get_task_result', createGetTaskResultHandler());
    register('list_tasks', createListTasksHandler());
    register('delete_task', createDeleteTaskHandler());

    // v12.6.0: Bugfix tools now exposed directly via MCP
    register('bugfix_scan', createBugfixScanHandler());
    register('bugfix_run', createBugfixRunHandler());

    // v12.7.0: Refactor tools for autonomous code refactoring
    register('refactor_scan', createRefactorScanHandler());
    register('refactor_run', createRefactorRunHandler());

    // v12.6.0: Multi-Agent Orchestration tools
    register('plan_multi_agent', createPlanMultiAgentHandler({
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager
    }));
    register('orchestrate_task', createOrchestrateTaskHandler({
      profileLoader: this.profileLoader,
      memoryManager: this.memoryManager,
      contextManager: this.contextManager,
      sessionManager: this.sessionManager,
      executorConfig: {
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader
      },
      getSession: () => this.session
    }));

    logger.info('[MCP Server] Registered tools', {
      count: this.tools.size,
      tools: Array.from(this.tools.keys())
    });
  }

  /**
   * v10.5.0: Get current MCP session for Smart Routing
   * Used by tools to detect caller provider and implement same-provider optimization
   */
  getSession(): McpSession | null {
    return this.session;
  }

  /**
   * Handle MCP protocol messages
   */
  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, id } = request;
    const responseId = id ?? null;
    logger.debug('[MCP Server] Handling request', { method, id });

    try {
      switch (method) {
        case 'initialize':
          return await this.handleInitialize(request as McpInitializeRequest, responseId);
        case 'tools/list':
          return this.handleToolsList(request as McpToolListRequest, responseId);
        case 'tools/call':
          return await this.handleToolCall(request as McpToolCallRequest, responseId);
        case 'resources/list':
          return await this.handleResourcesList(request as McpResourceListRequest, responseId);
        case 'resources/read':
          return await this.handleResourceRead(request as McpResourceReadRequest, responseId);
        case 'resources/templates/list':
          return await this.handleResourceTemplatesList(request as McpResourceTemplateListRequest, responseId);
        case 'resources/templates/read':
          return await this.handleResourceTemplateRead(request as McpResourceTemplateReadRequest, responseId);
        case 'prompts/list':
          return await this.handlePromptsList(request as McpPromptListRequest, responseId);
        case 'prompts/get':
          return await this.handlePromptGet(request as McpPromptGetRequest, responseId);
        case '$/cancelRequest':
          return this.handleCancelRequest(request, responseId);
        default:
          return this.createErrorResponse(responseId, McpErrorCode.MethodNotFound, `Method not found: ${method}`);
      }
    } catch (error) {
      logger.error('[MCP Server] Request handling failed', { method, error });
      return this.createErrorResponse(responseId, McpErrorCode.InternalError, `Internal error: ${(error as Error).message}`);
    }
  }

  /**
   * Handle initialize request
   * BUG FIX (v9.0.1): Added mutex to prevent concurrent initialization race conditions
   * v10.5.0: Capture clientInfo for Smart Routing
   */
  private async handleInitialize(request: McpInitializeRequest, id: string | number | null): Promise<JsonRpcResponse> {
    // BUG FIX: Validate clientInfo exists before accessing fields
    // Previously threw internal error for malformed requests instead of proper MCP error
    const clientInfo = request.params?.clientInfo;
    if (!clientInfo || typeof clientInfo.name !== 'string' || typeof clientInfo.version !== 'string') {
      logger.warn('[MCP Server] Invalid initialize request: missing or invalid clientInfo', {
        hasParams: !!request.params,
        hasClientInfo: !!clientInfo,
        clientInfo
      });
      return this.createErrorResponse(id, McpErrorCode.InvalidRequest, 'Invalid initialize request: clientInfo with name and version is required');
    }
    logger.info('[MCP Server] Initialize request received (fast handshake mode)', { clientInfo });

    // v10.5.0: Store session info for Smart Routing
    // This allows us to detect caller and return context instead of spawning same provider
    this.session = {
      clientInfo: {
        name: clientInfo.name,
        version: clientInfo.version,
      },
      normalizedProvider: normalizeClientProvider(clientInfo.name),
      initTime: Date.now(),
    };

    logger.info('[MCP Server] Session established', {
      clientName: clientInfo.name,
      normalizedProvider: this.session.normalizedProvider,
    });

    // v2: Negotiate protocol version (prefer client request if supported)
    // FIX: Default to 2024-11-05 (most widely supported) when client doesn't specify
    // Claude Code v2.0.61 only supports 2024-11-05, not 2025-11-25 or 2024-12-05
    const requestedProtocol = request.params?.protocolVersion;
    const negotiated = MCP_SUPPORTED_VERSIONS.find(version => version === requestedProtocol) ?? '2024-11-05';
    this.negotiatedProtocolVersion = negotiated as SupportedMcpProtocolVersion;

    // OPTIMIZATION (v10.3.1): Fast handshake - no blocking initialization!
    // Services are initialized lazily on first tool call instead of during handshake.
    // This reduces MCP startup time from 18s to < 10ms.

    const response: McpInitializeResponse = {
      protocolVersion: negotiated,
      capabilities: this.buildCapabilities(),
      serverInfo: { name: 'automatosx', version: this.version }
    };

    logger.info('[MCP Server] Initialize handshake complete (< 1ms)');
    return { jsonrpc: '2.0', id, result: response };
  }

  /**
   * Handle tools/list request
   *
   * OPTIMIZATION (v10.3.1): Use static tool schemas (no initialization required)
   * Returns tool schemas immediately without waiting for services to initialize.
   */
  private handleToolsList(_request: McpToolListRequest, id: string | number | null): JsonRpcResponse {
    logger.debug('[MCP Server] Tools list requested (static schemas)');

    // Return static schemas - no initialization required!
    const tools = McpServer.getStaticToolSchemas().map(schema => ({
      ...schema,
      // If allowlist is set, hide tools not allowed
      ...(this.toolAllowlist && !this.toolAllowlist.has(schema.name) ? { hidden: true } : {})
    }));
    return { jsonrpc: '2.0', id, result: { tools } };
  }

  /**
   * Handle resources/list request (exposes agent profiles as MCP resources)
   */
  private async handleResourcesList(_request: McpResourceListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();

    const agents = await this.profileLoader.listProfiles();
    const resources = agents.map(agent => ({
      uri: `agent/${agent}`,
      name: `Agent: ${agent}`,
      description: `AutomatosX agent profile for ${agent}`,
      mimeType: 'text/markdown'
    }));

    return { jsonrpc: '2.0', id, result: { resources } };
  }

  /**
   * Handle resources/templates/list request (v2 capability)
   */
  private async handleResourceTemplatesList(_request: McpResourceTemplateListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.isV2Protocol()) {
      return this.createErrorResponse(id, McpErrorCode.MethodNotFound, 'resources/templates/list is only available in MCP v2');
    }

    await this.ensureInitialized();
    const resourceTemplates = listResourceTemplates();
    return { jsonrpc: '2.0', id, result: { resourceTemplates } };
  }

  /**
   * Handle prompts/list request (expose common starter prompts)
   */
  private async handlePromptsList(_request: McpPromptListRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();

    const prompts = [
      {
        name: 'agent_context',
        description: 'Get agent context and system prompt for a given agent name',
        arguments: [{ name: 'agent', required: true, description: 'Agent name' }]
      },
      {
        name: 'status',
        description: 'Get AutomatosX MCP status summary'
      }
    ];

    return { jsonrpc: '2.0', id, result: { prompts } };
  }

  /**
   * Handle prompts/get request
   */
  private async handlePromptGet(request: McpPromptGetRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();
    const name = request.params?.name;

    if (!name) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Prompt name is required');
    }

    switch (name) {
      case 'agent_context': {
        const agent = request.params?.arguments?.agent;
        if (!agent) {
          return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'agent argument is required');
        }
        try {
          const profile = await this.profileLoader.loadProfile(agent);
          // MCP protocol only supports 'text' content type for prompts
          const content = [
            { type: 'text' as const, text: `System prompt for ${agent}:\n${profile.systemPrompt || 'No system prompt defined.'}\n\nProfile:\n${JSON.stringify(profile, null, 2)}` }
          ];
          return { jsonrpc: '2.0', id, result: { prompt: { name, description: 'Agent context', arguments: [{ name: 'agent', required: true }] }, content } };
        } catch (error) {
          return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to load agent: ${(error as Error).message}`);
        }
      }
      case 'status': {
        const summary = {
          version: this.version,
          providerCount: this.router?.providerCount ?? 0,
          streamingNotifications: this.enableStreamingNotifications
        };
        // MCP protocol only supports 'text' content type for prompts
        const content = [
          { type: 'text' as const, text: `AutomatosX MCP status:\nVersion: ${summary.version}\nProviders: ${summary.providerCount}\nStreaming: ${summary.streamingNotifications}\n\nDetails:\n${JSON.stringify(summary, null, 2)}` }
        ];
        return { jsonrpc: '2.0', id, result: { prompt: { name, description: 'AutomatosX status' }, content } };
      }
      default:
        return this.createErrorResponse(id, McpErrorCode.MethodNotFound, `Prompt not found: ${name}`);
    }
  }

  /**
   * Handle resources/read request
   */
  private async handleResourceRead(request: McpResourceReadRequest, id: string | number | null): Promise<JsonRpcResponse> {
    await this.ensureInitialized();
    const uri = request.params?.uri;

    if (!uri || !uri.startsWith('agent/')) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Invalid resource URI. Expected agent/{name}.');
    }

    const agentName = uri.replace('agent/', '');
    try {
      const profile = await this.profileLoader.loadProfile(agentName);
      const summary = [
        `# ${agentName}`,
        profile.role ? `**Role:** ${profile.role}` : '',
        profile.abilities?.length ? `**Abilities:** ${profile.abilities.join(', ')}` : '',
        '',
        profile.systemPrompt || 'No system prompt defined.',
        '',
        '## Profile JSON',
        '```json',
        JSON.stringify(profile, null, 2),
        '```'
      ].filter(Boolean).join('\n');

      // MCP protocol only supports 'text' content type for resources
      const contents: McpResourceReadResponse['contents'] = [
        { type: 'text', text: summary }
      ];

      return { jsonrpc: '2.0', id, result: { uri, mimeType: 'text/markdown', contents } };
    } catch (error) {
      return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to read resource: ${(error as Error).message}`);
    }
  }

  /**
   * Handle resources/templates/read request (v2 capability)
   */
  private async handleResourceTemplateRead(request: McpResourceTemplateReadRequest, id: string | number | null): Promise<JsonRpcResponse> {
    if (!this.isV2Protocol()) {
      return this.createErrorResponse(id, McpErrorCode.MethodNotFound, 'resources/templates/read is only available in MCP v2');
    }

    await this.ensureInitialized();
    const uri = request.params?.uri;
    try {
      if (!uri) {
        return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'Missing resource template URI');
      }
      const resolved: McpResourceTemplateReadResponse = await resolveResourceTemplate(
        uri,
        request.params?.variables,
        this.profileLoader,
        this.workspaceManager
      );
      return { jsonrpc: '2.0', id, result: resolved };
    } catch (error) {
      return this.createErrorResponse(id, McpErrorCode.InternalError, `Failed to read resource template: ${(error as Error).message}`);
    }
  }

  /**
   * Validate tool input against its JSON schema.
   * Returns null if valid, or error message string if invalid.
   */
  private validateToolInput(toolName: string, input: Record<string, unknown>): string | null {
    const validate = this.compiledValidators.get(toolName);
    if (!validate) return `No validator found for tool: ${toolName}`;
    if (validate(input)) return null;
    return this.ajv.errorsText(validate.errors);
  }

  /** Create MCP tool response wrapper */
  private createToolResponse(id: string | number | null, result: unknown, isError = false): JsonRpcResponse {
    // MCP protocol only supports specific content types: text, image, audio, resource_link, resource
    // For non-string results, serialize to JSON text
    const text = typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2);

    const content: McpToolCallResponse['content'] = [{ type: 'text', text }];
    const response: McpToolCallResponse = { content, ...(isError && { isError }) };
    return { jsonrpc: '2.0', id, result: response };
  }

  /**
   * Handle client cancellation ($/cancelRequest)
   */
  private handleCancelRequest(request: JsonRpcRequest, id: string | number | null): JsonRpcResponse {
    const params = (request as { params?: { id?: string | number; requestId?: string | number } }).params;
    const cancelId = params?.id ?? params?.requestId;

    if (cancelId === undefined || cancelId === null) {
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, 'cancelRequest requires an id to cancel');
    }

    this.cancelledRequests.add(cancelId);
    logger.info('[MCP Server] Cancellation requested', { cancelId });

    // Abort handler if running
    const controller = this.requestControllers.get(cancelId);
    controller?.abort();

    // Respond with null result to acknowledge cancellation
    return { jsonrpc: '2.0', id, result: null };
  }

  /**
   * Ensure services are initialized (lazy initialization on first call)
   * OPTIMIZATION (v10.3.1): Moves 15-20s initialization from handshake to first request
   */
  private async ensureInitialized(): Promise<void> {
    await this.initializationMutex.runExclusive(async () => {
      if (this.initialized) return;

      if (!this.initializationPromise) {
        logger.info('[MCP Server] First tool call - initializing services (lazy loading)...');
        this.initializationPromise = (async () => {
          try {
            const startTime = Date.now();
            await this.initializeServices();
            this.registerTools();
            this.initialized = true;
            logger.info('[MCP Server] Services initialized successfully', { duration: `${Date.now() - startTime}ms` });
          } catch (error) {
            logger.error('[MCP Server] Initialization failed', {
              error: error instanceof Error ? error.message : String(error)
            });
            this.initializationPromise = null; // Allow retry on failure
            throw error;
          }
        })();
      }
      await this.initializationPromise;
    });
  }

  /**
   * Handle tools/call request
   * v12.5.4: Added streaming progress notifications
   */
  private async handleToolCall(request: McpToolCallRequest, id: string | number | null): Promise<JsonRpcResponse> {
    const { name, arguments: args } = request.params;
    logger.info('[MCP Server] Tool call', { tool: name });
    const requestId = id ?? null;

    // Allowlist enforcement
    if (this.toolAllowlist && !this.toolAllowlist.has(name)) {
      return this.createErrorResponse(id, McpErrorCode.InvalidRequest, `Tool not allowed: ${name}`);
    }

    // Auth enforcement for tools marked requiresAuth
    const schema = this.toolSchemas.find(t => t.name === name);
    if (schema?.requiresAuth && this.authToken) {
      const provided = (args as Record<string, unknown>)?.auth_token;
      if (provided !== this.authToken) {
        return this.createErrorResponse(id, McpErrorCode.InvalidRequest, 'Unauthorized: invalid auth token');
      }
    }

    // Create abort controller for this request (if id provided)
    const abortController = requestId !== null ? new AbortController() : null;
    if (requestId !== null && abortController) {
      this.requestControllers.set(requestId, abortController);
    }

    // If client already cancelled this request, short-circuit
    if (requestId !== null && this.cancelledRequests.has(requestId)) {
      this.cancelledRequests.delete(requestId);
      this.requestControllers.delete(requestId);
      return this.createErrorResponse(requestId, McpErrorCode.RequestCancelled, 'Request was cancelled');
    }

    // v12.5.4: Send progress notification for tool execution start
    const progressToken = this.enableStreamingNotifications
      ? sendMcpProgressBegin(`Tool: ${name}`, this.getToolProgressMessage(name, args))
      : '';

    await this.ensureInitialized();

    const handler = this.tools.get(name);
    if (!handler) {
      if (progressToken) sendMcpProgressEnd(progressToken, `Tool not found: ${name}`);
      return this.createErrorResponse(id, McpErrorCode.ToolNotFound, `Tool not found: ${name}`);
    }

    const validationError = this.validateToolInput(name, args || {});
    if (validationError) {
      if (progressToken) sendMcpProgressEnd(progressToken, 'Validation failed');
      return this.createErrorResponse(id, McpErrorCode.InvalidParams, validationError);
    }

    try {
      const startTime = Date.now();
      const result = await handler(args || {}, { signal: abortController?.signal });
      const duration = Date.now() - startTime;

      // If a cancellation arrived while running, honor it
      if (requestId !== null && this.cancelledRequests.has(requestId)) {
        this.cancelledRequests.delete(requestId);
        this.requestControllers.delete(requestId);
        if (progressToken) sendMcpProgressEnd(progressToken, 'Cancelled');
        return this.createErrorResponse(requestId, McpErrorCode.RequestCancelled, 'Request was cancelled');
      }

      // v12.5.4: Send completion notification
      if (progressToken) {
        sendMcpProgressEnd(progressToken, `Done (${duration}ms)`);
      }

      return this.createToolResponse(id, result);
    } catch (error) {
      const err = error as Error;
      const cancelled = err?.name === 'AbortError' || err?.message?.toLowerCase().includes('cancel');

      if (cancelled) {
        logger.info('[MCP Server] Tool execution cancelled', { tool: name, id: requestId ?? undefined });
        if (progressToken) sendMcpProgressEnd(progressToken, 'Cancelled');
        return this.createErrorResponse(id, McpErrorCode.RequestCancelled, 'Request was cancelled');
      }

      logger.error('[MCP Server] Tool execution failed', { tool: name, error });
      if (progressToken) sendMcpProgressEnd(progressToken, `Error: ${err?.message?.substring(0, 50) || 'Unknown'}`);
      return this.createToolResponse(id, `Error: ${err?.message ?? String(error)}`, true);
    } finally {
      if (requestId !== null) {
        this.cancelledRequests.delete(requestId);
        this.requestControllers.delete(requestId);
      }
    }
  }

  /**
   * v12.5.4: Generate brief progress message for tool execution
   */
  private getToolProgressMessage(toolName: string, args: Record<string, unknown> | undefined): string {
    // Provide context-specific messages for key tools
    switch (toolName) {
      case 'run_agent': {
        const agent = args?.agent as string | undefined;
        const task = args?.task as string | undefined;
        if (agent) return `Running ${agent} agent...`;
        if (task) return `Auto-selecting agent for task...`;
        return 'Executing agent...';
      }
      case 'get_agent_context': {
        const agent = args?.agent as string | undefined;
        return agent ? `Loading ${agent} context...` : 'Loading agent context...';
      }
      case 'search_memory': {
        const query = args?.query as string | undefined;
        return query ? `Searching: "${query.substring(0, 30)}..."` : 'Searching memory...';
      }
      case 'list_agents':
        return 'Listing available agents...';
      case 'get_status':
        return 'Getting system status...';
      case 'get_capabilities':
        return 'Getting capabilities...';
      case 'session_create':
        return 'Creating session...';
      case 'session_list':
        return 'Listing sessions...';
      case 'memory_add':
        return 'Adding to memory...';
      case 'memory_list':
        return 'Listing memory entries...';
      case 'memory_export':
        return 'Exporting memory...';
      case 'memory_import':
        return 'Importing memory...';
      case 'implement_and_document':
        return 'Implementing and documenting...';
      case 'create_task':
        return 'Creating task...';
      case 'run_task':
        return 'Running task...';
      default:
        return `Executing ${toolName}...`;
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: string | number | null, code: McpErrorCode, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  /**
   * Write MCP-compliant response using newline-delimited framing
   *
   * v12.2.0: Changed from Content-Length to newline-delimited framing
   * per official MCP specification: https://spec.modelcontextprotocol.io/specification/basic/transports/
   *
   * Format: JSON message followed by newline character
   * Reference: @modelcontextprotocol/sdk serializeMessage() uses: JSON.stringify(message) + '\n'
   */
  private writeResponse(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    // Official MCP spec: messages are newline-delimited, no Content-Length header
    process.stdout.write(json + '\n');
    logger.debug('[MCP Server] Response sent', { id: response.id, length: json.length });
  }

  /**
   * Start stdio server with hybrid framing support
   *
   * v12.3.1: Supports BOTH framing formats for maximum compatibility:
   * 1. Newline-delimited (official MCP spec, used by Claude Code, @modelcontextprotocol/sdk)
   * 2. Content-Length (LSP-style, used by ax-glm, ax-grok, some older clients)
   *
   * Detection: If first line starts with "Content-Length:", use LSP framing.
   * Otherwise, use newline-delimited framing.
   *
   * BUG FIX (v9.0.1): Added iteration limit and buffer size checks to prevent infinite loops
   */
  async start(): Promise<void> {
    logger.info('[MCP Server] Starting stdio JSON-RPC server...');
    let buffer = '';
    let detectedFraming: 'newline' | 'content-length' | null = null;

    process.stdin.on('data', (chunk: Buffer) => {
      // BUG FIX: Use mutex to serialize stdin chunk processing
      // Prevents race conditions when multiple data events fire rapidly
      void this.stdinMutex.runExclusive(async () => {
        buffer += chunk.toString('utf-8');

        // BUG FIX: Check buffer size to prevent memory exhaustion
        if (buffer.length > STDIO_MAX_BUFFER_SIZE) {
          logger.error('[MCP Server] Buffer size exceeded maximum', {
            bufferSize: buffer.length,
            maxSize: STDIO_MAX_BUFFER_SIZE
          });
          buffer = ''; // Reset buffer
          return;
        }

        // Auto-detect framing on first message
        if (detectedFraming === null) {
          if (buffer.startsWith('Content-Length:')) {
            detectedFraming = 'content-length';
            logger.info('[MCP Server] Detected Content-Length framing (LSP-style)');
          } else if (buffer.includes('{')) {
            detectedFraming = 'newline';
            logger.info('[MCP Server] Detected newline-delimited framing (MCP spec)');
          }
        }

        // BUG FIX: Add iteration counter to prevent infinite loops
        let iterations = 0;

        while (iterations < STDIO_MAX_ITERATIONS) {
          iterations++;

          let jsonMessage: string | null = null;

          if (detectedFraming === 'content-length') {
            // Content-Length framing (LSP-style)
            // Format: Content-Length: <length>\r\n\r\n<json>
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) break; // Headers not complete

            const headers = buffer.slice(0, headerEnd);
            const contentLengthMatch = headers.match(/Content-Length:\s*(\d+)/i);
            if (!contentLengthMatch) {
              // Skip malformed header line and continue
              const lineEnd = buffer.indexOf('\n');
              if (lineEnd !== -1) {
                buffer = buffer.slice(lineEnd + 1);
                continue;
              }
              break;
            }

            const contentLength = parseInt(contentLengthMatch[1]!, 10);
            const bodyStart = headerEnd + 4; // Skip \r\n\r\n
            const bodyEnd = bodyStart + contentLength;

            if (buffer.length < bodyEnd) break; // Body not complete

            jsonMessage = buffer.slice(bodyStart, bodyEnd);
            buffer = buffer.slice(bodyEnd);
          } else {
            // Newline-delimited framing (official MCP spec)
            const newlineIndex = buffer.indexOf('\n');
            if (newlineIndex === -1) break; // No complete message yet

            // Extract the message (strip trailing \r if present for Windows compatibility)
            jsonMessage = buffer.slice(0, newlineIndex);
            if (jsonMessage.endsWith('\r')) {
              jsonMessage = jsonMessage.slice(0, -1);
            }
            buffer = buffer.slice(newlineIndex + 1);

            // Skip empty lines
            if (jsonMessage.trim() === '') continue;
          }

          if (!jsonMessage) break;

          // Validate message size
          if (jsonMessage.length > STDIO_MAX_MESSAGE_SIZE) {
            logger.error('[MCP Server] Message size exceeded maximum', {
              messageSize: jsonMessage.length,
              maxSize: STDIO_MAX_MESSAGE_SIZE
            });
            this.writeResponse({
              jsonrpc: '2.0',
              id: null,
              error: {
                code: McpErrorCode.InvalidRequest,
                message: `Message too large: ${jsonMessage.length} bytes`
              }
            });
            continue;
          }

          try {
            const request = JSON.parse(jsonMessage) as JsonRpcRequest;
            logger.debug('[MCP Server] Request received', { method: request.method, id: request.id });
            const response = await this.handleRequest(request);
            if (request.id !== undefined && request.id !== null) {
              this.writeResponse(response);
            }
          } catch (error) {
            logger.error('[MCP Server] Failed to parse or handle request', { error: (error as Error).message });
            this.writeResponse({ jsonrpc: '2.0', id: null, error: { code: McpErrorCode.ParseError, message: 'Parse error: Invalid JSON' } });
          }
        }

        // BUG FIX: Warn if iteration limit reached
        if (iterations >= STDIO_MAX_ITERATIONS) {
          logger.warn('[MCP Server] Maximum iterations reached in message processing', {
            iterations,
            bufferSize: buffer.length
          });
        }
      });
    });

    // Common shutdown handler
    const shutdown = (reason: string) => {
      logger.info(`[MCP Server] ${reason}`);
      this.cleanup().finally(() => process.exit(0));
    };

    process.stdin.on('end', () => shutdown('Server stopped (stdin closed)'));
    process.on('SIGINT', () => shutdown('Received SIGINT, shutting down...'));
    process.on('SIGTERM', () => shutdown('Received SIGTERM, shutting down...'));

    logger.info('[MCP Server] Server started successfully (hybrid framing: newline + Content-Length)');
  }
}
