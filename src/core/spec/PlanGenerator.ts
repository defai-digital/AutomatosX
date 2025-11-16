/**
 * Plan Generator
 *
 * Generates human-readable execution plans from YAML specs.
 * Includes cost/latency projections, resource estimates, and risk analysis.
 *
 * @module core/spec/PlanGenerator
 */

import type { SpecYAML } from '@/types/spec-yaml.js';
import type { ProviderMetadataRegistry } from '@/types/provider-metadata.js';
// TODO v8.3.0: Provider metadata removed - stubbed for Phase 1
const PROVIDER_METADATA: any = {};
import { logger } from '@/utils/logger.js';
import { PRECOMPILED_CONFIG } from '@/config.generated.js';

/**
 * Execution phase in the plan
 */
export interface ExecutionPhase {
  phase: number;
  name: string;
  actors: string[];
  tasks: string[];
  estimatedDuration: string;
  dependencies: string[];
  parallelizable: boolean;
}

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  memory: string;
  cpu: string;
  storage: string;
  network: string;
}

/**
 * Risk identification
 */
export interface Risk {
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  mitigation: string;
}

/**
 * Complete execution plan
 */
export interface ExecutionPlan {
  overview: {
    specId: string;
    specName: string;
    actorCount: number;
    phaseCount: number;
    estimatedDuration: string;
    estimatedCost: {
      min: number;
      max: number;
      currency: string;
    };
  };
  phases: ExecutionPhase[];
  resourceRequirements: ResourceRequirements;
  risks: Risk[];
  recommendations: string[];
}

/**
 * Plan generator for YAML specs
 */
export class PlanGenerator {
  constructor(private metadataRegistry: ProviderMetadataRegistry = PROVIDER_METADATA) {}

  /**
   * Generate execution plan from spec
   */
  generate(spec: SpecYAML): ExecutionPlan {
    // FIXED: Validate spec.actors exists before accessing
    if (!spec.actors || !Array.isArray(spec.actors) || spec.actors.length === 0) {
      throw new Error('Spec must have at least one actor');
    }

    // FIXED (Bug #13): Validate spec.metadata exists and has required fields
    if (!spec.metadata || typeof spec.metadata !== 'object') {
      throw new Error('Spec must have metadata object');
    }
    if (!spec.metadata.id || typeof spec.metadata.id !== 'string') {
      throw new Error('Spec metadata must have id field (string)');
    }
    if (!spec.metadata.name || typeof spec.metadata.name !== 'string') {
      throw new Error('Spec metadata must have name field (string)');
    }

    const phases = this.identifyPhases(spec);
    const resources = this.estimateResources(spec);
    const costs = this.estimateCosts(spec);
    const risks = this.identifyRisks(spec);
    const recommendations = this.generateRecommendations(spec);

    logger.debug('Execution plan generated', {
      specId: spec.metadata.id,
      phases: phases.length,
      estimatedCost: `$${costs.min.toFixed(2)}-$${costs.max.toFixed(2)}`
    });

    return {
      overview: {
        specId: spec.metadata.id,
        specName: spec.metadata.name,
        actorCount: spec.actors.length,
        phaseCount: phases.length,
        estimatedDuration: this.calculateTotalDuration(phases),
        estimatedCost: {
          min: costs.min,
          max: costs.max,
          currency: 'USD'
        }
      },
      phases,
      resourceRequirements: resources,
      risks,
      recommendations
    };
  }

  /**
   * Identify execution phases
   * For now, creates one phase per actor (can be enhanced with dependency analysis)
   */
  private identifyPhases(spec: SpecYAML): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];

    // Group actors into phases
    // Simple approach: one phase per actor (can be parallelized if independent)
    for (let i = 0; i < spec.actors.length; i++) {
      const actor = spec.actors[i];
      if (!actor) continue; // Skip undefined entries (should never happen)

      // FIXED (Bug #14): Validate actor properties before accessing
      if (!actor.id || typeof actor.id !== 'string') {
        throw new Error(`Actor at index ${i} must have id field (string)`);
      }
      if (!actor.agent || typeof actor.agent !== 'string') {
        throw new Error(`Actor "${actor.id}" must have agent field (string)`);
      }

      phases.push({
        phase: i + 1,
        name: `Execute ${actor.id}`,
        actors: [actor.agent],
        tasks: [actor.description || `Execute ${actor.id} task`],
        estimatedDuration: this.estimateActorDuration(actor),
        dependencies: [], // Would come from dependency analysis
        parallelizable: spec.actors.length > 1  // Multiple actors can run in parallel
      });
    }

    return phases;
  }

  /**
   * Estimate duration for an actor
   */
  private estimateActorDuration(actor: any): string {
    const timeout = actor.timeout || 300000;  // Default 5 minutes

    // Estimate as 50% of timeout (pessimistic but realistic)
    const estimatedMs = timeout * 0.5;

    return this.formatDuration(estimatedMs);
  }

  /**
   * Calculate total duration for all phases
   */
  private calculateTotalDuration(phases: ExecutionPhase[]): string {
    if (phases.length === 0) return '0s';

    // If all phases are parallelizable, use max duration
    // Otherwise, sum durations
    const allParallelizable = phases.every(p => p.parallelizable);

    if (allParallelizable && phases.length > 1) {
      // Max duration
      const durations = phases.map(p => this.parseDuration(p.estimatedDuration));
      const maxDuration = Math.max(...durations);
      return this.formatDuration(maxDuration);
    } else {
      // Sum durations
      const totalMs = phases.reduce((sum, p) => sum + this.parseDuration(p.estimatedDuration), 0);
      return this.formatDuration(totalMs);
    }
  }

  /**
   * Estimate resource requirements
   */
  private estimateResources(spec: SpecYAML): ResourceRequirements {
    let totalMemoryMb = 0;
    let totalCpuCores = 0;

    for (const actor of spec.actors) {
      // FIXED (Bug #16): Validate memory limit is a string before parsing
      if (actor.resources?.memory?.limit) {
        const memLimit = actor.resources.memory.limit;
        if (typeof memLimit !== 'string') {
          throw new Error(`Actor "${actor.id}" memory limit must be a string (e.g., "512MB"), got ${typeof memLimit}`);
        }
        totalMemoryMb += this.parseMemoryLimit(memLimit);
      } else {
        totalMemoryMb += 512;  // Default 512MB
      }

      // FIXED (Bug #15): Validate CPU limit is a number
      if (actor.resources?.cpu?.limit) {
        const cpuLimit = actor.resources.cpu.limit;
        if (typeof cpuLimit !== 'number' || !Number.isFinite(cpuLimit) || cpuLimit < 0) {
          throw new Error(`Actor "${actor.id}" CPU limit must be a non-negative finite number, got ${typeof cpuLimit === 'number' ? cpuLimit : typeof cpuLimit}`);
        }
        totalCpuCores += cpuLimit;
      } else {
        totalCpuCores += 1;  // Default 1 core
      }
    }

    return {
      memory: `${totalMemoryMb}MB`,
      cpu: `${totalCpuCores.toFixed(1)} cores`,
      storage: '1GB',  // Conservative estimate
      network: spec.actors.some(a => a.permissions?.network?.enabled) ? 'Required' : 'Not required'
    };
  }

  /**
   * Estimate costs
   */
  private estimateCosts(spec: SpecYAML): { min: number; max: number } {
    // Check if cost estimation is disabled
    const costEstimationEnabled = PRECOMPILED_CONFIG.costEstimation?.enabled ?? false;

    if (!costEstimationEnabled) {
      logger.debug('Cost estimation disabled, returning $0');
      return { min: 0, max: 0 };
    }

    // Determine provider from spec or use default
    let providerName = spec.providers?.primary?.name || 'gemini-cli';  // Default to cheapest

    // FIXED (Bug #17): Validate provider name is a string before using as object key
    if (typeof providerName !== 'string' || providerName.trim().length === 0) {
      logger.warn('Invalid provider name for cost estimation, using default', {
        invalidProvider: providerName,
        typeReceived: typeof providerName
      });
      providerName = 'gemini-cli';  // Fallback to default
    }

    const provider = this.metadataRegistry[providerName];

    if (!provider) {
      logger.warn('Provider not found in metadata registry for cost estimation', {
        provider: providerName,
        availableProviders: Object.keys(this.metadataRegistry)
      });
      return { min: 0, max: 0 };
    }

    // Estimate tokens per actor (rough approximation)
    const inputTokensPerActor = 2000;   // ~500 words input
    const outputTokensPerActor = 1000;  // ~250 words output

    // FIXED (v6.5.11): costPerToken values are stored as "per 1K tokens" despite field name
    // Need to divide by 1000 to convert to per-token cost, then multiply by token count
    // OR equivalently: divide token count by 1000 before multiplying
    const costPerActor =
      (inputTokensPerActor / 1000) * provider.costPerToken.input +
      (outputTokensPerActor / 1000) * provider.costPerToken.output;

    const totalCost = costPerActor * spec.actors.length;

    // Min = 80% of estimate, Max = 120% of estimate (uncertainty range)
    return {
      min: totalCost * 0.8,
      max: totalCost * 1.2
    };
  }

  /**
   * Identify risks
   */
  private identifyRisks(spec: SpecYAML): Risk[] {
    const risks: Risk[] = [];

    // Check for missing budget
    if (!spec.providers?.primary?.budget) {
      risks.push({
        severity: 'medium',
        title: 'No budget limits configured',
        description: 'Spec does not define budget limits, which could lead to unexpected costs.',
        mitigation: 'Add budget limits in providers.primary.budget section'
      });
    }

    // Check for network access without whitelist
    for (const actor of spec.actors) {
      if (actor.permissions?.network?.enabled && !actor.permissions.network.whitelist) {
        risks.push({
          severity: 'high',
          title: `Actor "${actor.id}" has unrestricted network access`,
          description: 'Network access is enabled without a whitelist, which is a security risk.',
          mitigation: 'Add network.whitelist with specific domains'
        });
      }
    }

    // Check for missing observability
    if (!spec.observability?.audit?.enabled) {
      risks.push({
        severity: 'low',
        title: 'Audit logging not enabled',
        description: 'Without audit logging, it will be difficult to debug issues or track compliance.',
        mitigation: 'Enable observability.audit in spec'
      });
    }

    // Check for high resource requirements
    const totalMemory = spec.actors.reduce((sum, a) => {
      const limit = a.resources?.memory?.limit;
      return sum + (limit ? this.parseMemoryLimit(limit) : 512);
    }, 0);

    if (totalMemory > 8192) {  // > 8GB
      risks.push({
        severity: 'medium',
        title: 'High memory requirements',
        description: `Total memory requirement is ${totalMemory}MB, which may not be available on all systems.`,
        mitigation: 'Review resource limits or split workload across multiple executions'
      });
    }

    return risks;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(spec: SpecYAML): string[] {
    const recommendations: string[] = [];

    // Recommend parallel execution if multiple actors
    if (spec.actors.length > 1) {
      recommendations.push('Enable parallel execution to reduce total duration');
    }

    // Recommend cost optimization if using expensive provider (only if cost estimation enabled)
    const costEstimationEnabled = PRECOMPILED_CONFIG.costEstimation?.enabled ?? false;

    if (costEstimationEnabled) {
      const providerName = spec.providers?.primary?.name;
      if (providerName === 'claude-code' || providerName === 'openai') {
        recommendations.push('Consider using gemini-cli for cost savings (5-10x cheaper)');
      }
    }

    // Recommend observability if not configured
    if (!spec.observability) {
      recommendations.push('Add observability configuration for production deployments');
    }

    // Recommend tests
    recommendations.push('Generate tests with: ax gen tests <spec-file>');

    return recommendations;
  }

  /**
   * Export plan as markdown
   */
  exportMarkdown(plan: ExecutionPlan): string {
    const sections: string[] = [];

    // Title
    sections.push(`# Execution Plan: ${plan.overview.specName}\n`);

    // Overview
    sections.push('## Overview\n');
    sections.push(`- **Spec ID**: ${plan.overview.specId}`);
    sections.push(`- **Actors**: ${plan.overview.actorCount}`);
    sections.push(`- **Phases**: ${plan.overview.phaseCount}`);
    sections.push(`- **Estimated Duration**: ${plan.overview.estimatedDuration}`);

    // Show cost estimate or "disabled" message
    const isCostEstimationDisabled = plan.overview.estimatedCost.min === 0 && plan.overview.estimatedCost.max === 0;
    if (isCostEstimationDisabled) {
      sections.push(`- **Estimated Cost**: N/A (cost estimation disabled)\n`);
    } else {
      sections.push(`- **Estimated Cost**: $${plan.overview.estimatedCost.min.toFixed(2)} - $${plan.overview.estimatedCost.max.toFixed(2)} ${plan.overview.estimatedCost.currency}\n`);
    }

    // Phases
    sections.push('## Execution Phases\n');
    for (const phase of plan.phases) {
      sections.push(`### Phase ${phase.phase}: ${phase.name}\n`);
      sections.push(`- **Actors**: ${phase.actors.join(', ')}`);
      sections.push(`- **Duration**: ${phase.estimatedDuration}`);
      sections.push(`- **Parallelizable**: ${phase.parallelizable ? '✓ Yes' : '✗ No'}`);

      if (phase.dependencies.length > 0) {
        sections.push(`- **Dependencies**: ${phase.dependencies.join(', ')}`);
      }

      sections.push('\n**Tasks**:');
      for (const task of phase.tasks) {
        sections.push(`- ${task}`);
      }
      sections.push('');
    }

    // Resources
    sections.push('## Resource Requirements\n');
    sections.push(`- **Memory**: ${plan.resourceRequirements.memory}`);
    sections.push(`- **CPU**: ${plan.resourceRequirements.cpu}`);
    sections.push(`- **Storage**: ${plan.resourceRequirements.storage}`);
    sections.push(`- **Network**: ${plan.resourceRequirements.network}\n`);

    // Risks
    if (plan.risks.length > 0) {
      sections.push('## Identified Risks\n');
      for (const risk of plan.risks) {
        const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
        sections.push(`### ${icon} ${risk.severity.toUpperCase()}: ${risk.title}\n`);
        sections.push(`**Description**: ${risk.description}\n`);
        sections.push(`**Mitigation**: ${risk.mitigation}\n`);
      }
    }

    // Recommendations
    if (plan.recommendations.length > 0) {
      sections.push('## Recommendations\n');
      for (const rec of plan.recommendations) {
        sections.push(`- ${rec}`);
      }
      sections.push('');
    }

    // Footer
    sections.push('---');
    sections.push(`*Generated by AutomatosX on ${new Date().toISOString()}*`);

    return sections.join('\n');
  }

  /**
   * Helper: Format duration in milliseconds to human-readable
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Helper: Parse duration string to milliseconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^([\d.]+)([smh])$/);
    if (!match || !match[1] || !match[2]) return 0;

    const value = parseFloat(match[1]);
    // FIXED (v6.5.11): Validate parseFloat result to prevent NaN propagation
    if (isNaN(value) || value < 0) return 0;

    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60000;
      case 'h': return value * 3600000;
      default: return 0;
    }
  }

  /**
   * Helper: Parse memory limit to MB
   */
  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)(KB|MB|GB)$/i);
    if (!match || !match[1] || !match[2]) return 0;

    const value = parseInt(match[1], 10);
    // FIXED (v6.5.11): Validate parseInt result to prevent NaN propagation
    if (isNaN(value) || value < 0) return 0;

    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'KB': return value / 1024;
      case 'MB': return value;
      case 'GB': return value * 1024;
      default: return 0;
    }
  }
}

/**
 * Default singleton instance
 */
let defaultPlanGenerator: PlanGenerator | null = null;

/**
 * Get default plan generator instance (singleton)
 */
export function getDefaultPlanGenerator(): PlanGenerator {
  if (!defaultPlanGenerator) {
    defaultPlanGenerator = new PlanGenerator();
  }
  return defaultPlanGenerator;
}

/**
 * Convenience function: generate plan from spec
 */
export function generatePlan(spec: SpecYAML): ExecutionPlan {
  return getDefaultPlanGenerator().generate(spec);
}
