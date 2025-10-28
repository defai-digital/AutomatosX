/**
 * Unit tests for SpecLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { SpecLoader } from '../../../src/core/spec/SpecLoader.js';
import { tmpdir } from 'os';

describe('SpecLoader', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    // Create temporary test workspace
    testWorkspace = join(tmpdir(), `automatosx-spec-test-${Date.now()}`);
    await mkdir(testWorkspace, { recursive: true });
    await mkdir(join(testWorkspace, '.specify'), { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test workspace
    try {
      await rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('load()', () => {
    it('should load and parse valid spec files', async () => {
      // Create test files
      const specContent = `# Test Spec

## Objective
Build a test feature

## Requirements
- Requirement 1
- Requirement 2

## Success Criteria
- Works correctly
`;

      const planContent = `# Technical Plan

## Approach
Test-driven development

## Architecture
Simple architecture
`;

      const tasksContent = `# Tasks

- [ ] id:setup:env ops:"ax run backend 'Setup environment'"
- [ ] id:impl:feature ops:"ax run backend 'Implement feature'" dep:setup:env
- [x] id:test:unit ops:"ax run quality 'Write unit tests'" dep:impl:feature labels:testing
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), specContent);
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), planContent);
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      // Load spec
      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      // Assertions
      expect(spec).toBeDefined();
      expect(spec.metadata).toBeDefined();
      expect(spec.metadata.id).toMatch(/^spec-/);
      expect(spec.metadata.version).toBe('1.0.0');
      expect(spec.metadata.workspacePath).toBe(testWorkspace);
      expect(spec.metadata.checksum).toBeDefined();

      expect(spec.content.spec).toBe(specContent);
      expect(spec.content.plan).toBe(planContent);
      expect(spec.content.tasks).toBe(tasksContent);

      expect(spec.tasks).toHaveLength(3);
      expect(spec.tasks[0]?.id).toBe('setup:env');
      expect(spec.tasks[0]?.ops).toBe('ax run backend \'Setup environment\'');
      expect(spec.tasks[0]?.status).toBe('pending');
      expect(spec.tasks[0]?.deps).toEqual([]);

      expect(spec.tasks[1]?.id).toBe('impl:feature');
      expect(spec.tasks[1]?.deps).toEqual(['setup:env']);

      expect(spec.tasks[2]?.id).toBe('test:unit');
      expect(spec.tasks[2]?.status).toBe('completed');
      expect(spec.tasks[2]?.labels).toEqual(['testing']);
    });

    it('should handle missing required files', async () => {
      // Don't create any files
      const loader = new SpecLoader({ workspacePath: testWorkspace });

      await expect(loader.load()).rejects.toThrow();
    });

    it('should extract version from spec content', async () => {
      const specContent = `# Test Spec
Version: 2.1.0

## Objective
Test version extraction
`;

      const planContent = '# Plan';
      const tasksContent = '# Tasks\n- [ ] id:task:one ops:"test"';

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), specContent);
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), planContent);
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.metadata.version).toBe('2.1.0');
    });

    it('should extract tags from spec content', async () => {
      const specContent = `# Test Spec
Tags: feature, backend

## Objective
Test tag extraction
`;

      const planContent = '# Plan';
      const tasksContent = '# Tasks\n- [ ] id:task:one ops:"test"';

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), specContent);
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), planContent);
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.metadata.tags).toContain('feature');
      expect(spec.metadata.tags).toContain('backend');
    });
  });

  describe('task parsing', () => {
    it('should parse inline format tasks', async () => {
      const tasksContent = `# Tasks
- [ ] id:auth:setup ops:"ax run backend 'Setup auth'" dep:core:init labels:auth,backend
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0]?.id).toBe('auth:setup');
      expect(spec.tasks[0]?.deps).toEqual(['core:init']);
      expect(spec.tasks[0]?.labels).toEqual(['auth', 'backend']);
    });

    it('should parse simple format tasks', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:e2e ops:"npm test" dep:test:unit,test:integration
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0]?.id).toBe('test:e2e');
      expect(spec.tasks[0]?.deps).toEqual(['test:unit', 'test:integration']);
    });

    it('should parse minimal format tasks', async () => {
      const tasksContent = `# Tasks
- [ ] id:build:docker ops:"docker build -t app ."
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0]?.id).toBe('build:docker');
      expect(spec.tasks[0]?.ops).toBe('docker build -t app .');
      expect(spec.tasks[0]?.deps).toEqual([]);
    });

    it('should extract assignee hint from ops', async () => {
      const tasksContent = `# Tasks
- [ ] id:api:create ops:"ax run backend 'Create REST API'"
- [ ] id:ui:design ops:"ax run design 'Design UI mockups'"
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({ workspacePath: testWorkspace });
      const spec = await loader.load();

      expect(spec.tasks[0]?.assigneeHint).toBe('backend');
      expect(spec.tasks[1]?.assigneeHint).toBe('design');
    });

    it('should handle duplicate task IDs in permissive mode', async () => {
      const tasksContent = `# Tasks
- [ ] id:task:one ops:"command 1"
- [ ] id:task:one ops:"command 2"
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({
        workspacePath: testWorkspace,
        parseOptions: { strict: false }
      });
      const spec = await loader.load();

      // Should only have first task (duplicate skipped)
      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0]?.id).toBe('task:one');
    });

    it('should throw on duplicate task IDs in strict mode', async () => {
      const tasksContent = `# Tasks
- [ ] id:task:one ops:"command 1"
- [ ] id:task:one ops:"command 2"
`;

      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), tasksContent);

      const loader = new SpecLoader({
        workspacePath: testWorkspace,
        parseOptions: { strict: true }
      });

      await expect(loader.load()).rejects.toThrow('Duplicate task ID: task:one');
    });
  });

  describe('static methods', () => {
    it('should create loader with static method', async () => {
      const loader = await SpecLoader.create({ workspacePath: testWorkspace });
      expect(loader).toBeInstanceOf(SpecLoader);
    });

    it('should load with static method', async () => {
      await writeFile(join(testWorkspace, '.specify', 'spec.md'), '# Spec\n\n## Objective\nTest\n\n## Requirements\n- R1\n\n## Success Criteria\n- S1');
      await writeFile(join(testWorkspace, '.specify', 'plan.md'), '# Plan\n\n## Approach\nTest');
      await writeFile(join(testWorkspace, '.specify', 'tasks.md'), '# Tasks\n- [ ] id:task:one ops:"test"');

      const spec = await SpecLoader.load(testWorkspace);
      expect(spec).toBeDefined();
      expect(spec.tasks).toHaveLength(1);
    });
  });
});
