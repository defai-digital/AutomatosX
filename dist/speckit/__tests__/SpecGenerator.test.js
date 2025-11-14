/**
 * SpecGenerator Tests
 *
 * Week 3-4 Implementation - Day 1
 * Comprehensive tests for natural language to YAML workflow generation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { SpecGenerator } from '../generators/SpecGenerator.js';
describe('SpecGenerator', () => {
    let generator;
    let mockProviderRouter;
    let mockAgentRegistry;
    let mockWorkflowParser;
    const testOutputDir = 'test-workflows';
    beforeEach(() => {
        // Create mocks
        mockProviderRouter = {
            route: vi.fn(),
        };
        mockAgentRegistry = {
            list: vi.fn().mockReturnValue([
                {
                    name: 'code-analyzer',
                    description: 'Analyze code quality and patterns',
                    capabilities: ['analysis', 'quality-check'],
                },
                {
                    name: 'test-generator',
                    description: 'Generate comprehensive test suites',
                    capabilities: ['testing', 'coverage'],
                },
                {
                    name: 'refactor-agent',
                    description: 'Refactor code following best practices',
                    capabilities: ['refactoring', 'optimization'],
                },
            ]),
            get: vi.fn().mockImplementation((name) => {
                const agents = [
                    { name: 'code-analyzer', description: 'Analyze code' },
                    { name: 'test-generator', description: 'Generate tests' },
                    { name: 'refactor-agent', description: 'Refactor code' },
                ];
                return agents.find(a => a.name === name);
            }),
        };
        mockWorkflowParser = {
            parse: vi.fn().mockResolvedValue({}),
        };
        generator = new SpecGenerator(mockProviderRouter, mockAgentRegistry, mockWorkflowParser);
    });
    afterEach(async () => {
        // Clean up test output directory
        try {
            await fs.rm(testOutputDir, { recursive: true, force: true });
        }
        catch (error) {
            // Ignore errors
        }
        vi.clearAllMocks();
    });
    describe('generateSpec', () => {
        it('should generate valid workflow spec from natural language', async () => {
            // Mock AI response with valid YAML
            const mockYAML = `name: "Code Quality Check"
version: "1.0.0"
description: "Analyze codebase for quality issues"

steps:
  - id: "step-1"
    name: "Analyze Code"
    agent: "code-analyzer"
    action: "analyze"
    config:
      path: "./src"
      depth: 3
    retryConfig:
      maxRetries: 3
      backoffMs: 1000
    timeout: 30000

  - id: "step-2"
    name: "Generate Report"
    agent: "code-analyzer"
    action: "report"
    config:
      format: "markdown"
    dependsOn: ["step-1"]
    retryConfig:
      maxRetries: 2
      backoffMs: 500
    timeout: 15000`;
            mockProviderRouter.route.mockResolvedValue({
                content: mockYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 100, outputTokens: 200 },
            });
            const result = await generator.generateSpec('Check code quality for my TypeScript project', { outputPath: testOutputDir });
            // Verify result structure
            expect(result).toHaveProperty('yaml');
            expect(result).toHaveProperty('definition');
            expect(result).toHaveProperty('outputPath');
            expect(result).toHaveProperty('metadata');
            // Verify YAML content
            expect(result.yaml).toContain('name: "Code Quality Check"');
            expect(result.yaml).toContain('version: "1.0.0"');
            // Verify definition
            expect(result.definition.name).toBe('Code Quality Check');
            expect(result.definition.steps).toHaveLength(2);
            expect(result.definition.steps[0].id).toBe('step-1');
            expect(result.definition.steps[0].agent).toBe('code-analyzer');
            // Verify metadata
            expect(result.metadata.stepsCount).toBe(2);
            expect(result.metadata.agentsUsed).toContain('code-analyzer');
            expect(result.metadata.complexity).toBe('low');
            // Verify file was written
            const fileExists = await fs.access(result.outputPath)
                .then(() => true)
                .catch(() => false);
            expect(fileExists).toBe(true);
            // Verify provider was called correctly
            expect(mockProviderRouter.route).toHaveBeenCalledWith(expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        content: expect.stringContaining('workflow architect'),
                    }),
                ]),
                temperature: 0.3,
            }));
        });
        it('should handle YAML wrapped in markdown code blocks', async () => {
            const mockYAML = `\`\`\`yaml
name: "Test Workflow"
version: "1.0.0"
description: "Test description"

steps:
  - id: "step-1"
    name: "Test Step"
    agent: "code-analyzer"
    action: "test"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000
\`\`\``;
            mockProviderRouter.route.mockResolvedValue({
                content: mockYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 100 },
            });
            const result = await generator.generateSpec('Create test workflow', {
                outputPath: testOutputDir,
            });
            expect(result.definition.name).toBe('Test Workflow');
            expect(result.yaml).not.toContain('```');
        });
        it('should filter agents based on options', async () => {
            const mockYAML = `name: "Filtered Workflow"
version: "1.0.0"
description: "Uses only test-generator"

steps:
  - id: "step-1"
    name: "Generate Tests"
    agent: "test-generator"
    action: "generate"
    retryConfig:
      maxRetries: 2
      backoffMs: 1000
    timeout: 20000`;
            mockProviderRouter.route.mockResolvedValue({
                content: mockYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 60, outputTokens: 120 },
            });
            const options = {
                agents: ['test-generator'],
                outputPath: testOutputDir,
            };
            const result = await generator.generateSpec('Generate unit tests', options);
            expect(result.definition.steps[0].agent).toBe('test-generator');
            // Verify prompt only included filtered agent
            const routeCall = mockProviderRouter.route.mock.calls[0][0];
            const prompt = routeCall.messages[0].content;
            expect(prompt).toContain('test-generator');
            expect(prompt).not.toContain('refactor-agent'); // Should be filtered out
        });
        it('should throw error for empty description', async () => {
            await expect(generator.generateSpec('')).rejects.toThrow('Description cannot be empty');
        });
        it('should throw error for invalid YAML', async () => {
            mockProviderRouter.route.mockResolvedValue({
                content: 'This is not valid YAML: [unclosed',
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 20 },
            });
            await expect(generator.generateSpec('Invalid workflow', { outputPath: testOutputDir })).rejects.toThrow('YAML parsing failed');
        });
        it('should validate against workflow schema', async () => {
            // Missing required field 'version'
            const invalidYAML = `name: "Invalid Workflow"
description: "Missing version field"

steps:
  - id: "step-1"
    name: "Test"
    agent: "code-analyzer"
    action: "test"`;
            mockProviderRouter.route.mockResolvedValue({
                content: invalidYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 80 },
            });
            await expect(generator.generateSpec('Create workflow', { outputPath: testOutputDir })).rejects.toThrow();
        });
        it('should detect circular dependencies', async () => {
            const circularYAML = `name: "Circular Workflow"
version: "1.0.0"
description: "Has circular dependencies"

steps:
  - id: "step-1"
    name: "Step 1"
    agent: "code-analyzer"
    action: "analyze"
    dependsOn: ["step-2"]
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000

  - id: "step-2"
    name: "Step 2"
    agent: "test-generator"
    action: "test"
    dependsOn: ["step-1"]
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000`;
            mockProviderRouter.route.mockResolvedValue({
                content: circularYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 150 },
            });
            await expect(generator.generateSpec('Create workflow', { outputPath: testOutputDir })).rejects.toThrow('Circular dependencies detected');
        });
        it('should detect duplicate step IDs', async () => {
            const duplicateYAML = `name: "Duplicate IDs"
version: "1.0.0"
description: "Has duplicate step IDs"

steps:
  - id: "step-1"
    name: "Step 1"
    agent: "code-analyzer"
    action: "analyze"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000

  - id: "step-1"
    name: "Step 1 Duplicate"
    agent: "test-generator"
    action: "test"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000`;
            mockProviderRouter.route.mockResolvedValue({
                content: duplicateYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 140 },
            });
            await expect(generator.generateSpec('Create workflow', { outputPath: testOutputDir })).rejects.toThrow('Duplicate step IDs');
        });
        it('should detect unknown agents', async () => {
            const unknownAgentYAML = `name: "Unknown Agent"
version: "1.0.0"
description: "Uses unknown agent"

steps:
  - id: "step-1"
    name: "Step 1"
    agent: "non-existent-agent"
    action: "do-something"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000`;
            mockProviderRouter.route.mockResolvedValue({
                content: unknownAgentYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 120 },
            });
            await expect(generator.generateSpec('Create workflow', { outputPath: testOutputDir })).rejects.toThrow('Unknown agent');
        });
        it('should generate metadata with correct complexity', async () => {
            // High complexity: >10 steps
            const complexYAML = `name: "Complex Workflow"
version: "1.0.0"
description: "Many steps"

steps:
${Array.from({ length: 12 }, (_, i) => `  - id: "step-${i + 1}"
    name: "Step ${i + 1}"
    agent: "code-analyzer"
    action: "analyze"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000`).join('\n')}`;
            mockProviderRouter.route.mockResolvedValue({
                content: complexYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 100, outputTokens: 400 },
            });
            const result = await generator.generateSpec('Complex task', {
                outputPath: testOutputDir,
            });
            expect(result.metadata.complexity).toBe('high');
            expect(result.metadata.stepsCount).toBe(12);
        });
        it('should include header comment in output file', async () => {
            const mockYAML = `name: "Test Workflow"
version: "1.0.0"
description: "Test description"

steps:
  - id: "step-1"
    name: "Test Step"
    agent: "code-analyzer"
    action: "test"
    retryConfig:
      maxRetries: 1
      backoffMs: 500
    timeout: 10000`;
            mockProviderRouter.route.mockResolvedValue({
                content: mockYAML,
                provider: 'claude',
                model: 'claude-3-5-sonnet-20241022',
                usage: { inputTokens: 50, outputTokens: 100 },
            });
            const result = await generator.generateSpec('Test', {
                outputPath: testOutputDir,
            });
            const fileContent = await fs.readFile(result.outputPath, 'utf-8');
            expect(fileContent).toContain('# AutomatosX Workflow: Test Workflow');
            expect(fileContent).toContain('# Generated:');
            expect(fileContent).toContain('# Generator: SpecGenerator');
        });
    });
});
//# sourceMappingURL=SpecGenerator.test.js.map