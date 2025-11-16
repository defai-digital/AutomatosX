/**
 * Tests for Agent Delegation Preview
 *
 * Comprehensive test suite for agent delegation preview generation,
 * comparison, and rendering features.
 */

import { describe, it, expect } from 'vitest';
import {
  generateDelegationPreview,
  renderDelegationPreview,
  renderInlineDelegationPrompt,
  renderDelegationConfirmation,
  compareAgentsForTask,
  renderAgentComparison,
  type AgentDelegationPreview,
  type ExpectedAction
} from '../src/agent-preview.js';

describe('Agent Delegation Preview', () => {
  describe('generateDelegationPreview', () => {
    it('should generate preview for implementation task', () => {
      const preview = generateDelegationPreview('backend', 'implement user authentication API');

      expect(preview.agent).toBe('backend');
      expect(preview.displayName).toBe('Bob (Backend)');
      expect(preview.task).toBe('implement user authentication API');
      expect(preview.capabilities.length).toBeGreaterThan(0);
      expect(preview.expectedActions.length).toBeGreaterThan(0);
      expect(preview.estimatedDuration).toBeGreaterThan(0);
    });

    it('should infer write actions for implementation', () => {
      const preview = generateDelegationPreview('backend', 'create a new REST API');

      const writeActions = preview.expectedActions.filter(a => a.type === 'write');
      expect(writeActions.length).toBeGreaterThan(0);
    });

    it('should infer read and analyze actions for review', () => {
      const preview = generateDelegationPreview('quality', 'review the authentication code');

      const readActions = preview.expectedActions.filter(a => a.type === 'read');
      const analyzeActions = preview.expectedActions.filter(a => a.type === 'analyze');

      expect(readActions.length).toBeGreaterThan(0);
      expect(analyzeActions.length).toBeGreaterThan(0);
    });

    it('should infer test writing actions', () => {
      const preview = generateDelegationPreview('quality', 'write tests for the API');

      const writeActions = preview.expectedActions.filter(a => a.type === 'write');
      expect(writeActions.some(a => a.description.toLowerCase().includes('test'))).toBe(true);
    });

    it('should identify high-risk actions for deployment', () => {
      const preview = generateDelegationPreview('devops', 'deploy to production');

      const highRiskActions = preview.expectedActions.filter(a => a.risk === 'high');
      expect(highRiskActions.length).toBeGreaterThan(0);
    });

    it('should add product-specific actions', () => {
      const preview = generateDelegationPreview('product', 'design user onboarding flow');

      const hasSpecDoc = preview.expectedActions.some(a =>
        a.description.toLowerCase().includes('specification')
      );
      expect(hasSpecDoc).toBe(true);
    });

    it('should add architecture-specific actions', () => {
      const preview = generateDelegationPreview('architecture', 'design microservices architecture');

      const hasADR = preview.expectedActions.some(a =>
        a.description.toLowerCase().includes('adr')
      );
      expect(hasADR).toBe(true);
    });

    it('should estimate longer duration for implementations', () => {
      const implementPreview = generateDelegationPreview('backend', 'implement feature');
      const reviewPreview = generateDelegationPreview('quality', 'review code');

      // Implementation should take longer
      expect(implementPreview.estimatedDuration).toBeGreaterThan(reviewPreview.estimatedDuration);
    });

    it('should identify required approvals for write actions', () => {
      const preview = generateDelegationPreview('backend', 'create new files');

      expect(preview.requiredApprovals).toBeDefined();
      expect(preview.requiredApprovals!.some(a => a.includes('File modification'))).toBe(true);
    });

    it('should identify potential risks', () => {
      const preview = generateDelegationPreview('backend', 'implement feature');

      expect(preview.potentialRisks).toBeDefined();
      expect(preview.potentialRisks!.length).toBeGreaterThan(0);
    });

    it('should handle unknown agent', () => {
      const preview = generateDelegationPreview('unknown', 'do something');

      expect(preview.agent).toBe('unknown');
      expect(preview.displayName).toBe('unknown');
      expect(preview.capabilities).toContain('General development');
    });

    it('should add generic actions when no keywords match', () => {
      const preview = generateDelegationPreview('backend', 'random task');

      expect(preview.expectedActions.length).toBeGreaterThan(0);
      expect(preview.expectedActions.some(a => a.type === 'analyze')).toBe(true);
    });

    it('should handle debug task', () => {
      const preview = generateDelegationPreview('backend', 'fix the authentication bug');

      const readActions = preview.expectedActions.filter(a => a.type === 'read');
      const writeActions = preview.expectedActions.filter(a => a.type === 'write');

      expect(readActions.length).toBeGreaterThan(0);
      expect(writeActions.length).toBeGreaterThan(0);
    });
  });

  describe('renderDelegationPreview', () => {
    it('should render full preview', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Create API endpoint',
        capabilities: ['API design', 'Database schema'],
        expectedActions: [
          { type: 'write', description: 'Create API files', risk: 'medium' },
          { type: 'write', description: 'Add tests', risk: 'low' }
        ],
        estimatedDuration: 120000 // 2 minutes
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Agent Delegation Preview');
      expect(result).toContain('Bob (Backend)');
      expect(result).toContain('Create API endpoint');
      expect(result).toContain('2m 0s');
      expect(result).toContain('Capabilities:');
      expect(result).toContain('API design');
      expect(result).toContain('Expected Actions:');
      expect(result).toContain('Create API files');
    });

    it('should show required approvals', () => {
      const preview: AgentDelegationPreview = {
        agent: 'devops',
        displayName: 'Oliver (DevOps)',
        task: 'Deploy to production',
        capabilities: ['CI/CD'],
        expectedActions: [
          { type: 'execute', description: 'Run deployment', target: 'production', risk: 'high' }
        ],
        estimatedDuration: 300000,
        requiredApprovals: ['High-risk action approval', 'Command execution approval']
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Requires Approval:');
      expect(result).toContain('High-risk action approval');
      expect(result).toContain('Command execution approval');
    });

    it('should show potential risks', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Modify database',
        capabilities: ['Database'],
        expectedActions: [
          { type: 'write', description: 'Update schema', risk: 'high' }
        ],
        estimatedDuration: 60000,
        potentialRisks: ['Will modify existing files', 'Includes high-risk operations']
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Potential Risks:');
      expect(result).toContain('Will modify existing files');
      expect(result).toContain('Includes high-risk operations');
    });

    it('should show action targets', () => {
      const preview: AgentDelegationPreview = {
        agent: 'devops',
        displayName: 'Oliver (DevOps)',
        task: 'Deploy',
        capabilities: ['CI/CD'],
        expectedActions: [
          { type: 'execute', description: 'Deploy', target: 'production', risk: 'high' }
        ],
        estimatedDuration: 60000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Target:');
      expect(result).toContain('production');
    });

    it('should number actions', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [
          { type: 'read', description: 'Action 1', risk: 'safe' },
          { type: 'write', description: 'Action 2', risk: 'low' },
          { type: 'analyze', description: 'Action 3', risk: 'safe' }
        ],
        estimatedDuration: 60000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
    });
  });

  describe('renderInlineDelegationPrompt', () => {
    it('should render inline prompt', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Create API',
        capabilities: ['API'],
        expectedActions: [
          { type: 'write', description: 'Create files', risk: 'medium' }
        ],
        estimatedDuration: 90000 // 1m 30s
      };

      const result = renderInlineDelegationPrompt(preview);

      expect(result).toContain('Delegating to');
      expect(result).toContain('Bob (Backend)');
      expect(result).toContain('1m 30s');
      expect(result).toContain('1 actions');
    });

    it('should show correct action count', () => {
      const preview: AgentDelegationPreview = {
        agent: 'quality',
        displayName: 'Queenie (QA)',
        task: 'Review',
        capabilities: ['Testing'],
        expectedActions: [
          { type: 'read', description: 'Read', risk: 'safe' },
          { type: 'analyze', description: 'Analyze', risk: 'safe' },
          { type: 'write', description: 'Report', risk: 'low' }
        ],
        estimatedDuration: 60000
      };

      const result = renderInlineDelegationPrompt(preview);

      expect(result).toContain('3 actions');
    });
  });

  describe('renderDelegationConfirmation', () => {
    it('should show confirmation for high-risk actions', () => {
      const preview: AgentDelegationPreview = {
        agent: 'devops',
        displayName: 'Oliver (DevOps)',
        task: 'Deploy',
        capabilities: ['CI/CD'],
        expectedActions: [
          { type: 'execute', description: 'Deploy', risk: 'high' }
        ],
        estimatedDuration: 60000
      };

      const result = renderDelegationConfirmation(preview);

      expect(result).toContain('high-risk actions');
      expect(result).toContain('Do you want to proceed?');
      expect(result).toContain('Yes, proceed');
      expect(result).toContain('Preview actions first');
      expect(result).toContain('No, cancel');
    });

    it('should show confirmation for required approvals', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Modify files',
        capabilities: ['Dev'],
        expectedActions: [
          { type: 'write', description: 'Write', risk: 'medium' }
        ],
        estimatedDuration: 60000,
        requiredApprovals: ['File modification approval']
      };

      const result = renderDelegationConfirmation(preview);

      expect(result).toContain('requires approval');
      expect(result).toContain('File modification approval');
    });

    it('should return empty for safe actions', () => {
      const preview: AgentDelegationPreview = {
        agent: 'quality',
        displayName: 'Queenie (QA)',
        task: 'Review',
        capabilities: ['Testing'],
        expectedActions: [
          { type: 'read', description: 'Read', risk: 'safe' }
        ],
        estimatedDuration: 60000
      };

      const result = renderDelegationConfirmation(preview);

      expect(result).toBe('');
    });
  });

  describe('compareAgentsForTask', () => {
    it('should compare agents for task', () => {
      const comparisons = compareAgentsForTask(
        'implement authentication API',
        ['backend', 'frontend', 'security']
      );

      expect(comparisons.length).toBe(3);
      expect(comparisons[0]).toHaveProperty('agent');
      expect(comparisons[0]).toHaveProperty('suitability');
      expect(comparisons[0]).toHaveProperty('reason');
      expect(comparisons[0]).toHaveProperty('estimatedDuration');
    });

    it('should sort by suitability descending', () => {
      const comparisons = compareAgentsForTask(
        'implement authentication API',
        ['backend', 'frontend', 'product']
      );

      for (let i = 0; i < comparisons.length - 1; i++) {
        expect(comparisons[i].suitability).toBeGreaterThanOrEqual(comparisons[i + 1].suitability);
      }
    });

    it('should rank backend highest for API tasks', () => {
      const comparisons = compareAgentsForTask(
        'create REST API endpoint',
        ['backend', 'frontend', 'quality']
      );

      expect(comparisons[0].agent).toBe('backend');
    });

    it('should rank frontend highest for UI tasks', () => {
      const comparisons = compareAgentsForTask(
        'create React component for user profile',
        ['backend', 'frontend', 'quality']
      );

      expect(comparisons[0].agent).toBe('frontend');
    });

    it('should rank security highest for auth tasks', () => {
      const comparisons = compareAgentsForTask(
        'implement OAuth authentication',
        ['backend', 'security', 'product']
      );

      expect(comparisons[0].agent).toBe('security');
    });

    it('should rank quality highest for testing tasks', () => {
      const comparisons = compareAgentsForTask(
        'write unit tests for API',
        ['backend', 'quality', 'frontend']
      );

      expect(comparisons[0].agent).toBe('quality');
    });

    it('should calculate reasonable suitability scores', () => {
      const comparisons = compareAgentsForTask(
        'implement feature',
        ['backend', 'frontend']
      );

      comparisons.forEach(comp => {
        expect(comp.suitability).toBeGreaterThanOrEqual(0);
        expect(comp.suitability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('renderAgentComparison', () => {
    it('should render comparison table', () => {
      const comparisons = [
        { agent: 'backend', suitability: 0.9, reason: 'Excellent match', estimatedDuration: 120000 },
        { agent: 'frontend', suitability: 0.6, reason: 'Good fit', estimatedDuration: 150000 },
        { agent: 'quality', suitability: 0.4, reason: 'Can help', estimatedDuration: 180000 }
      ];

      const result = renderAgentComparison('implement authentication', comparisons);

      expect(result).toContain('Agent Comparison');
      expect(result).toContain('implement authentication');
      expect(result).toContain('backend');
      expect(result).toContain('frontend');
      expect(result).toContain('quality');
      expect(result).toContain('Excellent match');
      expect(result).toContain('Good fit');
      expect(result).toContain('Can help');
    });

    it('should show star for best match', () => {
      const comparisons = [
        { agent: 'backend', suitability: 0.95, reason: 'Best', estimatedDuration: 60000 },
        { agent: 'frontend', suitability: 0.50, reason: 'OK', estimatedDuration: 60000 }
      ];

      const result = renderAgentComparison('task', comparisons);

      expect(result).toContain('★');
    });

    it('should show duration for each agent', () => {
      const comparisons = [
        { agent: 'backend', suitability: 0.9, reason: 'Best', estimatedDuration: 120000 }, // 2m
        { agent: 'frontend', suitability: 0.6, reason: 'OK', estimatedDuration: 90000 } // 1m 30s
      ];

      const result = renderAgentComparison('task', comparisons);

      expect(result).toContain('2m 0s');
      expect(result).toContain('1m 30s');
    });

    it('should show suitability bars', () => {
      const comparisons = [
        { agent: 'backend', suitability: 0.9, reason: 'Best', estimatedDuration: 60000 },
        { agent: 'frontend', suitability: 0.5, reason: 'OK', estimatedDuration: 60000 }
      ];

      const result = renderAgentComparison('task', comparisons);

      expect(result).toContain('90%');
      expect(result).toContain('50%');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long task descriptions', () => {
      const longTask = 'implement ' + 'a very '.repeat(100) + 'complex feature';

      const preview = generateDelegationPreview('backend', longTask);

      expect(preview.task).toBe(longTask);
      expect(preview.expectedActions.length).toBeGreaterThan(0);
    });

    it('should handle task with all keywords', () => {
      const preview = generateDelegationPreview(
        'backend',
        'implement, create, test, review, audit, fix, debug, deploy'
      );

      expect(preview.expectedActions.length).toBeGreaterThan(5);
    });

    it('should handle zero duration', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'read', description: 'Read', risk: 'safe' }],
        estimatedDuration: 0
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('0s');
    });

    it('should handle very long duration', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'write', description: 'Write', risk: 'medium' }],
        estimatedDuration: 3600000 // 1 hour
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('60m 0s');
    });

    it('should handle empty capabilities', () => {
      const preview: AgentDelegationPreview = {
        agent: 'custom',
        displayName: 'Custom Agent',
        task: 'Task',
        capabilities: [],
        expectedActions: [{ type: 'analyze', description: 'Analyze', risk: 'safe' }],
        estimatedDuration: 60000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Custom Agent');
    });

    it('should handle many expected actions', () => {
      const manyActions = Array.from({ length: 20 }, (_, i) => ({
        type: 'write' as const,
        description: `Action ${i}`,
        risk: 'medium' as const
      }));

      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Complex task',
        capabilities: ['Dev'],
        expectedActions: manyActions,
        estimatedDuration: 600000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Action 0');
      expect(result).toContain('Action 19');
    });

    it('should handle empty required approvals', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'read', description: 'Read', risk: 'safe' }],
        estimatedDuration: 60000,
        requiredApprovals: []
      };

      const result = renderDelegationPreview(preview);

      expect(result).not.toContain('Requires Approval:');
    });

    it('should handle empty potential risks', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'read', description: 'Read', risk: 'safe' }],
        estimatedDuration: 60000,
        potentialRisks: []
      };

      const result = renderDelegationPreview(preview);

      expect(result).not.toContain('Potential Risks:');
    });

    it('should handle special characters in task', () => {
      const preview = generateDelegationPreview('backend', 'implement @#$%^&*() feature');

      expect(preview.task).toContain('@#$%^&*()');
    });

    it('should handle comparison with single agent', () => {
      const comparisons = compareAgentsForTask('implement feature', ['backend']);

      expect(comparisons.length).toBe(1);
      expect(comparisons[0].agent).toBe('backend');
    });

    it('should handle comparison with many agents', () => {
      const agents = [
        'backend', 'frontend', 'security', 'quality', 'product',
        'architecture', 'fullstack', 'mobile', 'devops'
      ];

      const comparisons = compareAgentsForTask('implement feature', agents);

      expect(comparisons.length).toBe(agents.length);
    });

    it('should handle zero suitability', () => {
      const comparisons = [
        { agent: 'backend', suitability: 0, reason: 'Not suitable', estimatedDuration: 60000 }
      ];

      const result = renderAgentComparison('task', comparisons);

      expect(result).toContain('0%');
    });

    it('should handle perfect suitability', () => {
      const comparisons = [
        { agent: 'backend', suitability: 1.0, reason: 'Perfect match', estimatedDuration: 60000 }
      ];

      const result = renderAgentComparison('task', comparisons);

      expect(result).toContain('100%');
    });

    it('should handle unknown agent avatar', () => {
      const preview: AgentDelegationPreview = {
        agent: 'unknown-agent-xyz',
        displayName: 'Unknown',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'analyze', description: 'Analyze', risk: 'safe' }],
        estimatedDuration: 60000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('🤖'); // Default avatar
    });

    it('should handle action without target', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Task',
        capabilities: ['Dev'],
        expectedActions: [
          { type: 'write', description: 'Write files', risk: 'medium' }
        ],
        estimatedDuration: 60000
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('Write files');
      expect(result).not.toContain('Target:');
    });

    it('should handle very short duration', () => {
      const preview: AgentDelegationPreview = {
        agent: 'backend',
        displayName: 'Bob (Backend)',
        task: 'Quick task',
        capabilities: ['Dev'],
        expectedActions: [{ type: 'read', description: 'Read', risk: 'safe' }],
        estimatedDuration: 500 // < 1 second
      };

      const result = renderDelegationPreview(preview);

      expect(result).toContain('0s');
    });

    it('should handle all agent types', () => {
      const agents = [
        'backend', 'frontend', 'security', 'quality', 'product',
        'architecture', 'fullstack', 'mobile', 'devops'
      ];

      agents.forEach(agent => {
        const preview = generateDelegationPreview(agent, 'test task');

        expect(preview.agent).toBe(agent);
        expect(preview.displayName).toBeTruthy();
        expect(preview.capabilities.length).toBeGreaterThan(0);
      });
    });

    it('should handle all action types', () => {
      const actionTypes: Array<ExpectedAction['type']> = ['read', 'write', 'execute', 'delegate', 'analyze'];

      actionTypes.forEach(type => {
        const preview: AgentDelegationPreview = {
          agent: 'backend',
          displayName: 'Bob (Backend)',
          task: 'Task',
          capabilities: ['Dev'],
          expectedActions: [{ type, description: `${type} action`, risk: 'medium' }],
          estimatedDuration: 60000
        };

        const result = renderDelegationPreview(preview);

        expect(result).toContain(`${type} action`);
      });
    });

    it('should handle all risk levels', () => {
      const riskLevels: Array<ExpectedAction['risk']> = ['safe', 'low', 'medium', 'high'];

      riskLevels.forEach(risk => {
        const preview: AgentDelegationPreview = {
          agent: 'backend',
          displayName: 'Bob (Backend)',
          task: 'Task',
          capabilities: ['Dev'],
          expectedActions: [{ type: 'write', description: 'Action', risk }],
          estimatedDuration: 60000
        };

        const result = renderDelegationPreview(preview);

        expect(result).toBeTruthy();
      });
    });
  });
});
