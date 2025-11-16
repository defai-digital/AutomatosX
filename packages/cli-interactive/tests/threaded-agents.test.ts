/**
 * Tests for threaded-agents.ts
 * Verifies agent delegation hierarchy visualization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentUpdate,
  renderAgentUpdate,
  renderAgentThread,
  renderDelegationChain,
  renderAgentSummary,
  renderLiveAgentStatus,
  buildAgentThread,
  getAgentDisplayName,
  type AgentUpdate,
  type AgentThread
} from '../src/threaded-agents.js';

describe('Threaded Agents', () => {
  describe('createAgentUpdate', () => {
    it('should create a basic agent update', () => {
      const update = createAgentUpdate('backend', 'Implement API', 'starting');

      expect(update.agent).toBe('backend');
      expect(update.task).toBe('Implement API');
      expect(update.status).toBe('starting');
      expect(update.depth).toBe(0);
      expect(update.timestamp).toBeInstanceOf(Date);
    });

    it('should accept optional parameters', () => {
      const update = createAgentUpdate('security', 'Audit code', 'complete', {
        depth: 2,
        duration: 5000,
        displayName: 'Steve (Security)',
        output: 'No vulnerabilities found'
      });

      expect(update.depth).toBe(2);
      expect(update.duration).toBe(5000);
      expect(update.displayName).toBe('Steve (Security)');
      expect(update.output).toBe('No vulnerabilities found');
    });

    it('should set default depth to 0', () => {
      const update = createAgentUpdate('quality', 'Run tests');

      expect(update.depth).toBe(0);
    });

    it('should record timestamp', () => {
      const before = Date.now();
      const update = createAgentUpdate('backend', 'Task');
      const after = Date.now();

      expect(update.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(update.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('renderAgentUpdate', () => {
    let update: AgentUpdate;

    beforeEach(() => {
      update = createAgentUpdate('backend', 'Implement API endpoint', 'in_progress', {
        displayName: 'Bob (Backend)'
      });
    });

    it('should render agent update with avatar', () => {
      const result = renderAgentUpdate(update);

      expect(result).toContain('🔧'); // Backend avatar
      expect(result).toContain('Bob (Backend)');
      expect(result).toContain('Implement API endpoint');
    });

    it('should show status indicator', () => {
      const starting = createAgentUpdate('backend', 'Task', 'starting');
      const complete = createAgentUpdate('backend', 'Task', 'complete');
      const error = createAgentUpdate('backend', 'Task', 'error');

      expect(renderAgentUpdate(starting)).toMatch(/◉/);
      expect(renderAgentUpdate(complete)).toMatch(/✓/);
      expect(renderAgentUpdate(error)).toMatch(/✗/);
    });

    it('should show duration if present', () => {
      update.duration = 3500; // 3.5 seconds
      const result = renderAgentUpdate(update, { showDuration: true });

      expect(result).toMatch(/3s|3\.5s/);
    });

    it('should hide duration if option disabled', () => {
      update.duration = 3500;
      const result = renderAgentUpdate(update, { showDuration: false });

      expect(result).not.toMatch(/\d+s/);
    });

    it('should show timestamp if enabled', () => {
      const result = renderAgentUpdate(update, { showTimestamp: true });

      expect(result).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    it('should respect depth indentation', () => {
      const depth0 = createAgentUpdate('backend', 'Task', 'starting', { depth: 0 });
      const depth2 = createAgentUpdate('backend', 'Task', 'starting', { depth: 2 });

      const result0 = renderAgentUpdate(depth0);
      const result2 = renderAgentUpdate(depth2);

      // Depth 2 should have more leading spaces
      const indent0 = result0.match(/^(\s*)/)?.[1].length || 0;
      const indent2 = result2.match(/^(\s*)/)?.[1].length || 0;

      expect(indent2).toBeGreaterThan(indent0);
    });

    it('should show output preview for completed tasks', () => {
      update.status = 'complete';
      update.output = 'Successfully created 3 endpoints\nAll tests passed';

      const result = renderAgentUpdate(update);

      expect(result).toContain('Successfully created 3 endpoints');
    });

    it('should truncate long output', () => {
      update.status = 'complete';
      update.output = Array(10).fill('line').join('\n');

      const result = renderAgentUpdate(update);

      expect(result).toContain('truncated');
    });

    it('should show error messages', () => {
      update.status = 'error';
      update.error = 'Connection timeout';

      const result = renderAgentUpdate(update);

      expect(result).toContain('Connection timeout');
      expect(result).toMatch(/error/i);
    });

    it('should respect compact mode', () => {
      const full = renderAgentUpdate(update, { compact: false });
      const compact = renderAgentUpdate(update, { compact: true });

      expect(compact.length).toBeLessThan(full.length);
      expect(compact).not.toContain('Task:'); // Task label hidden in compact
    });
  });

  describe('renderAgentThread', () => {
    let thread: AgentThread;

    beforeEach(() => {
      const root = createAgentUpdate('product', 'Design feature', 'complete', {
        depth: 0,
        duration: 5000
      });

      const child1 = createAgentUpdate('backend', 'Implement API', 'complete', {
        depth: 1,
        parentAgent: 'product',
        duration: 3000
      });

      const child2 = createAgentUpdate('security', 'Audit code', 'complete', {
        depth: 1,
        parentAgent: 'product',
        duration: 2000
      });

      thread = {
        root,
        children: [
          { root: child1, children: [] },
          { root: child2, children: [] }
        ]
      };
    });

    it('should render hierarchical agent thread', () => {
      const result = renderAgentThread(thread);

      expect(result).toContain('product');
      expect(result).toContain('backend');
      expect(result).toContain('security');
    });

    it('should use tree connectors', () => {
      const result = renderAgentThread(thread);

      expect(result).toMatch(/├─|└─/); // Tree branch characters
    });

    it('should show parent-child relationships', () => {
      const result = renderAgentThread(thread);
      const lines = result.split('\n');

      // Product should appear before children
      const productIdx = lines.findIndex(l => l.includes('product'));
      const backendIdx = lines.findIndex(l => l.includes('backend'));
      const securityIdx = lines.findIndex(l => l.includes('security'));

      expect(productIdx).toBeLessThan(backendIdx);
      expect(productIdx).toBeLessThan(securityIdx);
    });

    it('should handle nested delegation', () => {
      const grandchild = createAgentUpdate('quality', 'Run tests', 'complete', {
        depth: 2,
        parentAgent: 'backend'
      });

      thread.children[0].children = [
        { root: grandchild, children: [] }
      ];

      const result = renderAgentThread(thread);

      expect(result).toContain('quality');
      expect(result).toMatch(/├─|└─/);
    });

    it('should handle single agent thread', () => {
      const singleThread: AgentThread = {
        root: createAgentUpdate('backend', 'Task'),
        children: []
      };

      const result = renderAgentThread(singleThread);

      expect(result).toContain('backend');
      expect(result).toBeTruthy();
    });
  });

  describe('renderDelegationChain', () => {
    it('should render sequential delegation chain', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('product', 'Design', 'complete', { depth: 0 }),
        createAgentUpdate('backend', 'Implement', 'complete', { depth: 1 }),
        createAgentUpdate('quality', 'Test', 'in_progress', { depth: 2 })
      ];

      const result = renderDelegationChain(updates);

      expect(result).toContain('Agent Delegation Chain');
      expect(result).toContain('product');
      expect(result).toContain('backend');
      expect(result).toContain('quality');
    });

    it('should show delegation arrows', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('product', 'Task 1'),
        createAgentUpdate('backend', 'Task 2')
      ];

      const result = renderDelegationChain(updates);

      expect(result).toContain('↓');
    });

    it('should show durations if available', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('product', 'Design', 'complete', { duration: 5000 }),
        createAgentUpdate('backend', 'Implement', 'complete', { duration: 8000 })
      ];

      const result = renderDelegationChain(updates);

      expect(result).toMatch(/5s/);
      expect(result).toMatch(/8s/);
    });

    it('should truncate long task descriptions', () => {
      const longTask = 'A'.repeat(100);
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', longTask)
      ];

      const result = renderDelegationChain(updates);

      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longTask.length + 200);
    });

    it('should handle empty update list', () => {
      const result = renderDelegationChain([]);

      expect(result).toBeTruthy();
    });
  });

  describe('renderAgentSummary', () => {
    it('should summarize agent activity', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task 1', 'complete', { duration: 3000 }),
        createAgentUpdate('backend', 'Task 2', 'in_progress'),
        createAgentUpdate('security', 'Audit', 'complete', { duration: 2000 })
      ];

      const result = renderAgentSummary(updates);

      expect(result).toContain('Agent Activity Summary');
      expect(result).toContain('backend');
      expect(result).toContain('security');
    });

    it('should show task completion ratios', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task 1', 'complete'),
        createAgentUpdate('backend', 'Task 2', 'complete'),
        createAgentUpdate('backend', 'Task 3', 'in_progress')
      ];

      const result = renderAgentSummary(updates);

      expect(result).toMatch(/2\/3/); // 2 out of 3 complete
    });

    it('should show total durations per agent', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task 1', 'complete', { duration: 3000 }),
        createAgentUpdate('backend', 'Task 2', 'complete', { duration: 2000 })
      ];

      const result = renderAgentSummary(updates);

      expect(result).toMatch(/5s/); // Total 5 seconds
    });

    it('should handle multiple agents', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task'),
        createAgentUpdate('frontend', 'Task'),
        createAgentUpdate('security', 'Task'),
        createAgentUpdate('quality', 'Task')
      ];

      const result = renderAgentSummary(updates);

      expect(result).toContain('backend');
      expect(result).toContain('frontend');
      expect(result).toContain('security');
      expect(result).toContain('quality');
    });
  });

  describe('renderLiveAgentStatus', () => {
    it('should show agents currently in progress', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Implementing API', 'in_progress'),
        createAgentUpdate('security', 'Auditing', 'starting'),
        createAgentUpdate('quality', 'Testing', 'complete')
      ];

      const result = renderLiveAgentStatus(updates);

      expect(result).toContain('backend');
      expect(result).toContain('security');
      expect(result).not.toContain('quality'); // Complete, not active
    });

    it('should show elapsed time for active agents', () => {
      const pastTime = new Date(Date.now() - 5000); // 5 seconds ago
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task', 'in_progress')
      ];
      updates[0].timestamp = pastTime;

      const result = renderLiveAgentStatus(updates);

      expect(result).toMatch(/5s/);
    });

    it('should show agent count', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task 1', 'in_progress'),
        createAgentUpdate('frontend', 'Task 2', 'in_progress')
      ];

      const result = renderLiveAgentStatus(updates);

      expect(result).toMatch(/2 agents/);
    });

    it('should handle no active agents', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task', 'complete')
      ];

      const result = renderLiveAgentStatus(updates);

      expect(result).toMatch(/no agents.*active/i);
    });

    it('should truncate long task names', () => {
      const longTask = 'A'.repeat(100);
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', longTask, 'in_progress')
      ];

      const result = renderLiveAgentStatus(updates);

      expect(result).toContain('...');
    });
  });

  describe('buildAgentThread', () => {
    it('should build thread from flat updates', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('product', 'Design', 'complete', { depth: 0 }),
        createAgentUpdate('backend', 'Implement', 'complete', {
          depth: 1,
          parentAgent: 'product'
        }),
        createAgentUpdate('security', 'Audit', 'complete', {
          depth: 1,
          parentAgent: 'product'
        })
      ];

      const thread = buildAgentThread(updates);

      expect(thread).not.toBeNull();
      expect(thread!.root.agent).toBe('product');
      expect(thread!.children.length).toBe(2);
      expect(thread!.children[0].root.agent).toBe('backend');
      expect(thread!.children[1].root.agent).toBe('security');
    });

    it('should handle nested delegation', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('product', 'Design', 'complete', { depth: 0 }),
        createAgentUpdate('backend', 'Implement', 'complete', {
          depth: 1,
          parentAgent: 'product'
        }),
        createAgentUpdate('quality', 'Test', 'complete', {
          depth: 2,
          parentAgent: 'backend'
        })
      ];

      const thread = buildAgentThread(updates);

      expect(thread!.root.agent).toBe('product');
      expect(thread!.children[0].root.agent).toBe('backend');
      expect(thread!.children[0].children[0].root.agent).toBe('quality');
    });

    it('should return null for empty updates', () => {
      const thread = buildAgentThread([]);

      expect(thread).toBeNull();
    });

    it('should return null if no root found', () => {
      const updates: AgentUpdate[] = [
        createAgentUpdate('backend', 'Task', 'complete', { depth: 1 })
      ];

      const thread = buildAgentThread(updates);

      expect(thread).toBeNull();
    });
  });

  describe('getAgentDisplayName', () => {
    it('should return display names for known agents', () => {
      expect(getAgentDisplayName('backend')).toBe('Bob (Backend)');
      expect(getAgentDisplayName('frontend')).toBe('Frank (Frontend)');
      expect(getAgentDisplayName('security')).toBe('Steve (Security)');
      expect(getAgentDisplayName('quality')).toBe('Queenie (QA)');
    });

    it('should return agent ID for unknown agents', () => {
      expect(getAgentDisplayName('custom-agent')).toBe('custom-agent');
      expect(getAgentDisplayName('unknown')).toBe('unknown');
    });

    it('should handle all built-in agents', () => {
      const builtInAgents = [
        'backend', 'frontend', 'security', 'quality', 'product',
        'design', 'devops', 'data', 'writer', 'cto', 'ceo',
        'researcher', 'data-scientist', 'architecture', 'fullstack', 'mobile'
      ];

      builtInAgents.forEach(agent => {
        const displayName = getAgentDisplayName(agent);
        expect(displayName).toBeTruthy();
        expect(displayName.length).toBeGreaterThan(agent.length);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle agents with no duration', () => {
      const update = createAgentUpdate('backend', 'Task', 'in_progress');
      const result = renderAgentUpdate(update);

      expect(result).toBeTruthy();
    });

    it('should handle very long durations', () => {
      const update = createAgentUpdate('backend', 'Long task', 'complete', {
        duration: 3600000 * 2 // 2 hours
      });

      const result = renderAgentUpdate(update, { showDuration: true });

      expect(result).toMatch(/2h/);
    });

    it('should handle agent names with special characters', () => {
      const update = createAgentUpdate('my-custom_agent.v2', 'Task');
      const result = renderAgentUpdate(update);

      expect(result).toContain('my-custom_agent.v2');
    });

    it('should handle empty task descriptions', () => {
      const update = createAgentUpdate('backend', '');
      const result = renderAgentUpdate(update);

      expect(result).toBeTruthy();
    });

    it('should handle very deep nesting', () => {
      const updates: AgentUpdate[] = Array(10).fill(0).map((_, i) =>
        createAgentUpdate(`agent-${i}`, `Task ${i}`, 'complete', {
          depth: i,
          parentAgent: i > 0 ? `agent-${i-1}` : undefined
        })
      );

      const thread = buildAgentThread(updates);
      expect(thread).not.toBeNull();

      const result = renderAgentThread(thread!);
      expect(result).toBeTruthy();
    });
  });

  describe('Avatars and Icons', () => {
    it('should use correct avatar for each agent type', () => {
      const agents = [
        { name: 'backend', avatar: '🔧' },
        { name: 'frontend', avatar: '🎨' },
        { name: 'security', avatar: '🔒' },
        { name: 'quality', avatar: '✅' }
      ];

      agents.forEach(({ name, avatar }) => {
        const update = createAgentUpdate(name, 'Task');
        const result = renderAgentUpdate(update);
        expect(result).toContain(avatar);
      });
    });

    it('should use default avatar for unknown agents', () => {
      const update = createAgentUpdate('unknown-agent', 'Task');
      const result = renderAgentUpdate(update);

      expect(result).toContain('🤖'); // Default avatar
    });
  });
});
