#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceManifest } from './workspace-manifest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version?: string;
};
const version = rootPkg.version;

if (!version) {
  process.stderr.write('No version found in root package.json\n');
  process.exit(1);
}

let updated = 0;
for (const entry of workspaceManifest) {
  const pkgPath = resolve(root, entry.workspace, 'package.json');
  try {
    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    if (pkgJson.version !== version) {
      pkgJson.version = version;
      writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
      process.stdout.write(`Updated ${entry.workspace}/package.json to ${version}\n`);
      updated += 1;
    }
  } catch {
    process.stderr.write(`Skipping ${entry.workspace}: package.json not found\n`);
  }
}

process.stdout.write(`Version sync complete: ${version} (${updated} package(s) updated)\n`);
