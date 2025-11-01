#!/usr/bin/env node

/**
 * AutomatosX Release Automation Tool
 *
 * Comprehensive release orchestration that ensures all steps are completed:
 * 1. Pre-flight validation checks
 * 2. Version bumping and synchronization
 * 3. CHANGELOG validation/generation
 * 4. Build and test
 * 5. Git commit and tagging
 * 6. GitHub release creation
 * 7. CI/CD monitoring
 *
 * Usage:
 *   npm run release        # Interactive guided release
 *   npm run release patch  # Automated patch release
 *   npm run release minor  # Automated minor release
 *   npm run release major  # Automated major release
 *
 * Or directly:
 *   node tools/release.js [patch|minor|major]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Release state
const state = {
  bumpType: null,
  currentVersion: null,
  newVersion: null,
  changelogUpdated: false,
  testsPass: false,
  buildSuccess: false,
  committed: false,
  tagged: false,
  pushed: false,
  releaseCreated: false,
};

/**
 * Execute command and return output
 */
function exec(command, options = {}) {
  return execSync(command, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.silent ? 'pipe' : 'inherit',
    ...options,
  });
}

/**
 * Print section header
 */
function section(title) {
  console.log('');
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log('');
}

/**
 * Print step
 */
function step(message) {
  console.log(`${colors.blue}▶${colors.reset} ${message}`);
}

/**
 * Print success
 */
function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

/**
 * Print error
 */
function error(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

/**
 * Print warning
 */
function warn(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

/**
 * Ask user a question
 */
async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}?${colors.reset} ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Confirm action
 */
async function confirm(question, defaultYes = true) {
  const suffix = defaultYes ? ' (Y/n)' : ' (y/N)';
  const answer = await ask(question + suffix);

  if (!answer) return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Step 1: Pre-flight checks
 */
async function preflightChecks() {
  section('Step 1: Pre-flight Validation');

  step('Running release validation checks...');
  try {
    exec('node tools/check-release.js', { silent: false });
    success('All pre-flight checks passed');
    return true;
  } catch (err) {
    error('Pre-flight checks failed');
    console.log('');
    error('Please fix the issues above before continuing');
    return false;
  }
}

/**
 * Step 2: Determine version bump
 */
async function determineVersionBump() {
  section('Step 2: Version Bump');

  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  state.currentVersion = pkg.version;

  console.log(`${colors.dim}Current version: ${state.currentVersion}${colors.reset}`);
  console.log('');

  // If version provided as argument, use it
  if (process.argv[2]) {
    const arg = process.argv[2].toLowerCase();
    if (['patch', 'minor', 'major'].includes(arg)) {
      state.bumpType = arg;
      step(`Using bump type from argument: ${state.bumpType}`);
    } else {
      error(`Invalid bump type: ${arg}. Must be patch, minor, or major`);
      return false;
    }
  } else {
    // Interactive selection
    console.log('Select version bump type:');
    console.log('  1) patch  - Bug fixes (6.5.6 → 6.5.7)');
    console.log('  2) minor  - New features (6.5.6 → 6.6.0)');
    console.log('  3) major  - Breaking changes (6.5.6 → 7.0.0)');
    console.log('');

    const choice = await ask('Enter choice (1-3):');
    const bumpTypes = { '1': 'patch', '2': 'minor', '3': 'major' };
    state.bumpType = bumpTypes[choice];

    if (!state.bumpType) {
      error('Invalid choice');
      return false;
    }
  }

  // Calculate new version
  const [major, minor, patch] = state.currentVersion.split('.').map(Number);
  if (state.bumpType === 'patch') {
    state.newVersion = `${major}.${minor}.${patch + 1}`;
  } else if (state.bumpType === 'minor') {
    state.newVersion = `${major}.${minor + 1}.0`;
  } else {
    state.newVersion = `${major + 1}.0.0`;
  }

  console.log('');
  success(`Version will be bumped: ${state.currentVersion} → ${state.newVersion}`);

  return await confirm(`Proceed with ${state.bumpType} release (${state.newVersion})?`);
}

/**
 * Step 3: Update CHANGELOG
 */
async function updateChangelog() {
  section('Step 3: CHANGELOG Update');

  const changelogPath = join(rootDir, 'CHANGELOG.md');
  const changelog = readFileSync(changelogPath, 'utf8');

  // Check if version already exists in CHANGELOG
  if (changelog.includes(`## [${state.newVersion}]`)) {
    success(`CHANGELOG already contains entry for v${state.newVersion}`);
    state.changelogUpdated = true;
    return true;
  }

  warn(`CHANGELOG missing entry for v${state.newVersion}`);
  console.log('');
  console.log('You need to add a CHANGELOG entry for this release.');
  console.log('');
  console.log('Options:');
  console.log('  1) Open CHANGELOG.md in editor now');
  console.log('  2) I have already updated it (manual)');
  console.log('  3) Skip CHANGELOG update (not recommended)');
  console.log('');

  const choice = await ask('Enter choice (1-3):');

  if (choice === '1') {
    const editor = process.env.EDITOR || 'vi';
    console.log('');
    step(`Opening CHANGELOG.md in ${editor}...`);
    console.log(`${colors.dim}Add your release notes, save, and exit${colors.reset}`);
    console.log('');

    try {
      execSync(`${editor} CHANGELOG.md`, { stdio: 'inherit', cwd: rootDir });
      success('Editor closed');
    } catch (err) {
      error('Editor failed');
      return false;
    }

    // Re-read CHANGELOG to verify
    const updatedChangelog = readFileSync(changelogPath, 'utf8');
    if (updatedChangelog.includes(`## [${state.newVersion}]`)) {
      success('CHANGELOG entry verified');
      state.changelogUpdated = true;
      return true;
    } else {
      error(`CHANGELOG still missing entry for v${state.newVersion}`);
      return false;
    }
  } else if (choice === '2') {
    // Re-read CHANGELOG to verify
    const updatedChangelog = readFileSync(changelogPath, 'utf8');
    if (updatedChangelog.includes(`## [${state.newVersion}]`)) {
      success('CHANGELOG entry verified');
      state.changelogUpdated = true;
      return true;
    } else {
      error(`CHANGELOG does not contain entry for v${state.newVersion}`);
      error('Please update CHANGELOG.md and run the release script again');
      return false;
    }
  } else if (choice === '3') {
    warn('Skipping CHANGELOG update (not recommended for production releases)');
    return await confirm('Are you sure you want to continue without CHANGELOG?', false);
  } else {
    error('Invalid choice');
    return false;
  }
}

/**
 * Step 4: Bump version
 */
async function bumpVersion() {
  section('Step 4: Version Bump & Sync');

  step(`Running npm version ${state.bumpType}...`);
  try {
    // Use npm version to bump (this will run Husky hooks for version sync)
    exec(`npm version ${state.bumpType} --no-git-tag-version`, { silent: true });
    success(`package.json updated to v${state.newVersion}`);
  } catch (err) {
    error('npm version failed');
    console.error(err.message);
    return false;
  }

  step('Syncing version across all files...');
  try {
    exec('npm run sync:all-versions', { silent: false });
    success('All version references synced');
  } catch (err) {
    error('Version sync failed');
    console.error(err.message);
    return false;
  }

  return true;
}

/**
 * Step 5: Build and test
 */
async function buildAndTest() {
  section('Step 5: Build & Test');

  step('Building project...');
  try {
    exec('npm run build', { silent: false });
    success('Build successful');
    state.buildSuccess = true;
  } catch (err) {
    error('Build failed');
    return false;
  }

  step('Running tests...');
  try {
    exec('npm test', { silent: false });
    success('All tests passed');
    state.testsPass = true;
  } catch (err) {
    error('Tests failed');
    return false;
  }

  return true;
}

/**
 * Step 6: Commit changes
 */
async function commitChanges() {
  section('Step 6: Git Commit & Tag');

  // Check what files have changed
  step('Checking modified files...');
  const status = exec('git status --porcelain', { silent: true });

  if (!status.trim()) {
    warn('No changes to commit (this is unusual)');
    return true;
  }

  console.log('');
  console.log('Modified files:');
  console.log(status);

  const shouldCommit = await confirm('Commit these changes?');
  if (!shouldCommit) {
    error('Commit cancelled');
    return false;
  }

  step('Adding changes to git...');
  exec('git add package.json README.md CHANGELOG.md CLAUDE.md');
  success('Changes staged');

  step('Creating commit...');
  const commitMessage = `chore: Release v${state.newVersion}

Auto-generated release commit

- Updated package.json to v${state.newVersion}
- Updated CHANGELOG.md
- Synced version references in README.md and CLAUDE.md
- Verified build and tests passing`;

  try {
    exec(`git commit -m "${commitMessage}"`, { silent: true });
    success('Commit created');
    state.committed = true;
  } catch (err) {
    error('Commit failed');
    console.error(err.message);
    return false;
  }

  step('Creating git tag...');
  try {
    exec(`git tag v${state.newVersion}`, { silent: true });
    success(`Tag v${state.newVersion} created`);
    state.tagged = true;
  } catch (err) {
    error('Tag creation failed');
    console.error(err.message);
    return false;
  }

  return true;
}

/**
 * Step 7: Push to GitHub
 */
async function pushToGitHub() {
  section('Step 7: Push to GitHub');

  const shouldPush = await confirm('Push commit and tags to GitHub?');
  if (!shouldPush) {
    warn('Push skipped - remember to push manually later!');
    console.log('');
    console.log('To push manually:');
    console.log(`  git push origin main`);
    console.log(`  git push origin v${state.newVersion}`);
    return true;
  }

  step('Pushing to GitHub...');
  try {
    exec('git push origin main', { silent: false });
    exec(`git push origin v${state.newVersion}`, { silent: false });
    success('Pushed to GitHub');
    state.pushed = true;
  } catch (err) {
    error('Push failed');
    console.error(err.message);
    return false;
  }

  return true;
}

/**
 * Step 8: Create GitHub release
 */
async function createGitHubRelease() {
  section('Step 8: GitHub Release');

  if (!state.pushed) {
    warn('Skipping GitHub release creation (changes not pushed)');
    return true;
  }

  const shouldCreateRelease = await confirm('Create GitHub release?');
  if (!shouldCreateRelease) {
    warn('GitHub release skipped - you can create it manually later');
    console.log('');
    console.log(`Visit: https://github.com/defai-digital/automatosx/releases/new?tag=v${state.newVersion}`);
    return true;
  }

  step('Extracting release notes from CHANGELOG...');
  const changelog = readFileSync(join(rootDir, 'CHANGELOG.md'), 'utf8');
  const versionSection = changelog.match(new RegExp(`## \\[${state.newVersion}\\][\\s\\S]*?(?=## \\[|$)`, 'm'));

  let releaseNotes = '';
  if (versionSection) {
    releaseNotes = versionSection[0]
      .replace(`## [${state.newVersion}]`, '')
      .trim();
  } else {
    releaseNotes = `Release v${state.newVersion}`;
  }

  step('Creating GitHub release...');
  try {
    // Use gh CLI to create release
    const notesFile = join(rootDir, '.release-notes-tmp.md');
    writeFileSync(notesFile, releaseNotes);

    exec(`gh release create v${state.newVersion} --title "v${state.newVersion}" --notes-file "${notesFile}"`, { silent: false });

    // Clean up temp file
    execSync(`rm "${notesFile}"`, { cwd: rootDir });

    success('GitHub release created');
    state.releaseCreated = true;
  } catch (err) {
    error('GitHub release creation failed');
    console.error(err.message);
    console.log('');
    warn('You can create the release manually at:');
    console.log(`  https://github.com/defai-digital/automatosx/releases/new?tag=v${state.newVersion}`);
    return false;
  }

  return true;
}

/**
 * Step 9: Monitor CI/CD
 */
async function monitorCICD() {
  section('Step 9: CI/CD Monitoring');

  if (!state.pushed) {
    warn('Skipping CI/CD monitoring (changes not pushed)');
    return true;
  }

  const shouldMonitor = await confirm('Monitor GitHub Actions workflow?');
  if (!shouldMonitor) {
    warn('CI/CD monitoring skipped');
    console.log('');
    console.log('You can monitor manually at:');
    console.log('  https://github.com/defai-digital/automatosx/actions');
    return true;
  }

  step('Waiting for GitHub Actions to start...');
  console.log(`${colors.dim}(This may take a few seconds)${colors.reset}`);

  // Wait 10 seconds for workflow to start
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    exec('gh run list --limit 1', { silent: false });
    console.log('');
    step('To watch the workflow:');
    console.log('  gh run watch');
    console.log('');
  } catch (err) {
    warn('Could not fetch workflow status');
  }

  return true;
}

/**
 * Print release summary
 */
function printSummary() {
  section('Release Summary');

  console.log(`${colors.bright}Version:${colors.reset} ${state.currentVersion} → ${state.newVersion}`);
  console.log(`${colors.bright}Bump type:${colors.reset} ${state.bumpType}`);
  console.log('');
  console.log(`${colors.bright}Completed steps:${colors.reset}`);
  console.log(`  ${state.changelogUpdated ? '✓' : '✗'} CHANGELOG updated`);
  console.log(`  ${state.testsPass ? '✓' : '✗'} Tests passed`);
  console.log(`  ${state.buildSuccess ? '✓' : '✗'} Build successful`);
  console.log(`  ${state.committed ? '✓' : '✗'} Changes committed`);
  console.log(`  ${state.tagged ? '✓' : '✗'} Git tag created`);
  console.log(`  ${state.pushed ? '✓' : '✗'} Pushed to GitHub`);
  console.log(`  ${state.releaseCreated ? '✓' : '✗'} GitHub release created`);
  console.log('');

  if (state.pushed) {
    console.log(`${colors.bright}${colors.green}🎉 Release v${state.newVersion} completed successfully!${colors.reset}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Monitor GitHub Actions for npm publish');
    console.log('  2. Verify package on npm: https://www.npmjs.com/package/@defai.digital/automatosx');
    console.log('  3. Announce release in community channels');
  } else {
    console.log(`${colors.yellow}⚠️  Release partially completed${colors.reset}`);
    console.log('');
    console.log('Manual steps required:');
    if (!state.pushed) {
      console.log(`  git push origin main`);
      console.log(`  git push origin v${state.newVersion}`);
    }
    if (!state.releaseCreated) {
      console.log(`  Create GitHub release at: https://github.com/defai-digital/automatosx/releases/new?tag=v${state.newVersion}`);
    }
  }

  console.log('');
}

/**
 * Main release flow
 */
async function main() {
  console.log('');
  console.log(`${colors.bright}${colors.cyan}╔${'═'.repeat(58)}╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  AutomatosX Release Automation Tool                     ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚${'═'.repeat(58)}╝${colors.reset}`);
  console.log('');

  try {
    // Step 1: Pre-flight checks
    if (!await preflightChecks()) {
      process.exit(1);
    }

    // Step 2: Determine version bump
    if (!await determineVersionBump()) {
      process.exit(1);
    }

    // Step 3: Update CHANGELOG
    if (!await updateChangelog()) {
      process.exit(1);
    }

    // Step 4: Bump version
    if (!await bumpVersion()) {
      process.exit(1);
    }

    // Step 5: Build and test
    if (!await buildAndTest()) {
      process.exit(1);
    }

    // Step 6: Commit changes
    if (!await commitChanges()) {
      process.exit(1);
    }

    // Step 7: Push to GitHub
    if (!await pushToGitHub()) {
      // Continue even if push fails
    }

    // Step 8: Create GitHub release
    if (!await createGitHubRelease()) {
      // Continue even if release creation fails
    }

    // Step 9: Monitor CI/CD
    await monitorCICD();

    // Print summary
    printSummary();

    process.exit(0);
  } catch (err) {
    console.error('');
    error('Fatal error during release:');
    console.error(err);
    process.exit(1);
  }
}

// Run the release tool
main().catch(err => {
  console.error(err);
  process.exit(1);
});
