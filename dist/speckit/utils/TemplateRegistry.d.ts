/**
 * Template Registry
 *
 * Week 3-4 Implementation - Day 4
 * Manages Handlebars templates for scaffold generation
 */
/**
 * Template Registry
 *
 * Manages template registration, compilation, and retrieval for scaffold generation.
 * Uses Handlebars for template rendering with custom helpers.
 */
export declare class TemplateRegistry {
    private templates;
    constructor();
    /**
     * Register custom Handlebars helpers
     */
    private registerHelpers;
    /**
     * Register built-in templates
     */
    private registerBuiltInTemplates;
    /**
     * Register a template
     */
    register(name: string, template: string | HandlebarsTemplateDelegate): void;
    /**
     * Get a compiled template
     */
    getTemplate(name: string): HandlebarsTemplateDelegate;
    /**
     * Check if template exists
     */
    hasTemplate(name: string): boolean;
    /**
     * List all registered templates
     */
    listTemplates(): string[];
}
//# sourceMappingURL=TemplateRegistry.d.ts.map