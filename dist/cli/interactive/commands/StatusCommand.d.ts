/**
 * AutomatosX v8.0.0 - Status Command
 *
 * Show system status and health
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Status Command
 *
 * Displays system health and statistics
 */
export declare class StatusCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * Format uptime in human-readable format
     */
    private formatUptime;
}
//# sourceMappingURL=StatusCommand.d.ts.map