/**
 * Gen CLI Commands
 *
 * Week 3-4 Implementation - Day 2
 * CLI commands for generating execution plans, DAGs, scaffolds, and tests
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { PlanGenerator } from '../../speckit/generators/PlanGenerator.js';
import { DAGGenerator } from '../../speckit/generators/DAGGenerator.js';
import { ScaffoldGenerator } from '../../speckit/generators/ScaffoldGenerator.js';
import { TestGenerator } from '../../speckit/generators/TestGenerator.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';
import type { PlanOptions, WorkflowDefinition, DAGFormat, DAGOptions, ScaffoldOptions, TestOptions } from '../../speckit/types/speckit.types.js';

/**
 * Create Gen command group
 */
export function createGenCommands(): Command {
  const gen = new Command('gen');
  gen.description('Generate execution plans, DAGs, and other artifacts');

  // Add subcommands
  gen.addCommand(createPlanCommand());
  gen.addCommand(createDAGCommand());
  gen.addCommand(createScaffoldCommand());
  gen.addCommand(createTestsCommand());

  return gen;
}

/**
 * Create 'gen plan' command
 */
function createPlanCommand(): Command {
  const cmd = new Command('plan');

  cmd
    .description('Generate execution plan from workflow specification')
    .argument('<workflow>', 'Path to workflow YAML file')
    .option('-o, --output <path>', 'Output directory', 'plans')
    .option('--include-cost', 'Include cost estimates', true)
    .option('--include-time', 'Include time estimates', true)
    .option('--include-resources', 'Include resource requirements', true)
    .option('--optimize <strategy>', 'Optimization strategy (speed, cost, balanced)', 'balanced')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (workflowPath: string, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        // Read workflow file
        const workflowContent = await fs.readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(workflowContent) as WorkflowDefinition;

        spinner.succeed(`Loaded workflow: ${workflow.name}`);

        // Initialize dependencies
        const workflowParser = new WorkflowParser();
        const generator = new PlanGenerator(workflowParser);

        // Parse options
        const planOptions: PlanOptions = {
          outputPath: options.output,
          format: 'markdown',
          includeCost: options.includeCost !== false,
          includeTime: options.includeTime !== false,
          includeResources: options.includeResources !== false,
          optimize: options.optimize as 'speed' | 'cost' | 'balanced',
          verbose: options.verbose === true,
        };

        if (planOptions.verbose) {
          console.log(chalk.cyan('\n📋 Plan Configuration:'));
          console.log(chalk.gray(`   Workflow: ${workflow.name} v${workflow.version}`));
          console.log(chalk.gray(`   Steps: ${workflow.steps.length}`));
          console.log(chalk.gray(`   Output: ${planOptions.outputPath}`));
          console.log(chalk.gray(`   Optimize: ${planOptions.optimize}`));
        }

        const generationSpinner = ora('Generating execution plan...').start();

        // Generate plan
        const plan = await generator.generatePlan(workflow, planOptions);

        generationSpinner.succeed('Execution plan generated!');

        // Write plan to file
        const outputPath = await generator.writePlan(plan, workflow, planOptions);

        // Display results
        console.log(chalk.green('\n✅ Execution Plan Generated Successfully!\n'));

        console.log(chalk.cyan('📊 Plan Overview:'));
        console.log(chalk.white(`   File: ${chalk.bold(outputPath)}`));
        console.log(chalk.white(`   Workflow: ${chalk.bold(workflow.name)}`));
        console.log(chalk.white(`   Version: ${workflow.version}`));

        console.log(chalk.cyan('\n⏱️  Execution:'));
        console.log(chalk.white(`   Phases: ${chalk.yellow(plan.phases.length)}`));
        console.log(chalk.white(`   Total Duration: ${chalk.yellow(formatDuration(plan.totalDuration))}`));

        if (planOptions.includeCost && plan.totalCost > 0) {
          console.log(chalk.white(`   Estimated Cost: ${chalk.yellow(formatCost(plan.totalCost))}`));
        }

        console.log(chalk.cyan('\n📦 Resources:'));
        console.log(chalk.white(`   API Calls: ${chalk.yellow(plan.resources.apiCalls)}`));
        console.log(chalk.white(`   Agents: ${chalk.yellow(plan.resources.agents.join(', '))}`));
        console.log(chalk.white(`   Max Concurrency: ${chalk.yellow(plan.resources.maxConcurrency)}`));

        if (plan.risks.length > 0) {
          console.log(chalk.cyan('\n⚠️  Risks Identified:'));
          const highRisks = plan.risks.filter(r => r.level === 'high');
          const mediumRisks = plan.risks.filter(r => r.level === 'medium');
          const lowRisks = plan.risks.filter(r => r.level === 'low');

          if (highRisks.length > 0) {
            console.log(chalk.red(`   High: ${highRisks.length}`));
          }
          if (mediumRisks.length > 0) {
            console.log(chalk.yellow(`   Medium: ${mediumRisks.length}`));
          }
          if (lowRisks.length > 0) {
            console.log(chalk.gray(`   Low: ${lowRisks.length}`));
          }
        }

        console.log(chalk.cyan('\n📝 Execution Phases:'));
        for (let i = 0; i < plan.phases.length; i++) {
          const phase = plan.phases[i];
          const phaseNum = chalk.gray(`${(i + 1).toString().padStart(2, ' ')}.`);
          const phaseName = chalk.white(phase.name);
          const phaseDuration = chalk.blue(`[${formatDuration(phase.duration)}]`);
          const parallelBadge = phase.parallelizable ? chalk.green('⚡ parallel') : '';

          console.log(`   ${phaseNum} ${phaseName} ${phaseDuration} ${parallelBadge}`);
          console.log(chalk.gray(`       ${phase.description}`));
        }

        console.log(chalk.cyan('\n🎯 Critical Path:'));
        const criticalSteps = plan.criticalPath.map(stepId => {
          const step = workflow.steps.find(s => s.id === stepId);
          return step ? step.name : stepId;
        });
        console.log(chalk.white(`   ${criticalSteps.join(' → ')}`));

        console.log(chalk.cyan('\n💡 Next Steps:'));
        console.log(chalk.white(`   1. Review: ${chalk.bold(outputPath)}`));
        console.log(chalk.white(`   2. Execute: ${chalk.bold(`ax workflow run ${workflowPath}`)}`));
        console.log(chalk.white(`   3. Monitor: ${chalk.bold(`ax workflow status`)}`));
        console.log();

      } catch (error) {
        spinner.fail('Plan generation failed');
        console.error(chalk.red('\n❌ Error:'), (error as Error).message);

        if (options.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray('\nStack trace:'));
          console.error(chalk.gray(error.stack));
        }

        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

/**
 * Format cost as USD string
 */
function formatCost(cost: number): string {
  if (cost < 0.001) {
    return '<$0.001';
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Create 'gen dag' command
 */
function createDAGCommand(): Command {
  const cmd = new Command('dag');

  cmd
    .description('Generate dependency graph visualization from workflow')
    .argument('<workflow>', 'Path to workflow YAML file')
    .option('-o, --output <path>', 'Output directory', 'dags')
    .option('-f, --format <format>', 'Output format (ascii, dot, mermaid)', 'ascii')
    .option('--no-highlight', 'Disable critical path highlighting')
    .option('--no-details', 'Exclude step details')
    .option('--orientation <dir>', 'Graph orientation (TB, LR)', 'TB')
    .option('--labels <strategy>', 'Node label strategy (id, name, both)', 'name')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (workflowPath: string, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        // Read workflow file
        const workflowContent = await fs.readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(workflowContent) as WorkflowDefinition;

        spinner.succeed(`Loaded workflow: ${workflow.name}`);

        // Initialize generator
        const generator = new DAGGenerator();

        // Parse options
        const dagOptions: DAGOptions = {
          format: options.format as DAGFormat,
          highlightCriticalPath: options.highlight !== false,
          includeStepDetails: options.details !== false,
          orientation: options.orientation as 'TB' | 'LR',
          nodeLabels: options.labels as 'id' | 'name' | 'both',
        };

        if (options.verbose) {
          console.log(chalk.cyan('\n📊 DAG Configuration:'));
          console.log(chalk.gray(`   Workflow: ${workflow.name} v${workflow.version}`));
          console.log(chalk.gray(`   Steps: ${workflow.steps.length}`));
          console.log(chalk.gray(`   Format: ${dagOptions.format}`));
          console.log(chalk.gray(`   Output: ${options.output}`));
          console.log(chalk.gray(`   Highlight Critical Path: ${dagOptions.highlightCriticalPath}`));
        }

        const generationSpinner = ora('Generating DAG...').start();

        // Generate DAG
        const result = await generator.generate(workflow, dagOptions);

        generationSpinner.succeed('DAG generated!');

        // Write DAG to file
        const outputPath = await generator.writeDAG(result, workflow, options.output);

        // Display results
        console.log(chalk.green('\n✅ DAG Generated Successfully!\n'));

        console.log(chalk.cyan('📊 DAG Overview:'));
        console.log(chalk.white(`   File: ${chalk.bold(outputPath)}`));
        console.log(chalk.white(`   Format: ${chalk.bold(result.format)}`));
        console.log(chalk.white(`   Workflow: ${chalk.bold(workflow.name)}`));
        console.log(chalk.white(`   Version: ${workflow.version}`));

        console.log(chalk.cyan('\n📈 Graph Metrics:'));
        console.log(chalk.white(`   Nodes: ${chalk.yellow(result.metadata.nodeCount)}`));
        console.log(chalk.white(`   Edges: ${chalk.yellow(result.metadata.edgeCount)}`));
        console.log(chalk.white(`   Critical Path Length: ${chalk.yellow(result.metadata.criticalPathLength)}`));
        console.log(chalk.white(`   Max Depth: ${chalk.yellow(result.metadata.maxDepth)}`));

        // Show preview for ASCII format
        if (result.format === 'ascii') {
          console.log(chalk.cyan('\n📋 Preview:\n'));
          console.log(result.content);
        } else {
          console.log(chalk.cyan('\n💡 Rendering Tips:'));
          if (result.format === 'dot') {
            console.log(chalk.white(`   View with: ${chalk.bold(`dot -Tpng ${outputPath} -o graph.png`)}`));
            console.log(chalk.white(`   Or online: ${chalk.bold('https://dreampuf.github.io/GraphvizOnline/')}`));
          } else if (result.format === 'mermaid') {
            console.log(chalk.white(`   View online: ${chalk.bold('https://mermaid.live/')}`));
            console.log(chalk.white(`   Or in Markdown: Paste content into .md file`));
          }
        }

        console.log(chalk.cyan('\n💡 Next Steps:'));
        console.log(chalk.white(`   1. View: ${chalk.bold(outputPath)}`));
        if (result.format !== 'ascii') {
          console.log(chalk.white(`   2. Render the diagram using recommended tools`));
        }
        console.log(chalk.white(`   3. Execute: ${chalk.bold(`ax workflow run ${workflowPath}`)}`));
        console.log();

      } catch (error) {
        spinner.fail('DAG generation failed');
        console.error(chalk.red('\n❌ Error:'), (error as Error).message);

        if (options.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray('\nStack trace:'));
          console.error(chalk.gray(error.stack));
        }

        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Create 'gen scaffold' command
 */
function createScaffoldCommand(): Command {
  const cmd = new Command('scaffold');

  cmd
    .description('Generate project structure from workflow')
    .argument('<workflow>', 'Path to workflow YAML file')
    .option('-o, --output <path>', 'Output directory', './project')
    .option('-t, --template <name>', 'Template name (minimal, standard, complete)', 'standard')
    .option('--include-tests', 'Include test infrastructure', false)
    .option('--include-ci', 'Include CI/CD templates', false)
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview what would be created without writing files', false)
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (workflowPath: string, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        const workflowContent = await fs.readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(workflowContent) as WorkflowDefinition;
        spinner.succeed(`Loaded workflow: ${workflow.name}`);

        const generator = new ScaffoldGenerator();
        const scaffoldOptions: ScaffoldOptions = {
          outputPath: options.output,
          template: options.template as 'minimal' | 'standard' | 'complete',
          includeTests: options.includeTests,
          includeCI: options.includeCi,
          includeDocs: true,
          overwrite: options.overwrite,
          dryRun: options.dryRun,
        };

        const generationSpinner = ora('Generating project structure...').start();
        const result = await generator.generateScaffold(workflow, scaffoldOptions);
        generationSpinner.succeed(scaffoldOptions.dryRun ? 'Preview generated!' : 'Project structure created!');

        console.log(chalk.green(scaffoldOptions.dryRun ? '\n📋 Preview' : '\n✅ Scaffold Generated Successfully!'));
        console.log(chalk.cyan('\n📊 Summary:'));
        console.log(chalk.white(`   Files: ${chalk.yellow(result.createdFiles.length)}`));
        console.log(chalk.white(`   Directories: ${chalk.yellow(result.createdDirectories.length)}`));
        console.log(chalk.white(`   Output Path: ${chalk.yellow(result.outputPath)}`));

        if (!scaffoldOptions.dryRun) {
          console.log(chalk.cyan('\n💡 Next Steps:'));
          console.log(chalk.white(`   1. Review: ${chalk.bold(`${result.outputPath}/README.md`)}`));
          console.log(chalk.white(`   2. Run: ${chalk.bold(`cd ${result.outputPath} && ./scripts/run.sh`)}`));
        }
        console.log();
      } catch (error) {
        spinner.fail('Scaffold generation failed');
        console.error(chalk.red('\n❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Create 'gen tests' command
 */
function createTestsCommand(): Command {
  const cmd = new Command('tests');

  cmd
    .description('Generate test suite from workflow')
    .argument('<workflow>', 'Path to workflow YAML file')
    .option('-o, --output <path>', 'Output directory', 'tests/workflows')
    .option('-f, --framework <name>', 'Test framework (vitest, jest, mocha)', 'vitest')
    .option('--no-unit', 'Exclude unit tests')
    .option('--no-integration', 'Exclude integration tests')
    .option('--no-e2e', 'Exclude E2E tests')
    .option('--no-mocks', 'Exclude mock files')
    .option('--no-fixtures', 'Exclude fixture files')
    .option('--coverage <threshold>', 'Coverage threshold percentage', '80')
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (workflowPath: string, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        const workflowContent = await fs.readFile(workflowPath, 'utf-8');
        const workflow = yaml.load(workflowContent) as WorkflowDefinition;
        spinner.succeed(`Loaded workflow: ${workflow.name} (v${workflow.version})`);

        const generator = new TestGenerator();
        const testOptions: TestOptions = {
          outputPath: options.output,
          framework: options.framework as 'vitest' | 'jest' | 'mocha',
          includeUnit: options.unit !== false,
          includeIntegration: options.integration !== false,
          includeE2E: options.e2e !== false,
          includeMocks: options.mocks !== false,
          includeFixtures: options.fixtures !== false,
          coverageThreshold: parseInt(options.coverage, 10),
        };

        const generationSpinner = ora('Generating test suite...').start();
        const result = await generator.generateTests(workflow, testOptions);
        generationSpinner.succeed('Test suite generated!');

        console.log(chalk.green('\n✅ Test Suite Generated Successfully!\n'));
        console.log(chalk.cyan('📊 Summary:'));
        console.log(chalk.white(`   Framework: ${testOptions.framework}`));
        console.log(chalk.white(`   Output Path: ${result.outputPath}/`));
        console.log(chalk.white(`   Total Tests: ${result.testCount}`));
        console.log(chalk.white(`   Files Created: ${result.createdFiles.length}`));
        console.log(chalk.white(`   Estimated Coverage: ${result.estimatedCoverage}%`));

        console.log(chalk.cyan('\n💡 Next Steps:'));
        console.log(chalk.white(`   1. Review: ${result.outputPath}`));
        console.log(chalk.white(`   2. Run tests: npm test -- ${result.outputPath}`));
        console.log();

      } catch (error) {
        spinner.fail('Test generation failed');
        console.error(chalk.red('\n❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
