/**
 * Handoff Documentation Generator Tests
 * Sprint 6 Day 58: Documentation generation tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  HandoffDocGenerator,
  createHandoffDocGenerator,
  getGlobalHandoffDocGenerator,
  resetGlobalHandoffDocGenerator,
  type DocTemplate,
} from '../../documentation/HandoffDocGenerator.js'

describe('HandoffDocGenerator', () => {
  let generator: HandoffDocGenerator

  beforeEach(() => {
    generator = createHandoffDocGenerator()
  })

  describe('Default Templates', () => {
    it('should have architecture overview template', () => {
      const template = generator.getTemplate('architecture-overview')

      expect(template).toBeDefined()
      expect(template?.name).toBe('Architecture Overview')
      expect(template?.sections.length).toBeGreaterThan(0)
    })

    it('should have API reference template', () => {
      const template = generator.getTemplate('api-reference')

      expect(template).toBeDefined()
      expect(template?.name).toBe('API Reference')
    })

    it('should have quick start template', () => {
      const template = generator.getTemplate('quick-start')

      expect(template).toBeDefined()
      expect(template?.name).toBe('Quick Start Guide')
    })

    it('should have troubleshooting template', () => {
      const template = generator.getTemplate('troubleshooting')

      expect(template).toBeDefined()
      expect(template?.name).toBe('Troubleshooting Guide')
    })

    it('should have at least 4 default templates', () => {
      const allTemplates = generator.getAllTemplates()

      expect(allTemplates.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('Template Registration', () => {
    it('should register custom template', () => {
      const listener = vi.fn()
      generator.on('template-registered', listener)

      const customTemplate: DocTemplate = {
        id: 'custom',
        name: 'Custom Template',
        description: 'Test template',
        sections: [
          {
            id: 'section1',
            title: 'Section 1',
            content: 'Test content',
          },
        ],
      }

      generator.registerTemplate(customTemplate)

      const retrieved = generator.getTemplate('custom')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Custom Template')
      expect(listener).toHaveBeenCalled()
    })

    it('should emit template-registered event', () => {
      const listener = vi.fn()
      generator.on('template-registered', listener)

      const template: DocTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        sections: [],
      }

      generator.registerTemplate(template)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'test',
          name: 'Test',
        })
      )
    })
  })

  describe('Document Generation', () => {
    it('should generate markdown document', () => {
      const listener = vi.fn()
      generator.on('doc-generated', listener)

      const doc = generator.generate('quick-start')

      expect(doc.format).toBe('markdown')
      expect(doc.content).toContain('# Quick Start Guide')
      expect(doc.content).toContain('Installation')
      expect(listener).toHaveBeenCalled()
    })

    it('should generate HTML document', () => {
      const doc = generator.generate('quick-start', undefined, 'html')

      expect(doc.format).toBe('html')
      expect(doc.content).toContain('<h1>')
      expect(doc.content).toContain('</h1>')
    })

    it('should generate PDF metadata', () => {
      const doc = generator.generate('quick-start', undefined, 'pdf')

      expect(doc.format).toBe('pdf')
      expect(doc.content).toContain('[PDF]')
    })

    it('should throw error for non-existent template', () => {
      expect(() => generator.generate('non-existent')).toThrow('Template not found')
    })

    it('should include metadata in generated doc', () => {
      const doc = generator.generate('quick-start')

      expect(doc.metadata).toBeDefined()
      expect(doc.metadata.templateId).toBe('quick-start')
      expect(doc.generatedAt).toBeGreaterThan(0)
    })
  })

  describe('Variable Substitution', () => {
    it('should substitute variables in template', () => {
      const template: DocTemplate = {
        id: 'var-test',
        name: 'Variable Test',
        description: 'Test {{variable}}',
        sections: [
          {
            id: 's1',
            title: 'Section',
            content: 'Hello {{name}}!',
          },
        ],
        variables: {
          variable: 'placeholder',
          name: 'World',
        },
      }

      generator.registerTemplate(template)

      const doc = generator.generate('var-test', {
        variable: 'substitution',
        name: 'AutomatosX',
      })

      expect(doc.content).toContain('substitution')
      expect(doc.content).toContain('Hello AutomatosX!')
    })
  })

  describe('Section Rendering', () => {
    it('should render sections with headers', () => {
      const doc = generator.generate('architecture-overview')

      expect(doc.content).toContain('## Introduction')
      expect(doc.content).toContain('## System Architecture')
    })

    it('should render subsections', () => {
      const doc = generator.generate('architecture-overview')

      expect(doc.content).toContain('### Architecture Layers')
    })

    it('should render code examples', () => {
      const doc = generator.generate('api-reference')

      expect(doc.content).toContain('```typescript')
      expect(doc.content).toContain('```')
    })

    it('should include table of contents for multi-section docs', () => {
      const doc = generator.generate('architecture-overview')

      expect(doc.content).toContain('## Table of Contents')
    })
  })

  describe('Document Queries', () => {
    it('should get generated document by ID', () => {
      const generated = generator.generate('quick-start')

      const retrieved = generator.getDocument(generated.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(generated.id)
    })

    it('should get all generated documents', () => {
      generator.generate('quick-start')
      generator.generate('troubleshooting')

      const allDocs = generator.getAllDocuments()

      expect(allDocs.length).toBe(2)
    })

    it('should return undefined for non-existent document', () => {
      const doc = generator.getDocument('non-existent')

      expect(doc).toBeUndefined()
    })
  })

  describe('Template Queries', () => {
    it('should get all templates', () => {
      const allTemplates = generator.getAllTemplates()

      expect(allTemplates.length).toBeGreaterThan(0)
      expect(allTemplates.some((t) => t.id === 'quick-start')).toBe(true)
    })

    it('should return undefined for non-existent template', () => {
      const template = generator.getTemplate('non-existent')

      expect(template).toBeUndefined()
    })
  })

  describe('Clear Operations', () => {
    it('should clear all generated documents', () => {
      const listener = vi.fn()
      generator.on('all-cleared', listener)

      generator.generate('quick-start')
      generator.generate('troubleshooting')

      generator.clearAll()

      const allDocs = generator.getAllDocuments()

      expect(allDocs.length).toBe(0)
      expect(listener).toHaveBeenCalled()
    })

    it('should reset document counter after clear', () => {
      generator.generate('quick-start')
      generator.clearAll()

      const doc = generator.generate('quick-start')

      expect(doc.id).toBe('doc-1') // Counter reset
    })
  })

  describe('Global Handoff Doc Generator', () => {
    beforeEach(() => {
      resetGlobalHandoffDocGenerator()
    })

    it('should get global generator', () => {
      const global = getGlobalHandoffDocGenerator()

      expect(global).toBeInstanceOf(HandoffDocGenerator)
    })

    it('should return same instance', () => {
      const generator1 = getGlobalHandoffDocGenerator()
      const generator2 = getGlobalHandoffDocGenerator()

      expect(generator1).toBe(generator2)
    })

    it('should reset global generator', () => {
      const generator1 = getGlobalHandoffDocGenerator()

      resetGlobalHandoffDocGenerator()

      const generator2 = getGlobalHandoffDocGenerator()

      expect(generator2).not.toBe(generator1)
    })
  })
})
