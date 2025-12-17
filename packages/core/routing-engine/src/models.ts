import type { ModelDefinition } from './types.js';

/**
 * Default model registry with common models
 *
 * Note: Cost fields are intentionally excluded.
 * AutomatosX does NOT perform cost-based routing as costs change frequently.
 */
export const DEFAULT_MODELS: ModelDefinition[] = [
  // Anthropic Models
  {
    id: 'claude-3-opus',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    isExperimental: false,
    contextLength: 200000,
    capabilities: ['vision', 'function_calling', 'json_mode', 'streaming'],
    priority: 100,
    optimizedFor: ['code', 'analysis', 'creative'],
  },
  {
    id: 'claude-3-sonnet',
    provider: 'anthropic',
    displayName: 'Claude 3 Sonnet',
    isExperimental: false,
    contextLength: 200000,
    capabilities: ['vision', 'function_calling', 'json_mode', 'streaming'],
    priority: 80,
    optimizedFor: ['chat', 'code', 'analysis'],
  },
  {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    isExperimental: false,
    contextLength: 200000,
    capabilities: ['vision', 'function_calling', 'json_mode', 'streaming'],
    priority: 60,
    optimizedFor: ['chat', 'completion'],
  },

  // Google Models
  {
    id: 'gemini-pro',
    provider: 'google',
    displayName: 'Gemini Pro',
    isExperimental: false,
    contextLength: 32000,
    capabilities: ['function_calling', 'json_mode', 'streaming'],
    priority: 70,
    optimizedFor: ['chat', 'completion', 'analysis'],
  },
  {
    id: 'gemini-ultra',
    provider: 'google',
    displayName: 'Gemini Ultra',
    isExperimental: true, // Marked as experimental
    contextLength: 128000,
    capabilities: ['vision', 'function_calling', 'json_mode', 'streaming'],
    priority: 90,
    optimizedFor: ['code', 'analysis', 'creative'],
  },

  // Local Models
  {
    id: 'local-llama',
    provider: 'local',
    displayName: 'Local Llama',
    isExperimental: false,
    contextLength: 8000,
    capabilities: ['streaming'],
    priority: 30,
    optimizedFor: ['chat', 'completion'],
  },
];

/**
 * Creates a model registry from a list of models
 */
export function createModelRegistry(
  models: ModelDefinition[]
): Map<string, ModelDefinition> {
  const registry = new Map<string, ModelDefinition>();
  for (const model of models) {
    registry.set(model.id, model);
  }
  return registry;
}
