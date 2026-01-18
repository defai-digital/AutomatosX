/**
 * Research Domain
 *
 * Deep research agent with live documentation fetching and knowledge synthesis.
 */

// Types
export type {
  WebFetcherPort,
  SynthesizerPort,
  ResearchCachePort,
  ResearchAgentOptions,
  ResearchAgent,
} from './types.js';

// Web Fetcher
export { createStubWebFetcher, createWebFetcher } from './web-fetcher.js';

// Synthesizer
export { createStubSynthesizer, detectConflicts, validateUrls } from './synthesizer.js';

// Research Agent
export { createResearchAgent } from './research-agent.js';
