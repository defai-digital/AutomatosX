/**
 * CLI Command: agent suggest
 *
 * Suggests the best agent(s) for a given task based on selection metadata.
 * Uses keyword matching and intent scoring to recommend top 3 agents.
 *
 * @example
 * ax agent suggest "Debug transformer model - loss is NaN"
 * ax agent suggest "Implement LoRA fine-tuning" --verbose
 */

import type { CommandModule } from 'yargs';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import type { AgentProfile } from '../../../types/agent.js';
import { logger } from '../../../utils/logger.js';
import { TeamManager } from '../../../core/team-manager.js';
import { join } from 'path';

interface SuggestOptions {
  task: string;
  verbose?: boolean;
  format?: 'text' | 'json';
  limit?: number;
}

interface SuggestionResult {
  agent: string;
  displayName: string;
  role: string;
  score: number;
  rationale: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Score an agent based on task keywords and selection metadata
 */
function scoreAgent(task: string, profile: AgentProfile): number {
  let score = 0;
  const taskLower = task.toLowerCase();

  // Primary intents matching (weight: 10 points each)
  if (profile.selectionMetadata?.primaryIntents) {
    for (const intent of profile.selectionMetadata.primaryIntents) {
      const intentKeywords = intent.toLowerCase().split(/\s+/);
      const matchedKeywords = intentKeywords.filter(keyword =>
        taskLower.includes(keyword) && keyword.length > 3
      );
      if (matchedKeywords.length >= 2) {
        score += 10;
      } else if (matchedKeywords.length === 1) {
        score += 5;
      }
    }
  }

  // Secondary signals matching (weight: 5 points each)
  if (profile.selectionMetadata?.secondarySignals) {
    for (const signal of profile.selectionMetadata.secondarySignals) {
      if (taskLower.includes(signal.toLowerCase())) {
        score += 5;
      }
    }
  }

  // Negative intents penalty (weight: -20 points)
  if (profile.selectionMetadata?.negativeIntents) {
    for (const negative of profile.selectionMetadata.negativeIntents) {
      // Extract keywords from negative intent (before parentheses)
      const keywords = negative.split('(')[0]?.toLowerCase() || '';
      const negativeKeywords = keywords.split(/\s+/).filter(k => k.length > 3);
      const matchedNegative = negativeKeywords.filter(keyword =>
        taskLower.includes(keyword)
      );
      if (matchedNegative.length >= 2) {
        score -= 20;
      }
    }
  }

  // Redirect rules penalty (weight: -15 points)
  if (profile.selectionMetadata?.redirectWhen) {
    for (const rule of profile.selectionMetadata.redirectWhen) {
      try {
        const regex = new RegExp(rule.phrase, 'i');
        if (regex.test(task)) {
          score -= 15;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
  }

  // Ability keywords matching (weight: 3 points each)
  if (profile.abilitySelection?.taskBased) {
    for (const keyword of Object.keys(profile.abilitySelection.taskBased)) {
      if (taskLower.includes(keyword.toLowerCase())) {
        score += 3;
      }
    }
  }

  return Math.max(0, score); // Ensure non-negative
}

/**
 * Build rationale explanation for agent selection
 */
function buildRationale(task: string, profile: AgentProfile, score: number): string[] {
  const rationale: string[] = [];
  const taskLower = task.toLowerCase();

  // Check primary intents
  if (profile.selectionMetadata?.primaryIntents) {
    const matchedIntents = profile.selectionMetadata.primaryIntents.filter(intent => {
      const keywords = intent.toLowerCase().split(/\s+/);
      return keywords.some(k => taskLower.includes(k) && k.length > 3);
    });
    if (matchedIntents.length > 0) {
      rationale.push(`Matches primary intents: ${matchedIntents.slice(0, 2).join(', ')}`);
    }
  }

  // Check secondary signals
  if (profile.selectionMetadata?.secondarySignals) {
    const matchedSignals = profile.selectionMetadata.secondarySignals.filter(signal =>
      taskLower.includes(signal.toLowerCase())
    );
    if (matchedSignals.length > 0) {
      rationale.push(`Keywords: ${matchedSignals.slice(0, 3).join(', ')}`);
    }
  }

  // Check negative intents (consistent with scoreAgent logic)
  if (profile.selectionMetadata?.negativeIntents && profile.selectionMetadata.negativeIntents.length > 0) {
    const hasNegativeMatch = profile.selectionMetadata.negativeIntents.some(negative => {
      const keywords = negative.split('(')[0]?.toLowerCase() || '';
      const matchedKeywords = keywords.split(/\s+/).filter(k => taskLower.includes(k) && k.length > 3);
      return matchedKeywords.length >= 2;  // Require ≥2 keywords to match (same as scoreAgent)
    });
    if (hasNegativeMatch) {
      rationale.push('⚠️  May not be ideal - check negative intents');
    }
  }

  // Check redirect rules
  if (profile.selectionMetadata?.redirectWhen) {
    const triggeredRules = profile.selectionMetadata.redirectWhen.filter(rule => {
      try {
        return new RegExp(rule.phrase, 'i').test(task);
      } catch {
        return false;
      }
    });
    if (triggeredRules.length > 0) {
      rationale.push(`Consider: ${triggeredRules[0]?.suggest || ''}`);
    }
  }

  if (rationale.length === 0) {
    rationale.push('General capability match');
  }

  return rationale;
}

/**
 * Determine confidence level based on score
 */
function getConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 30) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

/**
 * Format suggestion results as text
 */
function formatText(suggestions: SuggestionResult[], verbose: boolean): string {
  let output = '\n🤖 Agent Suggestions:\n\n';

  suggestions.forEach((suggestion, index) => {
    const confidenceEmoji = suggestion.confidence === 'high' ? '✅' :
                           suggestion.confidence === 'medium' ? '⚡' : '💡';

    output += `${index + 1}. ${confidenceEmoji} ${suggestion.displayName} (${suggestion.agent})\n`;
    output += `   Role: ${suggestion.role}\n`;

    if (verbose) {
      output += `   Score: ${suggestion.score} | Confidence: ${suggestion.confidence}\n`;
    }

    suggestion.rationale.forEach(reason => {
      output += `   • ${reason}\n`;
    });
    output += '\n';
  });

  if (suggestions.length > 0 && suggestions[0]!.confidence === 'low') {
    output += '💭 Tip: Low confidence - consider asking a clarifying question\n\n';
  }

  return output;
}

/**
 * Format suggestion results as JSON
 */
function formatJSON(suggestions: SuggestionResult[]): string {
  return JSON.stringify({
    suggestions,
    timestamp: new Date().toISOString(),
    total: suggestions.length
  }, null, 2);
}

/**
 * Command module
 */
export const suggestCommand: CommandModule<{}, SuggestOptions> = {
  command: 'suggest <task>',
  describe: 'Suggest the best agent(s) for a task',

  builder: (yargs) => {
    return yargs
      .positional('task', {
        describe: 'Task description to analyze',
        type: 'string',
        demandOption: true
      })
      .option('verbose', {
        describe: 'Show detailed scoring information',
        type: 'boolean',
        alias: 'v',
        default: false
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['text', 'json'] as const,
        default: 'text' as const
      })
      .option('limit', {
        describe: 'Number of suggestions to return',
        type: 'number',
        alias: 'n',
        default: 3
      });
  },

  handler: async (argv) => {
    try {
      const { task, verbose = false, format = 'text', limit = 3 } = argv;

      logger.info('[agent suggest] Starting agent suggestion', { task, format, limit });

      // Initialize managers
      const projectDir = process.cwd();
      const agentsDir = join(projectDir, '.automatosx', 'agents');
      const teamsDir = join(projectDir, '.automatosx', 'teams');
      const teamManager = new TeamManager(teamsDir);
      const profileLoader = new ProfileLoader(agentsDir, undefined, teamManager);

      // Load all agent profiles
      const agentNames = await profileLoader.listProfiles();

      // Score each agent
      const scoredAgents: SuggestionResult[] = [];

      for (const name of agentNames) {
        try {
          const profile = await profileLoader.loadProfile(name);

          // Debug: Log selectionMetadata for first few agents
          if (scoredAgents.length < 3 && profile.selectionMetadata) {
            logger.debug(`[agent suggest] Profile ${name} has selectionMetadata`, {
              primaryIntents: profile.selectionMetadata.primaryIntents?.length || 0,
              secondarySignals: profile.selectionMetadata.secondarySignals?.length || 0
            });
          }

          const score = scoreAgent(task, profile);
          const rationale = buildRationale(task, profile, score);
          const confidence = getConfidence(score);

          scoredAgents.push({
            agent: profile.name,
            displayName: profile.displayName || profile.name,
            role: profile.role,
            score,
            rationale,
            confidence
          });
        } catch (error) {
          logger.warn(`Failed to load profile: ${name}`, { error });
        }
      }

      // Sort by score (descending) and take top N
      scoredAgents.sort((a, b) => b.score - a.score);
      const topSuggestions = scoredAgents.slice(0, limit);

      // Output results
      if (format === 'json') {
        console.log(formatJSON(topSuggestions));
      } else {
        console.log(formatText(topSuggestions, verbose));
      }

      logger.info('[agent suggest] Completed', {
        topAgent: topSuggestions[0]?.agent,
        topScore: topSuggestions[0]?.score
      });

    } catch (error) {
      logger.error('[agent suggest] Failed', { error });
      console.error(`\n❌ Error: ${(error as Error).message}\n`);
      process.exit(1);
    }
  }
};
