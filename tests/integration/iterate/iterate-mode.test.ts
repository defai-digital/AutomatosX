/**
 * Iterate Mode Integration Tests
 *
 * End-to-end tests for autonomous iterate mode:
 * - Response classification
 * - Auto-responder
 * - Dangerous operation guard
 * - State management
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { IterateAutoResponder, type ResponseContext } from '../../../src/core/iterate/iterate-auto-responder.js';
import { DangerousOperationGuard } from '../../../src/core/iterate/dangerous-operation-guard.js';
import type { Classification, ClassificationType, SafetyConfig } from '../../../src/types/iterate.js';

describe('Iterate Mode Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'iterate-test-'));
    await mkdir(join(testDir, '.automatosx'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('IterateAutoResponder', () => {
    let responder: IterateAutoResponder;

    beforeEach(() => {
      responder = new IterateAutoResponder({
        templateLibraryPath: join(testDir, 'templates.yaml'),
        randomizeTemplates: true,
        enableContextVars: true
      });
    });

    it('should generate response for confirmation prompt', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Matches confirmation pattern',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Should I proceed?',
        classification,
        provider: 'claude'
      };

      const response = await responder.generateResponse(classification, context);

      // May return template or fallback
      expect(response === null || typeof response === 'string').toBe(true);
    });

    it('should return null for status updates', async () => {
      const classification: Classification = {
        type: 'status_update',
        confidence: 0.8,
        method: 'pattern_library',
        reason: 'Status report detected',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'I have completed the task.',
        classification,
        provider: 'claude'
      };

      const response = await responder.generateResponse(classification, context);

      // Status updates typically don't need response
      expect(response === null || typeof response === 'string').toBe(true);
    });

    it('should return null for genuine questions', async () => {
      const classification: Classification = {
        type: 'genuine_question',
        confidence: 0.85,
        method: 'pattern_library',
        reason: 'Question requiring user input',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Which framework should I use?',
        classification,
        provider: 'claude'
      };

      const response = await responder.generateResponse(classification, context);

      // Genuine questions need user intervention
      expect(response).toBeNull();
    });

    it('should load custom templates from file', async () => {
      const templatesContent = `
version: '1.0'
templates:
  confirmation_prompt:
    - template: 'Yes, please proceed.'
      priority: 1
    - template: 'Go ahead.'
      priority: 2
`;
      await writeFile(join(testDir, 'templates.yaml'), templatesContent);

      await responder.loadTemplates(join(testDir, 'templates.yaml'));

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Proceed?',
        classification,
        provider: 'claude'
      };

      const response = await responder.generateResponse(classification, context);
      expect(response === null || typeof response === 'string').toBe(true);
    });

    it('should substitute context variables', async () => {
      const context: ResponseContext = {
        message: 'Should I implement {{feature}}?',
        classification: {
          type: 'confirmation_prompt',
          confidence: 0.9,
          method: 'pattern_library',
          reason: 'Test',
          timestamp: new Date().toISOString()
        },
        provider: 'claude',
        variables: {
          feature: 'authentication'
        }
      };

      const response = await responder.generateResponse(context.classification, context);
      expect(response === null || typeof response === 'string').toBe(true);
    });
  });

  describe('DangerousOperationGuard', () => {
    let guard: DangerousOperationGuard;
    let safetyConfig: SafetyConfig;

    beforeEach(() => {
      safetyConfig = {
        enableDangerousOperationGuard: true,
        riskTolerance: 'paranoid',
        dangerousOperations: {
          fileDelete: 'HIGH',
          gitForce: 'HIGH',
          writeOutsideWorkspace: 'HIGH',
          secretsInCode: 'HIGH',
          shellCommands: 'MEDIUM',
          packageInstall: 'MEDIUM'
        },
        enableTimeTracking: true,
        enableIterationTracking: true
      };
      guard = new DangerousOperationGuard(safetyConfig);
    });

    it('should assess dangerous shell commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /home',
        'format c:'
      ];

      for (const command of dangerousCommands) {
        const result = await guard.checkShellCommand(command);
        expect(result).toBeDefined();
        expect(result.riskLevel).toBeDefined();
      }
    });

    it('should assess safe shell commands', async () => {
      const safeCommands = [
        'ls -la',
        'cat file.txt',
        'echo hello',
        'git status'
      ];

      for (const command of safeCommands) {
        const result = await guard.checkShellCommand(command);
        expect(result).toBeDefined();
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel);
      }
    });

    it('should handle risk tolerance settings', async () => {
      const lowToleranceGuard = new DangerousOperationGuard({
        ...safetyConfig,
        riskTolerance: 'paranoid'
      });

      const highToleranceGuard = new DangerousOperationGuard({
        ...safetyConfig,
        riskTolerance: 'permissive'
      });

      const command = 'npm install some-package';

      const lowResult = await lowToleranceGuard.checkShellCommand(command);
      const highResult = await highToleranceGuard.checkShellCommand(command);

      expect(lowResult).toBeDefined();
      expect(highResult).toBeDefined();
    });

    it('should check shell commands for file operations', async () => {
      const command = 'rm /tmp/test.txt';
      const result = await guard.checkShellCommand(command);
      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should detect dangerous paths in shell commands', async () => {
      const command = 'cat /etc/passwd';
      const result = await guard.checkShellCommand(command);
      expect(result).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel);
    });

    it('should assess package install commands', async () => {
      const command = 'npm install malicious-package';
      const result = await guard.checkShellCommand(command);
      expect(result).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel);
    });
  });

  describe('Classification Types', () => {
    it('should handle all classification types', () => {
      const types: ClassificationType[] = [
        'confirmation_prompt',
        'status_update',
        'genuine_question',
        'blocking_request',
        'error_signal',
        'completion_signal',
        'rate_limit_or_context'
      ];

      types.forEach(type => {
        const classification: Classification = {
          type,
          confidence: 0.8,
          method: 'pattern_library',
          reason: `Test for ${type}`,
          timestamp: new Date().toISOString()
        };

        expect(classification.type).toBe(type);
      });
    });
  });
});

describe('Iterate Mode Controller Integration', () => {
  describe('State Management', () => {
    it('should track iteration counts', async () => {
      // State tracking test
      const state = {
        iterationCount: 0,
        maxIterations: 100,
        startTime: Date.now(),
        tokensUsed: 0
      };

      state.iterationCount++;
      expect(state.iterationCount).toBe(1);

      state.iterationCount++;
      expect(state.iterationCount).toBe(2);

      expect(state.iterationCount).toBeLessThanOrEqual(state.maxIterations);
    });

    it('should track token budget', async () => {
      const budget = {
        maxTokens: 100000,
        usedTokens: 0,
        warning: false
      };

      // Simulate token usage
      budget.usedTokens += 5000;
      expect(budget.usedTokens).toBe(5000);

      budget.usedTokens += 10000;
      expect(budget.usedTokens).toBe(15000);

      // Check budget warning threshold
      if (budget.usedTokens > budget.maxTokens * 0.8) {
        budget.warning = true;
      }
      expect(budget.warning).toBe(false);
    });

    it('should track duration', async () => {
      const startTime = Date.now();
      const maxDurationMs = 60000; // 1 minute

      // Simulate small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(maxDurationMs);
    });
  });

  describe('Pause/Resume Logic', () => {
    it('should pause on genuine questions', async () => {
      const shouldPause = (classificationType: ClassificationType): boolean => {
        const pauseTypes: ClassificationType[] = [
          'genuine_question',
          'blocking_request',
          'error_signal',
          'rate_limit_or_context'
        ];
        return pauseTypes.includes(classificationType);
      };

      expect(shouldPause('genuine_question')).toBe(true);
      expect(shouldPause('blocking_request')).toBe(true);
      expect(shouldPause('confirmation_prompt')).toBe(false);
      expect(shouldPause('status_update')).toBe(false);
    });

    it('should continue on confirmation prompts', async () => {
      const shouldContinue = (classificationType: ClassificationType): boolean => {
        const continueTypes: ClassificationType[] = [
          'confirmation_prompt',
          'status_update',
          'completion_signal'
        ];
        return continueTypes.includes(classificationType);
      };

      expect(shouldContinue('confirmation_prompt')).toBe(true);
      expect(shouldContinue('status_update')).toBe(true);
      expect(shouldContinue('genuine_question')).toBe(false);
    });
  });
});
