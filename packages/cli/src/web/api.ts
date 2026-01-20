/**
 * Web API Handler
 *
 * Provides REST API endpoints for the web dashboard.
 * Wraps existing domain services to expose via HTTP.
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DATA_DIR_NAME, AGENTS_FILENAME, getErrorMessage } from '@defai.digital/contracts';

// Get the directory of this module (for finding bundled examples)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dashboard types for web API responses
 * These were previously in the TUI schema but are needed for the web dashboard
 * Note: Using | undefined for optional fields to support exactOptionalPropertyTypes
 */
interface DashboardProviderStatus {
  providerId: string;
  name: string;
  available: boolean;
  latencyMs: number | undefined;
  circuitState: 'closed' | 'open' | 'half-open';
  lastUsed: string | undefined;
}

interface DashboardSessionSummary {
  sessionId: string;
  initiator: string;
  task: string;
  status: 'active' | 'completed' | 'failed';
  participantCount: number;
  createdAt: string;
  durationMs: number | undefined;
}

interface DashboardAgentSummary {
  agentId: string;
  displayName: string;
  description: string;
  enabled: boolean;
  capabilities: string[];
  executionCount: number;
  lastExecuted: string | undefined;
  // PRD-2026-004: Meta-agent fields for list display
  metaAgent: boolean | undefined;
  archetype: boolean | undefined;
}

interface DashboardTraceSummary {
  traceId: string;
  name: string;
  command: string | undefined;
  status: 'success' | 'failure' | 'running';
  startTime: string;
  durationMs: number | undefined;
  eventCount: number;
  providers: string[] | undefined;
}
import {
  getProviderRegistry,
  getTraceStore,
  getSessionManager as getSharedSessionManager,
  type SessionManager,
} from '../bootstrap.js';
import {
  createPersistentAgentRegistry,
  type AgentRegistry,
} from '@defai.digital/agent-domain';
import {
  createWorkflowLoader,
  findWorkflowDir,
  type WorkflowLoader,
} from '@defai.digital/workflow-engine';
import { CLI_VERSION } from '../commands/help.js';
import { getProviderStatus as checkProviderHealth } from '../commands/status.js';

// Workflow loader singleton
let workflowLoader: WorkflowLoader | undefined;
let workflowLoaderPromise: Promise<WorkflowLoader> | undefined;

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
  // __dirname is 'dist/web/', bundled is at '../../bundled/workflows'
  const bundledPath = path.join(__dirname, '..', '..', 'bundled', 'workflows');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Try development path (when running from source repo)
  // __dirname is packages/cli/src/web, so go up 4 levels to repo root
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

/**
 * Get or create the workflow loader (thread-safe)
 * Uses atomic promise assignment pattern for safety
 */
async function getWorkflowLoader(): Promise<WorkflowLoader> {
  if (workflowLoader) return workflowLoader;

  if (!workflowLoaderPromise) {
    // Assign promise immediately to prevent potential race conditions
    workflowLoaderPromise = Promise.resolve().then(() => {
      const workflowsDir = getExampleWorkflowsDir();
      const loader = createWorkflowLoader({ workflowsDir });
      workflowLoader = loader;
      return loader;
    });
  }

  return workflowLoaderPromise;
}

// Lazy singletons with Promise-based initialization to prevent race conditions
let agentRegistry: AgentRegistry | undefined;
let agentRegistryPromise: Promise<AgentRegistry> | undefined;

/**
 * Get the global agent storage path (same as MCP server).
 * Uses home directory for consistency across all AutomatosX components.
 */
function getGlobalAgentStoragePath(): string {
  return path.join(os.homedir(), DATA_DIR_NAME, AGENTS_FILENAME);
}

/**
 * Get the session manager from CLI bootstrap (shared instance)
 * This ensures the web dashboard sees the same sessions as other CLI components
 */
function getSessionManager(): SessionManager {
  return getSharedSessionManager();
}

/**
 * Get or create the agent registry (thread-safe)
 * Uses atomic promise assignment pattern for safety
 */
async function getAgentRegistry(): Promise<AgentRegistry> {
  if (agentRegistry) return agentRegistry;

  if (!agentRegistryPromise) {
    // Assign promise immediately to prevent potential race conditions
    agentRegistryPromise = Promise.resolve().then(() => {
      const registry = createPersistentAgentRegistry({
        storagePath: getGlobalAgentStoragePath(),
      });
      agentRegistry = registry;
      return registry;
    });
  }

  return agentRegistryPromise;
}

/**
 * API response type
 */
interface APIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Cached provider status (set at monitor startup)
 */
let cachedProviderStatus: DashboardProviderStatus[] | null = null;

/**
 * Set the cached provider status (called from monitor.ts at startup)
 */
export function setCachedProviderStatus(providers: DashboardProviderStatus[]): void {
  cachedProviderStatus = providers;
}

/**
 * Create the API handler function
 */
export function createAPIHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '';
    const apiPath = url.replace('/api', '');

    try {
      let response: APIResponse;

      // Check for parameterized routes first
      const traceTreeMatch = apiPath.match(/^\/traces\/([a-f0-9-]+)\/tree$/i);
      const traceClassificationMatch = apiPath.match(/^\/traces\/([a-f0-9-]+)\/classification$/i);
      const traceDetailMatch = apiPath.match(/^\/traces\/([a-f0-9-]+)$/i);
      const workflowDetailMatch = apiPath.match(/^\/workflows\/([a-z0-9-]+)$/i);
      const providerHistoryMatch = apiPath.match(/^\/providers\/([a-z0-9-]+)\/history$/i);
      const agentHistoryMatch = apiPath.match(/^\/agents\/([a-z0-9-_]+)\/history$/i);
      const agentDetailMatch = apiPath.match(/^\/agents\/([a-z0-9-_]+)$/i);
      const workflowEventsMatch = apiPath.match(/^\/workflows\/([a-z0-9-]+)\/events$/i);
      const traceSearchMatch = apiPath.match(/^\/traces\/search\?(.*)$/i) || apiPath.match(/^\/traces\/search$/i);

      // INV-TR-020 through INV-TR-024: Hierarchical trace tree endpoint
      if (traceTreeMatch && traceTreeMatch[1]) {
        const traceId = traceTreeMatch[1];
        response = await handleTraceTree(traceId);
      } else if (traceClassificationMatch && traceClassificationMatch[1]) {
        // PRD-2026-003: Classification observability endpoint
        const traceId = traceClassificationMatch[1];
        response = await handleTraceClassification(traceId);
      } else if (traceDetailMatch && traceDetailMatch[1]) {
        const traceId = traceDetailMatch[1];
        response = await handleTraceDetail(traceId);
      } else if (workflowDetailMatch && workflowDetailMatch[1]) {
        const workflowId = workflowDetailMatch[1];
        response = await handleWorkflowDetail(workflowId);
      } else if (providerHistoryMatch && providerHistoryMatch[1]) {
        const providerId = providerHistoryMatch[1];
        response = await handleProviderHistory(providerId);
      } else if (agentHistoryMatch && agentHistoryMatch[1]) {
        const agentId = agentHistoryMatch[1];
        response = await handleAgentHistory(agentId);
      } else if (agentDetailMatch && agentDetailMatch[1]) {
        const agentId = agentDetailMatch[1];
        response = await handleAgentDetail(agentId);
      } else if (workflowEventsMatch && workflowEventsMatch[1]) {
        const workflowId = workflowEventsMatch[1];
        response = await handleWorkflowEvents(workflowId);
      } else if (traceSearchMatch) {
        const queryString = traceSearchMatch[1] ?? '';
        const params = new URLSearchParams(queryString);
        const searchFilters: { providerId?: string; agentId?: string; type?: string; limit?: number } = {};
        const pId = params.get('providerId');
        const aId = params.get('agentId');
        const pType = params.get('type');
        const pLimit = params.get('limit');
        if (pId) searchFilters.providerId = pId;
        if (aId) searchFilters.agentId = aId;
        if (pType) searchFilters.type = pType;
        if (pLimit) {
          const limit = parseInt(pLimit, 10);
          if (!isNaN(limit) && limit > 0 && limit <= 200) {
            searchFilters.limit = limit;
          }
        }
        response = await handleTraceSearch(searchFilters);
      } else {
        // Static routes
        switch (apiPath) {
          case '/status':
            response = await handleStatus();
            break;
          case '/providers':
            response = await handleProviders();
            break;
          case '/providers/refresh':
            // POST endpoint to refresh provider health status
            if (req.method === 'POST') {
              response = await handleProviderRefresh();
            } else {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
              return;
            }
            break;
          case '/sessions':
            response = await handleSessions();
            break;
          case '/agents':
            response = await handleAgents();
            break;
          case '/traces':
            response = await handleTraces();
            break;
          case '/workflows':
            response = await handleWorkflows();
            break;
          case '/metrics':
            response = await handleMetrics();
            break;
          case '/health':
            response = { success: true, data: { status: 'ok', version: CLI_VERSION } };
            break;
          default:
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
            return;
        }
      }

      let statusCode = 200;
      if (!response.success) {
        const errorMsg = (response as { error?: string }).error ?? '';
        statusCode = errorMsg.toLowerCase().includes('not found') ? 404 : 400;
      }
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: getErrorMessage(error, 'Internal server error'),
      }));
    }
  };
}

/**
 * Get full system status
 */
async function handleStatus(): Promise<APIResponse> {
  const [providers, sessions, agents, traces, metrics, classificationMetrics] = await Promise.all([
    getProviderData(),
    getSessionData(),
    getAgentData(),
    getTraceData(),
    getMetricsData(),
    getClassificationMetrics(),
  ]);

  // Determine health status
  const healthyProviders = providers.filter(p => p.available).length;
  const totalProviders = providers.length;
  const healthStatus = totalProviders === 0 ? 'healthy' :
    healthyProviders === totalProviders ? 'healthy' :
    healthyProviders > 0 ? 'degraded' : 'unhealthy';

  return {
    success: true,
    data: {
      status: healthStatus,
      version: CLI_VERSION,
      uptime: formatUptime(process.uptime()),
      providers,
      sessions,
      agents,
      traces,
      metrics,
      // PRD-2026-003: Classification observability
      classification: classificationMetrics,
    },
  };
}

/**
 * Get provider status
 */
async function handleProviders(): Promise<APIResponse> {
  const providers = await getProviderData();
  return { success: true, data: providers };
}

/**
 * Helper to normalize circuit state for dashboard
 */
function normalizeCircuitState(state: string | undefined): 'closed' | 'open' | 'half-open' {
  if (state === 'halfOpen') return 'half-open';
  if (state === 'open') return 'open';
  return 'closed';
}

/**
 * Refresh provider status by running actual health checks
 * This triggers real LLM calls to test each provider
 */
async function handleProviderRefresh(): Promise<APIResponse> {
  try {
    // Run real health checks (sends "hello" to each provider)
    const providerStatuses = await checkProviderHealth(false);

    // Convert to dashboard format and update cache
    const dashboardProviders: DashboardProviderStatus[] = providerStatuses.map(p => ({
      providerId: p.providerId,
      name: p.providerId,
      available: p.available,
      latencyMs: p.latencyMs,
      circuitState: normalizeCircuitState(p.circuitState),
      lastUsed: undefined,
    }));

    // Update the cached status
    setCachedProviderStatus(dashboardProviders);

    return {
      success: true,
      data: {
        providers: dashboardProviders,
        refreshedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to refresh provider status'),
    };
  }
}

/**
 * Get sessions
 */
async function handleSessions(): Promise<APIResponse> {
  const sessions = await getSessionData();
  return { success: true, data: sessions };
}

/**
 * Get agents
 */
async function handleAgents(): Promise<APIResponse> {
  const agents = await getAgentData();
  return { success: true, data: agents };
}

/**
 * Get agent detail with full profile including workflow
 */
async function handleAgentDetail(agentId: string): Promise<APIResponse> {
  try {
    const registry = await getAgentRegistry();
    const agent = await registry.get(agentId);

    if (!agent) {
      return { success: false, error: `Agent not found: ${agentId}` };
    }

    // Get execution stats from traces
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(100);
    let executionCount = 0;
    let successCount = 0;
    let totalDurationMs = 0;

    for (const trace of traces) {
      const events = await traceStore.getTrace(trace.traceId);
      const hasAgent = events.some(e => {
        const ctx = e.context as Record<string, unknown> | undefined;
        return ctx?.agentId === agentId;
      });
      if (hasAgent) {
        executionCount++;
        if (trace.status === 'success') successCount++;
        if (trace.durationMs) totalDurationMs += trace.durationMs;
      }
    }

    // PRD-2026-004: Build response with all meta-agent fields
    const responseData: Record<string, unknown> = {
      agentId: agent.agentId,
      displayName: agent.displayName ?? agent.agentId,
      description: agent.description,
      version: agent.version,
      role: agent.role,
      team: agent.team,
      enabled: agent.enabled,
      capabilities: agent.capabilities ?? [],
      tags: agent.tags ?? [],
      systemPrompt: agent.systemPrompt,
      workflow: agent.workflow?.map(step => ({
        stepId: step.stepId,
        name: step.name,
        type: step.type,
        config: step.config,
        dependencies: step.dependencies,
        condition: step.condition,
      })) ?? [],
      orchestration: agent.orchestration,
      personality: agent.personality,
      expertise: agent.expertise,
      // Stats
      stats: {
        executionCount,
        successRate: executionCount > 0 ? successCount / executionCount : 0,
        avgDurationMs: executionCount > 0 ? Math.round(totalDurationMs / executionCount) : 0,
      },
    };

    // PRD-2026-004: Add meta-agent architecture fields
    if (agent.metaAgent !== undefined) responseData.metaAgent = agent.metaAgent;
    if (agent.archetype !== undefined) responseData.archetype = agent.archetype;
    if (agent.orchestrates?.length) responseData.orchestrates = agent.orchestrates;
    if (agent.replaces?.length) responseData.replaces = agent.replaces;
    if (agent.canDelegateToArchetypes?.length) responseData.canDelegateToArchetypes = agent.canDelegateToArchetypes;
    if (agent.canDelegateToMetaAgents?.length) responseData.canDelegateToMetaAgents = agent.canDelegateToMetaAgents;

    // PRD-2026-004: Add task classifier config
    if (agent.taskClassifier) {
      responseData.taskClassifier = {
        enabled: agent.taskClassifier.enabled ?? true,
        rules: agent.taskClassifier.rules?.map(rule => ({
          pattern: rule.pattern,
          taskType: rule.taskType,
          workflow: rule.workflow,
          priority: rule.priority ?? 50,
        })) ?? [],
        defaultWorkflow: agent.taskClassifier.defaultWorkflow,
        fuzzyMatching: agent.taskClassifier.fuzzyMatching,
        minConfidence: agent.taskClassifier.minConfidence,
      };
    }

    // PRD-2026-004: Add dynamic capabilities config
    if (agent.dynamicCapabilities) {
      responseData.dynamicCapabilities = agent.dynamicCapabilities;
    }

    // PRD-2026-004: Add review modes config
    if (agent.reviewModes) {
      responseData.reviewModes = agent.reviewModes;
    }

    // PRD-2026-004: Add capability mappings
    if (agent.capabilityMappings?.length) {
      responseData.capabilityMappings = agent.capabilityMappings.map(mapping => ({
        taskType: mapping.taskType,
        workflowRef: mapping.workflowRef,
        abilities: mapping.abilities,
        priority: mapping.priority,
        description: mapping.description,
      }));
    }

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch agent details'),
    };
  }
}

/**
 * Get traces
 */
async function handleTraces(): Promise<APIResponse> {
  const traces = await getTraceData();
  return { success: true, data: traces };
}

/**
 * Get metrics
 */
async function handleMetrics(): Promise<APIResponse> {
  const metrics = await getMetricsData();
  return { success: true, data: metrics };
}

/**
 * Get workflows list
 */
async function handleWorkflows(): Promise<APIResponse> {
  const workflows = await getWorkflowData();
  return { success: true, data: workflows };
}

/**
 * Get detailed trace with events - enhanced with input/output info
 */
async function handleTraceDetail(traceId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const events = await traceStore.getTrace(traceId);

    if (!events || events.length === 0) {
      return { success: false, error: `Trace not found: ${traceId}` };
    }

    // Build timeline from events
    const timeline = events.map(event => ({
      eventId: event.eventId,
      type: event.type,
      timestamp: event.timestamp,
      durationMs: event.durationMs,
      status: event.status,
      context: event.context,
      payload: event.payload,
    }));

    // Derive trace metadata from events
    const startEvent = events.find(e => e.type === 'run.start' || e.type === 'discussion.start');
    const endEvent = events.find(e => e.type === 'run.end' || e.type === 'discussion.end');
    const stepEvents = events.filter(e => e.type === 'step.end');
    const errorEvents = events.filter(e => e.type === 'error');

    // Extract detailed info from start event
    const startPayload = startEvent?.payload;
    const endPayload = endEvent?.payload;
    const context = startEvent?.context as Record<string, unknown> | undefined;

    // Determine command type and extract relevant info
    const command = startPayload?.command as string | undefined;
    const tool = startPayload?.tool as string | undefined;
    const workflowId = context?.workflowId as string | undefined;
    // First try to detect from explicit command/tool field
    let commandType: string;
    if (command?.includes('discuss')) {
      commandType = 'discuss';
    } else if (command?.includes('agent') || command === 'agent') {
      commandType = 'agent';
    } else if (command?.includes('call')) {
      commandType = 'call';
    } else if (tool?.startsWith('research') || workflowId?.startsWith('research')) {
      commandType = 'research';
    } else if (tool?.startsWith('review') || workflowId?.startsWith('review')) {
      commandType = 'review';
    } else {
      // Fallback: detect from context/payload fields when command is not set
      const hasAgentId = context?.agentId || startPayload?.agentId;
      const hasTopic = startPayload?.topic;
      const hasPrompt = startPayload?.prompt;
      const hasQuery = startPayload?.query;
      commandType = hasAgentId ? 'agent' :
                   hasTopic ? 'discuss' :
                   hasQuery ? 'research' :
                   hasPrompt ? 'call' : 'unknown';
    }

    // Extract input/output based on command type
    let input: Record<string, unknown> | undefined;
    let output: Record<string, unknown> | undefined;
    let provider: string | undefined;
    let model: string | undefined;

    if (commandType === 'call') {
      provider = context?.provider as string | undefined;
      model = context?.model as string | undefined;
      input = {
        prompt: startPayload?.prompt, // Full prompt content
        promptLength: startPayload?.promptLength,
        mode: startPayload?.mode,
        hasSystemPrompt: startPayload?.hasSystemPrompt,
      };
      output = {
        response: endPayload?.response, // Full response content
        responseLength: endPayload?.responseLength,
        success: endPayload?.success,
        latencyMs: endPayload?.latencyMs,
        usage: endPayload?.usage,
      };
    } else if (commandType === 'discuss') {
      input = {
        topic: startPayload?.topic,
        pattern: startPayload?.pattern,
        providers: startPayload?.providers,
        rounds: startPayload?.rounds,
        recursive: startPayload?.recursive,
      };
      output = {
        responses: endPayload?.responses, // Provider responses
        consensusReached: endPayload?.consensusReached,
        consensus: endPayload?.consensus, // Consensus metadata (method, agreementScore, etc.)
        synthesis: endPayload?.synthesis, // Final synthesized text
        rounds: endPayload?.rounds,
        success: endPayload?.success,
      };
    } else if (commandType === 'agent') {
      const agentId = startPayload?.agentId as string | undefined;
      // Support both 'task' (CLI) and 'input' (MCP) field names
      const taskOrInput = startPayload?.task ?? startPayload?.input;
      // Extract provider from run.end payload (finalProvider)
      provider = endPayload?.finalProvider as string | undefined;
      input = {
        agentId,
        task: taskOrInput,
        command: startPayload?.command,
      };
      output = {
        stepCount: endPayload?.stepCount,
        result: endPayload?.result ?? endPayload?.output,
        // Include rich payload data for dashboard visibility
        finalContent: endPayload?.finalContent,
        agentDisplayName: endPayload?.agentDisplayName,
        agentDescription: endPayload?.agentDescription,
        inputTask: endPayload?.inputTask,
        tokenUsage: endPayload?.tokenUsage,
        stepResults: endPayload?.stepResults,
        success: endPayload?.success,
        error: endPayload?.error,
      };
    } else if (commandType === 'research') {
      input = {
        query: startPayload?.query,
        tool: startPayload?.tool,
        sources: startPayload?.sources,
        maxSources: startPayload?.maxSources,
        synthesize: startPayload?.synthesize,
      };
      output = {
        // Full artifacts for dashboard visibility
        query: endPayload?.query,
        sources: endPayload?.sources,
        synthesis: endPayload?.synthesis,
        codeExamples: endPayload?.codeExamples,
        confidence: endPayload?.confidence,
        warnings: endPayload?.warnings,
        // For fetch operations
        url: endPayload?.url,
        title: endPayload?.title,
        contentPreview: endPayload?.contentPreview,
        codeBlocks: endPayload?.codeBlocks,
        reliability: endPayload?.reliability,
        success: endPayload?.success,
        error: endPayload?.error,
      };
    } else if (commandType === 'review') {
      // Extract provider from run.end payload (providerId)
      provider = endPayload?.providerId as string | undefined;
      input = {
        paths: startPayload?.paths,
        focus: startPayload?.focus,
        context: startPayload?.context,
        tool: startPayload?.tool,
        dryRun: startPayload?.dryRun,
      };
      output = {
        // Full review results for dashboard visibility
        summary: endPayload?.summary,
        comments: endPayload?.comments,
        filesReviewed: endPayload?.filesReviewed,
        filesReviewedCount: endPayload?.filesReviewedCount,
        linesAnalyzed: endPayload?.linesAnalyzed,
        commentCount: endPayload?.commentCount,
        providerId: endPayload?.providerId,
        success: endPayload?.success,
        error: endPayload?.error,
      };
    }

    // Build workflow steps from step events with full details
    const workflowSteps = stepEvents.map(step => {
      const stepPayload = step.payload;
      const stepContext = step.context as Record<string, unknown> | undefined;
      return {
        stepId: stepPayload?.stepId ?? stepContext?.stepId,
        iteration: stepPayload?.iteration,
        intent: stepPayload?.intent,
        action: stepPayload?.action,
        prompt: stepPayload?.prompt, // Full prompt for this step
        response: stepPayload?.response, // Full response for this step
        responseLength: stepPayload?.responseLength,
        success: stepPayload?.success,
        durationMs: step.durationMs,
        latencyMs: stepPayload?.latencyMs,
        provider: stepContext?.provider,
        model: stepContext?.model,
        output: stepPayload?.output,
        error: stepPayload?.error,
        timestamp: step.timestamp,
      };
    });

    // Extract provider conversations from discussion.provider events
    // This provides real-time visibility into running discussions
    const discussionProviderEvents = events.filter(e => e.type === 'discussion.provider');
    const providerConversations = discussionProviderEvents.map(event => {
      const payload = event.payload;
      const context = event.context as Record<string, unknown> | undefined;
      const promptValue = payload?.prompt as string | undefined;
      const contentValue = payload?.content as string | undefined;
      const durationMsValue = event.durationMs ?? (payload?.durationMs as number | undefined);
      const tokenCountValue = payload?.tokenCount as number | undefined;

      const result: {
        provider: string;
        round: number;
        prompt?: string;
        content?: string;
        success: boolean;
        durationMs?: number;
        tokenCount?: number;
        timestamp: string;
      } = {
        provider: (context?.providerId ?? payload?.providerId ?? 'unknown') as string,
        round: (payload?.roundNumber ?? 1) as number,
        success: (payload?.success ?? event.status === 'success') as boolean,
        timestamp: event.timestamp,
      };

      // Only add optional fields if they have values
      if (promptValue !== undefined) result.prompt = promptValue;
      if (contentValue !== undefined) result.content = contentValue;
      if (durationMsValue !== undefined) result.durationMs = durationMsValue;
      if (tokenCountValue !== undefined) result.tokenCount = tokenCountValue;

      return result;
    });

    // Extract agent step conversations from workflow.step events
    // This provides visibility into agent execution steps with LLM responses
    const agentStepEvents = events.filter(e => e.type === 'workflow.step');
    const agentStepConversations = agentStepEvents.map(event => {
      const payload = event.payload;
      const context = event.context as Record<string, unknown> | undefined;
      const contentValue = payload?.content as string | undefined;
      const durationMsValue = event.durationMs ?? (payload?.durationMs as number | undefined);
      const tokenUsage = context?.tokenUsage as { input?: number; output?: number; total?: number } | undefined;

      const result: {
        stepId: string;
        stepIndex: number;
        provider?: string;
        content?: string;
        success: boolean;
        durationMs?: number;
        tokenCount?: number;
        timestamp: string;
        error?: { code: string; message: string };
      } = {
        stepId: (payload?.stepId ?? 'unknown') as string,
        stepIndex: (payload?.stepIndex ?? 0) as number,
        success: (payload?.success ?? event.status === 'success') as boolean,
        timestamp: event.timestamp,
      };

      // Only add optional fields if they have values
      const providerValue = (context?.providerId ?? payload?.provider) as string | undefined;
      if (providerValue !== undefined) result.provider = providerValue;
      if (contentValue !== undefined) result.content = contentValue;
      if (durationMsValue !== undefined) result.durationMs = durationMsValue;
      if (tokenUsage?.total !== undefined) result.tokenCount = tokenUsage.total;
      else if (tokenUsage?.input !== undefined && tokenUsage?.output !== undefined) {
        result.tokenCount = tokenUsage.input + tokenUsage.output;
      }
      const errorValue = payload?.error as { code: string; message: string } | undefined;
      if (errorValue !== undefined) result.error = errorValue;

      return result;
    });

    // Determine status from events
    let status: 'pending' | 'running' | 'success' | 'failure' = 'pending';
    if (endEvent) {
      status = endPayload?.success === true ? 'success' : 'failure';
    } else if (startEvent) {
      status = 'running';
    }
    if (errorEvents.length > 0 && status !== 'failure') {
      status = 'failure';
    }

    // Calculate total duration
    const durationMs = endEvent?.durationMs ??
      (endEvent && startEvent ?
        new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime() :
        undefined);

    // PRD-2026-003: Extract classification data from start event
    const classificationData = startPayload?.classification as {
      taskType?: string;
      confidence?: number;
      matchedPatterns?: string[];
      selectedMapping?: string | null;
      alternatives?: Array<{ mappingId: string; score: number }>;
      classificationTimeMs?: number;
      guardResults?: Array<{ gate: string; passed: boolean; reason?: string }>;
      taskDescription?: string;
    } | undefined;

    return {
      success: true,
      data: {
        traceId,
        status,
        command,
        commandType,
        startTime: startEvent?.timestamp ?? events[0]?.timestamp,
        endTime: endEvent?.timestamp,
        durationMs,
        // Execution context
        provider,
        model,
        // Input/Output
        input,
        output,
        // Workflow steps (for agent runs)
        workflowSteps: workflowSteps.length > 0 ? workflowSteps : undefined,
        // Provider conversations from discussion.provider events (for discussions)
        providerConversations: providerConversations.length > 0 ? providerConversations : undefined,
        // Agent step conversations from workflow.step events (for agents)
        agentStepConversations: agentStepConversations.length > 0 ? agentStepConversations : undefined,
        // Summary
        summary: {
          eventCount: events.length,
          stepCount: stepEvents.length,
          errorCount: errorEvents.length,
        },
        // PRD-2026-003: Classification data
        classification: classificationData,
        // Full timeline for advanced view
        timeline,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch trace'),
    };
  }
}

/**
 * Get workflow definition
 */
async function handleWorkflowDetail(workflowId: string): Promise<APIResponse> {
  try {
    const loader = await getWorkflowLoader();
    const workflow = await loader.load(workflowId);

    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    // Build DAG structure for visualization
    const nodes = workflow.steps.map((step, index) => ({
      id: step.stepId,
      type: step.type,
      name: step.name ?? step.stepId,
      config: step.config,
      position: index,
    }));

    // Build edges based on step order (sequential by default)
    const edges: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < workflow.steps.length - 1; i++) {
      const currentStep = workflow.steps[i];
      const nextStep = workflow.steps[i + 1];
      if (currentStep && nextStep) {
        edges.push({
          from: currentStep.stepId,
          to: nextStep.stepId,
        });
      }
    }

    // Get recent executions of this workflow from trace store
    const traceStore = getTraceStore();
    const allTraces = await traceStore.listTraces(100);
    const workflowExecutions: Array<{
      traceId: string;
      status: string;
      startTime: string;
      durationMs?: number;
    }> = [];

    for (const trace of allTraces) {
      const events = await traceStore.getTrace(trace.traceId);
      const startEvent = events.find(e => e.type === 'run.start');
      const context = startEvent?.context as Record<string, unknown> | undefined;

      // Check if this trace is for this workflow
      if (context?.workflowId === workflowId ||
          (startEvent?.payload as Record<string, unknown>)?.workflowId === workflowId) {
        workflowExecutions.push({
          traceId: trace.traceId,
          status: trace.status,
          startTime: trace.startTime,
          ...(trace.durationMs !== undefined && { durationMs: trace.durationMs }),
        });
      }
    }

    return {
      success: true,
      data: {
        workflowId: workflow.workflowId,
        version: workflow.version,
        name: workflow.name,
        description: workflow.description,
        // Full step details with configs
        steps: workflow.steps.map(step => ({
          stepId: step.stepId,
          name: step.name ?? step.stepId,
          type: step.type,
          timeout: step.timeout,
          dependencies: step.dependencies,
          config: step.config,
        })),
        // Metadata if available
        metadata: workflow.metadata,
        // DAG for visualization
        dag: { nodes, edges },
        // Recent executions
        recentExecutions: workflowExecutions.slice(0, 10),
        executionCount: workflowExecutions.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch workflow'),
    };
  }
}

/**
 * Get provider history - all trace events associated with a provider
 * Uses context.providerId for filtering (INV-TR-010)
 */
async function handleProviderHistory(providerId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(100);

    const providerTraces: Array<{
      traceId: string;
      command: string;
      status: string;
      startTime: string;
      durationMs?: number;
      model?: string;
      promptPreview?: string;
      responsePreview?: string;
      tokenUsage?: { input?: number; output?: number; total?: number };
    }> = [];

    // Filter traces by providerId
    for (const trace of traces) {
      const events = await traceStore.getTrace(trace.traceId);
      const startEvent = events.find(e => e.type === 'run.start');
      const endEvent = events.find(e => e.type === 'run.end');

      // Check if any event in this trace has the matching providerId
      const hasProvider = events.some(e => {
        const ctx = e.context as Record<string, unknown> | undefined;
        return ctx?.providerId === providerId || ctx?.provider === providerId;
      });

      if (hasProvider) {
        const startPayload = startEvent?.payload;
        const endPayload = endEvent?.payload;
        const context = startEvent?.context as Record<string, unknown> | undefined;

        const traceEntry: {
          traceId: string;
          command: string;
          status: string;
          startTime: string;
          durationMs?: number;
          model?: string;
          promptPreview?: string;
          responsePreview?: string;
          tokenUsage?: { input?: number; output?: number; total?: number };
        } = {
          traceId: trace.traceId,
          command: (startPayload?.command as string) ?? 'unknown',
          status: trace.status,
          startTime: trace.startTime,
        };
        if (trace.durationMs !== undefined) traceEntry.durationMs = trace.durationMs;
        if (context?.model) traceEntry.model = context.model as string;
        const prompt = (startPayload?.prompt as string) ?? '';
        if (prompt) traceEntry.promptPreview = prompt.slice(0, 100);
        const response = (endPayload?.response as string) ?? '';
        if (response) traceEntry.responsePreview = response.slice(0, 100);
        if (context?.tokenUsage) traceEntry.tokenUsage = context.tokenUsage as { input?: number; output?: number; total?: number };
        providerTraces.push(traceEntry);
      }
    }

    // Get provider info
    const registry = getProviderRegistry();
    const provider = registry.get(providerId);

    return {
      success: true,
      data: {
        providerId,
        providerName: providerId,
        available: provider ? await provider.isAvailable() : false,
        totalRequests: providerTraces.length,
        successRate: providerTraces.length > 0
          ? providerTraces.filter(t => t.status === 'success').length / providerTraces.length
          : 1.0,
        avgLatencyMs: providerTraces.length > 0
          ? providerTraces.reduce((sum, t) => sum + (t.durationMs ?? 0), 0) / providerTraces.length
          : 0,
        requests: providerTraces,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch provider history'),
    };
  }
}

/**
 * Get agent history - all trace events associated with an agent
 * Uses context.agentId for filtering (INV-TR-011)
 */
async function handleAgentHistory(agentId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(100);

    const agentTraces: Array<{
      traceId: string;
      task?: string;
      status: string;
      startTime: string;
      durationMs?: number;
      stepCount?: number;
      successfulSteps?: number;
      result?: string;
      error?: string;
    }> = [];

    // Filter traces by agentId
    for (const trace of traces) {
      const events = await traceStore.getTrace(trace.traceId);
      const startEvent = events.find(e => e.type === 'run.start');
      const endEvent = events.find(e => e.type === 'run.end');

      // Check if any event in this trace has the matching agentId
      const hasAgent = events.some(e => {
        const ctx = e.context as Record<string, unknown> | undefined;
        return ctx?.agentId === agentId;
      });

      if (hasAgent) {
        const startPayload = startEvent?.payload;
        const endPayload = endEvent?.payload;

        const traceEntry: {
          traceId: string;
          task?: string;
          status: string;
          startTime: string;
          durationMs?: number;
          stepCount?: number;
          successfulSteps?: number;
          result?: string;
          error?: string;
        } = {
          traceId: trace.traceId,
          status: trace.status,
          startTime: trace.startTime,
        };
        if (startPayload?.task) traceEntry.task = startPayload.task as string;
        if (trace.durationMs !== undefined) traceEntry.durationMs = trace.durationMs;
        if (endPayload?.stepCount !== undefined) traceEntry.stepCount = endPayload.stepCount as number;
        if (endPayload?.successfulSteps !== undefined) traceEntry.successfulSteps = endPayload.successfulSteps as number;
        const resultStr = (endPayload?.result as string) ?? '';
        if (resultStr) traceEntry.result = resultStr.slice(0, 200);
        if (endPayload?.error) traceEntry.error = endPayload.error as string;
        agentTraces.push(traceEntry);
      }
    }

    // Get agent info
    const registry = await getAgentRegistry();
    const agent = await registry.get(agentId);

    return {
      success: true,
      data: {
        agentId,
        displayName: agent?.displayName ?? agentId,
        description: agent?.description,
        enabled: agent?.enabled ?? false,
        capabilities: agent?.capabilities ?? [],
        totalExecutions: agentTraces.length,
        successRate: agentTraces.length > 0
          ? agentTraces.filter(t => t.status === 'success').length / agentTraces.length
          : 1.0,
        avgDurationMs: agentTraces.length > 0
          ? agentTraces.reduce((sum, t) => sum + (t.durationMs ?? 0), 0) / agentTraces.length
          : 0,
        executions: agentTraces,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch agent history'),
    };
  }
}

/**
 * Search traces with filters
 */
async function handleTraceSearch(filters: {
  providerId?: string;
  agentId?: string;
  type?: string;
  limit?: number;
}): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(filters.limit ?? 100);

    const filteredTraces: Array<{
      traceId: string;
      command?: string;
      status: string;
      startTime: string;
      durationMs?: number;
      providerId?: string;
      agentId?: string;
      eventType?: string;
    }> = [];

    for (const trace of traces) {
      const events = await traceStore.getTrace(trace.traceId);
      const startEvent = events.find(e => e.type === 'run.start' || e.type === 'discussion.start' || e.type === 'workflow.start');

      // Extract context from first event
      const context = startEvent?.context as Record<string, unknown> | undefined;
      const payload = startEvent?.payload;
      const eventProviderId = context?.providerId as string | undefined;
      const eventAgentId = context?.agentId as string | undefined;
      const eventType = startEvent?.type;

      // Apply filters
      if (filters.providerId && eventProviderId !== filters.providerId) continue;
      if (filters.agentId && eventAgentId !== filters.agentId) continue;
      if (filters.type && eventType !== filters.type) continue;

      const traceEntry: {
        traceId: string;
        command?: string;
        status: string;
        startTime: string;
        durationMs?: number;
        providerId?: string;
        agentId?: string;
        eventType?: string;
      } = {
        traceId: trace.traceId,
        status: trace.status,
        startTime: trace.startTime,
      };
      if (payload?.command) traceEntry.command = payload.command as string;
      if (trace.durationMs !== undefined) traceEntry.durationMs = trace.durationMs;
      if (eventProviderId) traceEntry.providerId = eventProviderId;
      if (eventAgentId) traceEntry.agentId = eventAgentId;
      if (eventType) traceEntry.eventType = eventType;
      filteredTraces.push(traceEntry);
    }

    return {
      success: true,
      data: {
        count: filteredTraces.length,
        filters,
        traces: filteredTraces,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to search traces'),
    };
  }
}

/**
 * Get trace tree - hierarchical view of trace and its children
 * INV-TR-020: All traces in hierarchy share rootTraceId
 * INV-TR-021: Shows parent-child relationships
 */
async function handleTraceTree(traceId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const tree = await traceStore.getTraceTree(traceId);

    if (!tree) {
      return { success: false, error: `Trace not found: ${traceId}` };
    }

    // Helper to format tree node for response
    type FormattedNode = {
      traceId: string;
      shortId: string;
      status: string;
      agentId: string | undefined;
      durationMs: number | undefined;
      depth: number;
      eventCount: number;
      startTime: string;
      children: FormattedNode[];
    };
    const formatNode = (node: typeof tree): FormattedNode => ({
      traceId: node.trace.traceId,
      shortId: node.trace.traceId.slice(0, 8),
      status: node.trace.status,
      agentId: node.trace.agentId,
      durationMs: node.trace.durationMs,
      depth: node.trace.traceDepth ?? 0,
      eventCount: node.trace.eventCount,
      startTime: node.trace.startTime,
      children: (node.children).map(formatNode),
    });

    // Count total nodes
    const countNodes = (node: typeof tree): number =>
      1 + (node.children).reduce((sum, child) => sum + countNodes(child), 0);

    // Get max depth
    const getMaxDepth = (node: typeof tree): number => {
      const childDepths = (node.children).map(getMaxDepth);
      return childDepths.length > 0 ? Math.max(...childDepths) + 1 : 0;
    };

    const totalTraces = countNodes(tree);
    const maxDepth = getMaxDepth(tree);

    // Build text tree view for display
    const buildTreeView = (node: typeof tree, indent = ''): string[] => {
      const statusIcon = node.trace.status === 'success' ? '[OK]' :
        node.trace.status === 'failure' ? '[FAIL]' :
        node.trace.status === 'running' ? '[...]' : '[?]';
      const agentLabel = node.trace.agentId ? ` - ${node.trace.agentId}` : '';
      const durationLabel = node.trace.durationMs ? ` (${node.trace.durationMs}ms)` : '';
      const line = `${indent}${statusIcon} ${node.trace.traceId.slice(0, 8)}${agentLabel}${durationLabel}`;

      const lines = [line];
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        const isLast = i === children.length - 1;
        const childIndent = indent + (isLast ? ' └─ ' : ' ├─ ');
        const nextIndent = indent + (isLast ? '    ' : ' │  ');
        const childLines = buildTreeView(children[i]!, nextIndent);
        childLines[0] = childIndent.slice(0, -4) + (isLast ? ' └─ ' : ' ├─ ') + childLines[0]!.slice(nextIndent.length);
        lines.push(...childLines);
      }
      return lines;
    };

    const treeView = buildTreeView(tree).join('\n');

    return {
      success: true,
      data: {
        traceId,
        rootTraceId: tree.trace.rootTraceId ?? traceId,
        traceCount: totalTraces,
        maxDepth,
        totalDurationMs: tree.totalDurationMs,
        totalEventCount: tree.totalEventCount,
        treeView,
        tree: formatNode(tree),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to get trace tree'),
    };
  }
}

/**
 * Get classification data for a trace
 * PRD-2026-003: Classification observability endpoint
 * INV-TR-030: Classification snapshot is immutable once recorded
 */
async function handleTraceClassification(traceId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const events = await traceStore.getTrace(traceId);

    if (!events || events.length === 0) {
      return { success: false, error: `Trace not found: ${traceId}` };
    }

    // Find run.start event which contains classification data
    const startEvent = events.find(e => e.type === 'run.start');
    if (!startEvent) {
      return {
        success: true,
        data: {
          traceId,
          hasClassification: false,
          message: 'No classification data available for this trace',
        },
      };
    }

    const payload = startEvent.payload;
    const classification = payload?.classification as {
      taskType?: string;
      confidence?: number;
      matchedPatterns?: string[];
      selectedMapping?: string | null;
      alternatives?: Array<{ mappingId: string; score: number }>;
      classificationTimeMs?: number;
      guardResults?: Array<{ gate: string; passed: boolean; reason?: string }>;
      taskDescription?: string;
    } | undefined;

    if (!classification) {
      return {
        success: true,
        data: {
          traceId,
          hasClassification: false,
          message: 'No classification data available for this trace',
        },
      };
    }

    // Calculate guard pass rate
    const guardResults = classification.guardResults ?? [];
    const guardPassRate = guardResults.length > 0
      ? guardResults.filter(g => g.passed).length / guardResults.length
      : 1.0;

    return {
      success: true,
      data: {
        traceId,
        hasClassification: true,
        classification: {
          taskType: classification.taskType,
          confidence: classification.confidence,
          matchedPatterns: classification.matchedPatterns ?? [],
          selectedMapping: classification.selectedMapping,
          alternatives: classification.alternatives ?? [],
          classificationTimeMs: classification.classificationTimeMs,
          guardResults,
          guardPassRate,
          taskDescription: classification.taskDescription,
        },
        timestamp: startEvent.timestamp,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch classification data'),
    };
  }
}

/**
 * Get workflow execution events - timeline of a workflow execution
 * Uses workflow.start, workflow.step, workflow.end events (INV-TR-013)
 */
async function handleWorkflowEvents(workflowId: string): Promise<APIResponse> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(100);

    const workflowExecutions: Array<{
      traceId: string;
      status: string;
      startTime: string;
      endTime?: string;
      durationMs?: number;
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      timeline: Array<{
        type: string;
        timestamp: string;
        stepId?: string;
        stepName?: string;
        success?: boolean;
        durationMs?: number;
        error?: { code: string; message: string };
      }>;
    }> = [];

    // Find traces with workflow events for this workflowId
    for (const trace of traces) {
      const events = await traceStore.getTrace(trace.traceId);

      // Look for workflow events
      const workflowStart = events.find(e => e.type === 'workflow.start');
      const workflowEnd = events.find(e => e.type === 'workflow.end');
      const workflowSteps = events.filter(e => e.type === 'workflow.step');

      // Check if this is the right workflow
      const startContext = workflowStart?.context as Record<string, unknown> | undefined;
      const endContext = workflowEnd?.context as Record<string, unknown> | undefined;

      if (startContext?.workflowId === workflowId || endContext?.workflowId === workflowId) {
        const startPayload = workflowStart?.payload;
        const endPayload = workflowEnd?.payload;

        // Build timeline
        const timeline: Array<{
          type: string;
          timestamp: string;
          stepId?: string;
          stepName?: string;
          success?: boolean;
          durationMs?: number;
          error?: { code: string; message: string };
        }> = [];

        // Add start event
        if (workflowStart) {
          timeline.push({
            type: 'workflow.start',
            timestamp: workflowStart.timestamp,
          });
        }

        // Add step events
        for (const step of workflowSteps) {
          const stepPayload = step.payload;
          const stepEntry: {
            type: string;
            timestamp: string;
            stepId?: string;
            stepName?: string;
            success?: boolean;
            durationMs?: number;
            error?: { code: string; message: string };
          } = {
            type: 'workflow.step',
            timestamp: step.timestamp,
          };
          if (stepPayload?.stepId) stepEntry.stepId = stepPayload.stepId as string;
          if (stepPayload?.stepName) stepEntry.stepName = stepPayload.stepName as string;
          if (stepPayload?.success !== undefined) stepEntry.success = stepPayload.success as boolean;
          if (step.durationMs !== undefined) stepEntry.durationMs = step.durationMs;
          if (stepPayload?.error) stepEntry.error = stepPayload.error as { code: string; message: string };
          timeline.push(stepEntry);
        }

        // Add end event
        if (workflowEnd) {
          const endEntry: {
            type: string;
            timestamp: string;
            stepId?: string;
            stepName?: string;
            success?: boolean;
            durationMs?: number;
            error?: { code: string; message: string };
          } = {
            type: 'workflow.end',
            timestamp: workflowEnd.timestamp,
          };
          if (endPayload?.success !== undefined) endEntry.success = endPayload.success as boolean;
          if (workflowEnd.durationMs !== undefined) endEntry.durationMs = workflowEnd.durationMs;
          if (endPayload?.error) endEntry.error = endPayload.error as { code: string; message: string };
          timeline.push(endEntry);
        }

        const executionEntry: {
          traceId: string;
          status: string;
          startTime: string;
          endTime?: string;
          durationMs?: number;
          totalSteps: number;
          completedSteps: number;
          failedSteps: number;
          timeline: typeof timeline;
        } = {
          traceId: trace.traceId,
          status: endPayload?.success === true ? 'success' : (workflowEnd ? 'failure' : 'running'),
          startTime: workflowStart?.timestamp ?? trace.startTime,
          totalSteps: (startPayload?.stepCount as number) ?? (endPayload?.totalSteps as number) ?? workflowSteps.length,
          completedSteps: (endPayload?.completedSteps as number) ?? workflowSteps.length,
          failedSteps: (endPayload?.failedSteps as number) ?? workflowSteps.filter(s => {
            const p = s.payload;
            return p?.success === false;
          }).length,
          timeline,
        };
        if (workflowEnd?.timestamp) executionEntry.endTime = workflowEnd.timestamp;
        const durationMs = (endPayload?.totalDurationMs as number | undefined) ?? trace.durationMs;
        if (durationMs !== undefined) executionEntry.durationMs = durationMs;
        workflowExecutions.push(executionEntry);
      }
    }

    // Get workflow definition
    const loader = await getWorkflowLoader();
    const workflow = await loader.load(workflowId);

    return {
      success: true,
      data: {
        workflowId,
        workflowName: workflow?.name,
        workflowVersion: workflow?.version,
        stepCount: workflow?.steps.length ?? 0,
        totalExecutions: workflowExecutions.length,
        successRate: workflowExecutions.length > 0
          ? workflowExecutions.filter(e => e.status === 'success').length / workflowExecutions.length
          : 1.0,
        executions: workflowExecutions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch workflow events'),
    };
  }
}

/**
 * Fetch provider data
 * Uses cached status if available (set at monitor startup), otherwise checks CLI availability only
 */
async function getProviderData(): Promise<DashboardProviderStatus[]> {
  // Use cached status if available (set at monitor startup with real health check)
  if (cachedProviderStatus !== null) {
    return cachedProviderStatus;
  }

  // Fallback: quick CLI availability check (no actual LLM call)
  try {
    const registry = getProviderRegistry();
    const providerIds = registry.getProviderIds();

    const results = await Promise.all(
      providerIds.map(async (providerId: string): Promise<DashboardProviderStatus | null> => {
        const provider = registry.get(providerId);
        if (!provider) return null;

        const startTime = Date.now();
        try {
          const available = await provider.isAvailable();
          const latencyMs = Date.now() - startTime;
          return {
            providerId,
            name: providerId,
            available,
            latencyMs: available ? latencyMs : undefined,
            circuitState: 'closed' as const,
            lastUsed: undefined,
          };
        } catch {
          return {
            providerId,
            name: providerId,
            available: false,
            latencyMs: undefined,
            circuitState: 'closed' as const,
            lastUsed: undefined,
          };
        }
      })
    );

    return results.filter((r): r is DashboardProviderStatus => r !== null);
  } catch {
    return [];
  }
}

/**
 * Fetch session data
 */
async function getSessionData(): Promise<DashboardSessionSummary[]> {
  try {
    const manager = getSessionManager();
    const sessions = await manager.listSessions({ status: 'active' });
    return sessions.slice(0, 20).map(session => ({
      sessionId: session.sessionId,
      initiator: session.initiator,
      task: session.task,
      status: session.status,
      participantCount: session.participants.filter(p => !p.leftAt).length,
      createdAt: session.createdAt,
      durationMs: undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch agent data
 */
async function getAgentData(): Promise<DashboardAgentSummary[]> {
  try {
    const registry = await getAgentRegistry();
    const agents = await registry.list();
    return agents.slice(0, 50).map(agent => ({
      agentId: agent.agentId,
      displayName: agent.displayName ?? agent.agentId,
      description: agent.description,
      enabled: agent.enabled ?? true,
      capabilities: agent.capabilities ?? [],
      executionCount: 0,
      lastExecuted: undefined,
      // PRD-2026-004: Meta-agent fields for list display
      metaAgent: agent.metaAgent,
      archetype: agent.archetype,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch trace data with command info from events
 */
async function getTraceData(): Promise<DashboardTraceSummary[]> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(200); // Increased for histogram

    // Fetch first event of each trace to get command info (only if name not stored)
    const tracesWithNames = await Promise.all(
      traces.map(async (trace) => {
        // Use stored name if available, otherwise fall back to default
        let name = trace.name ?? `Trace ${trace.traceId.slice(0, 8)}`;
        let command: string | undefined;
        let providers: string[] | undefined;

        // Only fetch events if we need to derive providers or name isn't stored
        if (!trace.name || !providers) {
          try {
            const events = await traceStore.getTrace(trace.traceId);
            const firstEvent = events[0];
            if (firstEvent) {
              const payload = firstEvent.payload;
              const context = firstEvent.context as Record<string, unknown> | undefined;

              // Extract command from payload
              if (payload?.command) {
                command = String(payload.command);
              }

              // Extract providers from payload (for discussions) or context (for single calls)
              if (payload?.providers && Array.isArray(payload.providers)) {
                providers = payload.providers as string[];
              } else if (context?.providerId) {
                providers = [String(context.providerId)];
              }

              // Derive name from events only if not stored
              if (!trace.name) {
                if (payload?.agentId) {
                  name = `ax agent run ${payload.agentId}`;
                } else if (context?.agentId) {
                  name = `ax agent run ${context.agentId}`;
                } else if (payload?.topic) {
                  const topic = String(payload.topic).slice(0, 40);
                  name = `ax discuss "${topic}${String(payload.topic).length > 40 ? '...' : ''}"`;
                } else if (payload?.prompt) {
                  const prompt = String(payload.prompt).slice(0, 40);
                  name = `${command ?? 'ax call'} "${prompt}${String(payload.prompt).length > 40 ? '...' : ''}"`;
                } else if (command) {
                  name = command;
                } else if (payload?.tool) {
                  // MCP tool invocation (parallel_run, review_analyze, etc.)
                  const tool = String(payload.tool).replace(/_/g, ' ');
                  name = `ax ${tool}`;
                } else if (payload?.workflowId) {
                  // Workflow execution
                  const workflowName = payload.workflowName ? String(payload.workflowName) : String(payload.workflowId);
                  name = `workflow ${workflowName}`;
                } else if (context?.workflowId) {
                  name = `workflow ${context.workflowId}`;
                }
              }
            }
          } catch {
            // Ignore errors fetching events
          }
        }

        return {
          traceId: trace.traceId,
          name,
          command,
          status: trace.status === 'pending' || trace.status === 'skipped' ? 'running' as const : trace.status,
          eventCount: trace.eventCount,
          durationMs: trace.durationMs,
          startTime: trace.startTime,
          providers,
        };
      })
    );

    return tracesWithNames;
  } catch {
    return [];
  }
}

/**
 * Fetch workflow data
 */
async function getWorkflowData(): Promise<Array<{
  workflowId: string;
  name: string;
  version: string;
  stepCount: number;
}>> {
  try {
    const loader = await getWorkflowLoader();
    const workflows = await loader.loadAll();
    return workflows.slice(0, 50).map(workflow => ({
      workflowId: workflow.workflowId,
      name: workflow.name ?? workflow.workflowId,
      version: workflow.version,
      stepCount: workflow.steps.length,
    }));
  } catch {
    return [];
  }
}

/**
 * Classification metrics type (PRD-2026-003)
 */
interface ClassificationMetrics {
  totalClassifications: number;
  byTaskType: Record<string, number>;
  guardPassRate: number;
  averageConfidence: number;
  fallbackRate: number;
  sampleSize: number;
}

/**
 * Calculate classification metrics from recent traces
 * PRD-2026-003: Classification observability
 */
async function getClassificationMetrics(): Promise<ClassificationMetrics> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(200);

    let totalClassifications = 0;
    const byTaskType: Record<string, number> = {};
    let totalConfidence = 0;
    let totalGuardChecks = 0;
    let passedGuardChecks = 0;
    let fallbackCount = 0;

    for (const trace of traces) {
      try {
        const events = await traceStore.getTrace(trace.traceId);
        const startEvent = events.find(e => e.type === 'run.start');

        if (!startEvent) continue;

        const payload = startEvent.payload;
        const classification = payload?.classification as {
          taskType?: string;
          confidence?: number;
          selectedMapping?: string | null;
          guardResults?: Array<{ gate: string; passed: boolean }>;
        } | undefined;

        if (!classification || !classification.taskType) continue;

        totalClassifications++;
        const taskType = classification.taskType;
        byTaskType[taskType] = (byTaskType[taskType] ?? 0) + 1;

        if (classification.confidence !== undefined) {
          totalConfidence += classification.confidence;
        }

        if (classification.selectedMapping === null) {
          fallbackCount++;
        }

        if (classification.guardResults) {
          for (const gate of classification.guardResults) {
            totalGuardChecks++;
            if (gate.passed) passedGuardChecks++;
          }
        }
      } catch {
        // Ignore individual trace errors
      }
    }

    return {
      totalClassifications,
      byTaskType,
      guardPassRate: totalGuardChecks > 0 ? passedGuardChecks / totalGuardChecks : 1.0,
      averageConfidence: totalClassifications > 0 ? totalConfidence / totalClassifications : 0,
      fallbackRate: totalClassifications > 0 ? fallbackCount / totalClassifications : 0,
      sampleSize: traces.length,
    };
  } catch {
    return {
      totalClassifications: 0,
      byTaskType: {},
      guardPassRate: 1.0,
      averageConfidence: 0,
      fallbackRate: 0,
      sampleSize: 0,
    };
  }
}

/**
 * Fetch metrics data
 */
async function getMetricsData(): Promise<{
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  activeAgents: number;
  activeSessions: number;
  memoryUsageMb: number;
  heapTotalMb: number;
  rssMb: number;
  uptime: string;
  uptimeSeconds: number;
}> {
  const memUsage = process.memoryUsage();

  let activeSessions = 0;
  let activeAgents = 0;

  try {
    const manager = getSessionManager();
    activeSessions = await manager.countActiveSessions();
  } catch {
    // ignore
  }

  try {
    const registry = await getAgentRegistry();
    const agents = await registry.list();
    activeAgents = agents.filter(a => a.enabled !== false).length;
  } catch {
    // ignore
  }

  return {
    totalRequests: 0, // Would need request tracking
    successRate: 1.0,
    avgLatencyMs: 0,
    activeAgents,
    activeSessions,
    memoryUsageMb: memUsage.heapUsed / (1024 * 1024),
    heapTotalMb: memUsage.heapTotal / (1024 * 1024),
    rssMb: memUsage.rss / (1024 * 1024),
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: process.uptime(),
  };
}

/**
 * Format uptime
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
