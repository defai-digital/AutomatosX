/**
 * Discussion Pattern Executors
 *
 * Exports all pattern implementations and a factory for getting the right executor.
 */

import type { DiscussionPattern } from '@defai.digital/contracts';
import type { PatternExecutor } from '../types.js';
import { RoundRobinPattern } from './round-robin.js';
import { SynthesisPattern } from './synthesis.js';
import { DebatePattern } from './debate.js';
import { CritiquePattern } from './critique.js';
import { VotingPattern } from './voting.js';

// Export all pattern classes
export { RoundRobinPattern } from './round-robin.js';
export { SynthesisPattern } from './synthesis.js';
export { DebatePattern } from './debate.js';
export { CritiquePattern } from './critique.js';
export { VotingPattern } from './voting.js';

/**
 * Map of pattern types to their executors
 */
const patternExecutors: Record<DiscussionPattern, () => PatternExecutor> = {
  'round-robin': () => new RoundRobinPattern(),
  synthesis: () => new SynthesisPattern(),
  debate: () => new DebatePattern(),
  critique: () => new CritiquePattern(),
  voting: () => new VotingPattern(),
};

/**
 * Get a pattern executor for the given pattern type
 */
export function getPatternExecutor(pattern: DiscussionPattern): PatternExecutor {
  const factory = patternExecutors[pattern];
  if (!factory) {
    throw new Error(`Unknown discussion pattern: ${pattern}`);
  }
  return factory();
}

/**
 * Check if a pattern type is supported
 */
export function isPatternSupported(pattern: string): pattern is DiscussionPattern {
  return pattern in patternExecutors;
}

/**
 * Get all supported pattern types
 */
export function getSupportedPatterns(): DiscussionPattern[] {
  return Object.keys(patternExecutors) as DiscussionPattern[];
}
