/**
 * Slash Command Router
 *
 * Handles /help, /exit, /clear, /provider, /history, /save, etc.
 */

import type { CommandHandler, CommandContext, Conversation } from './types.js';
import { OutputRenderer } from './renderer.js';

const renderer = new OutputRenderer();

/**
 * Help command - show available commands
 */
const helpCommand: CommandHandler = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show this help message',
  async execute(_args, _context) {
    const commands = getAllCommands();
    renderer.displayHelp(commands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage
    })));
  }
};

/**
 * Exit command - exit ax-cli
 */
const exitCommand: CommandHandler = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit ax-cli',
  async execute(_args, _context) {
    renderer.displayGoodbye();
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
  aliases: ['h'],
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
      const conversationManager = (context as any).conversationManager;
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
 * Memory command - search AutomatosX memory
 */
const memoryCommand: CommandHandler = {
  name: 'memory',
  usage: 'search <query>',
  description: 'Search AutomatosX memory',
  async execute(args, _context) {
    if (args[0] !== 'search') {
      renderer.displayError('Usage: /memory search <query>');
      return;
    }

    const query = args.slice(1).join(' ');
    if (!query) {
      renderer.displayError('Please provide a search query');
      return;
    }

    // TODO: Integrate with AutomatosX memory system
    // For MVP, show placeholder
    renderer.displayInfo(`Searching memory for: "${query}"`);
    renderer.displayInfo('Memory integration coming in Phase 1');
  }
};

/**
 * List command - list saved conversations
 */
const listCommand: CommandHandler = {
  name: 'list',
  aliases: ['ls'],
  description: 'List saved conversations',
  async execute(_args, context) {
    try {
      const conversationManager = (context as any).conversationManager;
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
      const conversationManager = (context as any).conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      // List conversations to find the matching one
      const conversations = await conversationManager.listConversations();
      const match = conversations.find((c: Conversation) =>
        (c.name && c.name.toLowerCase() === name.toLowerCase()) ||
        c.id.toLowerCase().includes(name.toLowerCase())
      );

      if (!match) {
        renderer.displayError(`Conversation "${name}" not found`);
        renderer.displayInfo('Use /list to see available conversations');
        return;
      }

      const filepath = require('path').join(
        conversationManager.conversationsDir || '',
        match.filename
      );

      await conversationManager.loadFromFile(filepath);

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
      const conversationManager = (context as any).conversationManager;
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
      const conversationManager = (context as any).conversationManager;
      if (!conversationManager) {
        renderer.displayError('Conversation manager not available');
        return;
      }

      // List conversations to find the matching one
      const conversations = await conversationManager.listConversations();
      const match = conversations.find((c: Conversation) =>
        (c.name && c.name.toLowerCase() === name.toLowerCase()) ||
        c.id.toLowerCase().includes(name.toLowerCase())
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
      const conversationManager = (context as any).conversationManager;
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
    memoryCommand
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
