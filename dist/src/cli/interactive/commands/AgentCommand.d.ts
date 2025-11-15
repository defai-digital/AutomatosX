/**
 * AutomatosX v8.0.0 - Agent Command
 *
 * Set active agent for conversation
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * Agent Command
 *
 * Sets the active agent for the conversation
 * Usage:
 *   /agent <name>     - Set active agent
 *   /agent clear      - Clear active agent
 *   /agent            - Show current active agent
 */
export declare class AgentCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: never[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=AgentCommand.d.ts.map