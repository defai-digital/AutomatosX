import { access, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { writePrettyJsonFile } from '../json-file-write.js';
import { parseJsonObjectString } from '../utils/validation.js';

export const jsonStringRecordSchema = z.record(z.string(), z.string());
export const projectMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()),
    env: jsonStringRecordSchema.optional(),
    type: z.string().optional(),
  })).optional(),
});
export const claudeSettingsSchema = z.object({
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
export const jsonMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()),
    env: jsonStringRecordSchema.optional(),
    transport: z.string().optional(),
  })).optional(),
});

export interface ProjectMcpConfig {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    type?: string;
  }>;
}

export interface ClaudeSettings {
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

export interface JsonMcpConfig {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    transport?: string;
  }>;
}

export function buildProviderReport<ProviderId extends string>(
  providerId: ProviderId,
  cliCommandMap: Record<ProviderId, string>,
  detection: Record<ProviderId, boolean>,
  enabled: boolean,
  paths: string[],
  notes: string[],
): {
  providerId: ProviderId;
  cli: string;
  installed: boolean;
  enabled: boolean;
  paths: string[];
  notes: string[];
} {
  return {
    providerId,
    cli: cliCommandMap[providerId],
    installed: detection[providerId],
    enabled,
    paths,
    notes,
  };
}

export function createMcpServerEnv(basePath: string, basePathEnvVar: string): Record<string, string> {
  return {
    [basePathEnvVar]: basePath,
  };
}

export function createMcpServerRegistration(
  basePath: string,
  config: {
    command: string;
    args: readonly string[];
    basePathEnvVar: string;
    transport?: string;
    type?: string;
  },
): NonNullable<JsonMcpConfig['mcpServers']>[string] & { type?: string } {
  return {
    command: config.command,
    args: [...config.args],
    env: createMcpServerEnv(basePath, config.basePathEnvVar),
    ...(config.transport === undefined ? {} : { transport: config.transport }),
    ...(config.type === undefined ? {} : { type: config.type }),
  };
}

export function createStandardMcpConfig(
  basePath: string,
  config: {
    serverId: string;
    command: string;
    args: readonly string[];
    basePathEnvVar: string;
    transport?: string;
  },
): JsonMcpConfig {
  return {
    mcpServers: {
      [config.serverId]: createMcpServerRegistration(basePath, config),
    },
  };
}

export async function writeJsonMcpConfig(path: string, value: ProjectMcpConfig | JsonMcpConfig): Promise<string> {
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

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writePrettyJsonFile(path, value);
}

export async function writeFileIfMissingOrForced(path: string, content: string, force: boolean): Promise<boolean> {
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

export async function readJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T | undefined> {
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

export function buildClaudeHookScript(eventName: 'SessionStart' | 'SessionEnd'): string {
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

export function buildCodexConfigSnippet(basePath: string, basePathEnvVar: string): string {
  return [
    '# Copy this snippet into ~/.codex/config.toml for Codex CLI global MCP registration.',
    '[mcp_servers.automatosx]',
    'command = "ax"',
    'args = ["mcp", "serve"]',
    `env = { ${basePathEnvVar} = ${JSON.stringify(basePath)} }`,
    'startup_timeout_sec = 30',
    'tool_timeout_sec = 60',
    '',
  ].join('\n');
}
