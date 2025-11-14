/**
 * Structure Builder
 *
 * Week 3-4 Implementation - Day 4
 * Builds project structure from workflow definitions
 */

import type {
  WorkflowDefinition,
  ScaffoldOptions,
  ProjectStructure,
  FileTemplate,
} from '../types/speckit.types.js';

/**
 * Structure Builder
 *
 * Responsible for determining which directories and files should be created
 * based on the workflow definition and scaffold options.
 */
export class StructureBuilder {
  /**
   * Build project structure from workflow and options
   */
  build(workflow: WorkflowDefinition, options: ScaffoldOptions): ProjectStructure {
    const template = options.template || 'standard';

    switch (template) {
      case 'minimal':
        return this.buildMinimal(workflow, options);
      case 'complete':
        return this.buildComplete(workflow, options);
      case 'standard':
      default:
        return this.buildStandard(workflow, options);
    }
  }

  /**
   * Build minimal structure (workflows and basic config only)
   */
  private buildMinimal(workflow: WorkflowDefinition, options: ScaffoldOptions): ProjectStructure {
    const directories = ['workflows', 'configs'];

    const fileTemplates: FileTemplate[] = [
      { path: 'workflows/main.yaml', template: 'workflow.yaml' },
      { path: 'configs/default.json', template: 'config.json' },
      { path: 'README.md', template: 'README.md' },
    ];

    return { directories, fileTemplates };
  }

  /**
   * Build standard structure (workflows, configs, scripts, docs)
   */
  private buildStandard(workflow: WorkflowDefinition, options: ScaffoldOptions): ProjectStructure {
    const directories = [
      'workflows',
      'configs',
      'scripts',
      'docs',
      'logs',
      'outputs',
    ];

    const fileTemplates: FileTemplate[] = [
      { path: 'workflows/main.yaml', template: 'workflow.yaml' },
      { path: 'configs/default.json', template: 'config.json' },
      { path: 'scripts/run.sh', template: 'run.sh', executable: true },
      { path: 'scripts/validate.sh', template: 'validate.sh', executable: true },
      { path: 'scripts/cleanup.sh', template: 'cleanup.sh', executable: true },
      { path: 'README.md', template: 'README.md' },
      { path: '.gitignore', template: '.gitignore' },
    ];

    // Add tests if requested
    if (options.includeTests) {
      directories.push('tests', 'tests/unit', 'tests/integration', 'tests/fixtures');
    }

    // Add CI/CD if requested
    if (options.includeCI) {
      directories.push('.github', '.github/workflows');
      fileTemplates.push({
        path: '.github/workflows/ci.yml',
        template: 'ci.yml',
      });
    }

    return { directories, fileTemplates };
  }

  /**
   * Build complete structure (everything including examples, docs, tests, CI)
   */
  private buildComplete(workflow: WorkflowDefinition, options: ScaffoldOptions): ProjectStructure {
    // Start with standard structure
    const structure = this.buildStandard(workflow, { ...options, includeTests: true, includeCI: true });

    // Add additional documentation
    structure.directories.push('docs/guides', 'docs/api');

    // Add examples
    if (options.includeExamples) {
      structure.directories.push('examples');
    }

    return structure;
  }
}
