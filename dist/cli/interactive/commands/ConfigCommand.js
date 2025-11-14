/**
 * AutomatosX v8.0.0 - Config Command
 *
 * Show configuration settings
 */
import chalk from 'chalk';
/**
 * Config Command
 *
 * Displays current configuration
 */
export class ConfigCommand {
    name = 'config';
    description = 'Show configuration';
    usage = '/config [key]';
    aliases = ['cfg'];
    async execute(args, context) {
        const configKey = args[0];
        if (configKey) {
            // Show specific config value
            this.showSpecificConfig(configKey);
        }
        else {
            // Show all config
            this.showAllConfig(context);
        }
    }
    /**
     * Show all configuration
     */
    showAllConfig(context) {
        console.log(chalk.bold.cyan('\n⚙️  Configuration\n'));
        // User
        console.log(chalk.bold('User:'));
        console.log(`  ${chalk.gray('ID:')} ${context.userId}`);
        console.log();
        // Environment
        console.log(chalk.bold('Environment:'));
        console.log(`  ${chalk.gray('NODE_ENV:')} ${process.env.NODE_ENV || 'development'}`);
        console.log(`  ${chalk.gray('Platform:')} ${process.platform}`);
        console.log(`  ${chalk.gray('Arch:')} ${process.arch}`);
        console.log();
        // API Keys (masked)
        console.log(chalk.bold('API Keys:'));
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const googleKey = process.env.GOOGLE_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        console.log(`  ${chalk.gray('ANTHROPIC_API_KEY:')} ${anthropicKey ? this.maskKey(anthropicKey) : chalk.red('not set')}`);
        console.log(`  ${chalk.gray('GOOGLE_API_KEY:')} ${googleKey ? this.maskKey(googleKey) : chalk.red('not set')}`);
        console.log(`  ${chalk.gray('OPENAI_API_KEY:')} ${openaiKey ? this.maskKey(openaiKey) : chalk.red('not set')}`);
        console.log();
        // Context
        if (context.activeAgent || context.activeWorkflow || Object.keys(context.variables).length > 0) {
            console.log(chalk.bold('Context:'));
            if (context.activeAgent) {
                console.log(`  ${chalk.gray('Active Agent:')} ${context.activeAgent}`);
            }
            if (context.activeWorkflow) {
                console.log(`  ${chalk.gray('Active Workflow:')} ${context.activeWorkflow}`);
            }
            if (Object.keys(context.variables).length > 0) {
                console.log(`  ${chalk.gray('Variables:')} ${Object.keys(context.variables).length} set`);
            }
            console.log();
        }
        console.log(chalk.gray('Use /config <key> to show a specific configuration value\n'));
    }
    /**
     * Show specific configuration value
     */
    showSpecificConfig(key) {
        const value = process.env[key];
        console.log(chalk.bold.cyan(`\n⚙️  Configuration: ${key}\n`));
        if (value === undefined) {
            console.log(chalk.red(`  ✗ Not set\n`));
            return;
        }
        // Mask sensitive values
        const isSensitive = key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN');
        const displayValue = isSensitive ? this.maskKey(value) : value;
        console.log(chalk.green(`  ✓ ${displayValue}\n`));
    }
    /**
     * Mask API key for display
     */
    maskKey(key) {
        if (key.length <= 8) {
            return '****';
        }
        return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
    }
}
//# sourceMappingURL=ConfigCommand.js.map