import type { CLIOptions, CommandResult } from '../types.js';
import { buildDashboardHtml, escapeHtml } from './monitor-dashboard.js';
import { createProviderSnapshotLoader, readMonitorConfig } from './monitor-state.js';
import type { MonitorApiState } from './monitor-types.js';
import { createRuntime, failure, resolveCliBasePath } from '../utils/formatters.js';
import { resolveEffectiveWorkflowDir } from '../workflow-paths.js';
import {
  createMonitorApiResponse,
  createMonitorRequestHandler,
  getMonitorPath,
  openMonitorBrowser,
  parseMonitorArgs,
  startMonitorServer,
} from './monitor-support.js';

export { buildDashboardHtml, escapeHtml };
export {
  createMonitorApiResponse,
  getMonitorPath,
  openMonitorBrowser,
  parseMonitorArgs,
  startMonitorServer,
} from './monitor-support.js';
export type { MonitorArgs } from './monitor-support.js';
export { readCachedProviderSnapshot, resolveMonitorConfig } from './monitor-state.js';
export type {
  MonitorApiState,
  MonitorConfig,
  MonitorProviderSnapshot,
  MonitorWorkflowEntry,
} from './monitor-types.js';

const DEFAULT_MONITOR_TRACE_LIMIT = 100;

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

  const requestHandler = createMonitorRequestHandler({
    runtime,
    loadProviderSnapshot,
    basePath,
    effectiveWorkflowDir,
    monitorTraceLimit,
  });

  let result: { server: { close(): void }; port: number };
  try {
    result = await startMonitorServer(monitorConfig.portMin, monitorConfig.portMax, monitorArgs.explicitPort, (req, res) => {
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
    openMonitorBrowser(url);
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
