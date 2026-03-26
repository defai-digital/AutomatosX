export interface WorkspaceBuildEntry {
  packageName: string;
  workspace: string;
  buildOutput: string;
  workspaceDependencies: string[];
}

export const workspaceManifest: WorkspaceBuildEntry[] = [
  {
    packageName: 'contracts',
    workspace: 'packages/contracts',
    buildOutput: 'packages/contracts/dist/index.js',
    workspaceDependencies: [],
  },
  {
    packageName: 'workflow-engine',
    workspace: 'packages/workflow-engine',
    buildOutput: 'packages/workflow-engine/dist/index.js',
    workspaceDependencies: ['contracts'],
  },
  {
    packageName: 'state-store',
    workspace: 'packages/state-store',
    buildOutput: 'packages/state-store/dist/index.js',
    workspaceDependencies: [],
  },
  {
    packageName: 'trace-store',
    workspace: 'packages/trace-store',
    buildOutput: 'packages/trace-store/dist/index.js',
    workspaceDependencies: [],
  },
  {
    packageName: 'shared-runtime',
    workspace: 'packages/shared-runtime',
    buildOutput: 'packages/shared-runtime/dist/index.js',
    workspaceDependencies: ['contracts', 'state-store', 'trace-store', 'workflow-engine'],
  },
  {
    packageName: 'monitoring',
    workspace: 'packages/monitoring',
    buildOutput: 'packages/monitoring/dist/index.js',
    workspaceDependencies: ['trace-store'],
  },
  {
    packageName: 'mcp-server',
    workspace: 'packages/mcp-server',
    buildOutput: 'packages/mcp-server/dist/index.js',
    workspaceDependencies: ['contracts', 'monitoring', 'shared-runtime'],
  },
  {
    packageName: 'cli',
    workspace: 'packages/cli',
    buildOutput: 'packages/cli/dist/main.js',
    workspaceDependencies: ['contracts', 'mcp-server', 'shared-runtime', 'state-store', 'trace-store'],
  },
];

const workspaceByPackageName = new Map(
  workspaceManifest.map((entry) => [entry.packageName, entry]),
);

export const workspaceBuildOutputs = workspaceManifest.map((entry) => entry.buildOutput);

export function getWorkspaceBuildEntry(packageName: string): WorkspaceBuildEntry | undefined {
  return workspaceByPackageName.get(packageName);
}

export function getWorkspaceBuildChain(packageName: string): WorkspaceBuildEntry[] {
  const ordered: WorkspaceBuildEntry[] = [];
  const seen = new Set<string>();

  function visit(currentPackageName: string): void {
    if (seen.has(currentPackageName)) {
      return;
    }

    const entry = getWorkspaceBuildEntry(currentPackageName);
    if (entry === undefined) {
      throw new Error(`Unknown workspace package: ${currentPackageName}`);
    }

    seen.add(currentPackageName);
    for (const dependency of entry.workspaceDependencies) {
      visit(dependency);
    }
    ordered.push(entry);
  }

  visit(packageName);
  return ordered;
}
