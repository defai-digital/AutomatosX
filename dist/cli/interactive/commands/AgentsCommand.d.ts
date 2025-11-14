/**
 * AutomatosX v8.0.0 - Agents Command
 *
 * List available agents with filtering
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Agents Command
 *
 * Lists all available agents or filters by name/category
 */
export declare class AgentsCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * Categorize agent by name
     */
    private getCategory;
}
//# sourceMappingURL=AgentsCommand.d.ts.map