/**
 * AX Client Service
 *
 * Communicates with AutomatosX CLI to execute commands and retrieve data.
 * Provides both synchronous command execution and streaming support.
 *
 * @module @ax/vscode-extension/services/axClient
 */

import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

export interface Agent {
  id: string;
  displayName: string;
  team: string;
  role: string;
  description?: string;
  enabled: boolean;
  abilities?: string[];
  orchestration?: {
    maxDelegationDepth: number;
    priority: number;
    canDelegateTo: string[];
  };
}

export interface Session {
  id: string;
  displayId: string;
  agentId: string;
  status: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  agentId?: string;
  tags: string[];
  createdAt: string;
  relevance?: number;
}

export interface ExecutionResult {
  success: boolean;
  agent: string;
  autoSelected: boolean;
  sessionId: string;
  taskId: string;
  output: string;
  duration: number;
  provider?: string;
  error?: string;
}

export interface SystemStatus {
  initialized: boolean;
  basePath: string;
  agentCount: number;
  sessionCount: number;
  memoryEntries: number;
  providers: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck?: string;
  }[];
}

export interface ProviderStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  successRate: number;
  avgLatency: number;
  lastCheck: string;
}

// =============================================================================
// AX Client Class
// =============================================================================

export class AxClient {
  private outputChannel: vscode.OutputChannel;
  private workspacePath: string;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  /**
   * Execute an AX CLI command and return JSON result
   */
  private async execCommand<T>(args: string[]): Promise<T> {
    const command = `ax ${args.join(' ')} --json`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspacePath,
        timeout: 30000,
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return JSON.parse(stdout) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.outputChannel.appendLine(`[ERROR] Command failed: ${command}`);
      this.outputChannel.appendLine(`[ERROR] ${message}`);
      throw new Error(`AX command failed: ${message}`);
    }
  }

  /**
   * Execute a task with streaming output
   */
  async executeTask(
    agent: string,
    task: string,
    options: {
      sessionId?: string;
      timeout?: number;
      stream?: boolean;
      onOutput?: (text: string) => void;
      onComplete?: (result: ExecutionResult) => void;
      onError?: (error: Error) => void;
      token?: vscode.CancellationToken;
    } = {}
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const args = ['run', agent, JSON.stringify(task)];

      if (options.sessionId) {
        args.push('--session', options.sessionId);
      }
      if (options.timeout) {
        args.push('--timeout', options.timeout.toString());
      }
      if (options.stream) {
        args.push('--stream');
      }
      args.push('--json');

      this.outputChannel.appendLine(`[CMD] ax ${args.join(' ')}`);

      const child = spawn('ax', args, {
        cwd: this.workspacePath,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;

        if (options.stream && options.onOutput) {
          // Try to parse streaming JSON lines
          const lines = text.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.output) {
                options.onOutput(parsed.output);
              }
            } catch {
              // Not JSON, output raw text
              options.onOutput(text);
            }
          }
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        this.outputChannel.appendLine(`[STDERR] ${data.toString()}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Find the last valid JSON in output
            const lines = stdout.trim().split('\n');
            let result: ExecutionResult | null = null;

            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                result = JSON.parse(lines[i]!) as ExecutionResult;
                break;
              } catch {
                continue;
              }
            }

            if (result) {
              options.onComplete?.(result);
              resolve(result);
            } else {
              throw new Error('No valid JSON result found');
            }
          } catch (error) {
            const err = new Error(`Failed to parse result: ${stdout}`);
            options.onError?.(err);
            reject(err);
          }
        } else {
          const err = new Error(stderr || `Command exited with code ${code}`);
          options.onError?.(err);
          reject(err);
        }
      });

      // Handle cancellation
      if (options.token) {
        options.token.onCancellationRequested(() => {
          child.kill('SIGTERM');
          reject(new Error('Execution cancelled'));
        });
      }
    });
  }

  /**
   * Get list of all agents
   */
  async getAgents(): Promise<Agent[]> {
    try {
      const result = await this.execCommand<Agent[]>(['agent', 'list']);
      return result;
    } catch {
      // Return empty array if not initialized
      return [];
    }
  }

  /**
   * Get detailed info about an agent
   */
  async getAgentInfo(name: string): Promise<Agent | null> {
    try {
      return await this.execCommand<Agent>(['agent', 'info', name]);
    } catch {
      return null;
    }
  }

  /**
   * Get list of sessions
   */
  async getSessions(): Promise<Session[]> {
    try {
      const result = await this.execCommand<Session[]>(['session', 'list']);
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(id: string): Promise<Session | null> {
    try {
      return await this.execCommand<Session>(['session', 'info', id]);
    } catch {
      return null;
    }
  }

  /**
   * Search memory
   */
  async searchMemory(query: string, limit = 10): Promise<MemoryEntry[]> {
    try {
      return await this.execCommand<MemoryEntry[]>(['memory', 'search', JSON.stringify(query), '--limit', limit.toString()]);
    } catch {
      return [];
    }
  }

  /**
   * Get memory stats
   */
  async getMemoryStats(): Promise<{ totalEntries: number; dbSize: string }> {
    try {
      return await this.execCommand<{ totalEntries: number; dbSize: string }>(['memory', 'stats']);
    } catch {
      return { totalEntries: 0, dbSize: '0 KB' };
    }
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<SystemStatus> {
    try {
      return await this.execCommand<SystemStatus>(['status']);
    } catch {
      return {
        initialized: false,
        basePath: '',
        agentCount: 0,
        sessionCount: 0,
        memoryEntries: 0,
        providers: [],
      };
    }
  }

  /**
   * Get provider status
   */
  async getProviderStatus(): Promise<ProviderStatus[]> {
    try {
      return await this.execCommand<ProviderStatus[]>(['provider', 'status']);
    } catch {
      return [];
    }
  }

  /**
   * Run setup
   */
  async setup(force = false): Promise<{ success: boolean; message: string }> {
    try {
      const args = ['setup'];
      if (force) {
        args.push('--force');
      }
      return await this.execCommand<{ success: boolean; message: string }>(args);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Setup failed',
      };
    }
  }

  /**
   * Check if AutomatosX is initialized in the workspace
   */
  async isInitialized(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.initialized;
    } catch {
      return false;
    }
  }

  /**
   * Run doctor diagnostics
   */
  async doctor(): Promise<{ checks: { name: string; status: string; message: string }[] }> {
    try {
      return await this.execCommand<{ checks: { name: string; status: string; message: string }[] }>(['doctor']);
    } catch {
      return { checks: [] };
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let clientInstance: AxClient | null = null;

export function getAxClient(outputChannel: vscode.OutputChannel): AxClient {
  if (!clientInstance) {
    clientInstance = new AxClient(outputChannel);
  }
  return clientInstance;
}

export function disposeAxClient(): void {
  clientInstance = null;
}
