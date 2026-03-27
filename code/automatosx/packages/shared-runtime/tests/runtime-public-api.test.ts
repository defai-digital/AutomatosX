import { describe, expect, it } from 'vitest';
import * as runtime from '../src/index.js';
import {
  BLOCKED_INTERNAL_VALUE_EXPORTS,
  EXPECTED_TOP_LEVEL_RUNTIME_VALUE_EXPORTS,
} from './support/runtime-public-api-manifest.js';

describe('shared-runtime public api', () => {
  it('exports only the canonical top-level runtime entrypoint', () => {
    expect(runtime).toMatchObject({
      createSharedRuntimeService: expect.any(Function),
    });
  });

  it('keeps the top-level value export surface explicit and minimal', () => {
    expect(Object.keys(runtime).sort()).toEqual([...EXPECTED_TOP_LEVEL_RUNTIME_VALUE_EXPORTS]);
  });

  it('does not leak internal or domain-specific helpers through the top-level package entrypoint', () => {
    for (const symbol of BLOCKED_INTERNAL_VALUE_EXPORTS) {
      expect(runtime).not.toHaveProperty(symbol);
    }
    expect(runtime).not.toHaveProperty('createRuntimeBridgeService');
    expect(runtime).not.toHaveProperty('RuntimeGovernanceAggregateSchema');
    expect(runtime).not.toHaveProperty('listWorkflowCatalog');
  });
});
