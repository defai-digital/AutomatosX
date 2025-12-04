/**
 * Orchestration Service Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrchestrationService,
  createOrchestrationService
} from '../../../src/core/orchestration/orchestration-service.js';
import {
  createMockMemoryProvider,
  createMockSessionProvider,
  createTodoItem
} from '../../../src/core/orchestration/index.js';

describe('OrchestrationService', () => {
  let service: OrchestrationService;

  beforeEach(() => {
    service = new OrchestrationService();
    service.reset();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
    });

    it('should accept custom config', () => {
      const customService = new OrchestrationService({
        agentTemplates: {
          enabled: true,
          reminderFrequency: 10
        }
      });
      const config = customService.getConfig();
      expect(config.agentTemplates.reminderFrequency).toBe(10);
    });

    it('should initialize with memory provider', () => {
      const memoryProvider = createMockMemoryProvider([]);
      const serviceWithMemory = new OrchestrationService({
        memorySearchProvider: memoryProvider
      });
      expect(serviceWithMemory).toBeDefined();
    });

    it('should initialize with session provider', () => {
      const sessionProvider = createMockSessionProvider({});
      const serviceWithSession = new OrchestrationService({
        sessionStateProvider: sessionProvider
      });
      expect(serviceWithSession).toBeDefined();
    });
  });

  describe('setAgentDomain', () => {
    it('should set agent domain', () => {
      service.setAgentDomain('security');
      // Domain is set on internal injector
      expect(service).toBeDefined();
    });

    it('should accept valid domains', () => {
      const domains = ['backend', 'frontend', 'security', 'quality'];
      domains.forEach(domain => {
        service.setAgentDomain(domain);
        // Should not throw
      });
    });
  });

  describe('updateTodos', () => {
    it('should update current todos', () => {
      service.updateTodos([
        createTodoItem('Task 1', 'Working on task 1', 'in_progress')
      ]);
      const debug = service.getDebugInfo();
      expect(debug.todoCount).toBe(1);
    });

    it('should replace existing todos', () => {
      service.updateTodos([
        createTodoItem('Task 1', 'Task 1', 'pending')
      ]);
      service.updateTodos([
        createTodoItem('Task 2', 'Task 2', 'pending'),
        createTodoItem('Task 3', 'Task 3', 'pending')
      ]);
      const debug = service.getDebugInfo();
      expect(debug.todoCount).toBe(2);
    });
  });

  describe('setWorkflowMode', () => {
    it('should set workflow mode', () => {
      service.setWorkflowMode('plan');
      expect(service.getWorkflowMode()).toBe('plan');
    });

    it('should change modes', () => {
      service.setWorkflowMode('plan');
      expect(service.getWorkflowMode()).toBe('plan');

      service.setWorkflowMode('iterate');
      expect(service.getWorkflowMode()).toBe('iterate');

      service.setWorkflowMode('default');
      expect(service.getWorkflowMode()).toBe('default');
    });
  });

  describe('isToolAllowed', () => {
    it('should allow all tools in default mode', () => {
      service.setWorkflowMode('default');
      expect(service.isToolAllowed('Write')).toBe(true);
      expect(service.isToolAllowed('Read')).toBe(true);
      expect(service.isToolAllowed('Bash')).toBe(true);
    });

    it('should block write tools in plan mode', () => {
      service.setWorkflowMode('plan');
      expect(service.isToolAllowed('Write')).toBe(false);
      expect(service.isToolAllowed('Edit')).toBe(false);
      expect(service.isToolAllowed('Bash')).toBe(false);
    });

    it('should allow read tools in plan mode', () => {
      service.setWorkflowMode('plan');
      expect(service.isToolAllowed('Read')).toBe(true);
      expect(service.isToolAllowed('Glob')).toBe(true);
      expect(service.isToolAllowed('Grep')).toBe(true);
    });
  });

  describe('filterTools', () => {
    it('should filter tools based on mode', () => {
      const tools = [
        { name: 'Read' },
        { name: 'Write' },
        { name: 'Glob' },
        { name: 'Edit' }
      ];

      service.setWorkflowMode('plan');
      const filtered = service.filterTools(tools);

      expect(filtered.map(t => t.name)).toEqual(['Read', 'Glob']);
    });

    it('should return all tools in default mode', () => {
      const tools = [
        { name: 'Read' },
        { name: 'Write' },
        { name: 'Bash' }
      ];

      service.setWorkflowMode('default');
      const filtered = service.filterTools(tools);

      expect(filtered).toHaveLength(3);
    });
  });

  describe('incrementTurn', () => {
    it('should increment turn count', () => {
      expect(service.getTurnCount()).toBe(0);

      service.incrementTurn();
      expect(service.getTurnCount()).toBe(1);

      service.incrementTurn();
      expect(service.getTurnCount()).toBe(2);
    });
  });

  describe('injectInstructions', () => {
    it('should generate instructions', async () => {
      service.incrementTurn();
      service.incrementTurn();
      service.incrementTurn();
      service.incrementTurn();
      service.incrementTurn();

      const result = await service.injectInstructions({
        task: 'Test task',
        agentName: 'backend'
      });

      expect(result).toBeDefined();
      expect(result.instructions).toBeDefined();
      expect(result.tokenCount).toBeGreaterThanOrEqual(0);
    });

    it('should include task context', async () => {
      service.setAgentDomain('backend');
      for (let i = 0; i < 5; i++) {
        service.incrementTurn();
      }

      const result = await service.injectInstructions({
        task: 'Implement security authentication',
        agentName: 'backend'
      });

      expect(result).toBeDefined();
    });
  });

  describe('formatAsSystemReminder', () => {
    it('should format content as system reminder', () => {
      const content = 'Test instruction';
      const formatted = service.formatAsSystemReminder(content);

      expect(formatted).toContain('<system-reminder>');
      expect(formatted).toContain('</system-reminder>');
      expect(formatted).toContain('Test instruction');
    });

    it('should return empty string for empty content', () => {
      expect(service.formatAsSystemReminder('')).toBe('');
      expect(service.formatAsSystemReminder('   ')).toBe('');
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      const debug = service.getDebugInfo();

      expect(debug.turnCount).toBe(0);
      expect(debug.workflowMode).toBe('default');
      expect(debug.todoCount).toBe(0);
      expect(debug.providers).toBeDefined();
      expect(debug.tokenBudget).toBeDefined();
    });

    it('should reflect state changes', () => {
      service.incrementTurn();
      service.incrementTurn();
      service.setWorkflowMode('plan');
      service.updateTodos([
        createTodoItem('Task', 'Task', 'pending')
      ]);

      const debug = service.getDebugInfo();

      expect(debug.turnCount).toBe(2);
      expect(debug.workflowMode).toBe('plan');
      expect(debug.todoCount).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      // Modify state
      service.incrementTurn();
      service.incrementTurn();
      service.setWorkflowMode('plan');
      service.updateTodos([
        createTodoItem('Task', 'Task', 'pending')
      ]);

      // Reset
      service.reset();

      // Verify reset
      const debug = service.getDebugInfo();
      expect(debug.turnCount).toBe(0);
      expect(debug.workflowMode).toBe('default');
      expect(debug.todoCount).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      service.updateConfig({
        agentTemplates: {
          enabled: true,
          reminderFrequency: 20
        }
      });
      const config = service.getConfig();
      expect(config.agentTemplates.reminderFrequency).toBe(20);
    });
  });
});

describe('createOrchestrationService', () => {
  it('should create a service instance', () => {
    const service = createOrchestrationService();
    expect(service).toBeInstanceOf(OrchestrationService);
  });

  it('should accept config options', () => {
    const service = createOrchestrationService({
      agentDomain: 'security'
    });
    expect(service).toBeDefined();
  });
});
