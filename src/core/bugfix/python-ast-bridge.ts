import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { logger } from '../../shared/logging/logger.js';

export type PythonASTQueryType =
  | 'resource_leak'
  | 'missing_context_manager'
  | 'async_resource_leak'
  | 'executor_leak'
  | 'exception_handling';

export interface PythonASTQuery {
  type: PythonASTQueryType;
  patterns?: string[];
}

export interface PythonASTFinding {
  type: PythonASTQueryType;
  line: number;
  column: number;
  endLine?: number | null;
  endColumn?: number | null;
  message: string;
  context: string;
  metadata?: Record<string, unknown>;
}

export interface PythonParseError {
  message: string;
  line?: number | null;
  column?: number | null;
}

export interface PythonASTResponse {
  findings: PythonASTFinding[];
  parseErrors: PythonParseError[];
  pythonVersion?: string;
}

export type PythonBridgeErrorCode =
  | 'PYTHON_NOT_FOUND'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'EXECUTION_FAILED';

export class PythonBridgeError extends Error {
  code: PythonBridgeErrorCode;
  stderr?: string;

  constructor(code: PythonBridgeErrorCode, message: string, stderr?: string) {
    super(message);
    this.code = code;
    this.stderr = stderr;
  }
}

export interface PythonASTBridgeOptions {
  pythonPath?: string;
  scriptPath?: string;
  timeoutMs?: number;
}

/**
 * Common Python paths to try on different systems
 */
const PYTHON_PATHS = [
  process.env.AX_PYTHON_BIN,
  '/usr/bin/python3',
  '/usr/local/bin/python3',
  '/opt/homebrew/bin/python3',
  'python3',
  'python'
].filter((p): p is string => !!p);

export class PythonASTBridge {
  private pythonPath: string | null = null;
  private scriptPath: string;
  private defaultTimeoutMs: number;

  constructor(options: PythonASTBridgeOptions = {}) {
    // If explicit pythonPath provided, use it; otherwise will be discovered on first use
    this.pythonPath = options.pythonPath || null;
    this.scriptPath = options.scriptPath || this.findScriptPath();
    this.defaultTimeoutMs = options.timeoutMs ?? 800;
  }

  /**
   * Find the Python AST bridge script
   * Handles both development (src/) and bundled (dist/) scenarios
   */
  private findScriptPath(): string {
    // Try multiple locations for the script
    const candidates = [
      // From bundled dist/index.js
      join(process.cwd(), 'tools', 'python_ast_bridge.py'),
      // From source src/core/bugfix/python-ast-bridge.ts
      fileURLToPath(new URL('../../../tools/python_ast_bridge.py', import.meta.url)),
      // Fallback: resolve from this file's directory
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tools', 'python_ast_bridge.py')
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        logger.debug('Found Python AST bridge script', { path: candidate });
        return candidate;
      }
    }

    // Default to cwd-based path (will fail gracefully if not found)
    return join(process.cwd(), 'tools', 'python_ast_bridge.py');
  }

  /**
   * Find a working Python interpreter (cached after first discovery)
   */
  private async findPython(): Promise<string> {
    // Return cached path if already discovered
    if (this.pythonPath) {
      return this.pythonPath;
    }

    const { execSync } = await import('child_process');

    for (const pythonPath of PYTHON_PATHS) {
      try {
        execSync(`${pythonPath} --version`, { stdio: 'pipe', timeout: 2000 });
        // Cache the discovered path
        this.pythonPath = pythonPath;
        return pythonPath;
      } catch {
        // Try next path
      }
    }
    throw new PythonBridgeError('PYTHON_NOT_FOUND', 'Python 3 not found. Install Python 3 or set AX_PYTHON_BIN');
  }

  async analyze(input: {
    path: string;
    content: string;
    queries: PythonASTQuery[];
    timeoutMs?: number;
  }): Promise<PythonASTResponse> {
    if (!input.queries || input.queries.length === 0) {
      return { findings: [], parseErrors: [], pythonVersion: undefined };
    }

    // Find working Python interpreter (cached after first call)
    const pythonPath = await this.findPython();

    const timeoutMs = input.timeoutMs ?? this.defaultTimeoutMs;
    const payload = JSON.stringify({
      action: 'analyze',
      path: input.path,
      content: input.content,
      queries: input.queries
    });

    const cwd = dirname(this.scriptPath);

    return new Promise<PythonASTResponse>((resolve, reject) => {
      const child = spawn(pythonPath, [this.scriptPath], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        child.kill('SIGKILL');
        reject(new PythonBridgeError('TIMEOUT', `Python bridge timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Unref timer to prevent blocking process exit
      if (timer.unref) {
        timer.unref();
      }

      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('error', err => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new PythonBridgeError('PYTHON_NOT_FOUND', 'python3 not found in PATH'));
          return;
        }
        reject(new PythonBridgeError('EXECUTION_FAILED', err.message));
      });

      child.on('exit', code => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);

        if (code !== 0 && stderr) {
          reject(new PythonBridgeError('EXECUTION_FAILED', `Python exited with code ${code}`, stderr));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as PythonASTResponse;
          resolve(parsed);
        } catch (error) {
          logger.warn('Invalid JSON from python_ast_bridge', {
            error: (error as Error).message,
            stdout,
            stderr
          });
          reject(new PythonBridgeError('INVALID_OUTPUT', 'Failed to parse bridge output', stderr || stdout));
        }
      });

      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}
