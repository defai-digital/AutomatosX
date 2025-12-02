#!/usr/bin/env node

/**
 * Pre-release validation script
 * Checks if the project is ready for release
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let hasErrors = false;

function check(name, fn) {
  process.stdout.write(`Checking ${name}... `);
  try {
    fn();
    console.log('✅');
    return true;
  } catch (error) {
    console.log('❌');
    console.error(`  ${error.message}`);
    hasErrors = true;
    return false;
  }
}

function exec(command) {
  return execSync(command, { cwd: rootDir, encoding: 'utf8' });
}

// Check 1: Git status is clean
check('git status', () => {
  const status = exec('git status --porcelain');
  if (status.trim()) {
    throw new Error('Git working directory is not clean. Commit or stash changes.');
  }
});

// Check 2: On main branch
check('git branch', () => {
  const branch = exec('git branch --show-current').trim();
  if (branch !== 'main' && branch !== 'master') {
    throw new Error(`Not on main branch (current: ${branch})`);
  }
});

// Check 3: All tests pass
check('tests', () => {
  try {
    exec('npm run test:all 2>&1');
  } catch (error) {
    throw new Error('Tests are failing. Fix before releasing.');
  }
});

// Check 4: TypeScript compiles
check('typecheck', () => {
  try {
    exec('npm run typecheck 2>&1');
  } catch (error) {
    throw new Error('TypeScript errors detected. Fix before releasing.');
  }
});

// Check 5: Build succeeds
check('build', () => {
  try {
    exec('npm run build 2>&1');
  } catch (error) {
    throw new Error('Build failed. Fix before releasing.');
  }
});

// Check 6: CHANGELOG.md updated
check('CHANGELOG.md', () => {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  const changelog = readFileSync(join(rootDir, 'CHANGELOG.md'), 'utf8');

  if (!changelog.includes(`## [${pkg.version}]`)) {
    throw new Error(`CHANGELOG.md missing entry for version ${pkg.version}`);
  }
});

// Check 7: No npm audit issues
check('npm audit', () => {
  try {
    exec('npm audit --audit-level=moderate 2>&1');
  } catch (error) {
    throw new Error('npm audit found vulnerabilities. Fix before releasing.');
  }
});

// Check 8: Package.json fields
check('package.json fields', () => {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

  const required = ['name', 'version', 'description', 'author', 'license', 'repository'];
  const missing = required.filter(field => !pkg[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (!pkg.keywords || pkg.keywords.length === 0) {
    throw new Error('No keywords defined in package.json');
  }
});

console.log('');

if (hasErrors) {
  console.error('❌ Release check failed. Fix the issues above before releasing.');
  process.exit(1);
} else {
  console.log('✅ All release checks passed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. npm run version:patch (or version:minor/version:major)');
  console.log('2. git push origin main --tags');
  console.log('3. GitHub Actions will automatically publish to npm');
  process.exit(0);
}
