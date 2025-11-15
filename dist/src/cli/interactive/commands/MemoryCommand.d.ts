/**
 * AutomatosX v8.0.0 - Memory Command
 *
 * Delegate to existing `ax memory search` command
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Memory Command
 *
 * Delegates to the existing memory search functionality
 * Usage:
 *   /memory <query>           - Search code memory
 *   /memory index <path>      - Index a directory
 */
export declare class MemoryCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * Execute external command and stream output
     */
    private executeCommand;
}
//# sourceMappingURL=MemoryCommand.d.ts.map