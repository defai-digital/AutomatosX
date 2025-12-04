/**
 * Claude Code Setup Helper
 *
 * Utilities for setting up and verifying Claude Code integration.
 * Handles MCP server registration, manifest generation, and diagnostics.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import { logger } from '../../shared/logging/logger.js';
import { ManifestGenerator } from './manifest-generator.js';
import type { ProfileLoader } from '../../agents/profile-loader.js';

const execAsync = promisify(exec);

export interface ClaudeCodeSetupOptions {
  projectDir: string;
  profileLoader: ProfileLoader;
  skipManifests?: boolean;
  skipMcpRegistration?: boolean;
}

export interface ClaudeCodeDiagnostics {
  claudeCodeInstalled: boolean;
  claudeCodeVersion?: string;
  mcpServerAvailable: boolean;
  mcpServerRegistered: boolean;
  manifestsGenerated: boolean;
  manifestsValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ClaudeCodeSetupHelper {
  private projectDir: string;
  private profileLoader: ProfileLoader;

  constructor(options: ClaudeCodeSetupOptions) {
    this.projectDir = options.projectDir;
    this.profileLoader = options.profileLoader;
  }

  /**
   * Check if Claude Code CLI is installed
   */
  async isClaudeCodeInstalled(): Promise<boolean> {
    try {
      await execAsync('claude --version', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Claude Code version
   */
  async getClaudeCodeVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('claude --version', { timeout: 5000 });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Check if MCP server binary is available
   */
  async isMcpServerAvailable(): Promise<boolean> {
    try {
      await execAsync('which automatosx-mcp', { timeout: 5000 });
      return true;
    } catch {
      // Try checking in node_modules/.bin
      try {
        await access(join(this.projectDir, 'node_modules', '.bin', 'automatosx-mcp'), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if MCP server is registered with Claude Code
   */
  async isMcpServerRegistered(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('claude mcp list', { timeout: 10000 });
      return stdout.includes('automatosx');
    } catch {
      return false;
    }
  }

  /**
   * Register MCP server with Claude Code
   */
  async registerMcpServer(): Promise<void> {
    logger.info('[Claude Code Setup] Registering MCP server...');

    try {
      // Check if already registered
      const isRegistered = await this.isMcpServerRegistered();
      if (isRegistered) {
        logger.info('[Claude Code Setup] MCP server already registered');
        return;
      }

      // Register using stdio transport
      await execAsync(
        'claude mcp add --transport stdio automatosx -- automatosx-mcp',
        { cwd: this.projectDir, timeout: 30000 }
      );

      logger.info('[Claude Code Setup] MCP server registered successfully');
    } catch (error) {
      // FIX: Handle "already exists" as success (idempotency)
      // This can happen when server is in local config but not shown in global list
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('already exists')) {
        logger.info('[Claude Code Setup] MCP server already exists in local config');
        return;
      }
      logger.error('[Claude Code Setup] Failed to register MCP server', { error });
      throw new Error(`Failed to register MCP server: ${errorMsg}`);
    }
  }

  /**
   * Generate Claude Code integration manifests
   */
  async generateManifests(): Promise<void> {
    logger.info('[Claude Code Setup] Generating manifests...');

    try {
      const generator = new ManifestGenerator({
        profileLoader: this.profileLoader,
        projectDir: this.projectDir
      });

      await generator.generateAll();

      logger.info('[Claude Code Setup] Manifests generated successfully');
    } catch (error) {
      logger.error('[Claude Code Setup] Failed to generate manifests', { error });
      throw new Error(`Failed to generate manifests: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if manifests exist
   */
  async areManifestsGenerated(): Promise<boolean> {
    try {
      await access(join(this.projectDir, '.claude', 'skills', 'automatosx', 'SKILL.md'), constants.R_OK);
      await access(join(this.projectDir, '.claude', 'agents', 'automatosx-coordinator', 'AGENT.md'), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate manifest files
   */
  async validateManifests(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check skill file
      const skillPath = join(this.projectDir, '.claude', 'skills', 'automatosx', 'SKILL.md');
      const skillContent = await readFile(skillPath, 'utf-8');

      if (!skillContent.includes('name: automatosx-orchestration')) {
        errors.push('Skill file missing required frontmatter');
      }

      if (!skillContent.includes('Available Agents')) {
        errors.push('Skill file missing agent list');
      }

      // Check sub-agent file
      const subAgentPath = join(this.projectDir, '.claude', 'agents', 'automatosx-coordinator', 'AGENT.md');
      const subAgentContent = await readFile(subAgentPath, 'utf-8');

      if (!subAgentContent.includes('name: automatosx-coordinator')) {
        errors.push('Sub-agent file missing required frontmatter');
      }

      if (!subAgentContent.includes('mcp__automatosx__')) {
        errors.push('Sub-agent file missing MCP tool references');
      }

      // Check command files exist
      const commandsDir = join(this.projectDir, '.claude', 'commands');
      const agentNames = await this.profileLoader.listProfiles();

      for (const agentName of agentNames) {
        const commandPath = join(commandsDir, `agent-${agentName}.md`);
        try {
          await access(commandPath, constants.R_OK);
        } catch {
          errors.push(`Missing command file for agent: ${agentName}`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Failed to read manifest files: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors };
    }
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<ClaudeCodeDiagnostics> {
    logger.info('[Claude Code Setup] Running diagnostics...');

    const diagnostics: ClaudeCodeDiagnostics = {
      claudeCodeInstalled: false,
      mcpServerAvailable: false,
      mcpServerRegistered: false,
      manifestsGenerated: false,
      manifestsValid: false,
      errors: [],
      warnings: []
    };

    // Check Claude Code installation
    diagnostics.claudeCodeInstalled = await this.isClaudeCodeInstalled();
    if (!diagnostics.claudeCodeInstalled) {
      diagnostics.errors.push('Claude Code CLI not found. Install from: https://code.claude.com');
    } else {
      diagnostics.claudeCodeVersion = await this.getClaudeCodeVersion() || undefined;
    }

    // Check MCP server availability
    diagnostics.mcpServerAvailable = await this.isMcpServerAvailable();
    if (!diagnostics.mcpServerAvailable) {
      diagnostics.errors.push('MCP server binary (automatosx-mcp) not found. Run: npm install');
    }

    // Check MCP server registration
    if (diagnostics.claudeCodeInstalled && diagnostics.mcpServerAvailable) {
      diagnostics.mcpServerRegistered = await this.isMcpServerRegistered();
      if (!diagnostics.mcpServerRegistered) {
        diagnostics.warnings.push('MCP server not registered with Claude Code. Run: ax setup --claude-code');
      }
    }

    // Check manifests
    diagnostics.manifestsGenerated = await this.areManifestsGenerated();
    if (!diagnostics.manifestsGenerated) {
      diagnostics.warnings.push('Manifests not generated. Run: npm run generate:claude-manifests');
    } else {
      const validation = await this.validateManifests();
      diagnostics.manifestsValid = validation.valid;
      if (!validation.valid) {
        diagnostics.errors.push(...validation.errors);
      }
    }

    logger.info('[Claude Code Setup] Diagnostics complete', {
      errors: diagnostics.errors.length,
      warnings: diagnostics.warnings.length
    });

    return diagnostics;
  }

  /**
   * Perform complete setup
   */
  async setup(): Promise<void> {
    logger.info('[Claude Code Setup] Starting Claude Code integration setup...');

    // Step 1: Check prerequisites
    const claudeCodeInstalled = await this.isClaudeCodeInstalled();
    if (!claudeCodeInstalled) {
      throw new Error(
        'Claude Code CLI not found. Please install Claude Code from: https://code.claude.com'
      );
    }

    const mcpServerAvailable = await this.isMcpServerAvailable();
    if (!mcpServerAvailable) {
      throw new Error(
        'MCP server binary not found. Please run: npm install'
      );
    }

    // Step 2: Generate manifests
    await this.generateManifests();

    // Step 3: Register MCP server
    await this.registerMcpServer();

    // Step 4: Validate setup
    const diagnostics = await this.runDiagnostics();
    if (diagnostics.errors.length > 0) {
      throw new Error(`Setup validation failed:\n${diagnostics.errors.join('\n')}`);
    }

    logger.info('[Claude Code Setup] Claude Code integration setup complete!');
  }
}
