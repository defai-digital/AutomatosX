/**
 * Template Renderer
 *
 * Week 3-4 Implementation - Day 4
 * Renders Handlebars templates with workflow context
 */
import type { WorkflowDefinition, ScaffoldOptions, ProjectStructure, RenderedFile } from '../types/speckit.types.js';
import { TemplateRegistry } from './TemplateRegistry.js';
/**
 * Template Renderer
 *
 * Responsible for rendering file templates with workflow context data.
 */
export declare class TemplateRenderer {
    private registry;
    constructor(registry: TemplateRegistry);
    /**
     * Render all file templates from project structure
     */
    render(structure: ProjectStructure, workflow: WorkflowDefinition, options: ScaffoldOptions): Promise<RenderedFile[]>;
    /**
     * Build template context from workflow and options
     */
    private buildContext;
}
//# sourceMappingURL=TemplateRenderer.d.ts.map