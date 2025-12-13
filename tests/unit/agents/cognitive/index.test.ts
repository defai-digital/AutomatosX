/**
 * Tests for cognitive module index exports
 */

import { describe, it, expect } from 'vitest';
import {
  // Types re-exported
  DEFAULT_COGNITIVE_CONFIG,
  LITE_COGNITIVE_CONFIG,

  // Reasoning Scaffolds
  ReasoningScaffolds,
  getReasoningScaffold,
  getScaffoldTemplate,
  getAvailableScaffolds,
  recommendScaffold,

  // Role Checklists
  RoleChecklists,
  getRoleChecklist,
  getChecklistTemplate,
  getAvailableChecklists,
  applyChecklistOverrides,
  getRelevantChecklistItems,

  // Output Contracts
  OutputContracts,
  getOutputContract,
  getContractTemplate,
  getAvailableContracts,
  recommendContract,
  validateResponse,
  extractSections,

  // Uncertainty Protocols
  UncertaintyProtocols,
  getUncertaintyProtocol,
  getProtocolTemplate,
  getAvailableModes,
  formatConfidence,
  assessConfidence,
  shouldAsk,
  formatAssumptions,

  // Prompt Composer
  PromptComposer,
  composePrompt,
  composeSmartPrompt,
  composeAutomatosXPrompt,
  validateConfig,
  AUTOMATOSX_REPO_CONTEXT,

  // Quick reference
  CognitiveFramework,
} from '../../../../src/agents/cognitive/index.js';

describe('Cognitive Module Exports', () => {
  describe('Default configs', () => {
    it('should export DEFAULT_COGNITIVE_CONFIG', () => {
      expect(DEFAULT_COGNITIVE_CONFIG).toBeDefined();
      expect(DEFAULT_COGNITIVE_CONFIG.scaffold).toBe('prover');
      expect(DEFAULT_COGNITIVE_CONFIG.outputContract).toBe('standard');
      expect(DEFAULT_COGNITIVE_CONFIG.uncertaintyMode).toBe('balanced');
    });

    it('should export LITE_COGNITIVE_CONFIG', () => {
      expect(LITE_COGNITIVE_CONFIG).toBeDefined();
      expect(LITE_COGNITIVE_CONFIG.scaffold).toBe('lite');
      expect(LITE_COGNITIVE_CONFIG.outputContract).toBe('minimal');
    });
  });

  describe('ReasoningScaffolds exports', () => {
    it('should export ReasoningScaffolds namespace', () => {
      expect(ReasoningScaffolds).toBeDefined();
      expect(ReasoningScaffolds.get).toBeDefined();
      expect(ReasoningScaffolds.PROVER).toBeDefined();
    });

    it('should export standalone functions', () => {
      expect(getReasoningScaffold).toBeDefined();
      expect(getScaffoldTemplate).toBeDefined();
      expect(getAvailableScaffolds).toBeDefined();
      expect(recommendScaffold).toBeDefined();
    });

    it('should work correctly', () => {
      const scaffold = getReasoningScaffold('prover');
      expect(scaffold.id).toBe('prover');
    });
  });

  describe('RoleChecklists exports', () => {
    it('should export RoleChecklists namespace', () => {
      expect(RoleChecklists).toBeDefined();
      expect(RoleChecklists.get).toBeDefined();
      expect(RoleChecklists.BACKEND).toBeDefined();
    });

    it('should export standalone functions', () => {
      expect(getRoleChecklist).toBeDefined();
      expect(getChecklistTemplate).toBeDefined();
      expect(getAvailableChecklists).toBeDefined();
      expect(applyChecklistOverrides).toBeDefined();
      expect(getRelevantChecklistItems).toBeDefined();
    });

    it('should work correctly', () => {
      const checklist = getRoleChecklist('backend');
      expect(checklist.id).toBe('backend');
    });
  });

  describe('OutputContracts exports', () => {
    it('should export OutputContracts namespace', () => {
      expect(OutputContracts).toBeDefined();
      expect(OutputContracts.get).toBeDefined();
      expect(OutputContracts.STANDARD).toBeDefined();
    });

    it('should export standalone functions', () => {
      expect(getOutputContract).toBeDefined();
      expect(getContractTemplate).toBeDefined();
      expect(getAvailableContracts).toBeDefined();
      expect(recommendContract).toBeDefined();
      expect(validateResponse).toBeDefined();
      expect(extractSections).toBeDefined();
    });

    it('should work correctly', () => {
      const contract = getOutputContract('standard');
      expect(contract.id).toBe('standard');
    });
  });

  describe('UncertaintyProtocols exports', () => {
    it('should export UncertaintyProtocols namespace', () => {
      expect(UncertaintyProtocols).toBeDefined();
      expect(UncertaintyProtocols.get).toBeDefined();
      expect(UncertaintyProtocols.BALANCED).toBeDefined();
    });

    it('should export standalone functions', () => {
      expect(getUncertaintyProtocol).toBeDefined();
      expect(getProtocolTemplate).toBeDefined();
      expect(getAvailableModes).toBeDefined();
      expect(formatConfidence).toBeDefined();
      expect(assessConfidence).toBeDefined();
      expect(shouldAsk).toBeDefined();
      expect(formatAssumptions).toBeDefined();
    });

    it('should work correctly', () => {
      const protocol = getUncertaintyProtocol('balanced');
      expect(protocol.id).toBe('balanced');
    });
  });

  describe('PromptComposer exports', () => {
    it('should export PromptComposer namespace', () => {
      expect(PromptComposer).toBeDefined();
      expect(PromptComposer.compose).toBeDefined();
      expect(PromptComposer.composeSmart).toBeDefined();
    });

    it('should export standalone functions', () => {
      expect(composePrompt).toBeDefined();
      expect(composeSmartPrompt).toBeDefined();
      expect(composeAutomatosXPrompt).toBeDefined();
      expect(validateConfig).toBeDefined();
    });

    it('should export AUTOMATOSX_REPO_CONTEXT', () => {
      expect(AUTOMATOSX_REPO_CONTEXT).toBeDefined();
      expect(AUTOMATOSX_REPO_CONTEXT.packageManager).toBe('pnpm');
    });

    it('should work correctly', () => {
      const result = composeSmartPrompt('Test', 'simple task');
      expect(result.text).toBeDefined();
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('CognitiveFramework quick reference', () => {
    it('should list available scaffolds', () => {
      expect(CognitiveFramework.scaffolds).toContain('prover');
      expect(CognitiveFramework.scaffolds).toContain('lite');
    });

    it('should list available checklists', () => {
      expect(CognitiveFramework.checklists).toContain('backend');
      expect(CognitiveFramework.checklists).toContain('frontend');
      expect(CognitiveFramework.checklists).toContain('security');
      expect(CognitiveFramework.checklists).toContain('quality');
      expect(CognitiveFramework.checklists).toContain('architecture');
      expect(CognitiveFramework.checklists).toContain('devops');
      expect(CognitiveFramework.checklists).toContain('data');
      expect(CognitiveFramework.checklists).toContain('product');
      expect(CognitiveFramework.checklists).toContain('none');
    });

    it('should list available contracts', () => {
      expect(CognitiveFramework.contracts).toContain('standard');
      expect(CognitiveFramework.contracts).toContain('minimal');
      expect(CognitiveFramework.contracts).toContain('detailed');
    });

    it('should list available uncertainty modes', () => {
      expect(CognitiveFramework.uncertaintyModes).toContain('ask_first');
      expect(CognitiveFramework.uncertaintyModes).toContain('proceed_with_assumptions');
      expect(CognitiveFramework.uncertaintyModes).toContain('balanced');
    });

    it('should list confidence levels', () => {
      expect(CognitiveFramework.confidenceLevels).toContain('high');
      expect(CognitiveFramework.confidenceLevels).toContain('medium');
      expect(CognitiveFramework.confidenceLevels).toContain('low');
    });
  });

  describe('Integration test', () => {
    it('should compose full prompt with all components', () => {
      const result = composePrompt({
        basePrompt: 'You are a backend developer.',
        config: DEFAULT_COGNITIVE_CONFIG,
        repoContext: AUTOMATOSX_REPO_CONTEXT,
      });

      // Should contain all main sections
      expect(result.text).toContain('PROVER');
      expect(result.text).toContain('DOMAIN CHECKLIST');
      expect(result.text).toContain('OUTPUT FORMAT');
      expect(result.text).toContain('UNCERTAINTY');

      // Should have reasonable token count
      expect(result.estimatedTokens).toBeGreaterThan(500);

      // Components should be tracked
      expect(result.components.scaffold).toBe('prover');
      expect(result.components.outputContract).toBe('standard');
    });

    it('should compose lite prompt', () => {
      const result = composePrompt({
        basePrompt: 'You are a helper.',
        config: LITE_COGNITIVE_CONFIG,
      });

      expect(result.text).toContain('LITE');
      expect(result.text).toContain('MINIMAL');
      expect(result.estimatedTokens).toBeLessThan(2000);
    });
  });
});
