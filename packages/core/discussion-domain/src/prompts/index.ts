/**
 * Prompt Templates Module
 *
 * Re-exports all prompt templates and helper functions.
 */

export {
  // Provider prompts
  getProviderSystemPrompt,

  // Round-robin templates
  ROUND_ROBIN_INITIAL,
  ROUND_ROBIN_FOLLOWUP,

  // Synthesis templates
  SYNTHESIS_INITIAL,
  SYNTHESIS_CROSS_DISCUSS,
  SYNTHESIS_FINAL,

  // Debate templates
  DEBATE_PROPONENT,
  DEBATE_OPPONENT,
  DEBATE_REBUTTAL,
  DEBATE_JUDGE,

  // Critique templates
  CRITIQUE_PROPOSAL,
  CRITIQUE_REVIEW,
  CRITIQUE_REVISION,

  // Voting templates
  VOTING_EVALUATE,
  VOTING_TALLY,

  // Helper functions
  interpolate,
  formatPreviousResponses,
  formatVotingOptions,
  formatVotes,
  getRolePromptModifier,
} from './templates.js';
