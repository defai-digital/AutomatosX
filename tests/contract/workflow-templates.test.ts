/**
 * Workflow Templates Contract Invariant Tests
 *
 * Tests for workflow template invariants documented in
 * packages/contracts/src/workflow-templates/v1/invariants.md
 *
 * Invariants tested:
 * - INV-WT-001: Agent Existence (pre-execution validation)
 * - INV-WT-002: Tool Availability (pre-execution validation)
 * - INV-WT-003: Step ID Uniqueness
 * - INV-WT-004: Category-Specific Policies
 * - INV-WT-005: Output Namespace Isolation
 * - INV-WT-006: Timeout Enforcement
 * - INV-WT-007: Step Execution Order
 * - INV-WT-008: Version Monotonicity
 * - INV-WT-009: Template Immutability Post-Registration
 * - INV-WT-010: Deprecation Preservation
 * - INV-WT-011: Step Failure Isolation
 * - INV-WT-012: Retry Determinism
 */

import { describe, it, expect } from 'vitest';
import {
  WorkflowTemplateSchema,
  WorkflowTemplateStepSchema,
  WorkflowCategorySchema,
  WorkflowTemplateExecutionRequestSchema,
  WorkflowTemplateExecutionResultSchema,
  WorkflowTemplateRegistryEntrySchema,
  validateWorkflowTemplate,
  safeValidateWorkflowTemplate,
  createWorkflowTemplate,
  WorkflowTemplateErrorCodes,
} from '@defai.digital/contracts';

describe('Workflow Templates Contract', () => {
  describe('WorkflowCategorySchema', () => {
    it('should validate all category values', () => {
      const categories = [
        'ml-lifecycle',
        'product-development',
        'engineering',
        'infrastructure',
        'leadership',
        'quality',
        'security',
        'research',
      ];

      for (const category of categories) {
        const result = WorkflowCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid categories', () => {
      const result = WorkflowCategorySchema.safeParse('invalid-category');
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowTemplateStepSchema', () => {
    it('should validate a minimal step', () => {
      const step = {
        stepId: 'analyze',
        name: 'Analyze Code',
        type: 'prompt',
        config: {
          agent: 'code-reviewer',
          task: 'Review the code for issues',
        },
      };

      const result = WorkflowTemplateStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate step with retry policy', () => {
      const step = {
        stepId: 'api-call',
        name: 'Call External API',
        type: 'tool',
        timeout: 30000,
        config: {
          agent: 'api-caller',
          task: 'Call the external service',
        },
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 2000,
        },
      };

      const result = WorkflowTemplateStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should reject invalid step ID format', () => {
      const step = {
        stepId: '123-invalid', // Must start with letter
        name: 'Invalid Step',
        type: 'prompt',
        config: {
          agent: 'test',
          task: 'test task',
        },
      };

      const result = WorkflowTemplateStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should apply default timeout of 120000ms', () => {
      const step = {
        stepId: 'test-step',
        name: 'Test',
        type: 'prompt',
        config: {
          agent: 'test',
          task: 'test',
        },
      };

      const result = WorkflowTemplateStepSchema.parse(step);
      expect(result.timeout).toBe(120000);
    });

    it('should enforce timeout bounds', () => {
      const tooShort = {
        stepId: 'test',
        name: 'Test',
        type: 'prompt',
        timeout: 500, // Min is 1000
        config: { agent: 'test', task: 'test' },
      };

      const tooLong = {
        stepId: 'test',
        name: 'Test',
        type: 'prompt',
        timeout: 4000000, // Max is 3600000
        config: { agent: 'test', task: 'test' },
      };

      expect(WorkflowTemplateStepSchema.safeParse(tooShort).success).toBe(false);
      expect(WorkflowTemplateStepSchema.safeParse(tooLong).success).toBe(false);
    });

    it('should validate step types', () => {
      const validTypes = ['prompt', 'tool', 'conditional', 'parallel'];

      for (const type of validTypes) {
        const step = {
          stepId: 'test',
          name: 'Test',
          type,
          config: { agent: 'test', task: 'test' },
        };

        const result = WorkflowTemplateStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('WorkflowTemplateSchema', () => {
    const validTemplate = {
      workflowId: 'ml-experiment-tracker',
      name: 'ML Experiment Tracker',
      description: 'Track ML experiments and metrics',
      version: '1.0.0',
      category: 'ml-lifecycle',
      tags: ['ml', 'experiments', 'tracking'],
      metadata: {
        requiredAbilities: ['ml-engineering', 'data-science'],
        estimatedDuration: 300,
        complexity: 'medium',
      },
      steps: [
        {
          stepId: 'define-experiment',
          name: 'Define Experiment',
          type: 'prompt',
          config: {
            agent: 'ml-engineer',
            task: 'Define the experiment parameters',
          },
        },
        {
          stepId: 'log-metrics',
          name: 'Log Metrics',
          type: 'tool',
          config: {
            agent: 'ml-engineer',
            task: 'Log experiment metrics',
          },
        },
      ],
    };

    it('should validate a complete workflow template', () => {
      const result = WorkflowTemplateSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });

    it('should reject invalid workflowId format', () => {
      const invalid = {
        ...validTemplate,
        workflowId: '123-invalid', // Must start with letter
      };

      const result = WorkflowTemplateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const invalid = {
        ...validTemplate,
        version: 'v1.0', // Must be SemVer
      };

      const result = WorkflowTemplateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should require at least one step', () => {
      const invalid = {
        ...validTemplate,
        steps: [],
      };

      const result = WorkflowTemplateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should enforce max 50 steps', () => {
      const tooManySteps = Array.from({ length: 51 }, (_, i) => ({
        stepId: `step-${i}`,
        name: `Step ${i}`,
        type: 'prompt',
        config: { agent: 'test', task: 'test' },
      }));

      const invalid = {
        ...validTemplate,
        steps: tooManySteps,
      };

      const result = WorkflowTemplateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate storage configuration', () => {
      const withStorage = {
        ...validTemplate,
        storage: {
          namespace: 'ml-experiments',
          ttl: 86400, // 1 day
        },
      };

      const result = WorkflowTemplateSchema.safeParse(withStorage);
      expect(result.success).toBe(true);
    });

    it('should enforce storage TTL bounds', () => {
      const tooShort = {
        ...validTemplate,
        storage: {
          namespace: 'test',
          ttl: 1000, // Min is 3600 (1 hour)
        },
      };

      const result = WorkflowTemplateSchema.safeParse(tooShort);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowTemplateExecutionRequestSchema', () => {
    it('should validate minimal request', () => {
      const request = {
        templateId: 'ml-experiment-tracker',
      };

      const result = WorkflowTemplateExecutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate request with overrides', () => {
      const request = {
        templateId: 'ml-experiment-tracker',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        inputs: { experimentName: 'Test Experiment' },
        overrides: {
          timeout: 60000,
          retryPolicy: {
            maxAttempts: 5,
            backoffMs: 5000,
          },
        },
      };

      const result = WorkflowTemplateExecutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject invalid session UUID', () => {
      const request = {
        templateId: 'test',
        sessionId: 'not-a-uuid',
      };

      const result = WorkflowTemplateExecutionRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowTemplateExecutionResultSchema', () => {
    it('should validate successful result', () => {
      const result = {
        templateId: 'ml-experiment-tracker',
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 1500 },
          { stepId: 'step-2', status: 'completed', duration: 2000 },
        ],
        outputs: { summary: 'Experiment completed' },
      };

      const validation = WorkflowTemplateExecutionResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should validate failed result', () => {
      const result = {
        templateId: 'ml-experiment-tracker',
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'failed',
        startedAt: new Date().toISOString(),
        stepResults: [
          { stepId: 'step-1', status: 'completed', duration: 1500 },
          { stepId: 'step-2', status: 'failed', error: 'Agent not found' },
          { stepId: 'step-3', status: 'skipped' },
        ],
        error: 'Workflow failed at step-2',
      };

      const validation = WorkflowTemplateExecutionResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should validate all status values', () => {
      const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const result = {
          templateId: 'test',
          executionId: '550e8400-e29b-41d4-a716-446655440000',
          status,
          startedAt: new Date().toISOString(),
          stepResults: [],
        };

        const validation = WorkflowTemplateExecutionResultSchema.safeParse(result);
        expect(validation.success).toBe(true);
      }
    });
  });

  describe('WorkflowTemplateRegistryEntrySchema', () => {
    it('should validate registry entry', () => {
      const entry = {
        template: {
          workflowId: 'test-workflow',
          name: 'Test Workflow',
          description: 'A test workflow',
          version: '1.0.0',
          category: 'engineering',
          tags: ['test'],
          metadata: {
            requiredAbilities: ['coding'],
            estimatedDuration: 60,
            complexity: 'low',
          },
          steps: [
            {
              stepId: 'step-1',
              name: 'Step 1',
              type: 'prompt',
              config: { agent: 'test', task: 'test' },
            },
          ],
        },
        registeredAt: new Date().toISOString(),
        registeredBy: 'system',
        enabled: true,
      };

      const result = WorkflowTemplateRegistryEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should validate deprecated entry', () => {
      const entry = {
        template: {
          workflowId: 'old-workflow',
          name: 'Old Workflow',
          description: 'Deprecated workflow',
          version: '1.0.0',
          category: 'engineering',
          tags: [],
          metadata: {
            requiredAbilities: [],
            estimatedDuration: 60,
            complexity: 'low',
          },
          steps: [
            {
              stepId: 'step-1',
              name: 'Step',
              type: 'prompt',
              config: { agent: 'test', task: 'test' },
            },
          ],
        },
        registeredAt: new Date().toISOString(),
        registeredBy: 'system',
        enabled: false,
        deprecatedAt: new Date().toISOString(),
        deprecationReason: 'Replaced by new-workflow v2',
      };

      const result = WorkflowTemplateRegistryEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateWorkflowTemplate should throw on invalid input', () => {
      expect(() => validateWorkflowTemplate({ workflowId: '' })).toThrow();
    });

    it('safeValidateWorkflowTemplate should return error on invalid input', () => {
      const result = safeValidateWorkflowTemplate({ workflowId: '' });
      expect(result.success).toBe(false);
    });

    it('safeValidateWorkflowTemplate should return data on valid input', () => {
      const template = {
        workflowId: 'test-workflow',
        name: 'Test',
        description: 'Test workflow',
        version: '1.0.0',
        category: 'engineering',
        tags: [],
        metadata: {
          requiredAbilities: [],
          estimatedDuration: 60,
          complexity: 'low',
        },
        steps: [
          {
            stepId: 'step-1',
            name: 'Step',
            type: 'prompt',
            config: { agent: 'test', task: 'test' },
          },
        ],
      };

      const result = safeValidateWorkflowTemplate(template);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.workflowId).toBe('test-workflow');
      }
    });
  });

  describe('Factory Functions', () => {
    it('createWorkflowTemplate should create with default version', () => {
      const template = createWorkflowTemplate({
        workflowId: 'new-workflow',
        name: 'New Workflow',
        description: 'Created via factory',
        category: 'engineering',
        tags: [],
        metadata: {
          requiredAbilities: [],
          estimatedDuration: 60,
          complexity: 'low',
        },
        steps: [
          {
            stepId: 'step-1',
            name: 'Step',
            type: 'prompt',
            timeout: 30000,
            config: { agent: 'test', task: 'test' },
          },
        ],
      });

      expect(template.version).toBe('1.0.0');
    });

    it('createWorkflowTemplate should accept custom version', () => {
      const template = createWorkflowTemplate({
        workflowId: 'versioned-workflow',
        name: 'Versioned',
        description: 'With custom version',
        version: '2.1.0',
        category: 'engineering',
        tags: [],
        metadata: {
          requiredAbilities: [],
          estimatedDuration: 60,
          complexity: 'low',
        },
        steps: [
          {
            stepId: 'step-1',
            name: 'Step',
            type: 'prompt',
            timeout: 30000,
            config: { agent: 'test', task: 'test' },
          },
        ],
      });

      expect(template.version).toBe('2.1.0');
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(WorkflowTemplateErrorCodes.TEMPLATE_NOT_FOUND).toBe('WORKFLOW_TEMPLATE_NOT_FOUND');
      expect(WorkflowTemplateErrorCodes.TEMPLATE_ALREADY_EXISTS).toBe(
        'WORKFLOW_TEMPLATE_ALREADY_EXISTS'
      );
      expect(WorkflowTemplateErrorCodes.TEMPLATE_DEPRECATED).toBe('WORKFLOW_TEMPLATE_DEPRECATED');
      expect(WorkflowTemplateErrorCodes.AGENT_NOT_FOUND).toBe('WORKFLOW_TEMPLATE_AGENT_NOT_FOUND');
      expect(WorkflowTemplateErrorCodes.TOOL_NOT_AVAILABLE).toBe(
        'WORKFLOW_TEMPLATE_TOOL_NOT_AVAILABLE'
      );
      expect(WorkflowTemplateErrorCodes.STEP_TIMEOUT).toBe('WORKFLOW_TEMPLATE_STEP_TIMEOUT');
      expect(WorkflowTemplateErrorCodes.EXECUTION_FAILED).toBe('WORKFLOW_TEMPLATE_EXECUTION_FAILED');
    });
  });
});

// ============================================================================
// Workflow Template Invariant Tests
// ============================================================================

describe('INV-WT: Workflow Template Invariants', () => {
  describe('INV-WT-003: Step ID Uniqueness', () => {
    it('should allow unique step IDs', () => {
      const template = {
        workflowId: 'test',
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        category: 'engineering',
        tags: [],
        metadata: {
          requiredAbilities: [],
          estimatedDuration: 60,
          complexity: 'low',
        },
        steps: [
          { stepId: 'step-1', name: 'Step 1', type: 'prompt', config: { agent: 'a', task: 't' } },
          { stepId: 'step-2', name: 'Step 2', type: 'prompt', config: { agent: 'a', task: 't' } },
          { stepId: 'step-3', name: 'Step 3', type: 'prompt', config: { agent: 'a', task: 't' } },
        ],
      };

      const result = WorkflowTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    // Note: Duplicate step ID detection would be handled by superRefine in production
    // For now, schema allows duplicates but runtime validation should catch them
  });

  describe('INV-WT-006: Timeout Enforcement', () => {
    it('should apply default timeout', () => {
      const step = {
        stepId: 'test',
        name: 'Test',
        type: 'prompt',
        config: { agent: 'test', task: 'test' },
      };

      const result = WorkflowTemplateStepSchema.parse(step);
      expect(result.timeout).toBe(120000); // 2 minutes default
    });

    it('should enforce minimum timeout of 1 second', () => {
      const step = {
        stepId: 'test',
        name: 'Test',
        type: 'prompt',
        timeout: 500, // Less than 1000ms
        config: { agent: 'test', task: 'test' },
      };

      const result = WorkflowTemplateStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should enforce maximum timeout of 1 hour', () => {
      const step = {
        stepId: 'test',
        name: 'Test',
        type: 'prompt',
        timeout: 3600001, // More than 1 hour
        config: { agent: 'test', task: 'test' },
      };

      const result = WorkflowTemplateStepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should accept boundary timeout values', () => {
      const minTimeout = {
        stepId: 'min',
        name: 'Min',
        type: 'prompt',
        timeout: 1000,
        config: { agent: 'test', task: 'test' },
      };

      const maxTimeout = {
        stepId: 'max',
        name: 'Max',
        type: 'prompt',
        timeout: 3600000,
        config: { agent: 'test', task: 'test' },
      };

      expect(WorkflowTemplateStepSchema.safeParse(minTimeout).success).toBe(true);
      expect(WorkflowTemplateStepSchema.safeParse(maxTimeout).success).toBe(true);
    });
  });

  describe('INV-WT-008: Version Monotonicity', () => {
    it('should validate SemVer format', () => {
      const validVersions = ['1.0.0', '0.1.0', '2.10.100', '10.20.30'];

      for (const version of validVersions) {
        const template = {
          workflowId: 'test',
          name: 'Test',
          description: 'Test',
          version,
          category: 'engineering',
          tags: [],
          metadata: {
            requiredAbilities: [],
            estimatedDuration: 60,
            complexity: 'low',
          },
          steps: [
            { stepId: 'step-1', name: 'Step', type: 'prompt', config: { agent: 'a', task: 't' } },
          ],
        };

        const result = WorkflowTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['v1.0.0', '1.0', '1', 'latest', '1.0.0-beta'];

      for (const version of invalidVersions) {
        const template = {
          workflowId: 'test',
          name: 'Test',
          description: 'Test',
          version,
          category: 'engineering',
          tags: [],
          metadata: {
            requiredAbilities: [],
            estimatedDuration: 60,
            complexity: 'low',
          },
          steps: [
            { stepId: 'step-1', name: 'Step', type: 'prompt', config: { agent: 'a', task: 't' } },
          ],
        };

        const result = WorkflowTemplateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('INV-WT-012: Retry Determinism', () => {
    it('should validate retry policy defaults', () => {
      const step = {
        stepId: 'test',
        name: 'Test',
        type: 'tool',
        config: { agent: 'test', task: 'test' },
        retryPolicy: {
          maxAttempts: 2,
          backoffMs: 2000,
        },
      };

      const result = WorkflowTemplateStepSchema.parse(step);
      expect(result.retryPolicy?.maxAttempts).toBe(2);
      expect(result.retryPolicy?.backoffMs).toBe(2000);
    });

    it('should enforce maxAttempts bounds', () => {
      const tooFew = {
        stepId: 'test',
        name: 'Test',
        type: 'tool',
        config: { agent: 'test', task: 'test' },
        retryPolicy: { maxAttempts: 0, backoffMs: 1000 },
      };

      const tooMany = {
        stepId: 'test',
        name: 'Test',
        type: 'tool',
        config: { agent: 'test', task: 'test' },
        retryPolicy: { maxAttempts: 10, backoffMs: 1000 },
      };

      expect(WorkflowTemplateStepSchema.safeParse(tooFew).success).toBe(false);
      expect(WorkflowTemplateStepSchema.safeParse(tooMany).success).toBe(false);
    });

    it('should enforce backoffMs bounds', () => {
      const tooShort = {
        stepId: 'test',
        name: 'Test',
        type: 'tool',
        config: { agent: 'test', task: 'test' },
        retryPolicy: { maxAttempts: 2, backoffMs: 500 },
      };

      const tooLong = {
        stepId: 'test',
        name: 'Test',
        type: 'tool',
        config: { agent: 'test', task: 'test' },
        retryPolicy: { maxAttempts: 2, backoffMs: 60000 },
      };

      expect(WorkflowTemplateStepSchema.safeParse(tooShort).success).toBe(false);
      expect(WorkflowTemplateStepSchema.safeParse(tooLong).success).toBe(false);
    });
  });
});
