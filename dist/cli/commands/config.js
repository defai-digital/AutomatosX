/**
 * config.ts
 *
 * CLI command to manage AutomatosX configuration
 * Subcommands: show, validate, init, reset
 */
import { Command } from 'commander';
import { ConfigLoader } from '../../services/ConfigLoader.js';
import { AutomatosXConfigSchema } from '../../types/Config.js';
import Table from 'cli-table3';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
/**
 * Default configuration file path
 */
const DEFAULT_CONFIG_PATH = '.automatosx/config.json';
/**
 * Pretty print configuration as JSON
 */
function prettyPrintConfig(config) {
    console.log(chalk.bold('\n⚙️  AutomatosX Configuration\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(JSON.stringify(config, null, 2));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
}
/**
 * Display configuration as formatted table
 */
function displayConfigTable(config) {
    console.log(chalk.bold('\n⚙️  AutomatosX Configuration\n'));
    // General Settings
    const generalTable = new Table({
        head: [chalk.cyan('Setting'), chalk.cyan('Value')],
        colWidths: [30, 40],
    });
    generalTable.push(['Version', chalk.yellow(config.version)], ['Database Path', chalk.gray(config.database.path)], ['WAL Mode', config.database.wal ? chalk.green('enabled') : chalk.red('disabled')], ['Cache Enabled', config.performance.enableCache ? chalk.green('yes') : chalk.red('no')], ['Cache Max Size', chalk.blue(config.performance.cacheMaxSize.toLocaleString())], ['Log Level', chalk.magenta(config.logging.level)]);
    console.log(chalk.bold('General Settings:'));
    console.log(generalTable.toString());
    // Languages
    console.log(chalk.bold('\nSupported Languages:'));
    const langTable = new Table({
        head: [chalk.cyan('Language'), chalk.cyan('Status')],
        colWidths: [20, 15],
    });
    Object.entries(config.languages).forEach(([lang, langConfig]) => {
        langTable.push([
            lang,
            langConfig.enabled ? chalk.green('enabled') : chalk.red('disabled')
        ]);
    });
    console.log(langTable.toString());
    // Search Settings
    console.log(chalk.bold('\nSearch Settings:'));
    const searchTable = new Table({
        head: [chalk.cyan('Setting'), chalk.cyan('Value')],
        colWidths: [30, 20],
    });
    searchTable.push(['Default Limit', chalk.yellow(config.search.defaultLimit)], ['Max Limit', chalk.yellow(config.search.maxLimit)], ['Symbol Search', config.search.enableSymbolSearch ? chalk.green('enabled') : chalk.red('disabled')], ['Natural Search', config.search.enableNaturalSearch ? chalk.green('enabled') : chalk.red('disabled')], ['Hybrid Search', config.search.enableHybridSearch ? chalk.green('enabled') : chalk.red('disabled')], ['Symbol Match Threshold', chalk.blue(config.search.symbolMatchThreshold.toFixed(2))], ['Hybrid Symbol Weight', chalk.blue(config.search.hybridSymbolWeight.toFixed(2))]);
    console.log(searchTable.toString());
    // Indexing Settings
    console.log(chalk.bold('\nIndexing Settings:'));
    const indexTable = new Table({
        head: [chalk.cyan('Setting'), chalk.cyan('Value')],
        colWidths: [30, 40],
    });
    indexTable.push(['Chunk Size', chalk.yellow(config.indexing.chunkSize)], ['Chunk Overlap', chalk.yellow(config.indexing.chunkOverlap)], ['Max File Size', chalk.blue(`${(config.indexing.maxFileSize / 1024 / 1024).toFixed(2)} MB`)], ['Follow Symlinks', config.indexing.followSymlinks ? chalk.green('yes') : chalk.red('no')], ['Respect .gitignore', config.indexing.respectGitignore ? chalk.green('yes') : chalk.red('no')], ['Exclude Patterns', chalk.gray(config.indexing.excludePatterns.slice(0, 3).join(', ') + '...')]);
    console.log(indexTable.toString());
    console.log();
}
/**
 * Create config show subcommand
 */
function createShowCommand() {
    return new Command('show')
        .description('Display current configuration')
        .option('-p, --path <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
        .option('-j, --json', 'Output as JSON')
        .action(async (options) => {
        try {
            const configLoader = new ConfigLoader();
            const { config } = configLoader.load(options.path !== DEFAULT_CONFIG_PATH ? options.path : undefined);
            if (options.json) {
                prettyPrintConfig(config);
            }
            else {
                displayConfigTable(config);
            }
            console.log(chalk.green('✓ Configuration loaded successfully'));
        }
        catch (error) {
            console.error(chalk.red('✗ Failed to load configuration:'), error);
            process.exit(1);
        }
    });
}
/**
 * Create config validate subcommand
 */
function createValidateCommand() {
    return new Command('validate')
        .description('Validate configuration file')
        .option('-p, --path <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
        .action(async (options) => {
        try {
            console.log(chalk.bold('\n🔍 Validating configuration...\n'));
            const configLoader = new ConfigLoader();
            const { config } = configLoader.load(options.path !== DEFAULT_CONFIG_PATH ? options.path : undefined);
            // Validate against schema
            const result = AutomatosXConfigSchema.safeParse(config);
            if (result.success) {
                console.log(chalk.green('✓ Configuration is valid'));
                console.log(chalk.gray(`  File: ${options.path}`));
                console.log(chalk.gray(`  Version: ${config.version}`));
                console.log(chalk.gray(`  Languages: ${Object.keys(config.languages).length}`));
                console.log();
            }
            else {
                console.log(chalk.red('✗ Configuration validation failed:\n'));
                result.error.issues.forEach((err) => {
                    console.log(chalk.red(`  • ${err.path.join('.')}: ${err.message}`));
                });
                console.log();
                process.exit(1);
            }
        }
        catch (error) {
            console.error(chalk.red('✗ Failed to validate configuration:'), error);
            process.exit(1);
        }
    });
}
/**
 * Create config init subcommand
 */
function createInitCommand() {
    return new Command('init')
        .description('Initialize a new configuration file')
        .option('-p, --path <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
        .option('-f, --force', 'Overwrite existing configuration')
        .action(async (options) => {
        try {
            console.log(chalk.bold('\n📝 Initializing configuration...\n'));
            // Check if config already exists
            if (existsSync(options.path) && !options.force) {
                console.error(chalk.red(`✗ Configuration file already exists: ${options.path}`));
                console.log(chalk.gray('  Use --force to overwrite'));
                console.log();
                process.exit(1);
            }
            // Get default configuration
            const defaultConfig = AutomatosXConfigSchema.parse({});
            // Create directory if needed
            const dir = dirname(options.path);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            // Write configuration file
            writeFileSync(options.path, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            console.log(chalk.green('✓ Configuration file created'));
            console.log(chalk.gray(`  Path: ${options.path}`));
            console.log(chalk.gray(`  Version: ${defaultConfig.version}`));
            console.log();
            // Display key settings
            console.log(chalk.bold('Key Settings:'));
            console.log(chalk.gray(`  • Database: ${defaultConfig.database.path}`));
            console.log(chalk.gray(`  • Languages: ${Object.keys(defaultConfig.languages).filter(k => defaultConfig.languages[k].enabled).join(', ')}`));
            console.log(chalk.gray(`  • Cache: ${defaultConfig.performance.enableCache ? 'enabled' : 'disabled'}`));
            console.log();
            console.log(chalk.blue('ℹ  Edit the configuration file to customize settings'));
            console.log(chalk.blue(`ℹ  Run 'ax config validate' to verify your changes`));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('✗ Failed to initialize configuration:'), error);
            process.exit(1);
        }
    });
}
/**
 * Create config reset subcommand
 */
function createResetCommand() {
    return new Command('reset')
        .description('Reset configuration to defaults')
        .option('-p, --path <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
        .option('-y, --yes', 'Skip confirmation')
        .action(async (options) => {
        try {
            console.log(chalk.bold('\n⚠️  Reset Configuration\n'));
            if (!existsSync(options.path)) {
                console.error(chalk.red(`✗ Configuration file not found: ${options.path}`));
                console.log(chalk.gray('  Run \'ax config init\' to create a new configuration'));
                console.log();
                process.exit(1);
            }
            if (!options.yes) {
                console.log(chalk.yellow('This will reset your configuration to defaults.'));
                console.log(chalk.yellow('All custom settings will be lost.'));
                console.log();
                console.log(chalk.gray('Use --yes to skip this confirmation'));
                console.log();
                console.error(chalk.red('✗ Cancelled (use --yes to confirm)'));
                process.exit(1);
            }
            // Get default configuration
            const defaultConfig = AutomatosXConfigSchema.parse({});
            // Write configuration file
            writeFileSync(options.path, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            console.log(chalk.green('✓ Configuration reset to defaults'));
            console.log(chalk.gray(`  Path: ${options.path}`));
            console.log(chalk.gray(`  Version: ${defaultConfig.version}`));
            console.log();
        }
        catch (error) {
            console.error(chalk.red('✗ Failed to reset configuration:'), error);
            process.exit(1);
        }
    });
}
/**
 * Create config command with subcommands
 */
export function createConfigCommand() {
    const command = new Command('config')
        .description('Manage AutomatosX configuration')
        .addCommand(createShowCommand())
        .addCommand(createValidateCommand())
        .addCommand(createInitCommand())
        .addCommand(createResetCommand());
    return command;
}
//# sourceMappingURL=config.js.map