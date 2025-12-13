/**
 * Tests for ReasoningScaffolds module
 */

import { describe, it, expect } from 'vitest';
import {
  ReasoningScaffolds,
  getReasoningScaffold,
  getScaffoldTemplate,
  getAvailableScaffolds,
  recommendScaffold,
} from '../../../../src/agents/cognitive/reasoning-scaffolds.js';

describe('ReasoningScaffolds', () => {
  describe('getReasoningScaffold', () => {
    it('should return prover scaffold', () => {
      const scaffold = getReasoningScaffold('prover');

      expect(scaffold.id).toBe('prover');
      expect(scaffold.name).toBe('PROVER');
      expect(scaffold.steps).toBeDefined();
      expect(scaffold.steps.length).toBeGreaterThan(0);
      expect(scaffold.template).toBeDefined();
    });

    it('should return lite scaffold', () => {
      const scaffold = getReasoningScaffold('lite');

      expect(scaffold.id).toBe('lite');
      expect(scaffold.name).toBe('LITE');
      expect(scaffold.steps).toBeDefined();
      expect(scaffold.steps.length).toBeGreaterThan(0);
      expect(scaffold.template).toBeDefined();
    });

    it('should throw for unknown scaffold', () => {
      expect(() => getReasoningScaffold('unknown' as any)).toThrow(
        'Unknown reasoning scaffold: unknown'
      );
    });
  });

  describe('PROVER scaffold', () => {
    it('should have 7 steps', () => {
      const scaffold = getReasoningScaffold('prover');
      expect(scaffold.steps).toHaveLength(7);
    });

    it('should have required steps in order', () => {
      const scaffold = getReasoningScaffold('prover');
      const stepNames = scaffold.steps.map(s => s.name);

      expect(stepNames).toEqual([
        'INTAKE',
        'RISK SCAN',
        'OPTIONS',
        'PLAN',
        'EXECUTE',
        'VALIDATE',
        'REPORT',
      ]);
    });

    it('should have required actions for each step', () => {
      const scaffold = getReasoningScaffold('prover');

      for (const step of scaffold.steps) {
        expect(step.requiredActions).toBeDefined();
        expect(step.requiredActions.length).toBeGreaterThan(0);
      }
    });

    it('should have skipWhen conditions for skippable steps', () => {
      const scaffold = getReasoningScaffold('prover');
      const intakeStep = scaffold.steps.find(s => s.id === '1_intake');
      const optionsStep = scaffold.steps.find(s => s.id === '3_options');

      expect(intakeStep?.skipWhen).toBeDefined();
      expect(intakeStep?.skipWhen?.length).toBeGreaterThan(0);
      expect(optionsStep?.skipWhen).toBeDefined();
      expect(optionsStep?.skipWhen?.length).toBeGreaterThan(0);
    });

    it('should have template with all step names', () => {
      const scaffold = getReasoningScaffold('prover');

      expect(scaffold.template).toContain('INTAKE');
      expect(scaffold.template).toContain('RISK SCAN');
      expect(scaffold.template).toContain('OPTIONS');
      expect(scaffold.template).toContain('PLAN');
      expect(scaffold.template).toContain('EXECUTE');
      expect(scaffold.template).toContain('VALIDATE');
      expect(scaffold.template).toContain('REPORT');
    });
  });

  describe('LITE scaffold', () => {
    it('should have 4 steps', () => {
      const scaffold = getReasoningScaffold('lite');
      expect(scaffold.steps).toHaveLength(4);
    });

    it('should have required steps in order', () => {
      const scaffold = getReasoningScaffold('lite');
      const stepNames = scaffold.steps.map(s => s.name);

      expect(stepNames).toEqual([
        'UNDERSTAND',
        'DO',
        'VERIFY',
        'REPORT',
      ]);
    });

    it('should have simpler required actions', () => {
      const scaffold = getReasoningScaffold('lite');

      // LITE should have fewer required actions than PROVER
      const prover = getReasoningScaffold('prover');
      const liteActions = scaffold.steps.reduce((sum, s) => sum + s.requiredActions.length, 0);
      const proverActions = prover.steps.reduce((sum, s) => sum + s.requiredActions.length, 0);

      expect(liteActions).toBeLessThan(proverActions);
    });

    it('should mention escalation to PROVER in template', () => {
      const scaffold = getReasoningScaffold('lite');
      expect(scaffold.template).toContain('PROVER');
    });
  });

  describe('getScaffoldTemplate', () => {
    it('should return prover template', () => {
      const template = getScaffoldTemplate('prover');

      expect(template).toContain('MANDATORY REASONING LOOP');
      expect(template).toContain('PROVER');
    });

    it('should return lite template', () => {
      const template = getScaffoldTemplate('lite');

      expect(template).toContain('REASONING LOOP (LITE)');
    });

    it('should throw for unknown scaffold', () => {
      expect(() => getScaffoldTemplate('unknown' as any)).toThrow();
    });
  });

  describe('getAvailableScaffolds', () => {
    it('should return all scaffold types', () => {
      const scaffolds = getAvailableScaffolds();

      expect(scaffolds).toContain('prover');
      expect(scaffolds).toContain('lite');
      expect(scaffolds).toHaveLength(2);
    });
  });

  describe('recommendScaffold', () => {
    describe('should recommend prover for complex tasks', () => {
      it('with implement keyword', () => {
        expect(recommendScaffold('implement user authentication system')).toBe('prover');
      });

      it('with design keyword', () => {
        expect(recommendScaffold('design the database schema for orders')).toBe('prover');
      });

      it('with architect keyword', () => {
        expect(recommendScaffold('architect the new microservices system')).toBe('prover');
      });

      it('with refactor keyword', () => {
        expect(recommendScaffold('refactor the authentication module')).toBe('prover');
      });

      it('with migrate keyword', () => {
        expect(recommendScaffold('migrate the database to PostgreSQL')).toBe('prover');
      });

      it('with security keyword', () => {
        expect(recommendScaffold('add security measures to the API')).toBe('prover');
      });

      it('with performance keyword', () => {
        expect(recommendScaffold('optimize performance of database queries')).toBe('prover');
      });

      it('with multiple complexity indicators', () => {
        expect(recommendScaffold('implement API for multi-tenant system')).toBe('prover');
      });

      it('with long task descriptions (>30 words) plus complexity indicator', () => {
        // Word count alone adds only 1 point, need at least 2 complexity indicators
        const longTask = 'This is a very long task description that contains many words to design the architecture and should trigger the complexity heuristic based on the word count plus additional indicators';
        expect(recommendScaffold(longTask)).toBe('prover');
      });
    });

    describe('should recommend lite for simple tasks', () => {
      it('with fix typo', () => {
        expect(recommendScaffold('fix typo in the readme')).toBe('lite');
      });

      it('with update comment', () => {
        expect(recommendScaffold('update comment in the config file')).toBe('lite');
      });

      it('with rename', () => {
        expect(recommendScaffold('rename variable foo to bar')).toBe('lite');
      });

      it('with add log', () => {
        expect(recommendScaffold('add log statement to debug')).toBe('lite');
      });

      it('with simple keyword', () => {
        expect(recommendScaffold('simple change to button text')).toBe('lite');
      });

      it('with quick keyword', () => {
        expect(recommendScaffold('quick update to the version')).toBe('lite');
      });

      it('with minor keyword', () => {
        expect(recommendScaffold('minor formatting changes')).toBe('lite');
      });
    });

    it('should be case-insensitive', () => {
      expect(recommendScaffold('FIX TYPO')).toBe('lite');
      expect(recommendScaffold('IMPLEMENT AUTH')).toBe('prover');
    });

    it('should default to lite for short ambiguous tasks', () => {
      expect(recommendScaffold('update file')).toBe('lite');
      expect(recommendScaffold('change setting')).toBe('lite');
    });

    it('should prioritize simple indicators over complex', () => {
      // If both simple and complex indicators present, simple wins (checked first)
      expect(recommendScaffold('simple api implementation')).toBe('lite');
    });
  });

  describe('ReasoningScaffolds namespace', () => {
    it('should expose get function', () => {
      const scaffold = ReasoningScaffolds.get('prover');
      expect(scaffold.id).toBe('prover');
    });

    it('should expose getTemplate function', () => {
      const template = ReasoningScaffolds.getTemplate('lite');
      expect(template).toContain('LITE');
    });

    it('should expose getAvailable function', () => {
      const available = ReasoningScaffolds.getAvailable();
      expect(available).toHaveLength(2);
    });

    it('should expose recommend function', () => {
      // Need at least 2 complexity indicators for prover recommendation
      const recommended = ReasoningScaffolds.recommend('implement complex api system');
      expect(recommended).toBe('prover');
    });

    it('should expose PROVER constant', () => {
      expect(ReasoningScaffolds.PROVER.id).toBe('prover');
    });

    it('should expose LITE constant', () => {
      expect(ReasoningScaffolds.LITE.id).toBe('lite');
    });
  });
});
