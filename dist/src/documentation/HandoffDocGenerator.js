/**
 * Handoff Documentation Generator
 * Sprint 6 Day 58: Generate comprehensive handoff documentation
 */
import { EventEmitter } from 'events';
/**
 * Handoff Documentation Generator
 */
export class HandoffDocGenerator extends EventEmitter {
    templates = new Map();
    generated = new Map();
    docCounter = 0;
    constructor() {
        super();
        this.registerDefaultTemplates();
    }
    /**
     * Register default documentation templates
     */
    registerDefaultTemplates() {
        // Architecture Overview Template
        this.registerTemplate({
            id: 'architecture-overview',
            name: 'Architecture Overview',
            description: 'High-level system architecture documentation',
            sections: [
                {
                    id: 'intro',
                    title: 'Introduction',
                    content: `AutomatosX v2 is a production-ready code intelligence system with Tree-sitter parsing, SQLite FTS5 search, and multi-language support.

This document provides a comprehensive overview of the system architecture, key components, and integration points.`,
                },
                {
                    id: 'architecture',
                    title: 'System Architecture',
                    content: `The system follows a hybrid ReScript + TypeScript architecture:

**ReScript Core**: State machines for deterministic task orchestration
**TypeScript Layer**: CLI framework, code intelligence, service layer
**Database**: SQLite with FTS5 full-text search
**Parsers**: Tree-sitter based language parsers`,
                    subsections: [
                        {
                            id: 'layers',
                            title: 'Architecture Layers',
                            content: `1. **Database Layer**: SQLite with DAOs (FileDAO, SymbolDAO, ChunkDAO)
2. **Parser Layer**: Language-specific Tree-sitter parsers
3. **Service Layer**: High-level orchestration (FileService, QueryRouter)
4. **CLI Layer**: User-facing commands (find, def, flow, lint)`,
                        },
                    ],
                },
                {
                    id: 'data-flow',
                    title: 'Data Flow',
                    content: `**Indexing Pipeline**:
File → Parser (Tree-sitter AST) → Extract symbols/chunks → DAO → SQLite

**Query Pipeline**:
User Query → QueryRouter (intent) → FileService → DAO → SQLite FTS5 → Results`,
                },
            ],
        });
        // API Reference Template
        this.registerTemplate({
            id: 'api-reference',
            name: 'API Reference',
            description: 'Complete API reference documentation',
            sections: [
                {
                    id: 'overview',
                    title: 'API Overview',
                    content: `AutomatosX provides a comprehensive TypeScript API for code intelligence operations.

All APIs follow consistent patterns:
- Factory functions for creating instances
- Global singletons for convenience
- Event-driven architecture
- Full type safety with TypeScript`,
                },
                {
                    id: 'core-apis',
                    title: 'Core APIs',
                    content: 'Core code intelligence APIs',
                    subsections: [
                        {
                            id: 'file-service',
                            title: 'FileService',
                            content: 'High-level file indexing and search operations',
                            codeExamples: [
                                {
                                    language: 'typescript',
                                    description: 'Index files and search',
                                    code: `import { FileService } from '@automatosx/services'

const service = new FileService()

// Index directory
await service.indexDirectory('./src')

// Search for symbols
const results = await service.search('getUserById', {
  limit: 10,
  filters: { language: 'typescript', kind: 'function' }
})`,
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        // Quick Start Guide Template
        this.registerTemplate({
            id: 'quick-start',
            name: 'Quick Start Guide',
            description: 'Getting started guide for new developers',
            sections: [
                {
                    id: 'installation',
                    title: 'Installation',
                    content: 'Install AutomatosX globally:',
                    codeExamples: [
                        {
                            language: 'bash',
                            code: 'npm install -g @defai.digital/automatosx',
                        },
                    ],
                },
                {
                    id: 'first-steps',
                    title: 'First Steps',
                    content: 'Index your codebase and perform your first search',
                    codeExamples: [
                        {
                            language: 'bash',
                            description: 'Index your project',
                            code: 'cd /path/to/project\nax index ./src',
                        },
                        {
                            language: 'bash',
                            description: 'Search for code',
                            code: 'ax find "getUserById"',
                        },
                    ],
                },
            ],
        });
        // Troubleshooting Guide Template
        this.registerTemplate({
            id: 'troubleshooting',
            name: 'Troubleshooting Guide',
            description: 'Common issues and solutions',
            sections: [
                {
                    id: 'intro',
                    title: 'Troubleshooting',
                    content: 'Solutions to common issues and errors',
                },
                {
                    id: 'database-issues',
                    title: 'Database Issues',
                    content: `**Database Connection Failed (DB-001)**
- Check database file permissions
- Verify database path in configuration
- Ensure disk space is available
- Try reindexing: ax index --rebuild`,
                },
                {
                    id: 'performance',
                    title: 'Performance Issues',
                    content: `**Slow Search Performance**
- Enable caching in configuration
- Use filters to narrow results (--lang, --kind, --file)
- Check cache hit rate: ax status --verbose
- Rebuild index if corrupted: ax index --rebuild`,
                },
            ],
        });
    }
    /**
     * Register documentation template
     */
    registerTemplate(template) {
        this.templates.set(template.id, template);
        this.emit('template-registered', {
            templateId: template.id,
            name: template.name,
        });
    }
    /**
     * Generate documentation from template
     */
    generate(templateId, variables, format = 'markdown') {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        const docId = `doc-${++this.docCounter}`;
        let content = this.renderTemplate(template, variables);
        if (format === 'html') {
            content = this.convertToHTML(content);
        }
        else if (format === 'pdf') {
            content = this.convertToPDF(content);
        }
        const doc = {
            id: docId,
            title: template.name,
            content,
            format,
            generatedAt: Date.now(),
            metadata: {
                templateId,
                variables: variables || {},
            },
        };
        this.generated.set(docId, doc);
        this.emit('doc-generated', {
            docId,
            templateId,
            format,
        });
        return doc;
    }
    /**
     * Render template to markdown
     */
    renderTemplate(template, variables) {
        const lines = [];
        // Title
        lines.push(`# ${template.name}`);
        lines.push('');
        // Description
        if (template.description) {
            lines.push(template.description);
            lines.push('');
        }
        // Table of contents
        if (template.sections.length > 1) {
            lines.push('## Table of Contents');
            lines.push('');
            for (const section of template.sections) {
                lines.push(`- [${section.title}](#${this.slugify(section.title)})`);
            }
            lines.push('');
        }
        // Sections
        for (const section of template.sections) {
            lines.push(...this.renderSection(section, 2));
        }
        let content = lines.join('\n');
        // Apply variables
        if (variables) {
            for (const [key, value] of Object.entries(variables)) {
                content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
        }
        return content;
    }
    /**
     * Render documentation section
     */
    renderSection(section, level) {
        const lines = [];
        // Section title
        lines.push(`${'#'.repeat(level)} ${section.title}`);
        lines.push('');
        // Section content
        if (section.content) {
            lines.push(section.content);
            lines.push('');
        }
        // Code examples
        if (section.codeExamples && section.codeExamples.length > 0) {
            for (const example of section.codeExamples) {
                if (example.description) {
                    lines.push(example.description);
                    lines.push('');
                }
                lines.push(`\`\`\`${example.language}`);
                lines.push(example.code);
                lines.push('```');
                lines.push('');
                if (example.output) {
                    lines.push('Output:');
                    lines.push('```');
                    lines.push(example.output);
                    lines.push('```');
                    lines.push('');
                }
            }
        }
        // Links
        if (section.links && section.links.length > 0) {
            lines.push('**Related Links:**');
            for (const link of section.links) {
                lines.push(`- [${link.text}](${link.url})`);
            }
            lines.push('');
        }
        // Subsections
        if (section.subsections && section.subsections.length > 0) {
            for (const subsection of section.subsections) {
                lines.push(...this.renderSection(subsection, level + 1));
            }
        }
        return lines;
    }
    /**
     * Convert markdown to HTML
     */
    convertToHTML(markdown) {
        // Simplified markdown to HTML conversion
        // In production, use a proper markdown library
        let html = markdown;
        // Headers
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        // Code blocks
        html = html.replace(/```(\w+)\n([\s\S]+?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Links
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = `<p>${html}</p>`;
        return html;
    }
    /**
     * Convert markdown to PDF metadata
     */
    convertToPDF(markdown) {
        // In production, this would generate actual PDF
        // For now, return metadata for PDF generation
        return `[PDF] ${markdown.substring(0, 100)}... (${markdown.length} chars)`;
    }
    /**
     * Create slug from text
     */
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }
    /**
     * Get template
     */
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    /**
     * Get all templates
     */
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * Get generated document
     */
    getDocument(docId) {
        return this.generated.get(docId);
    }
    /**
     * Get all generated documents
     */
    getAllDocuments() {
        return Array.from(this.generated.values());
    }
    /**
     * Clear all generated documents
     */
    clearAll() {
        this.generated.clear();
        this.docCounter = 0;
        this.emit('all-cleared');
    }
}
/**
 * Create handoff doc generator
 */
export function createHandoffDocGenerator() {
    return new HandoffDocGenerator();
}
/**
 * Global handoff doc generator
 */
let globalGenerator = null;
/**
 * Get global handoff doc generator
 */
export function getGlobalHandoffDocGenerator() {
    if (!globalGenerator) {
        globalGenerator = createHandoffDocGenerator();
    }
    return globalGenerator;
}
/**
 * Reset global handoff doc generator
 */
export function resetGlobalHandoffDocGenerator() {
    globalGenerator = null;
}
//# sourceMappingURL=HandoffDocGenerator.js.map