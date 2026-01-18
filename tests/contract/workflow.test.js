import { describe, it, expect } from 'vitest';
import { WorkflowSchema, WorkflowStepSchema, RetryPolicySchema, validateWorkflow, safeValidateWorkflow, } from '@defai.digital/contracts';
describe('Workflow Contract V1', () => {
    describe('Schema Validation', () => {
        it('should validate a minimal valid workflow', () => {
            const workflow = {
                workflowId: 'test-workflow',
                version: '1.0.0',
                steps: [
                    {
                        stepId: 'step-1',
                        type: 'prompt',
                    },
                ],
            };
            const result = safeValidateWorkflow(workflow);
            expect(result.success).toBe(true);
        });
        it('should validate a complete workflow with all fields', () => {
            const workflow = {
                workflowId: 'complete-workflow',
                version: '2.1.0',
                name: 'Complete Test Workflow',
                description: 'A workflow with all optional fields populated',
                steps: [
                    {
                        stepId: 'step-1',
                        type: 'prompt',
                        name: 'Initial Prompt',
                        inputSchema: { $ref: '#/definitions/Input' },
                        outputSchema: { $ref: '#/definitions/Output' },
                        retryPolicy: {
                            maxAttempts: 3,
                            backoffMs: 1000,
                            backoffMultiplier: 2,
                            retryOn: ['timeout', 'rate_limit'],
                        },
                        timeout: 30000,
                        config: { temperature: 0.7 },
                    },
                    {
                        stepId: 'step-2',
                        type: 'tool',
                        name: 'Tool Step',
                    },
                ],
                metadata: { author: 'test', created: '2024-12-14' },
            };
            const result = validateWorkflow(workflow);
            expect(result.workflowId).toBe('complete-workflow');
            expect(result.steps).toHaveLength(2);
        });
        it('should reject workflow without required fields', () => {
            const invalid = {
                version: '1.0.0',
                steps: [],
            };
            const result = safeValidateWorkflow(invalid);
            expect(result.success).toBe(false);
        });
        it('should reject empty steps array', () => {
            const invalid = {
                workflowId: 'test',
                version: '1.0.0',
                steps: [],
            };
            const result = safeValidateWorkflow(invalid);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-WF-003: Schema Strictness', () => {
        it('should reject unknown fields at workflow level', () => {
            const withUnknownField = {
                workflowId: 'test',
                version: '1.0.0',
                steps: [{ stepId: 'step-1', type: 'prompt' }],
                unknownField: 'should fail',
            };
            // Zod strict mode should reject this
            const strictSchema = WorkflowSchema.strict();
            const result = strictSchema.safeParse(withUnknownField);
            expect(result.success).toBe(false);
        });
        it('should reject unknown fields at step level', () => {
            const withUnknownStepField = {
                workflowId: 'test',
                version: '1.0.0',
                steps: [
                    {
                        stepId: 'step-1',
                        type: 'prompt',
                        unknownStepField: 'should fail',
                    },
                ],
            };
            const strictStepSchema = WorkflowStepSchema.strict();
            const result = strictStepSchema.safeParse(withUnknownStepField.steps[0]);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-WF-004: Step ID Validation', () => {
        it('should accept valid stepId format', () => {
            const validSteps = [
                { stepId: 'step-1', type: 'prompt' },
                { stepId: 'my-step', type: 'tool' },
                { stepId: 'a123', type: 'conditional' },
            ];
            for (const step of validSteps) {
                const result = WorkflowStepSchema.safeParse(step);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid stepId format', () => {
            const invalidSteps = [
                { stepId: '123-step', type: 'prompt' }, // starts with number
                { stepId: 'Step-1', type: 'prompt' }, // uppercase
                { stepId: 'step_1', type: 'prompt' }, // underscore not allowed
                { stepId: '', type: 'prompt' }, // empty
            ];
            for (const step of invalidSteps) {
                const result = WorkflowStepSchema.safeParse(step);
                expect(result.success).toBe(false);
            }
        });
    });
    describe('Retry Policy Validation', () => {
        it('should validate retry policy with defaults', () => {
            const policy = {};
            const result = RetryPolicySchema.safeParse(policy);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxAttempts).toBe(1);
                expect(result.data.backoffMs).toBe(1000);
                expect(result.data.backoffMultiplier).toBe(2);
            }
        });
        it('should reject invalid retry policy values', () => {
            const invalidPolicies = [
                { maxAttempts: 0 }, // below minimum
                { maxAttempts: 100 }, // above maximum
                { backoffMs: 50 }, // below minimum
                { backoffMultiplier: 10 }, // above maximum
            ];
            for (const policy of invalidPolicies) {
                const result = RetryPolicySchema.safeParse(policy);
                expect(result.success).toBe(false);
            }
        });
    });
    describe('Step Type Validation', () => {
        it('should accept all valid step types', () => {
            const validTypes = ['prompt', 'tool', 'conditional', 'loop', 'parallel'];
            for (const type of validTypes) {
                const step = { stepId: 'test', type };
                const result = WorkflowStepSchema.safeParse(step);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid step types', () => {
            const step = { stepId: 'test', type: 'invalid-type' };
            const result = WorkflowStepSchema.safeParse(step);
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=workflow.test.js.map