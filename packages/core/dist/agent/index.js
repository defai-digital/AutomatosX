// src/agent/loader.ts
import { readFile, readdir, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { parse as parseYaml } from "yaml";
import {
  validateAgentProfile
} from "@ax/schemas";
var AGENTS_DIR = "agents";
var AGENT_FILE_EXTENSIONS = [".yaml", ".yml"];
var AgentLoader = class {
  basePath;
  agentsPath;
  loadedAgents = /* @__PURE__ */ new Map();
  loadErrors = [];
  constructor(options) {
    this.basePath = options.basePath;
    this.agentsPath = join(options.basePath, AGENTS_DIR);
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Load all agent profiles from the agents directory
   */
  async loadAll() {
    this.loadedAgents.clear();
    this.loadErrors.length = 0;
    try {
      const files = await readdir(this.agentsPath);
      const agentFiles = files.filter(
        (f) => AGENT_FILE_EXTENSIONS.includes(extname(f).toLowerCase())
      );
      for (const file of agentFiles) {
        await this.loadAgentFile(file);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    return {
      agents: Array.from(this.loadedAgents.values()),
      errors: [...this.loadErrors]
    };
  }
  /**
   * Load a specific agent by ID
   */
  async loadAgent(agentId) {
    for (const ext of AGENT_FILE_EXTENSIONS) {
      const filePath = join(this.agentsPath, `${agentId}${ext}`);
      try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
          return this.loadAgentFromPath(filePath);
        }
      } catch {
      }
    }
    return null;
  }
  /**
   * Load agent from a specific file path
   */
  async loadAgentFromPath(filePath) {
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = parseYaml(content);
      const profile = validateAgentProfile(parsed);
      const loaded = {
        profile,
        filePath,
        loadedAt: /* @__PURE__ */ new Date()
      };
      this.loadedAgents.set(profile.name, loaded);
      return loaded;
    } catch (error) {
      const agentId = basename(filePath, extname(filePath));
      this.loadErrors.push({
        agentId,
        filePath,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return null;
    }
  }
  /**
   * Get a loaded agent by ID
   */
  get(agentId) {
    return this.loadedAgents.get(agentId);
  }
  /**
   * Get all loaded agents
   */
  getAll() {
    return Array.from(this.loadedAgents.values());
  }
  /**
   * Get all agent IDs
   */
  getIds() {
    return Array.from(this.loadedAgents.keys());
  }
  /**
   * Check if an agent exists
   */
  has(agentId) {
    return this.loadedAgents.has(agentId);
  }
  /**
   * Get load errors
   */
  getErrors() {
    return [...this.loadErrors];
  }
  /**
   * Reload all agents
   */
  async reload() {
    return this.loadAll();
  }
  /**
   * Reload a specific agent
   */
  async reloadAgent(agentId) {
    return this.loadAgent(agentId);
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Load an agent from a file in the agents directory
   */
  async loadAgentFile(fileName) {
    const filePath = join(this.agentsPath, fileName);
    await this.loadAgentFromPath(filePath);
  }
};
function createAgentLoader(options) {
  return new AgentLoader(options);
}

// src/agent/registry.ts
import "@ax/schemas";

// src/errors.ts
var AutomatosXError = class extends Error {
  /** Error code for programmatic handling */
  code;
  /** Suggestion for how to fix the error */
  suggestion;
  /** Additional context data */
  context;
  constructor(message, code, options) {
    super(message, options?.cause ? { cause: options.cause } : void 0);
    this.name = "AutomatosXError";
    this.code = code;
    this.suggestion = options?.suggestion;
    this.context = options?.context;
  }
  /**
   * Get formatted error message with suggestion
   */
  toUserMessage() {
    let msg = `${this.message}`;
    if (this.suggestion) {
      msg += `
  Suggestion: ${this.suggestion}`;
    }
    return msg;
  }
};
var AgentNotFoundError = class extends AutomatosXError {
  constructor(agentId, options) {
    let message = `Agent "${agentId}" not found`;
    let suggestion;
    if (options?.similarAgents && options.similarAgents.length > 0) {
      suggestion = `Did you mean: ${options.similarAgents.join(", ")}?`;
    } else if (options?.availableAgents && options.availableAgents.length > 0) {
      const preview = options.availableAgents.slice(0, 5).join(", ");
      const more = options.availableAgents.length > 5 ? ` (and ${options.availableAgents.length - 5} more)` : "";
      suggestion = `Available agents: ${preview}${more}. Run "ax agent list" to see all.`;
    } else {
      suggestion = 'Run "ax agent list" to see available agents.';
    }
    super(message, "AGENT_NOT_FOUND", {
      suggestion,
      context: {
        requestedAgent: agentId,
        availableAgents: options?.availableAgents,
        similarAgents: options?.similarAgents
      }
    });
    this.name = "AgentNotFoundError";
  }
};
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          // substitution
          matrix[i][j - 1] + 1,
          // insertion
          matrix[i - 1][j] + 1
          // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
function findSimilar(input, options, maxDistance = 2) {
  const inputLower = input.toLowerCase();
  return options.filter((opt) => {
    const optLower = opt.toLowerCase();
    return optLower.includes(inputLower) || inputLower.includes(optLower) || levenshteinDistance(inputLower, optLower) <= maxDistance;
  }).slice(0, 3);
}

// src/agent/registry.ts
var AgentRegistry = class {
  loader;
  agents = /* @__PURE__ */ new Map();
  byTeam = /* @__PURE__ */ new Map();
  byAbility = /* @__PURE__ */ new Map();
  events = {};
  initialized = false;
  constructor(options) {
    this.loader = options.loader;
  }
  // =============================================================================
  // Lifecycle Methods
  // =============================================================================
  /**
   * Initialize registry by loading all agents
   */
  async initialize() {
    if (this.initialized) {
      return { loaded: this.agents.size, errors: [] };
    }
    const { agents, errors } = await this.loader.loadAll();
    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }
    this.initialized = true;
    return {
      loaded: agents.length,
      errors
    };
  }
  /**
   * Reload all agents from disk
   */
  async reload() {
    this.agents.clear();
    this.byTeam.clear();
    this.byAbility.clear();
    const { agents, errors } = await this.loader.reload();
    for (const loaded of agents) {
      this.registerAgent(loaded.profile);
    }
    this.events.onReloaded?.(Array.from(this.agents.values()));
    return {
      loaded: agents.length,
      errors
    };
  }
  // =============================================================================
  // Agent Operations
  // =============================================================================
  /**
   * Register an agent profile
   */
  registerAgent(profile) {
    const id = profile.name;
    this.agents.set(id, profile);
    const team = profile.team ?? "default";
    if (!this.byTeam.has(team)) {
      this.byTeam.set(team, /* @__PURE__ */ new Set());
    }
    this.byTeam.get(team).add(id);
    for (const ability of profile.abilities) {
      if (!this.byAbility.has(ability)) {
        this.byAbility.set(ability, /* @__PURE__ */ new Set());
      }
      this.byAbility.get(ability).add(id);
    }
    this.events.onAgentRegistered?.(profile);
  }
  /**
   * Remove an agent from registry
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    this.agents.delete(agentId);
    const team = agent.team ?? "default";
    this.byTeam.get(team)?.delete(agentId);
    if (this.byTeam.get(team)?.size === 0) {
      this.byTeam.delete(team);
    }
    for (const ability of agent.abilities) {
      this.byAbility.get(ability)?.delete(agentId);
      if (this.byAbility.get(ability)?.size === 0) {
        this.byAbility.delete(ability);
      }
    }
    this.events.onAgentRemoved?.(agentId);
    return true;
  }
  /**
   * Get agent by ID
   */
  get(agentId) {
    return this.agents.get(agentId);
  }
  /**
   * Get agent by ID (throws if not found)
   */
  getOrThrow(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      const availableAgents = Array.from(this.agents.keys());
      const similarAgents = findSimilar(agentId, availableAgents);
      throw new AgentNotFoundError(agentId, {
        availableAgents,
        similarAgents
      });
    }
    return agent;
  }
  /**
   * Check if agent exists
   */
  has(agentId) {
    return this.agents.has(agentId);
  }
  /**
   * Get all agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }
  /**
   * Get all agent IDs
   */
  getIds() {
    return Array.from(this.agents.keys());
  }
  /**
   * Get agent count
   */
  get size() {
    return this.agents.size;
  }
  // =============================================================================
  // Query Methods
  // =============================================================================
  /**
   * Find agents matching filter criteria
   */
  find(filter) {
    let results = Array.from(this.agents.values());
    if (filter.team) {
      const teamAgents = this.byTeam.get(filter.team);
      if (!teamAgents) return [];
      results = results.filter((a) => teamAgents.has(a.name));
    }
    if (filter.ability) {
      const abilityAgents = this.byAbility.get(filter.ability);
      if (!abilityAgents) return [];
      results = results.filter((a) => abilityAgents.has(a.name));
    }
    if (filter.abilities && filter.abilities.length > 0) {
      results = results.filter(
        (a) => filter.abilities.some((ability) => a.abilities.includes(ability))
      );
    }
    if (filter.communicationStyle) {
      results = results.filter(
        (a) => a.personality?.communicationStyle === filter.communicationStyle
      );
    }
    if (filter.canDelegate !== void 0) {
      if (filter.canDelegate) {
        results = results.filter(
          (a) => a.orchestration && a.orchestration.maxDelegationDepth > 0
        );
      } else {
        results = results.filter(
          (a) => !a.orchestration || a.orchestration.maxDelegationDepth === 0
        );
      }
    }
    return results;
  }
  /**
   * Get agents by team
   */
  getByTeam(team) {
    const agentIds = this.byTeam.get(team);
    if (!agentIds) return [];
    return Array.from(agentIds).map((id) => this.agents.get(id)).filter(Boolean);
  }
  /**
   * Get all team names
   */
  getTeams() {
    return Array.from(this.byTeam.keys());
  }
  /**
   * Get agents by ability
   */
  getByAbility(ability) {
    const agentIds = this.byAbility.get(ability);
    if (!agentIds) return [];
    return Array.from(agentIds).map((id) => this.agents.get(id)).filter(Boolean);
  }
  /**
   * Get all available abilities
   */
  getAbilities() {
    return Array.from(this.byAbility.keys());
  }
  /**
   * Find agents that can perform a specific task type
   */
  findForTask(taskType) {
    const taskAbilityMap = {
      coding: ["code-generation", "implementation", "development"],
      testing: ["testing", "quality-assurance", "test-writing"],
      review: ["code-review", "analysis", "audit"],
      design: ["architecture", "design", "planning"],
      documentation: ["technical-writing", "documentation"],
      debugging: ["debugging", "troubleshooting"],
      security: ["security-audit", "threat-modeling"],
      data: ["data-engineering", "data-analysis"]
    };
    const requiredAbilities = taskAbilityMap[taskType.toLowerCase()] ?? [];
    if (requiredAbilities.length === 0) {
      return this.getAll();
    }
    return this.find({ abilities: requiredAbilities });
  }
  // =============================================================================
  // Event Management
  // =============================================================================
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
};
function createAgentRegistry(options) {
  return new AgentRegistry(options);
}

// src/agent/executor.ts
import {
  DelegationRequestSchema,
  DelegationResultSchema
} from "@ax/schemas";

// src/router/provider-router.ts
import "@ax/schemas";
import {
  selectProvider,
  getFallbackOrder,
  defaultRoutingContext
} from "@ax/algorithms";
import {
  createProvider
} from "@ax/providers";

// src/session/manager.ts
import { randomUUID } from "crypto";
import { readFile as readFile2, writeFile, readdir as readdir2, mkdir, unlink, stat as stat2 } from "fs/promises";
import { join as join2, basename as basename2 } from "path";
import {
  SessionSchema,
  SessionTaskSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  createSessionSummary
} from "@ax/schemas";

// src/memory/manager.ts
import Database from "better-sqlite3";
import {
  MemoryEntrySchema,
  MemoryCleanupConfigSchema
} from "@ax/schemas";

// src/agent/executor.ts
var DEFAULT_EXECUTION_TIMEOUT_MS = 3e5;
var MAX_DELEGATION_DEPTH = 3;
var DEFAULT_AGENT_ID = "standard";
var AgentExecutor = class {
  router;
  sessionManager;
  agentRegistry;
  memoryManager;
  defaultTimeout;
  events = {};
  constructor(options) {
    this.router = options.router;
    this.sessionManager = options.sessionManager;
    this.agentRegistry = options.agentRegistry;
    this.memoryManager = options.memoryManager ?? null;
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  }
  // =============================================================================
  // Public Methods
  // =============================================================================
  /**
   * Execute a task with a specific agent
   */
  async execute(agentId, task, options = {}) {
    const session = options.sessionId ? await this.sessionManager.getOrThrow(options.sessionId) : await this.sessionManager.create({
      name: `Task: ${task.substring(0, 50)}...`,
      agents: [agentId]
    });
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      const defaultAgent = this.agentRegistry.get(DEFAULT_AGENT_ID);
      if (!defaultAgent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      console.warn(`[ax/executor] Agent "${agentId}" not found, using "${DEFAULT_AGENT_ID}"`);
      return this.executeWithAgent(defaultAgent, task, session, options);
    }
    return this.executeWithAgent(agent, task, session, options);
  }
  /**
   * Execute a task with automatic agent selection
   */
  async executeAuto(task, options = {}) {
    const taskType = this.inferTaskType(task);
    const candidates = this.agentRegistry.findForTask(taskType);
    if (candidates.length === 0) {
      return this.execute(DEFAULT_AGENT_ID, task, options);
    }
    const selectedAgent = candidates[0];
    return this.execute(selectedAgent.name, task, options);
  }
  /**
   * Delegate a task from one agent to another
   */
  async delegate(request) {
    const validated = DelegationRequestSchema.parse(request);
    const startTime = Date.now();
    const currentDepth = validated.context.delegationChain.length;
    if (currentDepth >= MAX_DELEGATION_DEPTH) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Maximum delegation depth (${MAX_DELEGATION_DEPTH}) exceeded`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
    const targetAgent = this.agentRegistry.get(validated.toAgent);
    if (!targetAgent) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Target agent not found: ${validated.toAgent}`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
    const sourceAgent = this.agentRegistry.get(validated.fromAgent);
    if (sourceAgent) {
      const maxDepth = sourceAgent.orchestration?.maxDelegationDepth ?? 0;
      if (maxDepth === 0) {
        return DelegationResultSchema.parse({
          success: false,
          request: validated,
          error: `Agent "${validated.fromAgent}" is not allowed to delegate`,
          duration: Date.now() - startTime,
          completedBy: validated.fromAgent
        });
      }
    }
    this.events.onDelegation?.(validated.fromAgent, validated.toAgent, validated.task);
    try {
      const executeOptions = {
        timeout: validated.options.timeout,
        context: validated.context.sharedData,
        delegationChain: [...validated.context.delegationChain, validated.fromAgent]
      };
      if (validated.context.sessionId) {
        executeOptions.sessionId = validated.context.sessionId;
      }
      const result = await this.execute(validated.toAgent, validated.task, executeOptions);
      return DelegationResultSchema.parse({
        success: result.response.success,
        request: validated,
        result: result.response.output,
        error: result.response.error,
        duration: Date.now() - startTime,
        completedBy: validated.toAgent
      });
    } catch (error) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent
      });
    }
  }
  /**
   * Set event handlers
   */
  setEvents(events) {
    Object.assign(this.events, events);
  }
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Execute task with a specific agent profile
   */
  async executeWithAgent(agent, task, session, options) {
    const agentId = agent.name;
    this.events.onExecutionStart?.(agentId, task);
    const sessionTask = await this.sessionManager.addTask({
      sessionId: session.id,
      description: task,
      agentId,
      metadata: {
        delegationChain: options.delegationChain ?? []
      }
    });
    await this.sessionManager.startTask(session.id, sessionTask.id);
    const request = {
      task: this.buildPrompt(agent, task, options.context),
      agent: agentId,
      context: {
        systemPrompt: agent.systemPrompt,
        abilities: agent.abilities,
        personality: agent.personality,
        delegationChain: options.delegationChain ?? [],
        ...options.context
      },
      timeout: options.timeout ?? this.defaultTimeout,
      stream: options.stream ?? false,
      priority: "normal"
    };
    try {
      const response = await this.router.route(request);
      if (response.success) {
        await this.sessionManager.completeTask(session.id, sessionTask.id, response.output);
      } else {
        await this.sessionManager.failTask(session.id, sessionTask.id, response.error ?? "Unknown error");
      }
      if (options.saveToMemory !== false && this.memoryManager && response.success) {
        this.saveToMemory(agentId, task, response.output, session.id);
      }
      const updatedSession = await this.sessionManager.getOrThrow(session.id);
      const updatedTask = updatedSession.tasks.find((t) => t.id === sessionTask.id);
      const result = {
        response,
        session: updatedSession,
        task: updatedTask,
        agentId,
        delegated: (options.delegationChain?.length ?? 0) > 0
      };
      this.events.onExecutionEnd?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.sessionManager.failTask(session.id, sessionTask.id, errorMessage);
      this.events.onError?.(agentId, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }
  /**
   * Build prompt with agent context
   */
  buildPrompt(agent, task, additionalContext) {
    const parts = [];
    if (agent.systemPrompt) {
      parts.push(`[Agent Context]
${agent.systemPrompt}
`);
    }
    if (agent.personality) {
      const { traits, communicationStyle, catchphrase } = agent.personality;
      parts.push(`[Communication]
Style: ${communicationStyle}
Traits: ${traits.join(", ")}`);
      if (catchphrase) {
        parts.push(`Catchphrase: "${catchphrase}"`);
      }
      parts.push("");
    }
    if (agent.abilities.length > 0) {
      parts.push(`[Abilities]
${agent.abilities.join(", ")}
`);
    }
    if (additionalContext && Object.keys(additionalContext).length > 0) {
      parts.push(`[Additional Context]
${JSON.stringify(additionalContext, null, 2)}
`);
    }
    parts.push(`[Task]
${task}`);
    return parts.join("\n");
  }
  /**
   * Infer task type from description
   */
  inferTaskType(task) {
    const lowerTask = task.toLowerCase();
    if (lowerTask.includes("code") || lowerTask.includes("implement") || lowerTask.includes("write function")) {
      return "coding";
    }
    if (lowerTask.includes("test") || lowerTask.includes("verify") || lowerTask.includes("validate")) {
      return "testing";
    }
    if (lowerTask.includes("review") || lowerTask.includes("analyze") || lowerTask.includes("audit")) {
      return "review";
    }
    if (lowerTask.includes("design") || lowerTask.includes("architect") || lowerTask.includes("plan")) {
      return "design";
    }
    if (lowerTask.includes("document") || lowerTask.includes("explain") || lowerTask.includes("describe")) {
      return "documentation";
    }
    if (lowerTask.includes("fix") || lowerTask.includes("debug") || lowerTask.includes("resolve")) {
      return "debugging";
    }
    if (lowerTask.includes("security") || lowerTask.includes("vulnerabilit") || lowerTask.includes("threat")) {
      return "security";
    }
    return "general";
  }
  /**
   * Save execution result to memory
   */
  saveToMemory(agentId, task, result, sessionId) {
    if (!this.memoryManager) return;
    try {
      this.memoryManager.add({
        content: `Task: ${task}

Result: ${result}`,
        metadata: {
          type: "task",
          source: "agent-execution",
          agentId,
          sessionId,
          tags: ["execution", agentId],
          importance: 0.5
        }
      });
    } catch (error) {
      console.warn(
        `[ax/executor] Failed to save to memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
};
function createAgentExecutor(options) {
  return new AgentExecutor(options);
}

// src/agent/router.ts
import "@ax/schemas";
var AGENT_KEYWORDS = {
  backend: [
    "api",
    "database",
    "server",
    "rest",
    "graphql",
    "sql",
    "endpoint",
    "auth",
    "crud",
    "backend",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "cache",
    "microservice",
    "service",
    "controller",
    "middleware",
    "route",
    "go",
    "rust",
    "python",
    "java"
  ],
  frontend: [
    "ui",
    "component",
    "react",
    "vue",
    "angular",
    "css",
    "button",
    "form",
    "page",
    "frontend",
    "html",
    "javascript",
    "typescript",
    "tailwind",
    "styled",
    "layout",
    "responsive",
    "animation",
    "state",
    "redux",
    "nextjs",
    "svelte"
  ],
  devops: [
    "deploy",
    "ci",
    "cd",
    "docker",
    "kubernetes",
    "aws",
    "pipeline",
    "infrastructure",
    "terraform",
    "ansible",
    "helm",
    "github actions",
    "jenkins",
    "monitoring",
    "logging",
    "container",
    "cloud",
    "gcp",
    "azure",
    "nginx",
    "load balancer"
  ],
  security: [
    "vulnerability",
    "audit",
    "security",
    "penetration",
    "xss",
    "injection",
    "owasp",
    "encryption",
    "authentication",
    "authorization",
    "threat",
    "risk",
    "compliance",
    "ssl",
    "tls",
    "firewall",
    "breach",
    "cve"
  ],
  quality: [
    "test",
    "qa",
    "coverage",
    "bug",
    "e2e",
    "unit test",
    "integration test",
    "testing",
    "jest",
    "vitest",
    "cypress",
    "playwright",
    "assertion",
    "mock",
    "fixture",
    "spec"
  ],
  design: [
    "ux",
    "ui design",
    "wireframe",
    "mockup",
    "figma",
    "prototype",
    "accessibility",
    "a11y",
    "user experience",
    "user interface",
    "design system",
    "typography",
    "color",
    "visual"
  ],
  product: [
    "requirements",
    "user story",
    "roadmap",
    "feature",
    "prd",
    "product",
    "stakeholder",
    "priority",
    "backlog",
    "epic",
    "acceptance criteria",
    "mvp",
    "specification"
  ],
  data: [
    "etl",
    "analytics",
    "warehouse",
    "data model",
    "bigquery",
    "data",
    "spark",
    "airflow",
    "transformation",
    "schema",
    "migration",
    "batch",
    "streaming",
    "kafka"
  ],
  architecture: [
    "architecture",
    "system design",
    "adr",
    "scalability",
    "microservices",
    "monolith",
    "distributed",
    "event-driven",
    "saga",
    "cqrs",
    "ddd",
    "domain",
    "boundary",
    "technical debt"
  ],
  writer: [
    "documentation",
    "docs",
    "readme",
    "technical writing",
    "guide",
    "tutorial",
    "changelog",
    "api docs",
    "wiki",
    "manual",
    "instructions"
  ],
  mobile: [
    "ios",
    "android",
    "swift",
    "kotlin",
    "flutter",
    "mobile",
    "app",
    "react native",
    "expo",
    "xcode",
    "gradle",
    "cocoapods",
    "app store",
    "play store"
  ],
  fullstack: [
    "fullstack",
    "full-stack",
    "node",
    "express",
    "nest",
    "prisma",
    "trpc",
    "t3",
    "remix",
    "astro"
  ],
  researcher: [
    "research",
    "analyze",
    "investigate",
    "compare",
    "evaluate",
    "benchmark",
    "study",
    "explore",
    "survey",
    "assessment"
  ],
  "data-scientist": [
    "machine learning",
    "ml",
    "ai",
    "model",
    "training",
    "prediction",
    "classification",
    "regression",
    "neural network",
    "deep learning",
    "nlp",
    "computer vision",
    "tensorflow",
    "pytorch"
  ]
};
function selectAgent(task, registry, options = {}) {
  const result = selectAgentWithReason(task, registry, options);
  return result.agent;
}
function selectAgentWithReason(task, registry, options = {}) {
  const { defaultAgent = "standard", minMatches = 1 } = options;
  const taskLower = task.toLowerCase();
  const scores = [];
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const matched = keywords.filter((kw) => taskLower.includes(kw));
    if (matched.length >= minMatches) {
      scores.push({
        agentId,
        score: matched.length,
        keywords: matched
      });
    }
  }
  scores.sort((a, b) => b.score - a.score);
  const alternatives = scores.slice(1, 4).map((s) => s.agentId);
  if (scores.length > 0) {
    const best = scores[0];
    const agent = registry.get(best.agentId);
    if (agent) {
      const maxPossibleMatches = AGENT_KEYWORDS[best.agentId]?.length ?? 1;
      const confidence = Math.min(best.score / Math.max(maxPossibleMatches / 3, 1), 1);
      return {
        agent,
        reason: `Selected ${best.agentId} agent based on keywords: ${best.keywords.join(", ")}`,
        matchedKeywords: best.keywords,
        confidence,
        alternatives
      };
    }
  }
  const fallbackAgent = registry.get(defaultAgent);
  if (fallbackAgent) {
    return {
      agent: fallbackAgent,
      reason: "No keyword matches, using default agent",
      matchedKeywords: [],
      confidence: 0.5,
      alternatives: []
    };
  }
  const allAgents = registry.getAll();
  if (allAgents.length > 0) {
    return {
      agent: allAgents[0],
      reason: "Using first available agent (no default found)",
      matchedKeywords: [],
      confidence: 0.1,
      alternatives: allAgents.slice(1, 4).map((a) => a.name)
    };
  }
  throw new Error("No agents available in registry");
}
function getAgentKeywords(agentId) {
  return AGENT_KEYWORDS[agentId] ?? [];
}
function getAllKeywords() {
  return { ...AGENT_KEYWORDS };
}
function findAgentsByKeyword(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  return Object.entries(AGENT_KEYWORDS).filter(([, keywords]) => keywords.some((k) => k.includes(lowerKeyword))).map(([agentId]) => agentId);
}
export {
  AGENT_KEYWORDS,
  AgentExecutor,
  AgentLoader,
  AgentRegistry,
  createAgentExecutor,
  createAgentLoader,
  createAgentRegistry,
  findAgentsByKeyword,
  getAgentKeywords,
  getAllKeywords,
  selectAgent,
  selectAgentWithReason
};
/**
 * Agent Loader - Load agent profiles from YAML files
 *
 * Loads and validates agent profiles from the .automatosx/agents directory.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * AutomatosX Error Classes
 *
 * Provides structured error types with helpful suggestions for users.
 *
 * @module @ax/core/errors
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Registry - Central registry for agent profiles
 *
 * Provides fast lookup and querying of agent profiles with
 * support for teams, abilities, and filtering.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Provider Router - Intelligent provider selection and routing
 *
 * Uses ReScript routing algorithms for multi-factor provider selection
 * with health monitoring and fallback chain support.
 *
 * @module @ax/core/router
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Session Manager - Session lifecycle and state management
 *
 * Manages multi-agent sessions with task tracking, state persistence,
 * and checkpoint support for resumable workflows.
 *
 * @module @ax/core/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Memory Manager - FTS5-based persistent memory system
 *
 * Provides fast full-text search using SQLite FTS5 for agent memory.
 * All data is stored locally for privacy.
 *
 * @module @ax/core/memory
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent Executor - Task execution engine for agents
 *
 * Executes tasks using agent profiles with support for
 * delegation, session tracking, and memory integration.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Simple Agent Router - Keyword-based agent selection
 *
 * Provides fast, simple agent selection based on keyword matching.
 * This is intentionally simple - complex ML-based routing was deemed
 * over-engineering. Simple keyword matching works just as well.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Agent exports
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map