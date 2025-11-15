/**
 * AutomatosX v8.0.0 - Save Command
 *
 * Save conversation to file
 * Day 3: Stub implementation
 * Day 4: Full file export with proper JSON formatting
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * Save Command
 *
 * Saves conversation snapshot to JSON file
 */
export declare class SaveCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: never[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=SaveCommand.d.ts.map