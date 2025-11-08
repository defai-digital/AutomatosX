#!/usr/bin/env node
/**
 * index.ts
 *
 * AutomatosX v2 CLI Entry Point
 * Main command-line interface for code intelligence
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { createFindCommand } from './commands/find.js';
import { createDefCommand } from './commands/def.js';
import { createFlowCommand } from './commands/flow.js';
import { createLintCommand } from './commands/lint.js';
import { createIndexCommand } from './commands/index.js';
import { createWatchCommand } from './commands/watch.js';
import { createStatusCommand } from './commands/status.js';
import { createConfigCommand } from './commands/config.js';
import { createTelemetryCommand } from './commands/telemetry.js';
import { checkTelemetryConsent } from '../utils/telemetryConsent.js';
import { getTelemetryService } from '../services/TelemetryService.js';
// Read package.json for version
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
// Initialize telemetry (async wrapper for top-level await alternative)
async function initializeTelemetry() {
    try {
        // Check if user needs to configure telemetry (first run)
        // Skip for help, version, and telemetry commands
        const command = process.argv[2];
        const skipConsent = !command || command === '-h' || command === '--help' ||
            command === '-v' || command === '--version' ||
            command === 'telemetry';
        if (!skipConsent) {
            await checkTelemetryConsent();
        }
        // Initialize telemetry service
        const service = getTelemetryService();
        await service.initialize();
    }
    catch (error) {
        // Silent failure - telemetry should never break the CLI
        console.debug('Telemetry initialization failed:', error);
    }
}
// Create main program
const program = new Command();
program
    .name('ax')
    .description(chalk.bold('AutomatosX v2 - Code Intelligence CLI'))
    .version(packageJson.version, '-v, --version', 'Output the current version');
// Add commands
program.addCommand(createFindCommand());
program.addCommand(createDefCommand());
program.addCommand(createFlowCommand());
program.addCommand(createLintCommand());
program.addCommand(createIndexCommand());
program.addCommand(createWatchCommand());
program.addCommand(createStatusCommand());
program.addCommand(createConfigCommand());
program.addCommand(createTelemetryCommand());
// Main execution
(async () => {
    try {
        // Initialize telemetry first
        await initializeTelemetry();
        // Show help if no command provided
        if (process.argv.length === 2) {
            program.outputHelp();
            process.exit(0);
        }
        // Parse arguments
        program.parse(process.argv);
    }
    catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }
})();
//# sourceMappingURL=index.js.map