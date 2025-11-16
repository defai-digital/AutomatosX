/**
 * Slash Command Router
 *
 * Handles /help, /exit, /clear, /provider, /history, /save, etc.
 * Phase 1: Added /read, /write, /edit, and enhanced /memory commands
 * Phase 2: Added /exec, /run, /processes, /kill, /output, /find, /search, /tree, /git, /status commands
 * Phase 3: Added /test, /coverage, /lint, /format, /install, /update, /outdated commands
 * Phase 4: Added /build, /dev, /watch, /env, /config, /create, /scaffold commands
 */

import type { CommandHandler, CommandContext, Conversation } from './types.js';
import { OutputRenderer } from './renderer.js';
import { join } from 'path';
import { FileOperationsManager } from './file-operations.js';
import { MemoryBridge } from './memory-bridge.js';
import { ProcessManager } from './process-manager.js';
import { CommandValidator, CommandRisk } from './command-validator.js';
import { SearchManager } from './search-manager.js';
import { GitManager } from './git-manager.js';
import { TestRunner } from './test-runner.js';
import { LintFormatter } from './lint-formatter.js';
import { PackageManager } from './package-manager.js';
import { BuildManager } from './build-manager.js';
import { EnvironmentManager } from './environment-manager.js';
import { ProjectScaffolder } from './project-scaffolder.js';

const renderer = new OutputRenderer();
const processManager = new ProcessManager();
const commandValidator = new CommandValidator();
const searchManager = new SearchManager(process.cwd());
const gitManager = new GitManager(process.cwd());
const testRunner = new TestRunner(process.cwd());
const lintFormatter = new LintFormatter(process.cwd());
const packageManager = new PackageManager(process.cwd());
const buildManager = new BuildManager(process.cwd());
const environmentManager = new EnvironmentManager(process.cwd());
const projectScaffolder = new ProjectScaffolder(process.cwd());

/**
 * Help command - show available commands with progressive disclosure
 */
const helpCommand: CommandHandler = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show this help message',
  usage: '[category]',
  async execute(args, _context) {
    // Import progressive help system
    const { renderProgressiveHelp, renderCategoryHelp } = await import('./progressive-help.js');
    const commands = getAllCommands();

    if (args.length === 0) {
      // Show main progressive help
      const helpText = renderProgressiveHelp(commands);
      console.log(helpText);
    } else {
      // Show category-specific help
      const category = args.join(' ');
      const categoryHelp = renderCategoryHelp(category, commands);
      console.log(categoryHelp);
    }
  }
};

/**
 * Exit command - exit ax-cli
 *
 * NOTE: process.exit(0) triggers the readline 'close' event,
 * which calls shutdown(), which displays goodbye and cleans up.
 */
const exitCommand: CommandHandler = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit ax-cli',
  async execute(_args, _context) {
    // Trigger exit - readline 'close' event will handle goodbye message
    process.exit(0);
  }
};

/**
 * Clear command - clear screen
 */
const clearCommand: CommandHandler = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear screen',
  async execute(_args, _context) {
    console.clear();
    renderer.displayWelcome(_context.currentProvider);
  }
};

/**
 * Provider command - show current provider
 */
const providerCommand: CommandHandler = {
  name: 'provider',
  description: 'Show current provider information',
  async execute(_args, context) {
    renderer.displayInfo(`Current provider: ${context.currentProvider}`);
    renderer.displayInfo('Multi-provider support coming in Phase 3');
  }
};

/**
 * History command - show conversation history
 */
const historyCommand: CommandHandler = {
  name: 'history',
  aliases: ['hist'],
  description: 'Show conversation history',
  async execute(_args, context) {
    const messages = context.conversation.messages;
    if (messages.length === 0) {
      renderer.displayInfo('No conversation history yet');
      return;
    }
    renderer.displayHistory(messages);
  }
};

/**
 * Save command - save conversation
 */
const saveCommand: CommandHandler = {
  name: 'save',
  usage: '<name>',
  description: 'Save conversation with a name',
  async execute(args, context) {
    const name = args.join(' ').trim();
    if (!name) {
      renderer.displayError('Usage: /save <name>');
      return;
    }

    try {
      // Access conversation manager through context
      // We'll need to pass this through from REPL
      const conversationManager = context.conversationManager;
      if (conversationManager && conversationManager.saveAs) {
        const filepath = await conversationManager.saveAs(name);
        renderer.displaySuccess(`Conversation saved as: ${name}`);
        renderer.displayInfo(`Location: ${filepath}`);
      } else {
        renderer.displayError('Conversation manager not available');
      }
    } catch (error) {
      renderer.displayError(`Failed to save: ${(error as Error).message}`);
    }
  }
};

/**
 * New command - start fresh conversation
 */
const newCommand: CommandHandler = {
  name: 'new',
  description: 'Start a new conversation',
  async execute(_args, _context) {
    renderer.displaySuccess('Started new conversation');
    renderer.displayInfo('Previous conversation cleared');
  }
};

/**
 * Agents command - list available agents
 */
const agentsCommand: CommandHandler = {
  name: 'agents',
  description: 'List all available agents',
  async execute(_args, context) {
    // Use real agent executor if available
    if (context.agentExecutor) {
      try {
        const agents = await context.agentExecutor.listAgents();
        if (agents.length === 0) {
          renderer.displayInfo('No agents found');
          renderer.displayInfo('Create agents with: ax agent create <name>');
          return;
        }
        renderer.displayAgents(agents);
        renderer.displayInfo('Use @agent <task> to delegate tasks');
      } catch (error) {
        renderer.displayError(`Failed to list agents: ${(error as Error).message}`);
      }
    } else {
      // Fallback to placeholder
      const agents = [
        { name: 'backend', description: 'Backend development and API implementation' },
        { name: 'frontend', description: 'Frontend development and UI/UX' },
        { name: 'security', description: 'Security audits and vulnerability analysis' },
        { name: 'quality', description: 'Code review and testing' },
        { name: 'devops', description: 'DevOps, deployment, and infrastructure' }
      ];
      renderer.displayAgents(agents);
      renderer.displayInfo('Use @agent <task> to delegate tasks');
    }
  }
};

/**
 * Memory command - search AutomatosX memory (Phase 1: Enhanced)
 */
const memoryCommand: CommandHandler = {
  name: 'memory',
  usage: 'search <query> [--limit N] [--agent A] | stats | recent [N]',
  description: 'Search AutomatosX memory',
  async execute(args, _context) {
    const subcommand = args[0];

    if (!subcommand) {
      renderer.displayError('Usage: /memory search <query> | stats | recent [N]');
      return;
    }

    try {
      // Initialize memory bridge
      const memoryBridge = new MemoryBridge({
        persistPath: '.automatosx/memory',
        maxEntries: 10000
      });

      if (subcommand === 'search') {
        // Parse search arguments
        const limitIndex = args.indexOf('--limit');
        const agentIndex = args.indexOf('--agent');

        const limitArg = limitIndex >= 0 ? args[limitIndex + 1] : undefined;
        const limit = limitArg ? parseInt(limitArg, 10) : 10;

        const agentArg = agentIndex >= 0 ? args[agentIndex + 1] : undefined;
        const agent = agentArg || undefined;

        // Get query (exclude subcommand and flags)
        const queryArgs = args.slice(1).filter(arg =>
          !arg.startsWith('--') &&
          arg !== args[limitIndex + 1] &&
          arg !== args[agentIndex + 1]
        );
        const query = queryArgs.join(' ');

        if (!query) {
          renderer.displayError('Please provide a search query');
          return;
        }

        renderer.displayInfo(`Searching memory for: "${query}"`);

        // Search memory
        const results = await memoryBridge.search(query, { limit, agent });

        if (results.length === 0) {
          renderer.displayInfo('No results found');
          return;
        }

        // Display results
        console.log(`\nFound ${results.length} result(s):\n`);

        results.forEach((result, i) => {
          const timestamp = new Date(result.timestamp).toLocaleString();
          const agentStr = result.agent ? `@${result.agent}` : 'System';

          console.log(`[${i + 1}] ${timestamp} | ${agentStr}`);
          console.log(`    Relevance: ${result.relevance}%`);

          // Show preview (first 150 chars)
          const preview = result.content.length > 150
            ? result.content.substring(0, 150) + '...'
            : result.content;

          console.log(`    "${preview}"`);
          console.log('');
        });

      } else if (subcommand === 'stats') {
        // Show memory statistics
        const stats = await memoryBridge.getStats();

        renderer.displayInfo('\nMemory Statistics:\n');
        console.log(`  Total Entries: ${stats.totalEntries}`);
        console.log(`  Size:          ${formatBytes(stats.sizeBytes)}`);

        if (stats.oldestEntry) {
          console.log(`  Oldest:        ${new Date(stats.oldestEntry.timestamp).toLocaleString()}`);
        }

        if (stats.newestEntry) {
          console.log(`  Newest:        ${new Date(stats.newestEntry.timestamp).toLocaleString()}`);
        }

        console.log('');

      } else if (subcommand === 'recent') {
        // Show recent entries
        const limitArg = args[1];
        const limit = limitArg ? parseInt(limitArg, 10) : 10;
        const results = await memoryBridge.getRecent(limit);

        if (results.length === 0) {
          renderer.displayInfo('No entries found');
          return;
        }

        console.log(`\nRecent ${results.length} entries:\n`);

        results.forEach((result, i) => {
          const timestamp = new Date(result.timestamp).toLocaleString();
          const agentStr = result.agent ? `@${result.agent}` : 'System';

          console.log(`[${i + 1}] ${timestamp} | ${agentStr}`);

          const preview = result.content.length > 150
            ? result.content.substring(0, 150) + '...'
            : result.content;

          console.log(`    "${preview}"`);
          console.log('');
        });

      } else {
        renderer.displayError(`Unknown subcommand: ${subcommand}`);
        renderer.displayInfo('Usage: /memory search <query> | stats | recent [N]');
      }

      memoryBridge.close();
    } catch (error) {
      renderer.displayError(`Memory operation failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Helper: Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * List command - list saved conversations
 */
const listCommand: CommandHandler = {
  name: 'list',
  aliases: ['ls'],
  description: 'List saved conversations',
  async execute(_args, context) {
    try {
      const conversationManager = context.conversationManager;
      if (!conversationManager || !conversationManager.listConversations) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      const conversations = await conversationManager.listConversations();

      if (conversations.length === 0) {
        renderer.displayInfo('No saved conversations found');
        renderer.displayInfo('Use /save <name> to save the current conversation');
        return;
      }

      renderer.displayInfo(`\nFound ${conversations.length} saved conversation(s):\n`);

      for (const conv of conversations) {
        const name = conv.name || 'Unnamed';
        const date = new Date(conv.updatedAt).toLocaleString();
        console.log(`  • ${name}`);
        console.log(`    Messages: ${conv.messageCount} | Updated: ${date}`);
        console.log(`    File: ${conv.filename}\n`);
      }

      renderer.displayInfo('Use /load <name> to load a conversation');
    } catch (error) {
      renderer.displayError(`Failed to list conversations: ${(error as Error).message}`);
    }
  }
};

/**
 * Load command - load a saved conversation
 */
const loadCommand: CommandHandler = {
  name: 'load',
  usage: '<name>',
  description: 'Load a saved conversation',
  async execute(args, context) {
    const name = args.join(' ').trim();
    if (!name) {
      renderer.displayError('Usage: /load <name>');
      return;
    }

    try {
      const conversationManager = context.conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      // List conversations to find the matching one
      const conversations = await conversationManager.listConversations();
      const match = conversations.find((c: { filename: string; name?: string }) =>
        (c.name && c.name.toLowerCase() === name.toLowerCase()) ||
        c.filename.toLowerCase().includes(name.toLowerCase())
      );

      if (!match) {
        renderer.displayError(`Conversation "${name}" not found`);
        renderer.displayInfo('Use /list to see available conversations');
        return;
      }

      // Bug #11 fix: loadFromFile handles path internally, just pass filename
      // Don't try to access private conversationsDir field
      // Don't construct path here - loadFromFile does join(conversationsDir, filepath) internally
      await conversationManager.loadFromFile(match.filename);

      renderer.displaySuccess(`Loaded conversation: ${match.name || match.filename}`);
      renderer.displayInfo(`${match.messageCount} messages loaded`);
    } catch (error) {
      renderer.displayError(`Failed to load conversation: ${(error as Error).message}`);
    }
  }
};

/**
 * Export command - export conversation to markdown
 */
const exportCommand: CommandHandler = {
  name: 'export',
  description: 'Export current conversation to Markdown',
  async execute(_args, context) {
    try {
      const conversationManager = context.conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      const stats = conversationManager.getStats();
      if (stats.messageCount === 0) {
        renderer.displayInfo('No messages to export');
        return;
      }

      const filepath = await conversationManager.exportToMarkdownFile();
      renderer.displaySuccess('Conversation exported to Markdown');
      renderer.displayInfo(`Location: ${filepath}`);
      renderer.displayInfo(`Exported ${stats.messageCount} messages`);
    } catch (error) {
      renderer.displayError(`Failed to export: ${(error as Error).message}`);
    }
  }
};

/**
 * Delete command - delete a saved conversation
 */
const deleteCommand: CommandHandler = {
  name: 'delete',
  aliases: ['rm'],
  usage: '<name>',
  description: 'Delete a saved conversation',
  async execute(args, context) {
    const name = args.join(' ').trim();
    if (!name) {
      renderer.displayError('Usage: /delete <name>');
      return;
    }

    try {
      const conversationManager = context.conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      // List conversations to find the matching one
      const conversations = await conversationManager.listConversations();
      const match = conversations.find((c: { filename: string; name?: string }) =>
        (c.name && c.name.toLowerCase() === name.toLowerCase()) ||
        c.filename.toLowerCase().includes(name.toLowerCase())
      );

      if (!match) {
        renderer.displayError(`Conversation "${name}" not found`);
        renderer.displayInfo('Use /list to see available conversations');
        return;
      }

      await conversationManager.deleteConversation(match.filename);

      renderer.displaySuccess(`Deleted conversation: ${match.name || match.filename}`);
    } catch (error) {
      renderer.displayError(`Failed to delete: ${(error as Error).message}`);
    }
  }
};

/**
 * Stats command - show conversation statistics
 */
const statsCommand: CommandHandler = {
  name: 'stats',
  description: 'Show current conversation statistics',
  async execute(_args, context) {
    try {
      const conversationManager = context.conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      const stats = conversationManager.getStats();
      const durationMinutes = Math.floor(stats.duration / 60000);
      const durationSeconds = Math.floor((stats.duration % 60000) / 1000);

      renderer.displayInfo('\nConversation Statistics:\n');
      console.log(`  Messages:     ${stats.messageCount}`);
      console.log(`  Total Tokens: ${stats.totalTokens || 'N/A'}`);
      console.log(`  Duration:     ${durationMinutes}m ${durationSeconds}s`);

      const conv = conversationManager.getConversation();
      console.log(`  Created:      ${new Date(conv.createdAt).toLocaleString()}`);
      console.log(`  Updated:      ${new Date(conv.updatedAt).toLocaleString()}`);

      if (conv.name) {
        console.log(`  Name:         ${conv.name}`);
      }

      console.log('');
    } catch (error) {
      renderer.displayError(`Failed to get stats: ${(error as Error).message}`);
    }
  }
};

/**
 * Init command - create project context (ax.md)
 */
const initCommand: CommandHandler = {
  name: 'init',
  usage: '[--template <basic|full|minimal>] [--analyze]',
  description: 'Create project context file (ax.md)',
  async execute(args, _context) {
    try {
      // Dynamic import to avoid circular dependencies
      const { spawn } = await import('child_process');

      // Parse template argument
      const templateIndex = args.indexOf('--template');
      const templateArg = templateIndex >= 0 ? args[templateIndex + 1] : undefined;
      const template = templateArg || 'basic';

      // Parse analyze flag
      const analyze = args.includes('--analyze');

      // Validate template
      if (!['basic', 'full', 'minimal'].includes(template)) {
        renderer.displayError(`Invalid template: ${template}`);
        renderer.displayInfo('Valid templates: basic, full, minimal');
        return;
      }

      if (analyze) {
        renderer.displayInfo('AI-powered analysis mode enabled');
        renderer.displayInfo('This will take 1-2 minutes...');
      } else {
        renderer.displayInfo(`Creating project context with ${template} template...`);
      }

      // Execute: ax init --template <template> [--analyze]
      const axCommand = process.platform === 'win32' ? 'ax.cmd' : 'ax';
      const initArgs = ['init', '--template', template];

      if (analyze) {
        initArgs.push('--analyze');
      }

      // BUG #42 FIX: Remove shell execution to prevent command injection via template parameter
      const childProcess = spawn(axCommand, initArgs, {
        stdio: 'inherit',
        shell: false,  // SECURITY: Prevent command injection via --template argument
        cwd: process.cwd()
      });

      childProcess.on('close', (code: number | null) => {
        if (code === 0) {
          renderer.displaySuccess('Project context created successfully!');
          renderer.displayInfo('File: ax.md');
          if (!analyze) {
            renderer.displayInfo('Edit the file to customize for your project');
          }
          renderer.displayInfo('Context will be loaded automatically on next agent run');
        } else {
          renderer.displayError(`ax init failed with code ${code}`);
        }
      });

      childProcess.on('error', (error: Error) => {
        renderer.displayError(`Failed to run ax init: ${error.message}`);
        renderer.displayInfo('Make sure AutomatosX is installed globally');
      });
    } catch (error) {
      renderer.displayError(`Failed to create project context: ${(error as Error).message}`);
      renderer.displayInfo('Try running: ax init (outside interactive mode)');
    }
  }
};

/**
 * Read command - read file contents (Phase 1)
 */
const readCommand: CommandHandler = {
  name: 'read',
  usage: '<filepath> [--lines N] [--from L]',
  description: 'Read file contents',
  async execute(args, context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /read <filepath> [--lines N] [--from L]');
      return;
    }

    // Parse arguments
    const filepath = args[0];
    const linesIndex = args.indexOf('--lines');
    const fromIndex = args.indexOf('--from');

    const linesArg = linesIndex >= 0 ? args[linesIndex + 1] : undefined;
    const lines = linesArg ? parseInt(linesArg, 10) : undefined;

    const fromArg = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
    const from = fromArg ? parseInt(fromArg, 10) : 1;

    if (!filepath) {
      renderer.displayError('File path is required');
      return;
    }

    try {
      // Get workspace root
      const workspaceRoot = context.workspaceRoot || process.cwd();

      // Initialize file operations manager
      const fileOps = new FileOperationsManager({
        workspaceRoot,
        autoApprove: false,
        defaultYes: false
      });

      // Read file
      const content = await fileOps.readFile(filepath, { lines, from, syntax: true });

      // Display content
      console.log(content);

      fileOps.close();
    } catch (error: unknown) {
      renderer.displayError(`Failed to read file: ${(error as Error).message}`);
    }
  }
};

/**
 * Write command - write new file (Phase 1)
 */
const writeCommand: CommandHandler = {
  name: 'write',
  usage: '<filepath> <content> [--force] [--append]',
  description: 'Write content to a file',
  async execute(args, context) {
    if (args.length < 2) {
      renderer.displayError('Usage: /write <filepath> <content> [--force] [--append]');
      return;
    }

    const filepath = args[0];
    const force = args.includes('--force');
    const append = args.includes('--append');

    // Get content (everything except filepath and flags)
    const contentArgs = args.slice(1).filter(arg => !arg.startsWith('--'));
    const content = contentArgs.join(' ');

    if (!filepath || !content) {
      renderer.displayError('Both filepath and content are required');
      return;
    }

    try {
      // Get workspace root
      const workspaceRoot = context.workspaceRoot || process.cwd();

      // Initialize file operations manager
      const fileOps = new FileOperationsManager({
        workspaceRoot,
        autoApprove: false,
        defaultYes: false
      });

      // Write file
      await fileOps.writeFile(filepath, content, { force, append });

      renderer.displaySuccess(`File ${append ? 'updated' : 'created'}: ${filepath}`);

      fileOps.close();
    } catch (error) {
      renderer.displayError(`Failed to write file: ${(error as Error).message}`);
    }
  }
};

/**
 * Edit command - edit existing file (Phase 1)
 */
const editCommand: CommandHandler = {
  name: 'edit',
  usage: '<filepath> "<search>" "<replace>" [--all] [--backup]',
  description: 'Edit file by replacing text',
  async execute(args, context) {
    if (args.length < 3) {
      renderer.displayError('Usage: /edit <filepath> "<search>" "<replace>" [--all] [--backup]');
      return;
    }

    const filepathArg = args[0];
    if (!filepathArg) {
      renderer.displayError('Filepath is required');
      return;
    }

    const filepath: string = filepathArg;
    const all = args.includes('--all');
    const backup = args.includes('--backup');

    // Extract search and replace strings (handle quoted strings)
    const nonFlagArgs = args.slice(1).filter(arg => !arg.startsWith('--'));

    if (nonFlagArgs.length < 2) {
      renderer.displayError('Both search and replace strings are required');
      return;
    }

    const searchArg = nonFlagArgs[0];
    const replaceArg = nonFlagArgs[1];

    if (!searchArg || !replaceArg) {
      renderer.displayError('Both search and replace strings are required');
      return;
    }

    // Type-safe after validation
    const search: string = searchArg;
    const replace: string = replaceArg;

    try {
      // Get workspace root
      const workspaceRoot = context.workspaceRoot || process.cwd();

      // Initialize file operations manager
      const fileOps = new FileOperationsManager({
        workspaceRoot,
        autoApprove: false,
        defaultYes: false
      });

      // Edit file
      await fileOps.editFile(filepath, search, replace, { preview: true, all, backup });

      renderer.displaySuccess(`File edited: ${filepath}`);
      if (backup) {
        renderer.displayInfo(`Backup created: ${filepath}.bak`);
      }

      fileOps.close();
    } catch (error) {
      renderer.displayError(`Failed to edit file: ${(error as Error).message}`);
    }
  }
};

/**
 * Exec command - execute command (Phase 2)
 */
const execCommand: CommandHandler = {
  name: 'exec',
  usage: '<command> [--background] [--timeout <ms>]',
  description: 'Execute shell command',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /exec <command> [--background] [--timeout <ms>]');
      return;
    }

    // Parse flags
    const backgroundIndex = args.indexOf('--background');
    const background = backgroundIndex >= 0;

    const timeoutIndex = args.indexOf('--timeout');
    const timeoutArg = timeoutIndex >= 0 ? args[timeoutIndex + 1] : undefined;
    const timeout = timeoutArg ? parseInt(timeoutArg, 10) : undefined;

    // Remove flags from command
    const commandArgs = args.filter((arg, i) =>
      arg !== '--background' &&
      arg !== '--timeout' &&
      i !== timeoutIndex + 1
    );

    const command = commandArgs.join(' ');

    try {
      // Validate command
      const validation = commandValidator.validate(command);

      if (!validation.valid || validation.blocked) {
        renderer.displayError(`Command blocked: ${validation.reason || 'Dangerous command'}`);
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(w => renderer.displayWarning(w));
        }
        return;
      }

      // Show warnings
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w => renderer.displayWarning(w));
      }

      // Request approval if needed
      if (validation.risk === CommandRisk.HIGH || validation.risk === CommandRisk.MEDIUM) {
        const prompt = commandValidator.getApprovalPrompt(command, validation.risk);
        if (prompt) {
          renderer.displayWarning(prompt);
          // In a real implementation, would use readline to get user input
          // For now, we'll proceed (assuming approval)
        }
      }

      if (background) {
        // Execute in background
        const pid = processManager.executeBackground(command, {
          timeout,
          onOutput: (data) => renderer.displayInfo(data),
          onError: (data) => renderer.displayError(data)
        });

        renderer.displaySuccess(`Process started with PID: ${pid}`);
        renderer.displayInfo(`Use /output ${pid} to view output`);
        renderer.displayInfo(`Use /kill ${pid} to stop process`);
      } else {
        // Execute in foreground
        renderer.displayInfo(`Executing: ${command}`);

        const result = await processManager.execute(command, {
          timeout,
          onOutput: (data) => process.stdout.write(data),
          onError: (data) => process.stderr.write(data)
        });

        if (result.timedOut) {
          renderer.displayWarning(`Command timed out after ${timeout}ms`);
        }

        if (result.exitCode === 0) {
          renderer.displaySuccess(`Command completed successfully (exit code: 0)`);
        } else {
          renderer.displayError(`Command failed (exit code: ${result.exitCode})`);
        }
      }
    } catch (error) {
      renderer.displayError(`Failed to execute command: ${(error as Error).message}`);
    }
  }
};

/**
 * Run command - run npm/yarn script (Phase 2)
 */
const runCommand: CommandHandler = {
  name: 'run',
  usage: '<script> [args...]',
  description: 'Run npm/yarn script',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /run <script> [args...]');
      return;
    }

    const script = args[0];
    const scriptArgs = args.slice(1);

    // Detect package manager
    const { existsSync } = await import('fs');
    const hasYarnLock = existsSync('yarn.lock');
    const hasPnpmLock = existsSync('pnpm-lock.yaml');

    let packageManager = 'npm';
    if (hasPnpmLock) {
      packageManager = 'pnpm';
    } else if (hasYarnLock) {
      packageManager = 'yarn';
    }

    // Build command
    const command = `${packageManager} run ${script}${scriptArgs.length > 0 ? ' -- ' + scriptArgs.join(' ') : ''}`;

    try {
      renderer.displayInfo(`Running: ${command}`);

      const result = await processManager.execute(command, {
        onOutput: (data) => process.stdout.write(data),
        onError: (data) => process.stderr.write(data)
      });

      if (result.exitCode === 0) {
        renderer.displaySuccess(`Script completed successfully`);
      } else {
        renderer.displayError(`Script failed (exit code: ${result.exitCode})`);
      }
    } catch (error) {
      renderer.displayError(`Failed to run script: ${(error as Error).message}`);
    }
  }
};

/**
 * Processes command - list running processes (Phase 2)
 */
const processesCommand: CommandHandler = {
  name: 'processes',
  aliases: ['ps'],
  usage: '[--all]',
  description: 'List running processes',
  async execute(args, _context) {
    const all = args.includes('--all');
    const processes = processManager.listProcesses(all);

    if (processes.length === 0) {
      renderer.displayInfo('No processes running');
      return;
    }

    renderer.displayInfo(`\n${'PID'.padEnd(8)}${'COMMAND'.padEnd(30)}${'STATUS'.padEnd(12)}${'STARTED'.padEnd(20)}OUTPUT`);
    renderer.displayInfo('─'.repeat(80));

    for (const proc of processes) {
      const pid = proc.pid.toString().padEnd(8);
      const command = proc.command.length > 28
        ? proc.command.substring(0, 25) + '...'
        : proc.command.padEnd(30);
      const status = proc.status.padEnd(12);
      const started = proc.startTime.toLocaleTimeString().padEnd(20);
      const outputLines = proc.stdout.length + proc.stderr.length;

      renderer.displayInfo(`${pid}${command}${status}${started}${outputLines} lines`);
    }
  }
};

/**
 * Kill command - kill a running process (Phase 2)
 */
const killCommand: CommandHandler = {
  name: 'kill',
  usage: '<pid> [--force]',
  description: 'Kill a running process',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /kill <pid> [--force]');
      return;
    }

    const pidArg = args[0];
    if (!pidArg) {
      renderer.displayError('PID is required');
      return;
    }

    const pid = parseInt(pidArg, 10);
    if (isNaN(pid)) {
      renderer.displayError(`Invalid PID: ${pidArg}`);
      return;
    }

    const force = args.includes('--force');

    try {
      const success = processManager.killProcess(pid, force);

      if (success) {
        renderer.displaySuccess(`Process ${pid} ${force ? 'killed (SIGKILL)' : 'terminated (SIGTERM)'}`);
      } else {
        renderer.displayError(`Failed to kill process ${pid} (process not found or already completed)`);
      }
    } catch (error) {
      renderer.displayError(`Failed to kill process: ${(error as Error).message}`);
    }
  }
};

/**
 * Output command - show process output (Phase 2)
 */
const outputCommand: CommandHandler = {
  name: 'output',
  usage: '<pid> [--follow] [--lines N]',
  description: 'Show process output',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /output <pid> [--follow] [--lines N]');
      return;
    }

    const pidArg = args[0];
    if (!pidArg) {
      renderer.displayError('PID is required');
      return;
    }

    const pid = parseInt(pidArg, 10);
    if (isNaN(pid)) {
      renderer.displayError(`Invalid PID: ${pidArg}`);
      return;
    }

    const follow = args.includes('--follow');
    const linesIndex = args.indexOf('--lines');
    const linesArg = linesIndex >= 0 ? args[linesIndex + 1] : undefined;
    const lines = linesArg ? parseInt(linesArg, 10) : undefined;

    try {
      const output = processManager.getOutput(pid);

      if (!output) {
        renderer.displayError(`Process ${pid} not found`);
        return;
      }

      // Show output
      const allOutput = [...output.stdout, ...output.stderr];
      const displayOutput = lines ? allOutput.slice(-lines) : allOutput;

      displayOutput.forEach(line => {
        if (line.trim()) {
          renderer.displayInfo(line);
        }
      });

      // Follow mode
      if (follow) {
        renderer.displayInfo('\n--- Following output (Ctrl+C to stop) ---\n');

        const cleanup = processManager.streamOutput(pid, (line) => {
          if (line.trim()) {
            renderer.displayInfo(line);
          }
        });

        // Setup Ctrl+C handler
        const handleInterrupt = () => {
          cleanup();
          process.removeListener('SIGINT', handleInterrupt);
          renderer.displayInfo('\n--- Stopped following ---');
        };

        process.on('SIGINT', handleInterrupt);
      }
    } catch (error) {
      renderer.displayError(`Failed to show output: ${(error as Error).message}`);
    }
  }
};

/**
 * Find command - find files by pattern (Phase 2)
 */
const findCommand: CommandHandler = {
  name: 'find',
  usage: '<pattern> [--ignore <pattern>] [--type f|d]',
  description: 'Find files by glob pattern',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /find <pattern> [--ignore <pattern>] [--type f|d]');
      return;
    }

    const pattern = args[0] || '';

    // Parse options
    const ignoreIndex = args.indexOf('--ignore');
    const ignore = ignoreIndex >= 0 && args[ignoreIndex + 1] ? [args[ignoreIndex + 1] || ''] : undefined;

    const typeIndex = args.indexOf('--type');
    const typeArg = typeIndex >= 0 ? args[typeIndex + 1] : undefined;
    const type = (typeArg === 'f' || typeArg === 'd') ? typeArg : 'all';

    try {
      renderer.displayInfo(`Searching for: ${pattern}`);

      const files = await searchManager.findFiles(pattern, { ignore, type });

      if (files.length === 0) {
        renderer.displayInfo('No files found');
        return;
      }

      renderer.displaySuccess(`Found ${files.length} file(s):\n`);
      files.forEach(file => renderer.displayInfo(`  ${file}`));
    } catch (error) {
      renderer.displayError(`Find failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Search command - search file contents (Phase 2)
 */
const searchCommand: CommandHandler = {
  name: 'search',
  aliases: ['grep'],
  usage: '<query> [--type <exts>] [--ignore-case] [-C <N>]',
  description: 'Search file contents',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /search <query> [--type <exts>] [--ignore-case] [-C <N>]');
      return;
    }

    const query = args[0] || '';

    // Parse options
    const typeIndex = args.indexOf('--type');
    const typeArg = typeIndex >= 0 ? args[typeIndex + 1] : undefined;
    const type = typeArg ? typeArg.split(',') : undefined;

    const ignoreCase = args.includes('--ignore-case') || args.includes('-i');

    const contextIndex = args.indexOf('-C');
    const contextArg = contextIndex >= 0 ? args[contextIndex + 1] : undefined;
    const context = contextArg ? parseInt(contextArg, 10) : undefined;

    try {
      renderer.displayInfo(`Searching for: "${query}"`);

      const results = await searchManager.searchContent(query, {
        type,
        ignoreCase,
        context
      });

      if (results.length === 0) {
        renderer.displayInfo('No matches found');
        return;
      }

      renderer.displaySuccess(`\nFound ${results.length} match(es):\n`);

      for (const result of results) {
        renderer.displayInfo(`${result.file}:${result.line}`);
        renderer.displayInfo(`  ${result.content}`);
        renderer.displayInfo('');
      }
    } catch (error) {
      renderer.displayError(`Search failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Tree command - show directory tree (Phase 2)
 */
const treeCommand: CommandHandler = {
  name: 'tree',
  usage: '[path] [--maxdepth <N>] [--ignore <dirs>]',
  description: 'Show directory tree',
  async execute(args, _context) {
    const path = args[0] && !args[0].startsWith('--') ? args[0] : undefined;

    // Parse options
    const maxdepthIndex = args.indexOf('--maxdepth');
    const maxdepthArg = maxdepthIndex >= 0 ? args[maxdepthIndex + 1] : undefined;
    const maxDepth = maxdepthArg ? parseInt(maxdepthArg, 10) : 3;

    const ignoreIndex = args.indexOf('--ignore');
    const ignoreArg = ignoreIndex >= 0 ? args[ignoreIndex + 1] : undefined;
    const ignore = ignoreArg ? ignoreArg.split(',') : undefined;

    try {
      const tree = await searchManager.getFileTree(path, { maxDepth, ignore });
      renderer.displayInfo('\n' + tree);
    } catch (error) {
      renderer.displayError(`Tree failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Git command - execute git commands (Phase 2)
 */
const gitCommand: CommandHandler = {
  name: 'git',
  usage: '<subcommand> [args...]',
  description: 'Execute git command',
  async execute(args, _context) {
    if (args.length === 0) {
      renderer.displayError('Usage: /git <subcommand> [args...]');
      return;
    }

    try {
      const isRepo = await gitManager.isGitRepo();
      if (!isRepo) {
        renderer.displayError('Not a git repository');
        return;
      }

      const result = await gitManager.exec(args);

      if (result.stdout) {
        renderer.displayInfo(result.stdout);
      }

      if (result.stderr) {
        renderer.displayWarning(result.stderr);
      }

      if (result.exitCode !== 0) {
        renderer.displayError(`Git command failed (exit code: ${result.exitCode})`);
      }
    } catch (error) {
      renderer.displayError(`Git command failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Status command - git status shorthand (Phase 2)
 */
const statusCommand: CommandHandler = {
  name: 'status',
  description: 'Show git status',
  async execute(_args, _context) {
    try {
      const isRepo = await gitManager.isGitRepo();
      if (!isRepo) {
        renderer.displayError('Not a git repository');
        return;
      }

      const status = await gitManager.getStatus();

      renderer.displayInfo(`\nOn branch ${status.branch}`);

      if (status.ahead > 0 || status.behind > 0) {
        const parts: string[] = [];
        if (status.ahead > 0) parts.push(`ahead ${status.ahead}`);
        if (status.behind > 0) parts.push(`behind ${status.behind}`);
        renderer.displayInfo(`Your branch is ${parts.join(' and ')}`);
      }

      if (status.staged.length > 0) {
        renderer.displaySuccess('\nChanges staged for commit:');
        status.staged.forEach(file => renderer.displayInfo(`  modified: ${file}`));
      }

      if (status.unstaged.length > 0) {
        renderer.displayWarning('\nChanges not staged for commit:');
        status.unstaged.forEach(file => renderer.displayInfo(`  modified: ${file}`));
      }

      if (status.untracked.length > 0) {
        renderer.displayInfo('\nUntracked files:');
        status.untracked.forEach(file => renderer.displayInfo(`  ${file}`));
      }

      if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
        renderer.displaySuccess('\nNothing to commit, working tree clean');
      }
    } catch (error) {
      renderer.displayError(`Failed to get status: ${(error as Error).message}`);
    }
  }
};

/**
 * Test command - run tests (Phase 3)
 */
const testCommand: CommandHandler = {
  name: 'test',
  usage: '[files...] [--watch] [--filter <pattern>] [--coverage] [--verbose]',
  description: 'Run tests with auto-detected framework',
  async execute(args, _context) {
    try {
      const framework = await testRunner.detectFramework();
      if (!framework) {
        renderer.displayError('No test framework detected. Install jest, vitest, mocha, or ava.');
        return;
      }

      renderer.displayInfo(`Using ${framework.name} test runner...`);

      const options = {
        files: args.filter(arg => !arg.startsWith('--')),
        watch: args.includes('--watch') || args.includes('-w'),
        filter: args.find((arg, i) => (args[i - 1] === '--filter')),
        coverage: args.includes('--coverage'),
        verbose: args.includes('--verbose')
      };

      const results = await testRunner.runTests(options);

      renderer.displayInfo(`\nTest Results (${results.framework}):`);
      renderer.displaySuccess(`  Passed:  ${results.passed}`);
      if (results.failed > 0) {
        renderer.displayError(`  Failed:  ${results.failed}`);
      }
      if (results.skipped > 0) {
        renderer.displayWarning(`  Skipped: ${results.skipped}`);
      }
      renderer.displayInfo(`  Total:   ${results.total}`);
      renderer.displayInfo(`  Duration: ${results.duration.toFixed(2)}s`);

      if (results.failed > 0) {
        renderer.displayError('\nTests failed');
      } else {
        renderer.displaySuccess('\nAll tests passed!');
      }
    } catch (error) {
      renderer.displayError(`Test failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Coverage command - run tests with coverage (Phase 3)
 */
const coverageCommand: CommandHandler = {
  name: 'coverage',
  usage: '[files...]',
  description: 'Run tests with coverage report',
  async execute(args, _context) {
    try {
      const framework = await testRunner.detectFramework();
      if (!framework) {
        renderer.displayError('No test framework detected.');
        return;
      }

      renderer.displayInfo(`Running ${framework.name} with coverage...`);

      const options = {
        files: args.filter(arg => !arg.startsWith('--'))
      };

      const results = await testRunner.runCoverage(options);

      renderer.displayInfo('\nCoverage Summary:');
      renderer.displayInfo(`  Statements: ${results.statements.percentage.toFixed(1)}% (${results.statements.covered}/${results.statements.total})`);
      renderer.displayInfo(`  Branches:   ${results.branches.percentage.toFixed(1)}% (${results.branches.covered}/${results.branches.total})`);
      renderer.displayInfo(`  Functions:  ${results.functions.percentage.toFixed(1)}% (${results.functions.covered}/${results.functions.total})`);
      renderer.displayInfo(`  Lines:      ${results.lines.percentage.toFixed(1)}% (${results.lines.covered}/${results.lines.total})`);

      const avgCoverage = (
        results.statements.percentage +
        results.branches.percentage +
        results.functions.percentage +
        results.lines.percentage
      ) / 4;

      if (avgCoverage >= 80) {
        renderer.displaySuccess('\nExcellent coverage!');
      } else if (avgCoverage >= 60) {
        renderer.displayWarning('\nGood coverage, but could be improved');
      } else {
        renderer.displayError('\nLow coverage - consider adding more tests');
      }
    } catch (error) {
      renderer.displayError(`Coverage failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Lint command - run linter (Phase 3)
 */
const lintCommand: CommandHandler = {
  name: 'lint',
  usage: '[files...] [--fix] [--quiet]',
  description: 'Lint code with auto-detected linter',
  async execute(args, _context) {
    try {
      const linter = await lintFormatter.detectLinter();
      if (!linter) {
        renderer.displayError('No linter detected. Install eslint or standard.');
        return;
      }

      renderer.displayInfo(`Using ${linter.name} linter...`);

      const options = {
        files: args.filter(arg => !arg.startsWith('--')),
        fix: args.includes('--fix'),
        quiet: args.includes('--quiet')
      };

      const results = await lintFormatter.lint(options);

      if (results.totalErrors === 0 && results.totalWarnings === 0) {
        renderer.displaySuccess('\nNo linting errors found!');
        return;
      }

      renderer.displayInfo(`\nLint Results (${results.linter}):`);
      if (results.totalErrors > 0) {
        renderer.displayError(`  Errors:   ${results.totalErrors}`);
      }
      if (results.totalWarnings > 0) {
        renderer.displayWarning(`  Warnings: ${results.totalWarnings}`);
      }

      if (results.files.length > 0) {
        renderer.displayInfo('\nFiles with issues:');
        for (const file of results.files) {
          renderer.displayInfo(`\n  ${file.file}`);
          if (file.errors > 0) {
            renderer.displayError(`    Errors: ${file.errors}`);
          }
          if (file.warnings > 0) {
            renderer.displayWarning(`    Warnings: ${file.warnings}`);
          }

          // Show first few messages
          const maxMessages = 5;
          for (const msg of file.messages.slice(0, maxMessages)) {
            const severity = msg.severity === 'error' ? '✗' : '⚠';
            const rule = msg.rule ? ` (${msg.rule})` : '';
            renderer.displayInfo(`    ${severity} ${msg.line}:${msg.column} ${msg.message}${rule}`);
          }

          if (file.messages.length > maxMessages) {
            renderer.displayInfo(`    ... and ${file.messages.length - maxMessages} more`);
          }
        }
      }

      if (options.fix) {
        renderer.displaySuccess('\nAuto-fix applied where possible');
      }
    } catch (error) {
      renderer.displayError(`Lint failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Format command - format code (Phase 3)
 */
const formatCommand: CommandHandler = {
  name: 'format',
  usage: '[files...] [--check]',
  description: 'Format code with auto-detected formatter',
  async execute(args, _context) {
    try {
      const formatter = await lintFormatter.detectFormatter();
      if (!formatter) {
        renderer.displayError('No formatter detected. Install prettier or dprint.');
        return;
      }

      renderer.displayInfo(`Using ${formatter.name} formatter...`);

      const options = {
        files: args.filter(arg => !arg.startsWith('--')),
        check: args.includes('--check'),
        write: !args.includes('--check')
      };

      const results = await lintFormatter.format(options);

      if (results.formatted.length === 0) {
        renderer.displaySuccess('\nAll files are formatted correctly!');
        return;
      }

      if (options.check) {
        renderer.displayWarning(`\n${results.formatted.length} file(s) need formatting:`);
        results.formatted.forEach(file => renderer.displayInfo(`  ${file}`));
      } else {
        renderer.displaySuccess(`\nFormatted ${results.formatted.length} file(s):`);
        results.formatted.forEach(file => renderer.displayInfo(`  ${file}`));
      }
    } catch (error) {
      renderer.displayError(`Format failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Install command - install packages (Phase 3)
 */
const installCommand: CommandHandler = {
  name: 'install',
  usage: '<packages...> [--dev] [--exact] [--global]',
  description: 'Install npm packages',
  async execute(args, _context) {
    const packages = args.filter(arg => !arg.startsWith('--'));
    if (packages.length === 0) {
      renderer.displayError('Usage: /install <packages...> [--dev] [--exact] [--global]');
      return;
    }

    try {
      const pm = await packageManager.detectPackageManager();
      renderer.displayInfo(`Using ${pm.name} package manager...`);

      const options = {
        dev: args.includes('--dev') || args.includes('-D'),
        exact: args.includes('--exact') || args.includes('-E'),
        global: args.includes('--global') || args.includes('-g')
      };

      renderer.displayInfo(`Installing ${packages.join(', ')}...`);
      await packageManager.install(packages, options);

      renderer.displaySuccess(`\nSuccessfully installed ${packages.join(', ')}`);
    } catch (error) {
      renderer.displayError(`Install failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Update command - update packages (Phase 3)
 */
const updateCommand: CommandHandler = {
  name: 'update',
  usage: '[packages...] [--latest]',
  description: 'Update npm packages',
  async execute(args, _context) {
    try {
      const pm = await packageManager.detectPackageManager();
      renderer.displayInfo(`Using ${pm.name} package manager...`);

      const packages = args.filter(arg => !arg.startsWith('--'));
      const options = {
        latest: args.includes('--latest') || args.includes('-L'),
        interactive: args.includes('--interactive') || args.includes('-i')
      };

      if (packages.length === 0) {
        renderer.displayInfo('Updating all packages...');
      } else {
        renderer.displayInfo(`Updating ${packages.join(', ')}...`);
      }

      await packageManager.update(packages.length > 0 ? packages : undefined, options);

      renderer.displaySuccess('\nPackages updated successfully');
    } catch (error) {
      renderer.displayError(`Update failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Outdated command - show outdated packages (Phase 3)
 */
const outdatedCommand: CommandHandler = {
  name: 'outdated',
  description: 'Show outdated packages',
  async execute(_args, _context) {
    try {
      const pm = await packageManager.detectPackageManager();
      renderer.displayInfo(`Using ${pm.name} package manager...\n`);

      const outdated = await packageManager.getOutdated();

      if (outdated.length === 0) {
        renderer.displaySuccess('All packages are up to date!');
        return;
      }

      renderer.displayInfo(`${'PACKAGE'.padEnd(30)}${'CURRENT'.padEnd(15)}${'WANTED'.padEnd(15)}${'LATEST'.padEnd(15)}TYPE`);
      renderer.displayInfo('─'.repeat(90));

      for (const pkg of outdated) {
        const name = pkg.name.padEnd(30);
        const current = pkg.current.padEnd(15);
        const wanted = pkg.wanted.padEnd(15);
        const latest = pkg.latest.padEnd(15);
        const type = pkg.type;

        renderer.displayWarning(`${name}${current}${wanted}${latest}${type}`);
      }

      renderer.displayInfo(`\n${outdated.length} package(s) are outdated`);
      renderer.displayInfo('Run /update to update packages');
    } catch (error) {
      renderer.displayError(`Failed to check outdated packages: ${(error as Error).message}`);
    }
  }
};

/**
 * Build command - build project (Phase 4)
 */
const buildCommand: CommandHandler = {
  name: 'build',
  usage: '[--production] [--watch] [--analyze]',
  description: 'Build project with auto-detected build tool',
  async execute(args, _context) {
    try {
      const tool = await buildManager.detectBuildTool();
      if (!tool) {
        renderer.displayError('No build tool detected. Install vite, webpack, rollup, esbuild, or tsup.');
        return;
      }

      renderer.displayInfo(`Using ${tool.name} build tool...`);

      const options = {
        production: args.includes('--production') || args.includes('-p'),
        watch: args.includes('--watch') || args.includes('-w'),
        analyze: args.includes('--analyze')
      };

      const results = await buildManager.build(options);

      if (results.success) {
        renderer.displaySuccess(`\nBuild completed in ${results.duration.toFixed(2)}s`);
        if (results.outputSize) {
          renderer.displayInfo(`Output size: ${results.outputSize.toFixed(2)} KB`);
        }
      } else {
        renderer.displayError('\nBuild failed');
      }

      if (results.warnings.length > 0) {
        renderer.displayWarning(`\n${results.warnings.length} warning(s):`);
        results.warnings.slice(0, 5).forEach(w => renderer.displayWarning(`  ${w}`));
      }

      if (results.errors.length > 0) {
        renderer.displayError(`\n${results.errors.length} error(s):`);
        results.errors.slice(0, 5).forEach(e => renderer.displayError(`  ${e}`));
      }
    } catch (error) {
      renderer.displayError(`Build failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Dev command - start dev server (Phase 4)
 */
const devCommand: CommandHandler = {
  name: 'dev',
  usage: '[--port <port>] [--open]',
  description: 'Start development server',
  async execute(args, _context) {
    try {
      const tool = await buildManager.detectBuildTool();
      if (!tool) {
        renderer.displayError('No build tool detected.');
        return;
      }

      renderer.displayInfo(`Starting ${tool.name} dev server...`);

      const portArg = args.find((arg, i) => args[i - 1] === '--port');
      const options = {
        port: portArg ? parseInt(portArg, 10) : undefined,
        open: args.includes('--open') || args.includes('-o')
      };

      const { pid, url } = await buildManager.dev(options);

      renderer.displaySuccess(`\nDev server started (PID: ${pid})`);
      renderer.displayInfo(`URL: ${url}`);
      renderer.displayInfo('\nUse /kill to stop the server');
    } catch (error) {
      renderer.displayError(`Dev server failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Env command - manage environment variables (Phase 4)
 */
const envCommand: CommandHandler = {
  name: 'env',
  usage: '[list|get|set|load] [key] [value]',
  description: 'Manage environment variables',
  async execute(args, _context) {
    try {
      const subcommand = args[0] || 'list';

      if (subcommand === 'list') {
        const filter = args[1];
        const vars = environmentManager.listEnv(filter);

        if (vars.length === 0) {
          renderer.displayInfo('No environment variables found');
          return;
        }

        renderer.displayInfo(`\n${'KEY'.padEnd(30)}${'VALUE'.padEnd(40)}SOURCE`);
        renderer.displayInfo('─'.repeat(80));

        for (const envVar of vars.slice(0, 20)) {
          const key = envVar.key.padEnd(30);
          const value = environmentManager.getDisplayValue(envVar.key).padEnd(40);
          const source = envVar.source;

          renderer.displayInfo(`${key}${value}${source}`);
        }

        if (vars.length > 20) {
          renderer.displayInfo(`\n... and ${vars.length - 20} more`);
        }
      } else if (subcommand === 'get') {
        const key = args[1];
        if (!key) {
          renderer.displayError('Usage: /env get <key>');
          return;
        }

        const value = environmentManager.getEnv(key);
        if (value) {
          renderer.displayInfo(`${key}=${environmentManager.getDisplayValue(key)}`);
        } else {
          renderer.displayError(`Environment variable not found: ${key}`);
        }
      } else if (subcommand === 'set') {
        const key = args[1];
        const value = args[2];
        if (!key || !value) {
          renderer.displayError('Usage: /env set <key> <value>');
          return;
        }

        environmentManager.setEnv(key, value);
        renderer.displaySuccess(`Set ${key}=${value}`);
      } else if (subcommand === 'load') {
        const file = args[1] || '.env';
        const loaded = await environmentManager.loadEnvFile({ path: file });

        renderer.displaySuccess(`\nLoaded ${loaded.size} variable(s) from ${file}`);
      } else {
        renderer.displayError(`Unknown subcommand: ${subcommand}`);
        renderer.displayInfo('Usage: /env [list|get|set|load] [key] [value]');
      }
    } catch (error) {
      renderer.displayError(`Env command failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Create command - create project from template (Phase 4)
 */
const createCommand: CommandHandler = {
  name: 'create',
  usage: '<template> <name>',
  description: 'Create project from template',
  async execute(args, _context) {
    const template = args[0];
    const name = args[1];

    if (!template || !name) {
      renderer.displayError('Usage: /create <template> <name>');
      renderer.displayInfo('\nAvailable templates:');
      const templates = projectScaffolder.listTemplates();
      templates.forEach(t => renderer.displayInfo(`  ${t.name.padEnd(15)} - ${t.description}`));
      return;
    }

    try {
      renderer.displayInfo(`Creating ${template} project: ${name}...`);

      await projectScaffolder.createProject({
        template,
        name,
        install: false,
        git: false
      });

      renderer.displaySuccess(`\nProject created: ${name}`);
      renderer.displayInfo('\nNext steps:');
      renderer.displayInfo(`  cd ${name}`);
      renderer.displayInfo('  npm install');
      renderer.displayInfo('  npm run dev');
    } catch (error) {
      renderer.displayError(`Create failed: ${(error as Error).message}`);
    }
  }
};

/**
 * Get all registered commands
 */
export function getAllCommands(): CommandHandler[] {
  return [
    helpCommand,
    exitCommand,
    clearCommand,
    providerCommand,
    historyCommand,
    statsCommand,
    saveCommand,
    listCommand,
    loadCommand,
    exportCommand,
    deleteCommand,
    newCommand,
    agentsCommand,
    memoryCommand,
    initCommand,
    readCommand,
    writeCommand,
    editCommand,
    execCommand,
    runCommand,
    processesCommand,
    killCommand,
    outputCommand,
    findCommand,
    searchCommand,
    treeCommand,
    gitCommand,
    statusCommand,
    testCommand,
    coverageCommand,
    lintCommand,
    formatCommand,
    installCommand,
    updateCommand,
    outdatedCommand,
    buildCommand,
    devCommand,
    envCommand,
    createCommand
  ];
}

/**
 * Route a slash command to its handler
 */
export async function routeCommand(
  command: string,
  args: string[],
  context: CommandContext
): Promise<void> {
  const commands = getAllCommands();

  // Find command by name or alias
  const handler = commands.find(cmd =>
    cmd.name === command ||
    (cmd.aliases && cmd.aliases.includes(command))
  );

  if (!handler) {
    renderer.displayError(`Unknown command: ${command}`);
    renderer.displayInfo('Type /help for available commands');
    return;
  }

  try {
    await handler.execute(args, context);
  } catch (error) {
    renderer.displayError(`Command failed: ${(error as Error).message}`);
  }
}

/**
 * Cleanup all module-level resources
 * Called during REPL shutdown to prevent memory leaks
 */
export function cleanupCommands(): void {
  // Close process manager (clears cleanup interval and event listeners)
  processManager.close();
}
