/**
 * AutomatosX v8.0.0 - History Command
 *
 * Display conversation history
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * History Command
 *
 * Shows recent messages from conversation
 */
export declare class HistoryCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=HistoryCommand.d.ts.map