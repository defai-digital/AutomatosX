/**
 * Slash Command Registry
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Registry for slash commands with registration and execution
 */
import { HelpCommand } from './commands/HelpCommand.js';
import { ExitCommand } from './commands/ExitCommand.js';
import { ClearCommand } from './commands/ClearCommand.js';
import { AgentsCommand } from './commands/AgentsCommand.js';
import { AgentCommand } from './commands/AgentCommand.js';
import { MemoryCommand } from './commands/MemoryCommand.js';
import { WorkflowCommand } from './commands/WorkflowCommand.js';
import { ContextCommand } from './commands/ContextCommand.js';
import { HistoryCommand } from './commands/HistoryCommand.js';
import { ConfigCommand } from './commands/ConfigCommand.js';
import { StatusCommand } from './commands/StatusCommand.js';
import { SaveCommand } from './commands/SaveCommand.js';
import { LoadCommand } from './commands/LoadCommand.js';
/**
 * Slash Command Registry
 *
 * Manages registration and execution of slash commands
 */
export class SlashCommandRegistry {
    commands = new Map();
    constructor() {
        this.registerBuiltinCommands();
    }
    /**
     * Register a slash command
     */
    register(command) {
        this.commands.set(command.name, command);
        command.aliases?.forEach(alias => {
            this.commands.set(alias, command);
        });
    }
    /**
     * Get a command by name or alias
     */
    get(name) {
        return this.commands.get(name);
    }
    /**
     * List all unique commands (exclude aliases)
     */
    list() {
        const seen = new Set();
        return Array.from(this.commands.values()).filter(cmd => {
            if (seen.has(cmd))
                return false;
            seen.add(cmd);
            return true;
        });
    }
    /**
     * Execute a slash command
     */
    async execute(input, context) {
        // Split by whitespace and filter empty strings (handles multiple spaces)
        const parts = input.slice(1).split(/\s+/).filter(part => part.length > 0);
        const [commandName, ...args] = parts;
        const command = this.get(commandName);
        if (!command) {
            throw new Error(`Unknown command: /${commandName}. Type /help for available commands.`);
        }
        await command.execute(args, context);
    }
    /**
     * Register all builtin commands
     */
    registerBuiltinCommands() {
        this.register(new HelpCommand(this));
        this.register(new ExitCommand());
        this.register(new ClearCommand());
        this.register(new AgentsCommand());
        this.register(new AgentCommand());
        this.register(new MemoryCommand());
        this.register(new WorkflowCommand());
        this.register(new ContextCommand());
        this.register(new HistoryCommand());
        this.register(new ConfigCommand());
        this.register(new StatusCommand());
        this.register(new SaveCommand());
        this.register(new LoadCommand());
    }
}
//# sourceMappingURL=SlashCommandRegistry.js.map