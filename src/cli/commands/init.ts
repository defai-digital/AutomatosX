/**
 * Init Command - ax-cli Style
 *
 * Generates project context files (ax-cli compatible):
 *
 * 1. ax.index.json (project root) - Shared project index used by all AI CLIs
 *    - Module map with directory purposes
 *    - Key abstractions and patterns
 *    - Import conventions
 *    - Configuration patterns
 *    - Auto-rebuilt if older than 24 hours
 *
 * 2. .automatosx/CUSTOM.md - Custom AI instructions
 *    - Protected from auto-rebuild (requires --force)
 *    - User-editable custom rules
 *
 * Also checks for AutomatosX updates (cached for 24 hours):
 * - If new version available, auto-updates and runs init --force
 * - Works for users using Claude Code, Gemini CLI, or Codex CLI
 *
 * @since v8.5.0
 * @updated v12.9.0 - Simplified to ax-cli style (ax.index.json at root)
 * @updated v12.10.0 - Added AutomatosX version check with 24h cache
 */

import type { CommandModule } from 'yargs';
import { writeFile, readFile, access, rename, mkdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import chalk from 'chalk';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import {
  detectProjectInfo,
  type ProjectInfo
} from './project-detector.js';

const execAsync = promisify(exec);

interface InitOptions {
  force?: boolean;
  skipUpdate?: boolean;
}

/**
 * Version check cache structure
 */
interface VersionCheckCache {
  lastCheck: string;           // ISO timestamp of last npm registry check
  currentVersion: string;      // Version at time of last check
  latestVersion: string;       // Latest version from npm at time of check
  updateAttempted?: boolean;   // Whether we already tried to update in this cache period
}

// 24 hours in milliseconds
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * ax.summary.json structure (ax-cli compatible)
 *
 * A compact summary (~500 tokens) designed for fast prompt injection.
 * Contains essential project metadata without the full analysis.
 *
 * @since v12.10.0
 */
interface AxSummary {
  // Schema version for future compatibility
  schemaVersion: string;

  // Generation timestamp
  generatedAt: string;

  // Core project info
  project: {
    name: string;
    type: string;
    language: string;
    version?: string;
  };

  // Key directories
  directories: Record<string, string>;

  // Essential commands
  commands: Record<string, string>;

  // Tech stack (compact list)
  techStack: string[];

  // Critical gotchas/rules (max 5)
  gotchas: string[];

  // Reference to full index
  indexFile: string;
}

/**
 * ax.index.json structure (ax-cli compatible)
 *
 * This is the shared project index used by all AI CLIs:
 * - ax-cli
 * - ax-glm
 * - ax-grok
 * - automatosx
 */
interface AxIndex {
  // Core metadata
  projectName: string;
  version: string;
  projectType: string;
  language: string;

  // Stack info
  framework?: string;
  buildTool?: string;
  testFramework?: string;
  packageManager: string;
  hasTypeScript: boolean;
  isMonorepo: boolean;

  // Structure
  entryPoint?: string;
  sourceDirectory?: string;
  testDirectory?: string;

  // Module map
  modules: Array<{
    path: string;
    purpose: string;
    patterns?: string[];
    exports?: string[];
  }>;

  // Key abstractions
  abstractions: Array<{
    name: string;
    type: 'interface' | 'class' | 'function' | 'type' | 'pattern';
    location: string;
    description?: string;
  }>;

  // Commands
  commands: Record<string, {
    script: string;
    description: string;
    category: 'development' | 'testing' | 'building' | 'quality' | 'deployment' | 'other';
  }>;

  // Dependencies summary
  dependencies: {
    production: string[];
    development: string[];
    total: number;
  };

  // Repository
  repository?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Analysis tier (ax-cli compatible)
  analysisTier: number;
}

/**
 * Detect architecture type from project info
 */
function detectArchitectureType(info: ProjectInfo): string {
  if (info.dependencies.includes('next') || info.dependencies.includes('nuxt')) {
    return 'Full-stack framework (SSR/SSG)';
  }
  if (info.dependencies.includes('express') || info.dependencies.includes('fastify')) {
    if (info.framework === 'React' || info.framework === 'Vue') {
      return 'Client-server architecture';
    }
    return 'REST API server';
  }
  if (info.dependencies.includes('apollo-server') || info.dependencies.includes('graphql')) {
    return 'GraphQL API server';
  }
  if (info.framework === 'React' || info.framework === 'Vue') {
    return 'Single Page Application (SPA)';
  }
  if (info.dependencies.some(d => d.includes('commander') || d.includes('yargs'))) {
    return 'Command-line interface (CLI)';
  }
  return 'Node.js application';
}

/**
 * Generate ax.index.json content (ax-cli compatible)
 */
function generateAxIndex(info: ProjectInfo): AxIndex {
  const now = new Date().toISOString();

  // Build module map from file structure
  const modules: AxIndex['modules'] = [];
  if (info.fileStructure?.directories) {
    for (const dir of info.fileStructure.directories) {
      modules.push({
        path: dir.path,
        purpose: dir.purpose || `Contains ${dir.fileCount} files`,
        patterns: [],
        exports: []
      });
    }
  }

  // Build abstractions from key components
  const abstractions: AxIndex['abstractions'] = [];
  if (info.keyComponents) {
    for (const comp of info.keyComponents) {
      abstractions.push({
        name: comp.path.split('/').pop() || comp.path,
        type: 'pattern',
        location: comp.path,
        description: comp.purpose
      });
    }
  }

  // Build commands from scripts
  const commands: AxIndex['commands'] = {};
  if (info.categorizedScripts) {
    const categoryMap: Record<string, 'development' | 'testing' | 'building' | 'quality' | 'deployment' | 'other'> = {
      development: 'development',
      testing: 'testing',
      building: 'building',
      quality: 'quality',
      deployment: 'deployment',
      other: 'other'
    };

    for (const [category, scripts] of Object.entries(info.categorizedScripts)) {
      if (!scripts) continue;
      for (const script of scripts) {
        commands[script.name] = {
          script: `${info.packageManager} run ${script.name}`,
          description: script.description,
          category: categoryMap[category] || 'other'
        };
      }
    }
  }

  // Split dependencies
  const prodDeps = info.dependencies.filter(d => !d.startsWith('@types/'));
  const devDeps = info.dependencies.filter(d => d.startsWith('@types/'));

  return {
    projectName: info.name,
    version: info.version || '0.0.0',
    projectType: detectArchitectureType(info),
    language: info.language,
    framework: info.framework,
    buildTool: info.buildTool,
    testFramework: info.testFramework,
    packageManager: info.packageManager,
    hasTypeScript: info.hasTypeScript,
    isMonorepo: info.isMonorepo || false,
    entryPoint: info.fileStructure?.entryPoint,
    sourceDirectory: info.fileStructure?.directories.find(d => d.path === 'src')?.path,
    testDirectory: info.fileStructure?.directories.find(d =>
      d.path === 'tests' || d.path === 'test' || d.path === '__tests__'
    )?.path,
    modules,
    abstractions,
    commands,
    dependencies: {
      production: prodDeps.slice(0, 20), // Limit to top 20
      development: devDeps.slice(0, 10),  // Limit to top 10
      total: info.dependencies.length
    },
    repository: info.repository,
    createdAt: now,
    updatedAt: now,
    analysisTier: 3 // Default to comprehensive analysis
  };
}

/**
 * Generate ax.summary.json content (ax-cli compatible)
 *
 * A compact summary (~500 tokens) for fast prompt injection.
 * Contains essential project metadata without the full analysis.
 *
 * @since v12.10.0
 */
function generateAxSummary(info: ProjectInfo, index: AxIndex): AxSummary {
  // Build tech stack (compact list)
  const techStack: string[] = [];
  if (info.language) techStack.push(info.language);
  if (info.framework) techStack.push(info.framework);
  if (info.buildTool) techStack.push(info.buildTool);
  if (info.testFramework) techStack.push(info.testFramework);
  if (info.packageManager && info.packageManager !== 'npm') {
    techStack.push(info.packageManager);
  }

  // Build directories (top 5)
  const directories: Record<string, string> = {};
  if (info.fileStructure?.directories) {
    for (const dir of info.fileStructure.directories.slice(0, 5)) {
      directories[dir.path] = dir.purpose || `Contains ${dir.fileCount} files`;
    }
  }

  // Build commands (top 5 essential)
  const commands: Record<string, string> = {};
  const essentialCommands = ['build', 'test', 'dev', 'lint', 'typecheck'];
  for (const cmdName of essentialCommands) {
    const cmd = index.commands[cmdName];
    if (cmd) {
      commands[cmdName] = cmd.script;
    }
  }
  // Fill remaining slots with other commands
  const remaining = 5 - Object.keys(commands).length;
  if (remaining > 0) {
    for (const [name, cmd] of Object.entries(index.commands)) {
      if (!commands[name] && Object.keys(commands).length < 5) {
        commands[name] = cmd.script;
      }
    }
  }

  // Build gotchas (critical rules/warnings, max 5)
  const gotchas: string[] = [];

  // Add technology-specific gotchas
  if (info.hasTypeScript) {
    gotchas.push('TypeScript strict mode is enabled');
  }
  if (info.isMonorepo) {
    gotchas.push('Monorepo structure - run commands from package directory');
  }
  if (info.packageManager === 'pnpm') {
    gotchas.push('Uses pnpm - ensure dependencies are installed with pnpm');
  }
  if (info.language === 'TypeScript' && info.dependencies.some(d => d.includes('esm') || d.includes('module'))) {
    gotchas.push('ESM modules - imports require .js extension even for .ts files');
  }
  if (info.testFramework) {
    gotchas.push(`Tests use ${info.testFramework} - run tests before committing`);
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    project: {
      name: info.name,
      type: detectArchitectureType(info),
      language: info.language,
      version: info.version
    },
    directories,
    commands,
    techStack,
    gotchas: gotchas.slice(0, 5),
    indexFile: 'ax.index.json'
  };
}

/**
 * Generate CUSTOM.md content
 *
 * Custom instructions for AI agents working on this project.
 * This file is protected from auto-rebuild (requires --force).
 */
function generateCustomMD(info: ProjectInfo): string {
  const today = new Date().toISOString().split('T')[0];

  const sections: string[] = [];

  // Header
  sections.push(`# Custom Instructions for ${info.name}`);
  sections.push('');
  sections.push(`> Generated: ${today}`);
  sections.push(`> Project: ${info.name}${info.version ? ` v${info.version}` : ''}`);
  sections.push('');
  sections.push('> **Note:** This file is protected from auto-rebuild. Edit freely to customize AI behavior.');
  sections.push('');

  // Project overview
  sections.push('## Project Overview');
  sections.push('');
  if (info.detailedDescription) {
    const firstParagraph = info.detailedDescription.split('\n\n')[0];
    sections.push(firstParagraph ?? '');
  } else if (info.description) {
    sections.push(info.description);
  } else {
    sections.push(`${info.framework || info.language} project${info.hasTypeScript ? ' with TypeScript' : ''}`);
  }
  sections.push('');

  // Critical rules (DO/DON'T format - ax-cli style)
  sections.push('## Critical Rules');
  sections.push('');
  sections.push('### DO');
  sections.push('');
  sections.push(`- Run \`${info.packageManager} test\` before pushing`);
  if (info.linter) {
    sections.push(`- Run \`${info.packageManager} run lint\` to check code style`);
  }
  if (info.hasTypeScript) {
    sections.push('- Use TypeScript strict mode conventions');
  }
  sections.push('- Follow conventional commits (feat/fix/chore/docs)');
  sections.push('- Add tests for new features');
  sections.push('');

  sections.push('### DON\'T');
  sections.push('');
  sections.push('- Commit directly to main/production branches');
  sections.push('- Skip tests before pushing');
  sections.push('- Expose API keys or credentials in code');
  if (info.dependencies.includes('prisma') || info.dependencies.includes('typeorm')) {
    sections.push('- Modify database migrations without approval');
  }
  sections.push('');

  // Key commands
  if (info.categorizedScripts) {
    sections.push('## Key Commands');
    sections.push('');
    sections.push('```bash');

    const allScripts = [
      ...(info.categorizedScripts.development || []),
      ...(info.categorizedScripts.testing || []),
      ...(info.categorizedScripts.building || []),
      ...(info.categorizedScripts.quality || [])
    ].slice(0, 5);

    for (const script of allScripts) {
      sections.push(`${info.packageManager} run ${script.name}  # ${script.description}`);
    }

    sections.push('```');
    sections.push('');
  }

  // Troubleshooting
  sections.push('## Troubleshooting');
  sections.push('');
  sections.push(`**Build fails**: Run \`rm -rf node_modules && ${info.packageManager} install\``);
  sections.push('');
  sections.push('**Tests fail**: Check for missing environment variables');
  sections.push('');
  if (info.hasTypeScript) {
    sections.push(`**Type errors**: Run \`${info.packageManager} run typecheck\` for details`);
    sections.push('');
  }

  // Footer
  sections.push('---');
  sections.push('');
  sections.push('*Generated by `ax init` • Edit this file to customize AI behavior*');

  return sections.join('\n');
}

/**
 * Atomic write (temp file + rename for safety)
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content, 'utf-8');
  await rename(tempPath, filePath);
}

/**
 * Check if ax.index.json is stale (older than 24 hours)
 */
async function isIndexStale(indexPath: string): Promise<boolean> {
  try {
    const stats = await stat(indexPath);
    const age = Date.now() - stats.mtime.getTime();
    return age > STALE_THRESHOLD_MS;
  } catch {
    return true; // File doesn't exist, consider it stale
  }
}

/**
 * Format age in human-readable format
 */
function formatAge(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Get AutomatosX version check cache path
 */
function getVersionCachePath(): string {
  return join(homedir(), '.automatosx', 'version-cache.json');
}

/**
 * Read version check cache
 */
async function readVersionCache(): Promise<VersionCheckCache | null> {
  try {
    const cachePath = getVersionCachePath();
    const content = await readFile(cachePath, 'utf-8');
    return JSON.parse(content) as VersionCheckCache;
  } catch {
    return null;
  }
}

/**
 * Write version check cache
 */
async function writeVersionCache(cache: VersionCheckCache): Promise<void> {
  const cachePath = getVersionCachePath();
  const cacheDir = join(homedir(), '.automatosx');
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Check if version a is newer than version b
 */
function isNewer(a: string, b: string): boolean {
  const stripPrerelease = (v: string) => v.split('-')[0] || v;
  const parseVersion = (v: string) => stripPrerelease(v).split('.').map(Number);

  const [aMajor = 0, aMinor = 0, aPatch = 0] = parseVersion(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch > bPatch;
}

/**
 * Get current installed AutomatosX version
 */
async function getCurrentVersion(): Promise<string | null> {
  try {
    // Try to get from global npm install
    const { stdout } = await execAsync('npm list -g @defai.digital/automatosx --depth=0 --json 2>/dev/null');
    const result = JSON.parse(stdout) as { dependencies?: Record<string, { version?: string }> };
    const version = result.dependencies?.['@defai.digital/automatosx']?.version;
    if (version) return version;
  } catch {
    // Not installed globally, try local package.json
  }

  try {
    // Fallback: read from package.json (for dev or local installs)
    const { dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgPath = join(__dirname, '../../../package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Get latest AutomatosX version from npm
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('npm view @defai.digital/automatosx version 2>/dev/null');
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Update AutomatosX to latest version
 */
async function updateAutomatosx(version: string): Promise<boolean> {
  try {
    console.log(chalk.cyan(`📥 Updating AutomatosX to v${version}...`));
    await execAsync(`npm install -g @defai.digital/automatosx@${version}`, {
      maxBuffer: 10 * 1024 * 1024
    });
    console.log(chalk.green(`✓ AutomatosX updated to v${version}`));
    return true;
  } catch (error) {
    logger.warn('Failed to update AutomatosX', { error: (error as Error).message });
    console.log(chalk.yellow(`⚠ Could not update AutomatosX: ${(error as Error).message}`));
    return false;
  }
}

/**
 * Check for AutomatosX updates (with 24h cache)
 *
 * Logic:
 * 1. Get current version (from global install or package.json)
 * 2. If cache is valid (<24h) and current version matches cache:
 *    - If no update available → skip silently
 *    - If update available but already attempted → skip with info message
 *    - If update available and not attempted → try to update
 * 3. If cache is stale (>24h) or missing → fetch from npm, then apply logic above
 *
 * Returns true if AutomatosX was updated and init should re-run with --force
 */
async function checkAutomatosxUpdate(): Promise<boolean> {
  try {
    // Get current version
    const currentVersion = await getCurrentVersion();
    if (!currentVersion) {
      logger.debug('Could not determine current AutomatosX version');
      return false;
    }

    // Check cache
    const cache = await readVersionCache();
    const now = Date.now();
    let latestVersion: string | null = null;
    let cacheIsValid = false;

    if (cache) {
      const lastCheckTime = new Date(cache.lastCheck).getTime();
      const age = now - lastCheckTime;

      // Cache is valid if:
      // 1. Less than 24 hours old
      // 2. Current version hasn't changed (user didn't manually update)
      if (age < STALE_THRESHOLD_MS && cache.currentVersion === currentVersion) {
        cacheIsValid = true;
        latestVersion = cache.latestVersion;

        logger.debug('AutomatosX version check using cache', {
          currentVersion,
          latestVersion,
          cacheAge: formatAge(age),
          updateAttempted: cache.updateAttempted
        });

        // If no update available, skip silently
        if (!isNewer(latestVersion, currentVersion)) {
          return false;
        }

        // Update is available
        if (cache.updateAttempted) {
          // Already tried to update in this cache period, just show info
          console.log(chalk.gray(`AutomatosX update available: ${currentVersion} → ${latestVersion} (run 'npm i -g @defai.digital/automatosx' to update)`));
          return false;
        }
      }
    }

    // Need to fetch from npm if cache is not valid
    if (!cacheIsValid) {
      console.log(chalk.gray('Checking for AutomatosX updates...'));
      latestVersion = await getLatestVersion();

      if (!latestVersion) {
        logger.debug('Could not fetch latest AutomatosX version');
        return false;
      }

      // Save cache
      await writeVersionCache({
        lastCheck: new Date().toISOString(),
        currentVersion,
        latestVersion,
        updateAttempted: false
      });

      logger.info('AutomatosX version check completed', {
        currentVersion,
        latestVersion,
        updateAvailable: isNewer(latestVersion, currentVersion)
      });

      // If no update available, done
      if (!isNewer(latestVersion, currentVersion)) {
        console.log(chalk.gray(`AutomatosX is up to date (v${currentVersion})`));
        return false;
      }
    }

    // At this point, we have an update available and haven't attempted yet
    console.log(chalk.yellow(`📦 AutomatosX update available: ${currentVersion} → ${latestVersion}`));

    const updated = await updateAutomatosx(latestVersion!);

    // Mark update as attempted (whether successful or not)
    await writeVersionCache({
      lastCheck: cache?.lastCheck || new Date().toISOString(),
      currentVersion: updated ? latestVersion! : currentVersion,
      latestVersion: latestVersion!,
      updateAttempted: true
    });

    return updated;
  } catch (error) {
    logger.debug('AutomatosX version check failed', { error: (error as Error).message });
    return false;
  }
}

export const initCommand: CommandModule<Record<string, unknown>, InitOptions> = {
  command: 'init',
  describe: 'Initialize project index (ax.index.json) and custom instructions',

  builder: (yargs) => {
    return yargs
      .option('force', {
        alias: 'f',
        describe: 'Regenerate all files including CUSTOM.md',
        type: 'boolean',
        default: false
      })
      .option('skip-update', {
        describe: 'Skip AutomatosX version check',
        type: 'boolean',
        default: false
      })
      .example([
        ['$0 init', 'Create or update ax.index.json (auto-rebuilds if >24h old)'],
        ['$0 init --force', 'Regenerate all files including CUSTOM.md'],
        ['$0 init --skip-update', 'Skip AutomatosX version check']
      ]);
  },

  handler: async (argv) => {
    const projectDir = process.cwd();

    // Check for AutomatosX updates (unless skipped)
    // Note: We check even with --force to ensure latest version is used
    if (!argv.skipUpdate) {
      const wasUpdated = await checkAutomatosxUpdate();
      if (wasUpdated) {
        // AutomatosX was updated - need to re-run with new version
        console.log(chalk.cyan('\n🔄 Re-running ax init --force with updated AutomatosX...\n'));
        try {
          const { stdout } = await execAsync('automatosx init --force --skip-update');
          console.log(stdout);
          return;
        } catch (error) {
          // If automatosx command fails, try ax alias
          try {
            const { stdout } = await execAsync('ax init --force --skip-update');
            console.log(stdout);
            return;
          } catch {
            // Both failed, continue with current process (may have stale code)
            logger.warn('Could not re-run init with updated version, continuing with current process');
            // Force the rebuild since we updated
            argv.force = true;
          }
        }
      }
    }

    const indexPath = join(projectDir, 'ax.index.json');
    const summaryPath = join(projectDir, 'ax.summary.json');
    const automatosxDir = join(projectDir, '.automatosx');
    const customMdPath = join(automatosxDir, 'CUSTOM.md');

    try {
      // Check if index exists and its age
      const indexExists = await access(indexPath, constants.F_OK).then(() => true).catch(() => false);
      let indexAge: number | null = null;

      if (indexExists) {
        try {
          const stats = await stat(indexPath);
          indexAge = Date.now() - stats.mtime.getTime();
        } catch {
          // Ignore stat errors
        }
      }

      // Determine if we need to rebuild
      const isStale = indexAge !== null && indexAge > STALE_THRESHOLD_MS;
      const shouldRebuildIndex = !indexExists || isStale || argv.force;

      if (!shouldRebuildIndex && !argv.force) {
        console.log(chalk.green(`✓ ax.index.json is up to date (${indexAge ? formatAge(indexAge) : '0h'} old)`));
        console.log(chalk.gray('  Use --force to regenerate'));
        return;
      }

      // Detect project info
      const projectInfo = await detectProjectInfo(projectDir);

      // Generate and write ax.index.json
      let indexContent: AxIndex;

      if (indexExists && !argv.force) {
        // Preserve createdAt from existing file
        try {
          const existingIndex = JSON.parse(await readFile(indexPath, 'utf-8')) as AxIndex;
          indexContent = {
            ...generateAxIndex(projectInfo),
            createdAt: existingIndex.createdAt || new Date().toISOString()
          };
        } catch {
          indexContent = generateAxIndex(projectInfo);
        }
      } else {
        indexContent = generateAxIndex(projectInfo);
      }

      await atomicWrite(indexPath, JSON.stringify(indexContent, null, 2));

      if (isStale) {
        console.log(chalk.green(`✓ Rebuilt ax.index.json (was ${formatAge(indexAge!)} old)`));
      } else if (indexExists) {
        console.log(chalk.green('✓ Updated ax.index.json'));
      } else {
        const projectType = projectInfo.framework || projectInfo.language;
        console.log(chalk.green(`✓ Created ax.index.json (${projectType} project)`));
      }

      // Generate and write ax.summary.json (always regenerated with index)
      const summaryContent = generateAxSummary(projectInfo, indexContent);
      await atomicWrite(summaryPath, JSON.stringify(summaryContent, null, 2));
      console.log(chalk.green('✓ Created ax.summary.json (fast context loading)'));

      // Ensure .automatosx directory exists
      await mkdir(automatosxDir, { recursive: true });

      // Handle CUSTOM.md (protected from auto-rebuild)
      const customMdExists = await access(customMdPath, constants.F_OK).then(() => true).catch(() => false);

      if (!customMdExists || argv.force) {
        const customMdContent = generateCustomMD(projectInfo);
        await atomicWrite(customMdPath, customMdContent);

        if (argv.force && customMdExists) {
          console.log(chalk.yellow('✓ Regenerated .automatosx/CUSTOM.md (--force)'));
        } else {
          console.log(chalk.green('✓ Created .automatosx/CUSTOM.md'));
        }
      } else {
        console.log(chalk.gray('  .automatosx/CUSTOM.md preserved (use --force to regenerate)'));
      }

      // Summary
      console.log('');
      console.log(chalk.cyan('Project initialized:'));
      console.log(chalk.gray('  • ax.summary.json  - Fast context (~500 tokens) injected into prompts'));
      console.log(chalk.gray('  • ax.index.json    - Full project analysis (read on-demand)'));
      console.log(chalk.gray('  • CUSTOM.md        - Custom AI instructions (edit to customize)'));
      console.log('');
      console.log(chalk.gray('Token savings: ax.summary.json provides quick context, AI reads ax.index.json when needed.'));

      logger.info('Project initialized', {
        projectName: projectInfo.name,
        indexRebuilt: shouldRebuildIndex,
        wasStale: isStale,
        force: argv.force
      });

    } catch (error) {
      console.log(chalk.red('✗ Error initializing project'));
      logger.error('Project initialization failed', { error });

      if (process.env.DEBUG || process.env.AUTOMATOSX_DEBUG) {
        printError(error);
      }

      process.exit(1);
    }
  }
};
