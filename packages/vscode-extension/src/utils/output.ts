/**
 * Output Utilities
 *
 * Manages the AutomatosX output channel with markdown support.
 *
 * @module @ax/vscode-extension/utils/output
 */

import * as vscode from 'vscode';

// =============================================================================
// Output Channel Manager
// =============================================================================

let outputChannel: vscode.OutputChannel | null = null;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('AutomatosX', 'markdown');
  }
  return outputChannel;
}

export function disposeOutputChannel(): void {
  outputChannel?.dispose();
  outputChannel = null;
}

// =============================================================================
// Output Helpers
// =============================================================================

export function show(): void {
  getOutputChannel().show(true);
}

export function clear(): void {
  getOutputChannel().clear();
}

export function appendLine(text: string): void {
  getOutputChannel().appendLine(text);
}

export function append(text: string): void {
  getOutputChannel().append(text);
}

// =============================================================================
// Formatted Output
// =============================================================================

export function header(title: string): void {
  const channel = getOutputChannel();
  channel.appendLine('');
  channel.appendLine(`## ${title}`);
  channel.appendLine('');
}

export function subheader(title: string): void {
  const channel = getOutputChannel();
  channel.appendLine('');
  channel.appendLine(`### ${title}`);
  channel.appendLine('');
}

export function info(message: string): void {
  getOutputChannel().appendLine(`> ${message}`);
}

export function success(message: string): void {
  getOutputChannel().appendLine(`✓ ${message}`);
}

export function error(message: string): void {
  getOutputChannel().appendLine(`✗ **Error:** ${message}`);
}

export function warning(message: string): void {
  getOutputChannel().appendLine(`⚠ **Warning:** ${message}`);
}

export function divider(): void {
  getOutputChannel().appendLine('---');
}

export function codeBlock(code: string, language = ''): void {
  const channel = getOutputChannel();
  channel.appendLine(`\`\`\`${language}`);
  channel.appendLine(code);
  channel.appendLine('```');
}

export function keyValue(key: string, value: string | number | boolean): void {
  getOutputChannel().appendLine(`**${key}:** ${value}`);
}

export function list(items: string[]): void {
  const channel = getOutputChannel();
  for (const item of items) {
    channel.appendLine(`- ${item}`);
  }
}

export function taskStart(agent: string, task: string): void {
  const channel = getOutputChannel();
  channel.appendLine('');
  channel.appendLine(`## Running Task`);
  channel.appendLine('');
  channel.appendLine(`**Agent:** ${agent}`);
  channel.appendLine(`**Task:** ${task}`);
  channel.appendLine('');
  channel.appendLine('---');
  channel.appendLine('');
}

export function taskComplete(duration: number, provider?: string): void {
  const channel = getOutputChannel();
  channel.appendLine('');
  channel.appendLine('---');
  channel.appendLine('');
  channel.appendLine(`✓ **Completed** in ${formatDuration(duration)}`);
  if (provider) {
    channel.appendLine(`**Provider:** ${provider}`);
  }
}

export function taskError(errorMessage: string): void {
  const channel = getOutputChannel();
  channel.appendLine('');
  channel.appendLine('---');
  channel.appendLine('');
  channel.appendLine(`✗ **Failed:** ${errorMessage}`);
}

// =============================================================================
// Formatting Utilities
// =============================================================================

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
