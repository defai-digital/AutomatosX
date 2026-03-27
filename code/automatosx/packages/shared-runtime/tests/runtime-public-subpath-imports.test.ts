import { describe, expect, it } from 'vitest';
import {
  BridgeSpecSchema,
  createRuntimeBridgeService,
} from '@defai.digital/shared-runtime/bridge';
import {
  RuntimeGovernanceAggregateSchema,
  buildRuntimeGovernanceAggregate,
} from '@defai.digital/shared-runtime/governance';
import {
  formatWorkflowInputSummary,
  listWorkflowCatalog,
} from '@defai.digital/shared-runtime/catalog';

describe('shared-runtime public subpath imports', () => {
  it('exposes the bridge subpath entrypoint', () => {
    expect(createRuntimeBridgeService).toBeTypeOf('function');
    expect(BridgeSpecSchema).toBeDefined();
  });

  it('exposes the governance subpath entrypoint', () => {
    expect(buildRuntimeGovernanceAggregate).toBeTypeOf('function');
    expect(RuntimeGovernanceAggregateSchema).toBeDefined();
  });

  it('exposes the catalog subpath entrypoint', () => {
    expect(formatWorkflowInputSummary).toBeTypeOf('function');
    expect(listWorkflowCatalog).toBeTypeOf('function');
  });
});
