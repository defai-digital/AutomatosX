/**
 * AGENTS.md Generator
 *
 * Auto-generates project-specific AGENTS.md files for AI assistant integration.
 *
 * Features:
 * - Auto-detects project type (Node.js, Python, Go, Rust)
 * - Generates tailored development context
 * - Validates existing files with warnings
 * - Zod schema validation for type safety
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

// ========== Schemas ==========

const PackageJsonSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional()
});

const ProjectInfoSchema = z.object({
  type: z.enum(['nodejs', 'python', 'go', 'rust', 'unknown']),
  name: z.string().optional(),
  description: z.string().optional(),
  language: z.string(),
  testFramework: z.string().optional(),
  buildTool: z.string().optional()
});

type PackageJson = z.infer<typeof PackageJsonSchema>;
type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

// ========== Types ==========

export interface GeneratorOptions {
  projectRoot: string;
  force?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ========== Generator ==========

export class AgentsMdGenerator {
  constructor(private options: GeneratorOptions) {}

  async generate(): Promise<string> {
    const agentsPath = join(this.options.projectRoot, 'AGENTS.md');

    // Check if file exists
    if (!this.options.force && (await this.fileExists(agentsPath))) {
      throw new Error('AGENTS.md already exists. Use --force to regenerate.');
    }

    // Detect project type
    const projectInfo = await this.detectProject();

    // Generate content
    const content = this.generateContent(projectInfo);

    // Write file
    await writeFile(agentsPath, content, 'utf-8');
    logger.info('AGENTS.md generated successfully', { path: agentsPath });

    return agentsPath;
  }

  async validate(agentsPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if file exists
      if (!(await this.fileExists(agentsPath))) {
        result.valid = false;
        result.errors.push('AGENTS.md not found');
        return result;
      }

      // Read content
      const content = await readFile(agentsPath, 'utf-8');

      // Check required sections
      const requiredSections = [
        '## Project Overview',
        '## Dev Environment',
        '## Testing',
        '## Pull Requests'
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          result.warnings.push(`Missing recommended section: ${section}`);
        }
      }

      // Check for code examples
      if (!content.includes('```')) {
        result.warnings.push('No code examples found (recommended)');
      }

      // Check file length
      if (content.length > 10000) {
        result.warnings.push('File is quite long (>10KB). Consider condensing.');
      }

      if (content.length < 200) {
        result.errors.push('File is too short. Add more context.');
        result.valid = false;
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  private async detectProject(): Promise<ProjectInfo> {
    const projectRoot = this.options.projectRoot;

    // Try Node.js
    if (await this.fileExists(join(projectRoot, 'package.json'))) {
      return this.detectNodeJsProject(join(projectRoot, 'package.json'));
    }

    // Try Python
    if (
      (await this.fileExists(join(projectRoot, 'requirements.txt'))) ||
      (await this.fileExists(join(projectRoot, 'pyproject.toml')))
    ) {
      return this.detectPythonProject();
    }

    // Try Go
    if (await this.fileExists(join(projectRoot, 'go.mod'))) {
      return this.detectGoProject();
    }

    // Try Rust
    if (await this.fileExists(join(projectRoot, 'Cargo.toml'))) {
      return this.detectRustProject();
    }

    // Unknown project
    return {
      type: 'unknown',
      language: 'Unknown',
      description: 'Unknown project type'
    };
  }

  private async detectNodeJsProject(packageJsonPath: string): Promise<ProjectInfo> {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = PackageJsonSchema.parse(JSON.parse(content));

      // Detect test framework
      let testFramework = 'unknown';
      if (pkg.devDependencies?.vitest) testFramework = 'vitest';
      else if (pkg.devDependencies?.jest) testFramework = 'jest';
      else if (pkg.devDependencies?.mocha) testFramework = 'mocha';

      // Detect build tool
      let buildTool = 'unknown';
      if (pkg.devDependencies?.tsup) buildTool = 'tsup';
      else if (pkg.devDependencies?.webpack) buildTool = 'webpack';
      else if (pkg.devDependencies?.vite) buildTool = 'vite';

      return {
        type: 'nodejs',
        name: pkg.name,
        description: pkg.description,
        language: 'TypeScript',
        testFramework,
        buildTool
      };
    } catch (error) {
      logger.warn('Failed to parse package.json', { error });
      return {
        type: 'nodejs',
        language: 'JavaScript',
        description: 'Node.js project'
      };
    }
  }

  private async detectPythonProject(): Promise<ProjectInfo> {
    return {
      type: 'python',
      language: 'Python',
      testFramework: 'pytest',
      buildTool: 'pip'
    };
  }

  private async detectGoProject(): Promise<ProjectInfo> {
    return {
      type: 'go',
      language: 'Go',
      testFramework: 'go test',
      buildTool: 'go build'
    };
  }

  private async detectRustProject(): Promise<ProjectInfo> {
    return {
      type: 'rust',
      language: 'Rust',
      testFramework: 'cargo test',
      buildTool: 'cargo'
    };
  }

  private generateContent(projectInfo: ProjectInfo): string {
    const timestamp = new Date().toISOString();

    return `# Project Guide for AI Assistants

This file provides context for AI coding assistants.

## Project Overview

This is a ${projectInfo.language} project using ${projectInfo.buildTool || 'npm'}.
${projectInfo.testFramework ? `Test framework: ${projectInfo.testFramework}` : ''}
${projectInfo.buildTool ? `Build tool: ${projectInfo.buildTool}` : ''}

## Dev Environment

### Setup Commands

\`\`\`bash
${this.getSetupCommands(projectInfo)}
\`\`\`

## Testing

- All new features must have tests
- Tests must pass before committing

## Pull Requests

### PR Title Format

\`\`\`
<type>: <description>
Types: feat, fix, chore, docs, test
\`\`\`

---

*Generated by AutomatosX on ${timestamp}*
`;
  }

  private getSetupCommands(projectInfo: ProjectInfo): string {
    switch (projectInfo.type) {
      case 'nodejs':
        return `npm install
npm run build
npm test`;
      case 'python':
        return `pip install -r requirements.txt
python -m pytest`;
      case 'go':
        return `go mod download
go build
go test ./...`;
      case 'rust':
        return `cargo build
cargo test`;
      default:
        return `# Add setup commands here`;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}

// ========== Exports ==========

export async function generateAgentsMd(options: GeneratorOptions): Promise<string> {
  const generator = new AgentsMdGenerator(options);
  return generator.generate();
}

export async function validateAgentsMd(agentsPath: string): Promise<ValidationResult> {
  const generator = new AgentsMdGenerator({ projectRoot: '' });
  return generator.validate(agentsPath);
}
