#!/usr/bin/env node

// src/mcp-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/tools/context.ts
import { join } from "path";
import "os";
import {
  loadConfig,
  MemoryManager,
  ProviderRouter,
  SessionManager,
  AgentLoader,
  AgentRegistry,
  AgentExecutor,
  DIR_AUTOMATOSX,
  DIR_MEMORY,
  FILE_MEMORY_DB
} from "@ax/core";
var cachedContext = null;
function getBasePath() {
  const cwdPath = join(process.cwd(), DIR_AUTOMATOSX);
  return cwdPath;
}
async function getContext() {
  if (cachedContext) {
    return cachedContext;
  }
  const { config, configPath } = await loadConfig();
  const basePath = getBasePath();
  const memoryPath = join(basePath, DIR_MEMORY, FILE_MEMORY_DB);
  const memoryManager = new MemoryManager({
    databasePath: memoryPath,
    maxEntries: config.memory.maxEntries,
    cleanupConfig: {
      enabled: config.memory.autoCleanup,
      strategy: config.memory.cleanupStrategy,
      retentionDays: config.memory.retentionDays
    }
  });
  const sessionManager = new SessionManager({
    storagePath: basePath,
    autoPersist: true
  });
  await sessionManager.initialize();
  const providerRouter = new ProviderRouter({
    config,
    autoHealthCheck: true,
    healthCheckInterval: config.router.healthCheckInterval
  });
  const agentLoader = new AgentLoader({ basePath });
  const agentRegistry = new AgentRegistry({ loader: agentLoader });
  await agentRegistry.initialize();
  const agentExecutor = new AgentExecutor({
    router: providerRouter,
    sessionManager,
    agentRegistry,
    memoryManager,
    defaultTimeout: config.execution.timeout
  });
  cachedContext = {
    config,
    configPath,
    basePath,
    memoryManager,
    sessionManager,
    providerRouter,
    agentRegistry,
    agentExecutor
  };
  return cachedContext;
}
async function cleanupContext() {
  if (cachedContext) {
    await cachedContext.providerRouter.cleanup();
    await cachedContext.sessionManager.cleanup();
    cachedContext.memoryManager.close();
    cachedContext = null;
  }
}

// src/tools/agent.ts
function createRunTool(getContext2) {
  return {
    definition: {
      name: "ax_run",
      description: "Execute a task with an AutomatosX agent. Returns the agent response.",
      inputSchema: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            description: 'Agent ID to use (e.g., "backend", "frontend", "security")'
          },
          task: {
            type: "string",
            description: "Task description for the agent to execute"
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 300000)"
          },
          sessionId: {
            type: "string",
            description: "Session ID to use for conversation continuity"
          }
        },
        required: ["agent", "task"]
      }
    },
    async execute(args) {
      try {
        const agent = args["agent"];
        const task = args["task"];
        const timeout = args["timeout"] ?? 3e5;
        const sessionId = args["sessionId"];
        const ctx = await getContext2();
        if (!ctx.agentRegistry.has(agent)) {
          const available = ctx.agentRegistry.getIds().slice(0, 10);
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agent}" not found. Available agents: ${available.join(", ")}`
              }
            ],
            isError: true
          };
        }
        const result = await ctx.agentExecutor.execute(agent, task, {
          sessionId,
          timeout,
          saveToMemory: true
        });
        if (result.response.success) {
          return {
            content: [
              {
                type: "text",
                text: result.response.output
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Task failed: ${result.response.error ?? "Unknown error"}`
              }
            ],
            isError: true
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createListAgentsTool(getContext2) {
  return {
    definition: {
      name: "ax_list_agents",
      description: "List all available AutomatosX agents with their descriptions.",
      inputSchema: {
        type: "object",
        properties: {
          team: {
            type: "string",
            description: "Filter by agent team"
          }
        }
      }
    },
    async execute(args) {
      try {
        const team = args["team"];
        const ctx = await getContext2();
        let agents = ctx.agentRegistry.getAll();
        if (team) {
          agents = agents.filter((a) => a.team === team);
        }
        const agentList = agents.filter((a) => a.enabled).map((a) => `- ${a.name}: ${a.displayName} - ${a.description ?? "No description"}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text: `Available agents (${agents.length}):

${agentList}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createAgentInfoTool(getContext2) {
  return {
    definition: {
      name: "ax_agent_info",
      description: "Get detailed information about a specific agent.",
      inputSchema: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            description: "Agent ID to get info for"
          }
        },
        required: ["agent"]
      }
    },
    async execute(args) {
      try {
        const agentId = args["agent"];
        const ctx = await getContext2();
        const agent = ctx.agentRegistry.get(agentId);
        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: `Agent "${agentId}" not found.`
              }
            ],
            isError: true
          };
        }
        const info = [
          `Agent: ${agent.displayName} (${agent.name})`,
          `Description: ${agent.description ?? "No description"}`,
          `Team: ${agent.team}`,
          `Role: ${agent.role}`,
          `Status: ${agent.enabled ? "Enabled" : "Disabled"}`
        ];
        if (agent.abilities && agent.abilities.length > 0) {
          info.push(`Abilities: ${agent.abilities.join(", ")}`);
        }
        return {
          content: [
            {
              type: "text",
              text: info.join("\n")
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}

// src/tools/memory.ts
import {
  formatBytes,
  LIST_SEARCH_LIMIT,
  LIST_TOP_TAGS,
  DISPLAY_PREVIEW_LONG
} from "@ax/schemas";
function createMemorySearchTool(getContext2) {
  return {
    definition: {
      name: "ax_memory_search",
      description: "Search the AutomatosX memory system for past conversations and decisions.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (supports full-text search)"
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 10)"
          },
          agentId: {
            type: "string",
            description: "Filter results by agent ID"
          }
        },
        required: ["query"]
      }
    },
    async execute(args) {
      try {
        const query = args["query"];
        const limit = args["limit"] ?? LIST_SEARCH_LIMIT;
        const agentId = args["agentId"];
        const ctx = await getContext2();
        const result = ctx.memoryManager.search({
          query,
          limit,
          offset: 0,
          sortBy: "relevance",
          sortDirection: "desc",
          includeContent: true,
          highlight: false,
          filter: agentId ? { agentId } : void 0
        });
        if (result.entries.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No memories found for query: "${query}"`
              }
            ]
          };
        }
        const formattedResults = result.entries.map((entry, i) => {
          const source = entry.metadata.source;
          return [
            `[${i + 1}] Source: ${source}`,
            `    ${entry.content.slice(0, DISPLAY_PREVIEW_LONG)}${entry.content.length > DISPLAY_PREVIEW_LONG ? "..." : ""}`
          ].join("\n");
        }).join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.total} memories:

${formattedResults}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createMemorySaveTool(getContext2) {
  return {
    definition: {
      name: "ax_memory_save",
      description: "Save information to the AutomatosX memory system for future reference.",
      inputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Content to save to memory"
          },
          source: {
            type: "string",
            description: "Source identifier for this memory"
          },
          type: {
            type: "string",
            description: "Type of memory (conversation, decision, task, code, document)",
            enum: ["conversation", "decision", "task", "code", "document"]
          },
          tags: {
            type: "array",
            description: "Tags to associate with this memory"
          }
        },
        required: ["content", "source"]
      }
    },
    async execute(args) {
      try {
        const content = args["content"];
        const source = args["source"];
        const type = args["type"] ?? "document";
        const tags = args["tags"] ?? [];
        const ctx = await getContext2();
        const id = ctx.memoryManager.add({
          content,
          metadata: {
            type,
            source,
            tags,
            importance: 0.5
          }
        });
        return {
          content: [
            {
              type: "text",
              text: `Memory saved successfully (ID: ${id})`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createMemoryStatsTool(getContext2) {
  return {
    definition: {
      name: "ax_memory_stats",
      description: "Get statistics about the AutomatosX memory system.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    async execute() {
      try {
        const ctx = await getContext2();
        const stats = ctx.memoryManager.getStats();
        const info = [
          `Memory Statistics:`,
          `- Total entries: ${stats.totalEntries.toLocaleString()}`,
          `- Database size: ${formatBytes(stats.databaseSizeBytes)}`,
          `- Avg content length: ${Math.round(stats.avgContentLength)} chars`,
          `- Total access count: ${stats.totalAccessCount.toLocaleString()}`
        ];
        if (stats.oldestEntry && stats.newestEntry) {
          info.push(`- Date range: ${stats.oldestEntry.toLocaleDateString()} - ${stats.newestEntry.toLocaleDateString()}`);
        }
        if (stats.topTags.length > 0) {
          info.push(`- Top tags: ${stats.topTags.slice(0, LIST_TOP_TAGS).map((t) => `${t.tag}(${t.count})`).join(", ")}`);
        }
        return {
          content: [
            {
              type: "text",
              text: info.join("\n")
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}

// src/tools/session.ts
function createSessionCreateTool(getContext2) {
  return {
    definition: {
      name: "ax_session_create",
      description: "Create a new AutomatosX session for tracking a workflow.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Session name"
          },
          agents: {
            type: "array",
            description: "List of agent IDs participating in this session"
          },
          goal: {
            type: "string",
            description: "Session goal/objective"
          },
          description: {
            type: "string",
            description: "Session description"
          }
        },
        required: ["name", "agents"]
      }
    },
    async execute(args) {
      try {
        const name = args["name"];
        const agents = args["agents"];
        const goal = args["goal"];
        const description = args["description"];
        const ctx = await getContext2();
        const session = await ctx.sessionManager.create({
          name,
          agents,
          goal,
          description
        });
        return {
          content: [
            {
              type: "text",
              text: `Session created: ${session.id}
Name: ${session.name}
Agents: ${session.agents.join(", ")}
State: ${session.state}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createSessionListTool(getContext2) {
  return {
    definition: {
      name: "ax_session_list",
      description: "List AutomatosX sessions.",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            description: "Filter by state (active, paused, completed, cancelled, failed)",
            enum: ["active", "paused", "completed", "cancelled", "failed"]
          },
          agent: {
            type: "string",
            description: "Filter by agent ID"
          }
        }
      }
    },
    async execute(args) {
      try {
        const stateArg = args["state"];
        const agent = args["agent"];
        const ctx = await getContext2();
        const filter = {};
        if (stateArg) {
          filter.state = stateArg;
        }
        if (agent) {
          filter.agent = agent;
        }
        const sessions = await ctx.sessionManager.list(filter);
        if (sessions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No sessions found."
              }
            ]
          };
        }
        const sessionList = sessions.map((s) => `- ${s.id.slice(0, 8)}: ${s.name} [${s.state}] - ${s.agentCount} agent(s), ${s.totalTasks} task(s)`).join("\n");
        return {
          content: [
            {
              type: "text",
              text: `Sessions (${sessions.length}):

${sessionList}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createSessionInfoTool(getContext2) {
  return {
    definition: {
      name: "ax_session_info",
      description: "Get detailed information about an AutomatosX session.",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to get info for"
          }
        },
        required: ["sessionId"]
      }
    },
    async execute(args) {
      try {
        const sessionId = args["sessionId"];
        const ctx = await getContext2();
        const session = await ctx.sessionManager.get(sessionId);
        if (!session) {
          return {
            content: [
              {
                type: "text",
                text: `Session "${sessionId}" not found.`
              }
            ],
            isError: true
          };
        }
        const info = [
          `Session: ${session.id}`,
          `Name: ${session.name}`,
          `State: ${session.state}`,
          `Agents: ${session.agents.join(", ")}`,
          `Tasks: ${session.tasks.length}`,
          `Created: ${session.createdAt.toLocaleString()}`
        ];
        if (session.completedAt) {
          info.push(`Completed: ${session.completedAt.toLocaleString()}`);
        }
        if (session.goal) {
          info.push(`Goal: ${session.goal}`);
        }
        if (session.tags.length > 0) {
          info.push(`Tags: ${session.tags.join(", ")}`);
        }
        return {
          content: [
            {
              type: "text",
              text: info.join("\n")
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}

// src/tools/system.ts
import { formatBytes as formatBytes2, formatDuration, VERSION } from "@ax/schemas";
function createStatusTool(getContext2) {
  return {
    definition: {
      name: "ax_status",
      description: "Get the current status of the AutomatosX system.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    async execute() {
      try {
        const ctx = await getContext2();
        const healthStatus = await ctx.providerRouter.checkAllHealth();
        const memoryStats = ctx.memoryManager.getStats();
        const agentCount = ctx.agentRegistry.getIds().length;
        const enabledAgents = ctx.agentRegistry.getAll().filter((a) => a.enabled).length;
        let healthyProviders = 0;
        const providerLines = [];
        for (const [name, healthy] of healthStatus) {
          if (healthy) healthyProviders++;
          providerLines.push(`  - ${name}: ${healthy ? "healthy" : "unhealthy"}`);
        }
        const totalProviders = healthStatus.size;
        const info = [
          "AutomatosX Status",
          "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
          "",
          "System:",
          `  Version: ${VERSION}`,
          `  Base path: ${ctx.basePath}`,
          "",
          `Providers (${healthyProviders}/${totalProviders} healthy):`,
          ...providerLines,
          "",
          "Agents:",
          `  Total: ${agentCount}`,
          `  Enabled: ${enabledAgents}`,
          "",
          "Memory:",
          `  Entries: ${memoryStats.totalEntries.toLocaleString()}`,
          `  Size: ${formatBytes2(memoryStats.databaseSizeBytes)}`
        ];
        return {
          content: [
            {
              type: "text",
              text: info.join("\n")
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createProviderStatusTool(getContext2) {
  return {
    definition: {
      name: "ax_provider_status",
      description: "Check the health status of AI providers.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    async execute() {
      try {
        const ctx = await getContext2();
        const healthStatus = await ctx.providerRouter.checkAllHealth();
        const providerLines = [];
        for (const [name, healthy] of healthStatus) {
          const provider = ctx.providerRouter.getProvider(name);
          const health = provider?.getHealth();
          const statusStr = healthy ? "\u2713" : "\u2717";
          const latency = health?.latencyMs ? `${health.latencyMs}ms` : "N/A";
          providerLines.push(`${statusStr} ${name}: ${healthy ? "healthy" : "unhealthy"} (${latency})`);
        }
        const providerList = providerLines.join("\n");
        return {
          content: [
            {
              type: "text",
              text: `Provider Status:

${providerList}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}
function createConfigTool(getContext2) {
  return {
    definition: {
      name: "ax_config",
      description: "Get the current AutomatosX configuration.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    async execute() {
      try {
        const ctx = await getContext2();
        const { config, configPath } = ctx;
        const fallbackOrder = config.providers.fallbackOrder ?? config.providers.enabled;
        const info = [
          "AutomatosX Configuration",
          "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
          "",
          `Config file: ${configPath ?? "Using defaults"}`,
          "",
          "Providers:",
          `  Default: ${config.providers.default}`,
          `  Enabled: ${config.providers.enabled.join(", ")}`,
          `  Fallback order: ${fallbackOrder.join(" \u2192 ")}`,
          "",
          "Router:",
          `  Health check interval: ${formatDuration(config.router.healthCheckInterval)}`,
          `  Circuit breaker threshold: ${config.router.circuitBreakerThreshold}`,
          "",
          "Execution:",
          `  Default timeout: ${formatDuration(config.execution.timeout)}`,
          `  Max retries: ${config.execution.retry.maxAttempts}`,
          `  Concurrency: ${config.execution.concurrency}`,
          "",
          "Memory:",
          `  Max entries: ${config.memory.maxEntries.toLocaleString()}`,
          `  Cleanup enabled: ${config.memory.autoCleanup ? "Yes" : "No"}`
        ];
        if (config.memory.autoCleanup) {
          info.push(`  Cleanup strategy: ${config.memory.cleanupStrategy}`);
          info.push(`  Retention days: ${config.memory.retentionDays}`);
        }
        return {
          content: [
            {
              type: "text",
              text: info.join("\n")
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    }
  };
}

// src/mcp-server.ts
var AutomatosXServer = class {
  server;
  tools = /* @__PURE__ */ new Map();
  config;
  constructor(config) {
    this.config = {
      name: config?.name ?? "automatosx",
      version: config?.version ?? "11.0.0-alpha.0",
      basePath: config?.basePath
    };
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version
      },
      {
        capabilities: this.getCapabilities()
      }
    );
    this.registerTools();
    this.setupHandlers();
  }
  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------
  getCapabilities() {
    return {
      tools: {
        listChanged: false
      }
    };
  }
  // ---------------------------------------------------------------------------
  // Tool Registration
  // ---------------------------------------------------------------------------
  registerTools() {
    this.addTool(createRunTool(getContext));
    this.addTool(createListAgentsTool(getContext));
    this.addTool(createAgentInfoTool(getContext));
    this.addTool(createMemorySearchTool(getContext));
    this.addTool(createMemorySaveTool(getContext));
    this.addTool(createMemoryStatsTool(getContext));
    this.addTool(createSessionCreateTool(getContext));
    this.addTool(createSessionListTool(getContext));
    this.addTool(createSessionInfoTool(getContext));
    this.addTool(createStatusTool(getContext));
    this.addTool(createProviderStatusTool(getContext));
    this.addTool(createConfigTool(getContext));
  }
  addTool(handler) {
    this.tools.set(handler.definition.name, handler);
  }
  // ---------------------------------------------------------------------------
  // Request Handlers
  // ---------------------------------------------------------------------------
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map((handler) => handler.definition);
      return { tools };
    });
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = this.tools.get(name);
      if (!handler) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`
            }
          ],
          isError: true
        };
      }
      try {
        const result = await handler.execute(args ?? {});
        return {
          content: result.content.map((item) => ({
            type: item.type,
            text: item.text,
            data: item.data,
            mimeType: item.mimeType
          })),
          isError: result.isError
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    });
  }
  // ---------------------------------------------------------------------------
  // Server Lifecycle
  // ---------------------------------------------------------------------------
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`AutomatosX MCP Server v${this.config.version} started`);
    console.error(`Registered ${this.tools.size} tools`);
  }
  async stop() {
    await cleanupContext();
    await this.server.close();
    console.error("AutomatosX MCP Server stopped");
  }
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  getToolCount() {
    return this.tools.size;
  }
  getToolNames() {
    return Array.from(this.tools.keys());
  }
};
function createServer(config) {
  return new AutomatosXServer(config);
}

// src/server.ts
async function main() {
  const server = createServer();
  process.on("SIGINT", async () => {
    console.error("\nReceived SIGINT, shutting down...");
    await server.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.error("\nReceived SIGTERM, shutting down...");
    await server.stop();
    process.exit(0);
  });
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    await server.stop();
    process.exit(1);
  });
  process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled rejection:", reason);
    await server.stop();
    process.exit(1);
  });
  try {
    await server.start();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}
main();
/**
 * MCP Context
 *
 * Shared context for MCP tools, providing access to core services.
 *
 * @module @ax/mcp/tools/context
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Tools
 *
 * MCP tools for agent operations.
 *
 * @module @ax/mcp/tools/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Memory Tools
 *
 * MCP tools for memory operations.
 *
 * @module @ax/mcp/tools/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Session Tools
 *
 * MCP tools for session management.
 *
 * @module @ax/mcp/tools/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * System Tools
 *
 * MCP tools for system status and configuration.
 *
 * @module @ax/mcp/tools/system
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * MCP Tools
 *
 * Export all MCP tools and context utilities.
 *
 * @module @ax/mcp/tools
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * MCP Server Implementation
 *
 * The core MCP server that handles tool registration and execution.
 *
 * @module @ax/mcp/mcp-server
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * MCP Server Entry Point
 *
 * Standalone executable for running the AutomatosX MCP server.
 *
 * Usage:
 *   ax-mcp              # Start MCP server
 *   node dist/server.js # Start MCP server
 *
 * @module @ax/mcp/server
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=server.js.map