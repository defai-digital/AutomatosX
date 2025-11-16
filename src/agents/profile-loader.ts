/**
 * Profile Loader - Load and validate agent profiles from YAML
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';
import { Mutex } from 'async-mutex';
import type { AgentProfile } from '../types/agent.js';
import { AgentValidationError, AgentNotFoundError } from '../types/agent.js';
import { logger } from '../utils/logger.js';
import { TTLCache } from '../core/cache.js';
import type { TeamManager } from '../core/team-manager.js';
import type { TeamConfig } from '../types/team.js';
import type { ProfileCacheConfig } from '../types/config.js';
import { isValidName } from '../core/validation-limits.js';
import {
  ComponentType,
  LifecycleState,
  markState,
  markCacheHit,
  markCacheMiss,
  PerformanceTimer
} from '../utils/performance-markers.js';

// Get the directory of this file for locating built-in agents
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package root - handle both dev (src/) and prod (dist/) scenarios
function getPackageRoot(): string {
  // In production, __dirname will be dist/
  // In development, __dirname will be src/agents/
  const currentDir = __dirname;

  // If we're in dist/, go up one level to package root
  // If we're in src/agents/, go up two levels to package root
  if (currentDir.includes('/dist')) {
    return join(currentDir, '..');
  } else {
    return join(currentDir, '../..');
  }
}

/**
 * Profile Loader - Load and validate agent profiles
 */
export class ProfileLoader {
  private profilesDir: string;
  private fallbackProfilesDir: string;
  private cache: TTLCache<AgentProfile>;
  private displayNameMap: Map<string, string> = new Map();
  private mapInitialized: boolean = false;
  private initMutex: Mutex = new Mutex();  // Protect mapInitialized from race conditions
  private teamManager?: TeamManager;

  constructor(profilesDir: string, fallbackProfilesDir?: string, teamManager?: TeamManager, cacheConfig?: ProfileCacheConfig) {
    this.profilesDir = profilesDir;
    // Default fallback to built-in examples/agents
    // This should work in both dev and production environments
    this.fallbackProfilesDir = fallbackProfilesDir || join(getPackageRoot(), 'examples/agents');
    // v5.6.18: Configurable profile cache with 30-minute default TTL (was 5 minutes)
    // Profiles rarely change, so longer TTL reduces disk I/O by ~80%
    this.cache = new TTLCache<AgentProfile>({
      maxEntries: cacheConfig?.maxEntries ?? 20,
      ttl: cacheConfig?.ttl ?? 1800000, // 30 minutes (was 300000 = 5 minutes)
      cleanupInterval: cacheConfig?.cleanupInterval ?? 120000, // Cleanup every 2 minutes (was 60000 = 1 minute)
      debug: false
    });
    // v4.10.0+: Optional TeamManager for team-based configuration
    this.teamManager = teamManager;
  }

  /**
   * Build displayName → name mapping table (lightweight)
   * Only reads displayName field from YAML, doesn't load full profile
   * Priority: Local .automatosx/agents override examples/agents
   * Protected by mutex to prevent race conditions
   */
  private async buildDisplayNameMap(): Promise<void> {
    return this.initMutex.runExclusive(async () => {
      // Double-check inside mutex
      if (this.mapInitialized) {
        return;
      }

      logger.debug('Building displayName mapping table');
      this.displayNameMap.clear();

      try {
        // Priority 1: Process local profiles first (.automatosx/agents)
        const localProfiles = await this.listProfilesFromDir(this.profilesDir);
        for (const name of localProfiles) {
          await this.addToDisplayNameMap(name, 'local');
        }

        // Priority 2: Process fallback profiles (examples/agents)
        // These will NOT override local profiles with the same displayName
        const fallbackProfiles = await this.listProfilesFromDir(this.fallbackProfilesDir);
        for (const name of fallbackProfiles) {
          // Skip if already exists in local profiles (by name)
          if (localProfiles.includes(name)) {
            logger.debug('Skipping fallback profile (local override)', { name });
            continue;
          }
          await this.addToDisplayNameMap(name, 'fallback');
        }

        this.mapInitialized = true;
        logger.debug('DisplayName mapping built', {
          mappings: this.displayNameMap.size,
          localProfiles: localProfiles.length,
          fallbackProfiles: fallbackProfiles.length
        });
      } catch (error) {
        logger.error('Failed to build displayName mapping', { error });
        // Don't throw - allow fallback to direct name lookup
      }
    });
  }

  /**
   * Helper: Add profile to displayName map
   */
  private async addToDisplayNameMap(name: string, source: 'local' | 'fallback'): Promise<void> {
    try {
      // Lightweight: Only read displayName field, not full profile
      const displayName = await this.readDisplayNameOnly(name);

      if (displayName) {
        const lowerDisplayName = displayName.toLowerCase();

        // Check for duplicate display names
        const existing = this.displayNameMap.get(lowerDisplayName);
        if (existing) {
          logger.warn('Duplicate displayName detected', {
            displayName,
            existingAgent: existing,
            newAgent: name,
            source,
            resolution: `Keeping existing (${existing})`
          });
          // Keep existing entry (local profiles have priority)
          return;
        }

        // Store case-insensitive mapping
        this.displayNameMap.set(lowerDisplayName, name);
        logger.debug('Mapped displayName to agent', {
          displayName,
          name,
          source
        });
      }
    } catch (error) {
      // Skip profiles that fail to read
      logger.warn('Failed to read displayName for mapping', { name, source, error });
    }
  }

  /**
   * Helper: List profiles from a specific directory
   */
  private async listProfilesFromDir(dir: string): Promise<string[]> {
    try {
      const files = await readdir(dir);
      return files
        .filter(file => extname(file) === '.yaml' || extname(file) === '.yml')
        .map(file => basename(file, extname(file)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist
        return [];
      }
      throw error;
    }
  }

  /**
   * Read only displayName field from YAML (lightweight, no full parsing)
   * Returns null if no displayName or file doesn't exist
   */
  private async readDisplayNameOnly(name: string): Promise<string | null> {
    const profilePaths = this.getProfilePath(name);

    for (const profilePath of profilePaths) {
      try {
        const content = await readFile(profilePath, 'utf-8');

        // Security: Limit file size check (same as loadProfile)
        if (content.length > 100 * 1024) {
          continue;
        }

        // Parse YAML to extract only displayName
        // FIX Bug #104: Validate data is object before accessing properties
        const data = load(content);
        return data && typeof data === 'object' && !Array.isArray(data) && 'displayName' in data
          ? (data as any).displayName || null
          : null;

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File not found, try next path
          continue;
        }
        // Other errors, skip this profile
        return null;
      }
    }

    return null;
  }

  /**
   * Resolve agent identifier (name or displayName) to actual profile name
   * Optimized: Try direct load first, only build full mapping if needed
   */
  async resolveAgentName(identifier: string): Promise<string> {
    markState(ComponentType.PROFILE_LOADER, LifecycleState.RESOLVING, {
      message: 'resolving agent name',
      input: identifier
    });

    // Optimization: Try direct profile load first (most common case)
    // This avoids loading all profiles when using profile names directly
    try {
      await this.loadProfile(identifier);
      // If load succeeds, identifier is a valid profile name
      markState(ComponentType.PROFILE_LOADER, LifecycleState.RESOLVED, {
        message: 'resolved (direct match)',
        input: identifier,
        resolved: identifier,
        method: 'direct'
      });
      return identifier;
    } catch (error) {
      // Profile not found directly, might be a displayName
      // Only now build the displayName mapping if not already done
      if ((error as any).name === 'AgentNotFoundError') {
        logger.debug('Direct profile load failed, trying displayName lookup', { identifier });

        // Build map lazily if not already built
        await this.buildDisplayNameMap();

        // Try case-insensitive displayName lookup
        const resolved = this.displayNameMap.get(identifier.toLowerCase());
        if (resolved) {
          markState(ComponentType.PROFILE_LOADER, LifecycleState.RESOLVED, {
            message: 'resolved (displayName match)',
            input: identifier,
            resolved,
            method: 'displayName'
          });
          return resolved;
        }

        // Still not found, throw the original error
        throw error;
      }

      // Other errors (validation, etc.) should be propagated
      throw error;
    }
  }

  /**
   * Load a specific agent profile
   */
  async loadProfile(name: string): Promise<AgentProfile> {
    markState(ComponentType.PROFILE_LOADER, LifecycleState.LOADING, {
      message: 'loading profile',
      name
    });

    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      markCacheHit(ComponentType.PROFILE_LOADER, 'loadProfile', { name });
      return cached;
    }

    markCacheMiss(ComponentType.PROFILE_LOADER, 'loadProfile', { name });

    const timer = new PerformanceTimer(
      ComponentType.PROFILE_LOADER,
      'loadProfile',
      'profile',
      { name }
    );

    // Get possible paths (primary and fallback)
    const profilePaths = this.getProfilePath(name);

    // Try each path in order
    for (const profilePath of profilePaths) {
      try {
        const content = await readFile(profilePath, 'utf-8');

        // Security: Limit file size to prevent DoS (max 100KB for profile)
        if (content.length > 100 * 1024) {
          throw new AgentValidationError('Profile file too large (max 100KB)');
        }

        // Security: Use safe YAML parsing (default safe schema)
        // Note: js-yaml's load() already uses safe schema by default
        const data = load(content) as any;

        // Validate and build profile (v4.10.0+: async for team inheritance)
        const profile = await this.buildProfile(data, name);

        // Cache it
        this.cache.set(name, profile);

        timer.end({ path: profilePath, team: profile.team });

        markState(ComponentType.PROFILE_LOADER, LifecycleState.LOADED, {
          message: 'profile loaded',
          name,
          path: profilePath,
          team: profile.team
        });

        return profile;

      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File not found, try next path
          continue;
        }
        // Other errors should be thrown immediately
        throw error;
      }
    }

    // If we've tried all paths and none worked, throw AgentNotFoundError
    throw new AgentNotFoundError(name);
  }

  /**
   * List all available profiles
   */
  async listProfiles(): Promise<string[]> {
    const profileSet = new Set<string>();

    // Try to load from primary directory
    try {
      const files = await readdir(this.profilesDir);
      const profiles = files
        .filter(file => extname(file) === '.yaml' || extname(file) === '.yml')
        .map(file => basename(file, extname(file)));

      profiles.forEach(p => profileSet.add(p));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Directory doesn't exist, will fallback to built-in agents
    }

    // Also load from fallback directory (built-in agents)
    try {
      const files = await readdir(this.fallbackProfilesDir);
      const profiles = files
        .filter(file => extname(file) === '.yaml' || extname(file) === '.yml')
        .map(file => basename(file, extname(file)));

      profiles.forEach(p => profileSet.add(p));
    } catch (error) {
      // Fallback directory doesn't exist - this is OK
      logger.debug('Fallback profiles directory not found', {
        dir: this.fallbackProfilesDir
      });
    }

    return Array.from(profileSet).sort();
  }

  /**
   * Calculate Levenshtein distance between two strings (for fuzzy matching)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }

  /**
   * Find similar agent names using fuzzy matching
   * Returns agents sorted by similarity (most similar first)
   */
  async findSimilarAgents(query: string, maxResults: number = 3): Promise<Array<{ name: string; displayName?: string; role?: string; distance: number }>> {
    const allProfiles = await this.listProfiles();
    const similarities: Array<{ name: string; displayName?: string; role?: string; distance: number }> = [];

    // Build displayName map if not already done
    await this.buildDisplayNameMap();

    for (const profileName of allProfiles) {
      try {
        // Calculate distance for profile name
        const nameDistance = this.levenshteinDistance(query.toLowerCase(), profileName.toLowerCase());

        // Try to get displayName and role for better matching
        const displayName = await this.readDisplayNameOnly(profileName);
        let minDistance = nameDistance;

        // Also check distance with displayName
        if (displayName) {
          const displayDistance = this.levenshteinDistance(query.toLowerCase(), displayName.toLowerCase());
          minDistance = Math.min(minDistance, displayDistance);
        }

        // Load profile to get role (suppress logs)
        try {
          const cached = this.cache.get(profileName);
          let profile: AgentProfile | undefined = cached;

          if (!profile) {
            // Load without logging (for similarity search)
            const profilePaths = this.getProfilePath(profileName);
            for (const profilePath of profilePaths) {
              try {
                const content = await readFile(profilePath, 'utf-8');
                if (content.length > 100 * 1024) continue;
                const data = load(content) as any;
                profile = await this.buildProfile(data, profileName);
                this.cache.set(profileName, profile);
                break;
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                  continue;
                }
                throw error;
              }
            }
          }

          if (profile) {
            const roleDistance = this.levenshteinDistance(query.toLowerCase(), profile.role.toLowerCase());
            minDistance = Math.min(minDistance, roleDistance);

            similarities.push({
              name: profileName,
              displayName: displayName || undefined,
              role: profile.role,
              distance: minDistance
            });
          } else {
            // Profile not found, just use name/displayName distance
            similarities.push({
              name: profileName,
              displayName: displayName || undefined,
              distance: minDistance
            });
          }
        } catch {
          // If profile fails to load, just use name/displayName distance
          similarities.push({
            name: profileName,
            displayName: displayName || undefined,
            distance: minDistance
          });
        }
      } catch (error) {
        // Skip profiles that fail
        logger.debug('Failed to calculate similarity', { profileName, error });
      }
    }

    // Sort by distance (lower is better) and return top N
    return similarities
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);
  }

  /**
   * Validate profile structure
   */
  validateProfile(profile: AgentProfile): boolean {
    const required = ['name', 'role', 'description', 'systemPrompt'];

    for (const field of required) {
      if (!profile[field as keyof AgentProfile]) {
        throw new AgentValidationError(`Missing required field: ${field}`);
      }
    }

    // Validate types
    if (typeof profile.name !== 'string') {
      throw new AgentValidationError('name must be a string');
    }

    if (typeof profile.role !== 'string') {
      throw new AgentValidationError('role must be a string');
    }

    if (typeof profile.description !== 'string') {
      throw new AgentValidationError('description must be a string');
    }

    if (typeof profile.systemPrompt !== 'string') {
      throw new AgentValidationError('systemPrompt must be a string');
    }

    // Validate optional fields
    if (profile.abilities && !Array.isArray(profile.abilities)) {
      throw new AgentValidationError('abilities must be an array');
    }

    if (profile.dependencies !== undefined) {
      if (!Array.isArray(profile.dependencies)) {
        throw new AgentValidationError('dependencies must be an array');
      }

      profile.dependencies.forEach((dep, i) => {
        if (typeof dep !== 'string' || dep.trim() === '') {
          throw new AgentValidationError(`dependencies[${i}] must be a non-empty string`);
        }
        if (!isValidName(dep)) {
          throw new AgentValidationError(`dependencies[${i}] must match agent naming rules`);
        }
        if (dep === profile.name) {
          throw new AgentValidationError('dependencies cannot include the agent itself');
        }
      });
    }

    if (profile.parallel !== undefined && typeof profile.parallel !== 'boolean') {
      throw new AgentValidationError('parallel must be a boolean');
    }

    if (profile.temperature !== undefined) {
      if (typeof profile.temperature !== 'number' || profile.temperature < 0 || profile.temperature > 1) {
        throw new AgentValidationError('temperature must be a number between 0 and 1');
      }
    }

    if (profile.maxTokens !== undefined) {
      if (typeof profile.maxTokens !== 'number' || profile.maxTokens < 1) {
        throw new AgentValidationError('maxTokens must be a positive number');
      }
    }

    // Validate v4.1+ enhanced fields
    if (profile.stages !== undefined) {
      if (!Array.isArray(profile.stages)) {
        throw new AgentValidationError('stages must be an array');
      }

      profile.stages.forEach((stage, i) => {
        if (!stage.name || typeof stage.name !== 'string') {
          throw new AgentValidationError(`stages[${i}].name is required and must be a string`);
        }
        if (!stage.description || typeof stage.description !== 'string') {
          throw new AgentValidationError(`stages[${i}].description is required and must be a string`);
        }
        if (stage.key_questions !== undefined && !Array.isArray(stage.key_questions)) {
          throw new AgentValidationError(`stages[${i}].key_questions must be an array`);
        }
        if (stage.outputs !== undefined && !Array.isArray(stage.outputs)) {
          throw new AgentValidationError(`stages[${i}].outputs must be an array`);
        }
        if (stage.model !== undefined && typeof stage.model !== 'string') {
          throw new AgentValidationError(`stages[${i}].model must be a string`);
        }
        if (stage.temperature !== undefined) {
          if (typeof stage.temperature !== 'number' || stage.temperature < 0 || stage.temperature > 1) {
            throw new AgentValidationError(`stages[${i}].temperature must be a number between 0 and 1`);
          }
        }
      });
    }

    if (profile.personality !== undefined) {
      if (typeof profile.personality !== 'object' || profile.personality === null || Array.isArray(profile.personality)) {
        throw new AgentValidationError('personality must be an object');
      }
      // Validate personality fields if present
      const p = profile.personality;
      if (p.traits !== undefined && !Array.isArray(p.traits)) {
        throw new AgentValidationError('personality.traits must be an array');
      }
      if (p.catchphrase !== undefined && typeof p.catchphrase !== 'string') {
        throw new AgentValidationError('personality.catchphrase must be a string');
      }
      if (p.communication_style !== undefined && typeof p.communication_style !== 'string') {
        throw new AgentValidationError('personality.communication_style must be a string');
      }
      if (p.decision_making !== undefined && typeof p.decision_making !== 'string') {
        throw new AgentValidationError('personality.decision_making must be a string');
      }
    }

    if (profile.thinking_patterns !== undefined) {
      if (!Array.isArray(profile.thinking_patterns)) {
        throw new AgentValidationError('thinking_patterns must be an array');
      }
    }

    // Validate v4.5.8+ abilitySelection
    if (profile.abilitySelection !== undefined) {
      const as = profile.abilitySelection;

      if (typeof as !== 'object' || as === null || Array.isArray(as)) {
        throw new AgentValidationError('abilitySelection must be an object');
      }

      if (as.core !== undefined) {
        if (!Array.isArray(as.core)) {
          throw new AgentValidationError('abilitySelection.core must be an array');
        }
        // Validate core abilities are strings
        as.core.forEach((ability, i) => {
          if (typeof ability !== 'string') {
            throw new AgentValidationError(`abilitySelection.core[${i}] must be a string`);
          }
        });
      }

      if (as.taskBased !== undefined) {
        if (typeof as.taskBased !== 'object' || as.taskBased === null || Array.isArray(as.taskBased)) {
          throw new AgentValidationError('abilitySelection.taskBased must be an object');
        }
        // Validate taskBased structure: keyword -> abilities[]
        Object.entries(as.taskBased).forEach(([keyword, abilities]) => {
          if (!Array.isArray(abilities)) {
            throw new AgentValidationError(`abilitySelection.taskBased["${keyword}"] must be an array`);
          }
          abilities.forEach((ability, i) => {
            if (typeof ability !== 'string') {
              throw new AgentValidationError(`abilitySelection.taskBased["${keyword}"][${i}] must be a string`);
            }
          });
        });
      }

      if (as.loadAll !== undefined && typeof as.loadAll !== 'boolean') {
        throw new AgentValidationError('abilitySelection.loadAll must be a boolean');
      }
    }

    // Validate v4.7.0+ orchestration
    if (profile.orchestration !== undefined) {
      const orch = profile.orchestration;

      if (typeof orch !== 'object' || orch === null || Array.isArray(orch)) {
        throw new AgentValidationError('orchestration must be an object');
      }

      // v4.9.0: canDelegate is deprecated and ignored
      if ((orch as any).canDelegate !== undefined) {
        logger.warn('orchestration.canDelegate is deprecated and ignored (v4.9.0+). All agents can delegate by default.', {
          agent: profile.name
        });
      }

      if (orch.maxDelegationDepth !== undefined) {
        if (typeof orch.maxDelegationDepth !== 'number' || orch.maxDelegationDepth < 0 || !Number.isInteger(orch.maxDelegationDepth)) {
          throw new AgentValidationError('orchestration.maxDelegationDepth must be a non-negative integer (0 = no delegation allowed)');
        }
      }

      // v5.2: Workspace permission fields removed
      // All agents now have equal access to automatosx/PRD and automatosx/tmp
      // canReadWorkspaces and canWriteToShared no longer used
    }

    return true;
  }

  /**
   * Get profile path (with path traversal protection)
   * Returns an array of possible paths to try (primary first, then fallback)
   */
  getProfilePath(name: string): string[] {
    // Security: Prevent path traversal attacks
    // Only allow alphanumeric, dash, underscore in profile names
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new AgentValidationError(`Invalid profile name: ${name}. Only alphanumeric characters, dashes, and underscores are allowed.`);
    }

    // Return paths to try in order: primary directory, then fallback
    return [
      join(this.profilesDir, `${name}.yaml`),
      join(this.fallbackProfilesDir, `${name}.yaml`)
    ];
  }

  /**
   * Clear cache and displayName mapping
   * Protected by mutex to prevent race conditions
   */
  async clearCache(): Promise<void> {
    await this.initMutex.runExclusive(async () => {
      this.cache.clear();
      this.displayNameMap.clear();
      this.mapInitialized = false;
      logger.debug('Cache and displayName mapping cleared');
    });
  }

  /**
   * Build profile from raw data with defaults
   * v4.10.0+: Supports team-based configuration inheritance
   */
  private async buildProfile(data: any, name: string): Promise<AgentProfile> {
    // FIX Bug #104: Validate data is a valid object before accessing properties
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AgentValidationError(`Invalid profile data for ${name}: expected object, got ${typeof data}`);
    }

    let teamConfig: TeamConfig | undefined;

    // v4.10.0+: Load team configuration if specified
    if (data.team && this.teamManager) {
      try {
        teamConfig = await this.teamManager.loadTeam(data.team);
        logger.debug('Team configuration loaded for agent', {
          agent: name,
          team: data.team
        });
      } catch (error) {
        logger.warn('Failed to load team configuration, using agent defaults', {
          agent: name,
          team: data.team,
          error: (error as Error).message
        });
      }
    }

    // Merge abilities: team's sharedAbilities + agent's abilities
    const abilities = data.abilities || [];
    if (teamConfig?.sharedAbilities) {
      // Combine team shared abilities with agent-specific abilities
      // Remove duplicates using Set
      const allAbilities = [...new Set([...teamConfig.sharedAbilities, ...abilities])];
      logger.debug('Merged abilities from team', {
        agent: name,
        team: teamConfig.name,
        teamAbilities: teamConfig.sharedAbilities.length,
        agentAbilities: abilities.length,
        totalAbilities: allAbilities.length
      });
      abilities.splice(0, abilities.length, ...allAbilities);
    }

    // Merge orchestration: team defaults + agent overrides
    let orchestration = data.orchestration;
    if (teamConfig?.orchestration && !orchestration) {
      // Use team orchestration defaults if agent doesn't specify its own
      orchestration = teamConfig.orchestration;
      logger.debug('Using team orchestration defaults', {
        agent: name,
        team: teamConfig.name
      });
    }

    const profile: AgentProfile = {
      name: data.name || name,
      displayName: data.displayName,
      role: data.role,
      description: data.description,
      // v4.10.0+: Team field
      team: data.team,
      systemPrompt: data.systemPrompt,
      abilities: abilities,
      dependencies: data.dependencies,
      parallel: data.parallel,
      // Enhanced v4.1+ features
      stages: data.stages,
      personality: data.personality,
      thinking_patterns: data.thinking_patterns,
      abilitySelection: data.abilitySelection,
      // v5.7.0+: Agent Selection Metadata
      selectionMetadata: data.selectionMetadata,
      // Provider preferences (deprecated, kept for backward compatibility)
      provider: data.provider,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      // Optional
      tags: data.tags,
      version: data.version,
      metadata: data.metadata,
      // v4.7.0+ Orchestration (merged with team defaults)
      orchestration: orchestration
    };

    // Validate
    this.validateProfile(profile);

    // v5.6.13: Phase 2.4 - Freeze profile for immutability (2-10ms copy optimization)
    // Deep freeze nested objects for full immutability
    if (profile.orchestration) {
      Object.freeze(profile.orchestration);
    }
    if (profile.abilitySelection) {
      Object.freeze(profile.abilitySelection);
      if (profile.abilitySelection.core) {
        Object.freeze(profile.abilitySelection.core);
      }
      if (profile.abilitySelection.taskBased) {
        Object.freeze(profile.abilitySelection.taskBased);
      }
    }
    if (profile.stages) {
      Object.freeze(profile.stages);
    }
    if (profile.personality) {
      Object.freeze(profile.personality);
    }
    if (profile.thinking_patterns) {
      Object.freeze(profile.thinking_patterns);
    }
    if (profile.abilities) {
      Object.freeze(profile.abilities);
    }
    if (profile.dependencies) {
      Object.freeze(profile.dependencies);
    }
    if (profile.tags) {
      Object.freeze(profile.tags);
    }
    if (profile.metadata) {
      Object.freeze(profile.metadata);
    }
    if (profile.selectionMetadata) {
      Object.freeze(profile.selectionMetadata);
      if (profile.selectionMetadata.primaryIntents) {
        Object.freeze(profile.selectionMetadata.primaryIntents);
      }
      if (profile.selectionMetadata.secondarySignals) {
        Object.freeze(profile.selectionMetadata.secondarySignals);
      }
      if (profile.selectionMetadata.negativeIntents) {
        Object.freeze(profile.selectionMetadata.negativeIntents);
      }
      if (profile.selectionMetadata.redirectWhen) {
        Object.freeze(profile.selectionMetadata.redirectWhen);
      }
    }

    // Freeze the profile itself
    Object.freeze(profile);

    return profile;
  }

  /**
   * Get team configuration for an agent (if available)
   * v4.10.0+: Used by ContextManager to get provider configuration
   */
  async getTeamConfig(agentName: string): Promise<TeamConfig | undefined> {
    if (!this.teamManager) {
      return undefined;
    }

    try {
      const profile = await this.loadProfile(agentName);
      if (profile.team) {
        return await this.teamManager.loadTeam(profile.team);
      }
    } catch (error) {
      logger.warn('Failed to get team config for agent', {
        agent: agentName,
        error: (error as Error).message
      });
    }

    return undefined;
  }
}
