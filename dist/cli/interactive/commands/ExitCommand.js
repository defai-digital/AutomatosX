/**
 * AutomatosX v8.0.0 - Exit Command
 *
 * Exit the Interactive CLI REPL
 */
import chalk from 'chalk';
/**
 * Exit Command
 *
 * Gracefully exits the REPL session
 */
export class ExitCommand {
    name = 'exit';
    description = 'Exit the interactive CLI';
    usage = '/exit';
    aliases = ['quit', 'q'];
    async execute(args, context) {
        console.log(chalk.yellow('\n👋 Exiting... Goodbye!\n'));
        // Exit process
        process.exit(0);
    }
}
//# sourceMappingURL=ExitCommand.js.map