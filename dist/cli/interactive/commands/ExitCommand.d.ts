/**
 * AutomatosX v8.0.0 - Exit Command
 *
 * Exit the Interactive CLI REPL
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Exit Command
 *
 * Gracefully exits the REPL session
 */
export declare class ExitCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
}
//# sourceMappingURL=ExitCommand.d.ts.map