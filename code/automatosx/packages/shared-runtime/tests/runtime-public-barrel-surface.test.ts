import { describe, expect, it } from 'vitest';
import * as bridgePublic from '../src/runtime-public-bridge-exports.js';
import * as catalogPublic from '../src/runtime-public-catalog-exports.js';
import * as governancePublic from '../src/runtime-public-governance-exports.js';
import {
  EXPECTED_BRIDGE_PUBLIC_VALUE_EXPORTS,
  EXPECTED_CATALOG_PUBLIC_VALUE_EXPORTS,
  EXPECTED_GOVERNANCE_PUBLIC_VALUE_EXPORTS,
} from './support/runtime-public-api-manifest.js';

describe('shared-runtime public barrel surfaces', () => {
  it('keeps the bridge barrel value surface explicit', () => {
    expect(Object.keys(bridgePublic).sort()).toEqual([...EXPECTED_BRIDGE_PUBLIC_VALUE_EXPORTS].sort());
  });

  it('keeps the governance barrel value surface explicit', () => {
    expect(Object.keys(governancePublic).sort()).toEqual([...EXPECTED_GOVERNANCE_PUBLIC_VALUE_EXPORTS].sort());
  });

  it('keeps the catalog barrel value surface explicit', () => {
    expect(Object.keys(catalogPublic).sort()).toEqual([...EXPECTED_CATALOG_PUBLIC_VALUE_EXPORTS].sort());
  });
});
