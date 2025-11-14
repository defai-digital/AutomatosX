/**
 * Template Renderer
 *
 * Week 3-4 Implementation - Day 4
 * Renders Handlebars templates with workflow context
 */

import type {
  WorkflowDefinition,
  ScaffoldOptions,
  ProjectStructure,
  RenderedFile,
  TemplateContext,
} from '../types/speckit.types.js';
import { TemplateRegistry } from './TemplateRegistry.js';

/**
 * Template Renderer
 *
 * Responsible for rendering file templates with workflow context data.
 */
export class TemplateRenderer {
  constructor(private registry: TemplateRegistry) {}

  /**
   * Render all file templates from project structure
   */
  async render(
    structure: ProjectStructure,
    workflow: WorkflowDefinition,
    options: ScaffoldOptions
  ): Promise<RenderedFile[]> {
    const context = this.buildContext(workflow, options);
    const files: RenderedFile[] = [];

    for (const fileTemplate of structure.fileTemplates) {
      try {
        const template = this.registry.getTemplate(fileTemplate.template);
        const content = template(context);

        files.push({
          path: fileTemplate.path,
          content,
          executable: fileTemplate.executable,
        });
      } catch (error) {
        throw new Error(
          `Failed to render template '${fileTemplate.template}' for file '${fileTemplate.path}': ${(error as Error).message}`
        );
      }
    }

    return files;
  }

  /**
   * Build template context from workflow and options
   */
  private buildContext(workflow: WorkflowDefinition, options: ScaffoldOptions): TemplateContext {
    return {
      workflow: {
        name: workflow.name,
        version: workflow.version,
        description: workflow.description,
        steps: workflow.steps,
        stepCount: workflow.steps.length,
      },
      options: {
        includeTests: options.includeTests || false,
        includeCI: options.includeCI || false,
        includeDocs: options.includeDocs !== false, // Default true
      },
      timestamp: new Date().toISOString(),
      generator: 'AutomatosX v8.0.0',
    };
  }
}
