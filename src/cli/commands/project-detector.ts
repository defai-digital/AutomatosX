/**
 * Enhanced Project Detector - Claude Code Quality
 *
 * Intelligently extracts comprehensive project information:
 * - Multi-paragraph descriptions from README
 * - Categorized commands with explanations
 * - File structure documentation
 * - Architecture flow detection
 * - Component discovery
 *
 * @since v8.5.0
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, statSync } from 'fs';

export interface ProjectInfo {
  name: string;
  version?: string;
  description: string;
  detailedDescription?: string;  // NEW: Multi-paragraph from README
  repository?: string;
  teamSize?: string;
  isMonorepo?: boolean;
  stack: string;
  framework?: string;
  language: string;
  buildTool?: string;
  testFramework?: string;
  packageManager: string;
  linter?: string;
  formatter?: string;
  hasTypeScript: boolean;
  hasTests: boolean;
  hasDocs: boolean;
  scripts: Record<string, string>;
  categorizedScripts?: CategorizedScripts;  // NEW: Organized commands
  dependencies: string[];
  devDependencies: string[];
  directories: string[];
  fileStructure?: FileStructure;  // NEW: Directory structure
  keyComponents?: Component[];    // NEW: Main code components
  architectureFlow?: string;      // NEW: Architecture visualization
  gettingStarted?: GettingStarted;  // NEW: Getting started guide
  databaseSchema?: DatabaseSchema;  // NEW: Database schema documentation
  apiDocumentation?: APIDocumentation;  // NEW: API endpoint documentation
}

export interface CategorizedScripts {
  development: ScriptEntry[];
  building: ScriptEntry[];
  testing: ScriptEntry[];
  deployment: ScriptEntry[];
  quality: ScriptEntry[];
  other: ScriptEntry[];
}

export interface ScriptEntry {
  name: string;
  command: string;
  description: string;
  category: string;
}

export interface FileStructure {
  totalFiles: number;
  directories: DirectoryInfo[];
  entryPoint?: string;
  testDirectory?: string;
  docsDirectory?: string;
}

export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  purpose?: string;  // Inferred purpose
}

export interface Component {
  name: string;
  path: string;
  type: 'class' | 'function' | 'module';
  exports: string[];
  purpose?: string;
}

export interface GettingStarted {
  prerequisites: string[];
  setupSteps: string[];
  envVars: EnvVar[];
  firstRunCommand: string;
}

export interface EnvVar {
  name: string;
  example: string;
  required: boolean;
  description: string;
}

export interface DatabaseSchema {
  orm?: string;  // prisma, typeorm, sequelize
  models: DatabaseModel[];
  migrations: MigrationInfo;
}

export interface DatabaseModel {
  name: string;
  tableName?: string;
  fields: ModelField[];
  relations: ModelRelation[];
}

export interface ModelField {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isOptional?: boolean;
  defaultValue?: string;
}

export interface ModelRelation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  relatedModel: string;
}

export interface MigrationInfo {
  directory?: string;
  files: string[];
  commands: {
    migrate?: string;
    rollback?: string;
    status?: string;
  };
}

export interface APIDocumentation {
  hasOpenAPI: boolean;
  openAPIPath?: string;
  endpoints: APIEndpoint[];
  framework?: string;  // express, fastify, next.js
}

export interface APIEndpoint {
  method: string;  // GET, POST, PUT, DELETE, PATCH
  path: string;
  description?: string;
  auth?: boolean;
  group?: string;  // users, posts, auth
}

/**
 * Enhanced project detection with README parsing and structure analysis
 */
export async function detectProjectInfo(projectDir: string): Promise<ProjectInfo> {
  const projectName = projectDir.split('/').pop() || 'project';

  const info: ProjectInfo = {
    name: projectName,
    description: '',
    stack: 'Node.js',
    language: 'JavaScript',
    packageManager: 'npm',
    hasTypeScript: false,
    hasTests: false,
    hasDocs: false,
    scripts: {},
    dependencies: [],
    devDependencies: [],
    directories: []
  };

  // 1. Parse package.json
  await parsePackageJson(projectDir, info);

  // 2. Parse README.md for detailed description
  await parseReadmeDescription(projectDir, info);

  // 3. Categorize npm scripts
  info.categorizedScripts = categorizeScripts(info.scripts, info.packageManager);

  // 4. Analyze file structure
  info.fileStructure = await analyzeFileStructure(projectDir);

  // 5. Detect key components
  info.keyComponents = await detectKeyComponents(projectDir, info);

  // 6. Generate architecture flow
  info.architectureFlow = generateArchitectureFlow(info);

  // 7. Build comprehensive stack description
  info.stack = buildStackDescription(info);

  // 8. Detect getting started information
  info.gettingStarted = await detectGettingStarted(projectDir, info);

  // 9. Detect database schema
  info.databaseSchema = await detectDatabaseSchema(projectDir, info);

  // 10. Detect API documentation
  info.apiDocumentation = await detectAPIDocumentation(projectDir, info);

  // 11. Ensure we have a description
  if (!info.description) {
    info.description = generateDescription(info);
  }

  return info;
}

/**
 * Parse package.json (existing logic)
 */
async function parsePackageJson(projectDir: string, info: ProjectInfo): Promise<void> {
  try {
    const packageJsonPath = join(projectDir, 'package.json');
    if (!existsSync(packageJsonPath)) return;

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    info.name = packageJson.name || info.name;
    info.version = packageJson.version;
    info.description = packageJson.description || '';
    info.scripts = packageJson.scripts || {};

    // Repository
    if (packageJson.repository) {
      if (typeof packageJson.repository === 'string') {
        info.repository = packageJson.repository;
      } else if (packageJson.repository.url) {
        info.repository = packageJson.repository.url
          .replace(/^git\+/, '')
          .replace(/\.git$/, '');
      }
    }

    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});
    info.dependencies = deps;
    info.devDependencies = devDeps;

    // TypeScript
    info.hasTypeScript = devDeps.includes('typescript') || deps.includes('typescript');
    if (info.hasTypeScript) {
      info.language = 'TypeScript';
    }

    // Framework
    if (deps.includes('react') || devDeps.includes('react')) {
      info.framework = 'React';
    } else if (deps.includes('vue') || devDeps.includes('vue')) {
      info.framework = 'Vue';
    } else if (deps.includes('next')) {
      info.framework = 'Next.js';
    } else if (deps.includes('nuxt')) {
      info.framework = 'Nuxt';
    } else if (deps.includes('angular')) {
      info.framework = 'Angular';
    } else if (deps.includes('svelte')) {
      info.framework = 'Svelte';
    }

    // Build tools
    if (devDeps.includes('vite')) {
      info.buildTool = 'Vite';
    } else if (devDeps.includes('webpack')) {
      info.buildTool = 'Webpack';
    } else if (devDeps.includes('rollup')) {
      info.buildTool = 'Rollup';
    } else if (devDeps.includes('tsup')) {
      info.buildTool = 'tsup';
    } else if (devDeps.includes('esbuild')) {
      info.buildTool = 'esbuild';
    }

    // Test framework
    if (devDeps.includes('vitest')) {
      info.testFramework = 'Vitest';
    } else if (devDeps.includes('jest')) {
      info.testFramework = 'Jest';
    } else if (devDeps.includes('mocha')) {
      info.testFramework = 'Mocha';
    }

    // Linter
    if (devDeps.includes('eslint')) {
      info.linter = 'ESLint';
    } else if (devDeps.includes('tslint')) {
      info.linter = 'TSLint';
    }

    // Formatter
    if (devDeps.includes('prettier')) {
      info.formatter = 'Prettier';
    }

    // Package manager
    if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) {
      info.packageManager = 'pnpm';
    } else if (existsSync(join(projectDir, 'yarn.lock'))) {
      info.packageManager = 'yarn';
    } else if (existsSync(join(projectDir, 'bun.lockb'))) {
      info.packageManager = 'bun';
    }

    // Monorepo
    if (packageJson.workspaces ||
        devDeps.includes('lerna') ||
        devDeps.includes('nx') ||
        devDeps.includes('turborepo') ||
        existsSync(join(projectDir, 'lerna.json')) ||
        existsSync(join(projectDir, 'nx.json'))) {
      info.isMonorepo = true;
    }
  } catch (error) {
    // Ignore package.json errors
  }
}

/**
 * NEW: Parse README.md for detailed multi-paragraph description
 */
async function parseReadmeDescription(projectDir: string, info: ProjectInfo): Promise<void> {
  try {
    const readmePath = join(projectDir, 'README.md');
    if (!existsSync(readmePath)) return;

    const readme = await readFile(readmePath, 'utf-8');

    // Strategy 1: Extract first section after title
    const overviewMatch = readme.match(/^# .+?\n\n([\s\S]+?)\n\n## /);
    if (overviewMatch && overviewMatch[1]) {
      const overview = overviewMatch[1].trim();
      // Take first 3-5 paragraphs
      const paragraphs = overview.split('\n\n').filter(p => p.trim() && !p.startsWith('```'));
      if (paragraphs.length > 0) {
        info.detailedDescription = paragraphs.slice(0, 5).join('\n\n');
        // Update short description if empty
        if (!info.description && paragraphs[0]) {
          info.description = paragraphs[0].replace(/\*\*/g, '').substring(0, 200);
        }
      }
    }

    // Strategy 2: Look for "## Overview" or "## About" section
    if (!info.detailedDescription) {
      const sectionMatch = readme.match(/## (?:Overview|About|Description)\n\n([\s\S]+?)\n\n##/);
      if (sectionMatch && sectionMatch[1]) {
        info.detailedDescription = sectionMatch[1].trim();
      }
    }

    // Strategy 3: Extract key features/differentiators
    const featuresMatch = readme.match(/## (?:Features|Key Features|Highlights)\n\n([\s\S]+?)\n\n##/);
    if (featuresMatch && featuresMatch[1]) {
      const features = featuresMatch[1].trim();
      if (info.detailedDescription) {
        info.detailedDescription += '\n\n**Key Features:**\n' + features;
      }
    }

    // Try to detect team size from README
    const teamPatterns = [
      /team of (\d+)/i,
      /(\d+)\s+(?:person|people|developer|engineer)/i,
      /built by (\d+)/i,
      /(\d+)\s+contributor/i
    ];

    for (const pattern of teamPatterns) {
      const match = readme.match(pattern);
      if (match && match[1]) {
        const size = parseInt(match[1], 10);
        if (size === 1) {
          info.teamSize = 'Solo developer';
        } else if (size <= 5) {
          info.teamSize = `Small team (${size} people)`;
        } else if (size <= 20) {
          info.teamSize = `Medium team (${size} people)`;
        } else {
          info.teamSize = `Large team (${size}+ people)`;
        }
        break;
      }
    }

    // Check for common team indicators
    if (!info.teamSize) {
      if (readme.match(/solo\s+project/i) || readme.match(/individual\s+developer/i)) {
        info.teamSize = 'Solo developer';
      } else if (readme.match(/open\s+source/i) || readme.match(/community\s+project/i)) {
        info.teamSize = 'Open source community';
      }
    }
  } catch (error) {
    // Ignore README errors
  }
}

/**
 * NEW: Categorize npm scripts with intelligent descriptions
 */
function categorizeScripts(scripts: Record<string, string>, packageManager: string): CategorizedScripts {
  const categorized: CategorizedScripts = {
    development: [],
    building: [],
    testing: [],
    deployment: [],
    quality: [],
    other: []
  };

  for (const [name, command] of Object.entries(scripts)) {
    const entry: ScriptEntry = {
      name,
      command,
      description: inferScriptPurpose(name, command),
      category: categorizeScriptName(name)
    };

    switch (entry.category) {
      case 'dev':
        categorized.development.push(entry);
        break;
      case 'build':
        categorized.building.push(entry);
        break;
      case 'test':
        categorized.testing.push(entry);
        break;
      case 'deploy':
        categorized.deployment.push(entry);
        break;
      case 'quality':
        categorized.quality.push(entry);
        break;
      default:
        categorized.other.push(entry);
    }
  }

  return categorized;
}

/**
 * Categorize script by name
 */
function categorizeScriptName(name: string): string {
  const lower = name.toLowerCase();

  // Development
  if (lower.match(/^dev$|^start$|^serve$|^watch$/)) return 'dev';

  // Building
  if (lower.match(/^build|^compile|^bundle|^pack$/)) return 'build';

  // Testing
  if (lower.match(/^test|^spec|^e2e|^integration|^unit$/)) return 'test';

  // Deployment
  if (lower.match(/^deploy|^publish|^release|^ship$/)) return 'deploy';

  // Quality
  if (lower.match(/^lint|^format|^check|^verify|^validate|^typecheck$/)) return 'quality';

  return 'other';
}

/**
 * Infer script purpose from name and command
 */
function inferScriptPurpose(name: string, command: string): string {
  const lower = name.toLowerCase();

  // Common patterns
  if (lower === 'dev' || lower === 'start') return 'Start development server';
  if (lower === 'build') return 'Build for production';
  if (lower === 'test') return 'Run all tests';
  if (lower === 'test:unit') return 'Run unit tests';
  if (lower === 'test:integration') return 'Run integration tests';
  if (lower === 'test:e2e') return 'Run end-to-end tests';
  if (lower === 'lint') return 'Check code style';
  if (lower === 'lint:fix') return 'Fix code style issues';
  if (lower === 'format') return 'Format code';
  if (lower === 'typecheck') return 'Type check TypeScript';
  if (lower === 'verify') return 'Pre-commit verification';
  if (lower === 'deploy') return 'Deploy to production';
  if (lower === 'preview') return 'Preview production build';
  if (lower.includes('watch')) return 'Watch mode for ' + lower.split(':')[0];

  // Infer from command
  if (command.includes('vite') && command.includes('dev')) return 'Start Vite dev server';
  if (command.includes('next dev')) return 'Start Next.js dev server';
  if (command.includes('vitest')) return 'Run Vitest tests';
  if (command.includes('jest')) return 'Run Jest tests';
  if (command.includes('eslint')) return 'Lint with ESLint';
  if (command.includes('prettier')) return 'Format with Prettier';
  if (command.includes('tsc')) return 'TypeScript compilation';
  if (command.includes('tsup')) return 'Build with tsup';

  // Generic
  return `Run ${name}`;
}

/**
 * NEW: Analyze file structure
 */
async function analyzeFileStructure(projectDir: string): Promise<FileStructure> {
  const structure: FileStructure = {
    totalFiles: 0,
    directories: []
  };

  const importantDirs = [
    { name: 'src', purpose: 'Source code' },
    { name: 'lib', purpose: 'Library code' },
    { name: 'app', purpose: 'Application code' },
    { name: 'pages', purpose: 'Page components' },
    { name: 'components', purpose: 'React components' },
    { name: 'tests', purpose: 'Test files' },
    { name: 'test', purpose: 'Test files' },
    { name: '__tests__', purpose: 'Test files' },
    { name: 'docs', purpose: 'Documentation' },
    { name: 'public', purpose: 'Static assets' },
    { name: 'dist', purpose: 'Build output' },
    { name: 'build', purpose: 'Build output' }
  ];

  for (const { name, purpose } of importantDirs) {
    const dirPath = join(projectDir, name);
    if (existsSync(dirPath)) {
      try {
        const fileCount = await countFilesRecursive(dirPath);
        structure.directories.push({
          name,
          path: name,
          fileCount,
          purpose
        });

        structure.totalFiles += fileCount;

        // Track special directories
        if (name === 'tests' || name === 'test' || name === '__tests__') {
          structure.testDirectory = name;
        }
        if (name === 'docs') {
          structure.docsDirectory = name;
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  // Detect entry point
  const entryPoints = ['src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js', 'index.ts', 'index.js'];
  for (const entry of entryPoints) {
    if (existsSync(join(projectDir, entry))) {
      structure.entryPoint = entry;
      break;
    }
  }

  return structure;
}

/**
 * Count files recursively
 */
async function countFilesRecursive(dirPath: string, depth: number = 0): Promise<number> {
  if (depth > 5) return 0;  // Limit depth

  let count = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        count += await countFilesRecursive(join(dirPath, entry.name), depth + 1);
      }
    }
  } catch {
    // Ignore errors
  }
  return count;
}

/**
 * NEW: Detect key components
 */
async function detectKeyComponents(projectDir: string, info: ProjectInfo): Promise<Component[]> {
  const components: Component[] = [];

  // Scan src/ directory
  const srcDir = join(projectDir, 'src');
  if (!existsSync(srcDir)) return components;

  try {
    const files = await readdir(srcDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
        const component: Component = {
          name: file.name.replace(/\.(ts|js)$/, ''),
          path: `src/${file.name}`,
          type: 'module',
          exports: []
        };

        // Infer purpose from name
        component.purpose = inferComponentPurpose(file.name);

        components.push(component);
      }
    }

    // Sort by importance (index, main, app, etc. first)
    components.sort((a, b) => {
      const aScore = getImportanceScore(a.name);
      const bScore = getImportanceScore(b.name);
      return bScore - aScore;
    });

    // Return top 5
    return components.slice(0, 5);
  } catch {
    return components;
  }
}

/**
 * Infer component purpose from name
 */
function inferComponentPurpose(name: string): string | undefined {
  const lower = name.toLowerCase();

  if (lower.includes('index')) return 'Main entry point';
  if (lower.includes('app')) return 'Application setup';
  if (lower.includes('config')) return 'Configuration';
  if (lower.includes('router')) return 'Routing logic';
  if (lower.includes('server')) return 'Server setup';
  if (lower.includes('api')) return 'API layer';
  if (lower.includes('db') || lower.includes('database')) return 'Database layer';
  if (lower.includes('util')) return 'Utilities';
  if (lower.includes('helper')) return 'Helper functions';
  if (lower.includes('service')) return 'Business logic';

  return undefined;
}

/**
 * Get importance score for sorting
 */
function getImportanceScore(name: string): number {
  const lower = name.toLowerCase();

  if (lower === 'index') return 100;
  if (lower === 'main') return 90;
  if (lower === 'app') return 80;
  if (lower === 'server') return 70;
  if (lower === 'config') return 60;
  if (lower === 'router') return 50;

  return 0;
}

/**
 * NEW: Generate architecture flow
 */
function generateArchitectureFlow(info: ProjectInfo): string {
  // Next.js
  if (info.framework === 'Next.js') {
    return `
1. Next.js Framework (SSR/SSG)
   ↓
2. Pages & API Routes
   ↓
3. Components & Services
   ↓
4. Database / External APIs`;
  }

  // React SPA
  if (info.framework === 'React' && !info.dependencies.includes('express')) {
    return `
1. React SPA
   ↓
2. Components & State Management
   ↓
3. API Client
   ↓
4. Backend Services`;
  }

  // Full-stack (Express + React)
  if (info.dependencies.includes('express') && info.framework === 'React') {
    return `
1. Client (React SPA)
   ↓
2. API Server (Express)
   ↓
3. Services Layer
   ↓
4. Database`;
  }

  // Express API
  if (info.dependencies.includes('express')) {
    return `
1. Express Server
   ↓
2. Routes & Controllers
   ↓
3. Services / Business Logic
   ↓
4. Database / External APIs`;
  }

  // CLI Tool
  if (info.dependencies.some(d => d.includes('commander') || d.includes('yargs'))) {
    return `
1. CLI Interface
   ↓
2. Commands & Options
   ↓
3. Business Logic
   ↓
4. I/O Operations`;
  }

  // Generic Node.js
  return `
1. Entry Point (${info.fileStructure?.entryPoint || 'index.js'})
   ↓
2. Core Modules
   ↓
3. Utilities & Helpers`;
}

/**
 * Build comprehensive stack description
 */
function buildStackDescription(info: ProjectInfo): string {
  const parts: string[] = [];

  if (info.language) parts.push(info.language);
  if (info.framework) parts.push(info.framework);
  if (info.buildTool) parts.push(info.buildTool);
  if (info.testFramework) parts.push(info.testFramework);

  // Notable dependencies
  const notable = [
    'express', 'fastify', 'koa', 'hapi',
    'react', 'vue', 'angular', 'svelte',
    'next', 'nuxt', 'gatsby', 'remix',
    'prisma', 'typeorm', 'sequelize',
    'mongodb', 'mongoose', 'pg', 'mysql2',
    'graphql', 'apollo-server', 'apollo-client'
  ];

  const detected = info.dependencies.filter(d => notable.includes(d));
  parts.push(...detected);

  if (info.isMonorepo) parts.push('Monorepo');

  return parts.join(', ') || 'Node.js';
}

/**
 * Generate description from detected info
 */
function generateDescription(info: ProjectInfo): string {
  const parts: string[] = [];

  if (info.framework) {
    parts.push(`${info.framework} project`);
  } else {
    parts.push('Node.js project');
  }

  if (info.hasTypeScript) {
    parts.push('with TypeScript');
  }

  if (info.isMonorepo) {
    parts.push('(monorepo)');
  }

  return parts.join(' ');
}

/**
 * Detect getting started information
 */
async function detectGettingStarted(projectDir: string, info: ProjectInfo): Promise<GettingStarted> {
  return {
    prerequisites: detectPrerequisites(projectDir, info),
    setupSteps: generateSetupSteps(projectDir, info),
    envVars: await parseEnvExample(projectDir),
    firstRunCommand: detectFirstRunCommand(info)
  };
}

/**
 * Detect prerequisites for the project
 */
function detectPrerequisites(projectDir: string, info: ProjectInfo): string[] {
  const prereqs: string[] = [];

  // Node version from package.json
  try {
    const pkgJsonPath = join(projectDir, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const pkgJson = require(pkgJsonPath);
      if (pkgJson.engines?.node) {
        prereqs.push(`Node.js ${pkgJson.engines.node}`);
      } else {
        prereqs.push('Node.js 20.0.0+');
      }
    }
  } catch {
    prereqs.push('Node.js 20.0.0+');
  }

  // Docker
  if (existsSync(join(projectDir, 'docker-compose.yml')) ||
      existsSync(join(projectDir, 'docker-compose.yaml')) ||
      existsSync(join(projectDir, 'Dockerfile'))) {
    prereqs.push('Docker 20.0+');
  }

  // Database
  if (info.dependencies.includes('prisma') || info.dependencies.includes('@prisma/client')) {
    prereqs.push('PostgreSQL 14+ (or compatible database)');
  }
  if (info.dependencies.includes('mongodb') || info.dependencies.includes('mongoose')) {
    prereqs.push('MongoDB 6.0+');
  }
  if (info.dependencies.includes('pg') || info.dependencies.includes('postgres')) {
    prereqs.push('PostgreSQL 14+');
  }
  if (info.dependencies.includes('mysql') || info.dependencies.includes('mysql2')) {
    prereqs.push('MySQL 8.0+');
  }

  // Package manager
  if (info.packageManager !== 'npm') {
    prereqs.push(`${info.packageManager} package manager`);
  }

  return prereqs;
}

/**
 * Generate setup steps
 */
function generateSetupSteps(projectDir: string, info: ProjectInfo): string[] {
  const steps: string[] = [];
  let stepNum = 1;

  // Clone repository
  if (info.repository) {
    steps.push(`${stepNum++}. Clone repository: \`git clone ${info.repository}\``);
  }

  // Install dependencies
  const installCmd = info.packageManager === 'npm' ? 'npm install' :
                     info.packageManager === 'yarn' ? 'yarn install' :
                     info.packageManager === 'pnpm' ? 'pnpm install' :
                     'bun install';
  steps.push(`${stepNum++}. Install dependencies: \`${installCmd}\``);

  // Environment variables
  if (existsSync(join(projectDir, '.env.example'))) {
    steps.push(`${stepNum++}. Copy environment: \`cp .env.example .env\``);
  }

  // Docker setup
  if (existsSync(join(projectDir, 'docker-compose.yml')) ||
      existsSync(join(projectDir, 'docker-compose.yaml'))) {
    steps.push(`${stepNum++}. Start services: \`docker-compose up -d\``);
  }

  // Database migrations
  if (info.scripts['db:migrate']) {
    steps.push(`${stepNum++}. Run migrations: \`${info.packageManager} run db:migrate\``);
  } else if (info.scripts['migrate']) {
    steps.push(`${stepNum++}. Run migrations: \`${info.packageManager} run migrate\``);
  } else if (info.scripts['prisma:migrate']) {
    steps.push(`${stepNum++}. Run migrations: \`${info.packageManager} run prisma:migrate\``);
  }

  // Database seed
  if (info.scripts['db:seed']) {
    steps.push(`${stepNum++}. Seed data (optional): \`${info.packageManager} run db:seed\``);
  } else if (info.scripts['seed']) {
    steps.push(`${stepNum++}. Seed data (optional): \`${info.packageManager} run seed\``);
  }

  // Build step (if required before dev)
  const needsBuild = info.scripts.dev?.includes('tsc') ||
                     info.scripts.start && !info.scripts.dev;
  if (needsBuild && info.scripts.build) {
    steps.push(`${stepNum++}. Build: \`${info.packageManager} run build\``);
  }

  // Start dev server
  const devCmd = detectFirstRunCommand(info);
  if (devCmd) {
    steps.push(`${stepNum++}. Start dev server: \`${devCmd}\``);
  }

  // Access URL
  if (info.framework === 'React' || info.framework === 'Vue' || info.framework === 'Next.js') {
    steps.push(`${stepNum++}. Visit: http://localhost:3000`);
  } else if (info.dependencies.includes('express') || info.dependencies.includes('fastify')) {
    steps.push(`${stepNum++}. API available at: http://localhost:3000`);
  }

  return steps;
}

/**
 * Parse .env.example file
 */
async function parseEnvExample(projectDir: string): Promise<EnvVar[]> {
  const envExamplePath = join(projectDir, '.env.example');
  if (!existsSync(envExamplePath)) {
    return [];
  }

  try {
    const content = await readFile(envExamplePath, 'utf-8');
    const vars: EnvVar[] = [];
    let currentComment = '';

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Extract comments for descriptions
      if (trimmed.startsWith('#')) {
        currentComment = trimmed.substring(1).trim();
        continue;
      }

      // Parse variable
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && match[1]) {
        const name = match[1];
        const example = match[2] || '';
        const required = !currentComment.toLowerCase().includes('optional');

        vars.push({
          name,
          example,
          required,
          description: currentComment || ''
        });

        currentComment = '';  // Reset for next variable
      }
    }

    return vars;
  } catch {
    return [];
  }
}

/**
 * Detect first run command
 */
function detectFirstRunCommand(info: ProjectInfo): string {
  const pm = info.packageManager;

  // Common dev commands
  if (info.scripts.dev) {
    return pm === 'npm' ? 'npm run dev' : `${pm} dev`;
  }
  if (info.scripts.start) {
    return pm === 'npm' ? 'npm start' : `${pm} start`;
  }
  if (info.scripts.serve) {
    return pm === 'npm' ? 'npm run serve' : `${pm} serve`;
  }

  return `${pm} start`;
}

/**
 * Detect database schema information
 */
async function detectDatabaseSchema(projectDir: string, info: ProjectInfo): Promise<DatabaseSchema | undefined> {
  // Check for Prisma
  const prismaSchemaPath = join(projectDir, 'prisma', 'schema.prisma');
  if (existsSync(prismaSchemaPath)) {
    return await detectPrismaSchema(projectDir, prismaSchemaPath, info);
  }

  // Check for TypeORM (future implementation)
  // Check for Sequelize (future implementation)

  return undefined;
}

/**
 * Detect Prisma schema
 */
async function detectPrismaSchema(projectDir: string, schemaPath: string, info: ProjectInfo): Promise<DatabaseSchema> {
  const models: DatabaseModel[] = [];
  const migrations = await detectMigrations(projectDir, 'prisma/migrations');

  try {
    const schemaContent = await readFile(schemaPath, 'utf-8');

    // Parse models using regex (simple approach)
    const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
    let modelMatch;

    while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
      const modelName = modelMatch[1];
      const modelBody = modelMatch[2];

      if (!modelName || !modelBody) continue;

      const fields: ModelField[] = [];
      const relations: ModelRelation[] = [];

      // Parse fields
      const fieldLines = modelBody.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));

      for (const line of fieldLines) {
        const trimmed = line.trim();

        // Skip empty lines and annotations
        if (!trimmed || trimmed.startsWith('@@')) continue;

        // Parse field: name Type @attributes
        const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*(.*)?$/);
        if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[2] + (fieldMatch[3] || '');
          const attributes = fieldMatch[4] || '';

          // Check if it's a relation
          const isRelation = attributes.includes('@relation');
          if (isRelation) {
            // Determine relation type
            let relationType: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'one-to-many';
            if (fieldType.endsWith('[]')) {
              relationType = 'one-to-many';
            } else if (attributes.includes('fields:')) {
              relationType = 'one-to-one';
            }

            relations.push({
              name: fieldName,
              type: relationType,
              relatedModel: fieldType.replace('[]', '')
            });
          } else {
            // Regular field
            fields.push({
              name: fieldName,
              type: fieldType,
              isPrimaryKey: attributes.includes('@id'),
              isUnique: attributes.includes('@unique'),
              isOptional: attributes.includes('?'),
              defaultValue: attributes.includes('@default') ?
                attributes.match(/@default\((.*?)\)/)?.[1] : undefined
            });
          }
        }
      }

      models.push({
        name: modelName,
        tableName: modelName.toLowerCase(),
        fields,
        relations
      });
    }
  } catch (error) {
    // Ignore parsing errors
  }

  return {
    orm: 'Prisma',
    models,
    migrations
  };
}

/**
 * Detect migration files and commands
 */
async function detectMigrations(projectDir: string, migrationsDir: string): Promise<MigrationInfo> {
  const migrationPath = join(projectDir, migrationsDir);
  const files: string[] = [];

  if (existsSync(migrationPath)) {
    try {
      const entries = await readdir(migrationPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() || entry.name.endsWith('.sql')) {
          files.push(entry.name);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    directory: files.length > 0 ? migrationsDir : undefined,
    files: files.slice(0, 10),  // Show first 10 migrations
    commands: {
      migrate: undefined,  // Will be filled by package.json scripts
      rollback: undefined,
      status: undefined
    }
  };
}

/**
 * Detect API documentation
 */
async function detectAPIDocumentation(projectDir: string, info: ProjectInfo): Promise<APIDocumentation | undefined> {
  const endpoints: APIEndpoint[] = [];
  let hasOpenAPI = false;
  let openAPIPath: string | undefined;
  let framework: string | undefined;

  // Check for OpenAPI/Swagger spec
  const openAPIFiles = ['openapi.yaml', 'openapi.json', 'swagger.yaml', 'swagger.json', 'docs/openapi.yaml'];
  for (const file of openAPIFiles) {
    if (existsSync(join(projectDir, file))) {
      hasOpenAPI = true;
      openAPIPath = file;
      break;
    }
  }

  // Detect framework
  if (info.dependencies.includes('express')) {
    framework = 'Express';
  } else if (info.dependencies.includes('fastify')) {
    framework = 'Fastify';
  } else if (info.framework === 'Next.js') {
    framework = 'Next.js';
  }

  // Detect Next.js API routes
  if (info.framework === 'Next.js') {
    const apiRoutes = await detectNextJSAPIRoutes(projectDir);
    endpoints.push(...apiRoutes);
  }

  // Detect Express routes (simple detection)
  if (info.dependencies.includes('express')) {
    const expressRoutes = await detectExpressRoutes(projectDir);
    endpoints.push(...expressRoutes);
  }

  // Only return if we found something
  if (hasOpenAPI || endpoints.length > 0 || framework) {
    return {
      hasOpenAPI,
      openAPIPath,
      endpoints,
      framework
    };
  }

  return undefined;
}

/**
 * Detect Next.js API routes
 */
async function detectNextJSAPIRoutes(projectDir: string): Promise<APIEndpoint[]> {
  const endpoints: APIEndpoint[] = [];

  // Check both pages/api and app/api
  const apiDirs = ['pages/api', 'app/api', 'src/pages/api', 'src/app/api'];

  for (const apiDir of apiDirs) {
    const apiPath = join(projectDir, apiDir);
    if (!existsSync(apiPath)) continue;

    try {
      const files = await readdir(apiPath, { withFileTypes: true, recursive: true });
      for (const file of files) {
        if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
          // Extract route path from file path
          const routePath = file.name
            .replace(/\.(ts|js)$/, '')
            .replace(/\[([^\]]+)\]/g, ':$1')  // [id] → :id
            .replace(/index$/, '');  // index → /

          endpoints.push({
            method: 'GET/POST',  // Next.js API routes handle multiple methods
            path: `/api/${routePath}`,
            group: routePath.split('/')[0] || 'api'
          });
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return endpoints;
}

/**
 * Detect Express routes (simple regex-based detection)
 */
async function detectExpressRoutes(projectDir: string): Promise<APIEndpoint[]> {
  const endpoints: APIEndpoint[] = [];
  const srcDir = join(projectDir, 'src');

  if (!existsSync(srcDir)) return endpoints;

  try {
    // Scan for route files
    const routeFiles = await findFilesRecursive(srcDir, /route|controller|api/i, 3);

    for (const file of routeFiles.slice(0, 10)) {  // Limit to 10 files
      try {
        const content = await readFile(file, 'utf-8');

        // Simple regex to find router.get, app.post, etc.
        const routeRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;

        while ((match = routeRegex.exec(content)) !== null) {
          if (match[1] && match[2]) {
            const method = match[1].toUpperCase();
            const path = match[2];

            endpoints.push({
              method,
              path,
              group: path.split('/')[1] || 'api'
            });
          }
        }
      } catch {
        // Ignore file read errors
      }
    }
  } catch {
    // Ignore errors
  }

  return endpoints;
}

/**
 * Find files recursively matching pattern
 */
async function findFilesRecursive(dir: string, pattern: RegExp, maxDepth: number = 3, currentDepth: number = 0): Promise<string[]> {
  if (currentDepth > maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = join(dir, entry.name);

      if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        const subFiles = await findFilesRecursive(fullPath, pattern, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      }
    }
  } catch {
    // Ignore errors
  }

  return files;
}
