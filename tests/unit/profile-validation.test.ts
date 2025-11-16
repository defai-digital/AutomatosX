/**
 * Profile Validation Tests - v4.1 Enhanced Fields
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileLoader } from '../../src/agents/profile-loader.js';
import { AgentValidationError } from '../../src/types/agent.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('ProfileLoader - v4.1 Field Validation', () => {
  const testDir = '/tmp/profile-validation-test';
  let loader: ProfileLoader;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    loader = new ProfileLoader(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('stages validation', () => {
    it('should reject stages that is not an array', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages: "not an array"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        AgentValidationError
      );
      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages must be an array'
      );
    });

    it('should reject stage without name', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - description: Missing name
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages[0].name is required'
      );
    });

    it('should reject stage without description', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - name: stage1
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages[0].description is required'
      );
    });

    it('should reject stage with invalid key_questions (not array)', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - name: stage1
    description: Test stage
    key_questions: "not an array"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages[0].key_questions must be an array'
      );
    });

    it('should reject stage with invalid outputs (not array)', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - name: stage1
    description: Test stage
    outputs: "not an array"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages[0].outputs must be an array'
      );
    });

    it('should reject stage with invalid temperature', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - name: stage1
    description: Test stage
    temperature: 1.5
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'stages[0].temperature must be a number between 0 and 1'
      );
    });

    it('should accept valid stages', async () => {
      const validProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
stages:
  - name: stage1
    description: First stage
    key_questions:
      - Question 1
      - Question 2
    outputs:
      - Output 1
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
  - name: stage2
    description: Second stage
`;
      await writeFile(join(testDir, 'test.yaml'), validProfile);

      const profile = await loader.loadProfile('test');
      expect(profile.stages).toBeDefined();
      expect(profile.stages).toHaveLength(2);
      if (profile.stages && profile.stages[0]) {
        expect(profile.stages[0].name).toBe('stage1');
        expect(profile.stages[0].temperature).toBe(0.7);
      }
    });
  });

  describe('personality validation', () => {
    it('should reject personality that is not an object', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
personality: "not an object"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'personality must be an object'
      );
    });

    it('should reject personality that is an array', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
personality: [trait1, trait2]
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'personality must be an object'
      );
    });

    it('should reject personality.traits that is not an array', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
personality:
  traits: "not an array"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'personality.traits must be an array'
      );
    });

    it('should accept valid personality', async () => {
      const validProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
personality:
  traits:
    - pragmatic
    - quality-focused
  catchphrase: "Test catchphrase"
  communication_style: technical
  decision_making: quality-driven
`;
      await writeFile(join(testDir, 'test.yaml'), validProfile);

      const profile = await loader.loadProfile('test');
      expect(profile.personality).toBeDefined();
      expect(profile.personality?.traits).toEqual(['pragmatic', 'quality-focused']);
      expect(profile.personality?.catchphrase).toBe('Test catchphrase');
    });
  });

  describe('thinking_patterns validation', () => {
    it('should reject thinking_patterns that is not an array', async () => {
      const invalidProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
thinking_patterns: "not an array"
`;
      await writeFile(join(testDir, 'test.yaml'), invalidProfile);

      await expect(loader.loadProfile('test')).rejects.toThrow(
        'thinking_patterns must be an array'
      );
    });

    it('should accept valid thinking_patterns', async () => {
      const validProfile = `
name: test
role: Test
description: Test
systemPrompt: Test
thinking_patterns:
  - "Pattern 1"
  - "Pattern 2"
`;
      await writeFile(join(testDir, 'test.yaml'), validProfile);

      const profile = await loader.loadProfile('test');
      expect(profile.thinking_patterns).toBeDefined();
      expect(profile.thinking_patterns).toHaveLength(2);
    });
  });
});
