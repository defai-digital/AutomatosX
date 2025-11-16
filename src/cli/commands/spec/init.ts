/**
 * Spec Init Handler
 *
 * Interactive spec initialization from templates.
 * Creates *.ax.yaml files with metadata, actors, providers, policy, etc.
 *
 * @module cli/commands/spec/init
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import Mustache from 'mustache';
import { fileURLToPath } from 'url';
import { validateSpec } from '@/core/spec/SpecSchemaValidator.js';
import { logger } from '@/utils/logger.js';
import * as yaml from 'js-yaml';

// Get current file directory (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SpecInitOptions {
  template?: string;
  output?: string;
  interactive?: boolean;
}

interface TemplateData {
  id: string;
  name: string;
  description: string;
  author: string;
  agent: string;
  tags?: string[];
  created: string;
}

/**
 * Handle 'ax spec init' command
 */
export async function handleSpecInit(
  workspacePath: string,
  options: SpecInitOptions
): Promise<void> {
  console.log(chalk.blue.bold('\n📋 Spec-Kit: Initialize New Spec\n'));

  try {
    // Determine template
    let template = options.template;
    if (!template && options.interactive !== false) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: [
            {
              name: 'Minimal - Simple single-actor spec',
              value: 'minimal'
            },
            {
              name: 'Enterprise - Multi-actor with full observability',
              value: 'enterprise'
            },
            {
              name: 'Government - High-security compliance-focused',
              value: 'government'
            }
          ],
          default: 'minimal'
        }
      ]);
      template = answers.template;
    }

    template = template || 'minimal';

    // Validate template choice
    const validTemplates = ['minimal', 'enterprise', 'government'];
    if (!validTemplates.includes(template)) {
      throw new Error(`Invalid template: ${template}. Must be one of: ${validTemplates.join(', ')}`);
    }

    // Gather metadata
    const metadata = await gatherMetadata(template, options.interactive !== false);

    // Load template
    const templatePath = join(__dirname, `../../../../templates/specs/${template}.yaml.mustache`);
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateContent = readFileSync(templatePath, 'utf-8');

    // Render template
    const rendered = Mustache.render(templateContent, metadata);

    // Parse and validate
    const spec = yaml.load(rendered);
    const validation = validateSpec(spec);

    if (!validation.valid) {
      console.log(chalk.yellow('\n⚠️  Validation warnings:\n'));
      validation.errors.forEach(err => {
        console.log(chalk.red(`  ✗ ${err.message}`));
        if (err.suggestion) {
          console.log(chalk.gray(`    → ${err.suggestion}`));
        }
      });
      throw new Error('Generated spec failed validation');
    }

    // Show validation warnings/info
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:\n'));
      validation.warnings.forEach(warn => {
        console.log(chalk.yellow(`  ! ${warn.message}`));
        if (warn.suggestion) {
          console.log(chalk.gray(`    → ${warn.suggestion}`));
        }
      });
    }

    if (validation.info.length > 0) {
      console.log(chalk.blue('\nℹ️  Info:\n'));
      validation.info.forEach(info => {
        console.log(chalk.blue(`  ℹ ${info.message}`));
      });
    }

    // Determine output path
    let outputPath: string = options.output || '';
    if (!outputPath) {
      const defaultPath = join(workspacePath, `${metadata.id}.ax.yaml`);
      if (options.interactive !== false) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'outputPath',
            message: 'Output file path:',
            default: defaultPath,
            validate: (input: string) => {
              if (!input) return 'Output path is required';
              if (!input.endsWith('.ax.yaml')) return 'File must have .ax.yaml extension';
              return true;
            }
          }
        ]);
        outputPath = answers.outputPath;
      } else {
        outputPath = defaultPath;
      }
    }

    // Ensure outputPath is valid
    if (!outputPath) {
      throw new Error('Output path is required');
    }

    // Check if file exists
    if (existsSync(outputPath)) {
      if (options.interactive !== false) {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'File already exists. Overwrite?',
            default: false
          }
        ]);
        if (!answers.overwrite) {
          console.log(chalk.yellow('\n✗ Cancelled\n'));
          return;
        }
      } else {
        throw new Error(`File already exists: ${outputPath}`);
      }
    }

    // Create directory if needed
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write file
    writeFileSync(outputPath, rendered, 'utf-8');

    console.log(chalk.green(`\n✓ Spec created successfully: ${outputPath}\n`));

    // Show next steps
    console.log(chalk.blue('Next steps:\n'));
    console.log(chalk.gray(`  1. Edit the spec: ${outputPath}`));
    console.log(chalk.gray(`  2. Validate: ax spec validate --file ${outputPath}`));
    console.log(chalk.gray(`  3. Review: ax spec explain ${outputPath}`));
    console.log(chalk.gray(`  4. Execute: ax spec run ${outputPath}\n`));

    logger.info('Spec initialized', {
      template,
      outputPath,
      id: metadata.id
    });
  } catch (error) {
    console.error(chalk.red(`\n✗ Failed to initialize spec: ${(error as Error).message}\n`));
    logger.error('Spec init failed', { error });
    throw error;
  }
}

/**
 * Gather metadata from user input
 */
async function gatherMetadata(template: string, interactive: boolean): Promise<TemplateData> {
  if (!interactive) {
    // Non-interactive mode: use defaults
    return {
      id: 'my-spec',
      name: 'My Spec',
      description: 'A new AutomatosX spec',
      author: 'AutomatosX User',
      agent: 'backend',
      tags: [],
      created: new Date().toISOString()
    };
  }

  // Interactive mode: prompt user
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Spec ID (kebab-case):',
      default: 'my-workflow',
      validate: (input: string) => {
        if (!input) return 'ID is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'ID must be kebab-case (lowercase, numbers, hyphens)';
        return true;
      }
    },
    {
      type: 'input',
      name: 'name',
      message: 'Spec name:',
      default: 'My Workflow',
      validate: (input: string) => input ? true : 'Name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Brief description:',
      default: 'A new AutomatosX workflow specification',
      validate: (input: string) => input ? true : 'Description is required'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author/team name:',
      default: 'AutomatosX User'
    },
    {
      type: 'input',
      name: 'agent',
      message: 'Primary agent:',
      default: 'backend',
      validate: (input: string) => input ? true : 'Agent is required'
    }
  ]);

  // Template-specific questions
  let tags: string[] = [];
  if (template === 'enterprise' || template === 'government') {
    const tagAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'tags',
        message: 'Tags (comma-separated):',
        default: template === 'government' ? 'government,compliance,high-security' : 'production,enterprise',
        filter: (input: string) => input.split(',').map(t => t.trim()).filter(Boolean)
      }
    ]);
    tags = tagAnswers.tags;
  }

  return {
    ...answers,
    tags,
    created: new Date().toISOString()
  };
}

/**
 * Get available templates
 */
export function getAvailableTemplates(): string[] {
  return ['minimal', 'enterprise', 'government'];
}

/**
 * Get template description
 */
export function getTemplateDescription(template: string): string {
  const descriptions: Record<string, string> = {
    minimal: 'Simple single-actor spec with basic configuration',
    enterprise: 'Multi-actor spec with full observability, policy, and recovery',
    government: 'High-security spec with strict compliance and audit requirements'
  };
  return descriptions[template] || 'Unknown template';
}
