/**
 * AutomatosX v8.0.0 - Slash Command Registry
 *
 * Registry for managing and executing slash commands in Interactive CLI
 */
/**
 * Slash Command Registry
 *
 * Manages registration and execution of slash commands
 */
export class SlashCommandRegistry {
    commands = new Map();
    aliases = new Map();
    /**
     * Register a slash command
     *
     * @throws Error if command name or alias conflicts with existing command
     */
    register(command) {
        // Check for name conflict
        if (this.commands.has(command.name)) {
            throw new Error(`Command '${command.name}' is already registered`);
        }
        // Check for alias conflicts
        if (command.aliases) {
            for (const alias of command.aliases) {
                if (this.aliases.has(alias)) {
                    throw new Error(`Alias '${alias}' is already registered`);
                }
            }
        }
        // Register command
        this.commands.set(command.name, command);
        // Register aliases
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias, command.name);
            }
        }
    }
    /**
     * Get a command by name or alias
     */
    get(nameOrAlias) {
        // Try direct name lookup
        let command = this.commands.get(nameOrAlias);
        // Try alias lookup
        if (!command) {
            const commandName = this.aliases.get(nameOrAlias);
            if (commandName) {
                command = this.commands.get(commandName);
            }
        }
        return command;
    }
    /**
     * List all registered commands
     */
    list() {
        return Array.from(this.commands.values());
    }
    /**
     * Execute a slash command
     *
     * @param input - Raw input string (e.g., "/help" or "/agent security")
     * @param context - Command execution context
     */
    async execute(input, context) {
        // Parse command and arguments
        const { commandName, args } = this.parseInput(input);
        // Get command
        const command = this.get(commandName);
        if (!command) {
            throw new Error(`Unknown command: /${commandName}`);
        }
        // Execute command
        await command.execute(args, context);
    }
    /**
     * Parse slash command input
     */
    parseInput(input) {
        // Remove leading slash
        const trimmed = input.startsWith('/') ? input.slice(1) : input;
        // Split by whitespace
        const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
        const commandName = parts[0] || '';
        const args = parts.slice(1);
        return { commandName, args };
    }
    /**
     * Check if a command exists
     */
    has(nameOrAlias) {
        return this.get(nameOrAlias) !== undefined;
    }
    /**
     * Get command count
     */
    count() {
        return this.commands.size;
    }
    /**
     * Clear all commands (useful for testing)
     */
    clear() {
        this.commands.clear();
        this.aliases.clear();
    }
}
