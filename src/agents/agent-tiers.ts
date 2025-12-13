/**
 * Agent Tiering System
 *
 * Defines agent tiers for improved discovery, routing, and user experience.
 * Core agents are prominently featured, specialty agents are opt-in.
 *
 * @since v12.9.0
 */

/**
 * Agent tier classification
 */
export type AgentTier = 'core' | 'extended' | 'specialty' | 'deprecated';

/**
 * Configuration for agent tier behavior
 */
export interface AgentTierConfig {
  /** Tier classification */
  tier: AgentTier;
  /** Whether agent is visible in default listings */
  visible: boolean;
  /** Routing weight multiplier (1.0 = full weight, 0.5 = half) */
  routingWeight: number;
  /** Whether agent requires explicit user selection (won't auto-route) */
  requiresExplicitSelection: boolean;
  /** Short description for listings */
  description: string;
  /** Example prompt for --examples flag */
  examplePrompt: string;
}

/**
 * Agent tier configuration map
 *
 * Defines tier, visibility, and routing behavior for all agents.
 */
export const AGENT_TIER_MAP: Record<string, AgentTierConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE AGENTS - Always visible, primary routing targets
  // ═══════════════════════════════════════════════════════════════════════════
  backend: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'API design, databases, server-side logic',
    examplePrompt: 'Design REST API for user authentication with JWT'
  },
  frontend: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'React components, UI/UX, accessibility',
    examplePrompt: 'Build responsive dashboard component with data grid'
  },
  quality: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'Testing, QA automation, code review',
    examplePrompt: 'Write unit tests for the payment module'
  },
  architecture: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'System design, scalability, technical decisions',
    examplePrompt: 'Design microservices architecture for order system'
  },
  security: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'Security audits, vulnerability assessment, auth',
    examplePrompt: 'Audit this code for OWASP Top 10 vulnerabilities'
  },
  devops: {
    tier: 'core',
    visible: true,
    routingWeight: 1.0,
    requiresExplicitSelection: false,
    description: 'CI/CD pipelines, Docker, infrastructure',
    examplePrompt: 'Create GitHub Actions workflow for deployment'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENDED AGENTS - Visible, specialized workflows
  // ═══════════════════════════════════════════════════════════════════════════
  data: {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Data pipelines, ETL, analytics',
    examplePrompt: 'Build ETL pipeline for user analytics data'
  },
  product: {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Requirements, user stories, acceptance criteria',
    examplePrompt: 'Write user stories for checkout flow feature'
  },
  writer: {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Technical documentation, API docs, guides',
    examplePrompt: 'Write API documentation for the auth endpoints'
  },
  design: {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'UX/UI design, wireframes, design systems',
    examplePrompt: 'Design user flow for onboarding experience'
  },

  // v12.9.0: Moved from specialty to extended (commonly used)
  'data-scientist': {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Machine learning, statistical modeling, ML pipelines',
    examplePrompt: 'Build classification model for churn prediction'
  },
  // v12.9.0: Moved from specialty to extended (commonly used)
  mobile: {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'iOS/Android development, React Native, Flutter',
    examplePrompt: 'Build cross-platform auth screen with biometrics'
  },
  // v12.9.0: Moved from specialty to extended (commonly used)
  'quantum-engineer': {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Quantum algorithms, Qiskit/Cirq, hybrid workflows',
    examplePrompt: 'Design VQE circuit for molecular simulation'
  },
  // v12.9.0: Moved from specialty to extended (commonly used)
  'aerospace-scientist': {
    tier: 'extended',
    visible: true,
    routingWeight: 0.8,
    requiresExplicitSelection: false,
    description: 'Mission planning, orbital mechanics, telemetry',
    examplePrompt: 'Calculate orbital transfer trajectory'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALTY AGENTS - Hidden by default, require explicit selection
  // ═══════════════════════════════════════════════════════════════════════════
  'creative-marketer': {
    tier: 'specialty',
    visible: false,
    routingWeight: 0.5,
    requiresExplicitSelection: true,
    description: 'Marketing campaigns, GenAI content, SEO',
    examplePrompt: 'Create Imagen prompts for product campaign'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPRECATED AGENTS - Not visible, no auto-routing
  // ═══════════════════════════════════════════════════════════════════════════
  ceo: {
    tier: 'deprecated',
    visible: false,
    routingWeight: 0,
    requiresExplicitSelection: true,
    description: '[Deprecated] Use product or architecture instead',
    examplePrompt: ''
  },
  cto: {
    tier: 'deprecated',
    visible: false,
    routingWeight: 0,
    requiresExplicitSelection: true,
    description: '[Deprecated] Use architecture instead',
    examplePrompt: ''
  },
  fullstack: {
    tier: 'deprecated',
    visible: false,
    routingWeight: 0,
    requiresExplicitSelection: true,
    description: '[Deprecated] Use backend + frontend instead',
    examplePrompt: ''
  },
  researcher: {
    tier: 'deprecated',
    visible: false,
    routingWeight: 0,
    requiresExplicitSelection: true,
    description: '[Deprecated] Use standard instead',
    examplePrompt: ''
  },
  standard: {
    tier: 'core',
    visible: false, // Internal fallback, not user-facing
    routingWeight: 0.3,
    requiresExplicitSelection: false,
    description: 'General-purpose assistant (fallback)',
    examplePrompt: 'Help me with this coding task'
  }
};

/**
 * Get tier configuration for an agent
 */
export function getAgentTierConfig(agentName: string): AgentTierConfig | undefined {
  return AGENT_TIER_MAP[agentName];
}

/**
 * Get all agents in a specific tier
 */
export function getAgentsByTier(tier: AgentTier): string[] {
  return Object.entries(AGENT_TIER_MAP)
    .filter(([_, config]) => config.tier === tier)
    .map(([name]) => name);
}

/**
 * Get all visible agents (for default listings)
 */
export function getVisibleAgents(): string[] {
  return Object.entries(AGENT_TIER_MAP)
    .filter(([_, config]) => config.visible)
    .map(([name]) => name);
}

/**
 * Get all agents including hidden (for --all flag)
 */
export function getAllAgents(): string[] {
  return Object.keys(AGENT_TIER_MAP);
}

/**
 * Check if agent should be auto-routed
 *
 * Custom agents (not in tier map) default to auto-routable
 * to ensure user-created agents work with auto-selection.
 */
export function canAutoRoute(agentName: string): boolean {
  const config = AGENT_TIER_MAP[agentName];
  // Custom agents (not in map) default to auto-routable
  if (!config) return true;
  return !config.requiresExplicitSelection && config.routingWeight > 0;
}

/**
 * Default routing weight for custom agents (same as extended tier)
 */
const DEFAULT_CUSTOM_AGENT_WEIGHT = 0.8;

/**
 * Get routing weight for an agent
 *
 * Custom agents (not in tier map) default to 0.8 (extended tier weight)
 * to ensure fair competition with built-in agents.
 */
export function getRoutingWeight(agentName: string): number {
  return AGENT_TIER_MAP[agentName]?.routingWeight ?? DEFAULT_CUSTOM_AGENT_WEIGHT;
}

/**
 * Check if agent is deprecated
 */
export function isDeprecatedAgent(agentName: string): boolean {
  return AGENT_TIER_MAP[agentName]?.tier === 'deprecated';
}

/**
 * Get deprecation message for an agent
 */
export function getDeprecationMessage(agentName: string): string | null {
  const config = AGENT_TIER_MAP[agentName];
  if (!config || config.tier !== 'deprecated') return null;

  const replacements: Record<string, string> = {
    ceo: 'product or architecture',
    cto: 'architecture',
    fullstack: 'backend + frontend',
    researcher: 'standard'
  };

  return `Agent '${agentName}' is deprecated. Use ${replacements[agentName] ?? 'another agent'} instead.`;
}
