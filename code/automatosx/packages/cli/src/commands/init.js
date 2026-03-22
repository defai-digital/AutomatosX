import { basename, join } from 'node:path';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createMcpServerSurface } from '@defai.digital/mcp-server';
import { failure, success } from '../utils/formatters.js';
import { ensureWorkspaceSetup } from './setup.js';
import { detectProviderClients, PROVIDER_CLIENT_COMMANDS, PROVIDER_CLIENT_IDS, } from '../utils/provider-detection.js';
const MCP_SERVER_ID = 'automatosx';
const MCP_COMMAND = 'ax';
const MCP_ARGS = ['mcp', 'serve'];
const INIT_FLAG_MAP = new Map([
    ['--skip-mcp', 'skipMcp'],
    ['--skip-claude-code', 'skipClaudeCode'],
    ['--skip-cursor', 'skipCursor'],
    ['--skip-gemini', 'skipGemini'],
    ['--skip-codex', 'skipCodex'],
    ['--skip-grok', 'skipGrok'],
]);
export async function initCommand(args, options) {
    const parsedFlags = parseInitFlags(args);
    if (parsedFlags.error !== undefined) {
        return failure(parsedFlags.error);
    }
    const flags = parsedFlags.flags;
    const basePath = options.outputDir ?? process.cwd();
    const setup = await ensureWorkspaceSetup(basePath, options.provider);
    const projectName = basename(basePath);
    const mcp = createMcpServerSurface({ basePath });
    const tools = mcp.listTools();
    const axMdPath = join(basePath, 'AX.md');
    const conventionsPath = join(setup.contextDir, 'conventions.md');
    const rulesPath = join(setup.contextDir, 'rules.md');
    const mcpConfigPath = join(setup.automatosxDir, 'mcp.json');
    const providersDir = join(setup.automatosxDir, 'providers');
    const providerSummaryPath = join(setup.automatosxDir, 'providers.json');
    const detection = detectAvailableProviders();
    const providerReports = [];
    await writeFile(axMdPath, buildAxMd(projectName), 'utf8');
    await writeFile(conventionsPath, buildConventionsTemplate(projectName), 'utf8');
    await writeFile(rulesPath, buildRulesTemplate(), 'utf8');
    await writeFile(mcpConfigPath, `${JSON.stringify({
        serverId: MCP_SERVER_ID,
        transport: 'stdio',
        command: MCP_COMMAND,
        args: [...MCP_ARGS],
        tools,
        generatedBy: 'ax init',
    }, null, 2)}\n`, 'utf8');
    await mkdir(providersDir, { recursive: true });
    if (!flags.skipMcp && !flags.skipClaudeCode) {
        const claudePaths = await writeClaudeCodeIntegration(basePath, tools);
        providerReports.push(buildProviderReport('claude', detection, true, claudePaths, [
            'Project-level Claude Code MCP registration and local hooks were generated.',
        ]));
    }
    else {
        providerReports.push(buildProviderReport('claude', detection, false, [], [
            flags.skipMcp ? 'Skipped by --skip-mcp.' : 'Skipped by --skip-claude-code.',
        ]));
    }
    if (!flags.skipMcp && !flags.skipCursor) {
        const cursorPath = await writeJsonMcpConfig(join(basePath, '.cursor', 'mcp.json'), createStandardMcpConfig());
        providerReports.push(buildProviderReport('cursor', detection, true, [cursorPath], [
            'Cursor can discover the project-local MCP config automatically.',
        ]));
    }
    else {
        providerReports.push(buildProviderReport('cursor', detection, false, [], [
            flags.skipMcp ? 'Skipped by --skip-mcp.' : 'Skipped by --skip-cursor.',
        ]));
    }
    if (!flags.skipMcp && !flags.skipGemini) {
        const geminiPath = await writeJsonMcpConfig(join(basePath, '.gemini', 'settings.json'), createStandardMcpConfig({ transport: 'stdio' }));
        providerReports.push(buildProviderReport('gemini', detection, true, [geminiPath], [
            'Gemini project settings were updated with an mcpServers entry.',
        ]));
    }
    else {
        providerReports.push(buildProviderReport('gemini', detection, false, [], [
            flags.skipMcp ? 'Skipped by --skip-mcp.' : 'Skipped by --skip-gemini.',
        ]));
    }
    if (!flags.skipMcp && !flags.skipGrok) {
        const grokPath = await writeJsonMcpConfig(join(basePath, '.ax-grok', 'settings.json'), {
            mcpServers: {
                [MCP_SERVER_ID]: {
                    command: MCP_COMMAND,
                    args: [...MCP_ARGS],
                    env: {},
                    transport: 'stdio',
                },
            },
        });
        providerReports.push(buildProviderReport('grok', detection, true, [grokPath], [
            'Grok uses the ax-wrapper project settings file.',
        ]));
    }
    else {
        providerReports.push(buildProviderReport('grok', detection, false, [], [
            flags.skipMcp ? 'Skipped by --skip-mcp.' : 'Skipped by --skip-grok.',
        ]));
    }
    if (!flags.skipMcp && !flags.skipCodex) {
        const codexSnippetPath = join(providersDir, 'codex.config.toml');
        await writeFile(codexSnippetPath, buildCodexConfigSnippet(), 'utf8');
        providerReports.push(buildProviderReport('codex', detection, true, [codexSnippetPath], [
            'Codex still needs the snippet copied into ~/.codex/config.toml for global registration.',
        ]));
    }
    else {
        providerReports.push(buildProviderReport('codex', detection, false, [], [
            flags.skipMcp ? 'Skipped by --skip-mcp.' : 'Skipped by --skip-codex.',
        ]));
    }
    await writeFile(providerSummaryPath, `${JSON.stringify({
        generatedBy: 'ax init',
        basePath,
        providers: providerReports,
    }, null, 2)}\n`, 'utf8');
    const enabledProviders = providerReports.filter((entry) => entry.enabled).map((entry) => entry.providerId);
    return success([
        `Project initialized for AutomatosX in ${basePath}.`,
        'Created AX.md, project context templates, and local MCP tool metadata.',
        enabledProviders.length > 0
            ? `Wrote provider integration files for: ${enabledProviders.join(', ')}.`
            : 'Provider integration file generation was skipped.',
        'Saved provider detection and registration state to .automatosx/providers.json.',
    ].join('\n'), {
        ...setup,
        axMdPath,
        conventionsPath,
        rulesPath,
        mcpConfigPath,
        tools,
        providerSummaryPath,
        providers: providerReports,
    });
}
function parseInitFlags(args) {
    const flags = {
        skipMcp: false,
        skipClaudeCode: false,
        skipCursor: false,
        skipGemini: false,
        skipCodex: false,
        skipGrok: false,
    };
    for (const arg of args) {
        if (!arg.startsWith('-')) {
            return { flags, error: `Init does not accept positional arguments: ${arg}` };
        }
        const key = INIT_FLAG_MAP.get(arg);
        if (key === undefined) {
            return { flags, error: `Unknown init flag: ${arg}` };
        }
        flags[key] = true;
    }
    return { flags };
}
function detectAvailableProviders() {
    const override = process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
    if (typeof override === 'string' && override.trim().length > 0) {
        const available = new Set(override
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => PROVIDER_CLIENT_IDS.includes(entry)));
        return Object.fromEntries(PROVIDER_CLIENT_IDS.map((providerId) => [providerId, available.has(providerId)]));
    }
    return detectProviderClients();
}
async function writeClaudeCodeIntegration(basePath, tools) {
    const claudeMcpPath = await writeJsonMcpConfig(join(basePath, '.mcp.json'), {
        mcpServers: {
            [MCP_SERVER_ID]: {
                type: 'stdio',
                command: MCP_COMMAND,
                args: [...MCP_ARGS],
                env: {},
            },
        },
    });
    const settingsPath = join(basePath, '.claude', 'settings.json');
    const existingSettings = await readJsonFile(settingsPath) ?? {};
    const allow = new Set(existingSettings.permissions?.allow ?? []);
    allow.add('mcp__automatosx__*');
    for (const toolName of tools) {
        allow.add(`mcp__automatosx__${toolName.replace(/[.-]/g, '_')}`);
    }
    const settings = {
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
function buildProviderReport(providerId, detection, enabled, paths, notes) {
    return {
        providerId,
        cli: PROVIDER_CLIENT_COMMANDS[providerId],
        installed: detection[providerId],
        enabled,
        paths,
        notes,
    };
}
function createStandardMcpConfig(extra = {}) {
    return {
        mcpServers: {
            [MCP_SERVER_ID]: {
                command: MCP_COMMAND,
                args: [...MCP_ARGS],
                env: {},
                ...(extra.transport === undefined ? {} : { transport: extra.transport }),
            },
        },
    };
}
async function writeJsonMcpConfig(path, value) {
    const existing = await readJsonFile(path) ?? {};
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
async function writeJsonFile(path, value) {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
async function readJsonFile(path) {
    try {
        const raw = await readFile(path, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
function buildClaudeHookScript(eventName) {
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
function buildCodexConfigSnippet() {
    return [
        '# Copy this snippet into ~/.codex/config.toml for Codex CLI global MCP registration.',
        '[mcp_servers.automatosx]',
        'command = "ax"',
        'args = ["mcp", "serve"]',
        'startup_timeout_sec = 30',
        'tool_timeout_sec = 60',
        '',
    ].join('\n');
}
function buildAxMd(projectName) {
    return [
        `# ${projectName} AutomatosX Context`,
        '',
        'This repository is configured for AutomatosX v14.',
        '',
        'Default entry paths:',
        '- ax setup',
        '- ax init',
        '- ax ship --scope <area>',
        '- ax architect --request "<requirement>"',
        '- ax audit --scope <path-or-area>',
        '- ax qa --target <service-or-feature> --url <url>',
        '- ax release --release-version <version>',
        '',
        'Retained high-value commands:',
        '- ax list',
        '- ax trace [trace-id]',
        '- ax discuss "<topic>"',
        '',
        'Project context files:',
        '- .automatosx/config.json',
        '- .automatosx/context/conventions.md',
        '- .automatosx/context/rules.md',
        '- .automatosx/mcp.json',
        '',
    ].join('\n');
}
function buildConventionsTemplate(projectName) {
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
function buildRulesTemplate() {
    return [
        '# AutomatosX Rules',
        '',
        '- Prefer first-class workflow commands before ax run.',
        '- Persist traceable outputs under .automatosx/workflows/.',
        '- Keep release, QA, and audit evidence durable and reviewable.',
        '',
    ].join('\n');
}
