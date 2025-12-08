/**
 * Uninstall Command
 *
 * Removes AutomatosX MCP configurations from AI provider CLIs.
 * Since we're moving from MCP to SDK mode, this cleans up legacy configs.
 *
 * Removes:
 * - Claude Code MCP server
 * - Gemini CLI MCP server
 * - Codex CLI MCP server
 * - Optionally: .automatosx directory
 *
 * @module cli/commands/uninstall
 */

import type { CommandModule, Arguments } from 'yargs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, rm, access } from 'fs/promises';
import chalk from 'chalk';
import { logger } from '../../shared/logging/logger.js';

interface UninstallArgs {
  all?: boolean;
  'keep-data'?: boolean;
  force?: boolean;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeClaudeMCP(): Promise<'removed' | 'not_found' | 'failed'> {
  try {
    // Check if Claude Code is installed
    execSync('which claude', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
  } catch {
    // Claude not installed
    return 'not_found';
  }

  try {
    // Check if automatosx MCP is configured
    const listOutput = execSync('claude mcp list 2>/dev/null || true', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000,
    });

    if (!listOutput.includes('automatosx')) {
      return 'not_found';
    }

    // Remove automatosx MCP server
    execSync('claude mcp remove automatosx 2>/dev/null || true', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000,
    });

    logger.info('Removed Claude Code MCP configuration');
    return 'removed';
  } catch {
    return 'failed';
  }
}

async function removeGeminiMCP(): Promise<'removed' | 'not_found' | 'failed'> {
  const settingsPath = join(homedir(), '.gemini', 'settings.json');

  try {
    if (!(await fileExists(settingsPath))) {
      return 'not_found';
    }

    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;
    const mcpServers = (settings['mcpServers'] as Record<string, unknown>) || {};

    if (!mcpServers['automatosx']) {
      return 'not_found';
    }

    // Remove automatosx entry
    delete mcpServers['automatosx'];

    // Clean up mcpServers if empty
    if (Object.keys(mcpServers).length === 0) {
      delete settings['mcpServers'];
    } else {
      settings['mcpServers'] = mcpServers;
    }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.info('Removed Gemini CLI MCP configuration', { path: settingsPath });
    return 'removed';
  } catch {
    return 'failed';
  }
}

async function removeCodexMCP(): Promise<'removed' | 'not_found' | 'failed'> {
  const configPath = join(homedir(), '.codex', 'config.toml');

  try {
    if (!(await fileExists(configPath))) {
      return 'not_found';
    }

    const content = await readFile(configPath, 'utf-8');

    if (!content.includes('[mcp_servers.automatosx]')) {
      return 'not_found';
    }

    // Remove the [mcp_servers.automatosx] section and its contents
    // Match from [mcp_servers.automatosx] to next section or end of file
    // Also clean up extra blank lines
    const updatedContent = content
      .replace(/\[mcp_servers\.automatosx\][\s\S]*?(?=\n\[|$)/g, '')
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple blank lines
      .trim();

    await writeFile(configPath, updatedContent + '\n', 'utf-8');
    logger.info('Removed Codex CLI MCP configuration', { path: configPath });
    return 'removed';
  } catch {
    return 'failed';
  }
}

// v13.0.0: removeAxCliMCP REMOVED (ax-cli deprecated)
// Use ax-glm and ax-grok providers instead

async function removeProjectData(projectDir: string): Promise<'removed' | 'not_found' | 'failed'> {
  const automatosxDir = join(projectDir, '.automatosx');

  try {
    if (!(await fileExists(automatosxDir))) {
      return 'not_found';
    }

    await rm(automatosxDir, { recursive: true, force: true });
    logger.info('Removed .automatosx directory', { path: automatosxDir });
    return 'removed';
  } catch {
    return 'failed';
  }
}

async function removeProjectMCPConfigs(projectDir: string): Promise<number> {
  let removed = 0;

  // Remove project-level MCP config files
  const mcpFiles = [
    join(projectDir, '.gemini', 'mcp-servers.json'),
    join(projectDir, '.codex', 'mcp-servers.json'),
  ];

  for (const file of mcpFiles) {
    try {
      if (await fileExists(file)) {
        await rm(file, { force: true });
        logger.info('Removed project MCP config', { path: file });
        removed++;
      }
    } catch {
      // Ignore errors
    }
  }

  return removed;
}

export const uninstallCommand: CommandModule<object, UninstallArgs> = {
  command: 'uninstall',
  describe: 'Remove AutomatosX MCP configurations from AI provider CLIs',
  builder: (yargs) =>
    yargs
      .option('all', {
        alias: 'a',
        type: 'boolean',
        describe: 'Remove everything including .automatosx data',
        default: false,
      })
      .option('keep-data', {
        type: 'boolean',
        describe: 'Keep .automatosx directory (memory, sessions, etc.)',
        default: true,
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        describe: 'Skip confirmation prompts',
        default: false,
      })
      .example('$0 uninstall', 'Remove MCP configurations only')
      .example('$0 uninstall --all', 'Remove everything including project data')
      .example('$0 uninstall --no-keep-data', 'Remove MCP configs and .automatosx data'),
  handler: async (argv: Arguments<UninstallArgs>) => {
    const projectDir = process.cwd();

    console.log(chalk.cyan('\n🗑️  AutomatosX Uninstaller\n'));
    console.log(chalk.gray('Removing MCP configurations from AI provider CLIs...\n'));

    // Remove global MCP configurations
    console.log(chalk.yellow('Removing global MCP configurations:'));

    // Claude Code
    const claudeResult = await removeClaudeMCP();
    if (claudeResult === 'removed') {
      console.log(chalk.green('  ✓ Claude Code MCP removed'));
    } else if (claudeResult === 'not_found') {
      console.log(chalk.gray('  - Claude Code MCP not configured'));
    } else {
      console.log(chalk.yellow('  ⚠ Claude Code MCP removal failed'));
    }

    // Gemini CLI
    const geminiResult = await removeGeminiMCP();
    if (geminiResult === 'removed') {
      console.log(chalk.green('  ✓ Gemini CLI MCP removed (~/.gemini/settings.json)'));
    } else if (geminiResult === 'not_found') {
      console.log(chalk.gray('  - Gemini CLI MCP not configured'));
    } else {
      console.log(chalk.yellow('  ⚠ Gemini CLI MCP removal failed'));
    }

    // Codex CLI
    const codexResult = await removeCodexMCP();
    if (codexResult === 'removed') {
      console.log(chalk.green('  ✓ Codex CLI MCP removed (~/.codex/config.toml)'));
    } else if (codexResult === 'not_found') {
      console.log(chalk.gray('  - Codex CLI MCP not configured'));
    } else {
      console.log(chalk.yellow('  ⚠ Codex CLI MCP removal failed'));
    }

    // v13.0.0: ax-cli MCP removal REMOVED (deprecated)

    // Remove project-level MCP configs
    console.log(chalk.yellow('\nRemoving project-level MCP configurations:'));
    const projectMcpRemoved = await removeProjectMCPConfigs(projectDir);
    if (projectMcpRemoved > 0) {
      console.log(chalk.green(`  ✓ Removed ${projectMcpRemoved} project MCP config(s)`));
    } else {
      console.log(chalk.gray('  - No project MCP configs found'));
    }

    // Remove .automatosx directory if requested
    if (argv.all || !argv['keep-data']) {
      console.log(chalk.yellow('\nRemoving project data:'));
      const dataResult = await removeProjectData(projectDir);
      if (dataResult === 'removed') {
        console.log(chalk.green('  ✓ Removed .automatosx directory'));
      } else if (dataResult === 'not_found') {
        console.log(chalk.gray('  - .automatosx directory not found'));
      } else {
        console.log(chalk.yellow('  ⚠ Failed to remove .automatosx directory'));
      }
    }

    // Summary
    console.log(chalk.cyan('\n✨ Uninstall complete!\n'));

    const removedCount = [claudeResult, geminiResult, codexResult]
      .filter(r => r === 'removed').length;

    if (removedCount > 0) {
      console.log(chalk.green(`Removed ${removedCount} MCP configuration(s).`));
    }

    console.log(chalk.gray('\nTo reinstall AutomatosX:'));
    console.log(chalk.gray('  npm install -g @defai.digital/automatosx'));
    console.log(chalk.gray('  ax setup\n'));

    // Note about SDK mode
    console.log(chalk.blue('ℹ️  AutomatosX now uses SDK mode instead of MCP for providers.'));
    console.log(chalk.blue('   This provides better performance and simpler integration.\n'));
  },
};

export default uninstallCommand;
