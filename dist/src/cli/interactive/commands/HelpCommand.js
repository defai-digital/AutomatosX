/**
 * AutomatosX v8.0.0 - Help Command
 *
 * Display all available slash commands with descriptions
 */
import chalk from 'chalk';
/**
 * Help Command
 *
 * Shows all available slash commands with usage examples
 */
export class HelpCommand {
    registry;
    name = 'help';
    description = 'Show all available commands';
    usage = '/help [command]';
    aliases = ['h', '?'];
    constructor(registry) {
        this.registry = registry;
    }
    async execute(args, context) {
        // If specific command requested
        if (args.length > 0) {
            const commandName = args[0];
            const command = this.registry.get(commandName);
            if (!command) {
                console.log(chalk.red(`\n❌ Unknown command: /${commandName}`));
                return;
            }
            // Show detailed help for specific command
            this.showCommandHelp(command);
            return;
        }
        // Show all commands
        this.showAllCommands();
    }
    /**
     * Show help for a specific command
     */
    showCommandHelp(command) {
        console.log(chalk.bold.cyan(`\n📖 Help: /${command.name}\n`));
        console.log(chalk.white(`${command.description}\n`));
        console.log(chalk.gray('Usage:'));
        console.log(`  ${chalk.green(command.usage)}\n`);
        if (command.aliases && command.aliases.length > 0) {
            console.log(chalk.gray('Aliases:'));
            console.log(`  ${command.aliases.map(a => chalk.green(`/${a}`)).join(', ')}\n`);
        }
    }
    /**
     * Show all available commands
     */
    showAllCommands() {
        const commands = this.registry.list().sort((a, b) => a.name.localeCompare(b.name));
        console.log(chalk.bold.cyan('\n📋 Available Commands\n'));
        // Group commands by category (for now, just list all)
        for (const command of commands) {
            const aliases = command.aliases ? ` (${command.aliases.map(a => `/${a}`).join(', ')})` : '';
            console.log(`  ${chalk.green(`/${command.name}`)}${chalk.gray(aliases)}`);
            console.log(`    ${chalk.white(command.description)}`);
            console.log(`    ${chalk.gray('Usage:')} ${command.usage}\n`);
        }
        console.log(chalk.gray('Type /help <command> for detailed help on a specific command.\n'));
    }
}
//# sourceMappingURL=HelpCommand.js.map