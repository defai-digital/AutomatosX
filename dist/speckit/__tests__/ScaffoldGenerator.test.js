/**
 * ScaffoldGenerator Tests
 *
 * Week 3-4 Implementation - Day 4
 * Tests for project scaffold generation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScaffoldGenerator } from '../generators/ScaffoldGenerator.js';
import { TemplateRegistry } from '../utils/TemplateRegistry.js';
import { StructureBuilder } from '../utils/StructureBuilder.js';
import * as fs from 'fs/promises';
import * as path from 'path';
describe('ScaffoldGenerator', () => {
    let generator;
    const testWorkflow = {
        name: 'Test Workflow',
        version: '1.0.0',
        description: 'A test workflow',
        steps: [
            {
                id: 'step-1',
                name: 'First Step',
                action: 'test-action',
                config: {},
            },
            {
                id: 'step-2',
                name: 'Second Step',
                action: 'test-action',
                config: {},
                dependsOn: ['step-1'],
            },
        ],
    };
    beforeEach(() => {
        generator = new ScaffoldGenerator();
    });
    afterEach(async () => {
        // Clean up test output
        try {
            await fs.rm('./test-output', { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    describe('Template Registry', () => {
        it('should register and retrieve templates', () => {
            const registry = new TemplateRegistry();
            expect(registry.hasTemplate('workflow.yaml')).toBe(true);
            expect(registry.hasTemplate('config.json')).toBe(true);
            expect(registry.hasTemplate('run.sh')).toBe(true);
            expect(registry.hasTemplate('README.md')).toBe(true);
        });
        it('should throw error for non-existent template', () => {
            const registry = new TemplateRegistry();
            expect(() => registry.getTemplate('non-existent.txt')).toThrow('Template not found');
        });
        it('should list all templates', () => {
            const registry = new TemplateRegistry();
            const templates = registry.listTemplates();
            expect(templates.length).toBeGreaterThan(0);
            expect(templates).toContain('workflow.yaml');
        });
    });
    describe('StructureBuilder', () => {
        it('should build minimal structure', () => {
            const builder = new StructureBuilder();
            const structure = builder.build(testWorkflow, { template: 'minimal' });
            expect(structure.directories).toContain('workflows');
            expect(structure.directories).toContain('configs');
            expect(structure.fileTemplates.length).toBeGreaterThan(0);
        });
        it('should build standard structure', () => {
            const builder = new StructureBuilder();
            const structure = builder.build(testWorkflow, { template: 'standard' });
            expect(structure.directories).toContain('workflows');
            expect(structure.directories).toContain('configs');
            expect(structure.directories).toContain('scripts');
            expect(structure.directories).toContain('docs');
        });
        it('should include tests when requested', () => {
            const builder = new StructureBuilder();
            const structure = builder.build(testWorkflow, {
                template: 'standard',
                includeTests: true,
            });
            expect(structure.directories).toContain('tests');
        });
        it('should include CI/CD when requested', () => {
            const builder = new StructureBuilder();
            const structure = builder.build(testWorkflow, {
                template: 'standard',
                includeCI: true,
            });
            expect(structure.directories.some(d => d.includes('.github'))).toBe(true);
        });
    });
    describe('Scaffold Generation', () => {
        it('should generate scaffold with minimal template', async () => {
            const options = {
                outputPath: './test-output/minimal',
                template: 'minimal',
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            expect(result.createdFiles.length).toBeGreaterThan(0);
            expect(result.createdDirectories.length).toBeGreaterThan(0);
            expect(result.outputPath).toBe('./test-output/minimal');
        });
        it('should generate scaffold with standard template', async () => {
            const options = {
                outputPath: './test-output/standard',
                template: 'standard',
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            expect(result.createdFiles).toContain('workflows/main.yaml');
            expect(result.createdFiles).toContain('configs/default.json');
            expect(result.createdFiles).toContain('README.md');
        });
        it('should create executable scripts', async () => {
            const options = {
                outputPath: './test-output/executable',
                template: 'standard',
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            // Check that run.sh exists
            const runScript = path.join(options.outputPath, 'scripts/run.sh');
            const stats = await fs.stat(runScript);
            // Check executable permission (0o755 or similar)
            expect((stats.mode & 0o111) !== 0).toBe(true);
        });
        it('should support dry-run mode', async () => {
            const options = {
                outputPath: './test-output/dry-run',
                template: 'minimal',
                dryRun: true,
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            // Should return results but not create files
            expect(result.createdFiles.length).toBeGreaterThan(0);
            // Verify files don't actually exist
            try {
                await fs.access('./test-output/dry-run');
                throw new Error('Directory should not exist in dry-run mode');
            }
            catch (error) {
                expect(error.code).toBe('ENOENT');
            }
        });
        it('should validate workflow before scaffolding', async () => {
            const invalidWorkflow = {
                name: '',
                version: '1.0.0',
                steps: [],
            };
            await expect(generator.generateScaffold(invalidWorkflow, {})).rejects.toThrow();
        });
        it('should detect duplicate step IDs', async () => {
            const duplicateWorkflow = {
                name: 'Duplicate Test',
                version: '1.0.0',
                steps: [
                    { id: 'step-1', name: 'Step 1', action: 'action-1', config: {} },
                    { id: 'step-1', name: 'Step 1 Duplicate', action: 'action-2', config: {} },
                ],
            };
            await expect(generator.generateScaffold(duplicateWorkflow, {})).rejects.toThrow('Duplicate step ID');
        });
        it('should detect invalid dependencies', async () => {
            const invalidDepWorkflow = {
                name: 'Invalid Dep Test',
                version: '1.0.0',
                steps: [
                    {
                        id: 'step-1',
                        name: 'Step 1',
                        action: 'action-1',
                        config: {},
                        dependsOn: ['non-existent'],
                    },
                ],
            };
            await expect(generator.generateScaffold(invalidDepWorkflow, {})).rejects.toThrow('depends on non-existent step');
        });
    });
    describe('Template Rendering', () => {
        it('should render workflow name in templates', async () => {
            const options = {
                outputPath: './test-output/render-test',
                template: 'minimal',
            };
            await generator.generateScaffold(testWorkflow, options);
            const readmePath = path.join(options.outputPath, 'README.md');
            const readmeContent = await fs.readFile(readmePath, 'utf-8');
            expect(readmeContent).toContain('Test Workflow');
            expect(readmeContent).toContain('1.0.0');
        });
        it('should render step information', async () => {
            const options = {
                outputPath: './test-output/steps-test',
                template: 'minimal',
            };
            await generator.generateScaffold(testWorkflow, options);
            const workflowPath = path.join(options.outputPath, 'workflows/main.yaml');
            const workflowContent = await fs.readFile(workflowPath, 'utf-8');
            expect(workflowContent).toContain('step-1');
            expect(workflowContent).toContain('step-2');
            expect(workflowContent).toContain('First Step');
        });
    });
    describe('File System Operations', () => {
        it('should create directories recursively', async () => {
            const options = {
                outputPath: './test-output/deep/nested/path',
                template: 'minimal',
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            expect(result.outputPath).toBe('./test-output/deep/nested/path');
            // Verify directory exists
            const stats = await fs.stat(options.outputPath);
            expect(stats.isDirectory()).toBe(true);
        });
        it('should write files with correct content', async () => {
            const options = {
                outputPath: './test-output/content-test',
                template: 'minimal',
            };
            await generator.generateScaffold(testWorkflow, options);
            const configPath = path.join(options.outputPath, 'configs/default.json');
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            expect(config.workflow.name).toBe('Test Workflow');
            expect(config.providers).toBeDefined();
        });
    });
    describe('Complete Structure', () => {
        it('should generate complete scaffold with all options', async () => {
            const options = {
                outputPath: './test-output/complete',
                template: 'complete',
                includeTests: true,
                includeCI: true,
                includeDocs: true,
            };
            const result = await generator.generateScaffold(testWorkflow, options);
            expect(result.createdFiles.length).toBeGreaterThanOrEqual(7);
            expect(result.createdDirectories).toContain('tests');
            expect(result.createdDirectories.some(d => d.includes('.github'))).toBe(true);
        });
    });
});
//# sourceMappingURL=ScaffoldGenerator.test.js.map