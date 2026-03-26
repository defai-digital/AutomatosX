import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, basename, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ZodError } from 'zod';
import {
  BridgeSpecSchema,
  CANONICAL_BRIDGE_FILE,
  CANONICAL_SKILL_FILE,
  SKILL_MARKDOWN_FILE,
  formatSchemaErrors,
  resolveBridgeRoot,
  resolveSkillRoot,
  SkillSpecSchema,
  type BridgeSpec,
  type SkillSpec,
} from './bridge-contracts.js';
import {
  assertBridgeExecutionAllowed,
  buildImportedProvenance,
  createRuntimeGovernanceError,
  evaluateBridgeExecutionTrust,
  evaluateSkillExecutionTrust,
  readAxBridgeInstallConfig,
  readAxBridgeSkillImportConfig,
  type RuntimeTrustDecision,
} from './bridge-governance.js';

const execFileAsync = promisify(execFile);
const MAX_BRIDGE_OUTPUT_BUFFER = 10 * 1024 * 1024;

export interface BridgeLoadSuccess {
  success: true;
  definition: BridgeSpec;
  path: string;
  relativePath: string;
}

export interface BridgeLoadFailure {
  success: false;
  error: string;
  path: string;
  relativePath: string;
}

export type BridgeLoadResult = BridgeLoadSuccess | BridgeLoadFailure;

export interface SkillLoadSuccess {
  success: true;
  definition: SkillSpec;
  path: string;
  relativePath: string;
  sourceKind: 'json' | 'markdown';
}

export interface SkillLoadFailure {
  success: false;
  error: string;
  path: string;
  relativePath: string;
}

export type SkillLoadResult = SkillLoadSuccess | SkillLoadFailure;

interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ImportedSkillResult {
  definition: SkillSpec;
  skillPath: string;
  markdownPath: string;
  relativePath: string;
  trust: RuntimeTrustDecision;
  warnings: string[];
}

export interface InstalledBridgeResult {
  definition: BridgeSpec;
  bridgePath: string;
  installedDir: string;
  relativePath: string;
  trust: RuntimeTrustDecision;
  warnings: string[];
}

export interface InstallBridgeDefinitionOptions {
  requireTrusted?: boolean;
  warnOnDenied?: boolean;
}

export interface ImportSkillDocumentOptions {
  requireTrusted?: boolean;
  warnOnDenied?: boolean;
}

export interface ExportedSkillResult {
  definition: SkillSpec;
  outputPath: string;
  relativePath: string;
  markdown: string;
}

export interface BridgeExecutionResult {
  bridgeId: string;
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  trust?: RuntimeTrustDecision;
  provenance?: BridgeSpec['provenance'] | BridgeSpec['source'];
}

export interface RuntimeBridgeService {
  discoverBridgeDefinitions(): Promise<BridgeLoadResult[]>;
  resolveBridgeReference(reference: string): Promise<BridgeLoadSuccess>;
  loadRequiredBridgeDefinition(path: string): Promise<BridgeLoadSuccess>;
  installBridgeDefinition(sourcePath: string, options?: InstallBridgeDefinitionOptions): Promise<InstalledBridgeResult>;
  executeBridge(bridge: BridgeLoadSuccess, userArgs: string[]): Promise<BridgeExecutionResult>;
  discoverSkillDefinitions(): Promise<SkillLoadResult[]>;
  resolveSkillReference(reference: string): Promise<SkillLoadSuccess>;
  loadRequiredSkillDefinition(path: string): Promise<SkillLoadSuccess>;
  importSkillDocument(sourcePath: string, options?: ImportSkillDocumentOptions): Promise<ImportedSkillResult>;
  exportSkillDocument(reference: string, outputPath: string): Promise<ExportedSkillResult>;
}

export function createRuntimeBridgeService(config: { basePath: string }): RuntimeBridgeService {
  const { basePath } = config;

  return {
    discoverBridgeDefinitions() {
      return discoverBridgeDefinitions(basePath);
    },
    resolveBridgeReference(reference) {
      return resolveBridgeReference(basePath, reference);
    },
    loadRequiredBridgeDefinition(path) {
      return loadRequiredBridgeDefinition(basePath, path);
    },
    installBridgeDefinition(sourcePath, options) {
      return installBridgeDefinition(basePath, sourcePath, options);
    },
    executeBridge(bridge, userArgs) {
      return executeBridge(basePath, bridge, userArgs);
    },
    discoverSkillDefinitions() {
      return discoverSkillDefinitions(basePath);
    },
    resolveSkillReference(reference) {
      return resolveSkillReference(basePath, reference);
    },
    loadRequiredSkillDefinition(path) {
      return loadRequiredSkillDefinition(basePath, path);
    },
    importSkillDocument(sourcePath, options) {
      return importSkillDocument(basePath, sourcePath, options);
    },
    exportSkillDocument(reference, outputPath) {
      return exportSkillDocument(basePath, reference, outputPath);
    },
  };
}

export async function discoverBridgeDefinitions(basePath: string): Promise<BridgeLoadResult[]> {
  const root = resolveBridgeRoot(basePath);
  const files = await listBridgeDefinitionFiles(root);
  const loaded = await Promise.all(files.map(async (path) => loadBridgeDefinition(basePath, path)));
  return loaded.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function resolveBridgeReference(basePath: string, reference: string): Promise<BridgeLoadSuccess> {
  if (looksLikeBridgePath(reference)) {
    const resolvedPath = isAbsolute(reference) ? reference : resolve(basePath, reference);
    return loadRequiredBridgeDefinition(basePath, resolvedPath);
  }

  const discovered = await discoverBridgeDefinitions(basePath);
  const matches = discovered.filter((entry): entry is BridgeLoadSuccess => (
    entry.success && entry.definition.bridgeId === reference
  ));

  if (matches.length === 0) {
    throw new Error(`Bridge not found: ${reference}`);
  }
  if (matches.length > 1) {
    throw new Error(`Bridge id "${reference}" is ambiguous across ${matches.length} definitions.`);
  }
  return matches[0];
}

export async function loadRequiredBridgeDefinition(basePath: string, path: string): Promise<BridgeLoadSuccess> {
  const loaded = await loadBridgeDefinition(basePath, path);
  if (!loaded.success) {
    throw new Error(loaded.error);
  }
  return loaded;
}

export async function installBridgeDefinition(
  basePath: string,
  sourcePath: string,
  options?: InstallBridgeDefinitionOptions,
): Promise<InstalledBridgeResult> {
  const resolvedSource = await resolveBridgeInstallSourcePath(basePath, sourcePath);
  const sourceBridge = await loadRequiredBridgeDefinition(basePath, resolvedSource.bridgePath);
  const targetDir = join(resolveBridgeRoot(basePath), slugifyBridgeDirectoryName(sourceBridge.definition.bridgeId));
  const targetBridgePath = join(targetDir, CANONICAL_BRIDGE_FILE);
  const installConfig = await readAxBridgeInstallConfig(basePath);
  const normalizedDefinition: BridgeSpec = {
    ...sourceBridge.definition,
    provenance: buildImportedProvenance(
      basePath,
      resolvedSource.originalPath,
      sourceBridge.definition.provenance,
      {
        importer: 'ax.bridge.install',
        type: resolvedSource.sourceKind === 'directory' ? 'local-bridge-bundle' : 'local-bridge-definition',
      },
    ),
  };
  const trust = await evaluateBridgeExecutionTrust(basePath, normalizedDefinition);
  const rejectDenied = options?.requireTrusted ?? installConfig.rejectDenied;
  const warnOnDenied = options?.warnOnDenied ?? installConfig.warnOnDenied;

  if (rejectDenied && !trust.allowed) {
    throw createRuntimeGovernanceError(
      trust,
      'BRIDGE_INSTALL_TRUST_REQUIRED',
      [
        `Bridge install denied: ${normalizedDefinition.bridgeId}`,
        trust.reason,
      ].join('\n'),
    );
  }

  await mkdir(resolveBridgeRoot(basePath), { recursive: true });
  if (resolve(resolvedSource.sourceDir) !== resolve(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
    await cp(resolvedSource.sourceDir, targetDir, { recursive: true, force: true });
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  await writeFile(targetBridgePath, `${JSON.stringify(normalizedDefinition, null, 2)}\n`, 'utf8');

  return {
    definition: normalizedDefinition,
    bridgePath: targetBridgePath,
    installedDir: targetDir,
    relativePath: relative(basePath, targetBridgePath) || targetBridgePath,
    trust,
    warnings: buildInstallWarnings(normalizedDefinition.bridgeId, trust, warnOnDenied),
  };
}

export async function executeBridge(
  basePath: string,
  bridge: BridgeLoadSuccess,
  userArgs: string[],
): Promise<BridgeExecutionResult> {
  const trust = await assertBridgeExecutionAllowed(basePath, bridge.definition);
  const invocation = resolveBridgeInvocation(basePath, bridge, userArgs);

  try {
    const { stdout, stderr } = await execFileAsync(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: process.env,
      maxBuffer: MAX_BRIDGE_OUTPUT_BUFFER,
    });

    return {
      bridgeId: bridge.definition.bridgeId,
      command: invocation.command,
      args: invocation.args,
      cwd: invocation.cwd,
      stdout,
      stderr,
      exitCode: 0,
      trust,
      provenance: bridge.definition.provenance ?? bridge.definition.source,
    };
  } catch (error) {
    if (isExecFileError(error)) {
      return {
        bridgeId: bridge.definition.bridgeId,
        command: invocation.command,
        args: invocation.args,
        cwd: invocation.cwd,
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
        exitCode: typeof error.code === 'number' ? error.code : 1,
        trust,
        provenance: bridge.definition.provenance ?? bridge.definition.source,
      };
    }
    throw error;
  }
}

export async function discoverSkillDefinitions(basePath: string): Promise<SkillLoadResult[]> {
  const root = resolveSkillRoot(basePath);
  const files = preferCanonicalSkillFiles(await listSkillDefinitionFiles(root));
  const loaded = await Promise.all(files.map(async (path) => loadSkillDefinition(basePath, path)));
  return loaded.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function resolveSkillReference(basePath: string, reference: string): Promise<SkillLoadSuccess> {
  if (looksLikeSkillPath(reference)) {
    const resolvedPath = isAbsolute(reference) ? reference : resolve(basePath, reference);
    return loadRequiredSkillDefinition(basePath, resolvedPath);
  }

  const discovered = await discoverSkillDefinitions(basePath);
  const matches = discovered.filter((entry): entry is SkillLoadSuccess => (
    entry.success && entry.definition.skillId === reference
  ));

  if (matches.length === 0) {
    throw new Error(`Skill not found: ${reference}`);
  }
  if (matches.length > 1) {
    throw new Error(`Skill id "${reference}" is ambiguous across ${matches.length} definitions.`);
  }
  return matches[0];
}

export async function loadRequiredSkillDefinition(basePath: string, path: string): Promise<SkillLoadSuccess> {
  const resolvedPath = await resolveSkillInputPath(path);
  const loaded = await loadSkillDefinition(basePath, resolvedPath);
  if (!loaded.success) {
    throw new Error(loaded.error);
  }
  return loaded;
}

export async function importSkillDocument(
  basePath: string,
  sourcePath: string,
  options?: ImportSkillDocumentOptions,
): Promise<ImportedSkillResult> {
  const resolvedSourcePath = await resolveSkillImportSourcePath(basePath, sourcePath);
  const raw = await readFile(resolvedSourcePath, 'utf8');
  const parsed = parseSkillMarkdown(raw);
  const normalized = normalizeSkillDocument(parsed, relative(basePath, resolvedSourcePath) || basename(resolvedSourcePath));
  const result = SkillSpecSchema.safeParse({
    ...normalized,
    provenance: buildImportedProvenance(basePath, resolvedSourcePath, normalized.provenance),
  } satisfies SkillSpec);
  if (!result.success) {
    throw new Error(formatSkillLoadError(relative(basePath, resolvedSourcePath) || resolvedSourcePath, result.error));
  }

  const importConfig = await readAxBridgeSkillImportConfig(basePath);
  const trust = await evaluateSkillExecutionTrust(basePath, result.data);
  const rejectDenied = options?.requireTrusted ?? importConfig.rejectDenied;
  const warnOnDenied = options?.warnOnDenied ?? importConfig.warnOnDenied;

  if (rejectDenied && !trust.allowed) {
    throw createRuntimeGovernanceError(
      trust,
      'SKILL_IMPORT_TRUST_REQUIRED',
      [
        `Skill import denied: ${result.data.skillId}`,
        trust.reason,
      ].join('\n'),
    );
  }

  const slug = slugifySkillId(result.data.skillId);
  const skillDir = join(resolveSkillRoot(basePath), slug);
  const skillPath = join(skillDir, CANONICAL_SKILL_FILE);
  const markdownPath = join(skillDir, SKILL_MARKDOWN_FILE);

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, `${JSON.stringify(result.data, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, raw, 'utf8');

  return {
    definition: result.data,
    skillPath,
    markdownPath,
    relativePath: relative(basePath, skillPath) || skillPath,
    trust,
    warnings: buildSkillImportWarnings(result.data.skillId, trust, warnOnDenied),
  };
}

export async function exportSkillDocument(
  basePath: string,
  reference: string,
  outputPath: string,
): Promise<ExportedSkillResult> {
  const skill = await resolveSkillReference(basePath, reference);
  const resolvedOutputPath = await resolveSkillExportOutputPath(basePath, outputPath);
  const markdown = renderSkillMarkdown(skill.definition);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, markdown, 'utf8');

  return {
    definition: skill.definition,
    outputPath: resolvedOutputPath,
    relativePath: relative(basePath, resolvedOutputPath) || resolvedOutputPath,
    markdown,
  };
}

export function scoreSkillAgainstQuery(skill: SkillSpec, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return 0;
  }

  const id = skill.skillId.toLowerCase();
  const name = typeof skill.name === 'string' ? skill.name.toLowerCase() : '';
  const description = typeof skill.description === 'string' ? skill.description.toLowerCase() : '';
  const tags = Array.isArray(skill.tags) ? skill.tags.map((value) => String(value).toLowerCase()) : [];
  const body = typeof skill.body === 'string' ? skill.body.toLowerCase() : '';
  const queryTokens = tokenize(normalizedQuery);

  let score = 0;
  if (id === normalizedQuery) score += 100;
  if (name === normalizedQuery) score += 80;
  if (id.includes(normalizedQuery)) score += 40;
  if (name.includes(normalizedQuery)) score += 32;
  if (description.includes(normalizedQuery)) score += 20;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 24;

  for (const token of queryTokens) {
    if (id.includes(token)) score += 18;
    if (name.includes(token)) score += 16;
    if (tags.some((tag) => tag.includes(token))) score += 12;
    if (description.includes(token)) score += 8;
    if (body.includes(token)) score += 2;
  }

  return score;
}

async function loadBridgeDefinition(basePath: string, path: string): Promise<BridgeLoadResult> {
  const relativePath = relative(basePath, path) || path;

  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const result = BridgeSpecSchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: formatBridgeLoadError(relativePath, result.error),
        path,
        relativePath,
      };
    }
    return {
      success: true,
      definition: result.data,
      path,
      relativePath,
    };
  } catch (error) {
    return {
      success: false,
      error: formatUnknownBridgeLoadError(relativePath, error),
      path,
      relativePath,
    };
  }
}

async function loadSkillDefinition(basePath: string, path: string): Promise<SkillLoadResult> {
  const relativePath = relative(basePath, path) || path;

  try {
    if (basename(path) === CANONICAL_SKILL_FILE) {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const result = SkillSpecSchema.safeParse(parsed);
      if (!result.success) {
        return {
          success: false,
          error: formatSkillLoadError(relativePath, result.error),
          path,
          relativePath,
        };
      }
      return {
        success: true,
        definition: result.data,
        path,
        relativePath,
        sourceKind: 'json',
      };
    }

    const raw = await readFile(path, 'utf8');
    const parsed = parseSkillMarkdown(raw);
    const normalized = normalizeSkillDocument(parsed, relativePath);
    const result = SkillSpecSchema.safeParse(normalized);
    if (!result.success) {
      return {
        success: false,
        error: formatSkillLoadError(relativePath, result.error),
        path,
        relativePath,
      };
    }
    return {
      success: true,
      definition: result.data,
      path,
      relativePath,
      sourceKind: 'markdown',
    };
  } catch (error) {
    return {
      success: false,
      error: formatUnknownSkillLoadError(relativePath, error),
      path,
      relativePath,
    };
  }
}

async function listBridgeDefinitionFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        return listBridgeDefinitionFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        return [fullPath];
      }
      return [];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

async function listSkillDefinitionFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        return listSkillDefinitionFiles(fullPath);
      }
      if (entry.isFile() && (entry.name === CANONICAL_SKILL_FILE || entry.name === SKILL_MARKDOWN_FILE)) {
        return [fullPath];
      }
      return [];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

function preferCanonicalSkillFiles(files: string[]): string[] {
  const byDirectory = new Map<string, { json?: string; markdown?: string }>();

  for (const file of files) {
    const key = dirname(file);
    const current = byDirectory.get(key) ?? {};
    if (basename(file) === CANONICAL_SKILL_FILE) {
      current.json = file;
    }
    if (basename(file) === SKILL_MARKDOWN_FILE) {
      current.markdown = file;
    }
    byDirectory.set(key, current);
  }

  return [...byDirectory.values()]
    .flatMap((entry) => entry.json ?? entry.markdown ?? [])
    .sort((left, right) => left.localeCompare(right));
}

async function resolveSkillInputPath(path: string): Promise<string> {
  const stats = await stat(path);
  if (stats.isDirectory()) {
    const canonicalPath = join(path, CANONICAL_SKILL_FILE);
    try {
      const canonicalStats = await stat(canonicalPath);
      if (canonicalStats.isFile()) {
        return canonicalPath;
      }
    } catch {
      // Ignore and continue to SKILL.md fallback.
    }
    return join(path, SKILL_MARKDOWN_FILE);
  }
  return path;
}

async function resolveSkillImportSourcePath(basePath: string, sourcePath: string): Promise<string> {
  const resolvedPath = isAbsolute(sourcePath) ? sourcePath : resolve(basePath, sourcePath);
  const stats = await stat(resolvedPath);
  if (stats.isDirectory()) {
    return join(resolvedPath, SKILL_MARKDOWN_FILE);
  }
  return resolvedPath;
}

async function resolveSkillExportOutputPath(basePath: string, outputPath: string): Promise<string> {
  const resolvedPath = isAbsolute(outputPath) ? outputPath : resolve(basePath, outputPath);

  try {
    const stats = await stat(resolvedPath);
    if (stats.isDirectory()) {
      return join(resolvedPath, SKILL_MARKDOWN_FILE);
    }
    return resolvedPath;
  } catch {
    if (extname(resolvedPath).toLowerCase() === '.md') {
      return resolvedPath;
    }
    return join(resolvedPath, SKILL_MARKDOWN_FILE);
  }
}

function resolveBridgeInvocation(
  basePath: string,
  bridge: BridgeLoadSuccess,
  userArgs: string[],
): { command: string; args: string[]; cwd: string } {
  const entrypoint = bridge.definition.entrypoint;
  const defaultArgs = entrypoint.args ?? [];

  switch (entrypoint.type) {
    case 'command':
      return {
        command: entrypoint.command ?? failMissingEntrypoint(bridge.definition.bridgeId, 'command'),
        args: [...defaultArgs, ...userArgs],
        cwd: basePath,
      };
    case 'script': {
      const scriptPath = entrypoint.path ?? failMissingEntrypoint(bridge.definition.bridgeId, 'path');
      const resolvedScriptPath = isAbsolute(scriptPath)
        ? scriptPath
        : resolve(dirname(bridge.path), scriptPath);
      const resolved = resolveScriptCommand(resolvedScriptPath);
      return {
        command: resolved.command,
        args: [...resolved.prefixArgs, ...defaultArgs, ...userArgs],
        cwd: dirname(resolvedScriptPath),
      };
    }
    case 'manual':
      throw new Error(`Bridge "${bridge.definition.bridgeId}" uses a manual entrypoint and cannot be run automatically.`);
    case 'module':
      throw new Error(`Bridge "${bridge.definition.bridgeId}" uses a module entrypoint and is not supported yet.`);
    case 'url':
      throw new Error(`Bridge "${bridge.definition.bridgeId}" uses a URL entrypoint and is not supported yet.`);
    default:
      throw new Error(`Bridge "${bridge.definition.bridgeId}" uses an unknown entrypoint type.`);
  }
}

function resolveScriptCommand(scriptPath: string): { command: string; prefixArgs: string[] } {
  const extension = extname(scriptPath).toLowerCase();
  switch (extension) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return { command: process.execPath, prefixArgs: [scriptPath] };
    case '.sh':
      return { command: 'sh', prefixArgs: [scriptPath] };
    case '.py':
      return { command: 'python3', prefixArgs: [scriptPath] };
    default:
      return { command: scriptPath, prefixArgs: [] };
  }
}

function failMissingEntrypoint(bridgeId: string, field: string): never {
  throw new Error(`Bridge "${bridgeId}" is missing required entrypoint field: ${field}`);
}

function parseSkillMarkdown(raw: string): ParsedSkillMarkdown {
  const normalized = raw.replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return {
      frontmatter: {},
      body: normalized.trim(),
    };
  }

  const endDelimiterMatch = /\n---(?:\n|$)/.exec(normalized.slice(4));
  const endIndex = endDelimiterMatch === null ? -1 : 4 + endDelimiterMatch.index;
  if (endIndex === -1) {
    throw new Error('Malformed SKILL.md frontmatter: missing closing "---" delimiter.');
  }

  const frontmatterRaw = normalized.slice(4, endIndex);
  const bodyStartIndex = normalized.startsWith('\n---\n', endIndex) ? endIndex + 5 : endIndex + 4;
  const body = normalized.slice(bodyStartIndex).trim();

  return {
    frontmatter: parseSimpleFrontmatter(frontmatterRaw),
    body,
  };
}

function parseSimpleFrontmatter(input: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};

  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      throw new Error(`Malformed SKILL.md frontmatter line: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    frontmatter[key] = parseFrontmatterValue(rawValue);
  }

  return frontmatter;
}

function parseFrontmatterValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '[]') return [];
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => stripMatchingQuotes(part));
  }
  return stripMatchingQuotes(value);
}

function normalizeSkillDocument(document: ParsedSkillMarkdown, source: string): SkillSpec {
  const frontmatter = document.frontmatter;
  const linkedBridgeId = firstString(
    frontmatter.linkedBridgeId,
    frontmatter['linked-bridge-id'],
    frontmatter.bridgeId,
    frontmatter['bridge-id'],
    frontmatter.bridge,
  );
  const linkedAgentId = firstString(
    frontmatter.linkedAgentId,
    frontmatter['linked-agent-id'],
    frontmatter.agentId,
    frontmatter['agent-id'],
    frontmatter.agent,
  );
  const name = firstString(frontmatter.name, extractHeadingTitle(document.body));
  const description = firstString(frontmatter.description, extractFirstParagraph(document.body));
  const commandDispatch = firstString(frontmatter.commandDispatch, frontmatter['command-dispatch']);
  const explicitDispatch = normalizeDispatch(firstString(frontmatter.dispatch))
    ?? normalizeDispatch(commandDispatch === 'tool' ? 'bridge' : commandDispatch);

  const dispatch = explicitDispatch ?? (
    linkedBridgeId !== undefined ? 'bridge' : linkedAgentId !== undefined ? 'delegate' : 'prompt'
  );
  const tags = normalizeTags(frontmatter.tags);
  const skillId = slugifySkillId(firstString(
    frontmatter.skillId,
    frontmatter['skill-id'],
    frontmatter.id,
    name,
    basename(dirname(source)),
    basename(source, '.md'),
  ) ?? 'skill');
  const explicitUserInvocable = firstBoolean(frontmatter.userInvocable, frontmatter['user-invocable']);
  const explicitModelInvocable = firstBoolean(frontmatter.modelInvocable, frontmatter['model-invocable']);
  const disableModelInvocation = firstBoolean(frontmatter['disable-model-invocation']) === true;
  const approval = normalizeApproval(frontmatter);
  const provenance = normalizeProvenance(frontmatter.provenance);

  return {
    schemaVersion: 1,
    skillId,
    name,
    description,
    dispatch,
    linkedBridgeId,
    linkedAgentId,
    approval,
    provenance,
    userInvocable: explicitUserInvocable ?? true,
    modelInvocable: explicitModelInvocable ?? !disableModelInvocation,
    tags,
    body: document.body,
    frontmatter,
  };
}

function renderSkillMarkdown(skill: SkillSpec): string {
  const frontmatter = buildExportFrontmatter(skill);
  const body = renderSkillBody(skill);
  return `${renderFrontmatter(frontmatter)}\n\n${body}\n`;
}

function buildExportFrontmatter(skill: SkillSpec): Record<string, unknown> {
  const original = extractFrontmatterRecord(skill.frontmatter);
  const frontmatter: Record<string, unknown> = {
    'skill-id': skill.skillId,
    name: skill.name,
    description: skill.description,
    tags: Array.isArray(skill.tags) && skill.tags.length > 0 ? skill.tags : undefined,
    dispatch: skill.dispatch,
    'command-dispatch': skill.dispatch === 'bridge' ? 'tool' : undefined,
    'linked-bridge-id': skill.linkedBridgeId,
    'linked-agent-id': skill.linkedAgentId,
    approval: skill.approval,
    provenance: skill.provenance,
    'user-invocable': skill.userInvocable === false ? false : undefined,
    'disable-model-invocation': skill.modelInvocable === false ? true : undefined,
  };

  for (const [key, value] of Object.entries(original)) {
    if (frontmatter[key] === undefined) {
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

function renderSkillBody(skill: SkillSpec): string {
  if (typeof skill.body === 'string' && skill.body.trim().length > 0) {
    return skill.body.trim();
  }

  const title = skill.name ?? skill.skillId;
  const description = typeof skill.description === 'string' ? skill.description.trim() : '';
  return description.length > 0 ? `# ${title}\n\n${description}` : `# ${title}`;
}

function renderFrontmatter(frontmatter: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(...renderFrontmatterEntry(key, value, 0));
  }
  lines.push('---');
  return lines.join('\n');
}

function renderFrontmatterEntry(key: string, value: unknown, indentLevel: number): string[] {
  if (value === undefined) return [];
  const indent = '  '.repeat(indentLevel);

  if (isScalar(value)) {
    return [`${indent}${key}: ${formatFrontmatterScalar(value)}`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${indent}${key}: []`];
    if (value.every(isScalar)) {
      return [`${indent}${key}: [${value.map((entry) => formatFrontmatterScalar(entry)).join(', ')}]`];
    }
    return [
      `${indent}${key}:`,
      ...value.flatMap((entry) => renderFrontmatterArrayItem(entry, indentLevel + 1)),
    ];
  }
  if (isPlainObject(value)) {
    return [
      `${indent}${key}:`,
      ...Object.entries(value).flatMap(([childKey, childValue]) => renderFrontmatterEntry(childKey, childValue, indentLevel + 1)),
    ];
  }
  return [`${indent}${key}: ${formatFrontmatterScalar(String(value))}`];
}

function renderFrontmatterArrayItem(value: unknown, indentLevel: number): string[] {
  const indent = '  '.repeat(indentLevel);
  if (isScalar(value)) return [`${indent}- ${formatFrontmatterScalar(value)}`];
  if (Array.isArray(value)) return [`${indent}- ${JSON.stringify(value)}`];
  if (isPlainObject(value)) {
    return [
      `${indent}-`,
      ...Object.entries(value).flatMap(([key, childValue]) => renderFrontmatterEntry(key, childValue, indentLevel + 1)),
    ];
  }
  return [`${indent}- ${formatFrontmatterScalar(String(value))}`];
}

function formatFrontmatterScalar(value: string | number | boolean): string {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (value.length === 0) return '""';
  if (/^[A-Za-z0-9._/@-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
}

function extractHeadingTitle(body: string): string | undefined {
  const line = body.split('\n').find((value) => value.startsWith('# '));
  return line?.slice(2).trim() || undefined;
}

function extractFirstParagraph(body: string): string | undefined {
  const paragraph = body
    .split('\n\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0 && !value.startsWith('#'));
  return paragraph;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function slugifySkillId(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'skill';
}

function normalizeDispatch(value: string | undefined): 'prompt' | 'delegate' | 'bridge' | undefined {
  if (value === 'prompt' || value === 'delegate' || value === 'bridge') {
    return value;
  }
  return undefined;
}

function normalizeApproval(frontmatter: Record<string, unknown>): SkillSpec['approval'] {
  const mode = normalizeApprovalMode(firstString(
    frontmatter.approvalMode,
    frontmatter['approval-mode'],
    isPlainObject(frontmatter.approval) ? firstString(frontmatter.approval.mode) : undefined,
  ));
  if (mode === undefined) {
    return undefined;
  }

  return {
    mode,
    policyId: firstString(
      frontmatter.approvalPolicyId,
      frontmatter['approval-policy-id'],
      isPlainObject(frontmatter.approval) ? firstString(frontmatter.approval.policyId) : undefined,
    ),
  };
}

function normalizeApprovalMode(value: string | undefined): 'prompt' | 'policy' | 'auto' | undefined {
  if (value === 'prompt' || value === 'policy' || value === 'auto') {
    return value;
  }
  return undefined;
}

function normalizeProvenance(value: unknown): SkillSpec['provenance'] {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const type = firstString(value.type);
  if (type === undefined) {
    return undefined;
  }

  return {
    type,
    ref: firstString(value.ref),
    importedAt: firstString(value.importedAt, value['imported-at']),
    importer: firstString(value.importer),
  };
}

async function resolveBridgeInstallSourcePath(
  basePath: string,
  sourcePath: string,
): Promise<{
  originalPath: string;
  sourceKind: 'directory' | 'file';
  sourceDir: string;
  bridgePath: string;
}> {
  if (/^[a-z]+:\/\//i.test(sourcePath)) {
    throw new Error('Remote bridge install is not implemented yet. Use a local directory or bridge.json path.');
  }

  const resolvedPath = isAbsolute(sourcePath) ? sourcePath : resolve(basePath, sourcePath);
  const stats = await stat(resolvedPath).catch(() => undefined);
  if (stats === undefined) {
    throw new Error(`Bridge install source not found: ${sourcePath}`);
  }

  if (stats.isDirectory()) {
    const bridgePath = join(resolvedPath, CANONICAL_BRIDGE_FILE);
    await stat(bridgePath).catch(() => {
      throw new Error(`Bridge install source directory does not contain bridge.json: ${sourcePath}`);
    });
    return {
      originalPath: resolvedPath,
      sourceKind: 'directory',
      sourceDir: resolvedPath,
      bridgePath,
    };
  }

  return {
    originalPath: resolvedPath,
    sourceKind: 'file',
    sourceDir: dirname(resolvedPath),
    bridgePath: resolvedPath,
  };
}

function slugifyBridgeDirectoryName(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'bridge';
}

function buildInstallWarnings(
  bridgeId: string,
  trust: RuntimeTrustDecision,
  warnOnDenied: boolean,
): string[] {
  return buildDeferredAdmissionWarnings({
    noun: 'Bridge',
    id: bridgeId,
    verb: 'installed',
    rerunAction: 'install',
    trust,
    warnOnDenied,
  });
}

function buildSkillImportWarnings(
  skillId: string,
  trust: RuntimeTrustDecision,
  warnOnDenied: boolean,
): string[] {
  return buildDeferredAdmissionWarnings({
    noun: 'Skill',
    id: skillId,
    verb: 'imported',
    rerunAction: 'import',
    trust,
    warnOnDenied,
  });
}

function buildDeferredAdmissionWarnings(config: {
  noun: 'Bridge' | 'Skill';
  id: string;
  verb: 'installed' | 'imported';
  rerunAction: 'install' | 'import';
  trust: RuntimeTrustDecision;
  warnOnDenied: boolean;
}): string[] {
  const { noun, id, verb, rerunAction, trust, warnOnDenied } = config;
  if (trust.allowed || !warnOnDenied) {
    return [];
  }

  return [
    [
      `${noun} "${id}" was ${verb}, but trust is currently denied (${trust.state}).`,
      trust.reason,
      `Execution will remain blocked until the workspace trust policy is updated or ${rerunAction} is rerun in strict mode.`,
    ].join(' '),
  ];
}

function looksLikeBridgePath(reference: string): boolean {
  return reference.includes('/') || reference.includes('\\') || reference.endsWith('.json');
}

function looksLikeSkillPath(reference: string): boolean {
  return reference.includes('/') || reference.includes('\\') || reference.endsWith('.json') || reference.endsWith('.md');
}

function stripMatchingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1);
  }
  return value;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function extractFrontmatterRecord(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};
  return { ...value };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function formatBridgeLoadError(relativePath: string, error: ZodError): string {
  return `Invalid bridge definition at ${relativePath}: ${formatSchemaErrors(error)}`;
}

function formatSkillLoadError(relativePath: string, error: ZodError): string {
  return `Invalid skill definition at ${relativePath}: ${formatSchemaErrors(error)}`;
}

function formatUnknownBridgeLoadError(relativePath: string, error: unknown): string {
  if (error instanceof SyntaxError) {
    return `Invalid JSON at ${relativePath}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Failed to load bridge definition at ${relativePath}: ${error.message}`;
  }
  return `Failed to load bridge definition at ${relativePath}.`;
}

function formatUnknownSkillLoadError(relativePath: string, error: unknown): string {
  if (error instanceof SyntaxError) {
    return `Invalid JSON at ${relativePath}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Failed to load skill definition at ${relativePath}: ${error.message}`;
  }
  return `Failed to load skill definition at ${relativePath}.`;
}

function isExecFileError(error: unknown): error is Error & {
  stdout?: string;
  stderr?: string;
  code?: number | string;
} {
  return error instanceof Error;
}
