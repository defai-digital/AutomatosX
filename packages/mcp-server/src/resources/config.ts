/**
 * MCP Config Resources
 *
 * Per PRD Section 13.2: MCP Resources for configuration access.
 *
 * Resources:
 * - automatosx://config - Read-only access to merged configuration
 * - automatosx://config/global - Global configuration
 * - automatosx://config/local - Local (project) configuration
 * - automatosx://config/events - Configuration change audit trail
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-003: Sensitive data is never exposed via resources
 */

import type { MCPResource, MCPResourceContent, ResourceHandler } from '../types.js';
import {
  createConfigStore,
  getConfigRepository,
} from '@automatosx/config-domain';

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Config resource - merged configuration
 */
export const configResource: MCPResource = {
  uri: 'automatosx://config',
  name: 'Configuration',
  description: 'Current AutomatosX configuration (merged global + local)',
  mimeType: 'application/json',
};

/**
 * Global config resource
 */
export const configGlobalResource: MCPResource = {
  uri: 'automatosx://config/global',
  name: 'Global Configuration',
  description: 'Global AutomatosX configuration (~/.automatosx/config.json)',
  mimeType: 'application/json',
};

/**
 * Local config resource
 */
export const configLocalResource: MCPResource = {
  uri: 'automatosx://config/local',
  name: 'Local Configuration',
  description: 'Local project configuration (.automatosx/config.json)',
  mimeType: 'application/json',
};

/**
 * Config events resource - audit trail
 */
export const configEventsResource: MCPResource = {
  uri: 'automatosx://config/events',
  name: 'Config Events',
  description: 'Configuration change audit trail (event sourcing)',
  mimeType: 'application/json',
};

/**
 * All config resources
 */
export const CONFIG_RESOURCES: MCPResource[] = [
  configResource,
  configGlobalResource,
  configLocalResource,
  configEventsResource,
];

// ============================================================================
// Resource Handlers
// ============================================================================

/**
 * Handler for automatosx://config
 */
export const handleConfigResource: ResourceHandler = async (
  uri: string,
  _params?: Record<string, string>
): Promise<MCPResourceContent> => {
  try {
    const store = createConfigStore();
    const config = await store.readMerged();

    if (config === undefined) {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          error: 'CONFIG_NOT_FOUND',
          message: 'No configuration found. Run "ax setup" first.',
        }),
      };
    }

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(config, null, 2),
    };
  } catch (error) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'CONFIG_READ_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handler for automatosx://config/global
 */
export const handleConfigGlobalResource: ResourceHandler = async (
  uri: string,
  _params?: Record<string, string>
): Promise<MCPResourceContent> => {
  try {
    const store = createConfigStore();
    const config = await store.read('global');

    if (config === undefined) {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          error: 'CONFIG_NOT_FOUND',
          message: 'No global configuration found. Run "ax setup" first.',
        }),
      };
    }

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(config, null, 2),
    };
  } catch (error) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'CONFIG_READ_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handler for automatosx://config/local
 */
export const handleConfigLocalResource: ResourceHandler = async (
  uri: string,
  _params?: Record<string, string>
): Promise<MCPResourceContent> => {
  try {
    const store = createConfigStore();
    const config = await store.read('local');

    if (config === undefined) {
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          error: 'CONFIG_NOT_FOUND',
          message: 'No local configuration found for this project.',
          hint: 'Run "ax setup --local" to create project-specific configuration.',
        }),
      };
    }

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(config, null, 2),
    };
  } catch (error) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: 'CONFIG_READ_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handler for automatosx://config/events
 */
export const handleConfigEventsResource: ResourceHandler = async (
  uri: string,
  _params?: Record<string, string>
): Promise<MCPResourceContent> => {
  try {
    const repository = getConfigRepository();

    // Get events from both scopes
    const [globalEvents, localEvents] = await Promise.all([
      repository.getEvents('global', { limit: 50 }),
      repository.getEvents('local', { limit: 50 }),
    ]);

    // Combine and sort by timestamp (newest first)
    const allEvents = [...globalEvents, ...localEvents].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        events: allEvents,
        total: allEvents.length,
        scopes: {
          global: globalEvents.length,
          local: localEvents.length,
        },
      }, null, 2),
    };
  } catch {
    // If repository not initialized, return empty events
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        events: [],
        total: 0,
        scopes: { global: 0, local: 0 },
        message: 'Event store not initialized. Events are stored in memory during session.',
      }, null, 2),
    };
  }
};

/**
 * All config resource handlers
 */
export const CONFIG_RESOURCE_HANDLERS: Record<string, ResourceHandler> = {
  'automatosx://config': handleConfigResource,
  'automatosx://config/global': handleConfigGlobalResource,
  'automatosx://config/local': handleConfigLocalResource,
  'automatosx://config/events': handleConfigEventsResource,
};
