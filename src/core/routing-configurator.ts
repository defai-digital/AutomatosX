/**
 * Provider Routing Auto-Configurator (v13.0.0)
 *
 * Analyzes installed providers and generates optimal routing configuration.
 * Called during `ax setup` and `ax config routing`.
 *
 * Features:
 * - Detects installed providers (CLI and SDK-based)
 * - Generates priority based on free tier, capabilities, and availability
 * - Creates agent-provider affinity mappings
 * - Produces human-readable reports
 *
 * @module core/routing-configurator
 */

import { readFile, writeFile } from 'fs/promises';
import { ProviderDetector } from './provider-detector.js';
import type { ProviderInfo } from './provider-detector.js';
import { logger } from '../shared/logging/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Provider capability profile with scoring
 */
export interface ProviderCapability {
  /** Provider identifier */
  name: string;
  /** CLI command or SDK identifier */
  command: string;
  /** Whether CLI is installed */
  installed: boolean;
  /** Whether provider is actually usable (CLI installed or API key set) */
  available: boolean;
  /** Execution mode */
  executionMode: 'cli' | 'sdk' | 'hybrid';
  /** Has free tier */
  freeTier: boolean;
  /** Free tier daily limit (requests per day) */
  freeTierLimit?: number;
  /** Coding capability score (0-100) */
  codingScore: number;
  /** Analysis capability score (0-100) */
  analysisScore: number;
  /** Speed score (0-100, higher = faster) */
  speedScore: number;
  /** Cost tier */
  costTier: 'free' | 'low' | 'medium' | 'high';
  /** Provider strengths */
  strengths: string[];
  /** Version if detected */
  version?: string;
  /** Error message if detection failed */
  error?: string;
}

/**
 * Agent-provider affinity configuration
 */
export interface AgentAffinity {
  /** Primary provider for this agent */
  primary: string | null;
  /** Fallback chain in order of preference */
  fallback: string[];
}

/**
 * Complete routing recommendation
 */
export interface RoutingRecommendation {
  /** Provider configurations with priorities */
  providers: {
    [name: string]: {
      enabled: boolean;
      priority: number;
      preferredFor: string[];
      fallbackFor: string[];
    };
  };
  /** Agent-to-provider affinity mappings */
  agentAffinities: {
    [agentName: string]: AgentAffinity;
  };
  /** Ability-type to provider routing */
  abilityRouting: {
    [abilityType: string]: {
      preferredProviders: string[];
    };
  };
  /** Human-readable rationale for decisions */
  rationale: string[];
  /** Timestamp of recommendation generation */
  generatedAt: string;
}

/**
 * Options for applying recommendations
 */
export interface ApplyOptions {
  /** If true, don't override manually configured routing */
  preserveCustomizations?: boolean;
  /** Dry run mode - don't write changes */
  dryRun?: boolean;
}

// ============================================================================
// Static Data: Provider Capability Profiles
// ============================================================================

/**
 * Static provider capability scores
 * Based on empirical testing and provider documentation
 */
const PROVIDER_PROFILES: Record<string, Omit<ProviderCapability, 'name' | 'command' | 'installed' | 'available' | 'version' | 'error'>> = {
  'claude-code': {
    executionMode: 'cli',
    freeTier: true,
    freeTierLimit: undefined,  // Rate limited, not count limited
    codingScore: 95,
    analysisScore: 90,
    speedScore: 70,
    costTier: 'low',
    strengths: ['complex-reasoning', 'code-generation', 'refactoring', 'security', 'architecture'],
  },
  'gemini-cli': {
    executionMode: 'cli',
    freeTier: true,
    freeTierLimit: 1500,  // 1500 requests per day
    codingScore: 75,
    analysisScore: 85,
    speedScore: 90,
    costTier: 'free',
    strengths: ['fast-analysis', 'documentation', 'code-review', 'summarization', 'research'],
  },
  'codex': {
    executionMode: 'cli',
    freeTier: true,
    freeTierLimit: undefined,  // Rate limited
    codingScore: 85,
    analysisScore: 80,
    speedScore: 75,
    costTier: 'low',
    strengths: ['code-completion', 'scripting', 'shell-commands', 'devops', 'infrastructure'],
  },
  'glm': {
    executionMode: 'sdk',
    freeTier: false,
    codingScore: 70,
    analysisScore: 75,
    speedScore: 85,
    costTier: 'low',
    strengths: ['chinese-language', 'general-tasks', 'translation', 'multilingual'],
  },
  'grok': {
    executionMode: 'sdk',
    freeTier: false,
    codingScore: 75,
    analysisScore: 80,
    speedScore: 85,
    costTier: 'medium',
    strengths: ['real-time-info', 'creative-writing', 'research', 'current-events'],
  },
  'qwen': {
    executionMode: 'hybrid',
    freeTier: true,
    freeTierLimit: 2000,  // Qwen CLI: 2000 requests per day
    codingScore: 80,
    analysisScore: 75,
    speedScore: 85,
    costTier: 'low',
    strengths: ['code-generation', 'chinese-language', 'math', 'reasoning'],
  },
};

/**
 * Provider command mapping
 */
const PROVIDER_COMMANDS: Record<string, string> = {
  'claude-code': 'claude',
  'gemini-cli': 'gemini',
  'codex': 'codex',
  'glm': 'glm',
  'grok': 'grok',
  'qwen': 'qwen',
};

/**
 * API key environment variables for SDK providers
 */
const PROVIDER_API_KEYS: Record<string, string[]> = {
  'glm': ['GLM_API_KEY', 'ZHIPU_API_KEY', 'ZAI_API_KEY'],
  'grok': ['XAI_API_KEY', 'GROK_API_KEY'],
  'qwen': ['DASHSCOPE_API_KEY', 'QWEN_API_KEY'],
};

/**
 * Agent-provider affinity defaults
 * Maps agent names to preferred provider order
 */
const AGENT_PROVIDER_AFFINITY: Record<string, { preferred: string[] }> = {
  'backend': { preferred: ['claude-code', 'codex', 'qwen', 'gemini-cli'] },
  'frontend': { preferred: ['claude-code', 'codex', 'gemini-cli', 'qwen'] },
  'quality': { preferred: ['gemini-cli', 'claude-code', 'codex', 'grok'] },
  'security': { preferred: ['claude-code', 'grok', 'codex', 'gemini-cli'] },
  'architecture': { preferred: ['claude-code', 'gemini-cli', 'grok', 'codex'] },
  'devops': { preferred: ['codex', 'claude-code', 'gemini-cli', 'qwen'] },
  'data': { preferred: ['claude-code', 'qwen', 'gemini-cli', 'codex'] },
  'data-scientist': { preferred: ['claude-code', 'qwen', 'gemini-cli', 'grok'] },
  'product': { preferred: ['gemini-cli', 'grok', 'claude-code', 'qwen'] },
  'writer': { preferred: ['gemini-cli', 'claude-code', 'grok', 'qwen'] },
  'researcher': { preferred: ['grok', 'gemini-cli', 'claude-code', 'qwen'] },
  'mobile': { preferred: ['claude-code', 'codex', 'gemini-cli', 'qwen'] },
  'fullstack': { preferred: ['claude-code', 'codex', 'qwen', 'gemini-cli'] },
  'design': { preferred: ['claude-code', 'gemini-cli', 'grok', 'codex'] },
  'ceo': { preferred: ['claude-code', 'grok', 'gemini-cli', 'qwen'] },
  'cto': { preferred: ['claude-code', 'grok', 'gemini-cli', 'codex'] },
  'creative-marketer': { preferred: ['grok', 'gemini-cli', 'claude-code', 'qwen'] },
  'quantum-engineer': { preferred: ['claude-code', 'qwen', 'gemini-cli', 'codex'] },
  'aerospace-scientist': { preferred: ['claude-code', 'gemini-cli', 'qwen', 'grok'] },
  'stan': { preferred: ['claude-code', 'gemini-cli', 'codex', 'grok'] },
};

/**
 * Ability type to provider mapping
 */
const ABILITY_PROVIDER_MAPPING: Record<string, string[]> = {
  'code-generation': ['claude-code', 'codex', 'qwen', 'gemini-cli'],
  'code-review': ['gemini-cli', 'claude-code', 'grok', 'codex'],
  'security-audit': ['claude-code', 'grok', 'codex'],
  'documentation': ['gemini-cli', 'claude-code', 'grok'],
  'data-analysis': ['gemini-cli', 'claude-code', 'grok', 'qwen'],
  'architecture': ['claude-code', 'gemini-cli', 'grok'],
  'testing': ['gemini-cli', 'claude-code', 'codex'],
  'devops': ['codex', 'claude-code', 'gemini-cli'],
  'research': ['grok', 'gemini-cli', 'claude-code'],
  'creative': ['grok', 'gemini-cli', 'claude-code'],
};

// ============================================================================
// RoutingConfigurator Class
// ============================================================================

/**
 * Provider Routing Auto-Configurator
 *
 * Analyzes installed providers and generates optimal routing configuration.
 *
 * @example
 * ```typescript
 * const configurator = new RoutingConfigurator();
 * await configurator.detectCapabilities();
 * const recommendation = configurator.generateRecommendation();
 * await configurator.applyRecommendation('ax.config.json', recommendation);
 * ```
 */
export class RoutingConfigurator {
  private capabilities: Map<string, ProviderCapability> = new Map();
  private detector: ProviderDetector;

  constructor() {
    this.detector = new ProviderDetector();
  }

  /**
   * Detect all providers and their capabilities
   *
   * Uses ProviderDetector for CLI detection and checks environment
   * variables for SDK provider API keys.
   *
   * @returns Map of provider names to their capabilities
   */
  async detectCapabilities(): Promise<Map<string, ProviderCapability>> {
    logger.info('Detecting provider capabilities...');

    const providerInfos = await this.detector.detectAllWithInfo();

    for (const info of providerInfos) {
      const profile = PROVIDER_PROFILES[info.name];
      if (!profile) {
        logger.warn('Unknown provider, skipping', { provider: info.name });
        continue;
      }

      const capability: ProviderCapability = {
        name: info.name,
        command: info.command,
        installed: info.detected,
        available: this.checkAvailability(info),
        version: info.version,
        error: info.error,
        ...profile,
      };

      this.capabilities.set(info.name, capability);
    }

    const available = Array.from(this.capabilities.values()).filter(c => c.available);
    logger.info('Provider capabilities detected', {
      total: this.capabilities.size,
      available: available.length,
      providers: available.map(c => c.name),
    });

    return this.capabilities;
  }

  /**
   * Check if a provider is actually available for use
   */
  private checkAvailability(info: ProviderInfo): boolean {
    // CLI providers: available if installed
    if (['claude-code', 'gemini-cli', 'codex'].includes(info.name)) {
      return info.detected;
    }

    // SDK providers: need API key
    const apiKeys = PROVIDER_API_KEYS[info.name];
    if (apiKeys) {
      const hasApiKey = apiKeys.some(key => !!process.env[key]);
      if (hasApiKey) {
        return true;
      }
    }

    // Hybrid providers (qwen): CLI or API key
    if (info.name === 'qwen') {
      return info.detected || !!(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY);
    }

    return false;
  }

  /**
   * Generate optimal routing recommendation
   *
   * Calculates priorities based on:
   * 1. Free tier availability (prioritize free)
   * 2. Coding capability score
   * 3. Execution mode reliability (CLI > SDK)
   * 4. Speed score
   *
   * @returns Complete routing recommendation
   */
  generateRecommendation(): RoutingRecommendation {
    const available = Array.from(this.capabilities.values())
      .filter(c => c.available)
      .sort((a, b) => this.calculatePriorityScore(b) - this.calculatePriorityScore(a));

    const recommendation: RoutingRecommendation = {
      providers: {},
      agentAffinities: {},
      abilityRouting: {},
      rationale: [],
      generatedAt: new Date().toISOString(),
    };

    // Handle no providers case
    if (available.length === 0) {
      recommendation.rationale.push(
        '⚠️  No providers detected. Install at least one:',
        '   • Claude Code: https://claude.ai/code',
        '   • Gemini CLI: npm install -g @anthropic-ai/gemini-cli',
        '   • Codex CLI: npm install -g @openai/codex-cli',
        '   • GLM: Set GLM_API_KEY environment variable',
        '   • Grok: Set XAI_API_KEY environment variable',
        '   • Qwen: Set DASHSCOPE_API_KEY or install qwen CLI'
      );
      return recommendation;
    }

    // Assign provider priorities (lower number = higher priority in config)
    // But we sort by our score descending, so index 0 gets priority 1 (highest)
    available.forEach((cap, index) => {
      const priority = index + 1;
      recommendation.providers[cap.name] = {
        enabled: true,
        priority,
        preferredFor: this.getPreferredAgents(cap.name, available),
        fallbackFor: this.getFallbackAgents(cap.name, available),
      };
    });

    // Generate agent affinities
    const knownAgents = Object.keys(AGENT_PROVIDER_AFFINITY);
    for (const agent of knownAgents) {
      recommendation.agentAffinities[agent] = this.calculateAgentAffinity(agent, available);
    }

    // Generate ability routing
    for (const [ability, defaultProviders] of Object.entries(ABILITY_PROVIDER_MAPPING)) {
      const availableForAbility = defaultProviders.filter(p =>
        available.some(c => c.name === p)
      );
      recommendation.abilityRouting[ability] = {
        preferredProviders: availableForAbility,
      };
    }

    // Generate rationale
    recommendation.rationale = this.generateRationale(available, recommendation);

    return recommendation;
  }

  /**
   * Calculate priority score for a provider
   * Higher score = higher priority (will get lower priority number in config)
   */
  private calculatePriorityScore(cap: ProviderCapability): number {
    let score = 0;

    // Free tier bonus (use free providers first)
    if (cap.freeTier) {
      score += 30;
    }

    // Cost tier (prefer lower cost)
    const costBonus: Record<string, number> = {
      'free': 20,
      'low': 10,
      'medium': 5,
      'high': 0,
    };
    score += costBonus[cap.costTier] ?? 0;

    // Coding capability (primary use case)
    score += cap.codingScore * 0.4;

    // Analysis capability
    score += cap.analysisScore * 0.3;

    // Speed bonus
    score += cap.speedScore * 0.2;

    // Reliability bonus (CLI > hybrid > SDK for reliability)
    if (cap.executionMode === 'cli') {
      score += 10;
    } else if (cap.executionMode === 'hybrid') {
      score += 5;
    }

    return score;
  }

  /**
   * Get agents that prefer this provider as primary
   */
  private getPreferredAgents(providerName: string, available: ProviderCapability[]): string[] {
    const preferredAgents: string[] = [];

    for (const [agent, affinity] of Object.entries(AGENT_PROVIDER_AFFINITY)) {
      // Find the first available provider in the preference list
      const primary = affinity.preferred.find(p =>
        available.some(c => c.name === p)
      );
      if (primary === providerName) {
        preferredAgents.push(agent);
      }
    }

    return preferredAgents;
  }

  /**
   * Get agents that use this provider as fallback
   */
  private getFallbackAgents(providerName: string, available: ProviderCapability[]): string[] {
    const fallbackAgents: string[] = [];

    for (const [agent, affinity] of Object.entries(AGENT_PROVIDER_AFFINITY)) {
      // Skip if this is the primary
      const primary = affinity.preferred.find(p =>
        available.some(c => c.name === p)
      );
      if (primary === providerName) {
        continue;
      }

      // Check if in fallback list
      const isInPreferred = affinity.preferred.includes(providerName);
      const isAvailable = available.some(c => c.name === providerName);
      if (isInPreferred && isAvailable) {
        fallbackAgents.push(agent);
      }
    }

    return fallbackAgents;
  }

  /**
   * Calculate agent affinity for a specific agent
   */
  private calculateAgentAffinity(
    agent: string,
    available: ProviderCapability[]
  ): AgentAffinity {
    const agentProfile = AGENT_PROVIDER_AFFINITY[agent];

    if (!agentProfile) {
      // Unknown agent: use overall priority
      return {
        primary: available[0]?.name ?? null,
        fallback: available.slice(1).map(c => c.name),
      };
    }

    // Find best available provider from preferred list
    const primary = agentProfile.preferred.find(p =>
      available.some(c => c.name === p)
    ) ?? available[0]?.name ?? null;

    // Build fallback chain: remaining preferred + other available
    const fallback: string[] = [];

    // First add remaining preferred providers
    for (const p of agentProfile.preferred) {
      if (p !== primary && available.some(c => c.name === p)) {
        fallback.push(p);
      }
    }

    // Then add other available providers not in preferred list
    for (const cap of available) {
      if (cap.name !== primary && !fallback.includes(cap.name)) {
        fallback.push(cap.name);
      }
    }

    return { primary, fallback };
  }

  /**
   * Generate human-readable rationale for the recommendation
   */
  private generateRationale(
    available: ProviderCapability[],
    recommendation: RoutingRecommendation
  ): string[] {
    const rationale: string[] = [];

    // Single provider case
    if (available.length === 1 && available[0]) {
      rationale.push(
        `ℹ️  Single provider detected: ${available[0].name}`,
        '   All agents will use this provider.',
        '   Install additional providers for fallback capability.'
      );
      return rationale;
    }

    // Explain priority order
    const priorityOrder = Object.entries(recommendation.providers)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([name]) => name);

    rationale.push(`Provider Priority Order: ${priorityOrder.join(' → ')}`);
    rationale.push('');

    // Explain why each provider got its priority
    for (const [name, config] of Object.entries(recommendation.providers)) {
      const cap = this.capabilities.get(name);
      if (!cap) continue;

      const reasons: string[] = [];

      if (config.priority === 1) {
        if (cap.freeTier) {
          reasons.push('free tier available');
        }
        if (cap.codingScore >= 90) {
          reasons.push('excellent coding capability');
        } else if (cap.analysisScore >= 85) {
          reasons.push('strong analysis capability');
        }
      }

      if (cap.strengths.length > 0) {
        reasons.push(`strengths: ${cap.strengths.slice(0, 3).join(', ')}`);
      }

      if (reasons.length > 0) {
        rationale.push(`• ${name} (priority ${config.priority}): ${reasons.join(', ')}`);
      }
    }

    // Note about free tier
    const freeProviders = available.filter(c => c.freeTier);
    if (freeProviders.length > 0) {
      rationale.push('');
      rationale.push(`💡 Free tier providers prioritized: ${freeProviders.map(c => c.name).join(', ')}`);
    }

    // Note about SDK providers without API keys
    const unavailableSdk = Array.from(this.capabilities.values())
      .filter(c => !c.available && c.executionMode === 'sdk');
    if (unavailableSdk.length > 0) {
      rationale.push('');
      rationale.push('⚠️  SDK providers not configured (missing API keys):');
      for (const cap of unavailableSdk) {
        const keys = PROVIDER_API_KEYS[cap.name];
        if (keys) {
          rationale.push(`   • ${cap.name}: Set ${keys[0]}`);
        }
      }
    }

    return rationale;
  }

  /**
   * Apply recommendation to ax.config.json
   *
   * @param configPath - Path to ax.config.json
   * @param recommendation - Routing recommendation to apply
   * @param options - Apply options
   */
  async applyRecommendation(
    configPath: string,
    recommendation: RoutingRecommendation,
    options: ApplyOptions = {}
  ): Promise<{ applied: boolean; changes: string[] }> {
    const changes: string[] = [];

    // Load existing config
    let existingConfig: Record<string, unknown>;
    try {
      const content = await readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(content);
    } catch {
      logger.warn('Could not read existing config, will create new', { configPath });
      existingConfig = {};
    }

    // Check for manual configuration
    const routing = existingConfig.routing as Record<string, unknown> | undefined;
    if (options.preserveCustomizations && routing?.autoConfigured === false) {
      logger.info('Manual routing configuration detected, preserving');
      return { applied: false, changes: ['Skipped: manual configuration preserved'] };
    }

    // Update provider priorities
    const providers = (existingConfig.providers ?? {}) as Record<string, Record<string, unknown>>;
    for (const [name, config] of Object.entries(recommendation.providers)) {
      if (!providers[name]) {
        providers[name] = {};
      }

      const oldPriority = providers[name].priority;
      if (oldPriority !== config.priority) {
        changes.push(`${name}: priority ${oldPriority ?? 'unset'} → ${config.priority}`);
        providers[name].priority = config.priority;
      }

      providers[name].enabled = config.enabled;
    }

    existingConfig.providers = providers;

    // Add routing configuration
    existingConfig.routing = {
      ...(routing ?? {}),
      autoConfigured: true,
      lastConfiguredAt: recommendation.generatedAt,
      strategy: 'capability-based',
      agentAffinities: recommendation.agentAffinities,
      abilityRouting: recommendation.abilityRouting,
    };

    changes.push('routing.autoConfigured = true');
    changes.push(`routing.agentAffinities: ${Object.keys(recommendation.agentAffinities).length} agents`);

    // Write config (unless dry run)
    if (!options.dryRun) {
      const content = JSON.stringify(existingConfig, null, 2);
      await writeFile(configPath, content, 'utf-8');
      logger.info('Applied routing configuration', { configPath, changes: changes.length });
    }

    return { applied: !options.dryRun, changes };
  }

  /**
   * Generate human-readable report of the recommendation
   */
  generateReport(recommendation: RoutingRecommendation): string {
    const lines: string[] = [];

    // Header
    lines.push('Detected Providers:');

    // List all capabilities (available and unavailable)
    for (const [name, cap] of this.capabilities) {
      const status = cap.available ? '✓' : '✗';
      const mode = cap.executionMode === 'cli' ? 'CLI' : cap.executionMode === 'sdk' ? 'SDK' : 'Hybrid';
      let details = `${mode} mode`;

      if (cap.available) {
        if (cap.version) {
          details += `, ${cap.version}`;
        }
        if (cap.freeTier) {
          details += cap.freeTierLimit
            ? `, ${cap.freeTierLimit} req/day free`
            : ', free tier';
        }
      } else {
        if (cap.executionMode === 'sdk') {
          const keys = PROVIDER_API_KEYS[name];
          details += keys ? `, needs ${keys[0]}` : ', API key not set';
        } else {
          details += ', not installed';
        }
      }

      lines.push(`  ${status} ${ProviderDetector.formatProviderName(name)} - ${details}`);
    }

    lines.push('');

    // Priority order
    if (Object.keys(recommendation.providers).length > 0) {
      lines.push('Routing Priority:');
      const sorted = Object.entries(recommendation.providers)
        .sort(([, a], [, b]) => a.priority - b.priority);

      for (const [name, config] of sorted) {
        const cap = this.capabilities.get(name);
        const note = cap?.freeTier ? ' (free tier)' : '';
        lines.push(`  ${config.priority}. ${name}${note}`);
      }

      lines.push('');
    }

    // Agent affinities (show a few examples)
    if (Object.keys(recommendation.agentAffinities).length > 0) {
      lines.push('Agent Affinities (sample):');
      const sampleAgents = ['backend', 'frontend', 'quality', 'security', 'product'];
      for (const agent of sampleAgents) {
        const affinity = recommendation.agentAffinities[agent];
        if (affinity?.primary) {
          const fallbackStr = affinity.fallback.length > 0
            ? ` → [${affinity.fallback.slice(0, 2).join(', ')}${affinity.fallback.length > 2 ? ', ...' : ''}]`
            : '';
          lines.push(`  ${agent.padEnd(12)} → ${affinity.primary}${fallbackStr}`);
        }
      }

      lines.push('');
    }

    // Rationale
    if (recommendation.rationale.length > 0) {
      lines.push('Rationale:');
      for (const line of recommendation.rationale) {
        lines.push(`  ${line}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get capabilities map (for testing/inspection)
   */
  getCapabilities(): Map<string, ProviderCapability> {
    return this.capabilities;
  }
}
