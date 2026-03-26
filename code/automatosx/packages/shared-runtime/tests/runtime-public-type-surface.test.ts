import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKED_BRIDGE_CONTRACT_TYPES,
  BLOCKED_REVIEW_PUBLIC_TYPES,
  BLOCKED_WORKFLOW_CATALOG_PUBLIC_TYPES,
  EXPECTED_AGENT_CATALOG_PUBLIC_TYPES,
  EXPECTED_BRIDGE_CONTRACT_PUBLIC_TYPES,
  EXPECTED_BRIDGE_RUNTIME_PUBLIC_TYPES,
  EXPECTED_GOVERNANCE_SUMMARY_PUBLIC_TYPES,
  EXPECTED_REVIEW_PUBLIC_TYPES,
  EXPECTED_WORKFLOW_CATALOG_PUBLIC_TYPES,
} from './support/runtime-public-api-manifest.js';

const SHARED_RUNTIME_SRC = join(import.meta.dirname, '..', 'src');
const BRIDGE_EXPORTS_PATH = join(SHARED_RUNTIME_SRC, 'runtime-public-bridge-exports.ts');
const CATALOG_EXPORTS_PATH = join(SHARED_RUNTIME_SRC, 'runtime-public-catalog-exports.ts');

function parseTypeExportBlocks(source: string): Map<string, string[]> {
  const blocks = new Map<string, string[]>();

  for (const match of source.matchAll(/export\s+type\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];/g)) {
    const [, rawBlock, modulePath] = match;
    if (rawBlock === undefined || modulePath === undefined) {
      continue;
    }

    blocks.set(
      modulePath,
      rawBlock
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }

  return blocks;
}

function extractTypeExportBlock(source: string, relativeModulePath: string): string[] {
  return parseTypeExportBlocks(source).get(relativeModulePath) ?? [];
}

describe('shared-runtime public type surface', () => {
  it('keeps contracted bridge/governance types out of the public bridge barrel', () => {
    const source = readFileSync(BRIDGE_EXPORTS_PATH, 'utf8');
    const bridgeContractsTypeBlock = extractTypeExportBlock(source, './bridge-contracts.js');
    const bridgeRuntimeTypeBlock = extractTypeExportBlock(source, './bridge-runtime-service.js');
    const bridgeGovernanceTypeBlock = extractTypeExportBlock(source, './bridge-governance.js');
    const governanceSummaryTypeBlock = extractTypeExportBlock(source, './runtime-governance-summary.js');

    expect(bridgeContractsTypeBlock).toEqual([...EXPECTED_BRIDGE_CONTRACT_PUBLIC_TYPES]);
    expect(bridgeRuntimeTypeBlock).toEqual([...EXPECTED_BRIDGE_RUNTIME_PUBLIC_TYPES]);
    expect(governanceSummaryTypeBlock).toEqual([...EXPECTED_GOVERNANCE_SUMMARY_PUBLIC_TYPES]);
    expect(bridgeGovernanceTypeBlock).toEqual([]);

    for (const symbol of BLOCKED_BRIDGE_CONTRACT_TYPES) {
      expect(bridgeContractsTypeBlock).not.toContain(symbol);
    }
  });

  it('keeps contracted catalog types out of the public catalog barrel', () => {
    const source = readFileSync(CATALOG_EXPORTS_PATH, 'utf8');
    const reviewTypeBlock = extractTypeExportBlock(source, './review.js');
    const agentCatalogTypeBlock = extractTypeExportBlock(source, './stable-agent-catalog.js');
    const workflowCatalogTypeBlock = extractTypeExportBlock(source, './stable-workflow-catalog.js');

    expect(reviewTypeBlock).toEqual([...EXPECTED_REVIEW_PUBLIC_TYPES]);
    expect(agentCatalogTypeBlock).toEqual([...EXPECTED_AGENT_CATALOG_PUBLIC_TYPES]);
    expect(workflowCatalogTypeBlock).toEqual([...EXPECTED_WORKFLOW_CATALOG_PUBLIC_TYPES]);

    for (const symbol of BLOCKED_REVIEW_PUBLIC_TYPES) {
      expect(reviewTypeBlock).not.toContain(symbol);
    }
    for (const symbol of BLOCKED_WORKFLOW_CATALOG_PUBLIC_TYPES) {
      expect(workflowCatalogTypeBlock).not.toContain(symbol);
    }
  });
});
