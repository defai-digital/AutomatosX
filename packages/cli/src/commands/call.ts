/**
 * Call Command - Direct provider invocation with context and iterate support
 *
 * Usage: ax call <provider> <prompt>
 *        ax call --iterate <provider> <prompt>
 *        ax call --provider <provider> --file <file>
 *
 * All adapter imports are centralized in bootstrap.ts (composition root).
 */

import { readFile } from 'node:fs/promises';
import type { CommandResult, CLIOptions } from '../types.js';
import { parseTime } from '../parser.js';

// Bootstrap imports - composition root provides adapter access
import {
  createProvider,
  PROVIDER_CONFIGS,
  type CLIProviderConfig,
  type CompletionRequest,
} from '../bootstrap.js';

// Context and Iterate domain imports
import {
  ContextLoader,
  hasProjectContext,
} from '@defai.digital/context-domain';
import {
  IterateController,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TIME_MS,
} from '@defai.digital/iterate-domain';
import type { IterateIntent, IterateState } from '@defai.digital/contracts';
import {
  getErrorMessage,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
} from '@defai.digital/contracts';
import { COLORS } from '../utils/terminal.js';

/** Milliseconds per second */
const MS_PER_SECOND = 1000;

/** Milliseconds per minute */
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

/** Milliseconds per hour */
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;

/**
 * Provider configurations from bootstrap
 */
const PROVIDERS = PROVIDER_CONFIGS;

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed call command arguments
 */
interface ParsedCallArgs {
  provider: string | undefined;
  prompt: string | undefined;
  file: string | undefined;
  model: string | undefined;
  systemPrompt: string | undefined;
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parses call command arguments
 */
function parseCallArgs(args: string[], options: CLIOptions): ParsedCallArgs {
  let provider: string | undefined;
  let prompt: string | undefined;
  let file: string | undefined;
  let model: string | undefined;
  let systemPrompt: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--provider' && i + 1 < args.length) {
      provider = args[++i];
    } else if (arg === '--prompt' && i + 1 < args.length) {
      prompt = args[++i];
    } else if (arg === '--file' && i + 1 < args.length) {
      file = args[++i];
    } else if (arg === '--model' && i + 1 < args.length) {
      model = args[++i];
    } else if (arg === '--system' && i + 1 < args.length) {
      systemPrompt = args[++i];
    } else if (arg !== undefined && !arg.startsWith('-')) {
      // Positional arguments: first is provider, rest is prompt
      if (provider === undefined) {
        provider = arg;
      } else if (prompt === undefined) {
        // Collect remaining args as prompt
        prompt = args.slice(i).filter(a => !a.startsWith('-')).join(' ');
        break;
      }
    }
  }

  // Check for file option in CLIOptions (reuse input field)
  if (file === undefined && options.input !== undefined && options.input.startsWith('@')) {
    file = options.input.slice(1); // Remove @ prefix
  }

  return { provider, prompt, file, model, systemPrompt };
}

// ============================================================================
// Context Loading
// ============================================================================

/**
 * Loads project context and returns as system prompt section
 */
async function loadProjectContextAsPrompt(
  verbose: boolean
): Promise<string | undefined> {
  const cwd = process.cwd();

  // Check if context exists
  const hasContext = await hasProjectContext(cwd);
  if (!hasContext) {
    if (verbose) {
      console.log(`${COLORS.dim}No project context found at .automatosx/context/${COLORS.reset}`);
    }
    return undefined;
  }

  // Load context
  const loader = new ContextLoader();
  const result = await loader.load(cwd);

  if (!result.success || result.filesLoaded === 0) {
    if (verbose) {
      console.log(`${COLORS.dim}No context files loaded${COLORS.reset}`);
    }
    return undefined;
  }

  if (verbose) {
    console.log(`${COLORS.cyan}Loading project context from .automatosx/context/...${COLORS.reset}`);
    for (const file of result.context?.files ?? []) {
      const sizeKb = (file.size / 1024).toFixed(1);
      console.log(`  ${COLORS.green}✓${COLORS.reset} Loaded ${file.filename} (${sizeKb} KB)`);
    }
    if (result.filesSkipped !== undefined && result.filesSkipped > 0) {
      console.log(`  ${COLORS.yellow}⚠${COLORS.reset} Skipped ${result.filesSkipped} files (size limits)`);
    }
    console.log('');
  }

  return result.context?.combinedContent;
}

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classifies the LLM response to determine iterate intent
 *
 * This is a simple heuristic-based classifier. In production,
 * you would use structured output from the LLM.
 */
function classifyIntent(content: string): IterateIntent {
  const lowerContent = content.toLowerCase();

  // Check for completion indicators
  if (
    lowerContent.includes('task complete') ||
    lowerContent.includes('implementation complete') ||
    lowerContent.includes('finished implementing') ||
    lowerContent.includes('successfully completed') ||
    lowerContent.includes('done implementing')
  ) {
    return 'complete';
  }

  // Check for question indicators
  if (
    lowerContent.includes('which approach') ||
    lowerContent.includes('what would you prefer') ||
    lowerContent.includes('should i use') ||
    lowerContent.includes('do you want me to') ||
    lowerContent.includes('please clarify') ||
    lowerContent.includes('need more information') ||
    lowerContent.includes('which option')
  ) {
    return 'question';
  }

  // Check for blocked indicators
  if (
    lowerContent.includes('access denied') ||
    lowerContent.includes('permission denied') ||
    lowerContent.includes('api key') ||
    lowerContent.includes('authentication required') ||
    lowerContent.includes('cannot access')
  ) {
    return 'blocked';
  }

  // Check for error indicators
  if (
    lowerContent.includes('error:') ||
    lowerContent.includes('failed to') ||
    lowerContent.includes('exception:') ||
    lowerContent.includes('cannot find')
  ) {
    return 'error';
  }

  // Default: continue
  return 'continue';
}

// ============================================================================
// Help
// ============================================================================

/**
 * Shows call command help
 */
function showCallHelp(): CommandResult {
  const availableProviders = Object.keys(PROVIDERS).join(', ');

  const helpText = `
Call Command - Direct provider invocation

Usage:
  ax call <provider> <prompt>
  ax call --iterate <provider> <prompt>
  ax call --provider <provider> --file <file>

Arguments:
  <provider>    AI provider to use (${availableProviders})
  <prompt>      The prompt to send to the provider

Options:
  --provider        Provider to use
  --prompt          Prompt text (alternative to positional)
  --file            Read prompt from file (or prefix with @)
  --model           Specific model to use (defaults to provider default)
  --system          System prompt to prepend
  --format          Output format: text (default) or json

Iterate Mode Options:
  --iterate         Enable iterate mode for autonomous multi-step execution
  --max-iterations  Maximum iterations (default: ${DEFAULT_MAX_ITERATIONS})
  --max-time        Maximum time: 30s, 5m, 1h (default: 5m)
  --no-context      Skip loading project context

Examples:
  ax call gemini "What is 2+2?"
  ax call claude --iterate "implement user authentication"
  ax call gemini --iterate --max-iterations 50 "refactor the API"
  ax call --provider claude --prompt "Explain quantum computing"
  ax call codex --no-context "Write a hello world in Python"
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

// ============================================================================
// Single Call (Non-Iterate)
// ============================================================================

/**
 * Executes a single provider call
 */
async function executeSingleCall(
  providerConfig: CLIProviderConfig,
  promptContent: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  options: CLIOptions
): Promise<CommandResult> {
  const adapter = createProvider(providerConfig);

  // Check provider availability
  const available = await adapter.isAvailable();
  if (!available) {
    return {
      success: false,
      message: `Error: Provider CLI "${providerConfig.command}" is not available.\nRun "ax doctor ${providerConfig.providerId}" to diagnose.`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Build request
  const request: CompletionRequest = {
    requestId: crypto.randomUUID(),
    messages: [{ role: 'user', content: promptContent }],
    model: model ?? providerConfig.models.find(m => m.isDefault)?.modelId ?? providerConfig.models[0]?.modelId ?? 'default',
    systemPrompt,
  };

  // Execute completion
  const response = await adapter.complete(request);

  if (!response.success) {
    const errorMsg = response.error?.message ?? 'Unknown error';
    return {
      success: false,
      message: `Error from ${providerConfig.providerId}: ${errorMsg}`,
      data: options.format === 'json' ? response : undefined,
      exitCode: 1,
    };
  }

  if (options.format === 'json') {
    return {
      success: true,
      message: undefined,
      data: {
        provider: providerConfig.providerId,
        model: response.model,
        content: response.content,
        usage: response.usage,
        latencyMs: response.latencyMs,
      },
      exitCode: 0,
    };
  }

  return {
    success: true,
    message: response.content,
    data: undefined,
    exitCode: 0,
  };
}

// ============================================================================
// Iterate Mode
// ============================================================================

/**
 * Formats iteration status line
 */
function formatIterationStatus(
  state: IterateState,
  message: string
): string {
  const iterNum = state.iteration.toString().padStart(2, ' ');
  const maxIter = state.budget.maxIterations.toString();
  return `${COLORS.cyan}[${iterNum}/${maxIter}]${COLORS.reset} ${message}`;
}

/**
 * Executes iterate mode
 */
async function executeIterateMode(
  providerConfig: CLIProviderConfig,
  initialPrompt: string,
  systemPrompt: string | undefined,
  model: string | undefined,
  options: CLIOptions
): Promise<CommandResult> {
  const adapter = createProvider(providerConfig);

  // Check provider availability
  const available = await adapter.isAvailable();
  if (!available) {
    return {
      success: false,
      message: `Error: Provider CLI "${providerConfig.command}" is not available.\nRun "ax doctor ${providerConfig.providerId}" to diagnose.`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Parse budget from options
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxTimeMs = options.maxTime !== undefined
    ? parseTime(options.maxTime)
    : DEFAULT_MAX_TIME_MS;

  // Create controller
  const controller = new IterateController();

  // Start iterate session
  let state = controller.start({
    task: initialPrompt,
    budget: {
      maxIterations,
      maxTimeMs,
    },
  });

  console.log('');
  console.log(`${COLORS.bold}Starting iterate mode${COLORS.reset} (max ${maxIterations} iterations, ${formatDuration(maxTimeMs)} timeout)`);
  console.log('');

  // Conversation history for multi-turn
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: initialPrompt },
  ];

  // Main iterate loop
  while (state.status === 'running') {
    // Build request with conversation history
    const request: CompletionRequest = {
      requestId: crypto.randomUUID(),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model: model ?? providerConfig.models.find(m => m.isDefault)?.modelId ?? providerConfig.models[0]?.modelId ?? 'default',
      systemPrompt,
    };

    // Execute completion
    const response = await adapter.complete(request);

    if (!response.success) {
      const errorMsg = response.error?.message ?? 'Unknown error';
      console.log(formatIterationStatus(state, `${COLORS.red}Error: ${errorMsg}${COLORS.reset}`));

      // Handle as error intent
      const result = controller.handleResponse(state, 'error', errorMsg);
      state = result.newState;

      if (result.action.type === 'PAUSE') {
        console.log(`${COLORS.yellow}PAUSE: ${result.action.reason}${COLORS.reset}`);
        break; // Exit for now - in production, would prompt user
      }
      continue;
    }

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content });

    // Classify intent
    const intent = classifyIntent(response.content);

    // Handle response
    const result = controller.handleResponse(state, intent, response.content);
    state = result.newState;

    // Display based on action
    switch (result.action.type) {
      case 'CONTINUE': {
        // Show truncated response
        const preview = response.content.length > 100
          ? response.content.substring(0, 100) + '...'
          : response.content;
        console.log(formatIterationStatus(state, preview.replace(/\n/g, ' ')));

        // Add auto-response to continue
        if (result.autoResponse !== undefined && result.autoResponse !== '') {
          messages.push({ role: 'user', content: result.autoResponse });
        }
        break;
      }

      case 'PAUSE':
        console.log(formatIterationStatus(state, `${COLORS.yellow}PAUSE: ${result.action.reason}${COLORS.reset}`));
        console.log('');
        console.log(response.content);
        // In production, would prompt for user input here
        // For now, just stop
        state = { ...state, status: 'paused' };
        break;

      case 'STOP':
        console.log(formatIterationStatus(state, `${COLORS.green}COMPLETE: ${result.action.reason ?? 'Task finished'}${COLORS.reset}`));
        console.log('');
        console.log(response.content);
        break;
    }
  }

  // Summary
  console.log('');
  console.log(`${COLORS.bold}Summary${COLORS.reset}`);
  console.log(`  Status: ${state.status}`);
  console.log(`  Iterations: ${state.iteration}`);
  console.log(`  Errors: ${state.consecutiveErrors}`);
  console.log('');

  if (options.format === 'json') {
    return {
      success: state.status === 'completed',
      message: undefined,
      data: {
        status: state.status,
        iterations: state.iteration,
        history: state.history,
      },
      exitCode: state.status === 'completed' ? 0 : 1,
    };
  }

  return {
    success: state.status === 'completed',
    message: state.status === 'completed'
      ? 'Iterate mode completed successfully.'
      : `Iterate mode ended with status: ${state.status}`,
    data: undefined,
    exitCode: state.status === 'completed' ? 0 : 1,
  };
}

/**
 * Formats milliseconds as human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < MS_PER_MINUTE) {
    return `${Math.round(ms / MS_PER_SECOND)}s`;
  }
  if (ms < MS_PER_HOUR) {
    return `${Math.round(ms / MS_PER_MINUTE)}m`;
  }
  return `${Math.round(ms / MS_PER_HOUR)}h`;
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * Call command handler
 */
export async function callCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Show help if requested
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return showCallHelp();
  }

  const { provider, prompt, file, model, systemPrompt } = parseCallArgs(args, options);

  // Validate provider
  if (provider === undefined) {
    return {
      success: false,
      message: 'Error: Provider is required.\n\nRun "ax call help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  const providerConfig = PROVIDERS[provider];
  if (providerConfig === undefined) {
    const available = Object.keys(PROVIDERS).join(', ');
    return {
      success: false,
      message: `Error: Unknown provider "${provider}".\nAvailable providers: ${available}`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Get prompt content
  let promptContent: string;

  if (file !== undefined) {
    try {
      promptContent = await readFile(file, 'utf-8');
      // If there's also a prompt, prepend it as instruction
      if (prompt !== undefined) {
        promptContent = `${prompt}\n\n---\n\n${promptContent}`;
      }
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        success: false,
        message: `Error reading file "${file}": ${message}`,
        data: undefined,
        exitCode: 1,
      };
    }
  } else if (prompt !== undefined) {
    promptContent = prompt;
  } else {
    return {
      success: false,
      message: 'Error: Either --prompt or --file is required.\n\nRun "ax call help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  // Load project context (unless disabled)
  let finalSystemPrompt = systemPrompt;

  if (!options.noContext) {
    const contextPrompt = await loadProjectContextAsPrompt(options.verbose);
    if (contextPrompt !== undefined) {
      finalSystemPrompt = finalSystemPrompt !== undefined
        ? `${finalSystemPrompt}\n\n${contextPrompt}`
        : contextPrompt;
    }
  }

  if (options.verbose) {
    console.log(`Calling ${provider}...`);
    if (model !== undefined) {
      console.log(`Model: ${model}`);
    }
    if (options.iterate) {
      console.log(`Mode: iterate`);
    }
  }

  // Execute based on mode
  if (options.iterate) {
    return executeIterateMode(
      providerConfig,
      promptContent,
      finalSystemPrompt,
      model,
      options
    );
  }

  return executeSingleCall(
    providerConfig,
    promptContent,
    finalSystemPrompt,
    model,
    options
  );
}
