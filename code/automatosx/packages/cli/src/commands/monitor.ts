/**
 * Monitor Command
 *
 * Launch a local HTTP dashboard for monitoring AutomatosX runtime state.
 *
 * Usage:
 *   ax monitor                # Auto-select port in 3000-3999
 *   ax monitor --port 8080    # Use specific port
 *   ax monitor --no-open      # Don't auto-open browser
 */

import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import packageJson from '../../../../package.json' with { type: 'json' };
import type { CLIOptions, CommandResult } from '../types.js';
import { getStableAgentEntry } from '../agent-catalog.js';
import { buildDashboardHtml, escapeHtml } from './monitor-dashboard.js';
import {
  buildMonitorState,
  createProviderSnapshotLoader,
  readMonitorConfig,
} from './monitor-state.js';
import { loadMonitorWorkflowDetail } from './monitor-workflows.js';
import type { MonitorApiState } from './monitor-types.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { createRuntime, failure, resolveCliBasePath } from '../utils/formatters.js';
import { resolveEffectiveWorkflowDir } from '../workflow-paths.js';

export { buildDashboardHtml, escapeHtml };
export {
  readCachedProviderSnapshot,
  resolveMonitorConfig,
} from './monitor-state.js';
export type {
  MonitorApiState,
  MonitorConfig,
  MonitorProviderSnapshot,
  MonitorWorkflowEntry,
} from './monitor-types.js';

const DEFAULT_MONITOR_TRACE_LIMIT = 100;
const DEFAULT_DETAIL_LIMIT = 50;
const MAX_PORT_ATTEMPTS  = 20;

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

async function startServer(
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

interface MonitorArgs {
  explicitPort?: number;
  noOpen: boolean;
  error?: string;
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

export async function monitorCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (options.help) {
    return {
      success: true,
      exitCode: 0,
      message:
        'Usage: ax monitor [options]\n\n' +
        'Options:\n' +
        '  --port <n>   Use specific port (default: auto 3000-3999)\n' +
        '  --no-open    Do not auto-open browser',
      data: undefined,
    };
  }

  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const loadProviderSnapshot = createProviderSnapshotLoader(basePath);
  const effectiveWorkflowDir = resolveEffectiveWorkflowDir({
    workflowDir: options.workflowDir,
    basePath,
  });
  const monitorConfig = await readMonitorConfig(runtime);
  const monitorArgs = parseMonitorArgs(args);
  const monitorTraceLimit = options.limit ?? DEFAULT_MONITOR_TRACE_LIMIT;
  if (monitorArgs.error !== undefined) {
    return failure(monitorArgs.error);
  }

  const requestHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const remote = req.socket?.remoteAddress ?? '';
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
    if (!isLocal) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const path = getMonitorPath(req.url);

    if (path.startsWith('/api/traces/') && path.length > '/api/traces/'.length) {
      try {
        const traceId = decodeURIComponent(path.slice('/api/traces/'.length));
        const trace = await runtime.getStores().traceStore.getTrace(traceId);
        if (trace === undefined) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Trace not found: ${traceId}` }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: trace }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path.startsWith('/api/agents/') && path.length > '/api/agents/'.length) {
      try {
        const agentId = decodeURIComponent(path.slice('/api/agents/'.length));
        const agent = getStableAgentEntry(agentId, await runtime.getAgent(agentId));
        if (agent === undefined) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Agent not found: ${agentId}` }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: agent }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path.startsWith('/api/sessions/') && path.length > '/api/sessions/'.length) {
      try {
        const sessionId = decodeURIComponent(path.slice('/api/sessions/'.length));
        const session = await runtime.getSession(sessionId);
        if (session === undefined) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Session not found: ${sessionId}` }));
        } else {
          const traces = await runtime.getStores().traceStore.listTracesBySession(sessionId, DEFAULT_DETAIL_LIMIT);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { session, traces } }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path === '/api/metrics/hourly' || path.startsWith('/api/metrics/hourly?')) {
      try {
        const buckets = await runtime.getStores().traceStore.getHourlyMetrics(24);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: buckets }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path.startsWith('/api/workflows/') && path.length > '/api/workflows/'.length) {
      try {
        const workflowId = decodeURIComponent(path.slice('/api/workflows/'.length));
        const state = await buildMonitorState(
          runtime,
          loadProviderSnapshot,
          basePath,
          effectiveWorkflowDir,
          monitorTraceLimit,
        );
        const workflowEntry = await loadMonitorWorkflowDetail(
          runtime,
          workflowId,
          basePath,
          effectiveWorkflowDir,
          state.workflows,
        );
        if (workflowEntry === undefined) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Workflow not found: ${workflowId}` }));
        } else {
          const workflowTraces = await runtime.getStores().traceStore.listTracesByWorkflow(workflowId, DEFAULT_DETAIL_LIMIT);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { workflow: workflowEntry, traces: workflowTraces } }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path.startsWith('/api/')) {
      try {
        const state = await buildMonitorState(
          runtime,
          loadProviderSnapshot,
          basePath,
          effectiveWorkflowDir,
          monitorTraceLimit,
        );
        const response = createMonitorApiResponse(path, state);
        res.writeHead(response.statusCode, { 'Content-Type': response.contentType });
        res.end(response.body);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (path === '/' || path === '/index.html') {
      try {
        const state = await buildMonitorState(
          runtime,
          loadProviderSnapshot,
          basePath,
          effectiveWorkflowDir,
          monitorTraceLimit,
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildDashboardHtml(state));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error loading state: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  };

  let result: { server: { close(): void }; port: number };
  try {
    result = await startServer(monitorConfig.portMin, monitorConfig.portMax, monitorArgs.explicitPort, (req, res) => {
      requestHandler(req, res).catch((err) => {
        try {
          if (!res.writableEnded) { res.writeHead(500); res.end('Internal Server Error'); }
        } catch {
        }
        process.stderr.write(`Monitor handler error: ${err}\n`);
      });
    });
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }

  const url = `http://localhost:${result.port}`;
  console.log(`\nAutomatosX Monitor running at: ${url}`);
  console.log('Localhost access only. Press Ctrl+C to stop.\n');

  if (!monitorArgs.noOpen && monitorConfig.autoOpen) {
    const openCommand = process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];
    execFile(openCommand[0], openCommand.slice(1));
  }

  const shutdown = (): void => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    console.log('\nShutting down monitor...');
    result.server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await new Promise(() => { /* runs until interrupted */ });

  return { success: true, exitCode: 0, message: undefined, data: null };
}
