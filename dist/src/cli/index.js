#!/usr/bin/env node
/**
 * Copyright 2025 DEFAI Private Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * index.ts
 *
 * AutomatosX CLI Entry Point
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
import { createAnalyzeCommand } from './commands/analyze.js';
import { createMemoryCommand } from './commands/memory.js';
import { createProviderCommand } from './commands/provider.js';
import { createMonitorCommand } from './commands/monitor.js';
import { createWorkflowCommand } from './commands/workflow.js';
import { createQueueCommand } from './commands/queue.js';
import { registerAgentCommands } from './commands/agent.js';
import { registerSpecKitCommands } from './commands/speckit.js';
import { createGenCommands } from './commands/gen.js';
import { launchCLI } from './commands/cli.js';
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
    .description(chalk.bold('AutomatosX - Code Intelligence CLI'))
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
program.addCommand(createAnalyzeCommand());
program.addCommand(createMemoryCommand());
program.addCommand(createProviderCommand());
program.addCommand(createMonitorCommand());
program.addCommand(createWorkflowCommand());
program.addCommand(createQueueCommand());
// Add interactive CLI command
program
    .command('cli')
    .description('Launch interactive CLI mode')
    .action(async () => {
    await launchCLI();
});
// Register agent system commands (Phase 7)
registerAgentCommands(program);
// Register SpecKit commands (Week 3)
registerSpecKitCommands(program);
// Register Gen commands (Week 3-4 Day 2)
program.addCommand(createGenCommands());
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