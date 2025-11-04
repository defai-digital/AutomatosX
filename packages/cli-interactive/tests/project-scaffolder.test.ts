/**
 * Tests for ProjectScaffolder
 * Phase 4: Build Systems, Environment Management, and Project Scaffolding
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectScaffolder } from '../src/project-scaffolder.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));

describe('ProjectScaffolder', () => {
  let scaffolder: ProjectScaffolder;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    scaffolder = new ProjectScaffolder(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Template Listing', () => {
    it('should list all available templates', () => {
      const templates = scaffolder.listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.name && t.description)).toBe(true);
    });

    it('should include React template', () => {
      const templates = scaffolder.listTemplates();
      const react = templates.find(t => t.name === 'react');

      expect(react).toBeDefined();
      expect(react?.description).toContain('React');
      expect(react?.dependencies?.react).toBeDefined();
    });

    it('should include Vue template', () => {
      const templates = scaffolder.listTemplates();
      const vue = templates.find(t => t.name === 'vue');

      expect(vue).toBeDefined();
      expect(vue?.description).toContain('Vue');
      expect(vue?.dependencies?.vue).toBeDefined();
    });

    it('should include Express template', () => {
      const templates = scaffolder.listTemplates();
      const express = templates.find(t => t.name === 'express');

      expect(express).toBeDefined();
      expect(express?.description).toContain('Express');
      expect(express?.dependencies?.express).toBeDefined();
    });

    it('should include TypeScript template', () => {
      const templates = scaffolder.listTemplates();
      const ts = templates.find(t => t.name === 'typescript');

      expect(ts).toBeDefined();
      expect(ts?.description).toContain('TypeScript');
    });

    it('should include Node template', () => {
      const templates = scaffolder.listTemplates();
      const node = templates.find(t => t.name === 'node');

      expect(node).toBeDefined();
      expect(node?.description).toContain('Node.js');
    });

    it('should have proper dependencies for each template', () => {
      const templates = scaffolder.listTemplates();

      templates.forEach(template => {
        expect(template.dependencies || template.devDependencies).toBeDefined();
      });
    });
  });

  describe('Project Creation', () => {
    it('should throw error for non-existent template', async () => {
      await expect(
        scaffolder.createProject({
          name: 'test-app',
          template: 'non-existent',
          install: false,
          git: false
        })
      ).rejects.toThrow('Template not found');
    });

    it('should throw error if directory already exists', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);

      await expect(
        scaffolder.createProject({
          name: 'existing-app',
          template: 'react',
          install: false,
          git: false
        })
      ).rejects.toThrow('Directory already exists');
    });

    it('should create React project successfully', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'my-react-app',
        template: 'react',
        install: false,
        git: false
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();

      // Verify package.json was written
      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const packageJsonCall = writeFileCalls.find(call =>
        call[0].toString().includes('package.json')
      );
      expect(packageJsonCall).toBeDefined();
    });

    it('should create Vue project successfully', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'my-vue-app',
        template: 'vue',
        install: false,
        git: false
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should create Express project successfully', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'my-api',
        template: 'express',
        install: false,
        git: false
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should create TypeScript project successfully', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'my-lib',
        template: 'typescript',
        install: false,
        git: false
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should create Node project successfully', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'my-node-app',
        template: 'node',
        install: false,
        git: false
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should create .gitignore file', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'test-app',
        template: 'react',
        install: false,
        git: false
      });

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const gitignoreCall = writeFileCalls.find(call =>
        call[0].toString().includes('.gitignore')
      );
      expect(gitignoreCall).toBeDefined();
    });

    it('should create README.md file', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'test-app',
        template: 'react',
        install: false,
        git: false
      });

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const readmeCall = writeFileCalls.find(call =>
        call[0].toString().includes('README.md')
      );
      expect(readmeCall).toBeDefined();
    });

    it('should include project name in package.json', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.createProject({
        name: 'custom-name',
        template: 'react',
        install: false,
        git: false
      });

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const packageJsonCall = writeFileCalls.find(call =>
        call[0].toString().includes('package.json')
      );

      expect(packageJsonCall).toBeDefined();
      const content = packageJsonCall![1] as string;
      expect(content).toContain('custom-name');
    });
  });

  describe('Component Scaffolding', () => {
    it('should scaffold a component', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);

      await scaffolder.scaffoldComponent({
        name: 'Button',
        type: 'component'
      });

      expect(writeFileSync).toHaveBeenCalled();

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const componentCall = writeFileCalls.find(call =>
        call[0].toString().includes('Button')
      );
      expect(componentCall).toBeDefined();
    });

    it('should scaffold a test file', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);

      await scaffolder.scaffoldComponent({
        name: 'utils',
        type: 'test'
      });

      expect(writeFileSync).toHaveBeenCalled();

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const testCall = writeFileCalls.find(call =>
        call[0].toString().includes('.test.')
      );
      expect(testCall).toBeDefined();
    });

    it('should create directory if it does not exist', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await scaffolder.scaffoldComponent({
        name: 'Button',
        type: 'component'
      });

      expect(mkdirSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('should use custom path if provided', async () => {
      const { existsSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);

      await scaffolder.scaffoldComponent({
        name: 'Button',
        type: 'component',
        path: 'src/components/ui'
      });

      const writeFileCalls = vi.mocked(writeFileSync).mock.calls;
      const componentCall = writeFileCalls.find(call =>
        call[0].toString().includes('src/components/ui')
      );
      expect(componentCall).toBeDefined();
    });
  });

  describe('Template File Generation', () => {
    it('should generate file with variable substitution', async () => {
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const vars = { name: 'John', project: 'Test' };

      const result = await scaffolder.generateFile(template, vars);

      expect(result).toBe('Hello John, welcome to Test!');
    });

    it('should handle multiple occurrences of same variable', async () => {
      const template = '{{name}} says hello to {{name}}';
      const vars = { name: 'Alice' };

      const result = await scaffolder.generateFile(template, vars);

      expect(result).toBe('Alice says hello to Alice');
    });

    it('should handle empty template', async () => {
      const template = '';
      const vars = { name: 'Test' };

      const result = await scaffolder.generateFile(template, vars);

      expect(result).toBe('');
    });

    it('should handle template with no variables', async () => {
      const template = 'Static content';
      const vars = {};

      const result = await scaffolder.generateFile(template, vars);

      expect(result).toBe('Static content');
    });

    it('should leave unmatched placeholders unchanged', async () => {
      const template = 'Hello {{name}}, {{missing}} variable';
      const vars = { name: 'John' };

      const result = await scaffolder.generateFile(template, vars);

      expect(result).toBe('Hello John, {{missing}} variable');
    });
  });
});
