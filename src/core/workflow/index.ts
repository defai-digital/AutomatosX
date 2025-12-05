/**
 * Workflow Module
 *
 * Provides workflow mode management for AutomatosX.
 * Controls agent behavior and tool availability based on current mode.
 *
 * @since v11.3.0
 * @module workflow
 */

// Workflow Mode Definitions
export {
  type WorkflowMode,
  type WorkflowModeConfig,
  WorkflowModeSchema,
  WorkflowModeConfigSchema,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  DEFAULT_MODE_CONFIG,
  PLAN_MODE_CONFIG,
  ITERATE_MODE_CONFIG,
  REVIEW_MODE_CONFIG,
  WORKFLOW_MODE_CONFIGS,
  WORKFLOW_MODES,
  getWorkflowModeConfig,
  isToolAllowedInMode,
  getBlockedToolsForMode,
  getAllowedToolsForMode,
  isValidWorkflowMode,
  getWorkflowModeDescription
} from './workflow-mode.js';

// Workflow Mode Manager
export {
  WorkflowModeManager,
  type ModeTransitionEvent,
  type ModeTransitionListener
} from './workflow-mode-manager.js';

// Mode State Persistence (v11.3.1)
export {
  type ModeState,
  loadModeState,
  saveModeState,
  clearModeState,
  getCurrentPersistedMode,
  isModePersistenceEnabled
} from './mode-state-manager.js';

// Workflow Progress Provider (v11.3.1)
export {
  WorkflowProgressProvider,
  type WorkflowStep,
  type ActiveWorkflow,
  type WorkflowProgressConfig
} from './workflow-progress-provider.js';
