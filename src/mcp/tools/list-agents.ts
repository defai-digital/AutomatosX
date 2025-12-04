/**
 * MCP Tool: list_agents
 *
 * Lists all available AutomatosX agents.
 * Wraps the existing agent list command logic.
 */

import type { ToolHandler, ListAgentsOutput } from '../types.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { logger } from '../../shared/logging/logger.js';

export interface ListAgentsDependencies {
  profileLoader: ProfileLoader;
}

export function createListAgentsHandler(
  deps: ListAgentsDependencies
): ToolHandler<Record<string, never>, ListAgentsOutput> {
  return async (): Promise<ListAgentsOutput> => {
    logger.info('[MCP] list_agents called');

    try {
      // Get list of agent names
      const agentNames = await deps.profileLoader.listProfiles();

      // Load full profiles to get displayName, role, team
      const profiles = await Promise.all(
        agentNames.map(async (name) => {
          try {
            return await deps.profileLoader.loadProfile(name);
          } catch (error) {
            logger.warn(`Failed to load profile for ${name}`, { error });
            return null;
          }
        })
      );

      const result: ListAgentsOutput = {
        agents: profiles
          .filter((profile) => profile !== null)
          .map((profile) => ({
            name: profile!.name,
            displayName: profile!.displayName,
            role: profile!.role,
            team: profile!.team,
            // v5.7.0+: Include selection metadata for improved routing
            selectionMetadata: profile!.selectionMetadata
          }))
      };

      logger.info('[MCP] list_agents completed', { count: result.agents.length });

      return result;
    } catch (error) {
      logger.error('[MCP] list_agents failed', { error });
      throw new Error(`Failed to list agents: ${(error as Error).message}`);
    }
  };
}
