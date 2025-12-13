/**
 * Tests for RoleChecklists module
 */

import { describe, it, expect } from 'vitest';
import {
  RoleChecklists,
  getRoleChecklist,
  getChecklistTemplate,
  getAvailableChecklists,
  applyChecklistOverrides,
  getRelevantChecklistItems,
} from '../../../../src/agents/cognitive/role-checklists.js';

describe('RoleChecklists', () => {
  describe('getRoleChecklist', () => {
    it('should return backend checklist', () => {
      const checklist = getRoleChecklist('backend');

      expect(checklist.id).toBe('backend');
      expect(checklist.role).toBe('Backend Developer');
      expect(checklist.categories).toBeDefined();
      expect(checklist.template).toBeDefined();
    });

    it('should return frontend checklist', () => {
      const checklist = getRoleChecklist('frontend');

      expect(checklist.id).toBe('frontend');
      expect(checklist.role).toBe('Frontend Developer');
    });

    it('should return security checklist', () => {
      const checklist = getRoleChecklist('security');

      expect(checklist.id).toBe('security');
      expect(checklist.role).toBe('Security Engineer');
    });

    it('should return quality checklist', () => {
      const checklist = getRoleChecklist('quality');

      expect(checklist.id).toBe('quality');
      expect(checklist.role).toBe('QA Engineer');
    });

    it('should return architecture checklist', () => {
      const checklist = getRoleChecklist('architecture');

      expect(checklist.id).toBe('architecture');
      expect(checklist.role).toBe('Software Architect');
    });

    it('should return devops checklist', () => {
      const checklist = getRoleChecklist('devops');

      expect(checklist.id).toBe('devops');
      expect(checklist.role).toBe('DevOps Engineer');
    });

    it('should return data checklist', () => {
      const checklist = getRoleChecklist('data');

      expect(checklist.id).toBe('data');
      expect(checklist.role).toBe('Data Engineer');
    });

    it('should return product checklist', () => {
      const checklist = getRoleChecklist('product');

      expect(checklist.id).toBe('product');
      expect(checklist.role).toBe('Product Manager');
    });

    it('should return none checklist', () => {
      const checklist = getRoleChecklist('none');

      expect(checklist.id).toBe('none');
      expect(checklist.template).toBe('');
      expect(Object.keys(checklist.categories)).toHaveLength(0);
    });

    it('should throw for unknown checklist', () => {
      expect(() => getRoleChecklist('unknown' as any)).toThrow(
        'Unknown checklist type: unknown'
      );
    });
  });

  describe('Backend checklist', () => {
    it('should have security category', () => {
      const checklist = getRoleChecklist('backend');

      expect(checklist.categories.security).toBeDefined();
      expect(checklist.categories.security!.length).toBeGreaterThan(0);
    });

    it('should have data_integrity category', () => {
      const checklist = getRoleChecklist('backend');

      expect(checklist.categories.data_integrity).toBeDefined();
    });

    it('should have performance category', () => {
      const checklist = getRoleChecklist('backend');

      expect(checklist.categories.performance).toBeDefined();
    });

    it('should have reliability category', () => {
      const checklist = getRoleChecklist('backend');

      expect(checklist.categories.reliability).toBeDefined();
    });

    it('should have critical severity items', () => {
      const checklist = getRoleChecklist('backend');
      const criticalItems = checklist.categories.security!.filter(
        item => item.severity === 'critical'
      );

      expect(criticalItems.length).toBeGreaterThan(0);
    });

    it('should have triggers for items', () => {
      const checklist = getRoleChecklist('backend');

      for (const item of checklist.categories.security!) {
        expect(item.triggers).toBeDefined();
        expect(item.triggers?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Security checklist', () => {
    it('should have threat_model category', () => {
      const checklist = getRoleChecklist('security');

      expect(checklist.categories.threat_model).toBeDefined();
    });

    it('should have owasp_top_10 category', () => {
      const checklist = getRoleChecklist('security');

      expect(checklist.categories.owasp_top_10).toBeDefined();
      expect(checklist.categories.owasp_top_10!.length).toBeGreaterThanOrEqual(10);
    });

    it('should have secrets category', () => {
      const checklist = getRoleChecklist('security');

      expect(checklist.categories.secrets).toBeDefined();
    });
  });

  describe('getChecklistTemplate', () => {
    it('should return formatted backend template', () => {
      const template = getChecklistTemplate('backend');

      expect(template).toContain('DOMAIN CHECKLIST: Backend');
      expect(template).toContain('Security');
      expect(template).toContain('Data Integrity');
      expect(template).toContain('Performance');
      expect(template).toContain('Reliability');
    });

    it('should return empty string for none', () => {
      const template = getChecklistTemplate('none');

      expect(template).toBe('');
    });

    it('should include checkbox formatting', () => {
      const template = getChecklistTemplate('backend');

      expect(template).toContain('- [ ]');
      expect(template).toContain('[x]');
      expect(template).toContain('[N/A]');
      expect(template).toContain('[RISK]');
    });
  });

  describe('getAvailableChecklists', () => {
    it('should return all checklist types', () => {
      const checklists = getAvailableChecklists();

      expect(checklists).toContain('backend');
      expect(checklists).toContain('frontend');
      expect(checklists).toContain('security');
      expect(checklists).toContain('quality');
      expect(checklists).toContain('architecture');
      expect(checklists).toContain('devops');
      expect(checklists).toContain('data');
      expect(checklists).toContain('product');
      expect(checklists).toContain('none');
      expect(checklists).toHaveLength(9);
    });
  });

  describe('applyChecklistOverrides', () => {
    it('should add custom items', () => {
      const result = applyChecklistOverrides('backend', {
        add: ['Custom check 1', 'Custom check 2'],
      });

      expect(result).toContain('**Custom Checks**');
      expect(result).toContain('Custom check 1');
      expect(result).toContain('Custom check 2');
    });

    it('should remove specified items', () => {
      const original = getChecklistTemplate('backend');
      const result = applyChecklistOverrides('backend', {
        remove: ['Authentication'],
      });

      expect(original).toContain('Authentication');
      expect(result).not.toContain('- [ ] Authentication');
    });

    it('should handle both add and remove', () => {
      const result = applyChecklistOverrides('backend', {
        add: ['New custom check'],
        remove: ['Caching'], // Use a simpler item without regex special characters
      });

      expect(result).toContain('New custom check');
      // The removal uses partial match, so Caching line should be removed
      expect(result).not.toContain('- [ ] Caching');
    });

    it('should return original if no overrides', () => {
      const original = getChecklistTemplate('backend');
      const result = applyChecklistOverrides('backend', {});

      expect(result).toBe(original);
    });

    it('should clean up empty lines after removal', () => {
      const result = applyChecklistOverrides('backend', {
        remove: ['Authentication'],
      });

      // Should not have triple newlines
      expect(result).not.toMatch(/\n\n\n+/);
    });
  });

  describe('getRelevantChecklistItems', () => {
    it('should always include critical items', () => {
      const items = getRelevantChecklistItems('backend', 'simple task');

      const criticalItems = items.filter(item => item.severity === 'critical');
      expect(criticalItems.length).toBeGreaterThan(0);
    });

    it('should include items matching triggers', () => {
      const items = getRelevantChecklistItems('backend', 'implement API endpoint');

      const apiItems = items.filter(item => item.id.includes('sec'));
      expect(apiItems.length).toBeGreaterThan(0);
    });

    it('should include database items for database tasks', () => {
      const items = getRelevantChecklistItems('backend', 'update database schema');

      const hasDataItem = items.some(
        item => item.category === 'data_integrity' || item.triggers?.includes('database')
      );
      expect(hasDataItem).toBe(true);
    });

    it('should be case-insensitive for triggers', () => {
      const items1 = getRelevantChecklistItems('backend', 'API endpoint');
      const items2 = getRelevantChecklistItems('backend', 'api endpoint');

      expect(items1.length).toBe(items2.length);
    });

    it('should return empty array for none checklist', () => {
      const items = getRelevantChecklistItems('none', 'any task');

      expect(items).toEqual([]);
    });
  });

  describe('RoleChecklists namespace', () => {
    it('should expose get function', () => {
      const checklist = RoleChecklists.get('security');
      expect(checklist.id).toBe('security');
    });

    it('should expose getTemplate function', () => {
      const template = RoleChecklists.getTemplate('devops');
      expect(template).toContain('DevOps');
    });

    it('should expose getAvailable function', () => {
      const available = RoleChecklists.getAvailable();
      expect(available.length).toBeGreaterThan(0);
    });

    it('should expose applyOverrides function', () => {
      const result = RoleChecklists.applyOverrides('quality', {
        add: ['Test'],
      });
      expect(result).toContain('Test');
    });

    it('should expose getRelevant function', () => {
      const items = RoleChecklists.getRelevant('frontend', 'react component');
      expect(items.length).toBeGreaterThan(0);
    });

    it('should expose checklist constants', () => {
      expect(RoleChecklists.BACKEND.id).toBe('backend');
      expect(RoleChecklists.FRONTEND.id).toBe('frontend');
      expect(RoleChecklists.SECURITY.id).toBe('security');
      expect(RoleChecklists.QUALITY.id).toBe('quality');
      expect(RoleChecklists.ARCHITECTURE.id).toBe('architecture');
      expect(RoleChecklists.DEVOPS.id).toBe('devops');
      expect(RoleChecklists.DATA.id).toBe('data');
      expect(RoleChecklists.PRODUCT.id).toBe('product');
    });
  });

  describe('Checklist item structure', () => {
    it('should have unique IDs across all items', () => {
      const checklists = getAvailableChecklists().filter(c => c !== 'none');
      const allIds = new Set<string>();

      for (const type of checklists) {
        const checklist = getRoleChecklist(type);
        for (const category of Object.values(checklist.categories)) {
          for (const item of category) {
            expect(allIds.has(item.id)).toBe(false);
            allIds.add(item.id);
          }
        }
      }
    });

    it('should have severity for all items', () => {
      const checklists = getAvailableChecklists().filter(c => c !== 'none');
      const validSeverities = ['critical', 'high', 'medium', 'low'];

      for (const type of checklists) {
        const checklist = getRoleChecklist(type);
        for (const category of Object.values(checklist.categories)) {
          for (const item of category) {
            expect(validSeverities).toContain(item.severity);
          }
        }
      }
    });
  });
});
