/**
 * SpecKit CLI Command
 *
 * Generates documentation and specifications from codebases:
 * - ax speckit adr - Generate Architectural Decision Records
 * - ax speckit prd - Generate Product Requirements Documents
 * - ax speckit api - Generate OpenAPI/Swagger specifications
 * - ax speckit test - Generate Test specifications
 * - ax speckit migration - Generate Migration guides
 */
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import { ADRGenerator } from '../../speckit/ADRGenerator.js';
import { PRDGenerator } from '../../speckit/PRDGenerator.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import { MemoryService } from '../../memory/MemoryService.js';
import { SpecGenerator } from '../../speckit/generators/SpecGenerator.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';
import { getDatabase } from '../../database/connection.js';
/**
 * Create default provider router configuration
 */
function createProviderRouter() {
    return new ProviderRouterV2({
        providers: {
            claude: {
                enabled: true,
                priority: 1,
                apiKey: process.env.ANTHROPIC_API_KEY || '',
                maxRetries: 3,
                timeout: 30000,
                defaultModel: 'claude-opus-4-20250514',
            },
            gemini: {
                enabled: true,
                priority: 2,
                apiKey: process.env.GOOGLE_API_KEY || '',
                maxRetries: 2,
                timeout: 30000,
            },
            openai: {
                enabled: true,
                priority: 3,
                apiKey: process.env.OPENAI_API_KEY || '',
                maxRetries: 2,
                timeout: 30000,
            },
        },
    });
}
/**
 * Register SpecKit commands
 */
export function registerSpecKitCommands(program) {
    const speckit = program
        .command('speckit')
        .description('Generate documentation and specifications from codebase');
    // Spec Generator (Week 3-4 - Natural Language to YAML Workflow)
    speckit
        .command('spec')
        .description('Generate workflow specification from natural language')
        .argument('<description>', 'Natural language task description')
        .option('-o, --output <path>', 'Output directory', 'workflows')
        .option('-n, --name <name>', 'Project name (optional)')
        .option('--agents <agents>', 'Restrict to specific agents (comma-separated)')
        .option('--max-steps <number>', 'Maximum number of steps', parseInt)
        .option('--no-retry', 'Exclude retry configuration')
        .option('--include-cost', 'Include cost estimates in metadata')
        .option('-v, --verbose', 'Verbose output')
        .action(async (description, options) => {
        const spinner = ora('Initializing SpecKit...').start();
        try {
            // Initialize dependencies
            const providerRouter = createProviderRouter();
            const agentRegistry = new AgentRegistry();
            const workflowParser = new WorkflowParser();
            const generator = new SpecGenerator(providerRouter, agentRegistry, workflowParser);
            spinner.succeed('SpecKit initialized');
            // Parse options
            const specOptions = {
                outputPath: options.output,
                projectName: options.name,
                agents: options.agents ? options.agents.split(',').map((a) => a.trim()) : undefined,
                maxSteps: options.maxSteps,
                includeRetry: options.retry !== false,
                includeCost: options.includeCost === true,
                verbose: options.verbose === true,
            };
            // Show configuration
            if (specOptions.verbose) {
                console.log(chalk.cyan('\n📋 Configuration:'));
                console.log(chalk.gray(`   Description: ${description}`));
                console.log(chalk.gray(`   Output: ${specOptions.outputPath}`));
                if (specOptions.projectName) {
                    console.log(chalk.gray(`   Project: ${specOptions.projectName}`));
                }
                if (specOptions.agents) {
                    console.log(chalk.gray(`   Agents: ${specOptions.agents.join(', ')}`));
                }
                if (specOptions.maxSteps) {
                    console.log(chalk.gray(`   Max Steps: ${specOptions.maxSteps}`));
                }
            }
            const generationSpinner = ora('Generating workflow specification...').start();
            // Generate spec
            const result = await generator.generateSpec(description, specOptions);
            generationSpinner.succeed('Workflow specification generated!');
            // Display results
            console.log(chalk.green('\n✅ Workflow Spec Generated Successfully!\n'));
            console.log(chalk.cyan('📄 Output:'));
            console.log(chalk.white(`   File: ${chalk.bold(result.outputPath)}`));
            console.log(chalk.white(`   Name: ${chalk.bold(result.definition.name)}`));
            console.log(chalk.white(`   Version: ${result.definition.version}`));
            console.log(chalk.cyan('\n📊 Metadata:'));
            console.log(chalk.white(`   Steps: ${chalk.yellow(result.metadata.stepsCount)}`));
            console.log(chalk.white(`   Agents: ${chalk.yellow(result.metadata.agentsUsed.join(', '))}`));
            console.log(chalk.white(`   Complexity: ${formatComplexity(result.metadata.complexity)}`));
            console.log(chalk.white(`   Est. Duration: ${chalk.yellow(formatDuration(result.metadata.estimatedDuration))}`));
            if (specOptions.includeCost) {
                console.log(chalk.white(`   Est. Cost: ${chalk.yellow('$' + result.metadata.estimatedCost.toFixed(4))}`));
            }
            // Show step overview
            console.log(chalk.cyan('\n📝 Steps Overview:'));
            for (let i = 0; i < result.definition.steps.length; i++) {
                const step = result.definition.steps[i];
                const stepNum = chalk.gray(`${(i + 1).toString().padStart(2, ' ')}.`);
                const stepName = chalk.white(step.name);
                const agentName = chalk.blue(`[${step.agent}]`);
                console.log(`   ${stepNum} ${stepName} ${agentName}`);
                if (step.dependsOn && step.dependsOn.length > 0) {
                    console.log(chalk.gray(`       ↳ Depends on: ${step.dependsOn.join(', ')}`));
                }
            }
            console.log(chalk.cyan('\n💡 Next Steps:'));
            console.log(chalk.white(`   1. Review: ${chalk.bold(result.outputPath)}`));
            console.log(chalk.white(`   2. Execute: ${chalk.bold(`ax workflow run ${result.outputPath}`)}`));
            console.log(chalk.white(`   3. Visualize: ${chalk.bold(`ax gen dag ${result.outputPath}`)}`));
            console.log();
        }
        catch (error) {
            spinner.fail('Generation failed');
            console.error(chalk.red('\n❌ Error:'), error.message);
            if (options.verbose && error instanceof Error && error.stack) {
                console.error(chalk.gray('\nStack trace:'));
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
    // ADR Generator
    speckit
        .command('adr')
        .description('Generate Architectural Decision Records (ADRs)')
        .option('-p, --pattern <pattern>', 'Specific pattern to document (e.g., "state-machine")')
        .option('-o, --output <path>', 'Output file path', 'docs/architecture/adr.md')
        .option('--examples', 'Include code examples in ADR', false)
        .option('--template <type>', 'ADR template (standard, y-statement, alexandrian)', 'standard')
        .option('--provider <provider>', 'AI provider (claude, gpt4, gemini)', 'claude')
        .option('--no-cache', 'Disable caching')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (options) => {
        const spinner = ora('Initializing ADR generation...').start();
        try {
            const generateOptions = {
                projectRoot: process.cwd(),
                outputPath: path.resolve(options.output),
                provider: options.provider,
                enableCache: options.cache !== false,
                verbose: options.verbose,
                pattern: options.pattern,
                // @ts-ignore - ADR-specific options
                includeExamples: options.examples,
                // @ts-ignore - ADR-specific options
                includeRationale: true,
                // @ts-ignore - ADR-specific options
                template: options.template,
            };
            // Initialize dependencies
            spinner.text = 'Initializing services...';
            const providerRouter = createProviderRouter();
            const memoryService = new MemoryService(getDatabase());
            // Create ADR generator
            const generator = new ADRGenerator(providerRouter, memoryService);
            // Generate with progress tracking
            const result = await generator.generate(generateOptions, (progress) => {
                spinner.text = progress.message || 'Generating...';
            });
            if (result.success) {
                spinner.succeed(chalk.green(`✅ ADR generated successfully!`));
                console.log(chalk.gray(`\nOutput: ${result.outputPath}`));
                const metadata = result.metadata;
                console.log(chalk.gray(`Patterns detected: ${metadata.patterns || 0}`));
                console.log(chalk.gray(`Files analyzed: ${metadata.files || 0}`));
                console.log(chalk.gray(`Generation time: ${result.metadata.generationTime}ms`));
                if (metadata.cached) {
                    console.log(chalk.yellow(`⚡ Result from cache`));
                }
                if (options.verbose) {
                    console.log(chalk.gray(`\nProvider: ${result.metadata.provider}`));
                    console.log(chalk.gray(`Cost: $${metadata.cost?.toFixed(4) || '0.0000'}`));
                }
            }
            else {
                spinner.fail(chalk.red('❌ ADR generation failed'));
                if (result.error) {
                    console.error(chalk.red(result.error));
                }
                process.exit(1);
            }
        }
        catch (error) {
            spinner.fail(chalk.red('❌ ADR generation failed'));
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            if (options.verbose && error instanceof Error && error.stack) {
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
    // PRD Generator
    speckit
        .command('prd')
        .description('Generate Product Requirements Document (PRD)')
        .option('-f, --feature <feature>', 'Specific feature to document')
        .option('-o, --output <path>', 'Output file path', 'docs/prd.md')
        .option('--architecture', 'Include technical architecture section', false)
        .option('--stories', 'Include user stories', false)
        .option('--metrics', 'Include success metrics', false)
        .option('--mockups', 'Include UI mockups section', false)
        .option('--audience <type>', 'Target audience (technical, business, mixed)', 'mixed')
        .option('--template <type>', 'PRD template (standard, lean, detailed)', 'standard')
        .option('--provider <provider>', 'AI provider (claude, gpt4, gemini)', 'claude')
        .option('--no-cache', 'Disable caching')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (options) => {
        const spinner = ora('Initializing PRD generation...').start();
        try {
            const generateOptions = {
                projectRoot: process.cwd(),
                outputPath: path.resolve(options.output),
                provider: options.provider,
                enableCache: options.cache !== false,
                verbose: options.verbose,
                feature: options.feature,
                // @ts-ignore - PRD-specific options
                includeArchitecture: options.architecture,
                // @ts-ignore - PRD-specific options
                includeUserStories: options.stories,
                // @ts-ignore - PRD-specific options
                includeMetrics: options.metrics,
                // @ts-ignore - PRD-specific options
                includeMockups: options.mockups,
                // @ts-ignore - PRD-specific options
                audience: options.audience,
                // @ts-ignore - PRD-specific options
                template: options.template,
            };
            // Initialize dependencies
            spinner.text = 'Initializing services...';
            const providerRouter = createProviderRouter();
            const memoryService = new MemoryService(getDatabase());
            // Create PRD generator
            const generator = new PRDGenerator(providerRouter, memoryService);
            // Generate with progress tracking
            const result = await generator.generate(generateOptions, (progress) => {
                spinner.text = progress.message || 'Generating...';
            });
            if (result.success) {
                spinner.succeed(chalk.green(`✅ PRD generated successfully!`));
                console.log(chalk.gray(`\nOutput: ${result.outputPath}`));
                const metadata = result.metadata;
                console.log(chalk.gray(`Features detected: ${metadata.patterns || 0}`));
                console.log(chalk.gray(`Files analyzed: ${metadata.files || 0}`));
                console.log(chalk.gray(`Generation time: ${result.metadata.generationTime}ms`));
                if (metadata.cached) {
                    console.log(chalk.yellow(`⚡ Result from cache`));
                }
                if (options.verbose) {
                    console.log(chalk.gray(`\nProvider: ${result.metadata.provider}`));
                    console.log(chalk.gray(`Template: ${options.template}`));
                    console.log(chalk.gray(`Audience: ${options.audience}`));
                    console.log(chalk.gray(`Cost: $${metadata.cost?.toFixed(4) || '0.0000'}`));
                }
            }
            else {
                spinner.fail(chalk.red('❌ PRD generation failed'));
                if (result.error) {
                    console.error(chalk.red(result.error));
                }
                process.exit(1);
            }
        }
        catch (error) {
            spinner.fail(chalk.red('❌ PRD generation failed'));
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            if (options.verbose && error instanceof Error && error.stack) {
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    });
    // API Spec Generator
    speckit
        .command('api')
        .description('Generate OpenAPI/Swagger API specification')
        .option('-f, --framework <framework>', 'API framework (express, fastify, etc.)')
        .option('-o, --output <path>', 'Output file path', 'docs/api/openapi.yaml')
        .option('--version <version>', 'OpenAPI version (3.0, 3.1)', '3.1')
        .option('--examples', 'Include example requests/responses', false)
        .option('--base-url <url>', 'Base URL for API')
        .option('--provider <provider>', 'AI provider (claude, gpt4, gemini)', 'claude')
        .option('--no-cache', 'Disable caching')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (options) => {
        try {
            console.log(chalk.blue('🔌 Generating API Specification...'));
            const generateOptions = {
                projectRoot: process.cwd(),
                outputPath: path.resolve(options.output),
                provider: options.provider,
                enableCache: options.cache !== false,
                verbose: options.verbose,
                // @ts-ignore - API-specific options
                framework: options.framework,
                // @ts-ignore - API-specific options
                openApiVersion: options.version,
                // @ts-ignore - API-specific options
                includeExamples: options.examples,
                // @ts-ignore - API-specific options
                baseUrl: options.baseUrl,
            };
            // TODO: Implement APISpecGenerator
            console.log(chalk.yellow('⚠️  APISpecGenerator not yet implemented'));
            console.log(chalk.gray(`Will generate: ${generateOptions.outputPath}`));
            console.log(chalk.gray(`Framework: ${options.framework || 'auto-detect'}`));
            console.log(chalk.gray(`OpenAPI Version: ${options.version}`));
            console.log(chalk.gray(`Provider: ${generateOptions.provider}`));
        }
        catch (error) {
            console.error(chalk.red('❌ API spec generation failed:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    // Test Spec Generator
    speckit
        .command('test')
        .description('Generate Test specification document')
        .option('-f, --framework <framework>', 'Test framework (vitest, jest, etc.)')
        .option('-o, --output <path>', 'Output file path', 'docs/testing/test-spec.md')
        .option('--coverage', 'Include coverage report', false)
        .option('--type <type>', 'Test type (unit, integration, e2e, all)', 'all')
        .option('--provider <provider>', 'AI provider (claude, gpt4, gemini)', 'claude')
        .option('--no-cache', 'Disable caching')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (options) => {
        try {
            console.log(chalk.blue('🧪 Generating Test Specification...'));
            const generateOptions = {
                projectRoot: process.cwd(),
                outputPath: path.resolve(options.output),
                provider: options.provider,
                enableCache: options.cache !== false,
                verbose: options.verbose,
                // @ts-ignore - Test-specific options
                framework: options.framework,
                // @ts-ignore - Test-specific options
                includeCoverage: options.coverage,
                // @ts-ignore - Test-specific options
                testType: options.type,
            };
            // TODO: Implement TestSpecGenerator
            console.log(chalk.yellow('⚠️  TestSpecGenerator not yet implemented'));
            console.log(chalk.gray(`Will generate: ${generateOptions.outputPath}`));
            console.log(chalk.gray(`Framework: ${options.framework || 'auto-detect'}`));
            console.log(chalk.gray(`Type: ${options.type}`));
            console.log(chalk.gray(`Provider: ${generateOptions.provider}`));
        }
        catch (error) {
            console.error(chalk.red('❌ Test spec generation failed:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    // Migration Guide Generator
    speckit
        .command('migration')
        .description('Generate Migration guide between versions')
        .requiredOption('--from <version>', 'Source version')
        .requiredOption('--to <version>', 'Target version')
        .option('-o, --output <path>', 'Output file path', 'docs/migration.md')
        .option('--breaking', 'Include breaking changes section', true)
        .option('--examples', 'Include code migration examples', true)
        .option('--provider <provider>', 'AI provider (claude, gpt4, gemini)', 'claude')
        .option('--no-cache', 'Disable caching')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (options) => {
        try {
            console.log(chalk.blue('🔄 Generating Migration Guide...'));
            const generateOptions = {
                projectRoot: process.cwd(),
                outputPath: path.resolve(options.output),
                provider: options.provider,
                enableCache: options.cache !== false,
                verbose: options.verbose,
                // @ts-ignore - Migration-specific options
                fromVersion: options.from,
                // @ts-ignore - Migration-specific options
                toVersion: options.to,
                // @ts-ignore - Migration-specific options
                includeBreakingChanges: options.breaking,
                // @ts-ignore - Migration-specific options
                includeCodeExamples: options.examples,
            };
            // TODO: Implement MigrationGuideGenerator
            console.log(chalk.yellow('⚠️  MigrationGuideGenerator not yet implemented'));
            console.log(chalk.gray(`Will generate: ${generateOptions.outputPath}`));
            console.log(chalk.gray(`Migration: ${options.from} → ${options.to}`));
            console.log(chalk.gray(`Provider: ${generateOptions.provider}`));
        }
        catch (error) {
            console.error(chalk.red('❌ Migration guide generation failed:'), error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });
    // List command
    speckit
        .command('list')
        .description('List all available SpecKit generators')
        .action(() => {
        console.log(chalk.bold.blue('\n📋 Available SpecKit Generators:\n'));
        console.log(chalk.cyan('  adr') + '        - Generate Architectural Decision Records');
        console.log(chalk.cyan('  prd') + '        - Generate Product Requirements Documents');
        console.log(chalk.cyan('  api') + '        - Generate OpenAPI/Swagger specifications');
        console.log(chalk.cyan('  test') + '       - Generate Test specifications');
        console.log(chalk.cyan('  migration') + '  - Generate Migration guides');
        console.log(chalk.gray('\nExample usage:'));
        console.log(chalk.gray('  ax speckit adr --pattern state-machine'));
        console.log(chalk.gray('  ax speckit prd --feature authentication'));
        console.log(chalk.gray('  ax speckit api --framework express'));
        console.log(chalk.gray('  ax speckit test --type unit'));
        console.log(chalk.gray('  ax speckit migration --from 1.0.0 --to 2.0.0'));
        console.log();
    });
}
/**
 * Format complexity with color coding
 */
function formatComplexity(complexity) {
    switch (complexity) {
        case 'low':
            return chalk.green('Low');
        case 'medium':
            return chalk.yellow('Medium');
        case 'high':
            return chalk.red('High');
    }
}
/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    else if (ms < 3600000) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    else {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
}
//# sourceMappingURL=speckit.js.map