import { basename, join } from 'node:path';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import {
  createMcpServerSurface,
  DEFAULT_SETUP_MCP_TOOL_FAMILIES,
} from '@defai.digital/mcp-server';
import {
  AX_MCP_ARGS,
  AX_MCP_BASE_PATH_ENV_VAR,
  AX_MCP_COMMAND,
  AX_MCP_SERVER_ID,
  buildAxMcpRuntimeConfig,
} from '../ax-mcp-config.js';
import {
  formatSurfaceSection,
  getProductSurfaceSummaryData,
} from '../product-surface-summary.js';
import type { SetupWorkspaceResult } from './setup.js';
import {
  detectProviderClients,
  PROVIDER_CLIENT_COMMANDS,
  PROVIDER_CLIENT_IDS,
  type ProviderClientId,
} from '../utils/provider-detection.js';
import {
  buildClaudeHookScript,
  buildCodexConfigSnippet,
  buildProviderReport,
  claudeSettingsSchema,
  createMcpServerRegistration,
  createStandardMcpConfig,
  readJsonFile,
  writeFileIfMissingOrForced,
  writeJsonFile,
  writeJsonMcpConfig,
  type ClaudeSettings,
} from './project-bootstrap-support.js';
const PRODUCT_SURFACE = getProductSurfaceSummaryData();
type ProviderId = ProviderClientId;

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
  const availableTools = new Set(mcp.listTools());
  const tools = [...DEFAULT_SETUP_MCP_TOOL_FAMILIES].filter((tool) => availableTools.has(tool));
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
  await writeJsonFile(mcpConfigPath, {
    ...buildAxMcpRuntimeConfig(basePath),
    tools,
    generatedBy: 'ax setup',
  });

  await mkdir(providersDir, { recursive: true });

  const detection = detectAvailableProviders();
  const providerReports = await buildProviderReports(basePath, providersDir, detection, flags, tools);

  await writeJsonFile(providerSummaryPath, {
    generatedBy: 'ax setup',
    basePath,
    providers: providerReports,
  });

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

async function buildProviderReports(
  basePath: string,
  providersDir: string,
  detection: Record<ProviderId, boolean>,
  flags: ProjectBootstrapFlags,
  tools: string[],
): Promise<ProviderIntegrationReport[]> {
  const reports: ProviderIntegrationReport[] = [];

  if (!flags.skipMcp && !flags.skipClaudeCode) {
    const claudePaths = await writeClaudeCodeIntegration(basePath, tools);
    reports.push(buildProviderReport('claude', PROVIDER_CLIENT_COMMANDS, detection, true, claudePaths, [
      'Project-level Claude Code MCP registration and local hooks were generated.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-claude-code';
    reports.push(buildProviderReport('claude', PROVIDER_CLIENT_COMMANDS, detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipCursor) {
    const cursorPath = await writeJsonMcpConfig(
      join(basePath, '.cursor', 'mcp.json'),
      createStandardMcpConfig(basePath, {
        serverId: AX_MCP_SERVER_ID,
        command: AX_MCP_COMMAND,
        args: AX_MCP_ARGS,
        basePathEnvVar: AX_MCP_BASE_PATH_ENV_VAR,
      }),
    );
    reports.push(buildProviderReport('cursor', PROVIDER_CLIENT_COMMANDS, detection, true, [cursorPath], [
      'Cursor can discover the project-local MCP config automatically.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-cursor';
    reports.push(buildProviderReport('cursor', PROVIDER_CLIENT_COMMANDS, detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipGemini) {
    const geminiPath = await writeJsonMcpConfig(
      join(basePath, '.gemini', 'settings.json'),
      createStandardMcpConfig(basePath, {
        serverId: AX_MCP_SERVER_ID,
        command: AX_MCP_COMMAND,
        args: AX_MCP_ARGS,
        basePathEnvVar: AX_MCP_BASE_PATH_ENV_VAR,
        transport: 'stdio',
      }),
    );
    reports.push(buildProviderReport('gemini', PROVIDER_CLIENT_COMMANDS, detection, true, [geminiPath], [
      'Gemini project settings were updated with an mcpServers entry.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-gemini';
    reports.push(buildProviderReport('gemini', PROVIDER_CLIENT_COMMANDS, detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipGrok) {
    const grokPath = await writeJsonMcpConfig(join(basePath, '.ax-grok', 'settings.json'), {
      mcpServers: {
        [AX_MCP_SERVER_ID]: createMcpServerRegistration(basePath, {
          command: AX_MCP_COMMAND,
          args: AX_MCP_ARGS,
          basePathEnvVar: AX_MCP_BASE_PATH_ENV_VAR,
          transport: 'stdio',
        }),
      },
    });
    reports.push(buildProviderReport('grok', PROVIDER_CLIENT_COMMANDS, detection, true, [grokPath], [
      'Grok uses the ax-wrapper project settings file.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-grok';
    reports.push(buildProviderReport('grok', PROVIDER_CLIENT_COMMANDS, detection, false, [], [`Skipped by ${reason}.`]));
  }

  if (!flags.skipMcp && !flags.skipCodex) {
    const codexSnippetPath = join(providersDir, 'codex.config.toml');
    await writeFile(codexSnippetPath, buildCodexConfigSnippet(basePath, AX_MCP_BASE_PATH_ENV_VAR), 'utf8');
    reports.push(buildProviderReport('codex', PROVIDER_CLIENT_COMMANDS, detection, true, [codexSnippetPath], [
      'Codex still needs the snippet copied into ~/.codex/config.toml for global registration.',
    ]));
  } else {
    const reason = flags.skipMcp ? '--skip-mcp' : '--skip-codex';
    reports.push(buildProviderReport('codex', PROVIDER_CLIENT_COMMANDS, detection, false, [], [`Skipped by ${reason}.`]));
  }

  return reports;
}

async function writeClaudeCodeIntegration(basePath: string, tools: string[]): Promise<string[]> {
  const claudeMcpPath = await writeJsonMcpConfig(join(basePath, '.mcp.json'), {
    mcpServers: {
      [AX_MCP_SERVER_ID]: createMcpServerRegistration(basePath, {
        command: AX_MCP_COMMAND,
        args: AX_MCP_ARGS,
        basePathEnvVar: AX_MCP_BASE_PATH_ENV_VAR,
        type: 'stdio',
      }),
    },
  });

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

function buildAgentsMd(projectName: string): string {
  return [
    `# ${projectName} Agent Instructions`,
    '',
    'This repository is configured for AutomatosX v14.',
    '',
    ...formatSurfaceSection('Default entry paths', PRODUCT_SURFACE.defaultEntryPaths, { bullet: true }),
    '',
    ...formatSurfaceSection('Stable support commands', PRODUCT_SURFACE.stableSupportCommands, { bullet: true }),
    '',
    ...formatSurfaceSection('Advanced commands', PRODUCT_SURFACE.advancedCommands, { bullet: true }),
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
