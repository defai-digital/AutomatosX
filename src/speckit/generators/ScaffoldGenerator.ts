/**
 * Scaffold Generator
 *
 * Week 3-4 Implementation - Day 4
 * Generates complete project structures from workflow definitions
 */

import type {
  WorkflowDefinition,
  ScaffoldOptions,
  ScaffoldResult,
} from '../types/speckit.types.js';
import { StructureBuilder } from '../utils/StructureBuilder.js';
import { TemplateRegistry } from '../utils/TemplateRegistry.js';
import { TemplateRenderer } from '../utils/TemplateRenderer.js';
import { FileWriter } from '../utils/FileWriter.js';

/**
 * Scaffold Generator
 *
 * Main class for generating project scaffolds from workflow definitions.
 * Orchestrates structure building, template rendering, and file writing.
 */
export class ScaffoldGenerator {
  private structureBuilder: StructureBuilder;
  private templateRegistry: TemplateRegistry;
  private templateRenderer: TemplateRenderer;
  private fileWriter: FileWriter;

  constructor() {
    this.structureBuilder = new StructureBuilder();
    this.templateRegistry = new TemplateRegistry();
    this.templateRenderer = new TemplateRenderer(this.templateRegistry);
    this.fileWriter = new FileWriter();
  }

  /**
   * Generate scaffold from workflow definition
   */
  async generateScaffold(
    workflow: WorkflowDefinition,
    options: ScaffoldOptions = {}
  ): Promise<ScaffoldResult> {
    // Validate workflow
    this.validateWorkflow(workflow);

    // Build project structure
    const structure = this.structureBuilder.build(workflow, options);

    // Render templates
    const files = await this.templateRenderer.render(structure, workflow, options);

    // Write files
    const result = await this.fileWriter.write(structure, files, options);

    return result;
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.name) {
      throw new Error('Workflow must have a name');
    }

    if (!workflow.version) {
      throw new Error('Workflow must have a version');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (!step.id) {
        throw new Error('All steps must have an id');
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }

      stepIds.add(step.id);
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        }
      }
    }
  }

  /**
   * Get template registry (for custom template registration)
   */
  getTemplateRegistry(): TemplateRegistry {
    return this.templateRegistry;
  }
}
