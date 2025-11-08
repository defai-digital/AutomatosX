# AutomatosX v2 Module Inventory & Status

Living document tracking every v1 TypeScript module (223 files) and its migration path into the AutomatosX v2 architecture. Updated on demand; owners should revise status after each sprint review.

## Overview

| Category | Files | Primary Focus | Notes |
|---|---:|---|---|
| CLI Commands | 26 | User-facing command handlers. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| CLI Shared Components | 12 | Shared CLI plumbing (args, help, telemetry). | v2 action mix: EXTEND, KEEP, REFACTOR |
| Core Runtime Orchestration | 36 | Foundational runtime services and managers. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| Workflow & Stateflow Modules | 18 | Planning, orchestration, and recovery flows. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| Memory & Persistence Layer | 20 | SQLite, FTS, retention, migrations. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| Agent Modules | 10 | Agent lifecycle, delegation, capabilities. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| Provider Connectors | 14 | API integrations for model providers. | v2 action mix: EXTEND, KEEP, REFACTOR |
| External Integrations | 3 | Non-core IDE/CLI integrations. | v2 action mix: EXTEND, KEEP, REFACTOR |
| MCP Support Stack | 30 | IDE MCP server, tooling, middleware. | v2 action mix: EXTEND, KEEP, NEW, REFACTOR |
| Utilities & Helpers | 22 | General-purpose helpers reused across stack. | v2 action mix: EXTEND, KEEP, REFACTOR |
| Code Intelligence Pipeline | 24 | New code graph, parser, search services. | v2 action mix: NEW |
| Config & Guardrails | 8 | Zod schemas, compliance, policy layers. | v2 action mix: EXTEND, NEW |

## Module Catalog & v1→v2 Mapping
Each subsection lists every v1 module, its location, baseline responsibility, and the agreed v2 disposition (KEEP / EXTEND / REFACTOR / NEW), along with the release phase and latest delivery status.

### CLI Commands

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | AnalyticsCommand | `src/cli/commands/analytics.ts` | Generates usage analytics summaries and exposes KPI views. | EXTEND | P0 | In Progress |
| 2 | CacheCommand | `src/cli/commands/cache.ts` | Manages provider response cache (list, prune, stats). | REFACTOR | P0 | Ready for QA |
| 3 | CleanupCommand | `src/cli/commands/cleanup.ts` | Cleans orphaned provider/background processes. | KEEP | P0 | Complete |
| 4 | ConfigCommand | `src/cli/commands/config.ts` | Reads and updates AutomatosX configuration. | REFACTOR | P0 | In Review |
| 5 | DoctorCommand | `src/cli/commands/doctor.ts` | Runs diagnostic checks for providers and CLI health. | EXTEND | P0 | In Progress |
| 6 | FlagsCommand | `src/cli/commands/flags.ts` | Toggles feature flags with rollout percentages. | EXTEND | P0 | In Progress |
| 7 | GeminiCommand | `src/cli/commands/gemini.ts` | Manages Gemini CLI integration endpoints. | REFACTOR | P0 | Blocked |
| 8 | InitCommand | `src/cli/commands/init.ts` | Bootstraps AutomatosX in a workspace. | REFACTOR | P0 | In Review |
| 9 | ListCommand | `src/cli/commands/list.ts` | Lists agents, abilities, providers. | EXTEND | P0 | In Progress |
| 10 | MemoryCommand | `src/cli/commands/memory.ts` | Searches and manages persistent memory. | EXTEND | P0 | Not Started |
| 11 | ProvidersCommand | `src/cli/commands/providers.ts` | Shows provider info, limits, and status. | KEEP | P0 | Complete |
| 12 | ResumeCommand | `src/cli/commands/resume.ts` | Resumes execution from checkpoints. | REFACTOR | P0 | In Progress |
| 13 | RunCommand | `src/cli/commands/run.ts` | Runs a specific agent with a task. | REFACTOR | P0 | In Review |
| 14 | RunsCommand | `src/cli/commands/runs.ts` | Lists and inspects historical runs. | EXTEND | P0 | Not Started |
| 15 | SessionCommand | `src/cli/commands/session.ts` | Manages multi-agent collaborative sessions. | EXTEND | P0 | In Progress |
| 16 | SetupCommand | `src/cli/commands/setup.ts` | Guides users through provider setup. | REFACTOR | P0 | In Review |
| 17 | SpecCommand | `src/cli/commands/spec.ts` | Spec-driven automation entry point. | EXTEND | P0 | In Progress |
| 18 | StatusCommand | `src/cli/commands/status.ts` | Displays system and provider status. | KEEP | P0 | Complete |
| 19 | UpdateCommand | `src/cli/commands/update.ts` | Checks for CLI updates. | KEEP | P0 | Ready for QA |
| 20 | WorkspaceCommand | `src/cli/commands/workspace.ts` | Manages agent workspaces and stats. | EXTEND | P0 | In Progress |
| 21 | DefinitionCommand | `src/cli/commands/def.ts` | Resolves symbol definitions across languages. | NEW | P1 | Design |
| 22 | FindCommand | `src/cli/commands/find.ts` | AST-aware pattern search across repositories. | NEW | P1 | In Progress |
| 23 | FlowCommand | `src/cli/commands/flow.ts` | Executes reusable workflow descriptors. | NEW | P1 | Design |
| 24 | LintCommand | `src/cli/commands/lint.ts` | Runs Semgrep/SWC linting pipeline. | NEW | P1 | Not Started |
| 25 | AgentCommand | `src/cli/commands/agent.ts` | Manages agent lifecycle (create, list). | EXTEND | P0 | Complete |
| 26 | WorkflowCommand | `src/cli/commands/workflow.ts` | Author and validate workflow descriptors. | EXTEND | P1 | Design |

### CLI Shared Components

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | CommandRegistry | `src/cli/shared/command-registry.ts` | Registers CLI commands and metadata. | REFACTOR | P0 | In Progress |
| 2 | CommandRouter | `src/cli/shared/command-router.ts` | Routes parsed args to command handlers. | REFACTOR | P0 | In Review |
| 3 | ArgsParser | `src/cli/shared/args-parser.ts` | Parses CLI flags and options. | REFACTOR | P0 | Complete |
| 4 | InteractivePrompter | `src/cli/shared/interactive-prompter.ts` | Handles interactive CLI prompts. | EXTEND | P0 | In Progress |
| 5 | OutputFormatter | `src/cli/shared/output-formatter.ts` | Formats CLI output (table, json). | EXTEND | P0 | Ready for QA |
| 6 | TelemetryHook | `src/cli/shared/telemetry-hook.ts` | Sends telemetry events for command usage. | EXTEND | P0 | In Progress |
| 7 | ProgressRenderer | `src/cli/shared/progress-renderer.ts` | Renders progress bars/spinners. | REFACTOR | P0 | In Review |
| 8 | ErrorPresenter | `src/cli/shared/error-presenter.ts` | Normalizes error messages for users. | EXTEND | P0 | In Progress |
| 9 | WorkspaceTargetResolver | `src/cli/shared/workspace-target-resolver.ts` | Resolves workspace aliases and paths. | EXTEND | P0 | Not Started |
| 10 | CommandHelpWriter | `src/cli/shared/help-writer.ts` | Generates contextual help text. | REFACTOR | P0 | Ready for QA |
| 11 | EnvironmentLoader | `src/cli/shared/environment-loader.ts` | Loads env vars and profiles before execution. | KEEP | P0 | Complete |
| 12 | CommandAuthGuard | `src/cli/shared/command-auth-guard.ts` | Validates user permissions for commands. | EXTEND | P1 | Design |

### Core Runtime Orchestration

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | Router | `src/core/router.ts` | Primary dispatch for command and agent execution. | REFACTOR | P0 | In Progress |
| 2 | SessionManager | `src/core/session-manager.ts` | Creates and maintains user sessions. | REFACTOR | P0 | In Review |
| 3 | WorkspaceManager | `src/core/workspace-manager.ts` | Handles workspace IO and isolation. | EXTEND | P0 | In Progress |
| 4 | CheckpointManager | `src/core/checkpoint-manager.ts` | Stores and restores execution checkpoints. | REFACTOR | P0 | In Progress |
| 5 | MemoryManager | `src/core/memory-manager.ts` | Interfaces with persistent memory store. | EXTEND | P0 | Not Started |
| 6 | CostTracker | `src/core/cost-tracker.ts` | Tracks provider spend per run. | EXTEND | P0 | In Progress |
| 7 | RateLimiter | `src/core/rate-limiter.ts` | Applies provider rate limits. | KEEP | P0 | Complete |
| 8 | TaskScheduler | `src/core/task-scheduler.ts` | Schedules async agent tasks. | REFACTOR | P0 | In Review |
| 9 | ExecutionContext | `src/core/execution-context.ts` | Holds runtime context for commands/agents. | EXTEND | P0 | In Progress |
| 10 | EventBus | `src/core/event-bus.ts` | Publishes runtime events and telemetry. | EXTEND | P0 | In Progress |
| 11 | LifecycleManager | `src/core/lifecycle-manager.ts` | Bootstraps and tears down services. | REFACTOR | P0 | Ready for QA |
| 12 | ProviderRouter | `src/core/provider-router.ts` | Routes requests to AI providers. | KEEP | P0 | Complete |
| 13 | RetryOrchestrator | `src/core/retry-orchestrator.ts` | Controls exponential backoff retries. | EXTEND | P0 | In Progress |
| 14 | StateMachineAdapter | `src/core/state-machine-adapter.ts` | Bridges ReScript state machines with TS runtime. | NEW | P0 | In Progress |
| 15 | ActionRegistry | `src/core/action-registry.ts` | Maps agent actions to implementations. | EXTEND | P0 | In Review |
| 16 | ExecutionGuards | `src/core/execution-guards.ts` | Validates invariants before execution. | REFACTOR | P0 | In Progress |
| 17 | ErrorBoundary | `src/core/error-boundary.ts` | Contains runtime errors and surfaces safe output. | EXTEND | P0 | In Progress |
| 18 | TelemetryDispatcher | `src/core/telemetry-dispatcher.ts` | Dispatches telemetry events to sinks. | EXTEND | P0 | Not Started |
| 19 | FeatureGate | `src/core/feature-gate.ts` | Evaluates feature flags at runtime. | REFACTOR | P0 | In Review |
| 20 | PluginManager | `src/core/plugin-manager.ts` | Loads and validates plugins. | EXTEND | P1 | Design |
| 21 | ValidationPipeline | `src/core/validation-pipeline.ts` | Runs Zod validators for inputs/outputs. | NEW | P0 | In Progress |
| 22 | CapabilityResolver | `src/core/capability-resolver.ts` | Matches tasks to agent capabilities. | EXTEND | P0 | In Progress |
| 23 | SignalHandler | `src/core/signal-handler.ts` | Handles OS signals and graceful shutdown. | KEEP | P0 | Complete |
| 24 | ContextSerializer | `src/core/context-serializer.ts` | Serializes execution context for storage. | REFACTOR | P1 | Not Started |
| 25 | RunbookExecutor | `src/core/runbook-executor.ts` | Executes predefined runbooks. | EXTEND | P1 | Design |
| 26 | AuditTrail | `src/core/audit-trail.ts` | Captures audit logs for compliance. | EXTEND | P1 | In Progress |
| 27 | SecretsManager | `src/core/secrets-manager.ts` | Loads and injects secrets securely. | KEEP | P0 | Ready for QA |
| 28 | ConcurrencyController | `src/core/concurrency-controller.ts` | Controls parallel execution slots. | REFACTOR | P0 | In Progress |
| 29 | ExecutionMetrics | `src/core/execution-metrics.ts` | Collects runtime metrics from tasks. | EXTEND | P0 | Not Started |
| 30 | FallbackPlanner | `src/core/fallback-planner.ts` | Creates fallback plans on failure. | NEW | P1 | Design |
| 31 | SessionLocker | `src/core/session-locker.ts` | Prevents concurrent session writes. | KEEP | P0 | Ready for QA |
| 32 | HumanApprovalBridge | `src/core/human-approval-bridge.ts` | Routes tasks for human approval checkpoints. | EXTEND | P1 | Design |
| 33 | ToolInvoker | `src/core/tool-invoker.ts` | Executes registered tools with guardrails. | EXTEND | P0 | In Progress |
| 34 | ObservabilityAdapter | `src/core/observability-adapter.ts` | Connects to OpenTelemetry exporters. | NEW | P1 | In Progress |
| 35 | ExecutionLogger | `src/core/execution-logger.ts` | Structured logging for execution lifecycle. | KEEP | P0 | Complete |
| 36 | SandboxManager | `src/core/sandbox-manager.ts` | Manages execution sandboxes and permissions. | EXTEND | P1 | Design |

### Workflow & Stateflow Modules

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | PlanGenerator | `src/workflows/plan-generator.ts` | Generates execution plans from tasks. | REFACTOR | P0 | In Progress |
| 2 | StateGraphBuilder | `src/workflows/state-graph-builder.ts` | Builds task state graphs. | NEW | P0 | Design |
| 3 | WorkflowLoader | `src/workflows/workflow-loader.ts` | Loads workflow descriptors. | EXTEND | P0 | In Progress |
| 4 | WorkflowValidator | `src/workflows/workflow-validator.ts` | Validates workflow syntax and semantics. | EXTEND | P0 | In Review |
| 5 | CheckpointPlanner | `src/workflows/checkpoint-planner.ts` | Places checkpoints in workflows. | REFACTOR | P0 | In Progress |
| 6 | Parallelizer | `src/workflows/parallelizer.ts` | Detects parallelizable tasks. | NEW | P1 | Design |
| 7 | RollbackCoordinator | `src/workflows/rollback-coordinator.ts` | Defines rollback strategies. | EXTEND | P1 | Design |
| 8 | HumanInLoopManager | `src/workflows/human-in-loop-manager.ts` | Inserts human approval steps. | EXTEND | P1 | In Progress |
| 9 | WorkflowMetrics | `src/workflows/workflow-metrics.ts` | Captures workflow runtime metrics. | NEW | P1 | Design |
| 10 | WorkflowRenderer | `src/workflows/workflow-renderer.ts` | Renders workflow DAGs for CLI. | NEW | P1 | Design |
| 11 | SpecAdapter | `src/workflows/spec-adapter.ts` | Converts specs into workflows. | EXTEND | P0 | In Progress |
| 12 | TaskDependencyAnalyzer | `src/workflows/task-dependency-analyzer.ts` | Analyzes dependencies between tasks. | EXTEND | P1 | Design |
| 13 | OutcomeEvaluator | `src/workflows/outcome-evaluator.ts` | Evaluates task outcomes vs success criteria. | NEW | P1 | Design |
| 14 | WorkflowSerializer | `src/workflows/workflow-serializer.ts` | Serializes workflow definitions. | KEEP | P0 | Ready for QA |
| 15 | WorkflowRepository | `src/workflows/workflow-repository.ts` | Persists workflows to storage. | EXTEND | P1 | Not Started |
| 16 | WorkflowVersioning | `src/workflows/workflow-versioning.ts` | Manages workflow versions and diffs. | NEW | P1 | Design |
| 17 | StateMonitor | `src/workflows/state-monitor.ts` | Monitors workflow execution state. | EXTEND | P0 | In Progress |
| 18 | RecoveryPlanner | `src/workflows/recovery-planner.ts` | Plans recovery steps after failure. | NEW | P1 | Design |

### Memory & Persistence Layer

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | MemoryIndex | `src/memory/memory-index.ts` | FTS index queries. | EXTEND | P0 | In Progress |
| 2 | MemoryDAO | `src/memory/memory-dao.ts` | CRUD operations for memories. | REFACTOR | P0 | In Review |
| 3 | MemoryMigrations | `src/memory/memory-migrations.ts` | Migration scripts for memory DB. | EXTEND | P0 | In Progress |
| 4 | MemoryExporter | `src/memory/memory-exporter.ts` | Exports memories to backup formats. | KEEP | P0 | Ready for QA |
| 5 | MemoryImporter | `src/memory/memory-importer.ts` | Imports memories from backup. | KEEP | P0 | Complete |
| 6 | MemoryRetention | `src/memory/memory-retention.ts` | Handles retention policies. | EXTEND | P1 | Design |
| 7 | MemoryPruner | `src/memory/memory-pruner.ts` | Prunes memories via policies. | EXTEND | P0 | In Progress |
| 8 | MemorySearchService | `src/memory/memory-search-service.ts` | Executes search queries. | EXTEND | P0 | Not Started |
| 9 | MemoryRecallLogger | `src/memory/memory-recall-logger.ts` | Logs recall events. | KEEP | P0 | Complete |
| 10 | MemorySummarizer | `src/memory/memory-summarizer.ts` | Summarizes memories for quick view. | NEW | P1 | Design |
| 11 | MemoryEmbeddings | `src/memory/memory-embeddings.ts` | Handles embedding storage. | NEW | P1 | Design |
| 12 | MemoryFTSRebuilder | `src/memory/memory-fts-rebuilder.ts` | Rebuilds FTS indexes. | EXTEND | P0 | In Progress |
| 13 | MemoryPermissions | `src/memory/memory-permissions.ts` | Controls access to memories. | EXTEND | P1 | Design |
| 14 | MemoryMetrics | `src/memory/memory-metrics.ts` | Captures memory usage metrics. | NEW | P1 | Design |
| 15 | MemorySchema | `src/memory/memory-schema.ts` | Defines TypeScript types for schema. | REFACTOR | P0 | In Review |
| 16 | MemoryHealthCheck | `src/memory/memory-health-check.ts` | Runs DB health diagnostics. | EXTEND | P0 | Ready for QA |
| 17 | MemorySeeder | `src/memory/memory-seeder.ts` | Seeds sample data for tests. | KEEP | P2 | Not Started |
| 18 | MemorySyncService | `src/memory/memory-sync-service.ts` | Syncs memory across devices. | NEW | P2 | Design |
| 19 | MemoryBackupScheduler | `src/memory/memory-backup-scheduler.ts` | Schedules automated backups. | EXTEND | P1 | Design |
| 20 | MemoryMigrationCLI | `src/memory/memory-migration-cli.ts` | CLI helper for migrations. | EXTEND | P0 | In Progress |

### Agent Modules

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | AgentExecutor | `src/agents/agent-executor.ts` | Executes agent plans with retries. | REFACTOR | P0 | In Progress |
| 2 | AgentContextManager | `src/agents/agent-context-manager.ts` | Builds context windows for agents. | EXTEND | P0 | In Review |
| 3 | ProfileLoader | `src/agents/profile-loader.ts` | Loads agent persona definitions. | EXTEND | P0 | Complete |
| 4 | DelegationParser | `src/agents/delegation-parser.ts` | Parses delegation directives. | REFACTOR | P0 | In Progress |
| 5 | CapabilityMatrix | `src/agents/capability-matrix.ts` | Maps skills to tasks. | EXTEND | P0 | In Progress |
| 6 | AgentMemoryBridge | `src/agents/agent-memory-bridge.ts` | Connects agents to memory store. | EXTEND | P0 | Not Started |
| 7 | AgentTelemetry | `src/agents/agent-telemetry.ts` | Logs agent performance metrics. | EXTEND | P1 | Design |
| 8 | AgentCostController | `src/agents/agent-cost-controller.ts` | Caps spend per agent. | KEEP | P0 | Ready for QA |
| 9 | AgentSandbox | `src/agents/agent-sandbox.ts` | Provides isolated execution for agents. | NEW | P1 | Design |
| 10 | DelegationNegotiator | `src/agents/delegation-negotiator.ts` | Resolves conflicts across delegated tasks. | NEW | P1 | Design |

### Provider Connectors

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | OpenAIProvider | `src/providers/openai-provider.ts` | Handles OpenAI completions/chat. | EXTEND | P0 | In Progress |
| 2 | OpenAIStreaming | `src/providers/openai-streaming.ts` | Implements streaming for OpenAI. | REFACTOR | P0 | In Review |
| 3 | OpenAIAssistants | `src/providers/openai-assistants.ts` | Manages OpenAI assistant API. | EXTEND | P0 | Not Started |
| 4 | ClaudeProvider | `src/providers/claude-provider.ts` | Handles Anthropic Claude requests. | EXTEND | P0 | In Progress |
| 5 | ClaudeStreaming | `src/providers/claude-streaming.ts` | Streaming support for Claude. | REFACTOR | P0 | Ready for QA |
| 6 | ClaudeTooling | `src/providers/claude-tooling.ts` | Tools integration for Claude. | EXTEND | P1 | Design |
| 7 | GeminiProvider | `src/providers/gemini-provider.ts` | Google Gemini integration. | EXTEND | P0 | In Review |
| 8 | GeminiStreaming | `src/providers/gemini-streaming.ts` | Streaming responses for Gemini. | REFACTOR | P0 | In Progress |
| 9 | ProviderRegistry | `src/providers/provider-registry.ts` | Registers providers and metadata. | KEEP | P0 | Complete |
| 10 | ProviderLimiter | `src/providers/provider-limiter.ts` | Applies provider-specific limits. | EXTEND | P0 | Ready for QA |
| 11 | ProviderTelemetry | `src/providers/provider-telemetry.ts` | Provider performance metrics. | EXTEND | P1 | Design |
| 12 | ProviderFailover | `src/providers/provider-failover.ts` | Failover logic across providers. | REFACTOR | P1 | Design |
| 13 | ProviderSecrets | `src/providers/provider-secrets.ts` | Loads provider secrets securely. | KEEP | P0 | Complete |
| 14 | ProviderMock | `src/providers/provider-mock.ts` | Mock provider for testing. | EXTEND | P0 | Ready for QA |

### External Integrations

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | ClaudeCodeIntegration | `src/integrations/claude-code.ts` | Claude Code IDE integration. | REFACTOR | P1 | Design |
| 2 | GeminiCLIIntegration | `src/integrations/gemini-cli.ts` | Gemini CLI bridge. | EXTEND | P1 | Design |
| 3 | OpenAICodexIntegration | `src/integrations/openai-codex.ts` | Legacy Codex tooling. | KEEP | P2 | Maintenance |

### MCP Support Stack

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | MCPServer | `src/mcp/server.ts` | Starts MCP server for IDEs. | EXTEND | P1 | Design |
| 2 | MCPMiddleware | `src/mcp/middleware.ts` | Shared middleware for MCP requests. | REFACTOR | P1 | Design |
| 3 | MCPRouter | `src/mcp/router.ts` | Routes MCP method calls. | EXTEND | P1 | Design |
| 4 | MCPHandshake | `src/mcp/handshake.ts` | Negotiates MCP handshake. | KEEP | P1 | In Progress |
| 5 | MCPToolRegistry | `src/mcp/tool-registry.ts` | Registers MCP tools. | EXTEND | P1 | Design |
| 6 | MCPContextBridge | `src/mcp/context-bridge.ts` | Shares context with MCP clients. | EXTEND | P1 | Design |
| 7 | MCPToolExecutor | `src/mcp/tool-executor.ts` | Executes MCP tool calls. | EXTEND | P1 | Design |
| 8 | MCPUtils | `src/mcp/utils.ts` | Utility helpers for MCP stack. | REFACTOR | P1 | In Progress |
| 9 | MCPLogger | `src/mcp/logger.ts` | Logging for MCP transport. | KEEP | P1 | Ready for QA |
| 10 | MCPErrorHandler | `src/mcp/error-handler.ts` | Normalizes MCP errors. | EXTEND | P1 | Design |
| 11 | MCPAuth | `src/mcp/auth.ts` | Authentication guard for MCP clients. | NEW | P1 | Design |
| 12 | MCPDiagnostics | `src/mcp/diagnostics.ts` | MCP health diagnostics. | EXTEND | P1 | Design |
| 13 | MCPKeepAlive | `src/mcp/keepalive.ts` | Keeps MCP sessions alive. | KEEP | P1 | Ready for QA |
| 14 | MCPSessionStore | `src/mcp/session-store.ts` | Stores MCP session state. | EXTEND | P1 | Design |
| 15 | MCPNotifications | `src/mcp/notifications.ts` | Push notifications to MCP clients. | NEW | P2 | Design |
| 16 | MCPToolingCLI | `src/mcp/tooling-cli.ts` | CLI for managing MCP tooling. | EXTEND | P1 | Design |
| 17 | MCPToolingDocs | `src/mcp/tooling-docs.ts` | Generates documentation for MCP tools. | NEW | P2 | Design |
| 18 | MCPMetrics | `src/mcp/metrics.ts` | Metrics for MCP usage. | EXTEND | P1 | Design |
| 19 | MCPDebugger | `src/mcp/debugger.ts` | Debug tooling for MCP interactions. | NEW | P2 | Design |
| 20 | MCPTransport | `src/mcp/transport.ts` | Defines transport protocols. | REFACTOR | P1 | In Progress |
| 21 | MCPAdapter | `src/mcp/adapter.ts` | Adapts AutomatosX to MCP schema. | EXTEND | P1 | Design |
| 22 | MCPThrottler | `src/mcp/throttler.ts` | Rate limiting for MCP requests. | NEW | P1 | Design |
| 23 | MCPTraceExporter | `src/mcp/trace-exporter.ts` | Exports traces for MCP interactions. | NEW | P2 | Design |
| 24 | MCPWorkspaceBridge | `src/mcp/workspace-bridge.ts` | Syncs workspaces with MCP clients. | EXTEND | P1 | Design |
| 25 | MCPCommandRouter | `src/mcp/command-router.ts` | Routes CLI commands via MCP. | NEW | P2 | Design |
| 26 | MCPVersionNegotiator | `src/mcp/version-negotiator.ts` | Negotiates protocol versions. | EXTEND | P1 | Design |
| 27 | MCPBinarySerializer | `src/mcp/binary-serializer.ts` | Binary serialization for MCP payloads. | NEW | P2 | Design |
| 28 | MCPReplay | `src/mcp/replay.ts` | Replays MCP sessions for debugging. | NEW | P2 | Design |
| 29 | MCPConfigLoader | `src/mcp/config-loader.ts` | Loads MCP config from project. | EXTEND | P1 | Design |
| 30 | MCPClientSDK | `src/mcp/client-sdk.ts` | Client SDK for MCP consumers. | NEW | P2 | Design |

### Utilities & Helpers

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | Logger | `src/utils/logger.ts` | Structured logging utilities. | KEEP | P0 | Complete |
| 2 | ErrorFormatter | `src/utils/error-formatter.ts` | Formats errors for display. | EXTEND | P0 | In Progress |
| 3 | Retry | `src/utils/retry.ts` | Generic retry helper. | KEEP | P0 | Ready for QA |
| 4 | PerformanceTimer | `src/utils/performance-timer.ts` | Measures execution timing. | KEEP | P0 | Complete |
| 5 | ConfigReader | `src/utils/config-reader.ts` | Reads config files safely. | EXTEND | P0 | In Review |
| 6 | FileSystem | `src/utils/file-system.ts` | File system abstraction. | REFACTOR | P0 | In Progress |
| 7 | PathUtils | `src/utils/path-utils.ts` | Resolves and normalizes paths. | KEEP | P0 | Complete |
| 8 | PromisePool | `src/utils/promise-pool.ts` | Utility for concurrency control. | EXTEND | P0 | Ready for QA |
| 9 | StreamUtils | `src/utils/stream-utils.ts` | Stream helpers for CLI I/O. | REFACTOR | P0 | In Progress |
| 10 | TablePrinter | `src/utils/table-printer.ts` | Renders tables in CLI. | KEEP | P0 | Complete |
| 11 | Ansi | `src/utils/ansi.ts` | ANSI color helpers. | KEEP | P0 | Complete |
| 12 | UUID | `src/utils/uuid.ts` | Unique ID generator wrapper. | KEEP | P0 | Complete |
| 13 | Serialization | `src/utils/serialization.ts` | Serialization helpers. | EXTEND | P0 | In Progress |
| 14 | Validation | `src/utils/validation.ts` | Shared validation helpers. | REFACTOR | P0 | In Review |
| 15 | CliColors | `src/utils/cli-colors.ts` | Standard color palette for CLI. | KEEP | P0 | Ready for QA |
| 16 | Shell | `src/utils/shell.ts` | Shell execution helper. | EXTEND | P0 | In Progress |
| 17 | Env | `src/utils/env.ts` | Environment var helpers. | KEEP | P0 | Complete |
| 18 | Timer | `src/utils/timer.ts` | Timeout helper utilities. | KEEP | P0 | Complete |
| 19 | TaskRunner | `src/utils/task-runner.ts` | Task orchestration helper. | EXTEND | P0 | Not Started |
| 20 | ObjectUtils | `src/utils/object-utils.ts` | Object manipulation helpers. | KEEP | P0 | Complete |
| 21 | DiffUtils | `src/utils/diff-utils.ts` | Diff generation helpers. | EXTEND | P1 | Design |
| 22 | Guard | `src/utils/guard.ts` | Type guard helpers. | KEEP | P0 | Complete |

### Code Intelligence Pipeline

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | CodeGraphIngestion | `src/codeintel/graph-ingestion.ts` | Builds code graph from parser outputs. | NEW | P1 | Design |
| 2 | SymbolIndexer | `src/codeintel/symbol-indexer.ts` | Indexes symbols into SQLite. | NEW | P1 | Design |
| 3 | CallGraphBuilder | `src/codeintel/call-graph-builder.ts` | Generates call graph relationships. | NEW | P1 | Design |
| 4 | ImportResolver | `src/codeintel/import-resolver.ts` | Resolves import relationships. | NEW | P1 | Design |
| 5 | FileScanner | `src/codeintel/file-scanner.ts` | Scans file tree for languages. | NEW | P1 | In Progress |
| 6 | ParserOrchestrator | `src/codeintel/parser-orchestrator.ts` | Orchestrates Tree-sitter/SWC/Semgrep parsers. | NEW | P1 | In Progress |
| 7 | TreeSitterAdapter | `src/codeintel/tree-sitter-adapter.ts` | Adapter for Tree-sitter parsing. | NEW | P1 | Design |
| 8 | SWCAdapter | `src/codeintel/swc-adapter.ts` | Adapter for SWC transformations. | NEW | P1 | Design |
| 9 | SemgrepAdapter | `src/codeintel/semgrep-adapter.ts` | Runs Semgrep rules. | NEW | P1 | Design |
| 10 | CodeChunksBuilder | `src/codeintel/code-chunks-builder.ts` | Creates chunk metadata for context. | NEW | P1 | Design |
| 11 | SymbolSearchService | `src/codeintel/symbol-search-service.ts` | Searches symbols with filters. | NEW | P1 | Design |
| 12 | DefinitionResolver | `src/codeintel/definition-resolver.ts` | Resolves symbol definitions (CLI def). | NEW | P1 | In Progress |
| 13 | ReferenceResolver | `src/codeintel/reference-resolver.ts` | Finds reference locations. | NEW | P1 | Design |
| 14 | CodeIntelCache | `src/codeintel/code-intel-cache.ts` | Caches parser results. | NEW | P1 | Design |
| 15 | WorkspaceIndexer | `src/codeintel/workspace-indexer.ts` | Incremental indexing per workspace. | NEW | P1 | Design |
| 16 | LanguageSupportRegistry | `src/codeintel/language-support-registry.ts` | Registers language adapters. | NEW | P1 | Design |
| 17 | CodeIntelMetrics | `src/codeintel/code-intel-metrics.ts` | Measures ingestion performance. | NEW | P1 | Design |
| 18 | CodeIntelCLIReporter | `src/codeintel/code-intel-cli-reporter.ts` | Reports indexing status to CLI. | NEW | P1 | Design |
| 19 | CodeIntelScheduler | `src/codeintel/code-intel-scheduler.ts` | Schedules indexing jobs. | NEW | P1 | Design |
| 20 | SymbolGraphDAO | `src/codeintel/symbol-graph-dao.ts` | DAO for symbol graph tables. | NEW | P1 | Design |
| 21 | CodeIntelMigration | `src/codeintel/code-intel-migration.ts` | Migration scripts for code intel tables. | NEW | P1 | Design |
| 22 | DefinitionFormatter | `src/codeintel/definition-formatter.ts` | Formats definition results for CLI. | NEW | P1 | Design |
| 23 | SearchQueryParser | `src/codeintel/search-query-parser.ts` | Parses advanced search queries. | NEW | P1 | Design |
| 24 | GraphPruner | `src/codeintel/graph-pruner.ts` | Prunes stale graph nodes. | NEW | P2 | Design |

### Config & Guardrails

| # | Module | v1 Path | v1 Function | v2 Action | Phase | Status |
|---:|---|---|---|---|---|---|
| 1 | ConfigSchema | `src/config/config-schema.ts` | Defines Zod schema for config. | NEW | P0 | In Progress |
| 2 | ConfigDefaults | `src/config/config-defaults.ts` | Provides default config values. | EXTEND | P0 | In Review |
| 3 | FeatureFlagSchema | `src/config/feature-flag-schema.ts` | Validates feature flag definitions. | NEW | P0 | In Progress |
| 4 | ProviderConfigValidator | `src/config/provider-config-validator.ts` | Validates provider config entries. | EXTEND | P0 | In Progress |
| 5 | RuntimePolicy | `src/config/runtime-policy.ts` | Defines runtime safety policies. | NEW | P1 | Design |
| 6 | SecretsPolicy | `src/config/secrets-policy.ts` | Policies for secrets handling. | EXTEND | P0 | Ready for QA |
| 7 | ComplianceGuard | `src/config/compliance-guard.ts` | Applies compliance checks. | NEW | P1 | Design |
| 8 | TelemetryPolicy | `src/config/telemetry-policy.ts` | Controls telemetry opt-in/out. | EXTEND | P0 | In Progress |

## Feature Preservation Checklist
Confirm every v1 capability is mapped with a v2 disposition before exiting P0. Owners update the checklist as work completes.

- [ ] **Core CLI parity** — All legacy CLI commands (analytics → workspace) ported with regression tests.
- [ ] **Session orchestration** — SessionManager, CheckpointManager, ResumeCommand verified end-to-end.
- [ ] **Memory lifecycle** — Memory search/export/import/retention flows verified against v1 fixtures.
- [ ] **Agent delegation** — AgentExecutor, DelegationParser, capability matching behave as v1 under fallback.
- [ ] **Provider coverage** — OpenAI, Claude, Gemini connectors match v1 limit handling and telemetry.
- [ ] **Workspace IO** — WorkspaceManager operations stay backwards compatible for CLI and MCP clients.
- [ ] **Spec workflows** — SpecCommand, PlanGenerator, WorkflowValidator produce identical plans under v1 test suites.
- [ ] **Cost controls** — CostTracker and AgentCostController enforce existing spend guardrails.
- [ ] **Audit & logging** — ExecutionLogger and AuditTrail emit v1-equivalent structured logs.
- [ ] **Error handling** — ErrorBoundary + ErrorPresenter preserve user-facing messaging semantics.

## New Feature Tracking — Code Intelligence Additions
Focus area for v2 differentiation. Align delivery sequencing with ingestion milestones and CLI feature rollouts.

| Module | Owner | Milestone | Status | Notes |
|---|---|---|---|---|
| CodeGraphIngestion | Data | P1 Sprint 1 | Design | Builds code graph from parser outputs. |
| SymbolIndexer | Backend | P1 Sprint 1 | Design | Indexes symbols into SQLite. |
| CallGraphBuilder | Fullstack | P1 Sprint 1 | Design | Generates call graph relationships. |
| ImportResolver | Quality | P1 Sprint 1 | Design | Resolves import relationships. |
| FileScanner | Data | P1 Sprint 1 | In Progress | Scans file tree for languages. |
| ParserOrchestrator | Backend | P1 Sprint 1 | In Progress | Orchestrates Tree-sitter/SWC/Semgrep parsers. |
| TreeSitterAdapter | Fullstack | P1 Sprint 2 | Design | Adapter for Tree-sitter parsing. |
| SWCAdapter | Quality | P1 Sprint 2 | Design | Adapter for SWC transformations. |
| SemgrepAdapter | Data | P1 Sprint 2 | Design | Runs Semgrep rules. |
| CodeChunksBuilder | Backend | P1 Sprint 2 | Design | Creates chunk metadata for context. |
| SymbolSearchService | Fullstack | P1 Sprint 2 | Design | Searches symbols with filters. |
| DefinitionResolver | Quality | P1 Sprint 2 | In Progress | Resolves symbol definitions (CLI def). |
| ReferenceResolver | Data | P1 Sprint 3 | Design | Finds reference locations. |
| CodeIntelCache | Backend | P1 Sprint 3 | Design | Caches parser results. |
| WorkspaceIndexer | Fullstack | P1 Sprint 3 | Design | Incremental indexing per workspace. |
| LanguageSupportRegistry | Quality | P1 Sprint 3 | Design | Registers language adapters. |
| CodeIntelMetrics | Data | P1 Sprint 3 | Design | Measures ingestion performance. |
| CodeIntelCLIReporter | Backend | P1 Sprint 3 | Design | Reports indexing status to CLI. |
| CodeIntelScheduler | Fullstack | P1 Sprint 4 | Design | Schedules indexing jobs. |
| SymbolGraphDAO | Quality | P1 Sprint 4 | Design | DAO for symbol graph tables. |
| CodeIntelMigration | Data | P1 Sprint 4 | Design | Migration scripts for code intel tables. |
| DefinitionFormatter | Backend | P1 Sprint 4 | Design | Formats definition results for CLI. |
| SearchQueryParser | Fullstack | P1 Sprint 4 | Design | Parses advanced search queries. |
| GraphPruner | Quality | P1 Sprint 4 | Design | Prunes stale graph nodes. |

## Status Dashboard
Summary view for leadership. Use during readiness reviews to understand investment distribution and phase burn-down.

### Phase Breakdown

| Phase | Modules | % of Total | Key Notes |
|---|---:|---:|---|
| P0 | 125 | 56.1% | Parity & core runtime hardening. |
| P1 | 86 | 38.6% | Enhancements & code intelligence MVP. |
| P2 | 12 | 5.4% | Expansion, MCP advanced tooling. |

### Status by Phase

| Phase | Status | Count |
|---|---|---:|
| P0 | Blocked | 1 |
| P0 | Complete | 25 |
| P0 | Design | 1 |
| P0 | In Progress | 51 |
| P0 | In Review | 19 |
| P0 | Not Started | 10 |
| P0 | Ready for QA | 18 |
| P1 | Design | 71 |
| P1 | In Progress | 10 |
| P1 | Not Started | 3 |
| P1 | Ready for QA | 2 |
| P2 | Design | 10 |
| P2 | Maintenance | 1 |
| P2 | Not Started | 1 |

### Action Distribution

| v2 Action | Modules | % |
|---|---:|---:|
| EXTEND | 91 | 40.8% |
| KEEP | 35 | 15.7% |
| NEW | 59 | 26.5% |
| REFACTOR | 38 | 17.0% |

### Open Risks & Follow-ups
- **Streaming provider adapters** (OpenAIStreaming, GeminiStreaming) blocked on upstream API parity; track via DevOps weekly sync.
- **MCP advanced tooling** (notifications, debugger, replay) scheduled for P2; ensure design capacity reserved in roadmap.
- **Code intelligence ingestion** needs performance benchmarking once ParserOrchestrator prototype lands (target P1 Sprint 2).
- **Memory embeddings** depends on provider cost modeling; confirm budget before enabling in default build.

---
**Ownership:** Product (Paris) maintains roadmap alignment. Engineering leads update module statuses each sprint. Quality validates checklist items before phase exit. "Build the right thing, not just things right."