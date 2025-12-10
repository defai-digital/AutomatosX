/**
 * Cognitive Framework Tests
 *
 * Golden tests for the cognitive prompt engineering framework.
 * Tests that prompts are composed correctly and produce consistent outputs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReasoningScaffolds,
  RoleChecklists,
  OutputContracts,
  UncertaintyProtocols,
  PromptComposer,
  DEFAULT_COGNITIVE_CONFIG,
  LITE_COGNITIVE_CONFIG,
} from '../../../src/agents/cognitive/index.js';
import type { CognitiveFrameworkConfig } from '../../../src/types/cognitive.js';

describe('Cognitive Framework', () => {
  describe('ReasoningScaffolds', () => {
    it('should return PROVER scaffold with all 7 steps', () => {
      const scaffold = ReasoningScaffolds.get('prover');

      expect(scaffold.id).toBe('prover');
      expect(scaffold.name).toBe('PROVER');
      expect(scaffold.steps).toHaveLength(7);
      expect(scaffold.steps.map(s => s.name)).toEqual([
        'INTAKE',
        'RISK SCAN',
        'OPTIONS',
        'PLAN',
        'EXECUTE',
        'VALIDATE',
        'REPORT',
      ]);
    });

    it('should return LITE scaffold with 4 steps', () => {
      const scaffold = ReasoningScaffolds.get('lite');

      expect(scaffold.id).toBe('lite');
      expect(scaffold.name).toBe('LITE');
      expect(scaffold.steps).toHaveLength(4);
      expect(scaffold.steps.map(s => s.name)).toEqual([
        'UNDERSTAND',
        'DO',
        'VERIFY',
        'REPORT',
      ]);
    });

    it('should recommend PROVER for complex tasks', () => {
      expect(ReasoningScaffolds.recommend('implement user authentication API')).toBe('prover');
      expect(ReasoningScaffolds.recommend('design database schema for multi-tenant system')).toBe('prover');
      expect(ReasoningScaffolds.recommend('refactor the authentication module')).toBe('prover');
    });

    it('should recommend LITE for simple tasks', () => {
      expect(ReasoningScaffolds.recommend('fix typo in readme')).toBe('lite');
      expect(ReasoningScaffolds.recommend('update comment in function')).toBe('lite');
      expect(ReasoningScaffolds.recommend('rename variable')).toBe('lite');
    });

    it('should generate template with all required sections', () => {
      const template = ReasoningScaffolds.getTemplate('prover');

      expect(template).toContain('INTAKE');
      expect(template).toContain('RISK SCAN');
      expect(template).toContain('OPTIONS');
      expect(template).toContain('PLAN');
      expect(template).toContain('EXECUTE');
      expect(template).toContain('VALIDATE');
      expect(template).toContain('REPORT');
      expect(template).toContain('ASK rather than assume');
    });
  });

  describe('RoleChecklists', () => {
    it('should return backend checklist with security, data, performance, reliability categories', () => {
      const checklist = RoleChecklists.get('backend');

      expect(checklist.id).toBe('backend');
      expect(checklist.role).toBe('Backend Developer');
      expect(Object.keys(checklist.categories)).toEqual([
        'security',
        'data_integrity',
        'performance',
        'reliability',
      ]);
    });

    it('should return frontend checklist with a11y, UX, performance, security categories', () => {
      const checklist = RoleChecklists.get('frontend');

      expect(checklist.id).toBe('frontend');
      expect(Object.keys(checklist.categories)).toContain('accessibility');
      expect(Object.keys(checklist.categories)).toContain('user_experience');
      expect(Object.keys(checklist.categories)).toContain('performance');
      expect(Object.keys(checklist.categories)).toContain('security');
    });

    it('should return security checklist with OWASP top 10', () => {
      const checklist = RoleChecklists.get('security');

      expect(checklist.id).toBe('security');
      expect(checklist.categories['owasp_top_10']).toBeDefined();
      expect(checklist.categories['owasp_top_10']!.length).toBeGreaterThanOrEqual(10);
    });

    it('should include critical items in relevant checklist items', () => {
      const items = RoleChecklists.getRelevant('backend', 'implement user login API');

      // Should include security items (critical)
      const securityItems = items.filter(i => i.category === 'security');
      expect(securityItems.length).toBeGreaterThan(0);

      // Should include items triggered by 'api' keyword
      const apiTriggered = items.filter(i => i.triggers?.includes('api'));
      expect(apiTriggered.length).toBeGreaterThan(0);
    });

    it('should apply checklist overrides correctly', () => {
      const original = RoleChecklists.getTemplate('backend');
      const modified = RoleChecklists.applyOverrides('backend', {
        add: ['Custom check: Verify rate limiting is implemented'],
        remove: ['Connection pooling'],
      });

      expect(modified).toContain('Custom check: Verify rate limiting');
      expect(modified).not.toContain('Connection pooling');
    });

    it('should return all available checklists', () => {
      const available = RoleChecklists.getAvailable();

      expect(available).toContain('backend');
      expect(available).toContain('frontend');
      expect(available).toContain('security');
      expect(available).toContain('quality');
      expect(available).toContain('architecture');
      expect(available).toContain('devops');
      expect(available).toContain('data');
      expect(available).toContain('product');
      expect(available).toContain('none');
    });
  });

  describe('OutputContracts', () => {
    it('should return standard contract with all required sections', () => {
      const contract = OutputContracts.get('standard');

      expect(contract.id).toBe('standard');
      expect(contract.sections.filter(s => s.required)).toHaveLength(6);

      const requiredNames = contract.sections.filter(s => s.required).map(s => s.name);
      expect(requiredNames).toContain('Context');
      expect(requiredNames).toContain('Plan');
      expect(requiredNames).toContain('Actions');
      expect(requiredNames).toContain('Verification');
      expect(requiredNames).toContain('Risks');
      expect(requiredNames).toContain('Next Steps');
    });

    it('should return minimal contract with fewer sections', () => {
      const contract = OutputContracts.get('minimal');

      expect(contract.id).toBe('minimal');
      expect(contract.sections.length).toBeLessThan(6);
    });

    it('should return detailed contract with extra sections', () => {
      const contract = OutputContracts.get('detailed');

      expect(contract.id).toBe('detailed');

      // Should have standard sections plus extras
      const sectionNames = contract.sections.map(s => s.name);
      expect(sectionNames).toContain('Options Considered');
      expect(sectionNames).toContain('Dependencies');
      expect(sectionNames).toContain('Rollback Plan');
    });

    it('should validate response against contract', () => {
      const compliantResponse = `
**Context**
- Goal: Test the validation
- Constraints: None
- Assumptions: None

**Plan**
1. Step one

**Actions**
- Did something: \`file.ts:1\`

**Verification**
- Validated: Test passed
- Gaps: None

**Risks**
Risks: None identified

**Next Steps**
Ready for review
      `;

      const result = OutputContracts.validate(compliantResponse, 'standard');

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing sections', () => {
      const incompleteResponse = `
**Context**
- Goal: Test

**Plan**
1. Step

**Actions**
- Did something
      `;

      const result = OutputContracts.validate(incompleteResponse, 'standard');

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Verification');
      expect(result.missing).toContain('Risks');
      expect(result.missing).toContain('Next Steps');
    });

    it('should extract sections from response', () => {
      const response = `
**Context**
Goal: Test extraction

**Plan**
1. Do something
2. Do another thing

**Actions**
- Action one
      `;

      const sections = OutputContracts.extractSections(response);

      expect(sections['Context']).toContain('Goal: Test extraction');
      expect(sections['Plan']).toContain('Do something');
      expect(sections['Actions']).toContain('Action one');
    });

    it('should recommend contracts based on task', () => {
      expect(OutputContracts.recommend('fix typo')).toBe('minimal');
      expect(OutputContracts.recommend('implement feature')).toBe('standard');
      expect(OutputContracts.recommend('design architecture for major migration')).toBe('detailed');
    });
  });

  describe('UncertaintyProtocols', () => {
    it('should return ask_first protocol', () => {
      const protocol = UncertaintyProtocols.get('ask_first');

      expect(protocol.id).toBe('ask_first');
      expect(protocol.askWhen.length).toBeGreaterThan(0);
      expect(protocol.proceedWhen.length).toBeGreaterThan(0);
    });

    it('should return proceed_with_assumptions protocol', () => {
      const protocol = UncertaintyProtocols.get('proceed_with_assumptions');

      expect(protocol.id).toBe('proceed_with_assumptions');
      expect(protocol.askWhen.length).toBeLessThan(protocol.proceedWhen.length);
    });

    it('should return balanced protocol', () => {
      const protocol = UncertaintyProtocols.get('balanced');

      expect(protocol.id).toBe('balanced');
      expect(protocol.template).toContain('Risk Assessment Quick Check');
    });

    it('should determine when to ask based on risk factors', () => {
      // Should ask for security + irreversible
      const result1 = UncertaintyProtocols.shouldAsk({
        mode: 'balanced',
        hasSecurity: true,
        hasDataRisk: false,
        isIrreversible: true,
        scopeExceedsExpected: false,
        multipleApproaches: false,
        userRequestedConfirmation: false,
      });
      expect(result1.shouldAsk).toBe(true);

      // Should not ask for low-risk changes
      const result2 = UncertaintyProtocols.shouldAsk({
        mode: 'balanced',
        hasSecurity: false,
        hasDataRisk: false,
        isIrreversible: false,
        scopeExceedsExpected: false,
        multipleApproaches: false,
        userRequestedConfirmation: false,
      });
      expect(result2.shouldAsk).toBe(false);

      // Should always ask when user requested
      const result3 = UncertaintyProtocols.shouldAsk({
        mode: 'proceed_with_assumptions',
        hasSecurity: false,
        hasDataRisk: false,
        isIrreversible: false,
        scopeExceedsExpected: false,
        multipleApproaches: false,
        userRequestedConfirmation: true,
      });
      expect(result3.shouldAsk).toBe(true);
    });

    it('should assess confidence correctly', () => {
      expect(UncertaintyProtocols.assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 0,
        isNovel: false,
      })).toBe('high');

      expect(UncertaintyProtocols.assessConfidence({
        hasExistingPattern: false,
        isWellDocumented: false,
        hasBeenValidated: false,
        assumptionCount: 5,
        isNovel: true,
      })).toBe('low');

      expect(UncertaintyProtocols.assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: false,
        hasBeenValidated: false,
        assumptionCount: 1,
        isNovel: false,
      })).toBe('medium');
    });

    it('should format assumptions correctly', () => {
      const assumptions = ['User wants REST API', 'Database is PostgreSQL'];

      const askFirstFormat = UncertaintyProtocols.formatAssumptions(assumptions, 'ask_first');
      expect(askFirstFormat).toContain('please verify');

      const proceedFormat = UncertaintyProtocols.formatAssumptions(assumptions, 'proceed_with_assumptions');
      expect(proceedFormat).toContain('Proceeding with the above');
    });
  });

  describe('PromptComposer', () => {
    const basePrompt = `You are Bob, a Backend Engineer.

**Personality**: Methodical and precise
**Catchphrase**: "Measure twice, code once"

Communication style: Technical and data-driven`;

    it('should compose prompt with all components', () => {
      const config: CognitiveFrameworkConfig = {
        scaffold: 'prover',
        checklist: 'backend',
        outputContract: 'standard',
        uncertaintyMode: 'balanced',
      };

      const composed = PromptComposer.compose({
        basePrompt,
        config,
      });

      // Should include all components
      expect(composed.text).toContain('Bob');
      expect(composed.text).toContain('PROVER');
      expect(composed.text).toContain('Backend');
      expect(composed.text).toContain('OUTPUT FORMAT');
      expect(composed.text).toContain('UNCERTAINTY');

      // Should report components used
      expect(composed.components.persona).toBe(true);
      expect(composed.components.scaffold).toBe('prover');
      expect(composed.components.checklist).toBe('backend');
      expect(composed.components.outputContract).toBe('standard');
      expect(composed.components.uncertainty).toBe('balanced');

      // Should estimate tokens
      expect(composed.estimatedTokens).toBeGreaterThan(0);
    });

    it('should clean old thinking patterns from persona', () => {
      const oldPrompt = `You are Bob.

Your thinking patterns:
- Think about scalability
- Measure performance

Communication style: Technical`;

      const composed = PromptComposer.compose({
        basePrompt: oldPrompt,
        config: DEFAULT_COGNITIVE_CONFIG,
      });

      // Should remove old thinking patterns (handled by framework now)
      expect(composed.text).not.toContain('Your thinking patterns:');
      expect(composed.text).toContain('Bob'); // But keep persona
    });

    it('should add repo context when provided', () => {
      const composed = PromptComposer.composeAutomatosX(basePrompt, DEFAULT_COGNITIVE_CONFIG);

      expect(composed.text).toContain('pnpm');
      expect(composed.text).toContain('ESM');
      expect(composed.text).toContain('Vitest');
    });

    it('should validate config and report errors', () => {
      const result = PromptComposer.validateConfig({
        scaffold: 'invalid' as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about conflicting settings', () => {
      const result = PromptComposer.validateConfig({
        scaffold: 'lite',
        outputContract: 'detailed',
        checklist: 'backend',
        uncertaintyMode: 'balanced',
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('LITE') && w.includes('DETAILED'))).toBe(true);
    });

    it('should use smart defaults with composeSmart', () => {
      const composed = PromptComposer.composeSmart(
        basePrompt,
        'implement user authentication API',
        'Backend Developer'
      );

      // Should infer backend checklist
      expect(composed.components.checklist).toBe('backend');
      // Should use PROVER for complex task
      expect(composed.components.scaffold).toBe('prover');
    });
  });

  describe('Default Configs', () => {
    it('should have sensible DEFAULT_COGNITIVE_CONFIG', () => {
      expect(DEFAULT_COGNITIVE_CONFIG.scaffold).toBe('prover');
      expect(DEFAULT_COGNITIVE_CONFIG.outputContract).toBe('standard');
      expect(DEFAULT_COGNITIVE_CONFIG.uncertaintyMode).toBe('balanced');
    });

    it('should have lightweight LITE_COGNITIVE_CONFIG', () => {
      expect(LITE_COGNITIVE_CONFIG.scaffold).toBe('lite');
      expect(LITE_COGNITIVE_CONFIG.outputContract).toBe('minimal');
      expect(LITE_COGNITIVE_CONFIG.uncertaintyMode).toBe('proceed_with_assumptions');
    });
  });
});

describe('Golden Test Scenarios', () => {
  describe('Backend Agent Prompt', () => {
    it('should compose complete backend prompt', () => {
      const composed = PromptComposer.compose({
        basePrompt: `You are Bob, a Senior Backend Engineer.

**Personality**: Methodical, performance-obsessed
**Catchphrase**: "Performance is measured."

Communication style: Technical precision.`,
        config: {
          scaffold: 'prover',
          checklist: 'backend',
          outputContract: 'standard',
          uncertaintyMode: 'balanced',
        },
      });

      // Verify all essential components are present
      expect(composed.text).toContain('Bob');
      expect(composed.text).toContain('Backend');

      // Reasoning scaffold
      expect(composed.text).toContain('INTAKE');
      expect(composed.text).toContain('RISK SCAN');
      expect(composed.text).toContain('VALIDATE');

      // Backend checklist
      expect(composed.text).toContain('Authentication');
      expect(composed.text).toContain('N+1 queries');
      expect(composed.text).toContain('Error handling');

      // Output contract
      expect(composed.text).toContain('**Context**');
      expect(composed.text).toContain('**Verification**');
      expect(composed.text).toContain('**Risks**');

      // Uncertainty protocol
      expect(composed.text).toContain('ASK rather than assume');
    });
  });

  describe('Quality Agent Prompt', () => {
    it('should compose complete quality prompt', () => {
      const composed = PromptComposer.compose({
        basePrompt: `You are Queenie, a QA Engineer.

**Personality**: Detail-oriented, methodical
**Catchphrase**: "Quality is not an act, it's a habit."

Communication style: Methodical and detailed.`,
        config: {
          scaffold: 'prover',
          checklist: 'quality',
          outputContract: 'standard',
          uncertaintyMode: 'balanced',
        },
      });

      // Quality checklist
      expect(composed.text).toContain('Test Scope');
      expect(composed.text).toContain('Regression');
      expect(composed.text).toContain('Isolation');
    });
  });

  describe('Simple Task Prompt', () => {
    it('should compose lightweight prompt for simple tasks', () => {
      const composed = PromptComposer.compose({
        basePrompt: 'You are a helper agent.',
        config: LITE_COGNITIVE_CONFIG,
      });

      // Should use LITE scaffold
      expect(composed.text).toContain('UNDERSTAND');
      expect(composed.text).toContain('DO');
      expect(composed.text).toContain('VERIFY');

      // Should NOT have heavy sections
      expect(composed.text).not.toContain('RISK SCAN');
      expect(composed.text).not.toContain('OPTIONS');

      // Should use minimal output
      expect(composed.text).toContain('MINIMAL');
    });
  });
});
