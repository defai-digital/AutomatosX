/**
 * Handoff Documentation Generator
 * Sprint 6 Day 58: Generate comprehensive handoff documentation
 */
import { EventEmitter } from 'events';
/**
 * Documentation section
 */
export interface DocSection {
    id: string;
    title: string;
    content: string;
    subsections?: DocSection[];
    codeExamples?: CodeExample[];
    links?: DocLink[];
}
/**
 * Code example
 */
export interface CodeExample {
    language: string;
    code: string;
    description?: string;
    output?: string;
}
/**
 * Documentation link
 */
export interface DocLink {
    text: string;
    url: string;
    type: 'internal' | 'external' | 'api';
}
/**
 * Documentation template
 */
export interface DocTemplate {
    id: string;
    name: string;
    description: string;
    sections: DocSection[];
    variables?: Record<string, string>;
}
/**
 * Generated documentation
 */
export interface GeneratedDoc {
    id: string;
    title: string;
    content: string;
    format: 'markdown' | 'html' | 'pdf';
    generatedAt: number;
    metadata: Record<string, unknown>;
}
/**
 * Handoff Documentation Generator
 */
export declare class HandoffDocGenerator extends EventEmitter {
    private templates;
    private generated;
    private docCounter;
    constructor();
    /**
     * Register default documentation templates
     */
    private registerDefaultTemplates;
    /**
     * Register documentation template
     */
    registerTemplate(template: DocTemplate): void;
    /**
     * Generate documentation from template
     */
    generate(templateId: string, variables?: Record<string, string>, format?: 'markdown' | 'html' | 'pdf'): GeneratedDoc;
    /**
     * Render template to markdown
     */
    private renderTemplate;
    /**
     * Render documentation section
     */
    private renderSection;
    /**
     * Convert markdown to HTML
     */
    private convertToHTML;
    /**
     * Convert markdown to PDF metadata
     */
    private convertToPDF;
    /**
     * Create slug from text
     */
    private slugify;
    /**
     * Get template
     */
    getTemplate(templateId: string): DocTemplate | undefined;
    /**
     * Get all templates
     */
    getAllTemplates(): DocTemplate[];
    /**
     * Get generated document
     */
    getDocument(docId: string): GeneratedDoc | undefined;
    /**
     * Get all generated documents
     */
    getAllDocuments(): GeneratedDoc[];
    /**
     * Clear all generated documents
     */
    clearAll(): void;
}
/**
 * Create handoff doc generator
 */
export declare function createHandoffDocGenerator(): HandoffDocGenerator;
/**
 * Get global handoff doc generator
 */
export declare function getGlobalHandoffDocGenerator(): HandoffDocGenerator;
/**
 * Reset global handoff doc generator
 */
export declare function resetGlobalHandoffDocGenerator(): void;
//# sourceMappingURL=HandoffDocGenerator.d.ts.map