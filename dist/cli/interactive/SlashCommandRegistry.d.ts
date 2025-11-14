/**
 * Slash Command Registry
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Registry for slash commands with registration and execution
 */
/**
 * Conversation Context Interface (Week 2 - stub for now)
 */
export interface ConversationContext {
    conversationId: string;
    userId: string;
    sessionStartedAt: Date;
    messageCount: number;
    activeAgent?: string;
    activeWorkflow?: string;
    variables: Record<string, unknown>;
    lastResults?: unknown;
}
/**
 * Slash Command Interface
 */
export interface SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases?: string[];
    execute(args: string[], context?: ConversationContext): Promise<void>;
}
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
    execute(input: string, context?: ConversationContext): Promise<void>;
    /**
     * Register all builtin commands
     */
    private registerBuiltinCommands;
}
//# sourceMappingURL=SlashCommandRegistry.d.ts.map