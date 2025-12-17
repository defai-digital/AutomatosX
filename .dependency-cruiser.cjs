/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Rule 1: contracts must have ZERO dependencies on other packages
    {
      name: 'contracts-no-internal-deps',
      severity: 'error',
      comment: 'Contracts package must not depend on any other internal packages',
      from: {
        path: '^packages/contracts',
      },
      to: {
        path: '^packages/(?!contracts)',
      },
    },
    // Rule 2: core can only depend on contracts
    {
      name: 'core-only-contracts',
      severity: 'error',
      comment: 'Core packages can only depend on contracts',
      from: {
        path: '^packages/core',
      },
      to: {
        path: '^packages/(?!contracts)',
        pathNot: '^packages/core', // Allow internal core dependencies
      },
    },
    // Rule 3: adapters can depend on contracts and core only
    {
      name: 'adapters-contracts-core-only',
      severity: 'error',
      comment: 'Adapters can only depend on contracts and core',
      from: {
        path: '^packages/adapters',
      },
      to: {
        path: '^packages/(cli|mcp-server)',
      },
    },
    // Rule 4: cli can depend on contracts and core only (NOT adapters)
    // Exception: bootstrap.ts/bootstrap.js is the composition root - allowed to import adapters
    {
      name: 'cli-no-adapters',
      severity: 'error',
      comment: 'CLI must not depend on adapters directly (except bootstrap)',
      from: {
        path: '^packages/cli',
        pathNot: '^packages/cli/(src|dist)/bootstrap\\.(ts|js|d\\.ts)$',
      },
      to: {
        path: '^packages/adapters',
      },
    },
    // Rule 5: mcp-server can depend on contracts and core only (NOT adapters)
    // Exception: bootstrap.ts/bootstrap.js is the composition root - allowed to import adapters
    {
      name: 'mcp-server-no-adapters',
      severity: 'error',
      comment: 'MCP Server must not depend on adapters directly (except bootstrap)',
      from: {
        path: '^packages/mcp-server',
        pathNot: '^packages/mcp-server/(src|dist)/bootstrap\\.(ts|js|d\\.ts)$',
      },
      to: {
        path: '^packages/adapters',
      },
    },
    // Rule 6: No circular dependencies
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies allowed',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)',
      },
    },
  },
};
