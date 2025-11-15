/**
 * AutomatosX v8.0.0 - Clear Command
 *
 * Clear the terminal screen
 */
/**
 * Clear Command
 *
 * Clears the terminal screen
 */
export class ClearCommand {
    name = 'clear';
    description = 'Clear the terminal screen';
    usage = '/clear';
    aliases = ['cls'];
    async execute(args, context) {
        // Clear screen using ANSI escape codes
        process.stdout.write('\x1Bc');
    }
}
//# sourceMappingURL=ClearCommand.js.map