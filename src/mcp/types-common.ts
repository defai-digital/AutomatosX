/**
 * Common MCP Types - Shared across all providers
 *
 * Defines universal types for Model Context Protocol (MCP) support
 * that work consistently across Claude, Gemini, OpenAI, and Grok providers.
 *
 * @module mcp/types-common
 */

/**
 * MCP Server Configuration
 *
 * Universal configuration for MCP servers that can be used by any provider.
 * Supports both npm packages and custom executables.
 */
export interface MCPServerConfig {
  /** Unique name for this MCP server */
  name: string;

  /** Command to execute (e.g., 'npx', 'node', '/path/to/binary') */
  command: string;

  /** Command-line arguments */
  args: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Working directory for the server process */
  cwd?: string;

  /** Transport protocol (default: 'stdio') */
  transport?: 'stdio' | 'http' | 'websocket';

  /** Whether this server is enabled (default: true) */
  enabled?: boolean;

  /** Tags for categorization */
  tags?: string[];

  /** Description of what this server provides */
  description?: string;
}

/**
 * Universal MCP Configuration
 *
 * This schema works for ALL providers (Claude, Gemini, OpenAI, Grok).
 * Providers can extend this with provider-specific options.
 */
export interface UniversalMCPConfig {
  /** Whether MCP is enabled for this provider */
  enabled: boolean;

  /** List of MCP servers to spawn */
  servers: MCPServerConfig[];

  /** Auto-discovery settings */
  discovery?: {
    /** Auto-discover installed MCP servers */
    enabled?: boolean;

    /** Paths to search for MCP servers */
    searchPaths?: string[];

    /** Package prefixes to include (e.g., '@modelcontextprotocol/server-*') */
    packagePrefixes?: string[];
  };

  /** Security settings */
  security?: {
    /** Filesystem restrictions */
    filesystem?: {
      allowedPaths?: string[];
      deniedPaths?: string[];
    };

    /** Network restrictions */
    network?: {
      allowedDomains?: string[];
      deniedDomains?: string[];
    };

    /** Maximum resource limits */
    limits?: {
      maxServers?: number;
      maxMemoryPerServer?: number; // MB
      maxCpuPerServer?: number; // percentage
    };
  };

  /** Health check settings */
  healthCheck?: {
    /** Enable health checks */
    enabled?: boolean;

    /** Interval in milliseconds */
    intervalMs?: number;

    /** Timeout for health check */
    timeoutMs?: number;

    /** Restart on failure */
    restartOnFailure?: boolean;
  };

  /** Logging settings */
  logging?: {
    /** Log MCP server output */
    logServerOutput?: boolean;

    /** Log level for MCP operations */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * MCP Server Status
 */
export interface MCPServerStatus {
  /** Server name */
  name: string;

  /** Whether server is currently running */
  running: boolean;

  /** Process ID (if running) */
  pid?: number;

  /** Start time */
  startTime?: Date;

  /** Last health check time */
  lastHealthCheck?: Date;

  /** Health status */
  healthy?: boolean;

  /** Error if server failed */
  error?: Error;

  /** Tools provided by this server */
  tools?: MCPToolInfo[];
}

/**
 * MCP Tool Information
 */
export interface MCPToolInfo {
  /** Tool name */
  name: string;

  /** Tool description */
  description?: string;

  /** Input schema (JSON Schema) */
  inputSchema?: object;

  /** Server providing this tool */
  serverName: string;
}

/**
 * MCP Server Process Handle
 */
export interface MCPServerProcess {
  /** Server configuration */
  config: MCPServerConfig;

  /** Node.js child process */
  process: any; // ChildProcess

  /** Start time */
  startTime: Date;

  /** Whether process is running */
  running: boolean;

  /** Error if failed to start */
  error?: Error;

  /** Discovered tools */
  tools?: MCPToolInfo[];
}

/**
 * MCP Registry Entry
 */
export interface MCPRegistryEntry {
  /** Package name */
  package: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Command to run */
  command: string;

  /** Default arguments */
  defaultArgs: string[];

  /** Required environment variables */
  requiredEnv?: string[];

  /** Whether it's installed */
  installed: boolean;

  /** Installation path (if installed) */
  installPath?: string;
}

/**
 * MCP Discovery Result
 */
export interface MCPDiscoveryResult {
  /** Total servers found */
  total: number;

  /** Installed servers */
  installed: MCPRegistryEntry[];

  /** Available but not installed */
  available: MCPRegistryEntry[];

  /** Discovery errors */
  errors: Array<{ package: string; error: string }>;
}

/**
 * MCP Tool Call Request
 */
export interface MCPToolCallRequest {
  /** Server name */
  serverName: string;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, any>;

  /** Request timeout */
  timeout?: number;
}

/**
 * MCP Tool Call Response
 */
export interface MCPToolCallResponse {
  /** Whether call succeeded */
  success: boolean;

  /** Result data (if successful) */
  result?: any;

  /** Error message (if failed) */
  error?: string;

  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * MCP Health Check Result
 */
export interface MCPHealthCheckResult {
  /** Server name */
  serverName: string;

  /** Whether server is healthy */
  healthy: boolean;

  /** Health check timestamp */
  timestamp: Date;

  /** Response time in milliseconds */
  responseTimeMs?: number;

  /** Error if unhealthy */
  error?: string;

  /** Additional health metrics */
  metrics?: {
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
    uptime?: number;
  };
}

/**
 * Known MCP Servers Registry
 *
 * Pre-configured list of commonly used MCP servers
 */
export const KNOWN_MCP_SERVERS: Record<string, Omit<MCPServerConfig, 'name' | 'enabled'>> = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    description: 'Filesystem access (read/write files)',
    tags: ['filesystem', 'files'],
  },

  github: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    description: 'GitHub integration (issues, PRs, repos)',
    tags: ['github', 'git', 'vcs'],
    env: {
      // GITHUB_TOKEN should be provided by user
    },
  },

  slack: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    description: 'Slack integration (messages, channels)',
    tags: ['slack', 'messaging', 'communication'],
    env: {
      // SLACK_TOKEN should be provided by user
    },
  },

  postgres: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    description: 'PostgreSQL database access',
    tags: ['database', 'postgres', 'sql'],
    env: {
      // DATABASE_URL should be provided by user
    },
  },

  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    description: 'Persistent memory storage',
    tags: ['memory', 'storage', 'persistence'],
  },

  puppeteer: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    description: 'Web browser automation',
    tags: ['browser', 'automation', 'web-scraping'],
  },

  sequential: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    description: 'Enhanced reasoning and sequential thinking',
    tags: ['reasoning', 'thinking', 'cognition'],
  },
};

/**
 * MCP Manager Interface
 *
 * Common interface that all provider-specific MCP managers should implement
 */
export interface IMCPManager {
  /** Initialize MCP manager */
  initialize(): Promise<void>;

  /** Start all configured MCP servers */
  startServers(): Promise<MCPServerStatus[]>;

  /** Stop all running MCP servers */
  stopServers(): Promise<void>;

  /** Stop a specific server */
  stopServer(serverName: string): Promise<void>;

  /** Restart a specific server */
  restartServer(serverName: string): Promise<MCPServerStatus>;

  /** Get status of all servers */
  getStatus(): Promise<MCPServerStatus[]>;

  /** Get status of specific server */
  getServerStatus(serverName: string): Promise<MCPServerStatus | undefined>;

  /** Discover available tools from all servers */
  discoverTools(): Promise<MCPToolInfo[]>;

  /** Call an MCP tool */
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;

  /** Run health check on all servers */
  healthCheck(): Promise<MCPHealthCheckResult[]>;

  /** Cleanup resources */
  cleanup(): Promise<void>;
}
