import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORT_DIR = dirname(fileURLToPath(import.meta.url));

export const CLI_PACKAGE_ROOT = resolve(SUPPORT_DIR, '..', '..');
export const WORKSPACE_ROOT = resolve(CLI_PACKAGE_ROOT, '..', '..');
export const CLI_ENTRY_PATH = join(CLI_PACKAGE_ROOT, 'dist', 'main.js');
export const CLI_WORKFLOW_DIR = join(CLI_PACKAGE_ROOT, 'workflows');
export const SHARED_RUNTIME_MOCK_PROVIDER = join(
  WORKSPACE_ROOT,
  'packages',
  'shared-runtime',
  'tests',
  'mock-provider.mjs',
);

export function createCliTestTempDir(prefix: string): string {
  const dir = join(
    CLI_PACKAGE_ROOT,
    '.tmp',
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}
