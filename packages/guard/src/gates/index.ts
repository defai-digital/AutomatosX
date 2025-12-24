/**
 * Gate Exports
 */

export { pathViolationGate } from './path.js';
export { changeRadiusGate } from './change-radius.js';
export { dependencyGate } from './dependency.js';
export { contractTestGate } from './contract-tests.js';

// Config governance gates (PRD Section 14.2)
export {
  configValidationGate,
  sensitiveChangeGate,
  validateConfigData,
  isSensitivePath,
  getSensitivePaths,
} from './config.js';

// Agent selection governance gate (INV-AGT-SEL)
export {
  agentSelectionGate,
  validateSelectionPolicy,
  type AgentSelectionGateContext,
  type AgentSelectionGateConfig,
} from './agent-selection.js';
