/**
 * Simple Agent Router - Keyword-based agent selection
 *
 * Provides fast, simple agent selection based on keyword matching.
 * This is intentionally simple - complex ML-based routing was deemed
 * over-engineering. Simple keyword matching works just as well.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { type AgentProfile } from '@ax/schemas';
import { type AgentRegistry } from './registry.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentSelectionResult {
  /** Selected agent profile */
  agent: AgentProfile;
  /** Reason for selection */
  reason: string;
  /** Keywords that matched */
  matchedKeywords: string[];
  /** Selection confidence (0-1) */
  confidence: number;
  /** Alternative agents considered */
  alternatives: string[];
}

export interface RouterOptions {
  /** Default agent to use when no match found */
  defaultAgent?: string;
  /** Minimum keyword matches to consider (default: 1) */
  minMatches?: number;
}

// =============================================================================
// Keyword Database
// =============================================================================

/**
 * Keyword to agent mapping
 * Each agent has keywords that indicate tasks it should handle
 */
const AGENT_KEYWORDS: Record<string, string[]> = {
  backend: [
    'api',
    'database',
    'server',
    'rest',
    'graphql',
    'sql',
    'endpoint',
    'auth',
    'crud',
    'backend',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'cache',
    'microservice',
    'service',
    'controller',
    'middleware',
    'route',
    'go',
    'rust',
    'python',
    'java',
  ],
  frontend: [
    'ui',
    'component',
    'react',
    'vue',
    'angular',
    'css',
    'button',
    'form',
    'page',
    'frontend',
    'html',
    'javascript',
    'typescript',
    'tailwind',
    'styled',
    'layout',
    'responsive',
    'animation',
    'state',
    'redux',
    'nextjs',
    'svelte',
  ],
  devops: [
    'deploy',
    'ci',
    'cd',
    'docker',
    'kubernetes',
    'aws',
    'pipeline',
    'infrastructure',
    'terraform',
    'ansible',
    'helm',
    'github actions',
    'jenkins',
    'monitoring',
    'logging',
    'container',
    'cloud',
    'gcp',
    'azure',
    'nginx',
    'load balancer',
  ],
  security: [
    'vulnerability',
    'audit',
    'security',
    'penetration',
    'xss',
    'injection',
    'owasp',
    'encryption',
    'authentication',
    'authorization',
    'threat',
    'risk',
    'compliance',
    'ssl',
    'tls',
    'firewall',
    'breach',
    'cve',
  ],
  quality: [
    'test',
    'qa',
    'coverage',
    'bug',
    'e2e',
    'unit test',
    'integration test',
    'testing',
    'jest',
    'vitest',
    'cypress',
    'playwright',
    'assertion',
    'mock',
    'fixture',
    'spec',
  ],
  design: [
    'ux',
    'ui design',
    'wireframe',
    'mockup',
    'figma',
    'prototype',
    'accessibility',
    'a11y',
    'user experience',
    'user interface',
    'design system',
    'typography',
    'color',
    'visual',
  ],
  product: [
    'requirements',
    'user story',
    'roadmap',
    'feature',
    'prd',
    'product',
    'stakeholder',
    'priority',
    'backlog',
    'epic',
    'acceptance criteria',
    'mvp',
    'specification',
  ],
  data: [
    'etl',
    'analytics',
    'warehouse',
    'data model',
    'bigquery',
    'data',
    'spark',
    'airflow',
    'transformation',
    'schema',
    'migration',
    'batch',
    'streaming',
    'kafka',
  ],
  architecture: [
    'architecture',
    'system design',
    'adr',
    'scalability',
    'microservices',
    'monolith',
    'distributed',
    'event-driven',
    'saga',
    'cqrs',
    'ddd',
    'domain',
    'boundary',
    'technical debt',
  ],
  writer: [
    'documentation',
    'docs',
    'readme',
    'technical writing',
    'guide',
    'tutorial',
    'changelog',
    'api docs',
    'wiki',
    'manual',
    'instructions',
  ],
  mobile: [
    'ios',
    'android',
    'swift',
    'kotlin',
    'flutter',
    'mobile',
    'app',
    'react native',
    'expo',
    'xcode',
    'gradle',
    'cocoapods',
    'app store',
    'play store',
  ],
  fullstack: [
    'fullstack',
    'full-stack',
    'node',
    'express',
    'nest',
    'prisma',
    'trpc',
    't3',
    'remix',
    'astro',
  ],
  researcher: [
    'research',
    'analyze',
    'investigate',
    'compare',
    'evaluate',
    'benchmark',
    'study',
    'explore',
    'survey',
    'assessment',
  ],
  'data-scientist': [
    'machine learning',
    'ml',
    'ai',
    'model',
    'training',
    'prediction',
    'classification',
    'regression',
    'neural network',
    'deep learning',
    'nlp',
    'computer vision',
    'tensorflow',
    'pytorch',
  ],
};

// =============================================================================
// Router Functions
// =============================================================================

/**
 * Select the best agent for a task based on keyword matching
 *
 * @param task - The task description
 * @param registry - Agent registry to select from
 * @param options - Router options
 * @returns Selected agent profile or undefined if no match
 */
export function selectAgent(
  task: string,
  registry: AgentRegistry,
  options: RouterOptions = {}
): AgentProfile | undefined {
  const result = selectAgentWithReason(task, registry, options);
  return result.agent;
}

/**
 * Select the best agent with detailed reasoning
 *
 * @param task - The task description
 * @param registry - Agent registry to select from
 * @param options - Router options
 * @returns Selection result with reasoning
 */
export function selectAgentWithReason(
  task: string,
  registry: AgentRegistry,
  options: RouterOptions = {}
): AgentSelectionResult {
  const { defaultAgent = 'standard', minMatches = 1 } = options;
  const taskLower = task.toLowerCase();

  // Score each agent by keyword matches
  const scores: Array<{
    agentId: string;
    score: number;
    keywords: string[];
  }> = [];

  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const matched = keywords.filter((kw) => taskLower.includes(kw));
    if (matched.length >= minMatches) {
      scores.push({
        agentId,
        score: matched.length,
        keywords: matched,
      });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Get alternatives (top 3 excluding winner)
  const alternatives = scores.slice(1, 4).map((s) => s.agentId);

  // Select best match or default
  if (scores.length > 0) {
    const best = scores[0]!;
    const agent = registry.get(best.agentId);

    if (agent) {
      // Calculate confidence based on keyword matches
      // More matches = higher confidence
      const maxPossibleMatches = AGENT_KEYWORDS[best.agentId]?.length ?? 1;
      const confidence = Math.min(best.score / Math.max(maxPossibleMatches / 3, 1), 1);

      return {
        agent,
        reason: `Selected ${best.agentId} agent based on keywords: ${best.keywords.join(', ')}`,
        matchedKeywords: best.keywords,
        confidence,
        alternatives,
      };
    }
  }

  // Fallback to default agent
  const fallbackAgent = registry.get(defaultAgent);
  if (fallbackAgent) {
    return {
      agent: fallbackAgent,
      reason: 'No keyword matches, using default agent',
      matchedKeywords: [],
      confidence: 0.5,
      alternatives: [],
    };
  }

  // Last resort: get first available agent
  const allAgents = registry.getAll();
  if (allAgents.length > 0) {
    return {
      agent: allAgents[0]!,
      reason: 'Using first available agent (no default found)',
      matchedKeywords: [],
      confidence: 0.1,
      alternatives: allAgents.slice(1, 4).map((a) => a.name),
    };
  }

  // This should never happen if registry is properly initialized
  throw new Error(
    'No agents available in registry. ' +
    'Ensure at least one agent is registered before routing tasks. ' +
    'Check that agent configuration files exist and are valid.'
  );
}

/**
 * Get all keywords for an agent
 *
 * @param agentId - Agent identifier
 * @returns Array of keywords or empty array if agent not found
 */
export function getAgentKeywords(agentId: string): string[] {
  return AGENT_KEYWORDS[agentId] ?? [];
}

/**
 * Get all agent keywords mapping
 *
 * @returns Copy of the keywords database
 */
export function getAllKeywords(): Record<string, string[]> {
  return { ...AGENT_KEYWORDS };
}

/**
 * Find which agents match a given keyword
 *
 * @param keyword - Keyword to search for
 * @returns Array of agent IDs that have this keyword
 */
export function findAgentsByKeyword(keyword: string): string[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.entries(AGENT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => k.includes(lowerKeyword)))
    .map(([agentId]) => agentId);
}

// =============================================================================
// Exports
// =============================================================================

export { AGENT_KEYWORDS };
