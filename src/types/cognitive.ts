/**
 * Cognitive Prompt Engineering Framework Types
 *
 * v13.0.0: Defines types for the cognitive framework that teaches LLMs
 * HOW to think, not just WHAT to do.
 *
 * Core insight: "Prompts should not only tell AI WHAT to do, but should
 * also teach HOW to think."
 */

/**
 * Available reasoning scaffolds
 * - prover: Full reasoning loop (Plan-Risk-Options-Validate-Execute-Report)
 * - lite: Lightweight scaffold for simple tasks
 */
export type ReasoningScaffoldType = 'prover' | 'lite';

/**
 * Available role-specific checklists
 */
export type RoleChecklistType =
  | 'backend'
  | 'frontend'
  | 'security'
  | 'quality'
  | 'architecture'
  | 'devops'
  | 'data'
  | 'product'
  | 'none';

/**
 * Available output contract variants
 * - standard: Full structured output with all sections
 * - minimal: Condensed output for simple tasks
 * - detailed: Extended output with extra context
 */
export type OutputContractType = 'standard' | 'minimal' | 'detailed';

/**
 * Uncertainty handling modes
 * - ask_first: Always ask when uncertain
 * - proceed_with_assumptions: Proceed but document assumptions
 * - balanced: Ask for high-risk, proceed for low-risk
 */
export type UncertaintyMode = 'ask_first' | 'proceed_with_assumptions' | 'balanced';

/**
 * Confidence levels for recommendations
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Checklist override configuration
 */
export interface ChecklistOverrides {
  /** Additional checklist items to include */
  add?: string[];
  /** Checklist items to exclude */
  remove?: string[];
}

/**
 * Cognitive framework configuration for an agent
 */
export interface CognitiveFrameworkConfig {
  /** Which reasoning scaffold to use */
  scaffold: ReasoningScaffoldType;

  /** Role-specific checklist to apply */
  checklist: RoleChecklistType;

  /** Output contract variant */
  outputContract: OutputContractType;

  /** How to handle uncertainty */
  uncertaintyMode: UncertaintyMode;

  /** Optional checklist customizations */
  checklistOverrides?: ChecklistOverrides;

  /** Optional: Custom checklist items (for specialized agents) */
  customChecklist?: string[];
}

/**
 * A single step in the reasoning scaffold
 */
export interface ReasoningStep {
  /** Step identifier (e.g., "1_intake") */
  id: string;

  /** Display name (e.g., "INTAKE") */
  name: string;

  /** Brief description of the step's purpose */
  description: string;

  /** Required actions for this step */
  requiredActions: string[];

  /** Optional: Skip conditions */
  skipWhen?: string[];
}

/**
 * Complete reasoning scaffold definition
 */
export interface ReasoningScaffold {
  /** Scaffold identifier */
  id: ReasoningScaffoldType;

  /** Display name */
  name: string;

  /** Brief description */
  description: string;

  /** Ordered list of reasoning steps */
  steps: ReasoningStep[];

  /** Formatted template for prompt injection */
  template: string;
}

/**
 * A single checklist item
 */
export interface ChecklistItem {
  /** Unique identifier */
  id: string;

  /** Category (e.g., "security", "performance") */
  category: string;

  /** The checklist question/item */
  text: string;

  /** Severity if missed: critical, high, medium, low */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** Optional: Keywords that trigger this item */
  triggers?: string[];
}

/**
 * Complete role checklist definition
 */
export interface RoleChecklist {
  /** Checklist identifier */
  id: RoleChecklistType;

  /** Display name */
  name: string;

  /** Role this checklist applies to */
  role: string;

  /** Categorized checklist items */
  categories: {
    [category: string]: ChecklistItem[];
  };

  /** Formatted template for prompt injection */
  template: string;
}

/**
 * Output contract section definition
 */
export interface OutputSection {
  /** Section name (e.g., "Context", "Plan") */
  name: string;

  /** Whether this section is required */
  required: boolean;

  /** Description of section purpose */
  description: string;

  /** Format template */
  format: string;
}

/**
 * Complete output contract definition
 */
export interface OutputContract {
  /** Contract identifier */
  id: OutputContractType;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Ordered list of sections */
  sections: OutputSection[];

  /** Additional sections for failure cases */
  failureSections?: OutputSection[];

  /** Formatted template for prompt injection */
  template: string;
}

/**
 * Uncertainty protocol definition
 */
export interface UncertaintyProtocol {
  /** Protocol identifier */
  id: UncertaintyMode;

  /** Display name */
  name: string;

  /** When to ask for clarification */
  askWhen: string[];

  /** When to proceed */
  proceedWhen: string[];

  /** Format for documenting assumptions */
  assumptionFormat: string;

  /** Formatted template for prompt injection */
  template: string;
}

/**
 * Composed prompt result
 */
export interface ComposedPrompt {
  /** The full composed prompt text */
  text: string;

  /** Components that were included */
  components: {
    persona: boolean;
    scaffold: ReasoningScaffoldType;
    checklist: RoleChecklistType;
    outputContract: OutputContractType;
    uncertainty: UncertaintyMode;
  };

  /** Estimated token count */
  estimatedTokens: number;
}

/**
 * Prompt composition options
 */
export interface PromptCompositionOptions {
  /** Base persona prompt (existing systemPrompt) */
  basePrompt: string;

  /** Cognitive framework configuration */
  config: CognitiveFrameworkConfig;

  /** Optional: Additional context to inject */
  additionalContext?: string;

  /** Optional: Repo-specific rules to include */
  repoContext?: RepoContext;
}

/**
 * Repository-specific context for prompt composition
 */
export interface RepoContext {
  /** Package manager (pnpm, npm, yarn) */
  packageManager?: string;

  /** Module system (esm, commonjs) */
  moduleSystem?: string;

  /** Test framework */
  testFramework?: string;

  /** Temp directory path */
  tempDir?: string;

  /** Additional repo rules */
  rules?: string[];
}

/**
 * Validation result for cognitive framework compliance
 */
export interface CognitiveComplianceResult {
  /** Overall compliance score (0-100) */
  score: number;

  /** Whether response is compliant */
  compliant: boolean;

  /** Section-by-section compliance */
  sections: {
    [section: string]: {
      present: boolean;
      valid: boolean;
      issues?: string[];
    };
  };

  /** Missing required elements */
  missing: string[];

  /** Warnings (non-blocking issues) */
  warnings: string[];
}

/**
 * Extended agent profile with cognitive framework support
 */
export interface CognitiveAgentProfile {
  /** Agent name */
  name: string;

  /** Display name */
  displayName: string;

  /** Role title */
  role: string;

  /** Description */
  description: string;

  /** Team membership */
  team?: string;

  /** Cognitive framework configuration */
  cognitiveFramework?: CognitiveFrameworkConfig;

  /** Base system prompt (persona layer) */
  systemPrompt: string;

  /** Composed prompt (generated at runtime) */
  composedPrompt?: ComposedPrompt;
}

/**
 * Default cognitive framework configuration
 */
export const DEFAULT_COGNITIVE_CONFIG: CognitiveFrameworkConfig = {
  scaffold: 'prover',
  checklist: 'none',
  outputContract: 'standard',
  uncertaintyMode: 'balanced',
};

/**
 * Lite cognitive framework configuration (for simple tasks)
 */
export const LITE_COGNITIVE_CONFIG: CognitiveFrameworkConfig = {
  scaffold: 'lite',
  checklist: 'none',
  outputContract: 'minimal',
  uncertaintyMode: 'proceed_with_assumptions',
};
