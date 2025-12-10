/**
 * Cognitive Prompt Engineering Framework
 *
 * v13.0.0: A comprehensive framework for teaching LLMs HOW to think,
 * not just WHAT to do.
 *
 * Key Components:
 * - Reasoning Scaffolds: Structured thinking loops (PROVER, LITE)
 * - Role Checklists: Domain-specific verification lists
 * - Output Contracts: Structured response formats
 * - Uncertainty Protocols: Ask vs. proceed guidance
 * - Prompt Composer: Assembles modular components
 *
 * Core Insight:
 * "Prompts should not only tell AI WHAT to do, but should also teach
 * HOW to think. Teaching LLMs how to think is the high-value feature -
 * LLMs are powerful enough to know what to do in general."
 *
 * @example
 * ```typescript
 * import { PromptComposer, DEFAULT_COGNITIVE_CONFIG } from './cognitive/index.js';
 *
 * const composed = PromptComposer.compose({
 *   basePrompt: existingSystemPrompt,
 *   config: {
 *     scaffold: 'prover',
 *     checklist: 'backend',
 *     outputContract: 'standard',
 *     uncertaintyMode: 'balanced',
 *   },
 * });
 *
 * console.log(composed.text); // Full cognitive prompt
 * console.log(composed.estimatedTokens); // Token count
 * ```
 */

// Re-export types
export type {
  ReasoningScaffoldType,
  RoleChecklistType,
  OutputContractType,
  UncertaintyMode,
  ConfidenceLevel,
  CognitiveFrameworkConfig,
  ChecklistOverrides,
  ReasoningStep,
  ReasoningScaffold,
  ChecklistItem,
  RoleChecklist,
  OutputSection,
  OutputContract,
  UncertaintyProtocol,
  ComposedPrompt,
  PromptCompositionOptions,
  RepoContext,
  CognitiveComplianceResult,
  CognitiveAgentProfile,
} from '../../types/cognitive.js';

// Re-export constants
export {
  DEFAULT_COGNITIVE_CONFIG,
  LITE_COGNITIVE_CONFIG,
} from '../../types/cognitive.js';

// Reasoning Scaffolds
export {
  ReasoningScaffolds,
  getReasoningScaffold,
  getScaffoldTemplate,
  getAvailableScaffolds,
  recommendScaffold,
} from './reasoning-scaffolds.js';

// Role Checklists
export {
  RoleChecklists,
  getRoleChecklist,
  getChecklistTemplate,
  getAvailableChecklists,
  applyChecklistOverrides,
  getRelevantChecklistItems,
} from './role-checklists.js';

// Output Contracts
export {
  OutputContracts,
  getOutputContract,
  getContractTemplate,
  getAvailableContracts,
  recommendContract,
  validateResponse,
  extractSections,
} from './output-contracts.js';

// Uncertainty Protocols
export {
  UncertaintyProtocols,
  getUncertaintyProtocol,
  getProtocolTemplate,
  getAvailableModes,
  formatConfidence,
  assessConfidence,
  shouldAsk,
  formatAssumptions,
} from './uncertainty-protocol.js';

// Prompt Composer
export {
  PromptComposer,
  composePrompt,
  composeSmartPrompt,
  composeAutomatosXPrompt,
  validateConfig,
  AUTOMATOSX_REPO_CONTEXT,
} from './prompt-composer.js';

/**
 * Quick reference for cognitive framework components
 */
export const CognitiveFramework = {
  /**
   * Available reasoning scaffolds
   */
  scaffolds: ['prover', 'lite'] as const,

  /**
   * Available role checklists
   */
  checklists: [
    'backend',
    'frontend',
    'security',
    'quality',
    'architecture',
    'devops',
    'data',
    'product',
    'none',
  ] as const,

  /**
   * Available output contracts
   */
  contracts: ['standard', 'minimal', 'detailed'] as const,

  /**
   * Available uncertainty modes
   */
  uncertaintyModes: ['ask_first', 'proceed_with_assumptions', 'balanced'] as const,

  /**
   * Confidence levels
   */
  confidenceLevels: ['high', 'medium', 'low'] as const,
};

export default CognitiveFramework;
