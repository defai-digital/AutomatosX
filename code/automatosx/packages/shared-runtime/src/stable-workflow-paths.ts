import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLED_WORKFLOW_DIR = resolve(fileURLToPath(new URL('../workflows', import.meta.url)));

export function resolveBundledWorkflowDir(): string | undefined {
  return existsSync(BUNDLED_WORKFLOW_DIR) ? BUNDLED_WORKFLOW_DIR : undefined;
}

export function isBundledWorkflowDir(workflowDir: string | undefined): boolean {
  return workflowDir !== undefined && resolve(workflowDir) === BUNDLED_WORKFLOW_DIR;
}

export function resolveWorkspaceWorkflowDir(basePath: string): string | undefined {
  const candidates = [
    join(basePath, 'workflows'),
    join(basePath, '.automatosx', 'workflows'),
    join(basePath, 'examples', 'workflows'),
  ];

  return candidates.find((candidate) => hasWorkflowDefinitionFiles(candidate));
}

export function resolveEffectiveWorkflowDir(options: {
  workflowDir?: string;
  basePath?: string;
}): string | undefined {
  if (options.workflowDir !== undefined && options.workflowDir.length > 0) {
    return options.workflowDir;
  }

  const workspaceWorkflowDir = resolveWorkspaceWorkflowDir(options.basePath ?? process.cwd());
  if (workspaceWorkflowDir !== undefined) {
    return workspaceWorkflowDir;
  }

  return resolveBundledWorkflowDir();
}

function hasWorkflowDefinitionFiles(candidate: string): boolean {
  if (!existsSync(candidate)) {
    return false;
  }

  try {
    return readdirSync(candidate, { withFileTypes: true })
      .some((entry) => entry.isFile() && /\.(json|ya?ml)$/i.test(entry.name));
  } catch {
    return false;
  }
}
