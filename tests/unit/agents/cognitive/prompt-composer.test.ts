/**
 * Tests for PromptComposer module
 */

import { describe, it, expect } from 'vitest';
import type { CognitiveFrameworkConfig } from '../../../../src/types/cognitive.js';
import {
  PromptComposer,
  composePrompt,
  composeSmartPrompt,
  composeAutomatosXPrompt,
  validateConfig,
  AUTOMATOSX_REPO_CONTEXT,
} from '../../../../src/agents/cognitive/prompt-composer.js';

describe('PromptComposer', () => {
  const defaultConfig: CognitiveFrameworkConfig = {
    scaffold: 'prover',
    checklist: 'backend',
    outputContract: 'standard',
    uncertaintyMode: 'balanced',
  };

  describe('composePrompt', () => {
    it('should compose prompt with all components', () => {
      const result = composePrompt({
        basePrompt: 'You are a helpful assistant.',
        config: defaultConfig,
      });

      expect(result.text).toContain('You are a helpful assistant');
      expect(result.text).toContain('PROVER'); // scaffold
      expect(result.text).toContain('Backend'); // checklist
      expect(result.text).toContain('OUTPUT FORMAT'); // contract
      expect(result.text).toContain('UNCERTAINTY'); // protocol
    });

    it('should include estimated tokens', () => {
      const result = composePrompt({
        basePrompt: 'Test prompt',
        config: defaultConfig,
      });

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(typeof result.estimatedTokens).toBe('number');
    });

    it('should include components metadata', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: defaultConfig,
      });

      expect(result.components.persona).toBe(true);
      expect(result.components.scaffold).toBe('prover');
      expect(result.components.checklist).toBe('backend');
      expect(result.components.outputContract).toBe('standard');
      expect(result.components.uncertainty).toBe('balanced');
    });

    it('should handle empty base prompt', () => {
      const result = composePrompt({
        basePrompt: '',
        config: defaultConfig,
      });

      expect(result.text).toContain('PROVER');
      expect(result.components.persona).toBe(false);
    });

    it('should skip checklist when none specified', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: {
          ...defaultConfig,
          checklist: 'none',
        },
      });

      // When checklist is 'none', no actual checklist template is added
      // Note: PROVER scaffold template references "DOMAIN CHECKLIST" in step 2
      // but no actual checklist content is added when checklist is 'none'
      expect(result.text).not.toContain('## DOMAIN CHECKLIST:');
    });

    it('should include repo context when provided', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: defaultConfig,
        repoContext: {
          packageManager: 'pnpm',
          testFramework: 'Jest',
        },
      });

      expect(result.text).toContain('Repository Context');
      expect(result.text).toContain('pnpm');
      expect(result.text).toContain('Jest');
    });

    it('should include additional context when provided', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: defaultConfig,
        additionalContext: 'Extra context here',
      });

      expect(result.text).toContain('Extra context here');
    });

    it('should apply checklist overrides', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: {
          ...defaultConfig,
          checklistOverrides: {
            add: ['Custom check item'],
          },
        },
      });

      expect(result.text).toContain('Custom check item');
    });

    it('should apply custom checklist items', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: {
          ...defaultConfig,
          customChecklist: ['Item 1', 'Item 2'],
        },
      });

      expect(result.text).toContain('Custom Checks');
      expect(result.text).toContain('Item 1');
      expect(result.text).toContain('Item 2');
    });

    it('should clean persona section of old thinking patterns', () => {
      const basePrompt = `You are a helpful assistant.

Your thinking patterns:
- Think step by step
- Be thorough

Communication style: concise
`;
      const result = composePrompt({
        basePrompt,
        config: defaultConfig,
      });

      expect(result.text).not.toContain('Your thinking patterns:');
      expect(result.text).toContain('Communication style');
    });

    it('should use separator between sections', () => {
      const result = composePrompt({
        basePrompt: 'Test',
        config: defaultConfig,
      });

      expect(result.text).toContain('---');
    });
  });

  describe('composeSmartPrompt', () => {
    it('should recommend prover for complex tasks', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement user authentication system'
      );

      expect(result.components.scaffold).toBe('prover');
    });

    it('should recommend lite for simple tasks', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'fix typo in readme'
      );

      expect(result.components.scaffold).toBe('lite');
    });

    it('should infer backend checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'backend developer'
      );

      expect(result.components.checklist).toBe('backend');
    });

    it('should infer frontend checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'react developer'
      );

      expect(result.components.checklist).toBe('frontend');
    });

    it('should infer security checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'security auditor'
      );

      expect(result.components.checklist).toBe('security');
    });

    it('should infer quality checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'qa engineer'
      );

      expect(result.components.checklist).toBe('quality');
    });

    it('should infer architecture checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'software architect'
      );

      expect(result.components.checklist).toBe('architecture');
    });

    it('should infer devops checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'devops engineer'
      );

      expect(result.components.checklist).toBe('devops');
    });

    it('should infer data checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'data engineer'
      );

      expect(result.components.checklist).toBe('data');
    });

    it('should infer product checklist from role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature',
        'product manager'
      );

      expect(result.components.checklist).toBe('product');
    });

    it('should use none checklist when no role hint', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature'
      );

      expect(result.components.checklist).toBe('none');
    });

    it('should use balanced uncertainty mode', () => {
      const result = composeSmartPrompt(
        'You are a developer.',
        'implement feature'
      );

      expect(result.components.uncertainty).toBe('balanced');
    });

    it('should recommend appropriate output contract', () => {
      const simpleResult = composeSmartPrompt(
        'You are a developer.',
        'fix typo'
      );
      const complexResult = composeSmartPrompt(
        'You are a developer.',
        'architect the new microservices migration'
      );

      expect(simpleResult.components.outputContract).toBe('minimal');
      expect(complexResult.components.outputContract).toBe('detailed');
    });
  });

  describe('composeAutomatosXPrompt', () => {
    it('should include AutomatosX repo context', () => {
      const result = composeAutomatosXPrompt('Test prompt', defaultConfig);

      expect(result.text).toContain('pnpm');
      expect(result.text).toContain('ESM');
      expect(result.text).toContain('Vitest');
      expect(result.text).toContain('automatosx/tmp/');
    });

    it('should include AutomatosX rules', () => {
      const result = composeAutomatosXPrompt('Test prompt', defaultConfig);

      expect(result.text).toContain('.js extensions');
      expect(result.text).toContain('PRD');
    });
  });

  describe('AUTOMATOSX_REPO_CONTEXT', () => {
    it('should have correct package manager', () => {
      expect(AUTOMATOSX_REPO_CONTEXT.packageManager).toBe('pnpm');
    });

    it('should have correct module system', () => {
      expect(AUTOMATOSX_REPO_CONTEXT.moduleSystem).toContain('ESM');
    });

    it('should have correct test framework', () => {
      expect(AUTOMATOSX_REPO_CONTEXT.testFramework).toBe('Vitest');
    });

    it('should have temp directory', () => {
      expect(AUTOMATOSX_REPO_CONTEXT.tempDir).toBe('automatosx/tmp/');
    });

    it('should have rules', () => {
      expect(AUTOMATOSX_REPO_CONTEXT.rules).toBeDefined();
      expect(AUTOMATOSX_REPO_CONTEXT.rules?.length).toBeGreaterThan(0);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const result = validateConfig(defaultConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on missing scaffold', () => {
      const result = validateConfig({
        checklist: 'backend',
        outputContract: 'standard',
        uncertaintyMode: 'balanced',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('scaffold'))).toBe(true);
    });

    it('should error on invalid scaffold', () => {
      const result = validateConfig({
        scaffold: 'invalid' as any,
        checklist: 'backend',
        outputContract: 'standard',
        uncertaintyMode: 'balanced',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid scaffold'))).toBe(true);
    });

    it('should warn on missing checklist', () => {
      const result = validateConfig({
        scaffold: 'prover',
        outputContract: 'standard',
        uncertaintyMode: 'balanced',
      });

      expect(result.warnings.some(w => w.includes('checklist'))).toBe(true);
    });

    it('should warn on missing output contract', () => {
      const result = validateConfig({
        scaffold: 'prover',
        checklist: 'backend',
        uncertaintyMode: 'balanced',
      });

      expect(result.warnings.some(w => w.includes('output contract'))).toBe(true);
    });

    it('should warn on missing uncertainty mode', () => {
      const result = validateConfig({
        scaffold: 'prover',
        checklist: 'backend',
        outputContract: 'standard',
      });

      expect(result.warnings.some(w => w.includes('uncertainty mode'))).toBe(true);
    });

    it('should warn on inconsistent lite scaffold with detailed output', () => {
      const result = validateConfig({
        scaffold: 'lite',
        checklist: 'backend',
        outputContract: 'detailed',
        uncertaintyMode: 'balanced',
      });

      expect(result.warnings.some(w => w.includes('inconsistent'))).toBe(true);
    });
  });

  describe('persona cleaning', () => {
    it('should remove "Your thinking patterns" sections', () => {
      const basePrompt = `You are helpful.

Your thinking patterns:
- Pattern 1
- Pattern 2

Rest of prompt.`;

      const result = composePrompt({
        basePrompt,
        config: defaultConfig,
      });

      expect(result.text).not.toContain('Your thinking patterns');
      expect(result.text).toContain('Rest of prompt');
    });

    it('should remove "## Thinking Patterns" sections', () => {
      const basePrompt = `You are helpful.

## Thinking Patterns

- Pattern 1
- Pattern 2

## Other Section

Content here.`;

      const result = composePrompt({
        basePrompt,
        config: defaultConfig,
      });

      expect(result.text).not.toContain('## Thinking Patterns');
    });

    it('should dedupe "Communication style" lines', () => {
      const basePrompt = `You are helpful.
Communication style: concise
Communication style: concise
Communication style: concise
Other content.`;

      const result = composePrompt({
        basePrompt,
        config: defaultConfig,
      });

      // Count occurrences
      const matches = result.text.match(/Communication style:/g);
      expect(matches?.length).toBe(1);
    });

    it('should clean up excessive whitespace in persona section', () => {
      const basePrompt = `You are helpful.



Too many newlines.`;

      const result = composePrompt({
        basePrompt,
        config: defaultConfig,
      });

      // The persona section itself should be cleaned
      // But the composed prompt may have separators between major sections
      // Check that the persona content doesn't have triple newlines
      const personaEnd = result.text.indexOf('---');
      const personaSection = result.text.substring(0, personaEnd);
      expect(personaSection).not.toMatch(/\n\n\n/);
    });
  });

  describe('token estimation', () => {
    it('should estimate roughly 4 chars per token', () => {
      const result = composePrompt({
        basePrompt: 'A'.repeat(400), // 400 chars = ~100 tokens
        config: {
          scaffold: 'lite',
          checklist: 'none',
          outputContract: 'minimal',
          uncertaintyMode: 'balanced',
        },
      });

      // Should be close to 100 + template tokens
      expect(result.estimatedTokens).toBeGreaterThanOrEqual(100);
    });
  });

  describe('PromptComposer namespace', () => {
    it('should expose compose function', () => {
      const result = PromptComposer.compose({
        basePrompt: 'Test',
        config: defaultConfig,
      });
      expect(result.text).toBeDefined();
    });

    it('should expose composeSmart function', () => {
      const result = PromptComposer.composeSmart('Test', 'implement feature');
      expect(result.text).toBeDefined();
    });

    it('should expose composeAutomatosX function', () => {
      const result = PromptComposer.composeAutomatosX('Test', defaultConfig);
      expect(result.text).toContain('pnpm');
    });

    it('should expose cleanPersona function', () => {
      const cleaned = PromptComposer.cleanPersona('Test\nYour thinking patterns:\n- test');
      expect(cleaned).not.toContain('thinking patterns');
    });

    it('should expose validateConfig function', () => {
      const result = PromptComposer.validateConfig(defaultConfig);
      expect(result.valid).toBe(true);
    });

    it('should expose AUTOMATOSX_CONTEXT constant', () => {
      expect(PromptComposer.AUTOMATOSX_CONTEXT.packageManager).toBe('pnpm');
    });
  });
});
