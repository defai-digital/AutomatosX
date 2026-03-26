import { describe, expect, it } from 'vitest';
import { objectSchema, validateInput } from '../src/tool-schema.js';

describe('tool schema validation', () => {
  it('reports missing required fields with the existing message shape', () => {
    const schema = objectSchema({
      workflowId: { type: 'string' },
      verbose: { type: 'boolean' },
    }, ['workflowId']);

    expect(validateInput({}, schema)).toBe('workflowId is required');
  });

  it('reports unexpected keys on strict objects', () => {
    const schema = objectSchema({
      workflowId: { type: 'string' },
    }, ['workflowId']);

    expect(validateInput({ workflowId: 'architect', extra: true }, schema)).toBe('extra is not allowed');
  });

  it('reports nested enum validation with argument paths', () => {
    const schema = objectSchema({
      config: objectSchema({
        mode: { type: 'string', enum: ['safe', 'fast'] },
      }, ['mode']),
    }, ['config']);

    expect(validateInput({ config: { mode: 'turbo' } }, schema)).toBe('arguments.config.mode must be one of: safe, fast');
  });

  it('reports array item validation with indexed argument paths', () => {
    const schema = objectSchema({
      tasks: {
        type: 'array',
        items: objectSchema({
          taskId: { type: 'string' },
        }, ['taskId']),
      },
    }, ['tasks']);

    expect(validateInput({ tasks: [{ taskId: 1 }] }, schema)).toBe('arguments.tasks[0].taskId must be a string');
  });
});
