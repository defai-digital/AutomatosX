/**
 * @automatosx/contracts
 *
 * Contract schemas and behavioral invariants - Single Source of Truth
 * All external behavior must be defined by these explicit contracts.
 */

// Workflow Contract V1
export * from './workflow/v1/index.js';

// MCP Tool Contract V1
export * from './mcp/v1/index.js';

// Routing Decision Contract V1
export * from './routing/v1/index.js';

// Memory Event Contract V1
export * from './memory/v1/index.js';

// Trace Event Contract V1
export * from './trace/v1/index.js';

// Version exports for contract versioning
export const CONTRACT_VERSIONS = {
  workflow: 'v1',
  mcp: 'v1',
  routing: 'v1',
  memory: 'v1',
  trace: 'v1',
} as const;
