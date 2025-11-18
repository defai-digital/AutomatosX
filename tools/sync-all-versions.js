#!/usr/bin/env node
/**
 * Version Sync Script (Simplified)
 *
 * Syncs version-related information across project files:
 * - README.md (status line and version badges)
 * - CLAUDE.md (version header and notes)
 *
 * Note: package.json is now the single source of truth for version.
 * version.json has been removed to simplify version management.
 *
 * Usage:
 *   npm run sync:all-versions              # Use package.json version
 *   node tools/sync-all-versions.js        # Same as above
 *
 * Run this before:
 *   - Creating GitHub releases
 *   - Publishing to npm
 *   - Major version bumps
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Get month name from date
 */
function getMonthYear(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Note: version.json and manual package.json updates are removed.
 * package.json is now the single source of truth, managed by npm version commands.
 */

/**
 * Update README.md status line
 */
function updateReadme(version, monthYear) {
  const readmePath = join(rootDir, 'README.md');
  let content = readFileSync(readmePath, 'utf8');

  // Update status line (matches current format with pipe separators)
  // Example: **Status**: ✅ **Production Ready** | v8.3.0 | 20 Specialized Agents...
  const statusPattern = /\*\*Status\*\*: ✅ \*\*Production Ready\*\* \| v[\d.]+(?:-[a-z]+\.\d+)?\b/;
  const newStatus = `**Status**: ✅ **Production Ready** | v${version}`;

  if (statusPattern.test(content)) {
    content = content.replace(statusPattern, newStatus);
    writeFileSync(readmePath, content);
    console.log(`${colors.green}✓${colors.reset} Updated README.md status line`);
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} Could not find status line pattern in README.md`);
  }
}

/**
 * Update CLAUDE.md version references
 */
function updateClaudeMd(version, monthYear) {
  const claudePath = join(rootDir, 'CLAUDE.md');
  let content = readFileSync(claudePath, 'utf8');
  let updated = false;

  // Update "AutomatosX (v8.2.0) is an AI Agent..."
  const overviewPattern = /AutomatosX \(v\d+\.\d+\.\d+\) is an AI Agent/;
  if (overviewPattern.test(content)) {
    content = content.replace(
      overviewPattern,
      `AutomatosX (v${version}) is an AI Agent`
    );
    updated = true;
  }

  // Update "### Current State (v8.2.0)"
  const currentStatePattern = /### Current State \(v\d+\.\d+\.\d+\)/;
  if (currentStatePattern.test(content)) {
    content = content.replace(
      currentStatePattern,
      `### Current State (v${version})`
    );
    updated = true;
  }

  // Update "**Recent Changes (v8.2.0 - ...)"
  const recentChangesPattern = /\*\*Recent Changes \(v\d+\.\d+\.\d+ - /;
  if (recentChangesPattern.test(content)) {
    content = content.replace(
      recentChangesPattern,
      `**Recent Changes (v${version} - `
    );
    updated = true;
  }

  if (updated) {
    writeFileSync(claudePath, content);
    console.log(`${colors.green}✓${colors.reset} Updated CLAUDE.md version references`);
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} Could not find version patterns in CLAUDE.md`);
  }
}

/**
 * Check if CHANGELOG.md needs update
 */
function checkChangelog(version) {
  const changelogPath = join(rootDir, 'CHANGELOG.md');
  const content = readFileSync(changelogPath, 'utf8');

  // Check if this version exists in CHANGELOG
  const versionHeader = `## [${version}]`;
  if (!content.includes(versionHeader)) {
    console.log(`${colors.yellow}⚠${colors.reset} CHANGELOG.md does not have entry for v${version}`);
    console.log(`  ${colors.cyan}→${colors.reset} Please add release notes to CHANGELOG.md`);
  } else {
    console.log(`${colors.green}✓${colors.reset} CHANGELOG.md has entry for v${version}`);
  }
}

/**
 * Get test count from npm test output
 */
function getTestCount() {
  try {
    console.log(`${colors.cyan}Running tests to get count...${colors.reset}`);
    const output = execSync('npm run test:all 2>&1', {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 300000 // 5 minutes timeout
    });

    // Parse output for test count: "Tests  1845 passed | 7 skipped (1852)"
    const testMatch = output.match(/Tests\s+(\d+)\s+passed/);
    if (testMatch) {
      const testCount = parseInt(testMatch[1], 10);
      console.log(`${colors.green}✓${colors.reset} Found ${testCount} passing tests`);
      return testCount;
    }

    console.log(`${colors.yellow}⚠${colors.reset} Could not parse test count from output`);
    return null;
  } catch (error) {
    console.log(`${colors.yellow}⚠${colors.reset} Could not run tests: ${error.message}`);
    return null;
  }
}

/**
 * Update test counts in README.md
 */
function updateTestCounts(testCount) {
  if (!testCount) {
    console.log(`${colors.yellow}⚠${colors.reset} Skipping test count update (no count available)`);
    return;
  }

  const readmePath = join(rootDir, 'README.md');
  let content = readFileSync(readmePath, 'utf8');
  let updated = false;

  // Format test count with comma (e.g., 1845 -> 1,845)
  const formattedCount = testCount.toLocaleString('en-US');

  // Update badge: [![Tests](https://img.shields.io/badge/tests-1,845%20passing-brightgreen.svg)](#)
  const badgePattern = /\[!\[Tests\]\(https:\/\/img\.shields\.io\/badge\/tests-[\d,]+%20passing-brightgreen\.svg\)\]/;
  if (badgePattern.test(content)) {
    content = content.replace(
      badgePattern,
      `[![Tests](https://img.shields.io/badge/tests-${formattedCount}%20passing-brightgreen.svg)]`
    );
    updated = true;
  }

  // Update "X tests passing" references
  const testPassingPattern = /✅ \*\*[\d,]+ tests passing\*\*/g;
  if (testPassingPattern.test(content)) {
    content = content.replace(
      testPassingPattern,
      `✅ **${formattedCount} tests passing**`
    );
    updated = true;
  }

  // Update "Test Coverage: ~56% (X tests passing, 100% pass rate)"
  const coveragePattern = /Test Coverage: ~\d+% \([\d,]+ tests passing, 100% pass rate\)/g;
  if (coveragePattern.test(content)) {
    content = content.replace(
      coveragePattern,
      `Test Coverage: ~56% (${formattedCount} tests passing, 100% pass rate)`
    );
    updated = true;
  }

  if (updated) {
    writeFileSync(readmePath, content);
    console.log(`${colors.green}✓${colors.reset} Updated test counts in README.md (${formattedCount} tests)`);
  } else {
    console.log(`${colors.yellow}⚠${colors.reset} Could not find test count patterns in README.md`);
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`\n${colors.blue}📦 AutomatosX Version Sync Tool (Simplified)${colors.reset}\n`);

  // Read current package.json (single source of truth)
  const packagePath = join(rootDir, 'package.json');
  const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));

  const currentVersion = packageData.version;
  const releaseDate = new Date().toISOString().split('T')[0];
  const monthYear = getMonthYear(new Date());

  console.log(`${colors.cyan}Current Version:${colors.reset} v${currentVersion} (from package.json)`);
  console.log(`${colors.cyan}Release Date:${colors.reset} ${releaseDate} (${monthYear})`);
  console.log();

  try {
    // Update documentation files only (package.json managed by npm version)
    updateReadme(currentVersion, monthYear);
    updateClaudeMd(currentVersion, monthYear);

    console.log();

    // Update test counts (optional - skip if tests fail)
    const testCount = getTestCount();
    if (testCount) {
      updateTestCounts(testCount);
      console.log();
    }

    // Check CHANGELOG
    checkChangelog(currentVersion);

    console.log();
    console.log(`${colors.green}✨ Version sync completed successfully!${colors.reset}\n`);

    // Summary
    console.log(`${colors.cyan}Files updated:${colors.reset}`);
    console.log(`  • README.md → v${currentVersion} · ${monthYear}`);
    console.log(`  • CLAUDE.md → v${currentVersion} (${monthYear})`);
    if (testCount) {
      console.log(`  • README.md test counts → ${testCount.toLocaleString('en-US')} tests`);
    }
    console.log();

    // Next steps
    console.log(`${colors.cyan}Note:${colors.reset} package.json is the single source of truth`);
    console.log(`  Use ${colors.yellow}npm version [patch|minor|major]${colors.reset} to bump version`);
    console.log();

  } catch (error) {
    console.error(`${colors.yellow}✗${colors.reset} Error syncing versions:`, error.message);
    process.exit(1);
  }
}

main();
