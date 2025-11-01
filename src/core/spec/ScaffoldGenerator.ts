/**
 * Scaffold Generator
 *
 * Generates directory structures and configuration files from YAML specs.
 *
 * @module core/spec/ScaffoldGenerator
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SpecYAML } from '@/types/spec-yaml.js';
import { logger } from '@/utils/logger.js';

/**
 * Scaffold structure definition
 */
export interface ScaffoldStructure {
  directories: string[];
  files: Array<{ path: string; content: string }>;
}

/**
 * Scaffold generator for YAML specs
 */
export class ScaffoldGenerator {
  /**
   * Generate scaffold structure from spec
   *
   * @param spec - Parsed YAML spec
   * @param basePath - Base path for scaffold
   * @returns Scaffold structure (directories and files)
   */
  generate(spec: SpecYAML, basePath: string): ScaffoldStructure {
    const directories: string[] = [];
    const files: Array<{ path: string; content: string }> = [];

    // Validate spec.actors exists
    if (!spec.actors || spec.actors.length === 0) {
      throw new Error('Spec must have at least one actor');
    }

    // FIXED (Bug #24): Validate spec.metadata exists and has required fields
    if (!spec.metadata || typeof spec.metadata !== 'object') {
      throw new Error('Spec must have metadata object');
    }
    if (!spec.metadata.id || typeof spec.metadata.id !== 'string') {
      throw new Error('Spec metadata must have id field (string)');
    }
    if (!spec.metadata.name || typeof spec.metadata.name !== 'string') {
      throw new Error('Spec metadata must have name field (string)');
    }

    // FIXED (Bug #25): Validate basePath is a non-empty string
    if (typeof basePath !== 'string') {
      throw new Error(`basePath must be a string, got ${typeof basePath}`);
    }
    if (basePath.trim().length === 0) {
      throw new Error('basePath cannot be empty or whitespace-only');
    }

    // Create base directory
    directories.push(basePath);

    // Create actor directories
    for (const actor of spec.actors) {
      // FIXED (Bug #26): Validate actor.id exists and is string before sanitization
      if (!actor.id || typeof actor.id !== 'string') {
        throw new Error(`Actor must have id field (string), got ${typeof actor.id}`);
      }
      if (!actor.agent || typeof actor.agent !== 'string') {
        throw new Error(`Actor "${actor.id}" must have agent field (string)`);
      }

      // Sanitize actor.id to prevent path traversal
      const sanitizedId = this.sanitizeActorId(actor.id);
      if (sanitizedId !== actor.id) {
        logger.warn(`Actor ID sanitized: '${actor.id}' → '${sanitizedId}'`);
      }
      const actorDir = join(basePath, 'actors', sanitizedId);
      directories.push(actorDir);
      directories.push(join(actorDir, 'input'));
      directories.push(join(actorDir, 'output'));
      directories.push(join(actorDir, 'artifacts'));

      // Create actor README
      files.push({
        path: join(actorDir, 'README.md'),
        content: this.generateActorReadme(actor)
      });
    }

    // Create observability directories
    if (spec.observability) {
      const obsDir = join(basePath, 'observability');
      directories.push(obsDir);

      if (spec.observability.logs?.enabled) {
        directories.push(join(obsDir, 'logs'));
      }

      if (spec.observability.metrics?.enabled) {
        directories.push(join(obsDir, 'metrics'));
      }

      if (spec.observability.audit?.enabled) {
        directories.push(join(obsDir, 'audit'));
      }

      // Generate observability config
      files.push({
        path: join(obsDir, 'config.yaml'),
        content: this.generateObservabilityConfig(spec.observability)
      });
    }

    // Create tests directory
    directories.push(join(basePath, 'tests'));
    directories.push(join(basePath, 'tests', 'fixtures'));
    directories.push(join(basePath, 'tests', 'expected'));
    directories.push(join(basePath, 'tests', 'actual'));

    // Generate root files
    files.push({
      path: join(basePath, '.gitignore'),
      content: this.generateGitignore(spec)
    });

    files.push({
      path: join(basePath, 'README.md'),
      content: this.generateReadme(spec)
    });

    files.push({
      path: join(basePath, 'package.json'),
      content: this.generatePackageJson(spec)
    });

    logger.debug('Scaffold structure generated', {
      specId: spec.metadata.id,
      directories: directories.length,
      files: files.length
    });

    return { directories, files };
  }

  /**
   * Execute scaffold (create directories and files)
   *
   * @param structure - Scaffold structure
   * @param force - Overwrite existing files
   */
  async execute(structure: ScaffoldStructure, force = false): Promise<void> {
    // Create directories
    for (const dir of structure.directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        logger.debug(`Created directory: ${dir}`);
      }
    }

    // Write files
    for (const file of structure.files) {
      if (!existsSync(file.path) || force) {
        writeFileSync(file.path, file.content, 'utf-8');
        logger.debug(`Created file: ${file.path}`);
      } else {
        logger.warn(`File already exists, skipping: ${file.path}`);
      }
    }

    logger.info('Scaffold execution complete', {
      directories: structure.directories.length,
      files: structure.files.length
    });
  }

  /**
   * Generate .gitignore file
   */
  private generateGitignore(spec: SpecYAML): string {
    const lines: string[] = [
      '# AutomatosX generated',
      'node_modules/',
      '.automatosx/',
      '',
      '# Artifacts',
      'actors/*/artifacts/',
      'actors/*/output/',
      '',
      '# Tests',
      'tests/actual/',
      'coverage/',
      '',
      '# Logs',
      '*.log',
      'logs/',
      ''
    ];

    // Add observability ignores
    if (spec.observability) {
      lines.push('# Observability');
      if (spec.observability.logs?.enabled) {
        lines.push('observability/logs/');
      }
      if (spec.observability.metrics?.enabled) {
        lines.push('observability/metrics/');
      }
      lines.push('');
    }

    // Add common ignores
    lines.push('# OS');
    lines.push('.DS_Store');
    lines.push('Thumbs.db');
    lines.push('');
    lines.push('# Build');
    lines.push('dist/');
    lines.push('build/');
    lines.push('*.tsbuildinfo');

    return lines.join('\n');
  }

  /**
   * Generate README.md file
   */
  private generateReadme(spec: SpecYAML): string {
    const lines: string[] = [
      `# ${spec.metadata.name}`,
      '',
      spec.metadata.description || 'No description provided',
      '',
      '## Overview',
      '',
      `- **ID**: ${spec.metadata.id}`,
      `- **Version**: ${spec.metadata.version || '1.0.0'}`,
      `- **Actors**: ${spec.actors.length}`,
      ''
    ];

    // Add actors section
    lines.push('## Actors');
    lines.push('');
    for (const actor of spec.actors) {
      lines.push(`### ${actor.id}`);
      lines.push('');
      lines.push(`- **Agent**: ${actor.agent}`);
      lines.push(`- **Description**: ${actor.description || 'No description'}`);

      if (actor.timeout) {
        lines.push(`- **Timeout**: ${actor.timeout}ms`);
      }

      if (actor.resources) {
        lines.push(`- **Resources**:`);
        if (actor.resources.memory?.limit) {
          lines.push(`  - Memory: ${actor.resources.memory.limit}`);
        }
        if (actor.resources.cpu?.limit) {
          lines.push(`  - CPU: ${actor.resources.cpu.limit} cores`);
        }
      }

      lines.push('');
    }

    // Add directory structure
    lines.push('## Directory Structure');
    lines.push('');
    lines.push('```');
    lines.push('actors/');
    for (const actor of spec.actors) {
      lines.push(`  ${actor.id}/`);
      lines.push(`    input/       # Input files for ${actor.id}`);
      lines.push(`    output/      # Output files from ${actor.id}`);
      lines.push(`    artifacts/   # Artifacts generated by ${actor.id}`);
    }

    if (spec.observability) {
      lines.push('observability/');
      if (spec.observability.logs?.enabled) {
        lines.push('  logs/        # Log files');
      }
      if (spec.observability.metrics?.enabled) {
        lines.push('  metrics/     # Metrics data');
      }
      if (spec.observability.audit?.enabled) {
        lines.push('  audit/       # Audit logs');
      }
    }

    lines.push('tests/');
    lines.push('  fixtures/    # Test fixtures');
    lines.push('  expected/    # Expected test outputs');
    lines.push('  actual/      # Actual test outputs');
    lines.push('```');
    lines.push('');

    // Add usage section
    lines.push('## Usage');
    lines.push('');
    lines.push('### Run the workflow');
    lines.push('```bash');
    lines.push(`ax run ${spec.metadata.id}.ax.yaml`);
    lines.push('```');
    lines.push('');
    lines.push('### Generate execution plan');
    lines.push('```bash');
    lines.push(`ax gen plan ${spec.metadata.id}.ax.yaml`);
    lines.push('```');
    lines.push('');
    lines.push('### Generate DAG');
    lines.push('```bash');
    lines.push(`ax gen dag ${spec.metadata.id}.ax.yaml -o dag.json`);
    lines.push('```');
    lines.push('');
    lines.push('### Run tests');
    lines.push('```bash');
    lines.push('npm test');
    lines.push('```');
    lines.push('');

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Generated by AutomatosX from `' + spec.metadata.id + '.ax.yaml`*');
    lines.push('');
    lines.push(`*Generated on: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * Generate package.json file
   */
  private generatePackageJson(spec: SpecYAML): string {
    const pkg = {
      name: spec.metadata.id,
      version: spec.metadata.version || '1.0.0',
      description: spec.metadata.description || '',
      private: true,
      scripts: {
        test: 'vitest run',
        'test:watch': 'vitest watch',
        'test:coverage': 'vitest run --coverage',
        'gen:plan': `ax gen plan ${spec.metadata.id}.ax.yaml`,
        'gen:dag': `ax gen dag ${spec.metadata.id}.ax.yaml -o dag.json`,
        run: `ax run ${spec.metadata.id}.ax.yaml`
      },
      devDependencies: {
        vitest: '^1.0.0',
        '@vitest/coverage-v8': '^1.0.0',
        '@types/node': '^20.0.0'
      },
      keywords: [
        'automatosx',
        'workflow',
        'automation'
      ],
      author: spec.metadata.author || '',
      license: 'MIT'
    };

    return JSON.stringify(pkg, null, 2);
  }

  /**
   * Generate actor README
   */
  private generateActorReadme(actor: any): string {
    // FIXED (Bug #27): Validate actor properties before accessing
    if (!actor.id || typeof actor.id !== 'string') {
      throw new Error('Actor must have id field (string) for README generation');
    }
    if (!actor.agent || typeof actor.agent !== 'string') {
      throw new Error(`Actor "${actor.id}" must have agent field (string) for README generation`);
    }

    const lines: string[] = [
      `# Actor: ${actor.id}`,
      '',
      `**Agent**: ${actor.agent}`,
      '',
      `**Description**: ${actor.description || 'No description provided'}`,
      ''
    ];

    // Add configuration
    lines.push('## Configuration');
    lines.push('');

    if (actor.timeout) {
      lines.push(`- **Timeout**: ${actor.timeout}ms`);
    }

    if (actor.resources) {
      lines.push(`- **Resources**:`);
      if (actor.resources.memory) {
        lines.push(`  - Memory limit: ${actor.resources.memory.limit}`);
      }
      if (actor.resources.cpu) {
        lines.push(`  - CPU limit: ${actor.resources.cpu.limit} cores`);
      }
    }

    if (actor.permissions) {
      lines.push(`- **Permissions**:`);
      if (actor.permissions.filesystem) {
        lines.push(`  - Filesystem: ${actor.permissions.filesystem}`);
      }
      if (actor.permissions.network?.enabled) {
        lines.push(`  - Network: Enabled`);
        if (actor.permissions.network.whitelist) {
          lines.push(`    - Whitelist: ${actor.permissions.network.whitelist.join(', ')}`);
        }
      }
    }

    lines.push('');

    // Add directory structure
    lines.push('## Directory Structure');
    lines.push('');
    lines.push('```');
    lines.push('input/       # Place input files here');
    lines.push('output/      # Output files will be generated here');
    lines.push('artifacts/   # Artifacts and intermediate files');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate observability config
   */
  private generateObservabilityConfig(observability: any): string {
    // FIXED (Bug #28): Validate observability is an object
    if (!observability || typeof observability !== 'object') {
      throw new Error('Observability must be an object for config generation');
    }

    const lines: string[] = [
      '# Observability Configuration',
      '# Generated by AutomatosX',
      ''
    ];

    if (observability.logs) {
      lines.push('logs:');
      lines.push(`  enabled: ${observability.logs.enabled}`);
      if (observability.logs.level) {
        lines.push(`  level: ${observability.logs.level}`);
      }
      if (observability.logs.format) {
        lines.push(`  format: ${observability.logs.format}`);
      }
      lines.push('');
    }

    if (observability.metrics) {
      lines.push('metrics:');
      lines.push(`  enabled: ${observability.metrics.enabled}`);
      if (observability.metrics.interval) {
        lines.push(`  interval: ${observability.metrics.interval}`);
      }
      lines.push('');
    }

    if (observability.audit) {
      lines.push('audit:');
      lines.push(`  enabled: ${observability.audit.enabled}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Sanitize actor ID to prevent path traversal
   * Only allows alphanumeric, dash, underscore
   */
  private sanitizeActorId(id: string): string {
    // Remove path separators and traversal sequences
    let sanitized = id.replace(/[\/\\\.]/g, '-');
    // Only allow alphanumeric, dash, underscore
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_]/g, '');
    // Ensure it's not empty
    if (!sanitized) {
      sanitized = 'actor';
    }
    return sanitized;
  }
}

/**
 * Default singleton instance
 */
let defaultScaffoldGenerator: ScaffoldGenerator | null = null;

/**
 * Get default scaffold generator instance (singleton)
 */
export function getDefaultScaffoldGenerator(): ScaffoldGenerator {
  if (!defaultScaffoldGenerator) {
    defaultScaffoldGenerator = new ScaffoldGenerator();
  }
  return defaultScaffoldGenerator;
}

/**
 * Convenience function: generate scaffold from spec
 */
export function generateScaffold(spec: SpecYAML, basePath: string): ScaffoldStructure {
  return getDefaultScaffoldGenerator().generate(spec, basePath);
}
