/**
 * Orchestration Module
 *
 * Provides embedded instruction injection for AutomatosX.
 * Helps AI agents stay focused on tasks and follow guidelines.
 *
 * @since v11.3.0
 * @module orchestration
 */

// Types
export {
  // Instruction types
  type InstructionType,
  type InstructionPriority,
  type EmbeddedInstruction,
  EmbeddedInstructionSchema,

  // Todo types
  type TodoStatus,
  type TodoItem,
  type TodoListState,
  TodoItemSchema,

  // Workflow mode types
  type WorkflowMode,
  type WorkflowModeConfig,
  WorkflowModeConfigSchema,

  // Context types
  type OrchestrationContext,
  type MemoryEntry,
  OrchestrationContextSchema,

  // Token budget types
  type TokenBudgetConfig,
  DEFAULT_TOKEN_BUDGET,
  TokenBudgetConfigSchema,

  // Provider interface
  type InstructionProvider,

  // Configuration types
  type OrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  OrchestrationConfigSchema
} from './types.js';

// Token Budget Manager
export {
  TokenBudgetManager,
  type TokenEstimation,
  type BudgetAllocation
} from './token-budget.js';

// Instruction Injector
export {
  OrchestrationInstructionInjector,
  createInstruction,
  type InjectionOptions,
  type InjectionResult
} from './instruction-injector.js';

// Todo Instruction Provider
export {
  TodoInstructionProvider,
  createTodoListState,
  createTodoItem,
  type TodoProviderConfig
} from './todo-instruction-provider.js';

// Memory Instruction Provider
export {
  MemoryInstructionProvider,
  createMockMemoryProvider,
  type MemorySearchProvider,
  type MemoryProviderConfig
} from './memory-instruction-provider.js';

// Session Instruction Provider
export {
  SessionInstructionProvider,
  createMockSessionProvider,
  createMockSessionState,
  type SessionState,
  type SessionStateProvider,
  type SessionProviderConfig
} from './session-instruction-provider.js';

// Orchestration Service (Phase 4)
export {
  OrchestrationService,
  createOrchestrationService,
  type OrchestrationServiceConfig,
  type ServiceInjectionResult
} from './orchestration-service.js';

/**
 * Create a pre-configured orchestration injector with default providers
 */
export function createOrchestrationInjector(
  config?: Partial<import('./types.js').OrchestrationConfig>,
  options?: {
    memorySearchProvider?: import('./memory-instruction-provider.js').MemorySearchProvider;
    sessionStateProvider?: import('./session-instruction-provider.js').SessionStateProvider;
  }
): import('./instruction-injector.js').OrchestrationInstructionInjector {
  const { OrchestrationInstructionInjector } = require('./instruction-injector.js');
  const { TodoInstructionProvider } = require('./todo-instruction-provider.js');
  const { MemoryInstructionProvider } = require('./memory-instruction-provider.js');
  const { SessionInstructionProvider } = require('./session-instruction-provider.js');

  const injector = new OrchestrationInstructionInjector(config);

  // Register Todo provider
  if (config?.todoIntegration?.enabled !== false) {
    injector.registerProvider(new TodoInstructionProvider({
      enabled: config?.todoIntegration?.enabled ?? true,
      reminderFrequency: config?.todoIntegration?.reminderFrequency ?? 3,
      compactMode: config?.todoIntegration?.compactMode ?? false
    }));
  }

  // Register Memory provider
  if (config?.memoryIntegration?.enabled !== false && options?.memorySearchProvider) {
    injector.registerProvider(new MemoryInstructionProvider(
      options.memorySearchProvider,
      {
        enabled: config?.memoryIntegration?.enabled ?? true,
        maxEntries: config?.memoryIntegration?.maxEntries ?? 5,
        minRelevance: config?.memoryIntegration?.minRelevance ?? 0.5
      }
    ));
  }

  // Register Session provider
  if (config?.sessionIntegration?.enabled !== false) {
    injector.registerProvider(new SessionInstructionProvider(
      options?.sessionStateProvider,
      {
        enabled: config?.sessionIntegration?.enabled ?? true,
        showCollaboration: config?.sessionIntegration?.showCollaboration ?? true
      }
    ));
  }

  return injector;
}
