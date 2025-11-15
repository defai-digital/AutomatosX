/**
 * Slash Command Registry
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Registry for slash commands with registration and execution
 */
import type { SlashCommand, CommandContext } from './types.js';
export type { SlashCommand, CommandContext };
/**
 * Slash Command Registry
 *
 * Manages registration and execution of slash commands
 */
export declare class SlashCommandRegistry {
    private commands;
    constructor();
    /**
     * Register a slash command
     */
    register(command: SlashCommand): void;
    /**
     * Get a command by name or alias
     */
    get(name: string): SlashCommand | undefined;
    /**
     * List all unique commands (exclude aliases)
     */
    list(): SlashCommand[];
    /**
     * Execute a slash command
     */
    execute(input: string, context: CommandContext): Promise<void>;
    /**
     * Register all builtin commands
     */
    private registerBuiltinCommands;
}
//# sourceMappingURL=SlashCommandRegistry.d.ts.map