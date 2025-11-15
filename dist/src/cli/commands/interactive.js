/**
 * AutomatosX v8.0.0 - Interactive CLI Command
 *
 * Launches ChatGPT-style REPL with all refinement features
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { getDatabase } from '../../database/connection.js';
import { REPLSession } from '../interactive/REPLSession.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { SlashCommandRegistry } from '../interactive/SlashCommandRegistry.js';
import { IntentLearningSystem } from '../interactive/IntentLearningSystem.js';
import { IterateModeHandler } from '../interactive/IterateModeHandler.js';
/**
 * Create interactive CLI command
 */
export function createInteractiveCommand() {
    const cmd = new Command('cli');
    cmd
        .description('Launch interactive CLI mode (ChatGPT-style REPL)')
        .alias('interactive')
        .alias('repl')
        .option('-p, --prompt <string>', 'Custom prompt string', chalk.cyan('> '))
        .option('-u, --user <string>', 'User ID for personalized context', 'default-user')
        .option('--no-autocomplete', 'Disable command autocompletion')
        .option('--no-syntax-highlighting', 'Disable syntax highlighting')
        .option('--save-interval <number>', 'Auto-save interval (messages)', '5')
        .action(async (options) => {
        try {
            console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
            console.log(chalk.bold.cyan('║     AutomatosX v8.0.0 - Interactive CLI (BETA)               ║'));
            console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════╝\n'));
            console.log(chalk.gray('Initializing components...\n'));
            // Initialize database
            const db = getDatabase();
            console.log(chalk.green('✓ Database connected'));
            // Initialize provider router
            const providerRouter = new ProviderRouterV2({
                providers: [],
                defaultProvider: 'claude',
                chaosMode: false,
            });
            console.log(chalk.green('✓ Provider router initialized'));
            // Initialize agent registry
            const agentRegistry = new AgentRegistry();
            console.log(chalk.green('✓ Agent registry loaded'));
            // Initialize slash command registry
            const commandRegistry = new SlashCommandRegistry();
            // Initialize intent learning system
            const learningSystem = new IntentLearningSystem(db, options.user);
            console.log(chalk.green('✓ Intent learning system ready'));
            // Initialize iterate mode handler
            const iterateHandler = new IterateModeHandler(db);
            console.log(chalk.green('✓ Iterate mode handler ready'));
            // Register custom slash commands
            registerSlashCommands(commandRegistry, learningSystem, iterateHandler);
            console.log(chalk.green('✓ Slash commands registered'));
            console.log('');
            // Create REPL session
            const repl = new REPLSession(db, providerRouter, agentRegistry, commandRegistry, {
                prompt: options.prompt,
                userId: options.user,
                enableAutocomplete: options.autocomplete !== false,
                contextSaveInterval: parseInt(options.saveInterval)
            });
            // Start REPL
            await repl.start();
        }
        catch (error) {
            console.error(chalk.red('\n❌ Failed to start interactive CLI:'));
            console.error(chalk.red(error.message));
            if (error.stack) {
                console.error(chalk.gray('\nStack trace:'));
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
    return cmd;
}
/**
 * Register custom slash commands for refinement features
 */
function registerSlashCommands(registry, learningSystem, iterateHandler) {
    // /stats - Show intent learning statistics
    registry.register({
        name: 'stats',
        description: 'Show intent learning statistics',
        usage: '/stats',
        aliases: ['statistics', 'learning'],
        execute: async () => {
            learningSystem.displayStatistics();
        }
    });
    // /strategies - List available iterate strategies
    registry.register({
        name: 'strategies',
        description: 'List all available iterate strategies',
        usage: '/strategies',
        aliases: ['strategy', 'strats'],
        execute: async () => {
            iterateHandler.listStrategies();
        }
    });
    // /telemetry - Show strategy telemetry
    registry.register({
        name: 'telemetry',
        description: 'Show strategy effectiveness telemetry',
        usage: '/telemetry',
        aliases: ['metrics', 'analytics'],
        execute: async () => {
            iterateHandler.displayTelemetry();
        }
    });
    // /iterate <task> - Run iterate mode
    registry.register({
        name: 'iterate',
        description: 'Execute task with iterate mode',
        usage: '/iterate <task description>',
        aliases: ['retry', 'auto'],
        execute: async (args) => {
            if (args.length === 0) {
                console.log(chalk.yellow('\n⚠ Usage: /iterate <task description>\n'));
                console.log(chalk.gray('Example: /iterate Implement user authentication with JWT\n'));
                return;
            }
            const taskDescription = args.join(' ');
            await iterateHandler.execute(taskDescription, {
                maxIterations: 10,
                verbose: true
            });
        }
    });
    // /strategy-stats <name> - Show specific strategy statistics
    registry.register({
        name: 'strategy-stats',
        description: 'Show statistics for a specific strategy',
        usage: '/strategy-stats <strategy-name>',
        aliases: ['strat-stats'],
        execute: async (args) => {
            if (args.length === 0) {
                console.log(chalk.yellow('\n⚠ Usage: /strategy-stats <strategy-name>\n'));
                return;
            }
            const strategyName = args.join('-');
            iterateHandler.displayStrategyStats(strategyName);
        }
    });
    // /clear-corrections - Clear intent corrections
    registry.register({
        name: 'clear-corrections',
        description: 'Clear all intent learning corrections',
        usage: '/clear-corrections',
        aliases: ['reset-learning'],
        execute: async () => {
            learningSystem.clearCorrections();
        }
    });
}
//# sourceMappingURL=interactive.js.map