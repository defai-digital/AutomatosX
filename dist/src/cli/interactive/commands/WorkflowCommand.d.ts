/**
 * AutomatosX v8.0.0 - Workflow Command
 *
 * Delegate to existing `ax workflow run` command
 */
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';
/**
 * Workflow Command
 *
 * Delegates to the existing workflow execution functionality
 * Usage:
 *   /workflow <path>          - Run a workflow
 *   /workflow list            - List available workflows
 */
export declare class WorkflowCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    private conversationContext?;
    setConversationContext(context: ConversationContext): void;
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * List available workflows
     */
    private listWorkflows;
    /**
     * Execute external command and stream output
     */
    private executeCommand;
}
//# sourceMappingURL=WorkflowCommand.d.ts.map