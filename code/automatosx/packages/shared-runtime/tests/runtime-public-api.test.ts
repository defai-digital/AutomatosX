import { describe, expect, it } from 'vitest';
import * as runtime from '../src/index.js';
import {
  BLOCKED_INTERNAL_VALUE_EXPORTS,
  EXPECTED_RUNTIME_VALUE_EXPORTS,
} from './support/runtime-public-api-manifest.js';

describe('shared-runtime public api', () => {
  it('exports the canonical runtime entrypoints and schemas', () => {
    expect(runtime).toMatchObject({
      createSharedRuntimeService: expect.any(Function),
      createRuntimeBridgeService: expect.any(Function),
      RuntimeGovernanceAggregateSchema: expect.any(Object),
      formatWorkflowInputSummary: expect.any(Function),
      listWorkflowCatalog: expect.any(Function),
      listStableAgentEntries: expect.any(Function),
      resolveEffectiveWorkflowDir: expect.any(Function),
    });
  });

  it('keeps the value export surface explicit', () => {
    expect(Object.keys(runtime).sort()).toEqual([...EXPECTED_RUNTIME_VALUE_EXPORTS]);
  });

  it('does not leak internal support modules through the package entrypoint', () => {
    for (const symbol of BLOCKED_INTERNAL_VALUE_EXPORTS) {
      expect(runtime).not.toHaveProperty(symbol);
    }
  });
});
