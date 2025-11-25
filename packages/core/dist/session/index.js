// src/session/manager.ts
import { randomUUID } from "crypto";
import { readFile, writeFile, readdir, mkdir, unlink, stat } from "fs/promises";
import { join, basename } from "path";
import {
  SessionSchema,
  SessionTaskSchema,
  CreateSessionInputSchema,
  AddTaskInputSchema,
  UpdateTaskInputSchema,
  createSessionSummary
} from "@ax/schemas";
var DEFAULT_SESSION_NAME = "Untitled Session";
var MAX_IN_MEMORY_SESSIONS = 100;
var SESSION_FILE_EXT = ".json";
var SESSIONS_DIR = "sessions";
var SessionManager = class {
  storagePath;
  sessionsPath;
  maxInMemorySessions;
  autoPersist;
  sessions = /* @__PURE__ */ new Map();
  events = {};
  initialized = false;
  constructor(options) {
    this.storagePath = options.storagePath;
    this.sessionsPath = join(options.storagePath, SESSIONS_DIR);
    this.maxInMemorySessions = options.maxInMemorySessions ?? MAX_IN_MEMORY_SESSIONS;
    this.autoPersist = options.autoPersist ?? true;
  }
  // =============================================================================
  // Lifecycle Methods
  // =============================================================================
  /**
   * Initialize session manager and load existing sessions
   */
  async initialize() {
    if (this.initialized) return;
    await mkdir(this.sessionsPath, { recursive: true });
    await this.loadRecentSessions();
    this.initialized = true;
  }
  /**
   * Cleanup and persist all sessions
   */
  async cleanup() {
    if (this.autoPersist) {
      await this.persistAll();
    }
    this.sessions.clear();
    this.initialized = false;
  }
  // =============================================================================
  // Session CRUD Operations
  // =============================================================================
  /**
   * Create a new session
   */
  async create(input) {
    const validated = CreateSessionInputSchema.parse(input);
    const now = /* @__PURE__ */ new Date();
    const sessionId = this.generateSessionId();
    const tasks = (validated.tasks ?? []).map(
      (t) => SessionTaskSchema.parse({
        id: randomUUID(),
        description: t.description,
        agentId: t.agentId,
        status: "pending"
      })
    );
    const session = SessionSchema.parse({
      id: sessionId,
      name: validated.name || DEFAULT_SESSION_NAME,
      description: validated.description,
      state: "active",
      agents: validated.agents,
      tasks,
      createdAt: now,
      updatedAt: now,
      goal: validated.goal,
      tags: validated.tags ?? [],
      metadata: validated.metadata
    });
    this.sessions.set(session.id, session);
    this.evictOldSessions();
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    this.events.onSessionCreated?.(session);
    return session;
  }
  /**
   * Get session by ID
   */
  async get(sessionId) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.loadSession(sessionId);
      if (session) {
        this.sessions.set(session.id, session);
        this.evictOldSessions();
      }
    }
    return session ?? null;
  }
  /**
   * Get session (throws if not found)
   */
  async getOrThrow(sessionId) {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
  /**
   * List sessions with optional filtering
   */
  async list(filter) {
    await this.loadAllSessions();
    let sessions = Array.from(this.sessions.values());
    if (filter) {
      if (filter.state) {
        sessions = sessions.filter((s) => s.state === filter.state);
      }
      if (filter.agent) {
        sessions = sessions.filter((s) => s.agents.includes(filter.agent));
      }
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(
          (s) => filter.tags.some((tag) => s.tags.includes(tag))
        );
      }
      if (filter.createdAfter) {
        sessions = sessions.filter((s) => s.createdAt >= filter.createdAfter);
      }
      if (filter.createdBefore) {
        sessions = sessions.filter((s) => s.createdAt <= filter.createdBefore);
      }
    }
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return sessions.map(createSessionSummary);
  }
  /**
   * Update session state
   */
  async updateState(sessionId, state) {
    const session = await this.getOrThrow(sessionId);
    session.state = state;
    session.updatedAt = /* @__PURE__ */ new Date();
    if (state === "completed" || state === "failed" || state === "cancelled") {
      session.completedAt = /* @__PURE__ */ new Date();
      session.duration = session.completedAt.getTime() - session.createdAt.getTime();
    }
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    this.events.onSessionUpdated?.(session);
    if (state === "completed") {
      this.events.onSessionCompleted?.(session);
    }
    return session;
  }
  /**
   * Complete a session
   */
  async complete(sessionId) {
    return this.updateState(sessionId, "completed");
  }
  /**
   * Pause a session
   */
  async pause(sessionId) {
    return this.updateState(sessionId, "paused");
  }
  /**
   * Resume a paused session
   */
  async resume(sessionId) {
    const session = await this.getOrThrow(sessionId);
    if (session.state !== "paused") {
      throw new Error(`Cannot resume session in state: ${session.state}`);
    }
    return this.updateState(sessionId, "active");
  }
  /**
   * Cancel a session
   */
  async cancel(sessionId) {
    return this.updateState(sessionId, "cancelled");
  }
  /**
   * Fail a session
   */
  async fail(sessionId, error) {
    const session = await this.getOrThrow(sessionId);
    session.state = "failed";
    session.updatedAt = /* @__PURE__ */ new Date();
    session.completedAt = /* @__PURE__ */ new Date();
    session.duration = session.completedAt.getTime() - session.createdAt.getTime();
    if (error) {
      session.metadata = {
        ...session.metadata,
        failureReason: error
      };
    }
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    this.events.onSessionUpdated?.(session);
    return session;
  }
  /**
   * Delete a session
   */
  async delete(sessionId) {
    this.sessions.delete(sessionId);
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
  // =============================================================================
  // Task Operations
  // =============================================================================
  /**
   * Add a task to a session
   */
  async addTask(input) {
    const validated = AddTaskInputSchema.parse(input);
    const session = await this.getOrThrow(validated.sessionId);
    const task = SessionTaskSchema.parse({
      id: randomUUID(),
      description: validated.description,
      agentId: validated.agentId,
      status: "pending",
      parentTaskId: validated.parentTaskId,
      metadata: validated.metadata
    });
    session.tasks.push(task);
    session.updatedAt = /* @__PURE__ */ new Date();
    if (!session.agents.includes(validated.agentId)) {
      session.agents.push(validated.agentId);
    }
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    this.events.onTaskAdded?.(session, task);
    return task;
  }
  /**
   * Update task status and result
   */
  async updateTask(input) {
    const validated = UpdateTaskInputSchema.parse(input);
    const session = await this.getOrThrow(validated.sessionId);
    const task = session.tasks.find((t) => t.id === validated.taskId);
    if (!task) {
      throw new Error(`Task not found: ${validated.taskId}`);
    }
    const previousStatus = task.status;
    task.status = validated.status;
    if (validated.result !== void 0) {
      task.result = validated.result;
    }
    if (validated.error !== void 0) {
      task.error = validated.error;
    }
    if (validated.status === "running" && previousStatus === "pending") {
      task.startedAt = /* @__PURE__ */ new Date();
    }
    if (validated.status === "completed" || validated.status === "failed") {
      task.completedAt = /* @__PURE__ */ new Date();
      if (task.startedAt) {
        task.duration = task.completedAt.getTime() - task.startedAt.getTime();
      }
    }
    session.updatedAt = /* @__PURE__ */ new Date();
    if (this.autoPersist) {
      await this.persistSession(session);
    }
    this.events.onTaskUpdated?.(session, task);
    return task;
  }
  /**
   * Start a task
   */
  async startTask(sessionId, taskId) {
    return this.updateTask({
      sessionId,
      // Cast to branded type
      taskId,
      status: "running"
    });
  }
  /**
   * Complete a task
   */
  async completeTask(sessionId, taskId, result) {
    return this.updateTask({
      sessionId,
      taskId,
      status: "completed",
      result
    });
  }
  /**
   * Fail a task
   */
  async failTask(sessionId, taskId, error) {
    return this.updateTask({
      sessionId,
      taskId,
      status: "failed",
      error
    });
  }
  /**
   * Get pending tasks for a session
   */
  async getPendingTasks(sessionId) {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter((t) => t.status === "pending");
  }
  /**
   * Get tasks by agent
   */
  async getTasksByAgent(sessionId, agentId) {
    const session = await this.getOrThrow(sessionId);
    return session.tasks.filter((t) => t.agentId === agentId);
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
  // =============================================================================
  // Private Methods
  // =============================================================================
  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${random}`;
  }
  /**
   * Get file path for session storage
   */
  getSessionFilePath(sessionId) {
    return join(this.sessionsPath, `${sessionId}${SESSION_FILE_EXT}`);
  }
  /**
   * Persist session to disk
   */
  async persistSession(session) {
    const filePath = this.getSessionFilePath(session.id);
    const data = JSON.stringify(session, null, 2);
    await writeFile(filePath, data, "utf-8");
  }
  /**
   * Persist all in-memory sessions
   */
  async persistAll() {
    const promises = Array.from(this.sessions.values()).map(
      (s) => this.persistSession(s)
    );
    await Promise.all(promises);
  }
  /**
   * Load session from disk
   */
  async loadSession(sessionId) {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const data = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.updatedAt = new Date(parsed.updatedAt);
      if (parsed.completedAt) {
        parsed.completedAt = new Date(parsed.completedAt);
      }
      for (const task of parsed.tasks) {
        if (task.startedAt) task.startedAt = new Date(task.startedAt);
        if (task.completedAt) task.completedAt = new Date(task.completedAt);
      }
      return SessionSchema.parse(parsed);
    } catch {
      return null;
    }
  }
  /**
   * Load recent sessions from disk
   */
  async loadRecentSessions() {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXT)).map((f) => basename(f, SESSION_FILE_EXT));
      const fileStats = await Promise.all(
        sessionFiles.map(async (id) => {
          const filePath = this.getSessionFilePath(id);
          try {
            const stats = await stat(filePath);
            return { id, mtime: stats.mtime };
          } catch {
            return { id, mtime: /* @__PURE__ */ new Date(0) };
          }
        })
      );
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const toLoad = fileStats.slice(0, this.maxInMemorySessions);
      for (const { id } of toLoad) {
        const session = await this.loadSession(id);
        if (session) {
          this.sessions.set(session.id, session);
        }
      }
    } catch {
    }
  }
  /**
   * Load all sessions from disk
   */
  async loadAllSessions() {
    try {
      const files = await readdir(this.sessionsPath);
      const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXT)).map((f) => basename(f, SESSION_FILE_EXT));
      for (const id of sessionFiles) {
        if (!this.sessions.has(id)) {
          const session = await this.loadSession(id);
          if (session) {
            this.sessions.set(session.id, session);
          }
        }
      }
    } catch {
    }
  }
  /**
   * Evict oldest sessions from memory when limit exceeded
   */
  evictOldSessions() {
    if (this.sessions.size <= this.maxInMemorySessions) return;
    const sessions = Array.from(this.sessions.entries()).sort((a, b) => b[1].updatedAt.getTime() - a[1].updatedAt.getTime());
    const toEvict = sessions.slice(this.maxInMemorySessions);
    for (const [id] of toEvict) {
      this.sessions.delete(id);
    }
  }
};
function createSessionManager(options) {
  return new SessionManager(options);
}
export {
  SessionManager,
  createSessionManager
};
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
 * Session exports
 *
 * @module @ax/core/session
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map