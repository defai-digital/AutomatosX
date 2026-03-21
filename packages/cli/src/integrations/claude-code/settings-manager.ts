/**
 * Claude Code Settings Manager
 *
 * Manages .claude/settings.json — the project-shared settings file.
 * Uses a safe merge strategy: adds missing entries, never removes existing ones.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ClaudeCodeSettings } from './types.js';
import { fileExists, readJsonFile, writeJsonFile } from './utils/file-utils.js';

/** MCP tool permissions AutomatosX needs */
const AUTOMATOSX_MCP_PERMISSIONS: string[] = [
  'mcp__automatosx__run_agent',
  'mcp__automatosx__list_agents',
  'mcp__automatosx__search_memory',
  'mcp__automatosx__save_memory',
  'mcp__automatosx__session_create',
  'mcp__automatosx__session_list',
  'mcp__automatosx__session_status',
  'mcp__automatosx__session_close',
  'mcp__automatosx__get_context',
  'mcp__automatosx__update_context',
  'mcp__automatosx__list_workflows',
  'mcp__automatosx__run_workflow',
  'mcp__automatosx__get_trace',
  'mcp__automatosx__list_traces',
  'mcp__automatosx__get_provider_status',
  'mcp__automatosx__health_check',
];

export class SettingsManager {
  private claudeDir: string;
  private settingsPath: string;

  constructor(projectDir: string) {
    this.claudeDir = join(projectDir, '.claude');
    this.settingsPath = join(this.claudeDir, 'settings.json');
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  async read(): Promise<ClaudeCodeSettings> {
    if (!(await fileExists(this.settingsPath))) {
      return {};
    }
    try {
      return await readJsonFile<ClaudeCodeSettings>(this.settingsPath);
    } catch {
      return {};
    }
  }

  /**
   * Merge MCP permissions into settings.json.
   * Never removes existing entries — only adds missing ones.
   */
  async writeMcpPermissions(): Promise<void> {
    await mkdir(this.claudeDir, { recursive: true });
    const settings = await this.read();

    if (!settings.permissions) settings.permissions = {};
    if (!settings.permissions.allow) settings.permissions.allow = [];

    const existing = new Set(settings.permissions.allow);
    for (const perm of AUTOMATOSX_MCP_PERMISSIONS) {
      existing.add(perm);
    }
    settings.permissions.allow = Array.from(existing);

    await writeJsonFile(this.settingsPath, settings);
  }

  /** Returns true if all 16 AutomatosX permissions are present */
  async hasAutomatosXPermissions(): Promise<boolean> {
    const settings = await this.read();
    const allowed = new Set(settings.permissions?.allow ?? []);
    return AUTOMATOSX_MCP_PERMISSIONS.every(p => allowed.has(p));
  }
}
