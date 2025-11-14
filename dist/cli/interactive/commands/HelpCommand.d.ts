/**
 * AutomatosX v8.0.0 - Help Command
 *
 * Display all available slash commands with descriptions
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { SlashCommandRegistry } from '../SlashCommandRegistry.js';
/**
 * Help Command
 *
 * Shows all available slash commands with usage examples
 */
export declare class HelpCommand implements SlashCommand {
    private registry;
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    constructor(registry: SlashCommandRegistry);
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * Show help for a specific command
     */
    private showCommandHelp;
    /**
     * Show all available commands
     */
    private showAllCommands;
}
//# sourceMappingURL=HelpCommand.d.ts.map