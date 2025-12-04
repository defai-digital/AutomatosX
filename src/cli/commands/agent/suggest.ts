/**
 * CLI Command: agent suggest
 *
 * Suggests the best agent(s) for a given task based on selection metadata.
 * Uses keyword matching and intent scoring to recommend top 3 agents.
 *
 * v11.1.0: Refactored to use shared AgentSelector module.
 *
 * @example
 * ax agent suggest "Debug transformer model - loss is NaN"
 * ax agent suggest "Implement LoRA fine-tuning" --verbose
 */

import type { CommandModule } from 'yargs';
import { ProfileLoader } from '../../../agents/profile-loader.js';
import { scoreAgent, buildRationale, getConfidence } from '../../../agents/agent-selector.js';
import type { AgentProfile } from '../../../types/agent.js';
import { logger } from '../../../shared/logging/logger.js';
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

      // Score each agent (parallel loading for better performance)
      const failedProfiles: string[] = [];

      const profileResults = await Promise.all(
        agentNames.map(async (name) => {
          try {
            const profile = await profileLoader.loadProfile(name);

            // Debug: Log selectionMetadata
            if (profile.selectionMetadata) {
              logger.debug(`[agent suggest] Profile ${name} has selectionMetadata`, {
                primaryIntents: profile.selectionMetadata.primaryIntents?.length || 0,
                secondarySignals: profile.selectionMetadata.secondarySignals?.length || 0
              });
            }

            const score = scoreAgent(task, profile);
            const rationale = buildRationale(task, profile);
            const confidence = getConfidence(score);

            return {
              agent: profile.name,
              displayName: profile.displayName || profile.name,
              role: profile.role,
              score,
              rationale,
              confidence
            } as SuggestionResult;
          } catch (error) {
            logger.warn(`Failed to load profile: ${name}`, { error });
            failedProfiles.push(name);
            return null;
          }
        })
      );

      const scoredAgents = profileResults.filter(
        (result): result is SuggestionResult => result !== null
      );

      // Check if no agents were loaded successfully
      if (scoredAgents.length === 0) {
        const errorMsg = failedProfiles.length > 0
          ? `Failed to load all agent profiles. Failed: ${failedProfiles.join(', ')}`
          : 'No agent profiles found in project';
        logger.error('[agent suggest] No agents loaded', { failedProfiles });
        console.error(`\n❌ Error: ${errorMsg}\n`);
        console.error('💡 Run `ax init` to initialize agent profiles.\n');
        process.exit(1);
      }

      // Sort by score (descending), then by agent name (for stable ordering)
      scoredAgents.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return a.agent.localeCompare(b.agent);  // Secondary sort by name
      });
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
