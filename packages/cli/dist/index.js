#!/usr/bin/env node

// src/index.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk3 from "chalk";

// src/utils/context.ts
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
async function getMinimalContext() {
  const { config, configPath } = await loadConfig();
  const basePath = getBasePath();
  return { config, configPath, basePath };
}
async function cleanupContext() {
  if (cachedContext) {
    await cachedContext.providerRouter.cleanup();
    await cachedContext.sessionManager.cleanup();
    cachedContext.memoryManager.close();
    cachedContext = null;
  }
}

// src/utils/output.ts
import chalk from "chalk";
import Table from "cli-table3";
import figures from "figures";
import {
  formatBytes as formatBytesBase,
  formatDuration as formatDurationBase,
  formatRelativeTime as formatRelativeTimeBase,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR
} from "@ax/schemas";
var symbols = {
  success: chalk.green(figures.tick),
  error: chalk.red(figures.cross),
  warning: chalk.yellow(figures.warning),
  info: chalk.blue(figures.info),
  arrow: chalk.cyan(figures.arrowRight),
  bullet: chalk.gray(figures.bullet),
  pointer: chalk.cyan(figures.pointer)
};
function error(message, details) {
  console.error(`${symbols.error} ${chalk.red(message)}`);
  if (details) {
    console.error(chalk.gray(`  ${details}`));
  }
}
function warning(message) {
  console.warn(`${symbols.warning} ${chalk.yellow(message)}`);
}
function info(message) {
  console.log(`${symbols.info} ${chalk.blue(message)}`);
}
function header(title) {
  console.log();
  console.log(chalk.bold.cyan(title));
  console.log(chalk.gray("\u2500".repeat(title.length)));
}
function section(title) {
  console.log();
  console.log(chalk.bold(title));
}
function keyValue(key, value) {
  console.log(`  ${chalk.gray(key + ":")} ${value}`);
}
function listItem(item, indent = 0) {
  const padding = "  ".repeat(indent);
  console.log(`${padding}${symbols.bullet} ${item}`);
}
function simpleTable(headers, rows) {
  const tableInstance = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: {
      head: ["cyan"],
      border: ["gray"]
    }
  });
  for (const row of rows) {
    tableInstance.push(row);
  }
  console.log(tableInstance.toString());
}
function json(data) {
  console.log(JSON.stringify(data, null, 2));
}
function statusBadge(status) {
  const statusMap = {
    healthy: chalk.green("HEALTHY"),
    unhealthy: chalk.red("UNHEALTHY"),
    active: chalk.green("ACTIVE"),
    paused: chalk.yellow("PAUSED"),
    completed: chalk.blue("COMPLETED"),
    failed: chalk.red("FAILED"),
    cancelled: chalk.gray("CANCELLED"),
    pending: chalk.yellow("PENDING"),
    running: chalk.cyan("RUNNING"),
    enabled: chalk.green("ENABLED"),
    disabled: chalk.gray("DISABLED")
  };
  return statusMap[status.toLowerCase()] ?? chalk.gray(status.toUpperCase());
}
function providerBadge(provider) {
  const providerMap = {
    claude: chalk.magenta("Claude"),
    gemini: chalk.blue("Gemini"),
    "ax-cli": chalk.cyan("ax-cli"),
    openai: chalk.green("OpenAI")
  };
  return providerMap[provider.toLowerCase()] ?? provider;
}
function formatDuration(ms) {
  if (ms < MS_PER_MINUTE) return formatDurationBase(ms);
  if (ms < MS_PER_HOUR) {
    const mins2 = Math.floor(ms / MS_PER_MINUTE);
    const secs = Math.floor(ms % MS_PER_MINUTE / MS_PER_SECOND);
    return `${mins2}m ${secs}s`;
  }
  const hours = Math.floor(ms / MS_PER_HOUR);
  const mins = Math.floor(ms % MS_PER_HOUR / MS_PER_MINUTE);
  return `${hours}h ${mins}m`;
}
var formatBytes = formatBytesBase;
var formatRelativeTime = formatRelativeTimeBase;
function divider(char = "\u2500", length = 60) {
  console.log(chalk.gray(char.repeat(length)));
}
function newline() {
  console.log();
}

// src/utils/spinner.ts
import ora from "ora";
import chalk2 from "chalk";
var activeSpinner = null;
function start(message) {
  if (activeSpinner) {
    activeSpinner.stop();
  }
  activeSpinner = ora({
    text: message,
    color: "cyan"
  }).start();
  return activeSpinner;
}
function update(message) {
  if (activeSpinner) {
    activeSpinner.text = message;
  }
}
function succeed(message) {
  if (activeSpinner) {
    activeSpinner.succeed(message);
    activeSpinner = null;
  }
}
function fail(message) {
  if (activeSpinner) {
    activeSpinner.fail(message);
    activeSpinner = null;
  }
}
function warn(message) {
  if (activeSpinner) {
    activeSpinner.warn(message);
    activeSpinner = null;
  }
}
function stop() {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
}

// src/commands/run.ts
var runCommand = {
  command: "run <agent> <task>",
  describe: "Execute a task with an agent",
  builder: (yargs2) => yargs2.positional("agent", {
    describe: "Agent name to use",
    type: "string",
    demandOption: true
  }).positional("task", {
    describe: "Task description",
    type: "string",
    demandOption: true
  }).option("timeout", {
    alias: "t",
    describe: "Timeout in milliseconds",
    type: "number",
    default: 3e5
  }).option("session", {
    alias: "s",
    describe: "Session ID to use",
    type: "string"
  }).option("stream", {
    describe: "Enable streaming output",
    type: "boolean",
    default: false
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { agent, task, timeout, session, stream, json: json2 } = argv;
      if (!json2) {
        header(`Running task with agent: ${agent}`);
        start("Initializing...");
      }
      const ctx = await getContext();
      if (!ctx.agentRegistry.has(agent)) {
        const available = ctx.agentRegistry.getIds();
        if (!json2) {
          fail(`Agent "${agent}" not found`);
          newline();
          info("Available agents:");
          for (const id of available.slice(0, 10)) {
            listItem(id);
          }
          if (available.length > 10) {
            listItem(`... and ${available.length - 10} more`);
          }
        } else {
          json({ error: `Agent "${agent}" not found`, availableAgents: available });
        }
        process.exit(1);
      }
      if (!json2) {
        update(`Executing task with ${agent}...`);
      }
      const result = await ctx.agentExecutor.execute(agent, task, {
        sessionId: session,
        timeout,
        stream,
        saveToMemory: true
      });
      await cleanupContext();
      if (json2) {
        json({
          success: result.response.success,
          agent: result.agentId,
          sessionId: result.session.id,
          taskId: result.task.id,
          output: result.response.output,
          duration: result.response.metadata.duration,
          provider: result.response.metadata.provider,
          error: result.response.error
        });
      } else {
        if (result.response.success) {
          succeed("Task completed successfully");
          newline();
          section("Result");
          console.log(result.response.output);
          newline();
          divider();
          keyValue("Agent", result.agentId);
          keyValue("Session", result.session.id);
          keyValue("Duration", formatDuration(result.response.metadata.duration));
          keyValue("Provider", result.response.metadata.provider);
        } else {
          fail("Task failed");
          newline();
          error("Error", result.response.error);
        }
      }
      process.exit(result.response.success ? 0 : 1);
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      if (argv.json) {
        json({ error: message });
      } else {
        error("Execution failed", message);
      }
      process.exit(1);
    }
  }
};

// src/commands/agent.ts
var listCommand = {
  command: "list",
  describe: "List all available agents",
  builder: (yargs2) => yargs2.option("format", {
    alias: "f",
    describe: "Output format",
    choices: ["table", "json", "simple"],
    default: "table"
  }).option("team", {
    alias: "t",
    describe: "Filter by team",
    type: "string"
  }),
  handler: async (argv) => {
    try {
      const { format, team } = argv;
      if (format !== "json") {
        start("Loading agents...");
      }
      const ctx = await getContext();
      let agents = ctx.agentRegistry.getAll();
      if (team) {
        agents = agents.filter((a) => a.team === team);
      }
      if (format === "json") {
        json(
          agents.map((a) => ({
            id: a.name,
            displayName: a.displayName,
            team: a.team,
            role: a.role,
            description: a.description,
            enabled: a.enabled
          }))
        );
      } else if (format === "simple") {
        stop();
        for (const agent of agents) {
          console.log(agent.name);
        }
      } else {
        succeed(`Found ${agents.length} agents`);
        newline();
        const rows = agents.map((a) => [
          a.name,
          a.displayName,
          a.team,
          a.role.slice(0, 30) + (a.role.length > 30 ? "..." : ""),
          a.enabled ? statusBadge("enabled") : statusBadge("disabled")
        ]);
        simpleTable(["ID", "Name", "Team", "Role", "Status"], rows);
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to list agents", message);
      process.exit(1);
    }
  }
};
var infoCommand = {
  command: "info <name>",
  describe: "Get detailed info about an agent",
  builder: (yargs2) => yargs2.positional("name", {
    describe: "Agent name or ID",
    type: "string",
    demandOption: true
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { name, json: json2 } = argv;
      if (!json2) {
        start("Loading agent...");
      }
      const ctx = await getContext();
      const agent = ctx.agentRegistry.get(name);
      if (!agent) {
        if (json2) {
          json({ error: `Agent "${name}" not found` });
        } else {
          fail(`Agent "${name}" not found`);
          newline();
          info('Use "ax agent list" to see available agents');
        }
        process.exit(1);
      }
      if (json2) {
        json(agent);
      } else {
        succeed(`Agent: ${agent.displayName}`);
        newline();
        section("Details");
        keyValue("ID", agent.name);
        keyValue("Name", agent.displayName);
        keyValue("Role", agent.role);
        keyValue("Team", agent.team);
        keyValue("Description", agent.description ?? "-");
        keyValue("Status", agent.enabled ? "Enabled" : "Disabled");
        if (agent.systemPrompt) {
          newline();
          section("System Prompt");
          const preview = agent.systemPrompt.slice(0, 200);
          console.log(preview + (agent.systemPrompt.length > 200 ? "..." : ""));
        }
        if (agent.abilities && agent.abilities.length > 0) {
          newline();
          section("Abilities");
          for (const ability of agent.abilities) {
            listItem(ability);
          }
        }
        if (agent.orchestration) {
          newline();
          section("Orchestration");
          keyValue("Max Delegation Depth", agent.orchestration.maxDelegationDepth);
          keyValue("Priority", agent.orchestration.priority);
          if (agent.orchestration.canDelegateTo.length > 0) {
            keyValue("Can Delegate To", agent.orchestration.canDelegateTo.join(", "));
          }
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to get agent info", message);
      process.exit(1);
    }
  }
};
var agentCommand = {
  command: "agent",
  describe: "Manage agents",
  builder: (yargs2) => yargs2.command(listCommand).command(infoCommand).demandCommand(1, "Please specify a subcommand"),
  handler: () => {
  }
};

// src/commands/memory.ts
import { readFile, writeFile } from "fs/promises";
var searchCommand = {
  command: "search <query>",
  describe: "Search memories by keyword",
  builder: (yargs2) => yargs2.positional("query", {
    describe: "Search query",
    type: "string",
    demandOption: true
  }).option("limit", {
    alias: "l",
    describe: "Maximum results",
    type: "number",
    default: 10
  }).option("agent", {
    alias: "a",
    describe: "Filter by agent ID",
    type: "string"
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { query, limit, agent, json: json2 } = argv;
      if (!json2) {
        start(`Searching for "${query}"...`);
      }
      const ctx = await getContext();
      const results = await ctx.memoryManager.search(query, {
        limit,
        agentId: agent
      });
      if (json2) {
        json(results);
      } else {
        succeed(`Found ${results.length} results`);
        if (results.length === 0) {
          newline();
          info("No memories found matching your query");
          return;
        }
        newline();
        for (const result of results) {
          divider();
          keyValue("ID", result.id);
          keyValue("Agent", result.agentId);
          keyValue("Session", result.sessionId);
          keyValue("Score", result.score?.toFixed(3) ?? "-");
          keyValue("Created", formatRelativeTime(new Date(result.createdAt)));
          newline();
          console.log(result.content.slice(0, 300) + (result.content.length > 300 ? "..." : ""));
        }
        divider();
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Search failed", message);
      process.exit(1);
    }
  }
};
var listCommand2 = {
  command: "list",
  describe: "List recent memories",
  builder: (yargs2) => yargs2.option("limit", {
    alias: "l",
    describe: "Maximum results",
    type: "number",
    default: 20
  }).option("agent", {
    alias: "a",
    describe: "Filter by agent ID",
    type: "string"
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { limit, agent, json: json2 } = argv;
      if (!json2) {
        start("Loading memories...");
      }
      const ctx = await getContext();
      const memories = await ctx.memoryManager.list({
        limit,
        agentId: agent
      });
      if (json2) {
        json(memories);
      } else {
        succeed(`Loaded ${memories.length} memories`);
        newline();
        const rows = memories.map((m) => [
          m.id.slice(0, 8),
          m.agentId,
          m.type,
          m.content.slice(0, 40) + (m.content.length > 40 ? "..." : ""),
          formatRelativeTime(new Date(m.createdAt))
        ]);
        simpleTable(["ID", "Agent", "Type", "Content", "Created"], rows);
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to list memories", message);
      process.exit(1);
    }
  }
};
var statsCommand = {
  command: "stats",
  describe: "Show memory statistics",
  builder: (yargs2) => yargs2.option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const json2 = argv.json;
      if (!json2) {
        start("Calculating statistics...");
      }
      const ctx = await getContext();
      const stats = await ctx.memoryManager.getStats();
      if (json2) {
        json(stats);
      } else {
        succeed("Memory Statistics");
        newline();
        section("Overview");
        keyValue("Total Memories", stats.totalEntries.toLocaleString());
        keyValue("Database Size", formatBytes(stats.databaseSize));
        keyValue("Unique Agents", stats.uniqueAgents);
        keyValue("Unique Sessions", stats.uniqueSessions);
        newline();
        section("By Type");
        for (const [type, count] of Object.entries(stats.byType)) {
          keyValue(type, count.toLocaleString());
        }
        if (stats.oldestEntry && stats.newestEntry) {
          newline();
          section("Time Range");
          keyValue("Oldest", new Date(stats.oldestEntry).toLocaleDateString());
          keyValue("Newest", new Date(stats.newestEntry).toLocaleDateString());
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to get stats", message);
      process.exit(1);
    }
  }
};
var exportCommand = {
  command: "export",
  describe: "Export memories to JSON",
  builder: (yargs2) => yargs2.option("output", {
    alias: "o",
    describe: "Output file path",
    type: "string"
  }).option("agent", {
    alias: "a",
    describe: "Export only memories for this agent",
    type: "string"
  }),
  handler: async (argv) => {
    try {
      const { output: outputPath, agent } = argv;
      start("Exporting memories...");
      const ctx = await getContext();
      const memories = await ctx.memoryManager.export({ agentId: agent });
      const data = JSON.stringify(memories, null, 2);
      if (outputPath) {
        await writeFile(outputPath, data, "utf-8");
        succeed(`Exported ${memories.length} memories to ${outputPath}`);
      } else {
        stop();
        console.log(data);
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Export failed", message);
      process.exit(1);
    }
  }
};
var importCommand = {
  command: "import <file>",
  describe: "Import memories from JSON file",
  builder: (yargs2) => yargs2.positional("file", {
    describe: "JSON file to import",
    type: "string",
    demandOption: true
  }).option("merge", {
    alias: "m",
    describe: "Merge with existing memories (skip duplicates)",
    type: "boolean",
    default: true
  }),
  handler: async (argv) => {
    try {
      const { file, merge } = argv;
      start(`Importing from ${file}...`);
      const data = await readFile(file, "utf-8");
      const memories = JSON.parse(data);
      if (!Array.isArray(memories)) {
        throw new Error("Invalid format: expected an array of memories");
      }
      const ctx = await getContext();
      const result = await ctx.memoryManager.import(memories, { merge });
      succeed(`Imported ${result.imported} memories (${result.skipped} skipped)`);
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Import failed", message);
      process.exit(1);
    }
  }
};
var clearCommand = {
  command: "clear",
  describe: "Clear memories",
  builder: (yargs2) => yargs2.option("agent", {
    alias: "a",
    describe: "Clear only memories for this agent",
    type: "string"
  }).option("before", {
    alias: "b",
    describe: "Clear memories before this date (YYYY-MM-DD)",
    type: "string"
  }).option("force", {
    alias: "f",
    describe: "Skip confirmation",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { agent, before, force } = argv;
      if (!force) {
        warning("This will permanently delete memories.");
        info("Use --force to skip this confirmation.");
        process.exit(0);
      }
      start("Clearing memories...");
      const ctx = await getContext();
      const count = await ctx.memoryManager.clear({
        agentId: agent,
        before: before ? new Date(before) : void 0
      });
      succeed(`Cleared ${count} memories`);
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Clear failed", message);
      process.exit(1);
    }
  }
};
var memoryCommand = {
  command: "memory",
  describe: "Manage memory system",
  builder: (yargs2) => yargs2.command(searchCommand).command(listCommand2).command(statsCommand).command(exportCommand).command(importCommand).command(clearCommand).demandCommand(1, "Please specify a subcommand"),
  handler: () => {
  }
};

// src/commands/provider.ts
var listCommand3 = {
  command: "list",
  describe: "List configured providers",
  builder: (yargs2) => yargs2.option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { json: json2 } = argv;
      if (!json2) {
        start("Loading provider configuration...");
      }
      const { config } = await getMinimalContext();
      const providers = config.providers.fallbackOrder.map((provider, index) => ({
        provider,
        priority: index + 1,
        enabled: true
      }));
      if (json2) {
        json(providers);
      } else {
        succeed(`${providers.length} providers configured`);
        newline();
        const rows = providers.map((p) => [
          providerBadge(p.provider),
          p.priority.toString(),
          statusBadge(p.enabled ? "enabled" : "disabled")
        ]);
        simpleTable(["Provider", "Priority", "Status"], rows);
        newline();
        info('Use "ax provider status" to check health');
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to list providers", message);
      process.exit(1);
    }
  }
};
var statusCommand = {
  command: "status",
  describe: "Check provider health status",
  builder: (yargs2) => yargs2.option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { json: json2 } = argv;
      if (!json2) {
        start("Checking provider health...");
      }
      const ctx = await getContext();
      const healthStatus = await ctx.providerRouter.checkHealth();
      if (json2) {
        json(healthStatus);
      } else {
        const healthyCount = Object.values(healthStatus).filter((h) => h.healthy).length;
        const totalCount = Object.keys(healthStatus).length;
        succeed(`${healthyCount}/${totalCount} providers healthy`);
        newline();
        const rows = Object.entries(healthStatus).map(([provider, status]) => [
          providerBadge(provider),
          statusBadge(status.healthy ? "healthy" : "unhealthy"),
          status.latency ? `${status.latency}ms` : "-",
          status.lastCheck ? formatRelativeTime(new Date(status.lastCheck)) : "-",
          status.error ?? "-"
        ]);
        simpleTable(["Provider", "Status", "Latency", "Last Check", "Error"], rows);
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Health check failed", message);
      process.exit(1);
    }
  }
};
var testCommand = {
  command: "test <provider>",
  describe: "Test provider connectivity",
  builder: (yargs2) => yargs2.positional("provider", {
    describe: "Provider name to test",
    type: "string",
    demandOption: true
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { provider, json: json2 } = argv;
      if (!json2) {
        start(`Testing ${provider}...`);
      }
      const ctx = await getContext();
      const startTime = Date.now();
      const result = await ctx.providerRouter.testProvider(provider);
      const duration = Date.now() - startTime;
      if (json2) {
        json({
          provider,
          success: result.success,
          duration,
          message: result.message,
          error: result.error
        });
      } else {
        if (result.success) {
          succeed(`${provider} is working (${duration}ms)`);
          if (result.message) {
            newline();
            info(result.message);
          }
        } else {
          fail(`${provider} test failed`);
          if (result.error) {
            newline();
            error("Error", result.error);
          }
        }
      }
      process.exit(result.success ? 0 : 1);
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Test failed", message);
      process.exit(1);
    }
  }
};
var providerCommand = {
  command: "provider",
  describe: "Manage AI providers",
  builder: (yargs2) => yargs2.command(listCommand3).command(statusCommand).command(testCommand).demandCommand(1, "Please specify a subcommand"),
  handler: () => {
  }
};

// src/commands/session.ts
var listCommand4 = {
  command: "list",
  describe: "List sessions",
  builder: (yargs2) => yargs2.option("state", {
    alias: "s",
    describe: "Filter by state",
    choices: ["active", "paused", "completed", "cancelled", "failed"]
  }).option("agent", {
    alias: "a",
    describe: "Filter by agent ID",
    type: "string"
  }).option("limit", {
    alias: "l",
    describe: "Maximum results",
    type: "number",
    default: 20
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { state, agent, json: json2 } = argv;
      if (!json2) {
        start("Loading sessions...");
      }
      const ctx = await getContext();
      const sessions = await ctx.sessionManager.list({
        state,
        agent
      });
      if (json2) {
        json(sessions);
      } else {
        succeed(`Found ${sessions.length} sessions`);
        newline();
        if (sessions.length === 0) {
          info("No sessions found");
          return;
        }
        const rows = sessions.map((s) => [
          s.id.slice(0, 8),
          s.name.slice(0, 20) + (s.name.length > 20 ? "..." : ""),
          statusBadge(s.state),
          `${s.agentCount}`,
          `${s.completedTasks}/${s.totalTasks}`,
          formatRelativeTime(s.createdAt)
        ]);
        simpleTable(["ID", "Name", "State", "Agents", "Tasks", "Created"], rows);
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to list sessions", message);
      process.exit(1);
    }
  }
};
var infoCommand2 = {
  command: "info <id>",
  describe: "Get session details",
  builder: (yargs2) => yargs2.positional("id", {
    describe: "Session ID",
    type: "string",
    demandOption: true
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { id, json: json2 } = argv;
      if (!json2) {
        start("Loading session...");
      }
      const ctx = await getContext();
      const session = await ctx.sessionManager.get(id);
      if (!session) {
        if (json2) {
          json({ error: `Session "${id}" not found` });
        } else {
          fail(`Session "${id}" not found`);
        }
        process.exit(1);
      }
      if (json2) {
        json(session);
      } else {
        succeed(`Session: ${session.name}`);
        newline();
        section("Details");
        keyValue("ID", session.id);
        keyValue("Name", session.name);
        keyValue("State", statusBadge(session.state));
        keyValue("Agents", session.agents.join(", "));
        keyValue("Tasks", session.tasks.length.toString());
        keyValue("Created", session.createdAt.toLocaleString());
        if (session.completedAt) {
          keyValue("Completed", session.completedAt.toLocaleString());
        }
        if (session.goal) {
          newline();
          section("Goal");
          console.log(session.goal);
        }
        if (session.description) {
          newline();
          section("Description");
          console.log(session.description);
        }
        if (session.tasks.length > 0) {
          newline();
          section("Tasks");
          for (const task of session.tasks.slice(0, 10)) {
            const status = statusBadge(task.status);
            listItem(`[${status}] ${task.agentId}: ${task.description.slice(0, 50)}...`);
          }
          if (session.tasks.length > 10) {
            listItem(`... and ${session.tasks.length - 10} more`);
          }
        }
        if (session.tags.length > 0) {
          newline();
          section("Tags");
          console.log(session.tags.join(", "));
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to get session", message);
      process.exit(1);
    }
  }
};
var sessionCommand = {
  command: "session",
  describe: "Manage sessions",
  builder: (yargs2) => yargs2.command(listCommand4).command(infoCommand2).demandCommand(1, "Please specify a subcommand"),
  handler: () => {
  }
};

// src/commands/system.ts
import { access, stat } from "fs/promises";
import { join as join2 } from "path";
var statusCommand2 = {
  command: "status",
  describe: "Show system status",
  builder: (yargs2) => yargs2.option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { json: json2 } = argv;
      if (!json2) {
        start("Checking system status...");
      }
      const ctx = await getContext();
      const healthStatus = await ctx.providerRouter.checkHealth();
      const memoryStats = await ctx.memoryManager.getStats();
      const agentCount = ctx.agentRegistry.getIds().length;
      const status = {
        version: "11.0.0-alpha.0",
        basePath: ctx.basePath,
        configPath: ctx.configPath,
        providers: healthStatus,
        agents: {
          total: agentCount,
          enabled: ctx.agentRegistry.getAll().filter((a) => a.enabled).length
        },
        memory: {
          entries: memoryStats.totalEntries,
          size: memoryStats.databaseSize
        }
      };
      if (json2) {
        json(status);
      } else {
        const healthyProviders = Object.values(healthStatus).filter((h) => h.healthy).length;
        const totalProviders = Object.keys(healthStatus).length;
        succeed("System Status");
        newline();
        section("AutomatosX");
        keyValue("Version", status.version);
        keyValue("Base Path", status.basePath);
        keyValue("Config", status.configPath ?? "Using defaults");
        newline();
        section("Providers");
        keyValue("Status", `${healthyProviders}/${totalProviders} healthy`);
        for (const [provider, health] of Object.entries(healthStatus)) {
          listItem(
            `${providerBadge(provider)}: ${statusBadge(health.healthy ? "healthy" : "unhealthy")}`
          );
        }
        newline();
        section("Agents");
        keyValue("Total", status.agents.total);
        keyValue("Enabled", status.agents.enabled);
        newline();
        section("Memory");
        keyValue("Entries", status.memory.entries.toLocaleString());
        keyValue("Size", formatBytes(status.memory.size));
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Status check failed", message);
      process.exit(1);
    }
  }
};
var configShowCommand = {
  command: "show",
  describe: "Show current configuration",
  builder: (yargs2) => yargs2.option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { json: json2 } = argv;
      if (!json2) {
        start("Loading configuration...");
      }
      const { config, configPath } = await getMinimalContext();
      if (json2) {
        json({ configPath, config });
      } else {
        succeed("Configuration");
        newline();
        keyValue("Config File", configPath ?? "Using defaults");
        newline();
        section("Providers");
        keyValue("Fallback Order", config.providers.fallbackOrder.join(" \u2192 "));
        newline();
        section("Router");
        keyValue("Default Provider", config.router.defaultProvider);
        keyValue("Health Check Interval", formatDuration(config.router.healthCheckInterval));
        newline();
        section("Execution");
        keyValue("Default Timeout", formatDuration(config.execution.timeout));
        keyValue("Max Retries", config.execution.maxRetries);
        newline();
        section("Memory");
        keyValue("Max Entries", config.memory.maxEntries.toLocaleString());
        keyValue("Cleanup Enabled", config.memory.autoCleanup ? "Yes" : "No");
        if (config.memory.autoCleanup) {
          keyValue("Cleanup Strategy", config.memory.cleanupStrategy);
          keyValue("Retention Days", config.memory.retentionDays);
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to load configuration", message);
      process.exit(1);
    }
  }
};
var configPathCommand = {
  command: "path",
  describe: "Show config file path",
  handler: async () => {
    try {
      const { configPath } = await getMinimalContext();
      console.log(configPath ?? "No config file found (using defaults)");
    } catch (error2) {
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to get config path", message);
      process.exit(1);
    }
  }
};
var configCommand = {
  command: "config",
  describe: "View configuration",
  builder: (yargs2) => yargs2.command(configShowCommand).command(configPathCommand).demandCommand(1, "Please specify a subcommand"),
  handler: () => {
  }
};
var doctorCommand = {
  command: "doctor",
  describe: "Run system diagnostics",
  builder: (yargs2) => yargs2.option("fix", {
    alias: "f",
    describe: "Attempt to fix issues",
    type: "boolean",
    default: false
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { json: json2 } = argv;
      if (!json2) {
        start("Running diagnostics...");
      }
      const results = [];
      const basePath = getBasePath();
      try {
        await access(basePath);
        results.push({
          name: "Base Directory",
          status: "pass",
          message: `Directory exists at ${basePath}`
        });
      } catch {
        results.push({
          name: "Base Directory",
          status: "fail",
          message: `Directory not found at ${basePath}`,
          fix: 'Run "ax setup" to create the directory structure'
        });
      }
      const memoryPath = join2(basePath, "memory");
      try {
        await access(memoryPath);
        results.push({
          name: "Memory Directory",
          status: "pass",
          message: "Memory directory exists"
        });
      } catch {
        results.push({
          name: "Memory Directory",
          status: "warn",
          message: "Memory directory not found",
          fix: "Will be created on first memory operation"
        });
      }
      const agentsPath = join2(basePath, "agents");
      try {
        await access(agentsPath);
        results.push({
          name: "Agents Directory",
          status: "pass",
          message: "Agents directory exists"
        });
      } catch {
        results.push({
          name: "Agents Directory",
          status: "warn",
          message: "Agents directory not found",
          fix: 'Run "ax setup" to create with default agents'
        });
      }
      const { configPath } = await getMinimalContext();
      if (configPath) {
        results.push({
          name: "Configuration",
          status: "pass",
          message: `Found at ${configPath}`
        });
      } else {
        results.push({
          name: "Configuration",
          status: "warn",
          message: "No config file found, using defaults",
          fix: "Create ax.config.json in project root"
        });
      }
      try {
        const ctx = await getContext();
        const healthStatus = await ctx.providerRouter.checkHealth();
        const healthyCount = Object.values(healthStatus).filter((h) => h.healthy).length;
        if (healthyCount > 0) {
          results.push({
            name: "Providers",
            status: "pass",
            message: `${healthyCount} provider(s) available`
          });
        } else {
          results.push({
            name: "Providers",
            status: "fail",
            message: "No providers available",
            fix: "Check API keys and provider configuration"
          });
        }
      } catch (error2) {
        results.push({
          name: "Providers",
          status: "fail",
          message: error2 instanceof Error ? error2.message : "Unknown error",
          fix: "Check provider configuration"
        });
      }
      const memoryDbPath = join2(basePath, "memory", "memories.db");
      try {
        const stats = await stat(memoryDbPath);
        results.push({
          name: "Memory Database",
          status: "pass",
          message: `Database exists (${formatBytes(stats.size)})`
        });
      } catch {
        results.push({
          name: "Memory Database",
          status: "warn",
          message: "Database not found",
          fix: "Will be created on first memory operation"
        });
      }
      if (json2) {
        json(results);
      } else {
        const passCount = results.filter((r) => r.status === "pass").length;
        const warnCount = results.filter((r) => r.status === "warn").length;
        const failCount = results.filter((r) => r.status === "fail").length;
        if (failCount > 0) {
          fail(`${failCount} issue(s) found`);
        } else if (warnCount > 0) {
          warn(`${warnCount} warning(s)`);
        } else {
          succeed("All checks passed");
        }
        newline();
        for (const result of results) {
          const icon = result.status === "pass" ? symbols.success : result.status === "warn" ? symbols.warning : symbols.error;
          console.log(`${icon} ${result.name}: ${result.message}`);
          if (result.fix && result.status !== "pass") {
            console.log(`    ${symbols.arrow} Fix: ${result.fix}`);
          }
        }
        newline();
        divider();
        keyValue("Passed", passCount);
        keyValue("Warnings", warnCount);
        keyValue("Failed", failCount);
      }
      process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Diagnostics failed", message);
      process.exit(1);
    }
  }
};

// src/index.ts
var VERSION = "11.0.0-alpha.0";
var LOGO = `
   \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
   \u2551     ${chalk3.cyan("AutomatosX")} ${chalk3.gray(`v${VERSION}`)}           \u2551
   \u2551     ${chalk3.gray("AI Agent Orchestration Platform")}    \u2551
   \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
`;
async function main() {
  try {
    await yargs(hideBin(process.argv)).scriptName("ax").usage(LOGO + "\nUsage: $0 <command> [options]").command(runCommand).command(agentCommand).command(memoryCommand).command(providerCommand).command(sessionCommand).command(statusCommand2).command(configCommand).command(doctorCommand).option("debug", {
      describe: "Enable debug output",
      type: "boolean",
      global: true
    }).option("quiet", {
      alias: "q",
      describe: "Suppress non-essential output",
      type: "boolean",
      global: true
    }).help("help").alias("h", "help").version("version", VERSION).alias("v", "version").fail((msg, err, yargs2) => {
      if (err) {
        console.error(chalk3.red("Error:"), err.message);
        if (process.env["DEBUG"]) {
          console.error(err.stack);
        }
      } else if (msg) {
        console.error(chalk3.red("Error:"), msg);
        console.error();
        yargs2.showHelp();
      }
      process.exit(1);
    }).demandCommand(1, 'Please specify a command. Run "ax --help" for usage.').strict().example('$0 run backend "implement user auth"', "Run a task with the backend agent").example("$0 agent list", "List all available agents").example('$0 memory search "authentication"', "Search memory for past conversations").example("$0 status", "Show system status").example("$0 doctor", "Run system diagnostics").epilog(
      chalk3.gray(
        "For more information, visit: https://github.com/defai-digital/automatosx"
      )
    ).parseAsync();
  } catch (error2) {
    if (error2 instanceof Error && error2.message !== "process.exit") {
      console.error(chalk3.red("Fatal error:"), error2.message);
      process.exit(1);
    }
  }
}
main();
/**
 * CLI Context
 *
 * Shared context and initialization for CLI commands.
 * Provides lazy-loaded access to core services.
 *
 * @module @ax/cli/utils/context
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * CLI Output Utilities
 *
 * Provides consistent formatting for CLI output including
 * tables, JSON, and styled messages.
 *
 * @module @ax/cli/utils/output
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * CLI Spinner Utilities
 *
 * Provides loading spinners for long-running operations.
 *
 * @module @ax/cli/utils/spinner
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Run Command
 *
 * Execute a task with an agent.
 *
 * Usage:
 *   ax run <agent> "task description"
 *   ax run backend "implement user authentication"
 *
 * @module @ax/cli/commands/run
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Commands
 *
 * Commands for managing and interacting with agents.
 *
 * Usage:
 *   ax agent list           - List all available agents
 *   ax agent info <name>    - Get detailed info about an agent
 *   ax agent create <name>  - Create a new agent
 *
 * @module @ax/cli/commands/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Memory Commands
 *
 * Commands for managing the memory system.
 *
 * Usage:
 *   ax memory search <query>  - Search memories
 *   ax memory list            - List recent memories
 *   ax memory stats           - Show memory statistics
 *   ax memory export          - Export memories to JSON
 *   ax memory import <file>   - Import memories from JSON
 *   ax memory clear           - Clear memories
 *
 * @module @ax/cli/commands/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Provider Commands
 *
 * Commands for managing AI providers.
 *
 * Usage:
 *   ax provider list      - List configured providers
 *   ax provider status    - Check provider health
 *   ax provider test      - Test provider connectivity
 *
 * @module @ax/cli/commands/provider
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Session Commands
 *
 * Commands for managing execution sessions.
 *
 * Usage:
 *   ax session list           - List sessions
 *   ax session info <id>      - Get session details
 *
 * @module @ax/cli/commands/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * System Commands
 *
 * Commands for system status, configuration, and diagnostics.
 *
 * Usage:
 *   ax status         - Show system status
 *   ax config show    - Show current configuration
 *   ax config path    - Show config file path
 *   ax doctor         - Run system diagnostics
 *
 * @module @ax/cli/commands/system
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * AutomatosX CLI
 *
 * The command-line interface for AutomatosX - an AI agent orchestration platform.
 *
 * Usage:
 *   ax <command> [options]
 *   ax run <agent> <task>       - Execute a task with an agent
 *   ax agent list               - List available agents
 *   ax memory search <query>    - Search memory
 *   ax status                   - Show system status
 *
 * @module @ax/cli
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map