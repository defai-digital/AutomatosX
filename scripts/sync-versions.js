#!/usr/bin/env node

/**
 * Sync versions across all packages
 *
 * Usage:
 *   node scripts/sync-versions.js 13.0.0
 *
 * This script updates the version field in all package.json files
 * without using npm commands (avoids npm warnings in pnpm workspaces).
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

/**
 * Find all package.json files
 */
function findAllPackageJsons(dir) {
  const packages = [];

  // Add root package.json
  packages.push(join(rootDir, 'package.json'));

  function scan(currentDir) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
        const pkgPath = join(fullPath, 'package.json');
        try {
          statSync(pkgPath);
          packages.push(pkgPath);
        } catch {
          scan(fullPath);
        }
      }
    }
  }

  scan(join(rootDir, 'packages'));
  return packages;
}

/**
 * Update version in a package.json file
 */
function updateVersion(pkgPath, version) {
  const content = readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;

  pkg.version = version;

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return { name: pkg.name, oldVersion, newVersion: version };
}

// Main
const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/sync-versions.js <version>');
  console.error('Example: node scripts/sync-versions.js 13.0.0');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-prerelease');
  process.exit(1);
}

console.log(`Syncing all packages to version ${version}...\n`);

const packages = findAllPackageJsons(rootDir);
let updated = 0;

for (const pkgPath of packages) {
  const result = updateVersion(pkgPath, version);
  if (result.oldVersion !== result.newVersion) {
    console.log(`  ${result.name}: ${result.oldVersion} → ${result.newVersion}`);
    updated++;
  } else {
    console.log(`  ${result.name}: already at ${result.newVersion}`);
  }
}

console.log(`\nDone! Updated ${updated} packages to version ${version}.`);
