/**
 * Plugin Template Generator Tests
 * Sprint 6 Day 51: Template generator tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  PluginTemplateGenerator,
  createTemplateGenerator,
  getGlobalGenerator,
  resetGlobalGenerator,
  PluginCategory,
  PluginLanguage,
  type TemplateOptions,
  type TemplateFile,
} from '../../plugins/PluginTemplateGenerator.js'

describe('PluginTemplateGenerator', () => {
  let generator: PluginTemplateGenerator
  const testOutputDir = '/tmp/test-plugins'

  beforeEach(() => {
    generator = createTemplateGenerator()
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore errors
    }
  })

  describe('Options Validation', () => {
    it('should validate valid options', () => {
      const options: TemplateOptions = {
        name: 'my-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty name', () => {
      const options: TemplateOptions = {
        name: '',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Plugin name is required')
    })

    it('should reject invalid name format', () => {
      const options: TemplateOptions = {
        name: 'MyPlugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('lowercase letters')
    })

    it('should accept kebab-case names', () => {
      const options: TemplateOptions = {
        name: 'my-awesome-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(true)
    })

    it('should reject invalid category', () => {
      const options: any = {
        name: 'my-plugin',
        category: 'invalid',
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid category')
    })

    it('should reject invalid language', () => {
      const options: any = {
        name: 'my-plugin',
        category: PluginCategory.AGENT,
        language: 'invalid',
      }

      const result = generator.validateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Invalid language')
    })
  })

  describe('Template Retrieval', () => {
    it('should get agent TypeScript template', () => {
      const templates = generator.getTemplateFiles(
        PluginCategory.AGENT,
        PluginLanguage.TYPESCRIPT
      )

      expect(templates.length).toBeGreaterThan(0)
      expect(templates[0].path).toBe('src/index.ts')
    })

    it('should get tool TypeScript template', () => {
      const templates = generator.getTemplateFiles(
        PluginCategory.TOOL,
        PluginLanguage.TYPESCRIPT
      )

      expect(templates.length).toBeGreaterThan(0)
      expect(templates[0].path).toBe('src/index.ts')
    })

    it('should get workflow TypeScript template', () => {
      const templates = generator.getTemplateFiles(
        PluginCategory.WORKFLOW,
        PluginLanguage.TYPESCRIPT
      )

      expect(templates.length).toBeGreaterThan(0)
      expect(templates[0].path).toBe('src/index.ts')
    })

    it('should get hybrid TypeScript template', () => {
      const templates = generator.getTemplateFiles(
        PluginCategory.HYBRID,
        PluginLanguage.TYPESCRIPT
      )

      expect(templates.length).toBeGreaterThan(0)
      expect(templates[0].path).toBe('src/index.ts')
    })

    it('should return empty array for non-existent template', () => {
      const templates = generator.getTemplateFiles(
        PluginCategory.AGENT,
        PluginLanguage.PYTHON
      )

      expect(templates).toHaveLength(0)
    })
  })

  describe('Template Registration', () => {
    it('should register custom template', () => {
      const listener = vi.fn()
      generator.on('template-registered', listener)

      const customTemplate: TemplateFile[] = [
        {
          path: 'custom.ts',
          content: 'export default {}',
        },
      ]

      generator.registerTemplate(
        PluginCategory.AGENT,
        PluginLanguage.PYTHON,
        customTemplate
      )

      expect(listener).toHaveBeenCalledWith({
        category: PluginCategory.AGENT,
        language: PluginLanguage.PYTHON,
        fileCount: 1,
      })

      const templates = generator.getTemplateFiles(PluginCategory.AGENT, PluginLanguage.PYTHON)
      expect(templates).toEqual(customTemplate)
    })
  })

  describe('Template Generation', () => {
    it('should generate agent plugin', async () => {
      const listener = vi.fn()
      generator.on('generation-complete', listener)

      const options: TemplateOptions = {
        name: 'test-agent',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
        description: 'Test agent plugin',
        author: 'Test Author',
        version: '1.0.0',
      }

      const result = await generator.generate(options, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filesCreated.length).toBeGreaterThan(0)
      expect(listener).toHaveBeenCalled()

      // Verify files exist
      const indexPath = path.join(testOutputDir, 'test-agent', 'src/index.ts')
      const indexContent = await fs.readFile(indexPath, 'utf-8')
      expect(indexContent).toContain('TestAgent')
      expect(indexContent).toContain('Test agent plugin')
    })

    it('should emit file-created events', async () => {
      const listener = vi.fn()
      generator.on('file-created', listener)

      const options: TemplateOptions = {
        name: 'test-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      await generator.generate(options, testOutputDir)

      expect(listener).toHaveBeenCalled()
      expect(listener.mock.calls[0][0]).toMatchObject({
        path: expect.any(String),
        plugin: 'test-plugin',
      })
    })

    it('should generate with tests', async () => {
      const options: TemplateOptions = {
        name: 'test-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
        includeTests: true,
      }

      const result = await generator.generate(options, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filesCreated).toContain('__tests__/test-plugin.test.ts')

      const testPath = path.join(testOutputDir, 'test-plugin', '__tests__/test-plugin.test.ts')
      const testContent = await fs.readFile(testPath, 'utf-8')
      expect(testContent).toContain('TestPlugin')
    })

    it('should generate with docs', async () => {
      const options: TemplateOptions = {
        name: 'test-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
        includeDocs: true,
      }

      const result = await generator.generate(options, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filesCreated).toContain('README.md')

      const readmePath = path.join(testOutputDir, 'test-plugin', 'README.md')
      const readmeContent = await fs.readFile(readmePath, 'utf-8')
      expect(readmeContent).toContain('# TestPlugin')
    })

    it('should generate with examples', async () => {
      const options: TemplateOptions = {
        name: 'test-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
        includeExamples: true,
      }

      const result = await generator.generate(options, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filesCreated).toContain('examples/basic.ts')

      const examplePath = path.join(testOutputDir, 'test-plugin', 'examples/basic.ts')
      const exampleContent = await fs.readFile(examplePath, 'utf-8')
      expect(exampleContent).toContain('TestPlugin')
    })

    it('should fail on invalid options', async () => {
      const options: TemplateOptions = {
        name: '',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      const result = await generator.generate(options, testOutputDir)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('required')
    })

    it('should handle file write errors', async () => {
      const options: TemplateOptions = {
        name: 'test-plugin',
        category: PluginCategory.AGENT,
        language: PluginLanguage.TYPESCRIPT,
      }

      // Use invalid output directory
      const result = await generator.generate(options, '/invalid/path/that/does/not/exist')

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('Categories and Languages', () => {
    it('should return all categories', () => {
      const categories = generator.getCategories()

      expect(categories).toContain(PluginCategory.AGENT)
      expect(categories).toContain(PluginCategory.TOOL)
      expect(categories).toContain(PluginCategory.WORKFLOW)
      expect(categories).toContain(PluginCategory.HYBRID)
    })

    it('should return all languages', () => {
      const languages = generator.getLanguages()

      expect(languages).toContain(PluginLanguage.TYPESCRIPT)
      expect(languages).toContain(PluginLanguage.JAVASCRIPT)
      expect(languages).toContain(PluginLanguage.PYTHON)
    })
  })

  describe('Statistics', () => {
    it('should get statistics', () => {
      const stats = generator.getStatistics()

      expect(stats.totalCategories).toBeGreaterThan(0)
      expect(stats.totalLanguages).toBe(3)
      expect(stats.totalTemplates).toBeGreaterThan(0)
    })
  })

  describe('Global Generator', () => {
    beforeEach(() => {
      resetGlobalGenerator()
    })

    it('should get global generator', () => {
      const global = getGlobalGenerator()

      expect(global).toBeInstanceOf(PluginTemplateGenerator)
    })

    it('should return same instance', () => {
      const gen1 = getGlobalGenerator()
      const gen2 = getGlobalGenerator()

      expect(gen1).toBe(gen2)
    })

    it('should reset global generator', () => {
      const gen1 = getGlobalGenerator()

      resetGlobalGenerator()

      const gen2 = getGlobalGenerator()

      expect(gen2).not.toBe(gen1)
    })
  })
})
