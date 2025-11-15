/**
 * provider.ts
 *
 * CLI commands for AI provider management, health checks, and statistics.
 *
 * Phase 2 Week 3 Day 12: Provider CLI Commands
 */
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { ProviderService } from '../../services/ProviderService.js';
const providerService = new ProviderService();
/**
 * Create the provider command with subcommands
 */
export function createProviderCommand() {
    const provider = new Command('provider');
    provider
        .description('Manage AI providers (Claude, Gemini, OpenAI)')
        .addCommand(createHealthCommand())
        .addCommand(createStatsCommand())
        .addCommand(createLogsCommand())
        .addCommand(createCircuitBreakerCommand())
        .addCommand(createTestCommand());
    return provider;
}
/**
 * Health check command
 */
function createHealthCommand() {
    const health = new Command('health');
    health
        .description('Check health status of all providers')
        .option('-v, --verbose', 'Show detailed information')
        .action(async (options) => {
        const spinner = ora('Checking provider health...').start();
        try {
            const healthMap = await providerService.getProviderHealth();
            const circuitStates = providerService.getCircuitBreakerStates();
            spinner.stop();
            // Create health table
            const table = new Table({
                head: ['Provider', 'Status', 'Circuit Breaker', 'Failures'],
                style: { head: ['cyan'] },
            });
            for (const [provider, healthy] of healthMap) {
                const circuitState = circuitStates.get(provider);
                const status = healthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy');
                const circuit = circuitState
                    ? chalk[circuitState.state === 'closed' ? 'green' : circuitState.state === 'open' ? 'red' : 'yellow'](circuitState.state.toUpperCase())
                    : chalk.gray('Unknown');
                const failures = circuitState ? circuitState.failures.toString() : '-';
                table.push([provider, status, circuit, failures]);
            }
            console.log('\n' + table.toString() + '\n');
            if (options.verbose) {
                console.log(chalk.bold('Circuit Breaker Details:\n'));
                for (const [provider, state] of Object.entries(circuitStates)) {
                    console.log(chalk.cyan(`${provider}:`));
                    console.log(`  State: ${state.state}`);
                    console.log(`  Failures: ${state.failures}`);
                    console.log(`  Last Failure: ${state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : 'Never'}`);
                    console.log();
                }
            }
        }
        catch (error) {
            spinner.fail('Failed to check provider health');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
    return health;
}
/**
 * Statistics command
 */
function createStatsCommand() {
    const stats = new Command('stats');
    stats
        .description('Show provider usage statistics')
        .option('-t, --time <hours>', 'Time range in hours (default: 24)', '24')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        const spinner = ora('Fetching provider statistics...').start();
        try {
            const timeRangeMs = parseInt(options.time) * 60 * 60 * 1000;
            const stats = await providerService.getProviderStats(timeRangeMs);
            spinner.stop();
            if (options.json) {
                console.log(JSON.stringify(stats, null, 2));
                return;
            }
            // Create stats table
            const table = new Table({
                head: [
                    'Provider',
                    'Model',
                    'Requests',
                    'Success',
                    'Avg Duration',
                    'Total Tokens',
                    'Avg In/Out',
                ],
                style: { head: ['cyan'] },
            });
            for (const stat of stats) {
                const successRate = stat.total_requests > 0
                    ? ((stat.successful_requests / stat.total_requests) * 100).toFixed(1)
                    : '0.0';
                table.push([
                    stat.provider,
                    stat.model,
                    stat.total_requests.toString(),
                    chalk.green(`${successRate}%`),
                    `${Math.round(stat.avg_duration)}ms`,
                    stat.total_tokens.toLocaleString(),
                    `${Math.round(stat.avg_input_tokens)}/${Math.round(stat.avg_output_tokens)}`,
                ]);
            }
            console.log(chalk.bold(`\nProvider Statistics (Last ${options.time} hours)\n`));
            console.log(table.toString() + '\n');
            // Summary
            const totalRequests = stats.reduce((sum, s) => sum + s.total_requests, 0);
            const totalTokens = stats.reduce((sum, s) => sum + s.total_tokens, 0);
            console.log(chalk.bold('Summary:'));
            console.log(`  Total Requests: ${totalRequests.toLocaleString()}`);
            console.log(`  Total Tokens: ${totalTokens.toLocaleString()}`);
            console.log();
        }
        catch (error) {
            spinner.fail('Failed to fetch statistics');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
    return stats;
}
/**
 * Logs command
 */
function createLogsCommand() {
    const logs = new Command('logs');
    logs
        .description('Show recent provider request logs')
        .option('-n, --number <count>', 'Number of logs to show (default: 20)', '20')
        .option('-p, --provider <provider>', 'Filter by provider (claude|gemini|openai)')
        .option('--failed', 'Show only failed requests')
        .option('--json', 'Output as JSON')
        .action(async (options) => {
        const spinner = ora('Fetching provider logs...').start();
        try {
            let logs = await providerService.getRecentLogs(parseInt(options.number));
            // Apply filters
            if (options.provider) {
                logs = logs.filter((log) => log.provider === options.provider);
            }
            if (options.failed) {
                logs = logs.filter((log) => log.state === 'failed');
            }
            spinner.stop();
            if (options.json) {
                console.log(JSON.stringify(logs, null, 2));
                return;
            }
            // Create logs table
            const table = new Table({
                head: ['Time', 'Provider', 'Model', 'State', 'Duration', 'Tokens'],
                style: { head: ['cyan'] },
            });
            for (const log of logs) {
                const time = new Date(log.created_at).toLocaleTimeString();
                const state = log.state === 'completed'
                    ? chalk.green(log.state)
                    : log.state === 'failed'
                        ? chalk.red(log.state)
                        : chalk.yellow(log.state);
                const duration = log.duration ? `${log.duration}ms` : '-';
                // Parse response data to get tokens
                let tokens = '-';
                if (log.response_data) {
                    try {
                        const response = JSON.parse(log.response_data);
                        tokens = response.tokens ? response.tokens.total.toString() : '-';
                    }
                    catch {
                        // Ignore parse errors
                    }
                }
                table.push([time, log.provider, log.model, state, duration, tokens]);
            }
            console.log(chalk.bold('\nRecent Provider Logs\n'));
            console.log(table.toString() + '\n');
        }
        catch (error) {
            spinner.fail('Failed to fetch logs');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
    return logs;
}
/**
 * Circuit breaker command
 */
function createCircuitBreakerCommand() {
    const circuit = new Command('circuit');
    circuit
        .description('Manage circuit breakers')
        .command('status')
        .description('Show circuit breaker status')
        .action(() => {
        const states = providerService.getCircuitBreakerStates();
        const table = new Table({
            head: ['Provider', 'State', 'Failures', 'Last Failure'],
            style: { head: ['cyan'] },
        });
        for (const [provider, state] of Object.entries(states)) {
            const stateColor = state.state === 'closed'
                ? 'green'
                : state.state === 'open'
                    ? 'red'
                    : 'yellow';
            const lastFailure = state.lastFailureTime
                ? new Date(state.lastFailureTime).toLocaleString()
                : 'Never';
            table.push([
                provider,
                chalk[stateColor](state.state.toUpperCase()),
                state.failures.toString(),
                lastFailure,
            ]);
        }
        console.log('\n' + table.toString() + '\n');
    });
    circuit
        .command('reset <provider>')
        .description('Reset circuit breaker for a provider')
        .action((provider) => {
        try {
            providerService.resetCircuitBreaker(provider);
            console.log(chalk.green(`✓ Circuit breaker reset for ${provider}`));
        }
        catch (error) {
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
    return circuit;
}
/**
 * Test command
 */
function createTestCommand() {
    const test = new Command('test');
    test
        .description('Test a provider with a simple request')
        .argument('<provider>', 'Provider to test (claude|gemini|openai)')
        .option('-m, --model <model>', 'Model to use')
        .option('--stream', 'Test streaming')
        .action(async (provider, options) => {
        const spinner = ora(`Testing ${provider}...`).start();
        try {
            const request = {
                provider: provider,
                model: options.model,
                messages: [
                    {
                        role: 'user',
                        content: 'Say "test successful" if you can read this.',
                    },
                ],
                stream: options.stream || false,
                maxTokens: 50,
            };
            const startTime = Date.now();
            if (options.stream) {
                let chunks = 0;
                await providerService.sendStreamingRequest(request, {
                    onChunk: () => {
                        chunks++;
                    },
                });
                spinner.succeed(`${provider} streaming test successful (${chunks} chunks)`);
            }
            else {
                const response = await providerService.sendRequest(request);
                const duration = Date.now() - startTime;
                spinner.succeed(`${provider} test successful`);
                console.log(chalk.bold('\nResponse:'));
                console.log(`  Content: ${response.content}`);
                console.log(`  Model: ${response.model}`);
                console.log(`  Tokens: ${response.tokens.total}`);
                console.log(`  Duration: ${duration}ms`);
                console.log();
            }
        }
        catch (error) {
            spinner.fail(`${provider} test failed`);
            console.error(chalk.red('Error:'), error.message || error);
            process.exit(1);
        }
    });
    return test;
}
//# sourceMappingURL=provider.js.map