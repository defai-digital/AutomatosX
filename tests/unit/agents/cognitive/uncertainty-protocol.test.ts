/**
 * Tests for UncertaintyProtocols module
 */

import { describe, it, expect } from 'vitest';
import {
  UncertaintyProtocols,
  getUncertaintyProtocol,
  getProtocolTemplate,
  getAvailableModes,
  formatConfidence,
  assessConfidence,
  shouldAsk,
  formatAssumptions,
} from '../../../../src/agents/cognitive/uncertainty-protocol.js';

describe('UncertaintyProtocols', () => {
  describe('getUncertaintyProtocol', () => {
    it('should return ask_first protocol', () => {
      const protocol = getUncertaintyProtocol('ask_first');

      expect(protocol.id).toBe('ask_first');
      expect(protocol.name).toBe('Ask First');
      expect(protocol.askWhen).toBeDefined();
      expect(protocol.proceedWhen).toBeDefined();
      expect(protocol.template).toBeDefined();
    });

    it('should return proceed_with_assumptions protocol', () => {
      const protocol = getUncertaintyProtocol('proceed_with_assumptions');

      expect(protocol.id).toBe('proceed_with_assumptions');
      expect(protocol.name).toBe('Proceed With Assumptions');
    });

    it('should return balanced protocol', () => {
      const protocol = getUncertaintyProtocol('balanced');

      expect(protocol.id).toBe('balanced');
      expect(protocol.name).toBe('Balanced');
    });

    it('should throw for unknown protocol', () => {
      expect(() => getUncertaintyProtocol('unknown' as any)).toThrow(
        'Unknown uncertainty mode: unknown'
      );
    });
  });

  describe('Ask First protocol', () => {
    it('should have askWhen conditions', () => {
      const protocol = getUncertaintyProtocol('ask_first');

      expect(protocol.askWhen.length).toBeGreaterThan(0);
      expect(protocol.askWhen.some(w => w.includes('ambiguous'))).toBe(true);
      expect(protocol.askWhen.some(w => w.includes('Security'))).toBe(true);
    });

    it('should have limited proceedWhen conditions', () => {
      const protocol = getUncertaintyProtocol('ask_first');

      // Ask-first should have fewer proceed conditions
      expect(protocol.proceedWhen.length).toBeLessThanOrEqual(3);
    });

    it('should have assumption format', () => {
      const protocol = getUncertaintyProtocol('ask_first');

      expect(protocol.assumptionFormat).toContain('Clarification Needed');
    });
  });

  describe('Proceed With Assumptions protocol', () => {
    it('should have limited askWhen conditions', () => {
      const protocol = getUncertaintyProtocol('proceed_with_assumptions');

      // Proceed protocol should ask only in critical cases
      expect(protocol.askWhen.length).toBeLessThanOrEqual(5);
      expect(protocol.askWhen.some(w => w.includes('Security-critical'))).toBe(true);
    });

    it('should have more proceedWhen conditions', () => {
      const protocol = getUncertaintyProtocol('proceed_with_assumptions');
      const askFirst = getUncertaintyProtocol('ask_first');

      expect(protocol.proceedWhen.length).toBeGreaterThan(askFirst.proceedWhen.length);
    });

    it('should have assumption format', () => {
      const protocol = getUncertaintyProtocol('proceed_with_assumptions');

      expect(protocol.assumptionFormat).toContain('Assumptions Made');
    });
  });

  describe('Balanced protocol', () => {
    it('should have risk-based askWhen conditions', () => {
      const protocol = getUncertaintyProtocol('balanced');

      expect(protocol.askWhen.some(w => w.includes('Security implications'))).toBe(true);
      expect(protocol.askWhen.some(w => w.includes('Irreversible'))).toBe(true);
    });

    it('should have risk-based proceedWhen conditions', () => {
      const protocol = getUncertaintyProtocol('balanced');

      expect(protocol.proceedWhen.some(w => w.includes('low-risk'))).toBe(true);
      expect(protocol.proceedWhen.some(w => w.includes('high confidence'))).toBe(true);
    });

    it('should include risk assessment guidance in template', () => {
      const protocol = getUncertaintyProtocol('balanced');

      expect(protocol.template).toContain('Risk Assessment');
      expect(protocol.template).toContain('severity');
      expect(protocol.template).toContain('reversibility');
    });
  });

  describe('getProtocolTemplate', () => {
    it('should return ask_first template', () => {
      const template = getProtocolTemplate('ask_first');

      expect(template).toContain('UNCERTAINTY HANDLING (ASK FIRST)');
      expect(template).toContain('Ask when');
    });

    it('should return proceed template', () => {
      const template = getProtocolTemplate('proceed_with_assumptions');

      expect(template).toContain('UNCERTAINTY HANDLING (PROCEED WITH ASSUMPTIONS)');
    });

    it('should return balanced template', () => {
      const template = getProtocolTemplate('balanced');

      expect(template).toContain('UNCERTAINTY HANDLING (BALANCED)');
      expect(template).toContain('HIGH RISK');
      expect(template).toContain('LOW RISK');
    });

    it('should include confidence tagging in all templates', () => {
      const modes = getAvailableModes();

      for (const mode of modes) {
        const template = getProtocolTemplate(mode);
        expect(template).toContain('Confidence Tagging');
        expect(template).toContain('[HIGH]');
        expect(template).toContain('[MEDIUM]');
        expect(template).toContain('[LOW]');
      }
    });
  });

  describe('getAvailableModes', () => {
    it('should return all modes', () => {
      const modes = getAvailableModes();

      expect(modes).toContain('ask_first');
      expect(modes).toContain('proceed_with_assumptions');
      expect(modes).toContain('balanced');
      expect(modes).toHaveLength(3);
    });
  });

  describe('formatConfidence', () => {
    it('should format high confidence', () => {
      const formatted = formatConfidence('high');

      expect(formatted).toContain('HIGH');
      expect(formatted).toContain('established');
      expect(formatted).toContain('verified');
    });

    it('should format medium confidence', () => {
      const formatted = formatConfidence('medium');

      expect(formatted).toContain('MEDIUM');
      expect(formatted).toContain('assumptions');
    });

    it('should format low confidence', () => {
      const formatted = formatConfidence('low');

      expect(formatted).toContain('LOW');
      expect(formatted).toContain('Exploratory');
      expect(formatted).toContain('validation');
    });
  });

  describe('assessConfidence', () => {
    it('should return high for well-established patterns', () => {
      const level = assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 0,
        isNovel: false,
      });

      expect(level).toBe('high');
    });

    it('should return low for novel approaches', () => {
      const level = assessConfidence({
        hasExistingPattern: false,
        isWellDocumented: false,
        hasBeenValidated: false,
        assumptionCount: 0,
        isNovel: true,
      });

      expect(level).toBe('low');
    });

    it('should return low for many assumptions', () => {
      const level = assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 5,
        isNovel: false,
      });

      expect(level).toBe('low');
    });

    it('should return medium for typical cases', () => {
      const level = assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: false,
        hasBeenValidated: false,
        assumptionCount: 2,
        isNovel: false,
      });

      expect(level).toBe('medium');
    });

    it('should return low if not validated and no pattern', () => {
      const level = assessConfidence({
        hasExistingPattern: false,
        isWellDocumented: true,
        hasBeenValidated: false,
        assumptionCount: 1,
        isNovel: false,
      });

      expect(level).toBe('low');
    });

    it('should require 1 or fewer assumptions for high', () => {
      const highWith1 = assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 1,
        isNovel: false,
      });

      const lowWith2 = assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 2,
        isNovel: false,
      });

      expect(highWith1).toBe('high');
      expect(lowWith2).toBe('medium');
    });
  });

  describe('shouldAsk', () => {
    describe('always ask scenarios', () => {
      it('should ask when user requested confirmation', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: true,
        });

        expect(result.shouldAsk).toBe(true);
        expect(result.reason).toContain('User requested');
      });

      it('should ask for irreversible security actions', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: true,
          hasDataRisk: false,
          isIrreversible: true,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
        expect(result.reason).toContain('Irreversible');
      });

      it('should ask for irreversible data actions', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: false,
          hasDataRisk: true,
          isIrreversible: true,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });
    });

    describe('ask_first mode', () => {
      it('should ask when multiple approaches exist', () => {
        const result = shouldAsk({
          mode: 'ask_first',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: true,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
        expect(result.reason).toContain('Multiple');
      });

      it('should ask for security implications', () => {
        const result = shouldAsk({
          mode: 'ask_first',
          hasSecurity: true,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });

      it('should ask when scope exceeds expected', () => {
        const result = shouldAsk({
          mode: 'ask_first',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: true,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });
    });

    describe('balanced mode', () => {
      it('should ask for security implications', () => {
        const result = shouldAsk({
          mode: 'balanced',
          hasSecurity: true,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });

      it('should ask for irreversible data risk', () => {
        const result = shouldAsk({
          mode: 'balanced',
          hasSecurity: false,
          hasDataRisk: true,
          isIrreversible: true,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });

      it('should ask for large scope with multiple approaches', () => {
        const result = shouldAsk({
          mode: 'balanced',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: true,
          multipleApproaches: true,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });

      it('should not ask for low-risk changes', () => {
        const result = shouldAsk({
          mode: 'balanced',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(false);
      });
    });

    describe('proceed_with_assumptions mode', () => {
      it('should only ask for critical security + irreversible', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: true,
          hasDataRisk: false,
          isIrreversible: true,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(true);
      });

      it('should not ask for just security implications', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: true,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: false,
          multipleApproaches: false,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(false);
      });

      it('should not ask for scope exceeding', () => {
        const result = shouldAsk({
          mode: 'proceed_with_assumptions',
          hasSecurity: false,
          hasDataRisk: false,
          isIrreversible: false,
          scopeExceedsExpected: true,
          multipleApproaches: true,
          userRequestedConfirmation: false,
        });

        expect(result.shouldAsk).toBe(false);
      });
    });
  });

  describe('formatAssumptions', () => {
    it('should return empty string for no assumptions', () => {
      const formatted = formatAssumptions([], 'balanced');

      expect(formatted).toBe('');
    });

    it('should format assumptions as bullet list', () => {
      const formatted = formatAssumptions(
        ['Assumption 1', 'Assumption 2'],
        'balanced'
      );

      expect(formatted).toContain('- Assumption 1');
      expect(formatted).toContain('- Assumption 2');
    });

    it('should include verification request for ask_first mode', () => {
      const formatted = formatAssumptions(
        ['Test assumption'],
        'ask_first'
      );

      expect(formatted).toContain('please verify');
      expect(formatted).toContain('confirm');
    });

    it('should be less formal for other modes', () => {
      const formatted = formatAssumptions(
        ['Test assumption'],
        'balanced'
      );

      expect(formatted).toContain('Let me know if any are incorrect');
    });
  });

  describe('UncertaintyProtocols namespace', () => {
    it('should expose get function', () => {
      const protocol = UncertaintyProtocols.get('balanced');
      expect(protocol.id).toBe('balanced');
    });

    it('should expose getTemplate function', () => {
      const template = UncertaintyProtocols.getTemplate('ask_first');
      expect(template).toContain('ASK FIRST');
    });

    it('should expose getAvailable function', () => {
      const available = UncertaintyProtocols.getAvailable();
      expect(available).toHaveLength(3);
    });

    it('should expose formatConfidence function', () => {
      const formatted = UncertaintyProtocols.formatConfidence('high');
      expect(formatted).toContain('HIGH');
    });

    it('should expose assessConfidence function', () => {
      const level = UncertaintyProtocols.assessConfidence({
        hasExistingPattern: true,
        isWellDocumented: true,
        hasBeenValidated: true,
        assumptionCount: 0,
        isNovel: false,
      });
      expect(level).toBe('high');
    });

    it('should expose shouldAsk function', () => {
      const result = UncertaintyProtocols.shouldAsk({
        mode: 'balanced',
        hasSecurity: true,
        hasDataRisk: false,
        isIrreversible: false,
        scopeExceedsExpected: false,
        multipleApproaches: false,
        userRequestedConfirmation: false,
      });
      expect(result.shouldAsk).toBe(true);
    });

    it('should expose formatAssumptions function', () => {
      const formatted = UncertaintyProtocols.formatAssumptions(['test'], 'balanced');
      expect(formatted).toContain('test');
    });

    it('should expose protocol constants', () => {
      expect(UncertaintyProtocols.ASK_FIRST.id).toBe('ask_first');
      expect(UncertaintyProtocols.PROCEED.id).toBe('proceed_with_assumptions');
      expect(UncertaintyProtocols.BALANCED.id).toBe('balanced');
    });
  });
});
