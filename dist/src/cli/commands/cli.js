/**
 * AutomatosX v8.0.0 - Interactive CLI Command
 *
 * Launch the interactive REPL interface
 */
import chalk from 'chalk';
import { getDatabase } from '../../database/connection.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { REPLSession } from '../interactive/REPLSession.js';
import { SlashCommandRegistry } from '../interactive/SlashCommandRegistry.js';
import { HelpCommand } from '../interactive/commands/HelpCommand.js';
import { ExitCommand } from '../interactive/commands/ExitCommand.js';
import { ClearCommand } from '../interactive/commands/ClearCommand.js';
import { AgentsCommand } from '../interactive/commands/AgentsCommand.js';
import { StatusCommand } from '../interactive/commands/StatusCommand.js';
import { ConfigCommand } from '../interactive/commands/ConfigCommand.js';
import { ContextCommand } from '../interactive/commands/ContextCommand.js';
import { HistoryCommand } from '../interactive/commands/HistoryCommand.js';
import { AgentCommand } from '../interactive/commands/AgentCommand.js';
import { SaveCommand } from '../interactive/commands/SaveCommand.js';
import { LoadCommand } from '../interactive/commands/LoadCommand.js';
import { MemoryCommand } from '../interactive/commands/MemoryCommand.js';
import { WorkflowCommand } from '../interactive/commands/WorkflowCommand.js';
import { IntentLearningSystem } from '../interactive/IntentLearningSystem.js';
import { IterateModeHandler } from '../interactive/IterateModeHandler.js';
/**
 * Launch Interactive CLI
 */
export async function launchCLI() {
    try {
        console.log(chalk.cyan('\n🚀 Initializing AutomatosX Interactive CLI v8.0.0...\n'));
        // Initialize dependencies
        const db = getDatabase();
        console.log(chalk.green('✓ Database connected'));
        // Create provider router
        const providerRouter = new ProviderRouterV2({
            providers: {
                claude: {
                    enabled: true,
                    priority: 1,
                    apiKey: process.env.ANTHROPIC_API_KEY || '',
                    maxRetries: 3,
                    timeout: 30000
                },
                gemini: {
                    enabled: true,
                    priority: 2,
                    apiKey: process.env.GOOGLE_API_KEY || '',
                    maxRetries: 3,
                    timeout: 30000
                },
                openai: {
                    enabled: true,
                    priority: 3,
                    apiKey: process.env.OPENAI_API_KEY || '',
                    maxRetries: 3,
                    timeout: 30000
                }
            }
        });
        // Create agent registry
        const agentRegistry = new AgentRegistry();
        console.log(chalk.green('✓ Agent registry loaded'));
        // Create command registry
        const commandRegistry = new SlashCommandRegistry();
        // Initialize intent learning system (v8.0.0 refinement)
        const learningSystem = new IntentLearningSystem(db, process.env.USER || 'default-user');
        console.log(chalk.green('✓ Intent learning system ready'));
        // Initialize iterate mode handler (v8.0.0 refinement)
        const iterateHandler = new IterateModeHandler(db);
        console.log(chalk.green('✓ Iterate mode handler ready'));
        // Register built-in commands (Days 1-2)
        commandRegistry.register(new HelpCommand(commandRegistry));
        commandRegistry.register(new ExitCommand());
        commandRegistry.register(new ClearCommand());
        commandRegistry.register(new AgentsCommand());
        commandRegistry.register(new StatusCommand());
        commandRegistry.register(new ConfigCommand());
        // Create REPL session
        const repl = new REPLSession(db, providerRouter, agentRegistry, commandRegistry, {
            userId: process.env.USER || 'default-user'
        });
        // Get conversation context for commands that need it
        const conversationContext = repl.getConversationContext();
        // Register context-aware commands (Day 3)
        const contextCommand = new ContextCommand();
        contextCommand.setConversationContext(conversationContext);
        commandRegistry.register(contextCommand);
        const historyCommand = new HistoryCommand();
        historyCommand.setConversationContext(conversationContext);
        commandRegistry.register(historyCommand);
        const agentCommand = new AgentCommand();
        agentCommand.setConversationContext(conversationContext);
        commandRegistry.register(agentCommand);
        const saveCommand = new SaveCommand();
        saveCommand.setConversationContext(conversationContext);
        commandRegistry.register(saveCommand);
        const loadCommand = new LoadCommand();
        loadCommand.setConversationContext(conversationContext);
        commandRegistry.register(loadCommand);
        const workflowCommand = new WorkflowCommand();
        workflowCommand.setConversationContext(conversationContext);
        commandRegistry.register(workflowCommand);
        // Register delegated commands (don't need context)
        commandRegistry.register(new MemoryCommand());
        // Register v8.0.0 refinement commands
        registerRefinementCommands(commandRegistry, learningSystem, iterateHandler);
        console.log(chalk.green('✓ Refinement features registered\n'));
        // Start REPL
        await repl.start();
    }
    catch (error) {
        console.error(chalk.red('\n❌ Failed to start Interactive CLI:'), error.message);
        process.exit(1);
    }
}
/**
 * Register v8.0.0 refinement slash commands
 */
function registerRefinementCommands(registry, learningSystem, iterateHandler) {
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
//# sourceMappingURL=cli.js.map