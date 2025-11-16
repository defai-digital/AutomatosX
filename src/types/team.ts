/**
 * Team Configuration Types
 *
 * Defines team-level configuration that agents inherit.
 * Eliminates duplication of provider settings across agent profiles.
 */

import type { OrchestrationConfig } from './orchestration.js';

/**
 * Team Provider Configuration
 *
 * Defines which AI providers a team uses and in what order.
 */
export interface TeamProviderConfig {
  primary: string;              // Primary provider (claude, gemini, codex)
  fallback?: string;            // Single fallback provider
  fallbackChain?: string[];     // Complete fallback chain (if specified, overrides primary+fallback)
}

/**
 * Team Orchestration Defaults
 *
 * Default orchestration settings for all agents in the team.
 * Individual agents can override these in their profile.
 *
 * v5.2.0: Workspace permission fields removed. All agents have equal access
 * to automatosx/PRD and automatosx/tmp.
 */
export interface TeamOrchestrationDefaults {
  maxDelegationDepth?: number;
}

/**
 * Team Metadata
 *
 * Additional metadata for UI and organizational purposes.
 */
export interface TeamMetadata {
  color?: string;               // Team color (hex code)
  icon?: string;                // Team icon (emoji or string)
  priority?: number;            // Team priority (lower = higher priority)
  tags?: string[];              // Team tags
  [key: string]: any;           // Additional custom metadata
}

/**
 * Team Configuration
 *
 * Complete team configuration loaded from .automatosx/teams/*.yaml
 */
export interface TeamConfig {
  // Basic info
  name: string;
  displayName: string;
  description: string;

  // Provider configuration
  provider: TeamProviderConfig;

  // Shared abilities (all team members inherit these)
  sharedAbilities?: string[];

  // Orchestration defaults
  orchestration?: TeamOrchestrationDefaults;

  // Metadata
  metadata?: TeamMetadata;

  // Version tracking
  version?: string;
}

/**
 * Team validation error
 */
export class TeamValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamValidationError';
  }
}

/**
 * Team not found error
 */
export class TeamNotFoundError extends Error {
  constructor(teamName: string) {
    super(`Team not found: ${teamName}`);
    this.name = 'TeamNotFoundError';
  }
}
