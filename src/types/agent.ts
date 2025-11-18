/**
 * Agent Types - Agent Profile and Execution Context
 */

import type { Provider } from './provider.js';
import type { MemoryEntry } from './memory.js';
import type { OrchestrationConfig, OrchestrationMetadata, Session } from './orchestration.js';

/**
 * Stage - A step in the agent's workflow
 */
export interface Stage {
  name: string;
  description: string;
  key_questions?: string[];
  outputs?: string[];

  /**
   * @deprecated Model and temperature are now configured at team level.
   * These fields are ignored. Configure provider behavior via CLI config files:
   * - Claude: Claude Code settings
   * - Gemini: ~/.config/gemini/settings.json
   * - Codex: ~/.codex/config.toml
   */
  model?: string;
  temperature?: number;

  // Phase 3: Advanced stage features
  dependencies?: string[];  // Stage names this stage depends on
  condition?: string;        // Conditional execution (e.g., "previous.success")
  parallel?: boolean;        // Can this stage run in parallel with others?
  streaming?: boolean;       // Enable streaming output for this stage
  saveToMemory?: boolean;    // Persist this stage's results to memory

  // v5.3: Checkpoint and retry configuration
  checkpoint?: boolean;      // Pause for user confirmation after this stage
  timeout?: number;          // Stage-specific timeout in milliseconds
  maxRetries?: number;       // Maximum retry attempts for this stage
  retryDelay?: number;       // Delay before retry in milliseconds
}

/**
 * Personality - Defines agent's character and behavior
 */
export interface Personality {
  traits?: string[];
  catchphrase?: string;
  communication_style?: string;
  decision_making?: string;
}

/**
 * Ability Selection Strategy - How to select abilities for different tasks
 */
export interface AbilitySelection {
  // Core abilities always loaded
  core?: string[];
  // Task-based ability mapping (keyword -> abilities)
  taskBased?: Record<string, string[]>;
  // Load all abilities (default behavior)
  loadAll?: boolean;
}

/**
 * Redirect Rule - When to suggest alternative agents
 *
 * @example
 * {
 *   phrase: "model.*train|train.*model",
 *   suggest: "Dana (Data Scientist) or Mira (ML Engineer)"
 * }
 */
export interface RedirectRule {
  /** Regular expression pattern to match in user prompts */
  phrase: string;
  /** Agent(s) to suggest when pattern matches */
  suggest: string;
}

/**
 * Selection Metadata - Structured data for agent selection
 *
 * Used by Claude Code integration and `ax agent suggest` command to improve
 * agent selection accuracy by providing explicit intent signals.
 *
 * @since v5.7.0
 *
 * @example
 * selectionMetadata:
 *   primaryIntents:
 *     - "ML model debugging and troubleshooting"
 *     - "Training failure analysis (NaN loss, convergence issues)"
 *   secondarySignals:
 *     - "transformer"
 *     - "overfitting"
 *     - "gradient"
 *   negativeIntents:
 *     - "Feasibility study (use Rodman)"
 *     - "Backend API implementation (use Bob)"
 *   redirectWhen:
 *     - phrase: "feasibility study"
 *       suggest: "Rodman (Researcher)"
 */
export interface SelectionMetadata {
  /**
   * Primary intents - User problem archetypes this agent should own
   *
   * Clear descriptions of the types of tasks this agent is best suited for.
   * Used for matching user requests to the correct agent.
   *
   * @example
   * ["ML model debugging", "Training failure analysis", "Model performance regression"]
   */
  primaryIntents?: string[];

  /**
   * Secondary signals - Keywords/n-grams that reinforce ownership
   *
   * Domain-specific terms that indicate this agent should handle the task.
   * Lower weight than primaryIntents but used for disambiguation.
   *
   * @example
   * ["transformer", "CNN", "overfitting", "gradient", "model drift"]
   */
  secondarySignals?: string[];

  /**
   * Negative intents - Topics that should be routed elsewhere
   *
   * Explicit signals that this agent should NOT handle certain tasks.
   * Helps prevent mis-selection by excluding ambiguous cases.
   *
   * @example
   * ["Feasibility study (use Rodman)", "Backend API (use Bob)"]
   */
  negativeIntents?: string[];

  /**
   * Redirect rules - Patterns that trigger agent suggestions
   *
   * Regular expression patterns that, when matched, suggest alternative agents.
   * Used for automated routing and validation.
   *
   * @example
   * [{ phrase: "feasibility study", suggest: "Rodman (Researcher)" }]
   */
  redirectWhen?: RedirectRule[];
}

/**
 * Agent Profile - Loaded from YAML
 */
export interface AgentProfile {
  // Metadata
  name: string;
  displayName?: string; // Human-friendly name (e.g., "Bob", "Eric")
  role: string;
  description: string;

  // v4.10.0+ Team-based configuration
  team?: string;  // Team name (e.g., "core", "engineering", "business", "design")
                  // Agents inherit provider config from their team

  // Behavior
  systemPrompt: string;
  abilities: string[];  // List of ability file names (agent-specific, added to team's sharedAbilities)
  dependencies?: string[];  // Agent-level dependencies for parallel execution planning
  parallel?: boolean;       // Whether this agent may run in parallel

  // Enhanced v4.1+ features
  stages?: Stage[];              // Workflow stages
  personality?: Personality;     // Character traits
  thinking_patterns?: string[];  // Guiding principles
  abilitySelection?: AbilitySelection; // Smart ability loading

  // v5.7.0+ Agent Selection Metadata
  selectionMetadata?: SelectionMetadata;  // Structured data for agent selection accuracy

  /**
   * Provider configuration (v4.10.0+)
   *
   * Recommended approach:
   * 1. Assign agent to a team via `team: "engineering"`
   * 2. Configure provider at team level in .automatosx/teams/<team>.yaml
   *
   * Alternative (per-agent override):
   * Configure directly in agent YAML for specific needs:
   * - provider: Override team's provider choice
   * - model: Specific model for this agent
   * - temperature: Control randomness (0 = deterministic, 2 = creative)
   * - maxTokens: Limit output length (cost control or specific use case)
   *
   * Note: Only OpenAI Codex CLI currently supports temperature/maxTokens parameters.
   * Gemini and Claude use their CLI's default settings.
   */
  provider?: string;         // Provider override (e.g., "openai", "gemini-cli", "claude-code")
  fallbackProvider?: string; // Fallback if primary provider unavailable
  model?: string;            // Model override (e.g., "gpt-4o", "gemini-2.0-flash-exp")
  temperature?: number;      // Randomness control: 0-2 (OpenAI only)
  maxTokens?: number;        // Max output tokens (OpenAI only)

  // Optional
  tags?: string[];
  version?: string;
  metadata?: Record<string, any>;

  // v4.7.0+ Orchestration
  orchestration?: OrchestrationConfig;  // Agent collaboration capabilities
}

/**
 * Execution Context - Everything needed to execute an agent
 */
export interface ExecutionContext {
  // Agent info
  agent: AgentProfile;
  task: string;

  // Memory (injected from MemoryManager)
  memory: MemoryEntry[];

  // Paths (from PathResolver)
  projectDir: string;
  workingDir: string;
  agentWorkspace: string;

  // Provider (selected from Router)
  provider: Provider;

  // Abilities (from AbilitiesManager)
  abilities: string;

  // Timestamp
  createdAt: Date;

  // v4.7.0+ Orchestration
  orchestration?: OrchestrationMetadata;  // Runtime orchestration info
  session?: Session;  // Current session (if part of multi-agent workflow)

  // v7.1.0+ Project Context (from AX.md)
  projectContext?: import('../core/project-context.js').ProjectContext;  // Project-specific instructions

  // v8.5.0+ Workspace Index (smart file selection)
  relevantFiles?: string[];  // Relevant files selected from workspace index
}

/**
 * Context creation options
 */
export interface ContextOptions {
  provider?: string;      // Override provider
  model?: string;         // Override model
  skipMemory?: boolean;   // Skip memory injection
  memoryLimit?: number;   // Limit memory entries
  sandbox?: string;       // v6.0.7 Phase 3: Sandbox mode override

  // v4.7.0+ Orchestration options
  sessionId?: string;           // Session ID for multi-agent workflows
  delegationChain?: string[];   // Current delegation chain (for cycle detection)
  sharedData?: Record<string, any>;  // Shared data from delegating agent
}

/**
 * Agent validation error
 */
export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

/**
 * Agent not found error
 */
export class AgentNotFoundError extends Error {
  constructor(agentName: string) {
    super(`Agent not found: ${agentName}`);
    this.name = 'AgentNotFoundError';
  }
}
