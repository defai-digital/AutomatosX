/**
 * Monitor Command
 *
 * Launch a local web dashboard for monitoring AutomatosX.
 * Automatically finds an available port in the configured range.
 *
 * Usage:
 *   ax monitor              # Launch web dashboard on random available port
 *   ax monitor --port 8080  # Use specific port
 *   ax monitor --no-open    # Don't auto-open browser
 *
 * Configuration (via ax config set):
 *   monitor.portMin         # Minimum port number (default: 3000)
 *   monitor.portMax         # Maximum port number (default: 3999)
 *   monitor.autoOpen        # Auto-open browser (default: true)
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createDashboardHTML } from '../web/dashboard.js';
import { createAPIHandler, setCachedProviderStatus } from '../web/api.js';
import { COLORS } from '../utils/terminal.js';
import { createConfigStore, getValue } from '@defai.digital/config-domain';
import type { MonitorConfig } from '@defai.digital/contracts';
import { bootstrap } from '../bootstrap.js';
import { getProviderStatus, PROVIDER_HEALTH_CHECK_TIMEOUT } from './status.js';

// Default port range (used if config not available)
const DEFAULT_PORT_MIN = 3000;
const DEFAULT_PORT_MAX = 3999;
const MAX_PORT_ATTEMPTS = 20;

// Active server instance (for cleanup)
let activeServer: Server | null = null;

/**
 * Try to start server on a port, returns the server if successful
 */
function tryStartServer(
  port: number,
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>
): Promise<{ server: Server; port: number } | null> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      handler(req, res).catch((err) => {
        console.error('Handler error:', err);
        if (!res.writableEnded) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(null); // Port in use, try next
      } else {
        resolve(null); // Other error, try next
      }
    });

    server.once('listening', () => {
      resolve({ server, port });
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port and start the server
 * Tries ports in the range until one works
 */
async function startServerWithRetry(
  portMin: number,
  portMax: number,
  explicitPort: number | undefined,
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>
): Promise<{ server: Server; port: number }> {
  // If explicit port provided, try only that port
  if (explicitPort !== undefined) {
    const result = await tryStartServer(explicitPort, handler);
    if (result) return result;
    throw new Error(`Port ${explicitPort} is already in use. Try: ax monitor (auto-selects available port)`);
  }

  // Try random ports first
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = Math.floor(Math.random() * (portMax - portMin + 1)) + portMin;
    const result = await tryStartServer(port, handler);
    if (result) return result;
  }

  // Fallback: try sequential ports
  for (let port = portMin; port <= portMax; port++) {
    const result = await tryStartServer(port, handler);
    if (result) return result;
  }

  throw new Error(`No available port found in range ${portMin}-${portMax}`);
}

/**
 * Load monitor configuration from config store
 */
async function getMonitorConfig(): Promise<MonitorConfig> {
  try {
    const store = createConfigStore();
    const config = await store.readMerged();
    if (config) {
      const monitorConfig = getValue<MonitorConfig>(config, 'monitor');
      if (monitorConfig) {
        return {
          portMin: monitorConfig.portMin ?? DEFAULT_PORT_MIN,
          portMax: monitorConfig.portMax ?? DEFAULT_PORT_MAX,
          autoOpen: monitorConfig.autoOpen ?? true,
        };
      }
    }
  } catch {
    // Ignore config errors, use defaults
  }
  return {
    portMin: DEFAULT_PORT_MIN,
    portMax: DEFAULT_PORT_MAX,
    autoOpen: true,
  };
}

/**
 * Monitor command handler
 */
export async function monitorCommand(
  args: string[],
  _options: CLIOptions
): Promise<CommandResult> {
  // Initialize bootstrap to get SQLite trace store (shared with other CLI commands)
  await bootstrap();

  // Check provider health at startup (cached for monitor lifetime)
  const showProgress = process.stdout.isTTY;
  if (showProgress) {
    process.stdout.write(`${COLORS.cyan}Checking provider health (up to ${PROVIDER_HEALTH_CHECK_TIMEOUT / 1000}s)...${COLORS.reset}`);
  }

  const providerStatuses = await getProviderStatus(showProgress);

  // Helper to normalize circuit state for dashboard
  const normalizeCircuitState = (state: string | undefined): 'closed' | 'open' | 'half-open' => {
    if (state === 'halfOpen') return 'half-open';
    if (state === 'open') return 'open';
    return 'closed';
  };

  // Convert to dashboard format and cache
  const dashboardProviders = providerStatuses.map(p => ({
    providerId: p.providerId,
    name: p.providerId,
    available: p.available,
    latencyMs: p.latencyMs,
    circuitState: normalizeCircuitState(p.circuitState),
    lastUsed: undefined,
  }));
  setCachedProviderStatus(dashboardProviders);

  if (showProgress) {
    process.stdout.write('\r\x1b[K'); // Clear progress line
  }

  // Parse explicit port from args (if provided)
  let explicitPort: number | undefined;
  const portArg = args.find(a => a.startsWith('--port=') || a.startsWith('-p='));
  if (portArg) {
    const portValue = portArg.split('=')[1];
    if (portValue) {
      const parsed = parseInt(portValue, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
        explicitPort = parsed;
      }
    }
  }
  // Also check for --port <number> format
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1) {
    const nextArg = args[portIndex + 1];
    if (nextArg) {
      const parsed = parseInt(nextArg, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
        explicitPort = parsed;
      }
    }
  }

  // Load monitor configuration
  const monitorConfig = await getMonitorConfig();

  // Check if browser should auto-open (command line flag overrides config)
  const noOpen = args.includes('--no-open') || !monitorConfig.autoOpen;

  // Create API handler
  const apiHandler = createAPIHandler();

  // Request handler for the server
  const requestHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = req.url ?? '/';

    // Security: Only allow localhost connections (defense-in-depth)
    // Server already binds to 127.0.0.1, but this adds request-level validation
    const remoteAddress = req.socket.remoteAddress ?? '';
    const isLocalhost = remoteAddress === '127.0.0.1' ||
                        remoteAddress === '::1' ||
                        remoteAddress === '::ffff:127.0.0.1' ||
                        remoteAddress === 'localhost';

    if (!isLocalhost) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Dashboard only accessible from localhost');
      return;
    }

    // Enable CORS for local development (restricted to localhost origins)
    // Reflect the request origin if it's from localhost, otherwise deny
    const origin = req.headers.origin ?? '';
    const isLocalOrigin = origin.startsWith('http://localhost:') ||
                          origin.startsWith('http://127.0.0.1:') ||
                          origin === 'http://localhost' ||
                          origin === 'http://127.0.0.1';
    if (isLocalOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API endpoints
    if (url.startsWith('/api/')) {
      await apiHandler(req, res);
      return;
    }

    // Serve dashboard HTML for root
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(createDashboardHTML());
      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  };

  // Start server with automatic port retry
  let server: Server;
  let port: number;
  try {
    const result = await startServerWithRetry(
      monitorConfig.portMin,
      monitorConfig.portMax,
      explicitPort,
      requestHandler
    );
    server = result.server;
    port = result.port;
  } catch (error) {
    console.error(`${COLORS.red}Error: ${error instanceof Error ? error.message : 'Failed to start server'}${COLORS.reset}`);
    return {
      success: false,
      exitCode: 1,
      message: error instanceof Error ? error.message : 'Failed to start server',
      data: null,
    };
  }

  activeServer = server;

  const url = `http://localhost:${port}`;

  // Print startup message
  console.log('');
  console.log(`${COLORS.cyan}${COLORS.bold}  AutomatosX Monitor${COLORS.reset}`);
  console.log('');
  console.log(`  ${COLORS.green}Dashboard running at:${COLORS.reset} ${COLORS.bold}${url}${COLORS.reset}`);
  console.log(`  ${COLORS.dim}Security: Localhost access only (127.0.0.1)${COLORS.reset}`);
  console.log('');
  console.log(`  ${COLORS.dim}Press Ctrl+C to stop${COLORS.reset}`);
  console.log('');

  // Auto-open browser
  if (!noOpen) {
    try {
      const { exec } = await import('node:child_process');
      const openCommand = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCommand} ${url}`);
    } catch {
      // Ignore browser open errors
    }
  }

  // Handle graceful shutdown
  const shutdown = () => {
    console.log(`\n${COLORS.dim}Shutting down...${COLORS.reset}`);
    if (activeServer) {
      activeServer.close();
      activeServer = null;
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process running
  await new Promise(() => {
    // Never resolves - server runs until interrupted
  });

  return {
    success: true,
    exitCode: 0,
    message: undefined,
    data: null,
  };
}
