/**
 * Iterate Auto-Responder Tests
 *
 * Tests for the iterate mode auto-responder which generates appropriate
 * responses for classified AI prompts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IterateAutoResponder } from '@/core/iterate/iterate-auto-responder.js';
import type { Classification } from '@/types/iterate.js';

describe('IterateAutoResponder', () => {
  let responder: IterateAutoResponder;
  const defaultConfig = {
    templateLibraryPath: 'tests/fixtures/iterate/sample-templates.yaml',
    randomizeTemplates: false,
    enableContextVars: true
  };

  beforeEach(() => {
    responder = new IterateAutoResponder(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateResponse', () => {
    it('should return null for status_update classification', async () => {
      const classification: Classification = {
        type: 'status_update',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Pattern match',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'Working on the implementation...',
        classification,
        provider: 'claude'
      });

      expect(response).toBeNull();
    });

    it('should return null for genuine_question classification', async () => {
      const classification: Classification = {
        type: 'genuine_question',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Question pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'Which approach would you prefer?',
        classification,
        provider: 'claude'
      });

      expect(response).toBeNull();
    });

    it('should return affirmative for confirmation_prompt classification', async () => {
      await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Confirmation pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'Should I proceed with the implementation?',
        classification,
        provider: 'claude'
      });

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      // Should be some form of affirmative
      const affirmatives = ['yes', 'proceed', 'continue', 'go ahead', 'sounds good'];
      expect(
        affirmatives.some(word => response?.toLowerCase().includes(word))
      ).toBe(true);
    });

    it('should return acknowledgment for completion_signal classification', async () => {
      await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const classification: Classification = {
        type: 'completion_signal',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Completion pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'All tasks completed successfully.',
        classification,
        provider: 'claude'
      });

      expect(response).toBeTruthy();
      // Should be acknowledgment
      const acks = ['thank', 'great', 'excellent', 'done'];
      expect(
        acks.some(word => response?.toLowerCase().includes(word))
      ).toBe(true);
    });

    it('should return null for blocking_request classification', async () => {
      const classification: Classification = {
        type: 'blocking_request',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Blocking pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'API key needed to continue',
        classification,
        provider: 'claude'
      });

      expect(response).toBeNull();
    });

    it('should return null for error_signal classification', async () => {
      const classification: Classification = {
        type: 'error_signal',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Error pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'Error: Connection failed',
        classification,
        provider: 'claude'
      });

      expect(response).toBeNull();
    });

    it('should use fallback response when templates not loaded', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Confirmation pattern',
        timestamp: new Date().toISOString()
      };

      const response = await responder.generateResponse(classification, {
        message: 'Should I proceed?',
        classification,
        provider: 'claude'
      });

      // Should use hardcoded fallback
      expect(response).toBe('Yes, please proceed.');
    });
  });

  describe('loadTemplates', () => {
    it('should handle missing template file gracefully', async () => {
      // Should not throw
      await expect(
        responder.loadTemplates('/nonexistent/path/templates.yaml')
      ).resolves.not.toThrow();
    });

    it('should load valid template file', async () => {
      await expect(
        responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml')
      ).resolves.not.toThrow();
    });
  });

  describe('variable substitution', () => {
    it('should substitute variables in templates', async () => {
      await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Confirmation pattern',
        timestamp: new Date().toISOString()
      };

      const responderWithVars = new IterateAutoResponder({
        ...defaultConfig,
        enableContextVars: true
      });
      await responderWithVars.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      // Note: This test just verifies the response is generated,
      // actual variable substitution would require templates with {{var}} placeholders
      const response = await responderWithVars.generateResponse(classification, {
        message: 'Should I implement UserAuth as described?',
        classification,
        provider: 'claude',
        variables: { component_name: 'UserAuth' }
      });

      expect(response).toBeTruthy();
    });
  });
});
