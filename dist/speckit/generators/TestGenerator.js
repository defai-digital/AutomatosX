/**
 * Test Generator
 *
 * Week 3-4 Implementation - Day 5
 * Generates comprehensive test suites from workflow definitions
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestAnalyzer } from '../utils/TestAnalyzer.js';
import { TestBuilder } from '../utils/TestBuilder.js';
import { MockGenerator } from '../utils/MockGenerator.js';
import { FixtureBuilder } from '../utils/FixtureBuilder.js';
/**
 * Test Generator
 *
 * Main orchestrator for generating comprehensive test suites.
 * Coordinates analysis, building, and writing of test files.
 */
export class TestGenerator {
    analyzer;
    builder;
    mockGenerator;
    fixtureBuilder;
    constructor() {
        this.analyzer = new TestAnalyzer();
        this.builder = new TestBuilder('vitest'); // Default to Vitest
        this.mockGenerator = new MockGenerator('vitest');
        this.fixtureBuilder = new FixtureBuilder();
    }
    /**
     * Generate comprehensive test suite for workflow
     */
    async generateTests(workflow, options = {}) {
        // Set defaults
        const opts = {
            framework: options.framework || 'vitest',
            includeUnit: options.includeUnit !== false,
            includeIntegration: options.includeIntegration !== false,
            includeE2E: options.includeE2E !== false,
            includeMocks: options.includeMocks !== false,
            includeFixtures: options.includeFixtures !== false,
            coverageThreshold: options.coverageThreshold || 80,
            outputPath: options.outputPath || `tests/${this.kebabCase(workflow.name)}`,
        };
        // Update framework for builders
        this.builder = new TestBuilder(opts.framework);
        this.mockGenerator = new MockGenerator(opts.framework);
        // Analyze workflow
        const analysis = this.analyzer.analyze(workflow);
        // Generate test files
        const testFiles = [];
        let totalTests = 0;
        if (opts.includeUnit) {
            const unitTests = this.builder.buildUnitTests(workflow, analysis.steps);
            testFiles.push(unitTests);
            totalTests += unitTests.testCount;
        }
        if (opts.includeIntegration) {
            const integrationTests = this.builder.buildIntegrationTests(workflow, analysis.phases);
            testFiles.push(integrationTests);
            totalTests += integrationTests.testCount;
        }
        if (opts.includeE2E) {
            const e2eTests = this.builder.buildE2ETests(workflow, analysis.steps, analysis.phases);
            testFiles.push(e2eTests);
            totalTests += e2eTests.testCount;
        }
        // Generate mocks
        let mockFiles = [];
        if (opts.includeMocks) {
            mockFiles = this.mockGenerator.generateMocks(analysis.requiredMocks, workflow.name);
        }
        // Generate fixtures
        let fixtureFiles = [];
        if (opts.includeFixtures) {
            fixtureFiles = this.fixtureBuilder.generateFixtures(workflow, analysis.steps);
        }
        // Write files to disk
        const createdFiles = await this.writeFiles(opts.outputPath, testFiles, mockFiles, fixtureFiles);
        // Calculate estimated coverage
        const estimatedCoverage = this.calculateCoverage(analysis);
        return {
            outputPath: opts.outputPath,
            createdFiles,
            testCount: totalTests,
            estimatedCoverage,
            summary: this.buildSummary(totalTests, createdFiles.length, estimatedCoverage),
        };
    }
    /**
     * Write all files to disk
     */
    async writeFiles(outputPath, testFiles, mockFiles, fixtureFiles) {
        const createdFiles = [];
        // Create output directory
        await fs.mkdir(outputPath, { recursive: true });
        // Write test files
        for (const testFile of testFiles) {
            const fullPath = path.join(outputPath, '..', testFile.path);
            await this.ensureDirectory(path.dirname(fullPath));
            await fs.writeFile(fullPath, testFile.content, 'utf-8');
            createdFiles.push(testFile.path);
        }
        // Write mock files
        for (const mockFile of mockFiles) {
            const fullPath = path.join(outputPath, '..', mockFile.path);
            await this.ensureDirectory(path.dirname(fullPath));
            await fs.writeFile(fullPath, mockFile.content, 'utf-8');
            createdFiles.push(mockFile.path);
        }
        // Write fixture files
        for (const fixtureFile of fixtureFiles) {
            const fullPath = path.join(outputPath, '..', fixtureFile.path);
            await this.ensureDirectory(path.dirname(fullPath));
            await fs.writeFile(fullPath, fixtureFile.content, 'utf-8');
            createdFiles.push(fixtureFile.path);
        }
        return createdFiles;
    }
    /**
     * Ensure directory exists
     */
    async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Directory might already exist, ignore error
        }
    }
    /**
     * Calculate estimated coverage percentage
     */
    calculateCoverage(analysis) {
        // Base coverage from analysis
        const baseCoverage = analysis.coverageNeeds.statements;
        // Adjust based on test types generated
        const unitBoost = 5;
        const integrationBoost = 5;
        const e2eBoost = 5;
        return Math.min(baseCoverage + unitBoost + integrationBoost + e2eBoost, 100);
    }
    /**
     * Build summary message
     */
    buildSummary(testCount, fileCount, coverage) {
        return `Generated ${testCount} tests across ${fileCount} files with ${coverage}% estimated coverage`;
    }
    /**
     * Convert string to kebab-case
     */
    kebabCase(str) {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }
}
//# sourceMappingURL=TestGenerator.js.map