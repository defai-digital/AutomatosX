/**
 * Handoff Documentation Generator
 * Sprint 6 Day 58: Generate comprehensive handoff documentation
 */

import { EventEmitter } from 'events'

/**
 * Documentation section
 */
export interface DocSection {
  id: string
  title: string
  content: string
  subsections?: DocSection[]
  codeExamples?: CodeExample[]
  links?: DocLink[]
}

/**
 * Code example
 */
export interface CodeExample {
  language: string
  code: string
  description?: string
  output?: string
}

/**
 * Documentation link
 */
export interface DocLink {
  text: string
  url: string
  type: 'internal' | 'external' | 'api'
}

/**
 * Documentation template
 */
export interface DocTemplate {
  id: string
  name: string
  description: string
  sections: DocSection[]
  variables?: Record<string, string>
}

/**
 * Generated documentation
 */
export interface GeneratedDoc {
  id: string
  title: string
  content: string
  format: 'markdown' | 'html' | 'pdf'
  generatedAt: number
  metadata: Record<string, unknown>
}

/**
 * Handoff Documentation Generator
 */
export class HandoffDocGenerator extends EventEmitter {
  private templates = new Map<string, DocTemplate>()
  private generated = new Map<string, GeneratedDoc>()
  private docCounter = 0

  constructor() {
    super()
    this.registerDefaultTemplates()
  }

  /**
   * Register default documentation templates
   */
  private registerDefaultTemplates(): void {
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
    })

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
    })

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
    })

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
    })
  }

  /**
   * Register documentation template
   */
  registerTemplate(template: DocTemplate): void {
    this.templates.set(template.id, template)

    this.emit('template-registered', {
      templateId: template.id,
      name: template.name,
    })
  }

  /**
   * Generate documentation from template
   */
  generate(templateId: string, variables?: Record<string, string>, format: 'markdown' | 'html' | 'pdf' = 'markdown'): GeneratedDoc {
    const template = this.templates.get(templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const docId = `doc-${++this.docCounter}`

    let content = this.renderTemplate(template, variables)

    if (format === 'html') {
      content = this.convertToHTML(content)
    } else if (format === 'pdf') {
      content = this.convertToPDF(content)
    }

    const doc: GeneratedDoc = {
      id: docId,
      title: template.name,
      content,
      format,
      generatedAt: Date.now(),
      metadata: {
        templateId,
        variables: variables || {},
      },
    }

    this.generated.set(docId, doc)

    this.emit('doc-generated', {
      docId,
      templateId,
      format,
    })

    return doc
  }

  /**
   * Render template to markdown
   */
  private renderTemplate(template: DocTemplate, variables?: Record<string, string>): string {
    const lines: string[] = []

    // Title
    lines.push(`# ${template.name}`)
    lines.push('')

    // Description
    if (template.description) {
      lines.push(template.description)
      lines.push('')
    }

    // Table of contents
    if (template.sections.length > 1) {
      lines.push('## Table of Contents')
      lines.push('')
      for (const section of template.sections) {
        lines.push(`- [${section.title}](#${this.slugify(section.title)})`)
      }
      lines.push('')
    }

    // Sections
    for (const section of template.sections) {
      lines.push(...this.renderSection(section, 2))
    }

    let content = lines.join('\n')

    // Apply variables
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
    }

    return content
  }

  /**
   * Render documentation section
   */
  private renderSection(section: DocSection, level: number): string[] {
    const lines: string[] = []

    // Section title
    lines.push(`${'#'.repeat(level)} ${section.title}`)
    lines.push('')

    // Section content
    if (section.content) {
      lines.push(section.content)
      lines.push('')
    }

    // Code examples
    if (section.codeExamples && section.codeExamples.length > 0) {
      for (const example of section.codeExamples) {
        if (example.description) {
          lines.push(example.description)
          lines.push('')
        }

        lines.push(`\`\`\`${example.language}`)
        lines.push(example.code)
        lines.push('```')
        lines.push('')

        if (example.output) {
          lines.push('Output:')
          lines.push('```')
          lines.push(example.output)
          lines.push('```')
          lines.push('')
        }
      }
    }

    // Links
    if (section.links && section.links.length > 0) {
      lines.push('**Related Links:**')
      for (const link of section.links) {
        lines.push(`- [${link.text}](${link.url})`)
      }
      lines.push('')
    }

    // Subsections
    if (section.subsections && section.subsections.length > 0) {
      for (const subsection of section.subsections) {
        lines.push(...this.renderSection(subsection, level + 1))
      }
    }

    return lines
  }

  /**
   * Convert markdown to HTML
   */
  private convertToHTML(markdown: string): string {
    // Simplified markdown to HTML conversion
    // In production, use a proper markdown library
    let html = markdown

    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')

    // Code blocks
    html = html.replace(/```(\w+)\n([\s\S]+?)```/g, '<pre><code class="language-$1">$2</code></pre>')

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>')
    html = `<p>${html}</p>`

    return html
  }

  /**
   * Convert markdown to PDF metadata
   */
  private convertToPDF(markdown: string): string {
    // In production, this would generate actual PDF
    // For now, return metadata for PDF generation
    return `[PDF] ${markdown.substring(0, 100)}... (${markdown.length} chars)`
  }

  /**
   * Create slug from text
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
  }

  /**
   * Get template
   */
  getTemplate(templateId: string): DocTemplate | undefined {
    return this.templates.get(templateId)
  }

  /**
   * Get all templates
   */
  getAllTemplates(): DocTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * Get generated document
   */
  getDocument(docId: string): GeneratedDoc | undefined {
    return this.generated.get(docId)
  }

  /**
   * Get all generated documents
   */
  getAllDocuments(): GeneratedDoc[] {
    return Array.from(this.generated.values())
  }

  /**
   * Clear all generated documents
   */
  clearAll(): void {
    this.generated.clear()
    this.docCounter = 0
    this.emit('all-cleared')
  }
}

/**
 * Create handoff doc generator
 */
export function createHandoffDocGenerator(): HandoffDocGenerator {
  return new HandoffDocGenerator()
}

/**
 * Global handoff doc generator
 */
let globalGenerator: HandoffDocGenerator | null = null

/**
 * Get global handoff doc generator
 */
export function getGlobalHandoffDocGenerator(): HandoffDocGenerator {
  if (!globalGenerator) {
    globalGenerator = createHandoffDocGenerator()
  }
  return globalGenerator
}

/**
 * Reset global handoff doc generator
 */
export function resetGlobalHandoffDocGenerator(): void {
  globalGenerator = null
}
