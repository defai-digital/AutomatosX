/**
 * Agent Launcher with MCP Bootstrap (v12.0.0)
 *
 * Launches AI agents with automatic MCP config injection for bidirectional
 * communication. Supports Claude and Gemini providers.
 *
 * @module core/agent-launcher
 */

import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../shared/logging/logger.js';
import {
  injectMCPConfig,
  getDefaultMCPServerConfig,
  isMCPConfigInjected,
  type MCPProvider,
  type MCPServerConfig
} from '../mcp/config-injector.js';
import {
  isAutoInjectMCPConfigEnabled,
  isMCPBidirectionalEnabled
} from './feature-flags/flags.js';

/**
 * Agent launch options
 */
export interface AgentLaunchOptions {
  /** Agent name/profile to use */
  agent: string;
  /** Task to execute */
  task: string;
  /** Provider to use */
  provider: MCPProvider;
  /** Enable MCP bidirectional communication */
  mcpEnabled?: boolean;
  /** Custom MCP server config (uses default if not provided) */
  mcpConfig?: MCPServerConfig;
  /** Working directory for the agent */
  cwd?: string;
  /** Environment variables to pass */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Agent process wrapper
 */
export interface AgentProcess {
  /** Child process */
  process: ChildProcess;
  /** Process ID */
  pid: number;
  /** Provider used */
  provider: MCPProvider;
  /** Whether MCP was injected */
  mcpInjected: boolean;
  /** Promise that resolves when process completes */
  completion: Promise<AgentResult>;
  /** Kill the process */
  kill: () => void;
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Exit code */
  exitCode: number | null;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration in ms */
  durationMs: number;
}

/**
 * Build the CLI command for a provider
 */
function getProviderCommand(provider: MCPProvider): string {
  switch (provider) {
    case 'claude':
      return 'claude';
    case 'gemini':
      return 'gemini';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Build command arguments with MCP instructions
 */
function buildPromptWithMCPInstructions(agent: string, task: string, mcpEnabled: boolean): string {
  const basePrompt = `You are acting as the "${agent}" agent.

Task: ${task}`;

  if (!mcpEnabled) {
    return basePrompt;
  }

  // Add MCP instructions for bidirectional communication
  return `${basePrompt}

## AutomatosX MCP Integration

You have access to AutomatosX tools via MCP. Use these to:
- Search project memory for relevant context
- Store important findings in memory
- Run other agents for specialized tasks
- Create and manage sessions

Available MCP tools:
- search_memory: Search for relevant context
- memory_add: Store new information
- run_agent: Delegate to other agents
- list_agents: See available agents
- session_create/complete/fail: Manage workflow sessions
- get_status: Check system status

Use these tools when they would help complete the task more effectively.`;
}

/**
 * Launch an agent with optional MCP bootstrap
 *
 * @example
 * ```typescript
 * const agentProcess = await launchAgent({
 *   agent: 'backend',
 *   task: 'Implement user authentication',
 *   provider: 'claude',
 *   mcpEnabled: true
 * });
 *
 * const result = await agentProcess.completion;
 * console.log('Exit code:', result.exitCode);
 * console.log('Output:', result.stdout);
 * ```
 */
export async function launchAgent(options: AgentLaunchOptions): Promise<AgentProcess> {
  const {
    agent,
    task,
    provider,
    mcpEnabled = true,
    mcpConfig,
    cwd = process.cwd(),
    env = {},
    timeout
  } = options;

  logger.debug('Launching agent', {
    agent,
    provider,
    mcpEnabled,
    cwd
  });

  // Check feature flags
  const mcpBidirectional = isMCPBidirectionalEnabled();
  const autoInject = isAutoInjectMCPConfigEnabled();
  const shouldUseMCP = mcpEnabled && mcpBidirectional;

  let mcpInjected = false;

  // Inject MCP config if enabled
  if (shouldUseMCP && autoInject) {
    const alreadyInjected = await isMCPConfigInjected(provider);

    if (!alreadyInjected) {
      const config = mcpConfig || getDefaultMCPServerConfig();
      const result = await injectMCPConfig(provider, config);

      if (result.success) {
        mcpInjected = true;
        logger.info('MCP config injected for agent launch', {
          provider,
          configPath: result.configPath
        });
      } else {
        logger.warn('MCP config injection failed, continuing without MCP', {
          provider,
          error: result.error
        });
      }
    } else {
      mcpInjected = true;
      logger.debug('MCP config already injected', { provider });
    }
  }

  // Build prompt
  const prompt = buildPromptWithMCPInstructions(agent, task, shouldUseMCP && mcpInjected);

  // Get command
  const command = getProviderCommand(provider);

  // Spawn process
  const startTime = Date.now();

  const childProcess = spawn(command, [prompt], {
    cwd,
    env: {
      ...process.env,
      ...env,
      AUTOMATOSX_AGENT: agent,
      AUTOMATOSX_MCP_ENABLED: String(mcpInjected)
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  // Set up timeout if specified
  let timeoutHandle: NodeJS.Timeout | undefined;

  if (timeout) {
    timeoutHandle = setTimeout(() => {
      logger.warn('Agent execution timeout, killing process', {
        agent,
        provider,
        timeout
      });
      childProcess.kill('SIGTERM');
    }, timeout);
  }

  // Create completion promise
  const completion = new Promise<AgentResult>((resolve) => {
    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const durationMs = Date.now() - startTime;

      logger.debug('Agent process completed', {
        agent,
        provider,
        exitCode: code,
        durationMs
      });

      resolve({
        exitCode: code,
        stdout,
        stderr,
        success: code === 0,
        durationMs
      });
    });

    childProcess.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const durationMs = Date.now() - startTime;

      logger.error('Agent process error', {
        agent,
        provider,
        error: error.message
      });

      resolve({
        exitCode: null,
        stdout: '',
        stderr: error.message,
        success: false,
        durationMs
      });
    });
  });

  return {
    process: childProcess,
    pid: childProcess.pid || 0,
    provider,
    mcpInjected,
    completion,
    kill: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      childProcess.kill('SIGTERM');
    }
  };
}

/**
 * Launch agent in legacy mode (without MCP)
 */
export async function launchAgentLegacy(options: Omit<AgentLaunchOptions, 'mcpEnabled' | 'mcpConfig'>): Promise<AgentProcess> {
  return launchAgent({
    ...options,
    mcpEnabled: false
  });
}

/**
 * Check if a provider CLI is available
 */
export async function isProviderAvailable(provider: MCPProvider): Promise<boolean> {
  return new Promise((resolve) => {
    const command = getProviderCommand(provider);
    const child = spawn(command, ['--version'], {
      stdio: 'pipe',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });
}
