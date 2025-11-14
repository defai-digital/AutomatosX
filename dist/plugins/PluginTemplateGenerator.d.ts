/**
 * Plugin Template Generator
 * Sprint 6 Day 51: Enhanced template generator with category selection
 */
import { EventEmitter } from 'events';
/**
 * Plugin category
 */
export declare enum PluginCategory {
    AGENT = "agent",
    TOOL = "tool",
    WORKFLOW = "workflow",
    HYBRID = "hybrid"
}
/**
 * Plugin language
 */
export declare enum PluginLanguage {
    TYPESCRIPT = "typescript",
    JAVASCRIPT = "javascript",
    PYTHON = "python"
}
/**
 * Plugin template options
 */
export interface TemplateOptions {
    name: string;
    category: PluginCategory;
    language: PluginLanguage;
    description?: string;
    author?: string;
    version?: string;
    includeTests?: boolean;
    includeDocs?: boolean;
    includeExamples?: boolean;
}
/**
 * Template file
 */
export interface TemplateFile {
    path: string;
    content: string;
}
/**
 * Template generation result
 */
export interface GenerationResult {
    success: boolean;
    outputPath: string;
    filesCreated: string[];
    errors?: string[];
}
/**
 * Plugin template generator
 */
export declare class PluginTemplateGenerator extends EventEmitter {
    private templates;
    constructor();
    /**
     * Generate plugin from template
     */
    generate(options: TemplateOptions, outputDir: string): Promise<GenerationResult>;
    /**
     * Validate template options
     */
    validateOptions(options: TemplateOptions): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Get template files for category and language
     */
    getTemplateFiles(category: PluginCategory, language: PluginLanguage): TemplateFile[];
    /**
     * Interpolate template with options
     */
    private interpolateTemplate;
    /**
     * Convert kebab-case to PascalCase
     */
    private toPascalCase;
    /**
     * Generate test files
     */
    private generateTestFiles;
    /**
     * Generate documentation files
     */
    private generateDocFiles;
    /**
     * Generate example files
     */
    private generateExampleFiles;
    /**
     * Register custom template
     */
    registerTemplate(category: PluginCategory, language: PluginLanguage, files: TemplateFile[]): void;
    /**
     * Get available categories
     */
    getCategories(): PluginCategory[];
    /**
     * Get available languages
     */
    getLanguages(): PluginLanguage[];
    /**
     * Get template statistics
     */
    getStatistics(): {
        totalCategories: number;
        totalLanguages: number;
        totalTemplates: number;
    };
    /**
     * Initialize built-in templates
     */
    private initializeBuiltInTemplates;
}
/**
 * Create plugin template generator
 */
export declare function createTemplateGenerator(): PluginTemplateGenerator;
/**
 * Get global template generator
 */
export declare function getGlobalGenerator(): PluginTemplateGenerator;
/**
 * Reset global template generator
 */
export declare function resetGlobalGenerator(): void;
//# sourceMappingURL=PluginTemplateGenerator.d.ts.map