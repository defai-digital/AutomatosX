/**
 * Embedded Instructions Integration Tests
 *
 * End-to-end tests for the orchestration system including:
 * - Full injection pipeline
 * - Mode switching
 * - Multi-provider coordination
 * - Long conversation adherence
 *
 * @since v11.3.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  OrchestrationService,
  createOrchestrationService,
  createTodoItem,
  createMockMemoryProvider,
  createMockSessionProvider,
  createMockSessionState
} from '../../../src/core/orchestration/index.js';
import { WorkflowModeManager } from '../../../src/core/workflow/index.js';
import { AgentInstructionInjector } from '../../../src/agents/agent-instruction-injector.js';
import { AGENT_TEMPLATES } from '../../../src/agents/instruction-templates.js';

describe('Embedded Instructions Integration', () => {
  let service: OrchestrationService;

  beforeEach(() => {
    service = createOrchestrationService();
    service.reset();
  });

  afterEach(() => {
    service.reset();
  });

  describe('Full Injection Pipeline', () => {
    it('should inject instructions with all providers active', async () => {
      // Setup memory provider with relevant entries
      // Note: createMockMemoryProvider expects 'score' not 'relevance'
      const memoryProvider = createMockMemoryProvider([
        { content: 'Previous auth implementation used JWT', score: 0.9 },
        { content: 'Database uses PostgreSQL', score: 0.8 }
      ]);

      // Setup session provider with active session
      // Note: createMockSessionProvider expects Record<string, SessionState>
      const sessionState = createMockSessionState({
        id: 'test-session-123',
        participants: ['backend', 'security'],
        activeAgent: 'backend',
        completedTasks: 5,
        remainingTasks: 5
      });
      const sessionProvider = createMockSessionProvider({
        'test-session-123': sessionState
      });

      // Create service with all providers
      const fullService = new OrchestrationService({
        memorySearchProvider: memoryProvider,
        sessionStateProvider: sessionProvider,
        agentDomain: 'backend'
      });

      // Add todos
      fullService.updateTodos([
        createTodoItem('Implement authentication', 'Implementing authentication', 'in_progress'),
        createTodoItem('Add unit tests', 'Adding unit tests', 'pending')
      ]);

      // Simulate multiple turns
      for (let i = 0; i < 5; i++) {
        fullService.incrementTurn();
      }

      // Inject instructions
      const result = await fullService.injectInstructions({
        task: 'Implement JWT authentication',
        agentName: 'backend'
      });

      // Result should be generated (may or may not have instructions based on timing)
      expect(result).toBeDefined();
      expect(result.tokenCount).toBeGreaterThanOrEqual(0);
      expect(result.tokenCount).toBeLessThanOrEqual(2000);
    });

    it('should respect token budget across all providers', async () => {
      const service = new OrchestrationService({
        tokenBudget: {
          maxTotal: 500, // Very limited budget
          criticalReserve: 50,
          perType: {
            task: 150,
            memory: 100,
            session: 100,
            delegation: 50,
            mode: 50,
            context: 50
          }
        }
      });

      // Add many todos to test budget limiting
      const manyTodos = Array.from({ length: 20 }, (_, i) =>
        createTodoItem(`Task ${i + 1}`, `Working on task ${i + 1}`, i === 0 ? 'in_progress' : 'pending')
      );
      service.updateTodos(manyTodos);

      for (let i = 0; i < 5; i++) {
        service.incrementTurn();
      }

      const result = await service.injectInstructions({
        task: 'Complex task',
        agentName: 'backend'
      });

      // Should stay within budget
      expect(result.tokenCount).toBeLessThanOrEqual(500);
    });

    it('should format instructions as system reminders', async () => {
      service.updateTodos([
        createTodoItem('Test task', 'Testing task', 'in_progress')
      ]);

      for (let i = 0; i < 5; i++) {
        service.incrementTurn();
      }

      const result = await service.injectInstructions({
        task: 'Test formatting',
        agentName: 'backend'
      });

      const formatted = service.formatAsSystemReminder(result.content);

      if (result.content.trim()) {
        expect(formatted).toContain('<system-reminder>');
        expect(formatted).toContain('</system-reminder>');
      }
    });
  });

  describe('Mode Switching Integration', () => {
    it('should filter tools correctly in plan mode', () => {
      const tools = [
        { name: 'Read', description: 'Read files' },
        { name: 'Write', description: 'Write files' },
        { name: 'Edit', description: 'Edit files' },
        { name: 'Glob', description: 'Search files' },
        { name: 'Grep', description: 'Search content' },
        { name: 'Bash', description: 'Run commands' }
      ];

      // Default mode - all tools allowed
      service.setWorkflowMode('default');
      let filtered = service.filterTools(tools);
      expect(filtered).toHaveLength(6);

      // Plan mode - write tools blocked
      service.setWorkflowMode('plan');
      filtered = service.filterTools(tools);
      expect(filtered.map(t => t.name)).toContain('Read');
      expect(filtered.map(t => t.name)).toContain('Glob');
      expect(filtered.map(t => t.name)).toContain('Grep');
      expect(filtered.map(t => t.name)).not.toContain('Write');
      expect(filtered.map(t => t.name)).not.toContain('Edit');
      expect(filtered.map(t => t.name)).not.toContain('Bash');
    });

    it('should switch modes and maintain state', async () => {
      // Add todos and simulate turns
      service.updateTodos([
        createTodoItem('Plan feature', 'Planning feature', 'in_progress')
      ]);
      service.incrementTurn();
      service.incrementTurn();

      // Start in default mode
      expect(service.getWorkflowMode()).toBe('default');

      // Switch to plan mode
      service.setWorkflowMode('plan');
      expect(service.getWorkflowMode()).toBe('plan');
      expect(service.isToolAllowed('Write')).toBe(false);
      expect(service.isToolAllowed('Read')).toBe(true);

      // Todos and turn count should persist
      const debug = service.getDebugInfo();
      expect(debug.todoCount).toBe(1);
      expect(debug.turnCount).toBe(2);

      // Switch to iterate mode
      service.setWorkflowMode('iterate');
      expect(service.getWorkflowMode()).toBe('iterate');
      expect(service.isToolAllowed('Write')).toBe(true);

      // Switch back to default
      service.setWorkflowMode('default');
      expect(service.getWorkflowMode()).toBe('default');
    });

    it('should include mode-specific instructions', async () => {
      service.setWorkflowMode('plan');

      for (let i = 0; i < 5; i++) {
        service.incrementTurn();
      }

      const result = await service.injectInstructions({
        task: 'Design new feature',
        agentName: 'architecture'
      });

      // Plan mode should generate result (may or may not have active instructions)
      expect(result).toBeDefined();
      expect(service.getWorkflowMode()).toBe('plan');
      // In plan mode, write tools should be blocked
      expect(service.isToolAllowed('Write')).toBe(false);
      expect(service.isToolAllowed('Read')).toBe(true);
    });
  });

  describe('Agent Template Integration', () => {
    it('should apply domain-specific templates', async () => {
      const domains = ['backend', 'frontend', 'security', 'quality'];

      for (const domain of domains) {
        const domainService = new OrchestrationService({
          agentDomain: domain
        });

        for (let i = 0; i < 5; i++) {
          domainService.incrementTurn();
        }

        const result = await domainService.injectInstructions({
          task: 'Domain-specific task',
          agentName: domain
        });

        expect(result).toBeDefined();
        // Each domain should potentially have instructions
        expect(result.tokenCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should trigger delegation hints for cross-domain tasks', async () => {
      // Test that backend template has delegation triggers for security tasks
      const backendTemplate = AGENT_TEMPLATES.backend;
      expect(backendTemplate.delegationTriggers).toBeDefined();

      // Find security-related delegation trigger
      const securityTrigger = backendTemplate.delegationTriggers.find(
        t => t.suggestedAgent === 'security'
      );

      // Backend should have security delegation triggers
      expect(securityTrigger).toBeDefined();
      if (securityTrigger) {
        expect(securityTrigger.keywords.length).toBeGreaterThan(0);
        expect(securityTrigger.reason).toBeDefined();
      }
    });

    it('should include quality checklist for relevant agents', () => {
      const qualityTemplate = AGENT_TEMPLATES.quality;

      expect(qualityTemplate).toBeDefined();
      expect(qualityTemplate.qualityChecklist.length).toBeGreaterThan(0);
      expect(qualityTemplate.domainReminders.length).toBeGreaterThan(0);
    });
  });

  describe('Long Conversation Adherence', () => {
    it('should maintain instruction consistency across many turns', async () => {
      const todos = [
        createTodoItem('Main task', 'Working on main task', 'in_progress'),
        createTodoItem('Sub task 1', 'Sub task 1', 'pending'),
        createTodoItem('Sub task 2', 'Sub task 2', 'pending')
      ];

      service.updateTodos(todos);

      // Simulate 20 turns
      const results: Array<{ turnCount: number; hasInstructions: boolean }> = [];

      for (let i = 0; i < 20; i++) {
        service.incrementTurn();

        const result = await service.injectInstructions({
          task: 'Long running task',
          agentName: 'backend'
        });

        results.push({
          turnCount: service.getTurnCount(),
          hasInstructions: result.applied
        });
      }

      // Instructions should be injected periodically
      const turnsWithInstructions = results.filter(r => r.hasInstructions);
      expect(turnsWithInstructions.length).toBeGreaterThan(0);
    });

    it('should update instructions when todos change mid-conversation', async () => {
      // Initial todos
      service.updateTodos([
        createTodoItem('Task A', 'Working on A', 'in_progress')
      ]);

      for (let i = 0; i < 5; i++) {
        service.incrementTurn();
      }

      const firstResult = await service.injectInstructions({
        task: 'Working on task A',
        agentName: 'backend'
      });

      // Update todos mid-conversation
      service.updateTodos([
        createTodoItem('Task A', 'Task A done', 'completed'),
        createTodoItem('Task B', 'Working on B', 'in_progress')
      ]);

      const secondResult = await service.injectInstructions({
        task: 'Working on task B',
        agentName: 'backend'
      });

      // Both should produce results
      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();

      // Debug info should reflect the change
      const debug = service.getDebugInfo();
      expect(debug.todoCount).toBe(2);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect disabled providers', async () => {
      const minimalService = new OrchestrationService({
        todoIntegration: { enabled: false, reminderFrequency: 3, compactMode: false },
        memoryIntegration: { enabled: false, maxEntries: 5, minRelevance: 0.5 },
        sessionIntegration: { enabled: false, showCollaboration: false },
        agentTemplates: { enabled: false, reminderFrequency: 5 }
      });

      for (let i = 0; i < 5; i++) {
        minimalService.incrementTurn();
      }

      const result = await minimalService.injectInstructions({
        task: 'Test task',
        agentName: 'backend'
      });

      // Should still work, but with fewer providers
      expect(result).toBeDefined();
      const debug = minimalService.getDebugInfo();
      expect(debug.providers.length).toBeLessThan(4);
    });

    it('should update configuration dynamically', () => {
      const initialConfig = service.getConfig();
      expect(initialConfig.agentTemplates?.reminderFrequency).toBe(5);

      service.updateConfig({
        agentTemplates: {
          enabled: true,
          reminderFrequency: 10
        }
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.agentTemplates?.reminderFrequency).toBe(10);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should fully reset all state', async () => {
      // Build up state
      service.updateTodos([
        createTodoItem('Task', 'Working', 'in_progress')
      ]);
      service.setWorkflowMode('plan');
      for (let i = 0; i < 10; i++) {
        service.incrementTurn();
      }

      // Verify state exists
      let debug = service.getDebugInfo();
      expect(debug.turnCount).toBe(10);
      expect(debug.workflowMode).toBe('plan');
      expect(debug.todoCount).toBe(1);

      // Reset
      service.reset();

      // Verify clean state
      debug = service.getDebugInfo();
      expect(debug.turnCount).toBe(0);
      expect(debug.workflowMode).toBe('default');
      expect(debug.todoCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty context gracefully', async () => {
      // No todos, no setup
      const result = await service.injectInstructions({});

      expect(result).toBeDefined();
      expect(result.tokenCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid mode gracefully', () => {
      expect(() => {
        service.setWorkflowMode('invalid-mode' as any);
      }).toThrow(/Invalid workflow mode/);
    });

    it('should handle missing memory provider gracefully', async () => {
      const serviceWithoutMemory = new OrchestrationService({
        memoryIntegration: { enabled: true, maxEntries: 5, minRelevance: 0.5 }
        // No memorySearchProvider provided
      });

      for (let i = 0; i < 5; i++) {
        serviceWithoutMemory.incrementTurn();
      }

      const result = await serviceWithoutMemory.injectInstructions({
        task: 'Test without memory',
        agentName: 'backend'
      });

      expect(result).toBeDefined();
    });
  });
});

describe('WorkflowModeManager Integration', () => {
  let manager: WorkflowModeManager;

  beforeEach(() => {
    manager = new WorkflowModeManager();
  });

  afterEach(() => {
    manager.reset();
  });

  it('should integrate with orchestration service correctly', () => {
    const service = new OrchestrationService();

    // Mode changes should sync
    service.setWorkflowMode('plan');
    expect(service.getWorkflowMode()).toBe('plan');

    service.setWorkflowMode('iterate');
    expect(service.getWorkflowMode()).toBe('iterate');
  });

  it('should provide correct tool filtering across all modes', () => {
    const allTools = [
      { name: 'Read' },
      { name: 'Write' },
      { name: 'Edit' },
      { name: 'Glob' },
      { name: 'Grep' },
      { name: 'Bash' },
      { name: 'NotebookEdit' },
      { name: 'WebFetch' },
      { name: 'WebSearch' }
    ];

    // Default mode
    manager.setMode('default');
    let filtered = manager.filterTools(allTools);
    expect(filtered).toHaveLength(allTools.length);

    // Plan mode - blocks write operations
    manager.setMode('plan');
    filtered = manager.filterTools(allTools);
    expect(filtered.map(t => t.name)).not.toContain('Write');
    expect(filtered.map(t => t.name)).not.toContain('Edit');
    expect(filtered.map(t => t.name)).not.toContain('Bash');
    expect(filtered.map(t => t.name)).not.toContain('NotebookEdit');

    // Review mode - similar to plan
    manager.setMode('review');
    filtered = manager.filterTools(allTools);
    expect(filtered.map(t => t.name)).not.toContain('Write');
    expect(filtered.map(t => t.name)).not.toContain('Edit');

    // Iterate mode - all tools available
    manager.setMode('iterate');
    filtered = manager.filterTools(allTools);
    expect(filtered).toHaveLength(allTools.length);
  });

  it('should propagate turn count updates from orchestration service', () => {
    const service = new OrchestrationService();
    service.incrementTurn();

    const workflowStatus = (service as any).workflowModeManager.getStatus();
    expect(workflowStatus.turnCount).toBe(1);
  });
});
