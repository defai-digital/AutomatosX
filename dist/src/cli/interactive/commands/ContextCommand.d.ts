/**
 * AutomatosX v8.0.0 - Context Command
 *
 * Display current conversation context
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * Context Command
 *
 * Shows current context state:
 * - Conversation ID
 * - Message count
 * - Active agent
 * - Active workflow
 * - Variables
 */
export declare class ContextCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=ContextCommand.d.ts.map