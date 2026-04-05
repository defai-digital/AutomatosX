import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import packageJson from '../../../../package.json' with { type: 'json' };
import { getStableAgentEntry } from '../agent-catalog.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { buildDashboardHtml } from './monitor-dashboard.js';
import { buildMonitorState } from './monitor-state.js';
import type { MonitorApiState, RuntimeService } from './monitor-types.js';
import { loadMonitorWorkflowDetail } from './monitor-workflows.js';

const DEFAULT_DETAIL_LIMIT = 50;
const MAX_PORT_ATTEMPTS = 20;

export interface MonitorArgs {
  explicitPort?: number;
  noOpen: boolean;
  error?: string;
}

export interface MonitorRequestHandlerContext {
  runtime: RuntimeService;
  loadProviderSnapshot: () => Promise<MonitorApiState['providers']>;
  basePath: string;
  effectiveWorkflowDir: string | undefined;
  monitorTraceLimit: number;
}

export function parseMonitorArgs(args: string[]): MonitorArgs {
  const parsed = parseCommandArgs<MonitorArgs>({
    args,
    initial: {
      explicitPort: undefined,
      noOpen: false,
    },
    flags: {
      'no-open': {
        kind: 'boolean',
        apply: (state) => {
          state.noOpen = true;
        },
      },
      port: {
        kind: 'string',
        aliases: ['p'],
        apply: (state, rawPort) => {
          const parsedPort = parseMonitorPort(rawPort);
          if (parsedPort.error !== undefined) {
            return parsedPort.error;
          }
          state.explicitPort = parsedPort.value;
        },
      },
    },
    allowPositionals: false,
    unknownFlagMessage: (token) => `Unknown monitor flag: ${token}.`,
    unexpectedPositionalMessage: () => 'Usage: ax monitor [options]',
  });

  if (parsed.error !== undefined) {
    return { ...parsed.value, error: parsed.error };
  }

  return parsed.value;
}

export function getMonitorPath(url: string | undefined): string {
  return url?.split('?')[0] ?? '/';
}

export function createMonitorApiResponse(
  path: string,
  state: MonitorApiState,
): { statusCode: number; contentType: string; body: string } {
  switch (path) {
    case '/api/health':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: 'ok',
            version: packageJson.version,
          },
        }),
      };
    case '/api/status':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.status }),
      };
    case '/api/providers':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.providers }),
      };
    case '/api/governance':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.governance }),
      };
    case '/api/sessions':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.sessions }),
      };
    case '/api/agents':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.agents }),
      };
    case '/api/traces':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.traces }),
      };
    case '/api/workflows':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.workflows }),
      };
    case '/api/state':
      return {
        statusCode: 200,
        contentType: 'application/json',
        body: JSON.stringify(state),
      };
    default:
      return {
        statusCode: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Not found' }),
      };
  }
}

export function createMonitorRequestHandler(
  context: MonitorRequestHandlerContext,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const {
    runtime,
    loadProviderSnapshot,
    basePath,
    effectiveWorkflowDir,
    monitorTraceLimit,
  } = context;

  async function loadState(): Promise<MonitorApiState> {
    return buildMonitorState(
      runtime,
      loadProviderSnapshot,
      basePath,
      effectiveWorkflowDir,
      monitorTraceLimit,
    );
  }

  return async (req, res) => {
    const remote = req.socket?.remoteAddress ?? '';
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
    if (!isLocal) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    const path = getMonitorPath(req.url);

    if (path.startsWith('/api/traces/') && path.length > '/api/traces/'.length) {
      try {
        const traceId = decodeURIComponent(path.slice('/api/traces/'.length));
        const trace = await runtime.getStores().traceStore.getTrace(traceId);
        if (trace === undefined) {
          sendApiError(res, 404, `Trace not found: ${traceId}`);
        } else {
          sendApiSuccess(res, trace);
        }
      } catch (err) {
        sendApiError(res, 500, err);
      }
      return;
    }

    if (path.startsWith('/api/agents/') && path.length > '/api/agents/'.length) {
      try {
        const agentId = decodeURIComponent(path.slice('/api/agents/'.length));
        const agent = getStableAgentEntry(agentId, await runtime.getAgent(agentId));
        if (agent === undefined) {
          sendApiError(res, 404, `Agent not found: ${agentId}`);
        } else {
          sendApiSuccess(res, agent);
        }
      } catch (err) {
        sendApiError(res, 500, err);
      }
      return;
    }

    if (path.startsWith('/api/sessions/') && path.length > '/api/sessions/'.length) {
      try {
        const sessionId = decodeURIComponent(path.slice('/api/sessions/'.length));
        const session = await runtime.getSession(sessionId);
        if (session === undefined) {
          sendApiError(res, 404, `Session not found: ${sessionId}`);
        } else {
          const traces = await runtime.getStores().traceStore.listTracesBySession(sessionId, DEFAULT_DETAIL_LIMIT);
          sendApiSuccess(res, { session, traces });
        }
      } catch (err) {
        sendApiError(res, 500, err);
      }
      return;
    }

    if (path === '/api/metrics/hourly' || path.startsWith('/api/metrics/hourly?')) {
      try {
        const buckets = await runtime.getStores().traceStore.getHourlyMetrics(24);
        sendApiSuccess(res, buckets);
      } catch (err) {
        sendApiError(res, 500, err);
      }
      return;
    }

    if (path.startsWith('/api/workflows/') && path.length > '/api/workflows/'.length) {
      try {
        const workflowId = decodeURIComponent(path.slice('/api/workflows/'.length));
        const state = await loadState();
        const workflowEntry = await loadMonitorWorkflowDetail(
          runtime,
          workflowId,
          basePath,
          effectiveWorkflowDir,
          state.workflows,
        );
        if (workflowEntry === undefined) {
          sendApiError(res, 404, `Workflow not found: ${workflowId}`);
        } else {
          const workflowTraces = await runtime.getStores().traceStore.listTracesByWorkflow(workflowId, DEFAULT_DETAIL_LIMIT);
          sendApiSuccess(res, { workflow: workflowEntry, traces: workflowTraces });
        }
      } catch (err) {
        sendApiError(res, 500, err);
      }
      return;
    }

    if (path.startsWith('/api/')) {
      try {
        const state = await loadState();
        const response = createMonitorApiResponse(path, state);
        sendResponse(res, response.statusCode, response.contentType, response.body);
      } catch (err) {
        sendJson(res, 500, { error: formatError(err) });
      }
      return;
    }

    if (path === '/' || path === '/index.html') {
      try {
        const state = await loadState();
        sendResponse(res, 200, 'text/html; charset=utf-8', buildDashboardHtml(state));
      } catch (err) {
        sendText(res, 500, `Error loading state: ${formatError(err)}`);
      }
      return;
    }

    sendText(res, 404, 'Not Found');
  };
}

export async function startMonitorServer(
  portMin: number,
  portMax: number,
  explicitPort: number | undefined,
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: { close(): void }; port: number }> {
  if (explicitPort !== undefined) {
    const s = await tryPort(explicitPort, handler);
    if (s !== null) return { server: s, port: explicitPort };
    throw new Error(`Port ${explicitPort} is already in use.`);
  }
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = Math.floor(Math.random() * (portMax - portMin + 1)) + portMin;
    const s = await tryPort(port, handler);
    if (s !== null) return { server: s, port };
  }
  for (let port = portMin; port <= portMax; port++) {
    const s = await tryPort(port, handler);
    if (s !== null) return { server: s, port };
  }
  throw new Error(`No available port found in range ${portMin}-${portMax}.`);
}

export function openMonitorBrowser(url: string): void {
  const openCommand = process.platform === 'darwin'
    ? ['open', url]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', url]
      : ['xdg-open', url];
  execFile(openCommand[0], openCommand.slice(1));
}

function parseMonitorPort(rawPort: string): { value?: number; error?: string } {
  const parsedPort = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort >= 65536) {
    return {
      error: 'Port must be an integer between 1 and 65535.',
    };
  }

  return {
    value: parsedPort,
  };
}

function tryPort(
  port: number,
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ close(): void } | null> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    const onError = (): void => {
      server.removeListener('listening', onListening);
      resolve(null);
    };
    const onListening = (): void => {
      server.removeListener('error', onError);
      server.on('error', (error) => {
        process.stderr.write(`Monitor server error: ${String(error)}\n`);
      });
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

function sendApiSuccess(res: ServerResponse, data: unknown): void {
  sendJson(res, 200, { success: true, data });
}

function sendApiError(res: ServerResponse, statusCode: number, error: unknown): void {
  sendJson(res, statusCode, { success: false, error: formatError(error) });
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  sendResponse(res, statusCode, 'text/plain', body);
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  sendResponse(res, statusCode, 'application/json', JSON.stringify(body));
}

function sendResponse(
  res: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
