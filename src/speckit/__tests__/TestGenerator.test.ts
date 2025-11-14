/**
 * TestGenerator Tests
 *
 * Week 3-4 Implementation - Day 5
 * Tests for test suite generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestGenerator } from '../generators/TestGenerator.js';
import { TestAnalyzer } from '../utils/TestAnalyzer.js';
import type { WorkflowDefinition } from '../types/speckit.types.js';

describe('TestGenerator', () => {
  let generator: TestGenerator;

  const testWorkflow: WorkflowDefinition = {
    name: 'Test Workflow',
    version: '1.0.0',
    description: 'A test workflow',
    steps: [
      {
        id: 'step-1',
        name: 'First Step',
        agent: 'backend',
        action: 'test-action',
        config: {},
      },
      {
        id: 'step-2',
        name: 'Second Step',
        agent: 'security',
        action: 'test-action',
        config: {},
        dependsOn: ['step-1'],
      },
    ],
  };

  beforeEach(() => {
    generator = new TestGenerator();
  });

  describe('TestAnalyzer', () => {
    it('should extract testable steps from workflow', () => {
      const analyzer = new TestAnalyzer();
      const analysis = analyzer.analyze(testWorkflow);

      expect(analysis.steps).toHaveLength(2);
      expect(analysis.steps[0].id).toBe('step-1');
      expect(analysis.steps[0].name).toBe('First Step');
      expect(analysis.steps[1].id).toBe('step-2');
      expect(analysis.steps[1].dependencies).toContain('step-1');
    });

    it('should identify execution phases', () => {
      const analyzer = new TestAnalyzer();
      const analysis = analyzer.analyze(testWorkflow);

      expect(analysis.phases).toHaveLength(2);
      expect(analysis.phases[0].steps).toContain('step-1');
      expect(analysis.phases[1].steps).toContain('step-2');
    });

    it('should identify required mocks', () => {
      const analyzer = new TestAnalyzer();
      const analysis = analyzer.analyze(testWorkflow);

      expect(analysis.requiredMocks.length).toBeGreaterThan(0);
      const agentMocks = analysis.requiredMocks.filter(m => m.type === 'agent');
      expect(agentMocks.length).toBeGreaterThan(0);
    });

    it('should calculate coverage requirements', () => {
      const analyzer = new TestAnalyzer();
      const analysis = analyzer.analyze(testWorkflow);

      expect(analysis.coverageNeeds.statements).toBeGreaterThan(0);
      expect(analysis.coverageNeeds.branches).toBeGreaterThan(0);
      expect(analysis.coverageNeeds.functions).toBeGreaterThan(0);
      expect(analysis.coverageNeeds.lines).toBeGreaterThan(0);
    });
  });

  describe('TestGenerator', () => {
    it('should generate test suite with all components', async () => {
      const result = await generator.generateTests(testWorkflow, {
        framework: 'vitest',
        outputPath: './test-output/test-workflow',
        includeUnit: true,
        includeIntegration: true,
        includeE2E: true,
        includeMocks: true,
        includeFixtures: true,
      });

      expect(result.testCount).toBeGreaterThan(0);
      expect(result.createdFiles.length).toBeGreaterThan(0);
      expect(result.estimatedCoverage).toBeGreaterThan(0);
    });

    it('should respect framework option', async () => {
      const resultVitest = await generator.generateTests(testWorkflow, {
        framework: 'vitest',
        outputPath: './test-output/vitest',
      });

      expect(resultVitest.createdFiles.some(f => f.includes('.test.ts'))).toBe(true);
    });

    it('should exclude tests when options are false', async () => {
      const result = await generator.generateTests(testWorkflow, {
        framework: 'vitest',
        outputPath: './test-output/minimal',
        includeUnit: true,
        includeIntegration: false,
        includeE2E: false,
        includeMocks: false,
        includeFixtures: false,
      });

      // Should only have unit tests
      expect(result.testCount).toBeGreaterThan(0);
      expect(result.testCount).toBeLessThan(20); // Less than full suite
    });
  });
});
