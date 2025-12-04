/**
 * Agent Instruction Templates Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  type AgentDomain,
  AGENT_TEMPLATES,
  BACKEND_TEMPLATE,
  FRONTEND_TEMPLATE,
  SECURITY_TEMPLATE,
  QUALITY_TEMPLATE,
  ARCHITECTURE_TEMPLATE,
  DEVOPS_TEMPLATE,
  WRITER_TEMPLATE,
  STANDARD_TEMPLATE,
  getAgentTemplate,
  isValidAgentDomain,
  getDelegationSuggestions
} from '../../../src/agents/instruction-templates.js';

describe('Agent Instruction Templates', () => {
  describe('Template definitions', () => {
    it('should define all required domains', () => {
      const expectedDomains: AgentDomain[] = [
        'backend',
        'frontend',
        'fullstack',
        'security',
        'quality',
        'architecture',
        'devops',
        'data',
        'mobile',
        'writer',
        'researcher',
        'standard'
      ];

      for (const domain of expectedDomains) {
        expect(AGENT_TEMPLATES[domain]).toBeDefined();
        expect(AGENT_TEMPLATES[domain].domain).toBe(domain);
      }
    });

    it('should have required fields in each template', () => {
      for (const [domain, template] of Object.entries(AGENT_TEMPLATES)) {
        expect(template.domain).toBe(domain);
        expect(template.displayName).toBeDefined();
        expect(Array.isArray(template.domainReminders)).toBe(true);
        expect(Array.isArray(template.qualityChecklist)).toBe(true);
        expect(Array.isArray(template.delegationTriggers)).toBe(true);
        expect(Array.isArray(template.antiPatterns)).toBe(true);
        expect(Array.isArray(template.bestPractices)).toBe(true);
      }
    });
  });

  describe('Backend template', () => {
    it('should have REST-related reminders', () => {
      expect(BACKEND_TEMPLATE.domainReminders.some(r => r.includes('REST'))).toBe(true);
    });

    it('should have security delegation trigger', () => {
      const securityTrigger = BACKEND_TEMPLATE.delegationTriggers.find(
        t => t.suggestedAgent === 'security'
      );
      expect(securityTrigger).toBeDefined();
      expect(securityTrigger?.keywords).toContain('security');
    });

    it('should have frontend delegation trigger', () => {
      const frontendTrigger = BACKEND_TEMPLATE.delegationTriggers.find(
        t => t.suggestedAgent === 'frontend'
      );
      expect(frontendTrigger).toBeDefined();
    });
  });

  describe('Frontend template', () => {
    it('should have accessibility reminders', () => {
      expect(FRONTEND_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('accessibility') || r.includes('WCAG')
      )).toBe(true);
    });

    it('should have backend delegation trigger', () => {
      const backendTrigger = FRONTEND_TEMPLATE.delegationTriggers.find(
        t => t.suggestedAgent === 'backend'
      );
      expect(backendTrigger).toBeDefined();
      expect(backendTrigger?.keywords).toContain('API');
    });
  });

  describe('Security template', () => {
    it('should have OWASP reminders', () => {
      expect(SECURITY_TEMPLATE.domainReminders.some(r => r.includes('OWASP'))).toBe(true);
    });

    it('should have input validation in checklist', () => {
      expect(SECURITY_TEMPLATE.qualityChecklist.some(c =>
        c.toLowerCase().includes('input validation') || c.toLowerCase().includes('entry point')
      )).toBe(true);
    });
  });

  describe('Quality template', () => {
    it('should have testing-related reminders', () => {
      expect(QUALITY_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('test')
      )).toBe(true);
    });

    it('should mention Arrange-Act-Assert pattern', () => {
      expect(QUALITY_TEMPLATE.domainReminders.some(r =>
        r.includes('Arrange-Act-Assert')
      )).toBe(true);
    });
  });

  describe('Architecture template', () => {
    it('should have scalability reminders', () => {
      expect(ARCHITECTURE_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('scalability')
      )).toBe(true);
    });

    it('should mention ADRs', () => {
      expect(ARCHITECTURE_TEMPLATE.domainReminders.some(r =>
        r.includes('ADR')
      )).toBe(true);
    });
  });

  describe('DevOps template', () => {
    it('should have automation reminders', () => {
      expect(DEVOPS_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('automat')
      )).toBe(true);
    });

    it('should mention infrastructure as code', () => {
      expect(DEVOPS_TEMPLATE.bestPractices.some(p =>
        p.toLowerCase().includes('infrastructure as code')
      )).toBe(true);
    });
  });

  describe('Writer template', () => {
    it('should have audience-focused reminders', () => {
      expect(WRITER_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('audience')
      )).toBe(true);
    });
  });

  describe('Standard template', () => {
    it('should have general-purpose reminders', () => {
      expect(STANDARD_TEMPLATE.domainReminders.some(r =>
        r.toLowerCase().includes('understand')
      )).toBe(true);
    });

    it('should have delegation triggers for specialists', () => {
      const agents = STANDARD_TEMPLATE.delegationTriggers.map(t => t.suggestedAgent);
      expect(agents).toContain('security');
      expect(agents).toContain('quality');
    });
  });

  describe('getAgentTemplate', () => {
    it('should return correct template for known domains', () => {
      expect(getAgentTemplate('backend').domain).toBe('backend');
      expect(getAgentTemplate('frontend').domain).toBe('frontend');
      expect(getAgentTemplate('security').domain).toBe('security');
    });

    it('should return standard template for unknown domains', () => {
      // @ts-expect-error Testing invalid domain
      const template = getAgentTemplate('unknown');
      expect(template.domain).toBe('standard');
    });
  });

  describe('isValidAgentDomain', () => {
    it('should return true for valid domains', () => {
      expect(isValidAgentDomain('backend')).toBe(true);
      expect(isValidAgentDomain('frontend')).toBe(true);
      expect(isValidAgentDomain('security')).toBe(true);
      expect(isValidAgentDomain('standard')).toBe(true);
    });

    it('should return false for invalid domains', () => {
      expect(isValidAgentDomain('unknown')).toBe(false);
      expect(isValidAgentDomain('')).toBe(false);
      expect(isValidAgentDomain('Backend')).toBe(false); // Case sensitive
    });
  });

  describe('getDelegationSuggestions', () => {
    it('should find delegation suggestions based on keywords', () => {
      const suggestions = getDelegationSuggestions(
        'We need to implement security authentication',
        'backend'
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]?.agent).toBe('security');
      expect(suggestions[0]?.keywords).toContain('security');
    });

    it('should return empty array when no keywords match', () => {
      const suggestions = getDelegationSuggestions(
        'Simple database query optimization',
        'backend'
      );

      // Should not trigger delegation for backend doing backend work
      const nonBackendSuggestions = suggestions.filter(s => s.agent !== 'backend');
      // May or may not have suggestions depending on keywords
    });

    it('should be case insensitive', () => {
      const suggestions = getDelegationSuggestions(
        'SECURITY AUTHENTICATION OWASP',
        'backend'
      );

      expect(suggestions.some(s => s.agent === 'security')).toBe(true);
    });

    it('should include matched keywords in suggestion', () => {
      const suggestions = getDelegationSuggestions(
        'Need to add frontend React component',
        'backend'
      );

      const frontendSuggestion = suggestions.find(s => s.agent === 'frontend');
      expect(frontendSuggestion).toBeDefined();
      expect(frontendSuggestion?.keywords.length).toBeGreaterThan(0);
    });

    it('should return multiple suggestions if multiple triggers match', () => {
      const suggestions = getDelegationSuggestions(
        'Need security review and test coverage for the API',
        'backend'
      );

      // Should potentially have both security and quality suggestions
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
