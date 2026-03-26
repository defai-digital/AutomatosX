import { basename, join } from 'node:path';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createMcpServerSurface, MCP_BASE_PATH_ENV_VAR } from '@defai.digital/mcp-server';
import { z } from 'zod';
import { DEFAULT_ENTRY_PATH_COMMANDS, RETAINED_HIGH_VALUE_COMMANDS } from '../command-metadata.js';
import { parseJsonObjectString } from '../utils/validation.js';
import type { SetupWorkspaceResult } from './setup.js';
import {
  detectProviderClients,
  PROVIDER_CLIENT_COMMANDS,
  PROVIDER_CLIENT_IDS,
  type ProviderClientId,
} from '../utils/provider-detection.js';

const MCP_SERVER_ID = 'automatosx';
const MCP_COMMAND = 'ax';
const MCP_ARGS = ['mcp', 'serve'] as const;
type ProviderId = ProviderClientId;

const jsonStringRecordSchema = z.record(z.string(), z.string());
const projectMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()),
    env: jsonStringRecordSchema.optional(),
    type: z.string().optional(),
  })).optional(),
});
const claudeSettingsSchema = z.object({
  permissions: z.object({
    allow: z.array(z.string()).optional(),
  }).optional(),
  hooks: z.record(z.string(), z.array(z.object({
    hooks: z.array(z.object({
      type: z.literal('command'),
      command: z.string(),
      timeout: z.number(),
    })),
    matcher: z.string().optional(),
  }))).optional(),
});
const jsonMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()),
    env: jsonStringRecordSchema.optional(),
    transport: z.string().optional(),
  })).optional(),
});

export interface ProjectBootstrapFlags {
  force: boolean;
  skipMcp: boolean;
  skipClaudeCode: boolean;
  skipCursor: boolean;
  skipGemini: boolean;
  skipCodex: boolean;
  skipGrok: boolean;
}

export interface ProviderIntegrationReport {
  providerId: ProviderId;
  cli: string;
  installed: boolean;
  enabled: boolean;
  paths: string[];
  notes: string[];
}

export interface ProjectBootstrapResult {
  agentsMdPath: string;
  agentsMdWritten: boolean;
  conventionsPath: string;
  conventionsWritten: boolean;
  rulesPath: string;
  rulesWritten: boolean;
  mcpConfigPath: string;
  providerSummaryPath: string;
  providers: ProviderIntegrationReport[];
  tools: string[];
}

interface ProjectMcpConfig {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    type?: string;
  }>;
}

interface ClaudeSettings {
  permissions?: {
    allow?: string[];
  };
  hooks?: Record<string, Array<{
    hooks: Array<{
      type: 'command';
      command: string;
      timeout: number;
    }>;
    matcher?: string;
  }>>;
}

interface JsonMcpConfig {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    transport?: string;
  }>;
}

const FLAG_MAP = new Map<string, keyof ProjectBootstrapFlags>([
  ['--force', 'force'],
  ['-f', 'force'],
  ['-y', 'force'],
  ['--skip-mcp', 'skipMcp'],
  ['--skip-claude-code', 'skipClaudeCode'],
  ['--skip-cursor', 'skipCursor'],
  ['--skip-gemini', 'skipGemini'],
  ['--skip-codex', 'skipCodex'],
  ['--skip-grok', 'skipGrok'],
]);

export function parseProjectBootstrapFlags(
  args: string[],
  commandName: string,
): { flags: ProjectBootstrapFlags; error?: string } {
  const flags: ProjectBootstrapFlags = {
    force: false,
    skipMcp: false,
    skipClaudeCode: false,
    skipCursor: false,
    skipGemini: false,
    skipCodex: false,
    skipGrok: false,
  };

  for (const arg of args) {
    if (!arg.startsWith('-')) {
      return { flags, error: `${capitalize(commandName)} does not accept positional arguments: ${arg}` };
    }
    const key = FLAG_MAP.get(arg);
    if (key === undefined) {
      return { flags, error: `Unknown ${commandName} flag: ${arg}` };
    }
    flags[key] = true;
  }

  return { flags };
}

export async function bootstrapProjectWorkspace(
  basePath: string,
  workspace: SetupWorkspaceResult,
  flags: ProjectBootstrapFlags,
): Promise<ProjectBootstrapResult> {
  const projectName = basename(basePath);
  const mcp = createMcpServerSurface({ basePath });
  const tools = mcp.listTools();
  const agentsMdPath = join(basePath, 'AGENTS.md');
  const conventionsPath = join(workspace.contextDir, 'conventions.md');
  const rulesPath = join(workspace.contextDir, 'rules.md');
  const mcpConfigPath = join(workspace.automatosxDir, 'mcp.json');
  const providersDir = join(workspace.automatosxDir, 'providers');
  const providerSummaryPath = join(workspace.automatosxDir, 'providers.json');

  const agentsMdWritten = await writeFileIfMissingOrForced(
    agentsMdPath,
    buildAgentsMd(projectName),
    flags.force,
  );
  const conventionsWritten = await writeFileIfMissingOrForced(
    conventionsPath,
    buildConventionsTemplate(projectName),
    flags.force,
  );
  const rulesWritten = await writeFileIfMissingOrForced(
    rulesPath,
    buildRulesTemplate(),
    flags.force,
  );
  await writeFile(mcpConfigPath, `${JSON.stringify({
    serverId: MCP_SERVER_ID,
    transport: 'stdio',
    command: MCP_COMMAND,
    args: [...MCP_ARGS],
    env: createMcpServerEnv(basePath),
    tools,
    generatedBy: 'ax setup',
  }, null, 2)}\n`, 'utf8');

  await mkdir(providersDir, { recursive: true });

  const detection = detectAvailableProviders();
  const providerReports: ProviderIntegrationReport[] = [];

  if (!flags.skipMcp && !flags.skipClaudeCode) {
    const claudePaths = await writeClaudeCodeIntegration(basePath, tools);
    providerReports.push(buildProviderReport('claude', detection, true, claudePaths, [
      'Project-level Claude Code MCP registration and local hooks were generated.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-claude-code';
    providerReports.push(buildProviderReport('claude', detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipCursor) {
    const cursorPath = await writeJsonMcpConfig(join(basePath, '.cursor', 'mcp.json'), createStandardMcpConfig(basePath));
    providerReports.push(buildProviderReport('cursor', detection, true, [cursorPath], [
      'Cursor can discover the project-local MCP config automatically.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-cursor';
    providerReports.push(buildProviderReport('cursor', detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipGemini) {
    const geminiPath = await writeJsonMcpConfig(
      join(basePath, '.gemini', 'settings.json'),
      createStandardMcpConfig(basePath, { transport: 'stdio' }),
    );
    providerReports.push(buildProviderReport('gemini', detection, true, [geminiPath], [
      'Gemini project settings were updated with an mcpServers entry.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-gemini';
    providerReports.push(buildProviderReport('gemini', detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipGrok) {
    const grokPath = await writeJsonMcpConfig(join(basePath, '.ax-grok', 'settings.json'), {
      mcpServers: {
        [MCP_SERVER_ID]: createMcpServerRegistration(basePath, { transport: 'stdio' }),
      },
    });
    providerReports.push(buildProviderReport('grok', detection, true, [grokPath], [
      'Grok uses the ax-wrapper project settings file.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-grok';
    providerReports.push(buildProviderReport('grok', detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipCodex) {
    const codexSnippetPath = join(providersDir, 'codex.config.toml');
    await writeFile(codexSnippetPath, buildCodexConfigSnippet(basePath), 'utf8');
    providerReports.push(buildProviderReport('codex', detection, true, [codexSnippetPath], [
      'Codex still needs the snippet copied into ~/.codex/config.toml for global registration.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-codex';
    providerReports.push(buildProviderReport('codex', detection, false, [], [`Skipped by ${reason}.`]));
  }

  await writeFile(providerSummaryPath, `${JSON.stringify({
    generatedBy: 'ax setup',
    basePath,
    providers: providerReports,
  }, null, 2)}\n`, 'utf8');

  return {
    agentsMdPath,
    agentsMdWritten,
    conventionsPath,
    conventionsWritten,
    rulesPath,
    rulesWritten,
    mcpConfigPath,
    providerSummaryPath,
    providers: providerReports,
    tools,
  };
}

function detectAvailableProviders(): Record<ProviderId, boolean> {
  return detectProviderClients() as Record<ProviderId, boolean>;
}

async function writeClaudeCodeIntegration(basePath: string, tools: string[]): Promise<string[]> {
  const claudeMcpPath = await writeJsonMcpConfig(
    join(basePath, '.mcp.json'),
    {
      mcpServers: {
        [MCP_SERVER_ID]: createMcpServerRegistration(basePath, { type: 'stdio' }),
      },
    },
  );

  const settingsPath = join(basePath, '.claude', 'settings.json');
  const existingSettings = await readJsonFile(settingsPath, claudeSettingsSchema) ?? {};
  const allow = new Set(existingSettings.permissions?.allow ?? []);
  allow.add('mcp__automatosx__*');
  for (const toolName of tools) {
    allow.add(`mcp__automatosx__${toolName.replace(/[.-]/g, '_')}`);
  }

  const settings: ClaudeSettings = {
    ...existingSettings,
    permissions: {
      ...(existingSettings.permissions ?? {}),
      allow: Array.from(allow).sort(),
    },
    hooks: {
      ...(existingSettings.hooks ?? {}),
      SessionStart: [
        {
          hooks: [{ type: 'command', command: '.claude/hooks/session-start.sh', timeout: 15 }],
        },
      ],
      SessionEnd: [
        {
          hooks: [{ type: 'command', command: '.claude/hooks/session-end.sh', timeout: 15 }],
        },
      ],
    },
  };
  await writeJsonFile(settingsPath, settings);

  const hooksDir = join(basePath, '.claude', 'hooks');
  await mkdir(hooksDir, { recursive: true });
  const sessionStartPath = join(hooksDir, 'session-start.sh');
  const sessionEndPath = join(hooksDir, 'session-end.sh');
  await writeFile(sessionStartPath, buildClaudeHookScript('SessionStart'), 'utf8');
  await writeFile(sessionEndPath, buildClaudeHookScript('SessionEnd'), 'utf8');
  await chmod(sessionStartPath, 0o755);
  await chmod(sessionEndPath, 0o755);

  return [claudeMcpPath, settingsPath, sessionStartPath, sessionEndPath];
}

function buildProviderReport(
  providerId: ProviderId,
  detection: Record<ProviderId, boolean>,
  enabled: boolean,
  paths: string[],
  notes: string[],
): ProviderIntegrationReport {
  return {
    providerId,
    cli: PROVIDER_CLIENT_COMMANDS[providerId],
    installed: detection[providerId],
    enabled,
    paths,
    notes,
  };
}

function createMcpServerEnv(basePath: string): Record<string, string> {
  return {
    [MCP_BASE_PATH_ENV_VAR]: basePath,
  };
}

function createMcpServerRegistration(
  basePath: string,
  extra: { transport?: string; type?: string } = {},
): NonNullable<JsonMcpConfig['mcpServers']>[string] & { type?: string } {
  return {
    command: MCP_COMMAND,
    args: [...MCP_ARGS],
    env: createMcpServerEnv(basePath),
    ...(extra.transport === undefined ? {} : { transport: extra.transport }),
    ...(extra.type === undefined ? {} : { type: extra.type }),
  };
}

function createStandardMcpConfig(basePath: string, extra: { transport?: string } = {}): JsonMcpConfig {
  return {
    mcpServers: {
      [MCP_SERVER_ID]: createMcpServerRegistration(basePath, extra),
    },
  };
}

async function writeJsonMcpConfig(path: string, value: ProjectMcpConfig | JsonMcpConfig): Promise<string> {
  const existing = await readJsonFile(path, z.union([projectMcpConfigSchema, jsonMcpConfigSchema])) ?? {};
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      ...(value.mcpServers ?? {}),
    },
  };
  await writeJsonFile(path, merged);
  return path;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeFileIfMissingOrForced(path: string, content: string, force: boolean): Promise<boolean> {
  if (!force) {
    try {
      await access(path);
      return false;
    } catch {
      // continue
    }
  }
  await writeFile(path, content, 'utf8');
  return true;
}

async function readJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseJsonObjectString(raw);
    if (parsed.error !== undefined) {
      return undefined;
    }
    const result = schema.safeParse(parsed.value);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function buildClaudeHookScript(eventName: 'SessionStart' | 'SessionEnd'): string {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'TRACE_DIR="${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"',
    'mkdir -p "$TRACE_DIR"',
    'printf \'{"event":"%s","ts":"%s"}\\n\' '
      + `"${eventName}" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$TRACE_DIR/claude-hooks.jsonl"`,
    'exit 0',
    '',
  ].join('\n');
}

function buildCodexConfigSnippet(basePath: string): string {
  return [
    '# Copy this snippet into ~/.codex/config.toml for Codex CLI global MCP registration.',
    '[mcp_servers.automatosx]',
    'command = "ax"',
    'args = ["mcp", "serve"]',
    `env = { ${MCP_BASE_PATH_ENV_VAR} = ${JSON.stringify(basePath)} }`,
    'startup_timeout_sec = 30',
    'tool_timeout_sec = 60',
    '',
  ].join('\n');
}

function buildAgentsMd(projectName: string): string {
  return [
    `# ${projectName} Agent Instructions`,
    '',
    'This repository is configured for AutomatosX v14.',
    '',
    'Default entry paths:',
    ...DEFAULT_ENTRY_PATH_COMMANDS.map((usage) => `- ${usage}`),
    '',
    'Retained high-value commands:',
    ...RETAINED_HIGH_VALUE_COMMANDS.map((usage) => `- ${usage}`),
    '',
    'Project instruction and context files:',
    '- AGENTS.md',
    '- .automatosx/config.json',
    '- .automatosx/context/conventions.md',
    '- .automatosx/context/rules.md',
    '- .automatosx/mcp.json',
    '',
  ].join('\n');
}

function buildConventionsTemplate(projectName: string): string {
  return [
    `# ${projectName} Conventions`,
    '',
    '- Architecture constraints:',
    '- Code review expectations:',
    '- Testing requirements:',
    '- Release and rollout constraints:',
    '',
  ].join('\n');
}

function buildRulesTemplate(): string {
  return [
    '# AutomatosX Rules',
    '',
    '- Prefer first-class workflow commands before ax run.',
    '- Persist traceable outputs under .automatosx/workflows/.',
    '- Keep release, QA, and audit evidence durable and reviewable.',
    '',
  ].join('\n');
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}
