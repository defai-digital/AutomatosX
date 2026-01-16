#!/usr/bin/env node

/**
 * Prepare all packages for npm publishing
 *
 * This script adds required metadata to all package.json files:
 * - license
 * - author
 * - repository
 * - publishConfig
 * - files
 * - engines
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const METADATA = {
  license: 'BUSL-1.1',
  author: 'DEFAI Private Limited',
  homepage: 'https://github.com/defai-digital/automatosx#readme',
  bugs: {
    url: 'https://github.com/defai-digital/automatosx/issues'
  },
  engines: {
    node: '>=20.0.0'
  },
  publishConfig: {
    access: 'public'
  }
};

/**
 * Find all package.json files in packages directory
 */
function findPackages(dir) {
  const packages = [];

  function scan(currentDir) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
        // Check if this directory has a package.json
        const pkgPath = join(fullPath, 'package.json');
        try {
          statSync(pkgPath);
          packages.push(pkgPath);
        } catch {
          // No package.json, scan subdirectories
          scan(fullPath);
        }
      }
    }
  }

  scan(dir);
  return packages;
}

/**
 * Update a single package.json
 */
function updatePackage(pkgPath) {
  const content = readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);

  // Skip root package (it's private)
  if (pkg.private) {
    console.log(`  Skipping ${pkg.name} (private)`);
    return false;
  }

  // Get relative directory for repository
  const relDir = pkgPath.replace(rootDir + '/', '').replace('/package.json', '');

  // Add/update metadata
  const updated = {
    ...pkg,
    license: METADATA.license,
    author: METADATA.author,
    repository: {
      type: 'git',
      url: 'https://github.com/defai-digital/automatosx.git',
      directory: relDir
    },
    homepage: METADATA.homepage,
    bugs: METADATA.bugs,
    engines: METADATA.engines,
    publishConfig: METADATA.publishConfig,
  };

  // Add files field if not present
  if (!updated.files) {
    updated.files = ['dist'];
  }

  // Reorder keys for consistency
  const ordered = {};
  const keyOrder = [
    'name', 'version', 'type', 'description', 'license', 'author',
    'repository', 'homepage', 'bugs', 'keywords', 'main', 'types',
    'bin', 'exports', 'files', 'engines', 'publishConfig', 'scripts',
    'dependencies', 'devDependencies', 'peerDependencies'
  ];

  for (const key of keyOrder) {
    if (updated[key] !== undefined) {
      ordered[key] = updated[key];
    }
  }

  // Add any remaining keys
  for (const key of Object.keys(updated)) {
    if (ordered[key] === undefined) {
      ordered[key] = updated[key];
    }
  }

  writeFileSync(pkgPath, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`  Updated ${pkg.name}`);
  return true;
}

// Main
console.log('Preparing packages for npm publishing...\n');

const packagesDir = join(rootDir, 'packages');
const packages = findPackages(packagesDir);

console.log(`Found ${packages.length} packages:\n`);

let updated = 0;
for (const pkgPath of packages) {
  if (updatePackage(pkgPath)) {
    updated++;
  }
}

console.log(`\nDone! Updated ${updated} packages.`);
console.log('\nNext steps:');
console.log('  1. Review changes: git diff packages/*/package.json');
console.log('  2. Commit: git add -A && git commit -m "chore: prepare packages for npm publishing"');
console.log('  3. Tag release: git tag v<version>');
console.log('  4. Push: git push && git push --tags');
