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
import { createServer } from 'node:http';
import { createRuntime, failure } from '../utils/formatters.js';
const DEFAULT_PORT_MIN = 3000;
const DEFAULT_PORT_MAX = 3999;
const MAX_PORT_ATTEMPTS = 20;
function tryPort(port, handler) {
    return new Promise((resolve) => {
        const server = createServer(handler);
        server.once('error', () => resolve(null));
        server.once('listening', () => resolve(server));
        server.listen(port, '127.0.0.1');
    });
}
async function startServer(portMin, portMax, explicitPort, handler) {
    if (explicitPort !== undefined) {
        const s = await tryPort(explicitPort, handler);
        if (s !== null)
            return { server: s, port: explicitPort };
        throw new Error(`Port ${explicitPort} is already in use.`);
    }
    for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
        const port = Math.floor(Math.random() * (portMax - portMin + 1)) + portMin;
        const s = await tryPort(port, handler);
        if (s !== null)
            return { server: s, port };
    }
    for (let port = portMin; port <= portMax; port++) {
        const s = await tryPort(port, handler);
        if (s !== null)
            return { server: s, port };
    }
    throw new Error(`No available port found in range ${portMin}-${portMax}.`);
}
function buildDashboardHtml(data) {
    const json = JSON.stringify(data, null, 2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutomatosX Monitor</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
    h1 { color: #58a6ff; font-size: 1.2rem; margin-bottom: 4px; }
    .subtitle { color: #6e7681; font-size: 0.8rem; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; }
    .card h2 { color: #79c0ff; font-size: 0.9rem; margin: 0 0 8px; }
    .count { font-size: 2rem; color: #56d364; font-weight: bold; }
    .label { color: #6e7681; font-size: 0.75rem; }
    pre { background: #0d1117; border: 1px solid #21262d; border-radius: 4px; padding: 12px; overflow: auto; font-size: 0.75rem; max-height: 300px; }
    .refresh { color: #6e7681; font-size: 0.75rem; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>AutomatosX Monitor</h1>
  <p class="subtitle">Localhost only &bull; Auto-refreshes every 10s</p>
  <div class="grid">
    <div class="card">
      <h2>Active Sessions</h2>
      <div class="count">${data.sessions.filter((s) => s.status === 'active').length}</div>
      <div class="label">of ${data.sessions.length} total</div>
    </div>
    <div class="card">
      <h2>Running Traces</h2>
      <div class="count">${data.traces.filter((t) => t.status === 'running').length}</div>
      <div class="label">of ${data.traces.length} recent</div>
    </div>
    <div class="card">
      <h2>Registered Agents</h2>
      <div class="count">${data.agents.length}</div>
      <div class="label">total</div>
    </div>
  </div>
  <h2 style="color:#79c0ff;font-size:0.9rem;margin-top:24px;">Raw State</h2>
  <pre id="raw">${json.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <p class="refresh">Last updated: <span id="ts">${new Date().toISOString()}</span></p>
  <script>
    setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>`;
}
export async function monitorCommand(args, options) {
    if (options.help) {
        return {
            success: true,
            exitCode: 0,
            message: 'Usage: ax monitor [options]\n\n' +
                'Options:\n' +
                '  --port <n>   Use specific port (default: auto 3000-3999)\n' +
                '  --no-open    Do not auto-open browser',
            data: undefined,
        };
    }
    const runtime = createRuntime(options);
    // Parse --port
    let explicitPort;
    const portIdx = args.indexOf('--port');
    if (portIdx !== -1 && args[portIdx + 1] !== undefined) {
        const p = parseInt(args[portIdx + 1], 10);
        if (!isNaN(p) && p > 0 && p < 65536)
            explicitPort = p;
    }
    const noOpen = args.includes('--no-open');
    // Request handler
    const requestHandler = async (req, res) => {
        const remote = req.socket.remoteAddress ?? '';
        const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
        if (!isLocal) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        if (req.url === '/api/state') {
            try {
                const [sessions, traces, agents] = await Promise.all([
                    runtime.listSessions(),
                    runtime.listTraces(options.limit ?? 20),
                    runtime.listAgents(),
                ]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sessions, traces, agents }));
            }
            catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
            return;
        }
        if (req.url === '/' || req.url === '/index.html') {
            try {
                const [sessions, traces, agents] = await Promise.all([
                    runtime.listSessions(),
                    runtime.listTraces(options.limit ?? 20),
                    runtime.listAgents(),
                ]);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(buildDashboardHtml({ sessions, traces, agents }));
            }
            catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error loading state: ${err instanceof Error ? err.message : String(err)}`);
            }
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    };
    let result;
    try {
        result = await startServer(DEFAULT_PORT_MIN, DEFAULT_PORT_MAX, explicitPort, (req, res) => {
            requestHandler(req, res).catch((err) => {
                if (!res.writableEnded) {
                    res.writeHead(500);
                    res.end('Internal Server Error');
                }
                process.stderr.write(`Monitor handler error: ${err}\n`);
            });
        });
    }
    catch (err) {
        return failure(err instanceof Error ? err.message : String(err));
    }
    const url = `http://localhost:${result.port}`;
    console.log(`\nAutomatosX Monitor running at: ${url}`);
    console.log('Localhost access only. Press Ctrl+C to stop.\n');
    if (!noOpen) {
        const { exec } = await import('node:child_process');
        const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${open} ${url}`);
    }
    const shutdown = () => {
        console.log('\nShutting down monitor...');
        result.server.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await new Promise(() => { });
    return { success: true, exitCode: 0, message: undefined, data: null };
}
