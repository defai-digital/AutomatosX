/**
 * Build Manager
 *
 * Detects and runs build tools (Vite, Webpack, Rollup, esbuild, tsup, Parcel)
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface BuildTool {
  name: string;
  command: string;
  configFile?: string;
}

export interface BuildOptions {
  production?: boolean;
  watch?: boolean;
  analyze?: boolean;
  mode?: 'development' | 'production';
}

export interface DevOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

export interface WatchOptions {
  files?: string[];
}

export interface BuildResults {
  tool: string;
  success: boolean;
  duration: number;
  outputSize?: number;
  warnings: string[];
  errors: string[];
}

export class BuildManager {
  constructor(private workspaceRoot: string) {}

  /**
   * Detect build tool
   */
  async detectBuildTool(): Promise<BuildTool | null> {
    const packageJsonPath = join(this.workspaceRoot, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      // BUG #6 FIX: Validate package.json structure
      if (!packageJson || typeof packageJson !== 'object') {
        throw new Error('Invalid package.json: not an object');
      }

      // BUG #6 FIX: Validate dependencies are objects (or undefined)
      if (packageJson.dependencies && typeof packageJson.dependencies !== 'object') {
        throw new Error('Invalid package.json: dependencies must be an object');
      }

      if (packageJson.devDependencies && typeof packageJson.devDependencies !== 'object') {
        throw new Error('Invalid package.json: devDependencies must be an object');
      }

      if (packageJson.scripts && typeof packageJson.scripts !== 'object') {
        throw new Error('Invalid package.json: scripts must be an object');
      }

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for build tools in order of preference
      if (deps['vite']) {
        return {
          name: 'vite',
          command: 'vite',
          configFile: this.findConfig([
            'vite.config.ts',
            'vite.config.js',
            'vite.config.mjs'
          ])
        };
      }

      if (deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
        return {
          name: 'vite',
          command: 'vite',
          configFile: this.findConfig(['vite.config.ts', 'vite.config.js'])
        };
      }

      if (deps['webpack']) {
        return {
          name: 'webpack',
          command: 'webpack',
          configFile: this.findConfig([
            'webpack.config.js',
            'webpack.config.ts',
            'webpack.prod.js',
            'webpack.dev.js'
          ])
        };
      }

      if (deps['rollup']) {
        return {
          name: 'rollup',
          command: 'rollup',
          configFile: this.findConfig([
            'rollup.config.js',
            'rollup.config.ts',
            'rollup.config.mjs'
          ])
        };
      }

      if (deps['esbuild']) {
        return {
          name: 'esbuild',
          command: 'esbuild',
          configFile: this.findConfig(['esbuild.config.js', 'esbuild.config.mjs'])
        };
      }

      if (deps['tsup']) {
        return {
          name: 'tsup',
          command: 'tsup',
          configFile: this.findConfig(['tsup.config.ts', 'tsup.config.js'])
        };
      }

      if (deps['parcel']) {
        return {
          name: 'parcel',
          command: 'parcel',
          configFile: this.findConfig(['.parcelrc', 'parcel.config.json'])
        };
      }

      // Check for build script
      if (packageJson.scripts?.build) {
        const buildScript = packageJson.scripts.build;
        if (buildScript.includes('vite')) {
          return { name: 'vite', command: 'vite', configFile: undefined };
        }
        if (buildScript.includes('webpack')) {
          return { name: 'webpack', command: 'webpack', configFile: undefined };
        }
        if (buildScript.includes('rollup')) {
          return { name: 'rollup', command: 'rollup', configFile: undefined };
        }
        if (buildScript.includes('esbuild')) {
          return { name: 'esbuild', command: 'esbuild', configFile: undefined };
        }
        if (buildScript.includes('tsup')) {
          return { name: 'tsup', command: 'tsup', configFile: undefined };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Build project
   */
  async build(options: BuildOptions = {}): Promise<BuildResults> {
    const tool = await this.detectBuildTool();

    if (!tool) {
      throw new Error('No build tool detected. Install vite, webpack, rollup, esbuild, or tsup.');
    }

    const args = this.buildBuildArgs(tool, options);
    const startTime = Date.now();

    try {
      const result = await this.executeCommand(tool.command, args);
      const duration = (Date.now() - startTime) / 1000;

      return this.parseBuildOutput(result.stdout + result.stderr, tool.name, duration, result.exitCode === 0);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const err = error as any;
      return this.parseBuildOutput(
        (err.stdout || '') + (err.stderr || ''),
        tool.name,
        duration,
        false
      );
    }
  }

  /**
   * Start dev server
   */
  async dev(options: DevOptions = {}): Promise<{ pid: number; url: string }> {
    const tool = await this.detectBuildTool();

    if (!tool) {
      throw new Error('No build tool detected.');
    }

    const args = this.buildDevArgs(tool, options);

    // Execute in background and return pid
    const proc = spawn(tool.command, args, {
      cwd: this.workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // BUG #1 FIX: Disable shell execution
      detached: false
    });

    // Wait for server to start and extract URL
    return new Promise((resolve, reject) => {
      let output = '';
      let resolved = false; // BUG #1 FIX: Prevent double-resolution

      const timeout = setTimeout(() => {
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(new Error('Dev server start timeout'));
        }
      }, 10000);

      // BUG #1 FIX: Cleanup function to remove all listeners
      const cleanup = () => {
        clearTimeout(timeout);
        if (proc.stdout) proc.stdout.removeAllListeners();
        if (proc.stderr) proc.stderr.removeAllListeners();
        proc.removeAllListeners('error');
      };

      const onData = (data: Buffer) => {
        if (resolved) return;

        output += data.toString();

        // BUG #1 FIX: Better URL regex (looks for common dev server patterns)
        const urlMatch = output.match(/(?:Local|Server running|listening).*?(https?:\/\/[^\s]+)/i);
        if (urlMatch && urlMatch[1]) {
          cleanup();
          resolved = true;

          // BUG #1 FIX: Validate PID exists
          if (!proc.pid) {
            reject(new Error('Dev server process has no PID'));
            return;
          }

          resolve({
            pid: proc.pid,
            url: urlMatch[1]
          });
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);

      proc.on('error', (error) => {
        cleanup();
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
    });
  }

  /**
   * Watch for changes
   */
  async watch(options: WatchOptions = {}): Promise<{ pid: number }> {
    const tool = await this.detectBuildTool();

    if (!tool) {
      throw new Error('No build tool detected.');
    }

    const args = this.buildWatchArgs(tool, options);

    // BUG #7 FIX: Don't wait indefinitely - spawn detached and return PID
    // Watch processes run forever, so we should return immediately
    const proc = spawn(tool.command, args, {
      cwd: this.workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: false
    });

    // BUG #7 FIX: Validate PID exists
    if (!proc.pid) {
      throw new Error('Watch process has no PID');
    }

    // Return PID so caller can manage the process
    return { pid: proc.pid };
  }

  /**
   * Build arguments for build command
   */
  private buildBuildArgs(tool: BuildTool, options: BuildOptions): string[] {
    const args: string[] = [];

    switch (tool.name) {
      case 'vite':
        args.push('build');
        if (options.watch) args.push('--watch');
        if (options.mode) args.push('--mode', options.mode);
        break;

      case 'webpack':
        if (options.production || options.mode === 'production') {
          args.push('--mode', 'production');
        } else {
          args.push('--mode', 'development');
        }
        if (options.watch) args.push('--watch');
        if (options.analyze) args.push('--analyze');
        break;

      case 'rollup':
        args.push('-c'); // Use config file
        if (options.watch) args.push('--watch');
        break;

      case 'esbuild':
        if (tool.configFile) {
          args.push('--config', tool.configFile);
        }
        if (options.watch) args.push('--watch');
        if (options.production) {
          args.push('--minify');
        }
        break;

      case 'tsup':
        if (options.watch) args.push('--watch');
        if (options.production) args.push('--minify');
        break;

      case 'parcel':
        args.push('build');
        if (options.production === false) {
          args.push('--no-optimize');
        }
        break;
    }

    return args;
  }

  /**
   * Build arguments for dev command
   */
  private buildDevArgs(tool: BuildTool, options: DevOptions): string[] {
    const args: string[] = [];

    switch (tool.name) {
      case 'vite':
        args.push('dev');
        if (options.port) args.push('--port', options.port.toString());
        if (options.host) args.push('--host', options.host);
        if (options.open) args.push('--open');
        break;

      case 'webpack':
        args.push('serve');
        if (options.port) args.push('--port', options.port.toString());
        if (options.host) args.push('--host', options.host);
        if (options.open) args.push('--open');
        break;

      case 'parcel':
        args.push('serve');
        if (options.port) args.push('--port', options.port.toString());
        if (options.open) args.push('--open');
        break;

      default:
        // For tools without dev server, fall back to build --watch
        args.push('build', '--watch');
    }

    return args;
  }

  /**
   * Build arguments for watch command
   */
  private buildWatchArgs(tool: BuildTool, options: WatchOptions): string[] {
    const args: string[] = [];

    switch (tool.name) {
      case 'vite':
        args.push('build', '--watch');
        break;

      case 'webpack':
        args.push('--watch');
        break;

      case 'rollup':
        args.push('-c', '--watch');
        break;

      case 'esbuild':
        args.push('--watch');
        if (tool.configFile) {
          args.unshift('--config', tool.configFile);
        }
        break;

      case 'tsup':
        args.push('--watch');
        break;

      default:
        args.push('build', '--watch');
    }

    // BUG #19 FIX: Validate each file path for shell metacharacters
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        if (file.includes(';') || file.includes('|') || file.includes('&') ||
            file.includes('$') || file.includes('`') || file.includes('\n')) {
          throw new Error(`Invalid file path contains shell metacharacters: ${file}`);
        }
      }
      args.push(...options.files);
    }

    return args;
  }

  /**
   * Parse build output
   */
  private parseBuildOutput(output: string, tool: string, duration: number, success: boolean): BuildResults {
    const results: BuildResults = {
      tool,
      success,
      duration,
      warnings: [],
      errors: []
    };

    // BUG #3 FIX: Better error/warning detection patterns
    const errorPatterns = [
      /error:/i,           // "error: message"
      /\berror\b.*:/i,     // Word boundary + colon
      /failed/i,           // "Failed to..."
      /✘/                  // Error symbol
    ];

    const warningPatterns = [
      /warning:/i,         // "warning: message"
      /\bwarning\b.*:/i,   // Word boundary + colon
      /⚠/                  // Warning symbol
    ];

    // Parse output for warnings and errors
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for errors (but skip false positives like "0 errors", "no errors")
      const hasError = errorPatterns.some(pattern => pattern.test(trimmed));
      const isFalsePositive = /\b0\s+errors?\b/i.test(trimmed) ||
                              /no\s+errors?\b/i.test(trimmed);

      if (hasError && !isFalsePositive) {
        results.errors.push(trimmed);
      }

      // Check for warnings
      const hasWarning = warningPatterns.some(pattern => pattern.test(trimmed));
      const isWarningFalsePositive = /\b0\s+warnings?\b/i.test(trimmed);

      if (hasWarning && !isWarningFalsePositive) {
        results.warnings.push(trimmed);
      }
    }

    // BUG #2 FIX: More comprehensive output size extraction for all tools
    if (tool === 'vite') {
      // Vite: "dist/index.js  12.34 kB │ gzip: 5.67 kB"
      const sizeMatch = output.match(/dist\/[^\s]+\s+([\d.]+)\s+k?B/i);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    } else if (tool === 'webpack') {
      // Webpack: "main.js  123.45 KiB"
      const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s+KiB/);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    } else if (tool === 'rollup') {
      // Rollup: "created dist/bundle.js in 123ms (12.34 kB)"
      const sizeMatch = output.match(/\((\d+(?:\.\d+)?)\s+k?B\)/i);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    } else if (tool === 'esbuild') {
      // esbuild: "dist/index.js  12.3kb"
      const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s*k?b/i);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    } else if (tool === 'tsup') {
      // tsup: "dist/index.js 12.34 KB"
      const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s+k?B/i);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    } else if (tool === 'parcel') {
      // Parcel: "dist/index.js  12.34 KB  1.23s"
      const sizeMatch = output.match(/(\d+(?:\.\d+)?)\s+KB/);
      if (sizeMatch && sizeMatch[1]) {
        results.outputSize = parseFloat(sizeMatch[1]);
      }
    }

    // BUG #4 FIX: Override success if we found errors
    if (results.errors.length > 0) {
      results.success = false;
    }

    return results;
  }

  /**
   * Execute command
   */
  private async executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Security: Validate command is whitelisted
    const allowedCommands = ['vite', 'webpack', 'rollup', 'esbuild', 'tsup', 'parcel'];
    if (!allowedCommands.includes(command)) {
      throw new Error(`Invalid build command: ${command}`);
    }

    // Security: Sanitize arguments - remove shell metacharacters
    const sanitizedArgs = args.map(arg => {
      if (arg.includes(';') || arg.includes('|') || arg.includes('&') ||
          arg.includes('$') || arg.includes('`') || arg.includes('\n')) {
        throw new Error(`Invalid argument contains shell metacharacters: ${arg}`);
      }
      return arg;
    });

    return new Promise((resolve, reject) => {
      const proc = spawn(command, sanitizedArgs, {
        cwd: this.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false // SECURITY FIX: Disable shell execution to prevent command injection
      });

      let stdout = '';
      let stderr = '';
      let settled = false; // BUG #17 FIX: Prevent double-resolution race condition

      // BUG #18 FIX: Proper null checks for stdout/stderr
      if (proc.stdout) {
        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code: number | null, signal: string | null) => {
        if (settled) return; // BUG #17 FIX: Prevent double-resolution
        settled = true;

        // Better exit code handling
        const exitCode = code ?? 0; // null = success if no signal

        if (signal) {
          const error = new Error(`Process terminated by signal ${signal}`);
          (error as any).signal = signal;
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
        } else if (exitCode === 0) {
          resolve({ stdout, stderr, exitCode: 0 });
        } else {
          const error = new Error(`Command failed with exit code ${exitCode}`);
          (error as any).exitCode = exitCode;
          (error as any).stdout = stdout;
          (error as any).stderr = stderr;
          reject(error);
        }
      });

      proc.on('error', (error: Error) => {
        if (settled) return; // BUG #17 FIX: Prevent double-resolution
        settled = true;
        reject(error);
      });
    });
  }

  /**
   * Find config file
   */
  private findConfig(candidates: string[]): string | undefined {
    for (const candidate of candidates) {
      const path = join(this.workspaceRoot, candidate);
      if (existsSync(path)) {
        return candidate;
      }
    }
    return undefined;
  }
}
