// Sprint 2 Day 13: Config Show Command Handler
// Handler for `ax config show [key]` CLI command
import { ConfigShowSchema } from '../schemas/ConfigShowSchema.js';
import { errorHandler, NotFoundError, ErrorCodes } from '../../utils/ErrorEnvelope.js';
import { StreamingLogger } from '../../utils/StreamingLogger.js';
/**
 * Configuration display handler
 *
 * @param rawArgs - Raw command arguments
 * @returns Promise<void>
 */
export async function configShowCommand(rawArgs) {
    const logger = new StreamingLogger({ minLevel: 'info' });
    try {
        // 1. Validate inputs
        logger.debug('Validating command arguments...');
        const args = ConfigShowSchema.parse(rawArgs);
        if (args.verbose) {
            logger.setMinLevel('debug');
        }
        // 2. Load configuration
        logger.debug('Loading configuration...');
        // const configService = new ConfigService()
        // const config = await configService.load()
        // Mock config for now
        const config = await mockLoadConfig(logger);
        // 3. Handle specific key request
        if (args.key) {
            logger.debug(`Looking up config key: ${args.key}`);
            const value = getNestedValue(config, args.key);
            if (value === undefined) {
                throw new NotFoundError(`Config key "${args.key}" not found`, ErrorCodes.CONFIG_NOT_FOUND, [
                    'Run `ax config show` to see all available keys',
                    'Check for typos in the key name',
                    'Use dot notation for nested keys (e.g., providers.claude.enabled)',
                ]);
            }
            // Display single key
            if (args.format === 'json' || args.json) {
                console.log(JSON.stringify({ [args.key]: value }, null, 2));
            }
            else {
                console.log(`${args.key} = ${JSON.stringify(value, null, 2)}`);
            }
            if (args.showSources) {
                console.log('\nSource: automatosx.config.json');
            }
            return;
        }
        // 4. Filter by category if specified
        let displayConfig = config;
        if (args.category !== 'all') {
            logger.debug(`Filtering by category: ${args.category}`);
            displayConfig = { [args.category]: config[args.category] || {} };
        }
        // 5. Display full configuration
        if (args.format === 'json' || args.json) {
            console.log(JSON.stringify(displayConfig, null, 2));
        }
        else if (args.format === 'yaml') {
            printYamlConfig(displayConfig);
        }
        else {
            printTextConfig(displayConfig, args.showDefaults, args.showSources);
        }
    }
    catch (error) {
        await errorHandler(error, {
            debug: rawArgs?.debug,
            json: rawArgs?.json,
        });
    }
}
/**
 * Mock configuration loading
 */
async function mockLoadConfig(logger) {
    logger.debug('Reading automatosx.config.json...');
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
        providers: {
            claude: {
                enabled: true,
                priority: 1,
                apiKey: '***hidden***',
            },
            gemini: {
                enabled: true,
                priority: 2,
                apiKey: '***hidden***',
            },
            openai: {
                enabled: false,
                priority: 3,
                apiKey: null,
            },
        },
        execution: {
            defaultTimeout: 1500000,
            maxRetries: 3,
            parallelEnabled: true,
        },
        memory: {
            enabled: true,
            maxEntries: 10000,
            dbPath: '.automatosx/memory/memories.db',
        },
        agents: {
            autoReload: true,
            catalogPath: '.automatosx/agents/',
        },
        performance: {
            enableCache: true,
            cacheMaxSize: 1000,
            cacheTTL: 300000,
        },
    };
}
/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}
/**
 * Print configuration in YAML-like format
 */
function printYamlConfig(config, indent = 0) {
    const spaces = '  '.repeat(indent);
    Object.entries(config).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            console.log(`${spaces}${key}:`);
            printYamlConfig(value, indent + 1);
        }
        else {
            console.log(`${spaces}${key}: ${JSON.stringify(value)}`);
        }
    });
}
/**
 * Print configuration in text format with hierarchy
 */
function printTextConfig(config, showDefaults, showSources) {
    console.log('\n=== AutomatosX Configuration ===\n');
    printConfigTree(config, 0);
    if (showSources) {
        console.log('\nConfiguration Sources:');
        console.log('  1. automatosx.config.json (project root)');
        console.log('  2. Environment variables (AUTOMATOSX_*)');
        console.log('  3. Default values (built-in)\n');
    }
}
/**
 * Print configuration tree
 */
function printConfigTree(obj, level) {
    const indent = '  '.repeat(level);
    Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            console.log(`${indent}${key}/`);
            printConfigTree(value, level + 1);
        }
        else {
            const displayValue = typeof value === 'string' && value.includes('***')
                ? value
                : JSON.stringify(value);
            console.log(`${indent}${key}: ${displayValue}`);
        }
    });
}
//# sourceMappingURL=configShowCommand.js.map