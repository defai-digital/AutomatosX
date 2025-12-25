/**
 * Consensus Mechanism Executors
 *
 * Exports all consensus implementations and a factory for getting the right executor.
 */

import type { ConsensusMethod } from '@defai.digital/contracts';
import type { ConsensusExecutor } from '../types.js';
import { SynthesisConsensus } from './synthesis.js';
import { VotingConsensus } from './voting.js';
import { ModeratorConsensus } from './moderator.js';

// Export all consensus classes
export { SynthesisConsensus } from './synthesis.js';
export { VotingConsensus } from './voting.js';
export { ModeratorConsensus } from './moderator.js';

/**
 * Map of consensus methods to their executors
 */
const consensusExecutors: Record<ConsensusMethod, () => ConsensusExecutor> = {
  synthesis: () => new SynthesisConsensus(),
  voting: () => new VotingConsensus(),
  moderator: () => new ModeratorConsensus(),
  unanimous: () => new SynthesisConsensus(), // Falls back to synthesis with higher threshold
  majority: () => new VotingConsensus(), // Uses voting with 50% threshold
};

/**
 * Get a consensus executor for the given method
 */
export function getConsensusExecutor(method: ConsensusMethod): ConsensusExecutor {
  const factory = consensusExecutors[method];
  if (!factory) {
    throw new Error(`Unknown consensus method: ${method}`);
  }
  return factory();
}

/**
 * Check if a consensus method is supported
 */
export function isConsensusMethodSupported(method: string): method is ConsensusMethod {
  return method in consensusExecutors;
}

/**
 * Get all supported consensus methods
 */
export function getSupportedConsensusMethods(): ConsensusMethod[] {
  return Object.keys(consensusExecutors) as ConsensusMethod[];
}
