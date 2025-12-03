/**
 * Gen Command - Auto-generation CLI (Phase 3)
 *
 * Commands for generating artifacts from YAML specs:
 * - ax gen plan - Generate execution plan
 * - ax gen dag - Generate DAG JSON
 * - ax gen scaffold - Scaffold directory structure
 * - ax gen tests - Generate test files
 *
 * @module cli/commands/gen
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import { PlanGenerator, getDefaultPlanGenerator } from '@/core/spec/PlanGenerator.js';
import { DagGenerator, getDefaultDagGenerator, validateDag } from '@/core/spec/DagGenerator.js';
import { ScaffoldGenerator, getDefaultScaffoldGenerator } from '@/core/spec/ScaffoldGenerator.js';
import { TestGenerator, getDefaultTestGenerator } from '@/core/spec/TestGenerator.js';
import { validateSpec } from '@/core/spec/SpecSchemaValidator.js';
import type { SpecYAML } from '@/types/spec-yaml.js';
import type { DagJson } from '@/types/dag.js';
import { logger } from '@/utils/logger.js';

interface GenOptions {
  // Subcommand
  subcommand?: string;

  // Common options
  file?: string;
  output?: string;
  format?: 'json' | 'markdown' | 'mermaid' | 'dot';

  // Plan options
  'export-markdown'?: boolean;

  // DAG options
  validate?: boolean;
  pretty?: boolean;

  // Future options (scaffold, tests)
  template?: string;
  force?: boolean;
}

export const genCommand: CommandModule<Record<string, unknown>, GenOptions> = {
  command: 'gen <subcommand>',
  describe: 'Auto-generation commands (Phase 3)',

  builder: (yargs) => {
    return yargs
      .positional('subcommand', {
        describe: 'Subcommand (plan, dag, scaffold, tests)',
        type: 'string',
        choices: ['plan', 'dag', 'scaffold', 'tests'],
        demandOption: true
      })
      // Common options
      .option('file', {
        alias: 'f',
        describe: 'Spec file path (*.ax.yaml)',
        type: 'string'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output file path',
        type: 'string'
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'markdown', 'mermaid', 'dot'],
        default: 'markdown'
      })
      // Plan options
      .option('export-markdown', {
        describe: 'Export plan as markdown',
        type: 'boolean',
        default: true
      })
      // DAG options
      .option('validate', {
        describe: 'Validate DAG structure',
        type: 'boolean',
        default: true
      })
      .option('pretty', {
        describe: 'Pretty-print JSON output',
        type: 'boolean',
        default: true
      })
      // Future options
      .option('template', {
        describe: 'Template to use (for scaffold)',
        type: 'string'
      })
      .option('force', {
        describe: 'Overwrite existing files',
        type: 'boolean',
        default: false
      })
      .example('$0 gen plan workflow.ax.yaml', 'Generate execution plan')
      .example('$0 gen plan workflow.ax.yaml -o plan.md', 'Generate and save to file')
      .example('$0 gen dag workflow.ax.yaml', 'Generate DAG JSON')
      .example('$0 gen dag workflow.ax.yaml --format mermaid', 'Generate Mermaid diagram')
      .example('$0 gen dag workflow.ax.yaml -o dag.json', 'Generate and save to file')
      .example('$0 gen scaffold workflow.ax.yaml', 'Scaffold directory structure (future)')
      .example('$0 gen tests workflow.ax.yaml', 'Generate test files (future)');
  },

  handler: async (argv) => {
    try {
      // Get spec file path
      let specFile = argv.file;

      // If not provided via --file, check if provided as positional arg after subcommand
      if (!specFile && argv._.length > 1) {
        specFile = String(argv._[1]);
      }

      if (!specFile) {
        console.error(chalk.red('✗ Error: Spec file path is required'));
        console.error(chalk.gray('Usage: ax gen <subcommand> <spec-file> [options]'));
        process.exit(1);
      }

      // Resolve absolute path
      specFile = resolve(process.cwd(), specFile);

      // Validate path safety - prevent access to system-critical directories
      // Unix dangerous paths
      const dangerousUnixPaths = ['/etc', '/sys', '/proc', '/dev', '/root', '/boot'];
      const isDangerousUnixPath = dangerousUnixPaths.some(dangerous =>
        specFile.startsWith(dangerous + '/') || specFile === dangerous
      );

      // Windows dangerous paths (case-insensitive)
      const specFileLower = specFile.toLowerCase();
      const dangerousWindowsPaths = [
        'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
        'c:\\programdata', 'c:\\users\\public', 'c:\\system32'
      ];
      const isDangerousWindowsPath = dangerousWindowsPaths.some(dangerous =>
        specFileLower.startsWith(dangerous + '\\') || specFileLower === dangerous
      );

      if (isDangerousUnixPath || isDangerousWindowsPath) {
        console.error(chalk.red(`✗ Error: Access to system directory '${specFile}' is not allowed`));
        console.error(chalk.gray('Spec files should be in your project directory'));
        process.exit(1);
      }

      switch (argv.subcommand) {
        case 'plan':
          await handleGenPlan(specFile, argv);
          break;
        case 'dag':
          await handleGenDag(specFile, argv);
          break;
        case 'scaffold':
          await handleGenScaffold(specFile, argv);
          break;
        case 'tests':
          await handleGenTests(specFile, argv);
          break;
        default:
          console.error(chalk.red(`Unknown subcommand: ${argv.subcommand}`));
          process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      logger.error('Gen command failed', { error });
      process.exit(1);
    }
  }
};

/**
 * Handle 'ax gen plan' command
 */
async function handleGenPlan(specFile: string, argv: GenOptions): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    // Check if spec file exists
    if (!existsSync(specFile)) {
      spinner.fail(`Spec file not found: ${specFile}`);
      console.error(chalk.red(`\n✗ File does not exist: ${chalk.bold(specFile)}\n`));
      process.exit(1);
    }

    // Load and validate spec
    const specContent = readFileSync(specFile, 'utf-8');
    const spec = yaml.load(specContent) as SpecYAML;

    const validation = validateSpec(spec);
    if (!validation.valid) {
      spinner.fail('Spec validation failed');
      console.error(chalk.red('\n✗ Validation errors:\n'));
      validation.errors.forEach(err => {
        console.error(chalk.red(`  ✗ ${err.message}`));
      });
      throw new Error('Cannot generate plan from invalid spec');
    }

    spinner.text = 'Generating execution plan...';

    // Generate plan
    const generator = getDefaultPlanGenerator();
    const plan = generator.generate(spec);

    spinner.succeed('Execution plan generated');

    // Output based on format
    if (argv.format === 'json') {
      const output = JSON.stringify(plan, null, argv.pretty ? 2 : 0);

      if (argv.output) {
        writeFileSync(argv.output, output, 'utf-8');
        console.log(chalk.green(`\n✓ Plan saved to ${argv.output}\n`));
      } else {
        console.log(output);
      }
    } else if (argv.format === 'markdown' || argv['export-markdown']) {
      const markdown = generator.exportMarkdown(plan);

      if (argv.output) {
        writeFileSync(argv.output, markdown, 'utf-8');
        console.log(chalk.green(`\n✓ Plan saved to ${argv.output}\n`));
      } else {
        console.log(markdown);
      }
    } else {
      // Default: Display summary
      displayPlanSummary(plan);
    }

    logger.info('Plan generated', {
      specFile,
      format: argv.format,
      output: argv.output
    });

  } catch (error) {
    spinner.fail('Failed to generate plan');
    throw error;
  }
}

/**
 * Handle 'ax gen dag' command
 */
async function handleGenDag(specFile: string, argv: GenOptions): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    // Check if spec file exists
    if (!existsSync(specFile)) {
      spinner.fail(`Spec file not found: ${specFile}`);
      console.error(chalk.red(`\n✗ File does not exist: ${chalk.bold(specFile)}\n`));
      process.exit(1);
    }

    // Load and validate spec
    const specContent = readFileSync(specFile, 'utf-8');
    const spec = yaml.load(specContent) as SpecYAML;

    const validation = validateSpec(spec);
    if (!validation.valid) {
      spinner.fail('Spec validation failed');
      console.error(chalk.red('\n✗ Validation errors:\n'));
      validation.errors.forEach(err => {
        console.error(chalk.red(`  ✗ ${err.message}`));
      });
      throw new Error('Cannot generate DAG from invalid spec');
    }

    spinner.text = 'Generating DAG...';

    // Generate DAG
    const generator = getDefaultDagGenerator();
    const dag = generator.generate(spec, specContent, specFile);

    // Validate DAG if requested
    if (argv.validate) {
      spinner.text = 'Validating DAG...';
      const dagValidation = validateDag(dag);

      if (!dagValidation.valid) {
        spinner.fail('DAG validation failed');
        console.error(chalk.red('\n✗ DAG validation errors:\n'));
        dagValidation.errors.forEach(err => {
          console.error(chalk.red(`  ✗ ${err}`));
        });
        throw new Error('Generated DAG is invalid');
      }

      if (dagValidation.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  DAG validation warnings:\n'));
        dagValidation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  ⚠️  ${warning}`));
        });
      }
    }

    spinner.succeed('DAG generated');

    // Output based on format
    if (argv.format === 'mermaid') {
      const mermaid = generator.exportMermaid(dag);

      if (argv.output) {
        writeFileSync(argv.output, mermaid, 'utf-8');
        console.log(chalk.green(`\n✓ Mermaid diagram saved to ${argv.output}\n`));
      } else {
        console.log('\n```mermaid');
        console.log(mermaid);
        console.log('```\n');
      }
    } else if (argv.format === 'dot') {
      const dot = generator.exportDot(dag);

      if (argv.output) {
        writeFileSync(argv.output, dot, 'utf-8');
        console.log(chalk.green(`\n✓ DOT diagram saved to ${argv.output}\n`));
      } else {
        console.log(dot);
      }
    } else {
      // Default: JSON
      const output = generator.exportJson(dag, argv.pretty);

      if (argv.output) {
        writeFileSync(argv.output, output, 'utf-8');
        console.log(chalk.green(`\n✓ DAG saved to ${argv.output}\n`));
      } else {
        console.log(output);
      }
    }

    logger.info('DAG generated', {
      specFile,
      format: argv.format,
      output: argv.output,
      hash: dag.specHash.substring(0, 8)
    });

  } catch (error) {
    spinner.fail('Failed to generate DAG');
    throw error;
  }
}

/**
 * Handle 'ax gen scaffold' command
 */
async function handleGenScaffold(specFile: string, argv: GenOptions): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    // Check if spec file exists
    if (!existsSync(specFile)) {
      spinner.fail(`Spec file not found: ${specFile}`);
      console.error(chalk.red(`\n✗ File does not exist: ${chalk.bold(specFile)}\n`));
      process.exit(1);
    }

    // Load and validate spec
    const specContent = readFileSync(specFile, 'utf-8');
    const spec = yaml.load(specContent) as SpecYAML;

    const validation = validateSpec(spec);
    if (!validation.valid) {
      spinner.fail('Spec validation failed');
      console.error(chalk.red('\n✗ Validation errors:\n'));
      validation.errors.forEach(err => {
        console.error(chalk.red(`  ✗ ${err.message}`));
      });
      throw new Error('Cannot generate scaffold from invalid spec');
    }

    spinner.text = 'Generating scaffold structure...';

    // Determine output directory (sanitize spec.metadata.id for safety)
    const sanitizedId = spec.metadata.id.replace(/[^a-zA-Z0-9\-_]/g, '-');
    const outputDir = argv.output || `./${sanitizedId}`;

    if (sanitizedId !== spec.metadata.id) {
      logger.warn(`Spec ID sanitized for directory name: '${spec.metadata.id}' → '${sanitizedId}'`);
    }

    // Generate scaffold
    const generator = getDefaultScaffoldGenerator();
    const structure = generator.generate(spec, resolve(process.cwd(), outputDir));

    spinner.text = 'Creating directories and files...';

    // Warn if force flag is used
    if (argv.force) {
      spinner.warn('Force flag enabled - existing files will be overwritten');
      console.log(chalk.yellow('⚠️  Using --force flag: Existing files will be overwritten without confirmation\n'));
    }

    // Execute scaffold
    await generator.execute(structure, argv.force || false);

    spinner.succeed('Scaffold generated successfully');

    // Display summary
    console.log(chalk.green(`\n✓ Scaffold created at: ${chalk.bold(outputDir)}\n`));
    console.log(chalk.blue('Created directories:'));
    structure.directories.slice(0, 10).forEach(dir => {
      console.log(chalk.gray(`  • ${dir}`));
    });
    if (structure.directories.length > 10) {
      console.log(chalk.gray(`  ... and ${structure.directories.length - 10} more\n`));
    } else {
      console.log();
    }

    console.log(chalk.blue('Created files:'));
    structure.files.forEach(file => {
      console.log(chalk.gray(`  • ${file.path}`));
    });
    console.log();

    // Next steps
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray(`  1. cd ${outputDir}`));
    console.log(chalk.gray('  2. npm install'));
    console.log(chalk.gray('  3. npm run gen:plan'));
    console.log(chalk.gray('  4. npm run gen:dag'));
    console.log(chalk.gray('  5. npm run'));
    console.log();

    logger.info('Scaffold generated', {
      specFile,
      outputDir,
      directories: structure.directories.length,
      files: structure.files.length
    });

  } catch (error) {
    spinner.fail('Failed to generate scaffold');
    throw error;
  }
}

/**
 * Handle 'ax gen tests' command
 */
async function handleGenTests(specFile: string, argv: GenOptions): Promise<void> {
  const spinner = ora('Loading spec...').start();

  try {
    // Check if spec file exists
    if (!existsSync(specFile)) {
      spinner.fail(`Spec file not found: ${specFile}`);
      console.error(chalk.red(`\n✗ File does not exist: ${chalk.bold(specFile)}\n`));
      process.exit(1);
    }

    // Load and validate spec
    const specContent = readFileSync(specFile, 'utf-8');
    const spec = yaml.load(specContent) as SpecYAML;

    const validation = validateSpec(spec);
    if (!validation.valid) {
      spinner.fail('Spec validation failed');
      console.error(chalk.red('\n✗ Validation errors:\n'));
      validation.errors.forEach(err => {
        console.error(chalk.red(`  ✗ ${err.message}`));
      });
      throw new Error('Cannot generate tests from invalid spec');
    }

    spinner.text = 'Generating test files...';

    // Determine output directory
    const outputDir = argv.output || process.cwd();

    // Generate tests
    const generator = getDefaultTestGenerator();
    const testFiles = generator.generate(spec, resolve(process.cwd(), outputDir));

    spinner.text = 'Writing test files...';

    // Write test files
    for (const file of testFiles) {
      if (!argv.force && existsSync(file.path)) {
        console.log(chalk.yellow(`\n⚠️  File exists, skipping: ${file.path}`));
        continue;
      }

      writeFileSync(file.path, file.content, 'utf-8');
    }

    spinner.succeed('Test files generated successfully');

    // Display summary
    console.log(chalk.green('\n✓ Test files created:\n'));
    testFiles.forEach(file => {
      console.log(chalk.gray(`  • ${file.path}`));
    });
    console.log();

    // Next steps
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray('  1. Review and customize the generated tests'));
    console.log(chalk.gray('  2. Install test dependencies: npm install'));
    console.log(chalk.gray('  3. Run tests: npm test'));
    console.log(chalk.gray('  4. Generate coverage: npm run test:coverage'));
    console.log();

    logger.info('Test files generated', {
      specFile,
      outputDir,
      files: testFiles.length
    });

  } catch (error) {
    spinner.fail('Failed to generate tests');
    throw error;
  }
}

/**
 * Display plan summary
 */
function displayPlanSummary(plan: any): void {
  console.log(chalk.cyan('\n📋 Execution Plan Summary\n'));

  // Overview
  console.log(chalk.blue('Overview:'));
  console.log(chalk.gray(`  Spec ID: ${plan.overview.specId}`));
  console.log(chalk.gray(`  Spec Name: ${plan.overview.specName}`));
  console.log(chalk.gray(`  Actors: ${plan.overview.actorCount}`));
  console.log(chalk.gray(`  Phases: ${plan.overview.phaseCount}`));
  console.log(chalk.gray(`  Estimated Duration: ${plan.overview.estimatedDuration}`));

  // Check if cost estimation is disabled
  const isCostDisabled = plan.overview.estimatedCost.min === 0 && plan.overview.estimatedCost.max === 0;
  if (isCostDisabled) {
    console.log(chalk.gray(`  Estimated Cost: N/A (cost estimation disabled)\n`));
  } else {
    console.log(chalk.gray(`  Estimated Cost: $${plan.overview.estimatedCost.min.toFixed(2)} - $${plan.overview.estimatedCost.max.toFixed(2)} ${plan.overview.estimatedCost.currency}\n`));
  }

  // Phases
  console.log(chalk.blue('Phases:'));
  for (const phase of plan.phases) {
    console.log(chalk.cyan(`  Phase ${phase.phase}: ${phase.name}`));
    console.log(chalk.gray(`    Actors: ${phase.actors.join(', ')}`));
    console.log(chalk.gray(`    Duration: ${phase.estimatedDuration}`));
    console.log(chalk.gray(`    Parallelizable: ${phase.parallelizable ? '✓' : '✗'}\n`));
  }

  // Resources
  console.log(chalk.blue('Resource Requirements:'));
  console.log(chalk.gray(`  Memory: ${plan.resourceRequirements.memory}`));
  console.log(chalk.gray(`  CPU: ${plan.resourceRequirements.cpu}`));
  console.log(chalk.gray(`  Storage: ${plan.resourceRequirements.storage}`));
  console.log(chalk.gray(`  Network: ${plan.resourceRequirements.network}\n`));

  // Risks
  if (plan.risks.length > 0) {
    console.log(chalk.blue('Identified Risks:'));
    for (const risk of plan.risks) {
      const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${icon} ${risk.severity.toUpperCase()}: ${risk.title}`);
      console.log(chalk.gray(`    ${risk.description}`));
      console.log(chalk.gray(`    Mitigation: ${risk.mitigation}\n`));
    }
  }

  // Recommendations
  if (plan.recommendations.length > 0) {
    console.log(chalk.blue('Recommendations:'));
    for (const rec of plan.recommendations) {
      console.log(chalk.gray(`  • ${rec}`));
    }
    console.log();
  }
}
