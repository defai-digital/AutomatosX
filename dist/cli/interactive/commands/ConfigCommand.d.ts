/**
 * AutomatosX v8.0.0 - Config Command
 *
 * Show configuration settings
 */
import type { SlashCommand, CommandContext } from '../types.js';
/**
 * Config Command
 *
 * Displays current configuration
 */
export declare class ConfigCommand implements SlashCommand {
    name: string;
    description: string;
    usage: string;
    aliases: string[];
    execute(args: string[], context: CommandContext): Promise<void>;
    /**
     * Show all configuration
     */
    private showAllConfig;
    /**
     * Show specific configuration value
     */
    private showSpecificConfig;
    /**
     * Mask API key for display
     */
    private maskKey;
}
//# sourceMappingURL=ConfigCommand.d.ts.map