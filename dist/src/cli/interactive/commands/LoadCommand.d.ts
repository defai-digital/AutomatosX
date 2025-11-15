/**
 * AutomatosX v8.0.0 - Load Command
 *
 * Load conversation from file
 * Day 3: Stub implementation
 * Day 4: Full file import with validation
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * Load Command
 *
 * Loads conversation snapshot from JSON file
 */
export declare class LoadCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: never[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=LoadCommand.d.ts.map