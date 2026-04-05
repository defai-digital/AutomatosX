import { MCP_BASE_PATH_ENV_VAR } from '@defai.digital/mcp-server';

export const AX_MCP_SERVER_ID = 'automatosx';
export const AX_MCP_COMMAND = 'ax';
export const AX_MCP_ARGS = ['mcp', 'serve'] as const;
export const AX_MCP_BASE_PATH_ENV_VAR = MCP_BASE_PATH_ENV_VAR;

export function buildAxMcpEnvironment(basePath: string): Record<string, string> {
  return {
    [AX_MCP_BASE_PATH_ENV_VAR]: basePath,
  };
}

export function buildAxMcpRuntimeConfig(basePath: string): {
  serverId: string;
  transport: 'stdio';
  command: string;
  args: readonly string[];
  env: Record<string, string>;
} {
  return {
    serverId: AX_MCP_SERVER_ID,
    transport: 'stdio',
    command: AX_MCP_COMMAND,
    args: AX_MCP_ARGS,
    env: buildAxMcpEnvironment(basePath),
  };
}
