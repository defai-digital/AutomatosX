/**
 * Regression tests for JSON ops parsing (Bug #1 fix)
 *
 * These tests verify that SpecLoader correctly handles JSON ops
 * containing nested braces, quotes, and other special characters
 * that previously caused truncation issues.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { SpecLoader } from '../../../src/core/spec/SpecLoader.js';
import { tmpdir } from 'os';

describe('SpecLoader - JSON Ops Regression Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `spec-loader-test-${Date.now()}`);
    await mkdir(join(testDir, '.specify'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  async function createTestSpec(tasksContent: string) {
    await writeFile(
      join(testDir, '.specify', 'spec.md'),
      '# Test Spec\nVersion: 1.0.0'
    );
    await writeFile(
      join(testDir, '.specify', 'plan.md'),
      '# Test Plan\nPlanning notes'
    );
    await writeFile(
      join(testDir, '.specify', 'tasks.md'),
      tasksContent
    );
  }

  describe('Bug #1 Fix: Nested braces in JSON ops', () => {
    it('should parse JSON ops with nested object (multiple closing braces)', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:nested ops:{"command":"ax run","agent":"backend","args":["Task with {nested: object}"]} dep:none`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0].id).toBe('test:nested');

      // Verify the full JSON was captured, not truncated
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args[0]).toBe('Task with {nested: object}');
    });

    it('should parse JSON ops with code snippet containing braces', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:code ops:{"command":"ax run","agent":"backend","args":["Implement function foo() { return {}; }"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args[0]).toBe('Implement function foo() { return {}; }');
    });

    it('should parse JSON ops with markdown code blocks', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:markdown ops:{"command":"ax run","agent":"writer","args":["Write docs: \`\`\`js\\nfunction test() {\\n  return {};\\n}\\n\`\`\`"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args[0]).toContain('function test()');
      expect(opsJson.args[0]).toContain('return {};');
    });

    it('should parse JSON ops with escaped quotes', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:quotes ops:{"command":"ax run","agent":"backend","args":["Task with \\"quoted text\\" inside"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args[0]).toBe('Task with "quoted text" inside');
    });

    it('should parse JSON ops with array of complex objects', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:array ops:{"command":"ax run","agent":"data","args":[{"type":"A","config":{"key":"val"}},{"type":"B","config":{"key2":"val2"}}]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(Array.isArray(opsJson.args)).toBe(true);
      expect(opsJson.args).toHaveLength(2);
      expect(opsJson.args[0].config.key).toBe('val');
    });

    it('should handle multiple JSON ops tasks in sequence', async () => {
      const tasksContent = `# Tasks
- [ ] id:task1 ops:{"command":"ax run","agent":"backend","args":["Task {one}"]}
- [ ] id:task2 ops:{"command":"ax run","agent":"frontend","args":["Task {two}"]}
- [ ] id:task3 ops:{"command":"ax run","agent":"qa","args":["Task {three}"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(3);

      const ops1 = JSON.parse(spec.tasks[0].ops);
      const ops2 = JSON.parse(spec.tasks[1].ops);
      const ops3 = JSON.parse(spec.tasks[2].ops);

      expect(ops1.args[0]).toBe('Task {one}');
      expect(ops2.args[0]).toBe('Task {two}');
      expect(ops3.args[0]).toBe('Task {three}');
    });
  });

  describe('Backward Compatibility: Old string format', () => {
    it('should still parse old string format ops', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:old ops:"ax run backend 'Simple task'" dep:none`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      expect(spec.tasks[0].id).toBe('test:old');
      expect(spec.tasks[0].ops).toBe("ax run backend 'Simple task'");
    });

    it('should parse mixed JSON and string format tasks', async () => {
      const tasksContent = `# Tasks
- [ ] id:task1 ops:"ax run backend 'Old format'"
- [ ] id:task2 ops:{"command":"ax run","agent":"backend","args":["New format"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(2);
      expect(spec.tasks[0].ops).toBe("ax run backend 'Old format'");

      const ops2 = JSON.parse(spec.tasks[1].ops);
      expect(ops2.args[0]).toBe('New format');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty JSON args array', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:empty ops:{"command":"ax run","agent":"backend","args":[]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args).toEqual([]);
    });

    it('should handle JSON with unicode characters', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:unicode ops:{"command":"ax run","agent":"writer","args":["Task with émojis 🚀 and spëcial çhars"]}`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      expect(spec.tasks).toHaveLength(1);
      const opsJson = JSON.parse(spec.tasks[0].ops);
      expect(opsJson.args[0]).toContain('🚀');
      expect(opsJson.args[0]).toContain('émojis');
    });

    it('should reject malformed JSON ops', async () => {
      const tasksContent = `# Tasks
- [ ] id:test:bad ops:{"command":"ax run","agent":"backend"`;

      await createTestSpec(tasksContent);
      const loader = new SpecLoader({ workspacePath: testDir });
      const spec = await loader.load();

      // Malformed JSON should be skipped with warning
      expect(spec.tasks).toHaveLength(0);
    });
  });
});
