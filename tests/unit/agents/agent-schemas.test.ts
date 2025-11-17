/**
 * Tests for Zod Agent Profile Schemas
 */

import { describe, it, expect } from 'vitest';
import {
  agentProfileSchema,
  stageSchema,
  personalitySchema,
  redirectRuleSchema,
  selectionMetadataSchema,
  agentRunOptionsSchema,
  agentCreateOptionsSchema,
  memorySearchOptionsSchema,
  validateAgentProfile,
  safeValidateAgentProfile,
  validateAgentRunOptions,
  validatePartialAgentProfile
} from '../../../src/agents/agent-schemas.js';

describe('Agent Schemas - Zod Validation', () => {
  describe('Agent Profile Schema', () => {
    it('should validate valid agent profile', () => {
      const profile = {
        name: 'test-agent',
        displayName: 'Test Agent',
        version: '1.0.0',
        description: 'A test agent',
        role: 'Testing',
        expertise: ['testing', 'validation'],
        capabilities: ['test execution'],
        enabled: true
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(true);
    });

    it('should reject invalid agent names', () => {
      const profile = {
        name: 'test@agent',  // Invalid character
        description: 'Test'
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(false);
    });

    it('should reject names that are too long', () => {
      const profile = {
        name: 'a'.repeat(51),  // Max 50 characters
        description: 'Test'
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(false);
    });

    it('should require description', () => {
      const profile = {
        name: 'test-agent'
        // Missing description
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(false);
    });

    it('should require at least one expertise if provided', () => {
      const profile = {
        name: 'test-agent',
        description: 'Test',
        expertise: []  // Empty array not allowed if specified
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(false);
    });

    it('should accept profile with workflow', () => {
      const profile = {
        name: 'test-agent',
        description: 'Test',
        workflow: [
          {
            name: 'Step 1',
            description: 'First step',
            key_questions: ['What to do?'],
            outputs: ['result']
          }
        ]
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(true);
    });

    it('should validate version format', () => {
      const profile = {
        name: 'test-agent',
        description: 'Test',
        version: 'invalid-version'  // Not semver
      };

      const result = safeValidateAgentProfile(profile);
      expect(result.success).toBe(false);
    });
  });

  describe('Stage Schema', () => {
    it('should validate valid stage', () => {
      const stage = {
        name: 'Analysis',
        description: 'Analyze the problem',
        key_questions: ['What is the issue?'],
        outputs: ['analysis report'],
        checkpoint: true,
        timeout: 30000,
        maxRetries: 3,
        retryDelay: 1000
      };

      const result = stageSchema.safeParse(stage);
      expect(result.success).toBe(true);
    });

    it('should reject invalid temperature', () => {
      const stage = {
        name: 'Test',
        description: 'Test stage',
        temperature: 3.0  // Must be 0-2
      };

      const result = stageSchema.safeParse(stage);
      expect(result.success).toBe(false);
    });

    it('should reject excessive max retries', () => {
      const stage = {
        name: 'Test',
        description: 'Test stage',
        maxRetries: 20  // Max 10
      };

      const result = stageSchema.safeParse(stage);
      expect(result.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      const stage = {
        name: 'Test',
        description: 'Test stage',
        timeout: -1000  // Must be positive
      };

      const result = stageSchema.safeParse(stage);
      expect(result.success).toBe(false);
    });
  });

  describe('Personality Schema', () => {
    it('should validate valid personality', () => {
      const personality = {
        traits: ['analytical', 'methodical'],
        catchphrase: 'Let me analyze that',
        communication_style: 'formal and precise',
        decision_making: 'data-driven'
      };

      const result = personalitySchema.safeParse(personality);
      expect(result.success).toBe(true);
    });

    it('should allow partial personality', () => {
      const personality = {
        traits: ['helpful']
      };

      const result = personalitySchema.safeParse(personality);
      expect(result.success).toBe(true);
    });

    it('should allow empty personality', () => {
      const personality = {};

      const result = personalitySchema.safeParse(personality);
      expect(result.success).toBe(true);
    });
  });

  describe('Redirect Rule Schema', () => {
    it('should validate valid redirect rule', () => {
      const rule = {
        phrase: 'machine learning|deep learning',
        suggest: 'Dana (Data Scientist)'
      };

      const result = redirectRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    });

    it('should reject empty phrase', () => {
      const rule = {
        phrase: '',  // Empty not allowed
        suggest: 'Other Agent'
      };

      const result = redirectRuleSchema.safeParse(rule);
      expect(result.success).toBe(false);
    });

    it('should reject empty suggestion', () => {
      const rule = {
        phrase: 'test',
        suggest: ''  // Empty not allowed
      };

      const result = redirectRuleSchema.safeParse(rule);
      expect(result.success).toBe(false);
    });
  });

  describe('Selection Metadata Schema', () => {
    it('should validate valid selection metadata', () => {
      const metadata = {
        primaryIntents: ['ML debugging', 'model training'],
        secondarySignals: ['tensorflow', 'pytorch'],
        negativeIntents: ['Not for data collection'],
        keywords: ['neural network', 'gradient'],
        antiKeywords: ['database', 'frontend']
      };

      const result = selectionMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should allow partial metadata', () => {
      const metadata = {
        primaryIntents: ['testing']
      };

      const result = selectionMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('Agent Run Options Schema', () => {
    it('should validate valid run options', () => {
      const options = {
        memory: true,
        saveMemory: true,
        session: 'test-session',
        provider: 'claude',
        format: 'json',
        verbose: true,
        parallel: false,
        streaming: true
      };

      const result = agentRunOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should validate format enum', () => {
      const options = {
        format: 'invalid'  // Must be 'text' or 'json'
      };

      const result = agentRunOptionsSchema.safeParse(options as any);
      expect(result.success).toBe(false);
    });

    it('should allow minimal options', () => {
      const options = {};

      const result = agentRunOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Agent Create Options Schema', () => {
    it('should validate valid create options', () => {
      const options = {
        template: 'developer',
        interactive: true,
        force: false,
        description: 'Test agent',
        role: 'Testing',
        expertise: ['testing', 'qa'],
        displayName: 'Test Agent'
      };

      const result = agentCreateOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should allow minimal options', () => {
      const options = {
        template: 'default'
      };

      const result = agentCreateOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Memory Search Options Schema', () => {
    it('should validate valid search options', () => {
      const options = {
        limit: 50,
        agent: 'test-agent',
        session: 'test-session',
        format: 'json',
        before: '2024-12-31',
        after: '2024-01-01'
      };

      const result = memorySearchOptionsSchema.safeParse(options);
      expect(result.success).toBe(true);
    });

    it('should enforce limit maximum', () => {
      const options = {
        limit: 20000  // Max 10000
      };

      const result = memorySearchOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const options = {
        limit: -10
      };

      const result = memorySearchOptionsSchema.safeParse(options);
      expect(result.success).toBe(false);
    });
  });

  describe('Partial Profile Validation', () => {
    it('should validate partial profile updates', () => {
      const partial = {
        description: 'Updated description',
        enabled: false
      };

      const result = validatePartialAgentProfile(partial);
      expect(result.success).toBe(true);
    });

    it('should reject invalid partial updates', () => {
      const partial = {
        name: 'invalid@name'  // Invalid character
      };

      const result = validatePartialAgentProfile(partial);
      expect(result.success).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should throw on invalid profile', () => {
      const invalidProfile = {
        name: 'test@invalid'
      };

      expect(() => validateAgentProfile(invalidProfile)).toThrow();
    });

    it('should not throw on valid profile', () => {
      const validProfile = {
        name: 'test-agent',
        description: 'Test agent'
      };

      expect(() => validateAgentProfile(validProfile)).not.toThrow();
    });

    it('should throw on invalid run options', () => {
      const invalidOptions = {
        format: 'invalid'
      };

      expect(() => validateAgentRunOptions(invalidOptions)).toThrow();
    });
  });
});
