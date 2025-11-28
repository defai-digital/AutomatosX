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
function info2(message) {
  if (activeSpinner) {
    activeSpinner.info(message);
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
import { selectAgentWithReason, findSimilar } from "@ax/core";
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
      let selectedAgent = agent;
      let autoSelected = false;
      if (!ctx.agentRegistry.has(agent)) {
        const available = ctx.agentRegistry.getIds();
        const similar = findSimilar(agent, available);
        if (similar.length > 0 && similar[0]) {
          if (!json2) {
            fail(`Agent "${agent}" not found`);
            newline();
            info(`Did you mean: ${similar.join(", ")}?`);
            newline();
            info("Or run without an agent name to auto-select:");
            listItem(`ax run "${task}"`);
          } else {
            json({
              error: `Agent "${agent}" not found`,
              suggestions: similar,
              availableAgents: available
            });
          }
          process.exit(1);
        }
        const selection = selectAgentWithReason(task, ctx.agentRegistry);
        selectedAgent = selection.agent.name;
        autoSelected = true;
        if (!json2) {
          info2(`Agent "${agent}" not found, auto-selected: ${selectedAgent}`);
          info(`Reason: ${selection.reason}`);
          if (selection.confidence < 0.5) {
            warning("Low confidence selection. Consider specifying an agent explicitly.");
          }
        }
      }
      if (!json2) {
        update(`Executing task with ${selectedAgent}...`);
      }
      const result = await ctx.agentExecutor.execute(selectedAgent, task, {
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
          autoSelected,
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
      const results = ctx.memoryManager.search({
        query,
        limit,
        offset: 0,
        sortBy: "relevance",
        sortDirection: "desc",
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : void 0
      });
      if (json2) {
        json(results);
      } else {
        succeed(`Found ${results.entries.length} results`);
        if (results.entries.length === 0) {
          newline();
          info("No memories found matching your query");
          return;
        }
        newline();
        for (const entry of results.entries) {
          divider();
          keyValue("ID", String(entry.id));
          keyValue("Type", entry.metadata.type);
          keyValue("Agent", entry.metadata.agentId ?? "-");
          keyValue("Session", entry.metadata.sessionId ?? "-");
          keyValue("Created", formatRelativeTime(new Date(entry.createdAt)));
          newline();
          console.log(entry.content.slice(0, 300) + (entry.content.length > 300 ? "..." : ""));
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
      const results = ctx.memoryManager.search({
        query: "*",
        limit,
        offset: 0,
        sortBy: "created",
        sortDirection: "desc",
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : void 0
      });
      if (json2) {
        json(results.entries);
      } else {
        succeed(`Loaded ${results.entries.length} memories`);
        newline();
        const rows = results.entries.map((m) => [
          String(m.id).slice(0, 8),
          m.metadata.agentId ?? "-",
          m.metadata.type,
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
      const { json: json2 } = argv;
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
        keyValue("Database Size", formatBytes(stats.databaseSizeBytes));
        keyValue("Average Content Length", Math.round(stats.avgContentLength).toLocaleString() + " chars");
        keyValue("Total Access Count", stats.totalAccessCount.toLocaleString());
        newline();
        section("By Type");
        for (const [type, count] of Object.entries(stats.entriesByType)) {
          if (count) {
            keyValue(type, count.toLocaleString());
          }
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
      const results = ctx.memoryManager.search({
        query: "*",
        limit: 100,
        // Max allowed by schema
        offset: 0,
        sortBy: "created",
        sortDirection: "desc",
        includeContent: true,
        highlight: false,
        filter: agent ? { agentId: agent } : void 0
      });
      const data = JSON.stringify(results.entries, null, 2);
      if (outputPath) {
        await writeFile(outputPath, data, "utf-8");
        succeed(`Exported ${results.entries.length} memories to ${outputPath}`);
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
      const { file } = argv;
      start(`Importing from ${file}...`);
      const data = await readFile(file, "utf-8");
      const memories = JSON.parse(data);
      if (!Array.isArray(memories)) {
        throw new Error("Invalid format: expected an array of memories");
      }
      const ctx = await getContext();
      const inputs = memories.map((m) => ({
        content: m.content,
        metadata: {
          ...m.metadata,
          type: m.metadata.type ?? "document",
          source: m.metadata.source ?? "import",
          tags: m.metadata.tags ?? []
        }
      }));
      const ids = ctx.memoryManager.addBatch(inputs);
      succeed(`Imported ${ids.length} memories`);
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
  }).option("all", {
    describe: "Clear all memories",
    type: "boolean",
    default: false
  }).option("force", {
    alias: "f",
    describe: "Skip confirmation",
    type: "boolean",
    default: false
  }).check((argv) => {
    if (!argv.agent && !argv.before && !argv.all) {
      throw new Error("Must specify at least one of: --agent, --before, or --all");
    }
    return true;
  }),
  handler: async (argv) => {
    try {
      const { agent, before, all, force } = argv;
      const descriptions = [];
      if (all) {
        descriptions.push("ALL memories");
      } else {
        if (agent) {
          descriptions.push(`memories for agent "${agent}"`);
        }
        if (before) {
          descriptions.push(`memories before ${before}`);
        }
      }
      if (!force) {
        warning(`This will permanently delete ${descriptions.join(" and ")}.`);
        info("Use --force to skip this confirmation.");
        process.exit(0);
      }
      start(`Clearing ${descriptions.join(" and ")}...`);
      const ctx = await getContext();
      const beforeDate = before ? new Date(before) : void 0;
      if (beforeDate && isNaN(beforeDate.getTime())) {
        throw new Error(`Invalid date format: ${before}. Use YYYY-MM-DD.`);
      }
      const clearOptions = {};
      if (beforeDate) {
        clearOptions.before = beforeDate;
      }
      if (agent) {
        clearOptions.agent = agent;
      }
      if (all) {
        clearOptions.all = all;
      }
      const result = ctx.memoryManager.clear(clearOptions);
      succeed(`Cleared ${result.deleted} memories`);
      if (result.deleted > 100) {
        info("Tip: Run a database maintenance task periodically to reclaim disk space.");
      }
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
      const fallbackOrder = config.providers.fallbackOrder ?? [config.providers.default];
      const providers = fallbackOrder.map((provider, index) => ({
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
      const healthStatus = await ctx.providerRouter.checkAllHealth();
      if (json2) {
        json(healthStatus);
      } else {
        const healthyCount = Object.values(healthStatus).filter((h) => h.healthy).length;
        const totalCount = Object.keys(healthStatus).length;
        succeed(`${healthyCount}/${totalCount} providers healthy`);
        newline();
        const rows = Object.entries(healthStatus).map(([provider, status]) => {
          const s = status;
          return [
            providerBadge(provider),
            statusBadge(s.healthy ? "healthy" : "unhealthy"),
            s.latency ? `${s.latency}ms` : "-",
            s.lastCheck ? formatRelativeTime(new Date(s.lastCheck)) : "-",
            s.error ?? "-"
          ];
        });
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
      const providerInstance = ctx.providerRouter.getProvider(provider);
      const duration = Date.now() - startTime;
      if (!providerInstance) {
        if (json2) {
          json({
            provider,
            success: false,
            duration,
            error: `Provider "${provider}" not found`
          });
        } else {
          fail(`Provider "${provider}" not found`);
        }
        process.exit(1);
      }
      const healthResult = await providerInstance.checkHealth();
      if (json2) {
        json({
          provider,
          success: healthResult,
          duration,
          message: healthResult ? "Provider is healthy" : "Provider health check failed"
        });
      } else {
        if (healthResult) {
          succeed(`${provider} is working (${duration}ms)`);
        } else {
          fail(`${provider} test failed`);
        }
      }
      process.exit(healthResult ? 0 : 1);
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
      const sessions = await ctx.sessionManager.list(
        state !== void 0 || agent !== void 0 ? { state, agent } : void 0
      );
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
var createCommand = {
  command: "create",
  describe: "Create a new session",
  builder: (yargs2) => yargs2.option("name", {
    alias: "n",
    describe: "Session name",
    type: "string",
    default: "New Session"
  }).option("description", {
    alias: "d",
    describe: "Session description",
    type: "string"
  }).option("goal", {
    alias: "g",
    describe: "Session goal",
    type: "string"
  }).option("agents", {
    alias: "a",
    describe: "Initial agents",
    type: "array",
    default: [],
    coerce: (arr) => arr.map(String)
  }).option("tags", {
    alias: "t",
    describe: "Session tags",
    type: "array",
    default: [],
    coerce: (arr) => arr.map(String)
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    try {
      const { name, description, goal, agents, tags, json: json2 } = argv;
      if (!json2) {
        start("Creating session...");
      }
      const ctx = await getContext();
      const session = await ctx.sessionManager.create({
        name,
        description,
        goal,
        agents,
        tags
      });
      if (json2) {
        json(session);
      } else {
        succeed(`Created session: ${session.id}`);
        newline();
        keyValue("ID", session.id);
        keyValue("Name", session.name);
        keyValue("State", statusBadge(session.state));
        if (session.description) {
          keyValue("Description", session.description);
        }
        if (session.goal) {
          keyValue("Goal", session.goal);
        }
        if (session.agents.length > 0) {
          keyValue("Agents", session.agents.join(", "));
        }
        if (session.tags.length > 0) {
          keyValue("Tags", session.tags.join(", "));
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      error("Failed to create session", message);
      process.exit(1);
    }
  }
};
var sessionCommand = {
  command: "session",
  describe: "Manage sessions",
  builder: (yargs2) => yargs2.command(listCommand4).command(infoCommand2).command(createCommand).demandCommand(1, "Please specify a subcommand"),
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
      const healthStatus = await ctx.providerRouter.checkAllHealth();
      const memoryStats = ctx.memoryManager.getStats();
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
          size: memoryStats.databaseSizeBytes
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
          const h = health;
          listItem(
            `${providerBadge(provider)}: ${statusBadge(h.healthy ? "healthy" : "unhealthy")}`
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
        keyValue("Default", config.providers.default);
        keyValue("Fallback Order", config.providers.fallbackOrder?.join(" \u2192 ") ?? "None configured");
        newline();
        section("Router");
        keyValue("Health Check Interval", formatDuration(config.router.healthCheckInterval));
        keyValue("Prefer MCP", config.router.preferMcp ? "Yes" : "No");
        newline();
        section("Execution");
        keyValue("Default Timeout", formatDuration(config.execution.timeout));
        keyValue("Max Retries", config.execution.retry.maxAttempts);
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
        const healthStatus = await ctx.providerRouter.checkAllHealth();
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

// src/commands/setup.ts
import { access as access2, mkdir, writeFile as writeFile2, readdir, readFile as readFile2, copyFile } from "fs/promises";
import { join as join3, dirname } from "path";
import { fileURLToPath } from "url";
var AUTOMATOSX_DIR = ".automatosx";
var CONFIG_FILE = "ax.config.json";
var DIRECTORIES = ["agents", "memory", "sessions", "abilities", "teams", "templates"];
var DEFAULT_CONFIG = {
  $schema: "https://automatosx.dev/schema/config.json",
  version: "11.0.0",
  providers: {
    default: "ax-cli",
    fallbackOrder: ["ax-cli"]
  },
  router: {
    healthCheckInterval: 3e4,
    preferMcp: true,
    routingStrategy: "capability-first"
  },
  execution: {
    timeout: 15e5,
    retry: {
      maxAttempts: 3,
      initialDelay: 1e3,
      maxDelay: 1e4,
      backoffMultiplier: 2
    },
    streaming: true
  },
  memory: {
    maxEntries: 1e4,
    autoCleanup: true,
    cleanupStrategy: "lru",
    retentionDays: 90
  },
  agents: {
    defaultAgent: "standard",
    maxDelegationDepth: 3,
    enableAutoSelection: true
  }
};
async function directoryExists(path) {
  try {
    await access2(path);
    return true;
  } catch {
    return false;
  }
}
async function findPackageAgents() {
  const searchPaths = [
    // Development: relative to CLI source
    join3(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", ".automatosx", "agents"),
    // Installed: in node_modules
    join3(process.cwd(), "node_modules", "@ax", "cli", "agents"),
    // Global install
    join3(dirname(fileURLToPath(import.meta.url)), "..", "agents")
  ];
  for (const searchPath of searchPaths) {
    if (await directoryExists(searchPath)) {
      return searchPath;
    }
  }
  return null;
}
async function copyAgents(sourcePath, targetPath) {
  const files = await readdir(sourcePath);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  for (const file of yamlFiles) {
    await copyFile(join3(sourcePath, file), join3(targetPath, file));
  }
  return yamlFiles.length;
}
async function createMinimalAgents(targetPath) {
  const standardAgent = `# Standard Agent
# A general-purpose agent for handling diverse tasks

name: standard
displayName: Standard Agent
role: General Purpose Assistant
team: default
description: A versatile agent capable of handling a wide variety of tasks including research, analysis, coding assistance, and general problem-solving.

abilities:
  - general-assistance
  - research
  - analysis
  - code-review
  - documentation

personality:
  traits:
    - helpful
    - thorough
    - adaptable
  communicationStyle: technical
  decisionMaking: analytical

orchestration:
  maxDelegationDepth: 2
  canWriteToShared: true
  canDelegateTo:
    - backend
    - frontend
    - security
    - quality
  priority: 5

systemPrompt: |
  You are a Standard Agent, a versatile AI assistant capable of handling diverse tasks.

  Your capabilities include:
  - Research and analysis
  - Code review and assistance
  - Documentation writing
  - General problem-solving
  - Task coordination

  When you receive a task:
  1. Analyze what type of task it is
  2. Determine if you can handle it or should delegate
  3. Execute the task thoroughly
  4. Provide clear, actionable output

  If a task would be better handled by a specialist agent, suggest delegation.

enabled: true
version: "1.0.0"
`;
  await writeFile2(join3(targetPath, "standard.yaml"), standardAgent);
  return 1;
}
var setupCommand = {
  command: "setup",
  describe: "Initialize AutomatosX in your project",
  builder: (yargs2) => yargs2.option("force", {
    alias: "f",
    describe: "Overwrite existing configuration",
    type: "boolean",
    default: false
  }).option("json", {
    describe: "Output as JSON",
    type: "boolean",
    default: false
  }),
  handler: async (argv) => {
    const { force, json: json2 } = argv;
    const basePath = join3(process.cwd(), AUTOMATOSX_DIR);
    const result = {
      success: false,
      basePath,
      configPath: join3(process.cwd(), CONFIG_FILE),
      directories: [],
      agentsCopied: 0,
      messages: []
    };
    try {
      const exists = await directoryExists(basePath);
      if (exists && !force) {
        if (json2) {
          json({
            success: false,
            error: "AutomatosX already initialized",
            suggestion: "Use --force to reinitialize"
          });
        } else {
          error("AutomatosX already initialized", "Use --force to reinitialize");
        }
        process.exit(1);
      }
      if (!json2) {
        start("Setting up AutomatosX...");
      }
      for (const dir of DIRECTORIES) {
        const dirPath = join3(basePath, dir);
        await mkdir(dirPath, { recursive: true });
        result.directories.push(dir);
        if (!json2) {
          update(`Creating ${dir} directory...`);
        }
      }
      result.messages.push(`Created ${DIRECTORIES.length} directories`);
      if (!json2) {
        update("Installing default agents...");
      }
      const agentsPath = join3(basePath, "agents");
      const sourceAgentsPath = await findPackageAgents();
      if (sourceAgentsPath) {
        result.agentsCopied = await copyAgents(sourceAgentsPath, agentsPath);
        result.messages.push(`Copied ${result.agentsCopied} agents`);
      } else {
        result.agentsCopied = await createMinimalAgents(agentsPath);
        result.messages.push(`Created ${result.agentsCopied} minimal agent(s)`);
      }
      if (!json2) {
        update("Creating configuration...");
      }
      const configPath = join3(process.cwd(), CONFIG_FILE);
      const configExists = await directoryExists(configPath);
      if (!configExists || force) {
        await writeFile2(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
        result.messages.push("Created ax.config.json");
      } else {
        result.messages.push("Config file exists, skipping");
      }
      const gitignorePath = join3(process.cwd(), ".gitignore");
      const gitignoreEntries = `
# AutomatosX
.automatosx/memory/
.automatosx/sessions/
`;
      try {
        const existingGitignore = await readFile2(gitignorePath, "utf-8");
        if (!existingGitignore.includes(".automatosx/memory/")) {
          result.messages.push("Consider adding .automatosx/memory/ and .automatosx/sessions/ to .gitignore");
        }
      } catch {
      }
      result.success = true;
      if (json2) {
        json(result);
      } else {
        succeed("AutomatosX initialized successfully!");
        newline();
        section("Created Structure");
        keyValue("Base Path", result.basePath);
        for (const dir of result.directories) {
          listItem(dir);
        }
        newline();
        section("Configuration");
        keyValue("Config File", result.configPath);
        keyValue("Agents", result.agentsCopied);
        newline();
        divider();
        newline();
        info("Next Steps:");
        listItem("ax agent list     - See available agents");
        listItem('ax run backend "your task"  - Run a task');
        listItem("ax status         - Check system status");
        listItem("ax doctor         - Run diagnostics");
        if (result.agentsCopied < 5) {
          newline();
          warning("Limited agents installed. Consider copying agents from the AutomatosX repository.");
        }
      }
    } catch (error2) {
      stop();
      const message = error2 instanceof Error ? error2.message : "Unknown error";
      if (json2) {
        json({
          success: false,
          error: message
        });
      } else {
        error("Setup failed", message);
      }
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
    await yargs(hideBin(process.argv)).scriptName("ax").usage(LOGO + "\nUsage: $0 <command> [options]").command(runCommand).command(setupCommand).command(agentCommand).command(memoryCommand).command(providerCommand).command(sessionCommand).command(statusCommand2).command(configCommand).command(doctorCommand).option("debug", {
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
    }).demandCommand(1, 'Please specify a command. Run "ax --help" for usage.').strict().example("$0 setup", "Initialize AutomatosX in your project").example('$0 run backend "implement user auth"', "Run a task with the backend agent").example("$0 agent list", "List all available agents").example('$0 memory search "authentication"', "Search memory for past conversations").example("$0 status", "Show system status").example("$0 doctor", "Run system diagnostics").epilog(
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
 * Setup Command
 *
 * Initialize AutomatosX in the current project.
 *
 * Usage:
 *   ax setup              - Initialize with default settings
 *   ax setup --force      - Reinitialize even if already exists
 *
 * @module @ax/cli/commands/setup
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