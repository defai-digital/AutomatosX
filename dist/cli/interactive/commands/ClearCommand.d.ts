/**
 * AutomatosX v8.0.0 - Clear Command
 *
 * Clear the terminal screen
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Clear Command
 *
 * Clears the terminal screen
 */
export declare class ClearCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=ClearCommand.d.ts.map