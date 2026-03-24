#!/usr/bin/env node
/**
 * Sync all package versions from root package.json.
 * Run automatically after changelog generation (see .versionrc.json).
 * Usage: node tools/sync-versions.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = rootPkg.version;

if (!version) {
  console.error('No version found in root package.json');
  process.exit(1);
}

const packages = [
  'contracts',
  'workflow-engine',
  'shared-runtime',
  'state-store',
  'trace-store',
  'cli',
  'mcp-server',
  'monitoring',
];

let updated = 0;
for (const pkg of packages) {
  const pkgPath = resolve(root, 'packages', pkg, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkgJson.version !== version) {
      pkgJson.version = version;
      writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
      console.log(`Updated packages/${pkg}/package.json to ${version}`);
      updated++;
    }
  } catch {
    console.warn(`Skipping packages/${pkg}: package.json not found`);
  }
}

console.log(`Version sync complete: ${version} (${updated} package(s) updated)`);
