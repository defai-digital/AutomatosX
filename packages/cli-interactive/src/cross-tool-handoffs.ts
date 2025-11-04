/**
 * Cross-Tool Hand-offs
 *
 * Enable seamless transitions between AutomatosX CLI and other tools
 * like Claude Code, VS Code, browser, etc.
 *
 * Phase 5 P2: Cross-tool hand-offs
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type ToolType = 'claude-code' | 'vscode' | 'browser' | 'terminal' | 'git-ui' | 'editor';

export interface HandoffContext {
  type: ToolType;
  target: string; // File path, URL, command, etc.
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface HandoffResult {
  success: boolean;
  tool: ToolType;
  target: string;
  error?: string;
}

/**
 * Hand off to external tool
 */
export async function handoffToTool(context: HandoffContext): Promise<HandoffResult> {
  try {
    switch (context.type) {
      case 'claude-code':
        await openInClaudeCode(context.target);
        break;

      case 'vscode':
        await openInVSCode(context.target);
        break;

      case 'browser':
        await openInBrowser(context.target);
        break;

      case 'terminal':
        await openInTerminal(context.target);
        break;

      case 'git-ui':
        await openInGitUI(context.target);
        break;

      case 'editor':
        await openInEditor(context.target);
        break;

      default:
        throw new Error(`Unknown tool type: ${context.type}`);
    }

    return {
      success: true,
      tool: context.type,
      target: context.target
    };
  } catch (error) {
    return {
      success: false,
      tool: context.type,
      target: context.target,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Open file in Claude Code
 */
async function openInClaudeCode(target: string): Promise<void> {
  // Try to open with claude command
  try {
    await execAsync(`claude ${target}`);
  } catch (error) {
    // Fallback: Show instructions
    throw new Error('Claude Code not found. Install from: https://claude.com/code');
  }
}

/**
 * Open file in VS Code
 */
async function openInVSCode(target: string): Promise<void> {
  try {
    await execAsync(`code ${target}`);
  } catch (error) {
    throw new Error('VS Code not found. Install from: https://code.visualstudio.com/');
  }
}

/**
 * Open URL in browser
 */
async function openInBrowser(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  await execAsync(command);
}

/**
 * Open command in new terminal
 */
async function openInTerminal(command: string): Promise<void> {
  const platform = process.platform;

  let terminalCommand: string;
  if (platform === 'darwin') {
    terminalCommand = `osascript -e 'tell application "Terminal" to do script "${command}"'`;
  } else if (platform === 'win32') {
    terminalCommand = `start cmd /k "${command}"`;
  } else {
    // Linux - try common terminals
    terminalCommand = `gnome-terminal -- bash -c "${command}; exec bash"`;
  }

  await execAsync(terminalCommand);
}

/**
 * Open Git UI (GitHub Desktop, GitKraken, etc.)
 */
async function openInGitUI(repoPath: string): Promise<void> {
  const platform = process.platform;

  // Try GitHub Desktop first
  try {
    if (platform === 'darwin') {
      await execAsync(`open -a "GitHub Desktop" "${repoPath}"`);
    } else if (platform === 'win32') {
      await execAsync(`github "${repoPath}"`);
    } else {
      await execAsync(`github-desktop "${repoPath}"`);
    }
  } catch (error) {
    throw new Error('Git UI not found. Install GitHub Desktop: https://desktop.github.com/');
  }
}

/**
 * Open file in system editor
 */
async function openInEditor(filePath: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open -t "${filePath}"`;
  } else if (platform === 'win32') {
    command = `notepad "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }

  await execAsync(command);
}

/**
 * Render handoff prompt
 */
export function renderHandoffPrompt(context: HandoffContext): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('🔄 Hand-off to External Tool'));
  lines.push('');

  const icon = getToolIcon(context.type);
  const toolName = getToolName(context.type);

  lines.push(`${icon} ${chalk.bold.white(toolName)}`);
  lines.push(`   ${chalk.dim('Target:')} ${chalk.cyan(context.target)}`);
  lines.push(`   ${chalk.dim('Reason:')} ${chalk.white(context.reason)}`);
  lines.push('');

  lines.push(chalk.white('This will open the target in an external tool.'));
  lines.push(`  ${chalk.green('[Y]')} Yes, hand off`);
  lines.push(`  ${chalk.red('[N]')} No, stay in CLI`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render handoff result
 */
export function renderHandoffResult(result: HandoffResult): string {
  if (result.success) {
    const icon = getToolIcon(result.tool);
    const toolName = getToolName(result.tool);

    return chalk.green(`✓ Opened in ${toolName}: ${chalk.cyan(result.target)}`);
  } else {
    return chalk.red(`✗ Failed to open in ${getToolName(result.tool)}: ${result.error}`);
  }
}

/**
 * Suggest hand-off based on context
 */
export function suggestHandoff(context: {
  fileType?: string;
  operation?: string;
  complexity?: 'simple' | 'medium' | 'complex';
}): HandoffContext | null {
  const { fileType, operation, complexity } = context;

  // Suggest Claude Code for complex tasks
  if (complexity === 'complex') {
    return {
      type: 'claude-code',
      target: '.',
      reason: 'Complex task - Claude Code provides better visualization and interaction'
    };
  }

  // Suggest VS Code for code files
  if (fileType && ['.ts', '.js', '.tsx', '.jsx', '.py', '.go'].includes(fileType)) {
    return {
      type: 'vscode',
      target: `*.${fileType}`,
      reason: 'VS Code provides better editing experience for code files'
    };
  }

  // Suggest browser for documentation
  if (operation === 'documentation' || operation === 'research') {
    return {
      type: 'browser',
      target: 'https://docs.claude.com',
      reason: 'Documentation is best viewed in browser'
    };
  }

  // Suggest Git UI for complex git operations
  if (operation === 'git-merge' || operation === 'git-conflict') {
    return {
      type: 'git-ui',
      target: '.',
      reason: 'Git UI makes complex operations easier to visualize'
    };
  }

  return null;
}

/**
 * Render hand-off suggestion
 */
export function renderHandoffSuggestion(suggestion: HandoffContext): string {
  const icon = getToolIcon(suggestion.type);
  const toolName = getToolName(suggestion.type);

  return chalk.dim(`💡 Tip: Consider opening in ${toolName} for better experience: `) +
         chalk.cyan(`/open-in ${suggestion.type}`);
}

/**
 * Create quick handoff shortcuts
 */
export function createHandoffShortcuts(): Record<string, (target: string) => HandoffContext> {
  return {
    '/open-in-claude': (target: string) => ({
      type: 'claude-code',
      target,
      reason: 'Open in Claude Code'
    }),
    '/open-in-vscode': (target: string) => ({
      type: 'vscode',
      target,
      reason: 'Open in VS Code'
    }),
    '/open-in-browser': (target: string) => ({
      type: 'browser',
      target,
      reason: 'Open in browser'
    }),
    '/open-git-ui': (target: string) => ({
      type: 'git-ui',
      target,
      reason: 'Open in Git UI'
    })
  };
}

/**
 * Get tool icon
 */
function getToolIcon(tool: ToolType): string {
  const icons: Record<ToolType, string> = {
    'claude-code': '🤖',
    'vscode': '💻',
    'browser': '🌐',
    'terminal': '⌨️',
    'git-ui': '🔀',
    'editor': '📝'
  };
  return icons[tool];
}

/**
 * Get tool name
 */
function getToolName(tool: ToolType): string {
  const names: Record<ToolType, string> = {
    'claude-code': 'Claude Code',
    'vscode': 'VS Code',
    'browser': 'Browser',
    'terminal': 'Terminal',
    'git-ui': 'Git UI',
    'editor': 'Text Editor'
  };
  return names[tool];
}

/**
 * Detect available tools
 */
export async function detectAvailableTools(): Promise<Record<ToolType, boolean>> {
  const available: Record<ToolType, boolean> = {
    'claude-code': false,
    'vscode': false,
    'browser': true, // Assume browser always available
    'terminal': true, // Assume terminal always available
    'git-ui': false,
    'editor': true // Assume system editor always available
  };

  // Check Claude Code
  try {
    await execAsync('which claude');
    available['claude-code'] = true;
  } catch {
    // Not available
  }

  // Check VS Code
  try {
    await execAsync('which code');
    available['vscode'] = true;
  } catch {
    // Not available
  }

  // Check Git UI (GitHub Desktop)
  try {
    if (process.platform === 'darwin') {
      await execAsync('mdfind "kMDItemKind == \'Application\'" | grep -i "GitHub Desktop"');
      available['git-ui'] = true;
    }
  } catch {
    // Not available
  }

  return available;
}

/**
 * Render available tools
 */
export async function renderAvailableTools(): Promise<string> {
  const available = await detectAvailableTools();

  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Available External Tools'));
  lines.push('');

  Object.entries(available).forEach(([tool, isAvailable]) => {
    const icon = getToolIcon(tool as ToolType);
    const name = getToolName(tool as ToolType);
    const status = isAvailable ? chalk.green('✓ Available') : chalk.dim('✗ Not installed');

    lines.push(`  ${icon} ${chalk.white(name.padEnd(15))} ${status}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Export conversation for hand-off
 */
export function exportForHandoff(
  messages: Array<{ role: string; content: string }>,
  format: 'markdown' | 'json' = 'markdown'
): string {
  if (format === 'json') {
    return JSON.stringify(messages, null, 2);
  }

  // Markdown format
  const lines: string[] = [];

  lines.push('# Conversation Export');
  lines.push('');
  lines.push(`Exported at: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  messages.forEach(msg => {
    lines.push(`## ${msg.role.toUpperCase()}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  });

  return lines.join('\n');
}
