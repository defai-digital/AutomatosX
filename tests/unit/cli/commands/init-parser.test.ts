/**
 * Tests for init-parser (AX.md Parser)
 */

import { describe, it, expect } from 'vitest';
import { parseAXMD, detectDetailedChanges, formatChangeSummary, type ParsedAXMD } from '../../../../src/cli/commands/init-parser.js';

describe('Init Parser', () => {
  describe('parseAXMD', () => {
    it('should parse empty content', () => {
      const result = parseAXMD('');
      expect(result.dependencies).toEqual([]);
      expect(result.scripts).toEqual({});
      expect(result.hasCustomContent).toBe(false);
      expect(result.customSections).toEqual([]);
    });

    it('should extract version from content', () => {
      const content = '# Project Context for MyProject\n\nProject: Test (v1.2.3)';
      const result = parseAXMD(content);
      expect(result.version).toBe('1.2.3');
    });

    it('should extract project name', () => {
      const content = '# Project Context for MyProject\n\nSome content';
      const result = parseAXMD(content);
      expect(result.projectName).toBe('MyProject');
    });

    it('should extract description from project overview', () => {
      const content = `# Project Context for Test

## Project Overview

**A comprehensive testing framework**

Some more content`;
      const result = parseAXMD(content);
      expect(result.description).toBe('A comprehensive testing framework');
    });

    it('should extract architecture', () => {
      const content = '**Architecture:** Monolithic\n\nOther content';
      const result = parseAXMD(content);
      expect(result.architecture).toBe('Monolithic');
    });

    it('should extract stack and parse dependencies', () => {
      const content = '**Stack:** TypeScript, React, Node.js\n\nOther content';
      const result = parseAXMD(content);
      expect(result.stack).toBe('TypeScript, React, Node.js');
      expect(result.dependencies).toContain('typescript');
      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('node.js');
    });

    it('should extract team', () => {
      const content = '**Team:** Engineering Squad\n\nOther content';
      const result = parseAXMD(content);
      expect(result.team).toBe('Engineering Squad');
    });

    it('should extract test framework', () => {
      const content = '- Framework: Vitest\n\nOther content';
      const result = parseAXMD(content);
      expect(result.testFramework).toBe('Vitest');
    });

    it('should extract linter', () => {
      const content = '- Linter: ESLint\n\nOther content';
      const result = parseAXMD(content);
      expect(result.linter).toBe('ESLint');
    });

    it('should extract formatter', () => {
      const content = '- Formatter: Prettier\n\nOther content';
      const result = parseAXMD(content);
      expect(result.formatter).toBe('Prettier');
    });

    it('should extract scripts from canonical commands', () => {
      const content = `## Canonical Commands

\`\`\`bash
npm run dev                 # Start dev server
npm run build               # Build for production
npm run test                # Run tests
\`\`\`

## Next Section`;
      const result = parseAXMD(content);
      expect(result.scripts['npm run dev']).toBe('npm run dev');
      expect(result.scripts['npm run build']).toBe('npm run build');
      expect(result.scripts['npm run test']).toBe('npm run test');
    });

    it('should detect custom content markers', () => {
      const content = '# Project\n\n<!-- USER-EDITED -->\n\nCustom content';
      const result = parseAXMD(content);
      expect(result.hasCustomContent).toBe(true);
    });

    it('should detect custom content with Our Custom marker', () => {
      const content = '# Project\n\n## Our Custom Guidelines\n\nContent';
      const result = parseAXMD(content);
      expect(result.hasCustomContent).toBe(true);
    });

    it('should detect custom content with Notes marker', () => {
      const content = '# Project\n\n## Notes\n\nSome notes';
      const result = parseAXMD(content);
      expect(result.hasCustomContent).toBe(true);
    });

    it('should detect custom content with Team Guidelines marker', () => {
      const content = '# Project\n\n## Team Guidelines\n\nGuidelines';
      const result = parseAXMD(content);
      expect(result.hasCustomContent).toBe(true);
    });

    it('should identify custom sections', () => {
      const content = `# Project

## Project Overview
Overview content

## Custom Section
Custom content

## Another Custom
More content`;
      const result = parseAXMD(content);
      expect(result.customSections).toContain('Custom Section');
      expect(result.customSections).toContain('Another Custom');
    });

    it('should not include standard sections in customSections', () => {
      const content = `# Project

## Project Overview
Overview content

## Agent Delegation Rules
Rules

## Coding Conventions
Conventions`;
      const result = parseAXMD(content);
      expect(result.customSections).not.toContain('Project Overview');
      expect(result.customSections).not.toContain('Agent Delegation Rules');
      expect(result.customSections).not.toContain('Coding Conventions');
    });
  });

  describe('detectDetailedChanges', () => {
    const baseParsed: ParsedAXMD = {
      version: '1.0.0',
      dependencies: ['react', 'typescript'],
      scripts: { 'npm run dev': 'npm run dev' },
      hasCustomContent: false,
      customSections: [],
      architecture: 'Monorepo'
    };

    it('should detect version change', () => {
      const current = {
        version: '2.0.0',
        dependencies: ['react', 'typescript'],
        scripts: { 'npm run dev': 'npm run dev' },
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      expect(changes).toContainEqual({
        type: 'version',
        field: 'version',
        oldValue: '1.0.0',
        newValue: '2.0.0'
      });
    });

    it('should not detect version change when current is undefined', () => {
      const current = {
        version: undefined,
        dependencies: ['react', 'typescript'],
        scripts: { 'npm run dev': 'npm run dev' },
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      expect(changes.find(c => c.type === 'version')).toBeUndefined();
    });

    it('should detect added dependencies', () => {
      const current = {
        version: '1.0.0',
        dependencies: ['React', 'TypeScript', 'Vue'],
        scripts: {},
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      const addedDeps = changes.find(c => c.type === 'dependency-added');
      expect(addedDeps).toBeDefined();
      expect(addedDeps?.items).toContain('vue');
    });

    it('should detect removed dependencies', () => {
      const current = {
        version: '1.0.0',
        dependencies: ['react'],
        scripts: {},
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      const removedDeps = changes.find(c => c.type === 'dependency-removed');
      expect(removedDeps).toBeDefined();
      expect(removedDeps?.items).toContain('typescript');
    });

    it('should detect added scripts', () => {
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: { 'npm run dev': 'dev', 'npm run build': 'build' },
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      const addedScripts = changes.find(c => c.type === 'script-added');
      expect(addedScripts).toBeDefined();
      expect(addedScripts?.items).toContain('npm run build');
    });

    it('should detect removed scripts', () => {
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: {},
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      const removedScripts = changes.find(c => c.type === 'script-removed');
      expect(removedScripts).toBeDefined();
      expect(removedScripts?.items).toContain('npm run dev');
    });

    it('should detect added linter tool', () => {
      const parsedWithoutLinter: ParsedAXMD = {
        ...baseParsed,
        linter: undefined
      };
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: {},
        architecture: 'Monorepo',
        linter: 'ESLint'
      };
      const changes = detectDetailedChanges(parsedWithoutLinter, current);
      const addedTool = changes.find(c => c.type === 'tool-added' && c.field === 'linter');
      expect(addedTool).toBeDefined();
      expect(addedTool?.newValue).toBe('ESLint');
    });

    it('should detect added formatter tool', () => {
      const parsedWithoutFormatter: ParsedAXMD = {
        ...baseParsed,
        formatter: undefined
      };
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: {},
        architecture: 'Monorepo',
        formatter: 'Prettier'
      };
      const changes = detectDetailedChanges(parsedWithoutFormatter, current);
      const addedTool = changes.find(c => c.type === 'tool-added' && c.field === 'formatter');
      expect(addedTool).toBeDefined();
      expect(addedTool?.newValue).toBe('Prettier');
    });

    it('should detect added test framework', () => {
      const parsedWithoutTest: ParsedAXMD = {
        ...baseParsed,
        testFramework: undefined
      };
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: {},
        architecture: 'Monorepo',
        testFramework: 'Vitest'
      };
      const changes = detectDetailedChanges(parsedWithoutTest, current);
      const addedTool = changes.find(c => c.type === 'tool-added' && c.field === 'test framework');
      expect(addedTool).toBeDefined();
      expect(addedTool?.newValue).toBe('Vitest');
    });

    it('should detect architecture change', () => {
      const current = {
        version: '1.0.0',
        dependencies: [],
        scripts: {},
        architecture: 'Microservices'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      const archChange = changes.find(c => c.type === 'architecture');
      expect(archChange).toBeDefined();
      expect(archChange?.oldValue).toBe('Monorepo');
      expect(archChange?.newValue).toBe('Microservices');
    });

    it('should return empty array when no changes', () => {
      const current = {
        version: '1.0.0',
        dependencies: ['react', 'typescript'],
        scripts: { 'npm run dev': 'npm run dev' },
        architecture: 'Monorepo'
      };
      const changes = detectDetailedChanges(baseParsed, current);
      expect(changes).toHaveLength(0);
    });
  });

  describe('formatChangeSummary', () => {
    it('should return empty string for no changes', () => {
      const result = formatChangeSummary([]);
      expect(result).toBe('');
    });

    it('should format version change', () => {
      const changes = [{
        type: 'version' as const,
        field: 'version',
        oldValue: '1.0.0',
        newValue: '2.0.0'
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(version 1.0.0 → 2.0.0)');
    });

    it('should format single dependency added', () => {
      const changes = [{
        type: 'dependency-added' as const,
        field: 'dependencies',
        items: ['vue']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(+1 dep)');
    });

    it('should format multiple dependencies added', () => {
      const changes = [{
        type: 'dependency-added' as const,
        field: 'dependencies',
        items: ['vue', 'angular', 'svelte']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(+3 deps)');
    });

    it('should format single dependency removed', () => {
      const changes = [{
        type: 'dependency-removed' as const,
        field: 'dependencies',
        items: ['react']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(-1 dep)');
    });

    it('should format multiple dependencies removed', () => {
      const changes = [{
        type: 'dependency-removed' as const,
        field: 'dependencies',
        items: ['react', 'vue']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(-2 deps)');
    });

    it('should format single script added', () => {
      const changes = [{
        type: 'script-added' as const,
        field: 'scripts',
        items: ['build']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(+1 script)');
    });

    it('should format multiple scripts added', () => {
      const changes = [{
        type: 'script-added' as const,
        field: 'scripts',
        items: ['build', 'test', 'deploy']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(+3 scripts)');
    });

    it('should format tool added', () => {
      const changes = [{
        type: 'tool-added' as const,
        field: 'linter',
        newValue: 'ESLint'
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(+linter)');
    });

    it('should format architecture change', () => {
      const changes = [{
        type: 'architecture' as const,
        field: 'architecture',
        oldValue: 'Monolith',
        newValue: 'Microservices'
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(architecture)');
    });

    it('should format two changes', () => {
      const changes = [
        {
          type: 'version' as const,
          field: 'version',
          oldValue: '1.0.0',
          newValue: '2.0.0'
        },
        {
          type: 'dependency-added' as const,
          field: 'dependencies',
          items: ['vue']
        }
      ];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(version 1.0.0 → 2.0.0, +1 dep)');
    });

    it('should format many changes as count', () => {
      const changes = [
        { type: 'version' as const, field: 'version', oldValue: '1.0.0', newValue: '2.0.0' },
        { type: 'dependency-added' as const, field: 'dependencies', items: ['vue'] },
        { type: 'tool-added' as const, field: 'linter', newValue: 'ESLint' }
      ];
      const result = formatChangeSummary(changes);
      expect(result).toBe('(3 changes)');
    });

    it('should skip script-removed in summary', () => {
      const changes = [{
        type: 'script-removed' as const,
        field: 'scripts',
        items: ['old-script']
      }];
      const result = formatChangeSummary(changes);
      expect(result).toBe('');
    });
  });
});
