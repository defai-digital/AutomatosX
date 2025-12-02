/**
 * Environment Detection Utilities
 *
 * Detects the runtime environment to enable appropriate execution modes:
 * - Claude Code (AI IDE)
 * - Cursor (AI IDE)
 * - VS Code with Copilot
 * - Standalone CLI
 *
 * Used to automatically enable mock providers or direct integration
 * when running inside AI IDE environments where external CLI tools
 * may not be available.
 *
 * @module environment
 * @since v5.3.5
 */

import { logger } from './logger.js';

/**
 * Detect if running inside Claude Code environment
 *
 * Checks for Claude Code specific environment indicators:
 * - CLAUDE_CODE environment variable
 * - CLAUDE_DESKTOP environment variable
 * - MCP_SERVER (Model Context Protocol)
 * - Parent process name contains 'claude'
 *
 * @returns true if running inside Claude Code
 *
 * @example
 * ```typescript
 * if (isClaudeCodeEnvironment()) {
 *   console.log('Running inside Claude Code - using mock providers');
 * }
 * ```
 */
export function isClaudeCodeEnvironment(): boolean {
  // FIXED (v6.5.13 Bug #124): Capture lowercase value first to prevent TypeError
  // FIXED (v6.5.13 Bug #125): Removed ANTHROPIC_API_KEY check (false positive for CLI users)
  const parentProcess = (process.env._ || '').toLowerCase();
  const comSpec = (process.env.ComSpec || '').toLowerCase();

  return Boolean(
    // Explicit Claude Code indicators
    process.env.CLAUDE_CODE === 'true' ||
    process.env.CLAUDE_DESKTOP === 'true' ||
    process.env.MCP_SERVER === 'true' ||

    // Check parent process name (Unix/Windows)
    parentProcess.includes('claude') ||
    comSpec.includes('claude')
  );
}

/**
 * Detect if running inside Cursor IDE environment
 *
 * @returns true if running inside Cursor
 */
export function isCursorEnvironment(): boolean {
  // FIXED (v6.5.13 Bug #124): Capture lowercase value first to prevent TypeError
  const parentProcess = (process.env._ || '').toLowerCase();

  return Boolean(
    process.env.CURSOR === 'true' ||
    process.env.CURSOR_IDE === 'true' ||
    parentProcess.includes('cursor')
  );
}

/**
 * Detect if running inside VS Code with Copilot
 *
 * @returns true if running inside VS Code with Copilot
 */
export function isVSCodeCopilotEnvironment(): boolean {
  return Boolean(
    (process.env.VSCODE_PID !== undefined && process.env.GITHUB_COPILOT === 'true') ||
    process.env.COPILOT === 'true'
  );
}

/**
 * Detect if running inside any AI IDE environment
 *
 * Checks for Claude Code, Cursor, or VS Code with Copilot
 *
 * @returns true if running inside any known AI IDE
 *
 * @example
 * ```typescript
 * if (isAIIDEEnvironment()) {
 *   // Use integrated execution mode instead of spawning CLIs
 * }
 * ```
 */
export function isAIIDEEnvironment(): boolean {
  return (
    isClaudeCodeEnvironment() ||
    isCursorEnvironment() ||
    isVSCodeCopilotEnvironment()
  );
}

/**
 * Get the detected environment name for logging
 *
 * @returns Environment name or 'standalone'
 *
 * @example
 * ```typescript
 * console.log(`Running in ${getEnvironmentName()} mode`);
 * // Output: "Running in Claude Code mode"
 * ```
 */
export function getEnvironmentName(): string {
  if (isClaudeCodeEnvironment()) return 'Claude Code';
  if (isCursorEnvironment()) return 'Cursor';
  if (isVSCodeCopilotEnvironment()) return 'VS Code + Copilot';
  return 'Standalone CLI';
}

/**
 * Should automatically enable mock providers
 *
 * Decision logic:
 * 1. If AX_MOCK_PROVIDERS=true → always enable
 * 2. If AX_MOCK_PROVIDERS=false → never enable (explicit override)
 * 3. If running in AI IDE → auto-enable (unless explicitly disabled)
 * 4. Otherwise → disabled (standalone CLI mode)
 *
 * @returns true if mock providers should be enabled
 *
 * @example
 * ```typescript
 * if (shouldAutoEnableMockProviders()) {
 *   // Use mock providers instead of real CLI
 * }
 * ```
 */
export function shouldAutoEnableMockProviders(): boolean {
  const explicitValue = process.env.AX_MOCK_PROVIDERS;

  // Explicit true: always enable
  if (explicitValue === 'true' || explicitValue === '1') {
    return true;
  }

  // Explicit false: never enable (user wants real providers)
  if (explicitValue === 'false' || explicitValue === '0') {
    return false;
  }

  // Auto-enable in AI IDE environments (no explicit value)
  if (isAIIDEEnvironment()) {
    const envName = getEnvironmentName();
    logger.info(`Detected ${envName} environment - auto-enabling mock providers`, {
      environment: envName,
      reason: 'External CLI tools may not be available in integrated environments'
    });
    return true;
  }

  // Default: disabled (standalone CLI mode)
  return false;
}

/**
 * Get user-friendly suggestion for provider issues
 *
 * Returns different suggestions based on detected environment:
 * - AI IDE: Use mock providers or direct integration
 * - Standalone: Install provider CLIs
 *
 * @param providerName Name of the provider (claude, gemini, openai)
 * @returns User-friendly suggestion string
 *
 * @example
 * ```typescript
 * throw new Error(
 *   `Provider not found. ${getProviderSuggestion('claude')}`
 * );
 * ```
 */
export function getProviderSuggestion(providerName: string): string {
  if (isAIIDEEnvironment()) {
    const envName = getEnvironmentName();
    return (
      `Running inside ${envName}? External CLI not needed.\n` +
      `Try using mock providers:\n` +
      `  • Windows CMD: set AX_MOCK_PROVIDERS=true\n` +
      `  • PowerShell: $env:AX_MOCK_PROVIDERS="true"\n` +
      `  • Config: Add "execution": { "useMockProviders": true }\n` +
      `\n` +
      `Or use ${envName} directly without ax run command.`
    );
  }

  // Standalone CLI mode
  return (
    `Install ${providerName} CLI:\n` +
    `  • Claude: npm install -g @anthropic-ai/claude-cli\n` +
    `  • Gemini: npm install -g @google-ai/gemini-cli\n` +
    `  • OpenAI: npm install -g @openai/codex-cli\n` +
    `\n` +
    `Or use mock providers for testing:\n` +
    `  set AX_MOCK_PROVIDERS=true`
  );
}

/**
 * Log environment detection results (for debugging)
 *
 * @param verbose Whether to log detailed information
 *
 * @example
 * ```typescript
 * logEnvironmentInfo(true);
 * // Output: [AutomatosX] Environment: Claude Code
 * //         Mock Providers: Enabled (auto-detected)
 * ```
 */
export function logEnvironmentInfo(verbose = false): void {
  const env = getEnvironmentName();
  const mockEnabled = shouldAutoEnableMockProviders();

  logger.info('Environment Detection', {
    environment: env,
    mockProviders: mockEnabled ? 'enabled' : 'disabled',
    explicit: process.env.AX_MOCK_PROVIDERS !== undefined
  });

  if (verbose) {
    logger.debug('Environment Details', {
      claudeCode: isClaudeCodeEnvironment(),
      cursor: isCursorEnvironment(),
      vscode: isVSCodeCopilotEnvironment(),
      aiIDE: isAIIDEEnvironment(),
      mockEnvVar: process.env.AX_MOCK_PROVIDERS,
      parentProcess: process.env._ || process.env.ComSpec
    });
  }
}
