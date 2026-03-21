/**
 * Claude Code Integration Orchestrator
 *
 * Coordinates all Claude Code 2026 integration steps:
 *   1. settings.json  — MCP permissions
 *   2. hooks          — PreToolUse / PostToolUse / SessionStart / SessionEnd
 *   3. .mcp.json      — Team-shared committable MCP config
 *   4. Subagent files — Per-agent .claude/agents/<name>.md
 *
 * Designed to be called from `ax init` (per-project setup).
 */

import type { ClaudeCodeDiagnostics } from './types.js';
import { SettingsManager } from './settings-manager.js';
import { McpProjectConfigGenerator } from './mcp-project-config.js';
import { HooksGenerator } from './hooks-generator.js';
import { SubagentGenerator } from './subagent-generator.js';

export interface ClaudeCodeSetupOptions {
  projectDir: string;
  /** Agent list to generate subagent files for. Pass [] to skip subagents. */
  agents?: Array<{
    name: string;
    displayName?: string;
    description?: string;
    role?: string;
    systemPrompt?: string;
    claude_code?: Record<string, unknown>;
  }>;
  force?: boolean;
}

export interface ClaudeCodeSetupResult {
  settingsConfigured: boolean;
  hooksGenerated: string[];
  hooksSkipped: string[];
  mcpJsonGenerated: boolean;
  subagentsWritten: string[];
  subagentsSkipped: string[];
}

export class ClaudeCodeIntegration {
  private projectDir: string;
  private force: boolean;

  constructor(projectDir: string, force = false) {
    this.projectDir = projectDir;
    this.force = force;
  }

  /**
   * Run all Claude Code setup steps.
   */
  async setup(options: ClaudeCodeSetupOptions): Promise<ClaudeCodeSetupResult> {
    const agents = options.agents ?? [];

    // Run independent steps in parallel where possible
    const [settingsResult, hooksResult, mcpResult] = await Promise.all([
      this.configureSettings(),
      this.generateHooks(),
      this.generateMcpJson(),
    ]);

    // Subagents depend on agents list — run after
    const subagentResult = agents.length > 0
      ? await this.generateSubagents(agents)
      : { filesWritten: [], filesSkipped: [] };

    return {
      settingsConfigured: settingsResult,
      hooksGenerated: hooksResult.scriptsWritten,
      hooksSkipped: hooksResult.scriptsSkipped,
      mcpJsonGenerated: mcpResult,
      subagentsWritten: subagentResult.filesWritten,
      subagentsSkipped: subagentResult.filesSkipped,
    };
  }

  /**
   * Run diagnostics — check current state of all integration artifacts.
   */
  async diagnose(): Promise<ClaudeCodeDiagnostics> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const [settingsConfigured, mcpProjectConfigGenerated, hooksGenerated, subagentFilesGenerated] =
      await Promise.all([
        new SettingsManager(this.projectDir).hasAutomatosXPermissions(),
        new McpProjectConfigGenerator(this.projectDir).isGenerated(),
        new HooksGenerator({ projectDir: this.projectDir }).areHooksGenerated(),
        new SubagentGenerator({ projectDir: this.projectDir }).areSubagentFilesGenerated(),
      ]);

    if (!settingsConfigured) {
      warnings.push('.claude/settings.json: AutomatosX MCP permissions not configured. Run: ax init');
    }
    if (!mcpProjectConfigGenerated) {
      warnings.push('.mcp.json: not generated. Run: ax init');
    }
    if (!hooksGenerated) {
      warnings.push('.claude/hooks/: hook scripts not generated. Run: ax init');
    }
    if (!subagentFilesGenerated) {
      warnings.push('.claude/agents/: subagent files not generated. Run: ax init');
    }

    return {
      settingsConfigured,
      mcpProjectConfigGenerated,
      hooksGenerated,
      subagentFilesGenerated,
      errors,
      warnings,
    };
  }

  // ─── Private step runners ────────────────────────────────────────────────────

  private async configureSettings(): Promise<boolean> {
    try {
      await new SettingsManager(this.projectDir).writeMcpPermissions();
      return true;
    } catch {
      return false;
    }
  }

  private async generateHooks(): Promise<{ scriptsWritten: string[]; scriptsSkipped: string[] }> {
    try {
      const gen = new HooksGenerator({ projectDir: this.projectDir, force: this.force });
      const result = await gen.generate();
      return { scriptsWritten: result.scriptsWritten, scriptsSkipped: result.scriptsSkipped };
    } catch {
      return { scriptsWritten: [], scriptsSkipped: [] };
    }
  }

  private async generateMcpJson(): Promise<boolean> {
    try {
      await new McpProjectConfigGenerator(this.projectDir).generate();
      return true;
    } catch {
      return false;
    }
  }

  private async generateSubagents(
    agents: ClaudeCodeSetupOptions['agents'] & object[]
  ): Promise<{ filesWritten: string[]; filesSkipped: string[] }> {
    try {
      const gen = new SubagentGenerator({ projectDir: this.projectDir, force: this.force });
      const result = await gen.generate(agents);
      return { filesWritten: result.filesWritten, filesSkipped: result.filesSkipped };
    } catch {
      return { filesWritten: [], filesSkipped: [] };
    }
  }
}
