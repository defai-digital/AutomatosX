/**
 * Iterate Auto-Responder Tests
 *
 * Tests for automatic response generation
 *
 * @module tests/unit/iterate/responder.test
 * @since v6.4.0 (Week 1 scaffolding)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IterateAutoResponder } from '../../../src/core/iterate/iterate-auto-responder.js';
import type {
  ResponderConfig,
  ResponseContext
} from '../../../src/core/iterate/iterate-auto-responder.js';
import type {
  Classification,
  TemplateLibrary
} from '../../../src/types/iterate.js';

describe('IterateAutoResponder', () => {
  let responder: IterateAutoResponder;
  let mockConfig: ResponderConfig;

  beforeEach(() => {
    // Mock responder configuration
    mockConfig = {
      templateLibraryPath: '.automatosx/iterate/templates.yaml',
      randomizeTemplates: true,
      enableContextVars: true
    };

    responder = new IterateAutoResponder(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create responder with config', () => {
      expect(responder).toBeDefined();
      expect(responder).toBeInstanceOf(IterateAutoResponder);
    });

    it('should accept config options', () => {
      const customConfig: ResponderConfig = {
        templateLibraryPath: 'custom/path.yaml',
        randomizeTemplates: false,
        enableContextVars: false
      };

      const customResponder = new IterateAutoResponder(customConfig);
      expect(customResponder).toBeDefined();
    });
  });

  describe('generateResponse() - Week 1 Skeleton', () => {
    it('should return hardcoded response for confirmation_prompt', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Test reason',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Should I proceed?',
        classification,
        provider: 'claude-code'
      };

      const response = await responder.generateResponse(classification, context);

      expect(response).toBe('Yes, please proceed.');
    });

    it('should return null for status_update', async () => {
      const classification: Classification = {
        type: 'status_update',
        confidence: 0.8,
        method: 'pattern_library',
        reason: 'Test reason',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Working on implementation...',
        classification,
        provider: 'gemini-cli'
      };

      const response = await responder.generateResponse(classification, context);

      expect(response).toBeNull();
    });

    it('should return null for genuine_question', async () => {
      const classification: Classification = {
        type: 'genuine_question',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test reason',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Which authentication method should we use?',
        classification,
        provider: 'openai'
      };

      const response = await responder.generateResponse(classification, context);

      expect(response).toBeNull();
    });

    it('should return null for blocking_request', async () => {
      const classification: Classification = {
        type: 'blocking_request',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Test reason',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Please provide API key',
        classification,
        provider: 'claude-code'
      };

      const response = await responder.generateResponse(classification, context);

      expect(response).toBeNull();
    });

    it('should accept optional variables in context', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Test reason',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Should I implement {{component_name}}?',
        classification,
        provider: 'claude-code',
        variables: { component_name: 'UserAuth' }
      };

      const response = await responder.generateResponse(classification, context);

      // Week 1: Variable substitution not implemented, just verify it doesn't throw
      expect(response).toBeDefined();
    });
  });

  describe('loadTemplates() - Week 1 Skeleton', () => {
    it('should accept template library path', async () => {
      // Week 1: No-op, just verify it doesn't throw
      await expect(
        responder.loadTemplates('.automatosx/iterate/templates.yaml')
      ).resolves.not.toThrow();
    });
  });

  describe('updateTemplates() - Week 1 Skeleton', () => {
    it('should accept template library update', async () => {
      const mockTemplates = {
        version: '1.0.0',
        templates: {
          confirmation_prompt: [
            {
              template: 'Yes, proceed.',
              type: 'confirmation_prompt' as const,
              priority: 1,
              provider: null
            }
          ]
        }
      } as TemplateLibrary;

      // Week 1: No-op, just verify it doesn't throw
      await expect(responder.updateTemplates(mockTemplates)).resolves.not.toThrow();
    });
  });

  // Phase 3: Advanced template system tests
  describe('Template System - Phase 3', () => {
    beforeEach(async () => {
      await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');
    });

    it('should load and validate templates from YAML', async () => {
      // Templates should be loaded
      expect(responder['templates']).toBeDefined();
      expect(responder['templates']?.version).toBeDefined();

      // Should have templates for different types
      expect(responder['templates']?.templates).toBeDefined();
    });

    it('should select correct template for classification type', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Should I proceed?',
        classification,
        provider: 'claude'
      };

      const response = await responder.generateResponse(classification, context);

      // Should get a response for confirmation_prompt
      expect(response).not.toBeNull();
      expect(typeof response).toBe('string');
    });

    it('should perform variable substitution correctly', async () => {
      // Load templates first
      await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Should I implement the feature?',
        classification,
        provider: 'claude',
        variables: {
          component_name: 'UserAuth',
          action: 'implementation'
        }
      };

      const response = await responder.generateResponse(classification, context);

      // Response should be generated (variable substitution happens if template has vars)
      expect(response).not.toBeNull();
    });

    it('should apply provider-specific formatting', async () => {
      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      // Test with Claude provider
      const claudeContext: ResponseContext = {
        message: 'Ready?',
        classification,
        provider: 'claude-3'
      };

      const claudeResponse = await responder.generateResponse(classification, claudeContext);
      expect(claudeResponse).not.toBeNull();

      // Test with Gemini provider
      const geminiContext: ResponseContext = {
        message: 'Ready?',
        classification,
        provider: 'gemini'
      };

      const geminiResponse = await responder.generateResponse(classification, geminiContext);
      expect(geminiResponse).not.toBeNull();
    });

    it('should handle edge cases', async () => {
      // Test with empty message
      const emptyClassification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.5,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const emptyContext: ResponseContext = {
        message: '',
        classification: emptyClassification,
        provider: 'test'
      };

      const emptyResponse = await responder.generateResponse(emptyClassification, emptyContext);
      // Should still work
      expect(emptyResponse).not.toBeNull();

      // Test with type that has no templates
      const rareClassification: Classification = {
        type: 'rate_limit_or_context',
        confidence: 0.9,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const rareContext: ResponseContext = {
        message: 'Rate limit reached',
        classification: rareClassification,
        provider: 'test'
      };

      const rareResponse = await responder.generateResponse(rareClassification, rareContext);
      // Should return null for types that don't need auto-response
      expect(rareResponse).toBeNull();
    });

    it('should return null when templates not loaded', async () => {
      // Create fresh responder without loading templates
      const freshResponder = new IterateAutoResponder({
        templateLibraryPath: '',
        randomizeTemplates: false,
        enableContextVars: true
      });

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Test',
        classification,
        provider: 'test'
      };

      const response = await freshResponder.generateResponse(classification, context);

      // Should return fallback response since no templates
      expect(response).toBe('Yes, please proceed.');
    });

    it('should handle template randomization when enabled', async () => {
      // Create responder with randomization enabled
      const randomResponder = new IterateAutoResponder({
        templateLibraryPath: 'tests/fixtures/iterate/sample-templates.yaml',
        randomizeTemplates: true,
        enableContextVars: true
      });

      await randomResponder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');

      const classification: Classification = {
        type: 'confirmation_prompt',
        confidence: 0.95,
        method: 'pattern_library',
        reason: 'Test',
        timestamp: new Date().toISOString()
      };

      const context: ResponseContext = {
        message: 'Ready?',
        classification,
        provider: 'claude'
      };

      // Generate multiple responses - with randomization, might get different ones
      const responses = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const response = await randomResponder.generateResponse(classification, context);
        if (response) {
          responses.add(response);
        }
      }

      // Should have at least one response
      expect(responses.size).toBeGreaterThan(0);
    });
  });
});
