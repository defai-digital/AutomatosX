/**
 * Spec Explain Handler
 *
 * Generate human-readable analysis of YAML specs.
 * Includes overview, architecture, security, cost, performance, compliance.
 *
 * @module cli/commands/spec/explain
 */

import chalk from 'chalk';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { validateSpec } from '@/core/spec/SpecSchemaValidator.js';
import type { SpecYAML } from '@/types/spec-yaml.js';
import { logger } from '@/shared/logging/logger.js';

export interface SpecExplainOptions {
  file: string;
  format?: 'markdown' | 'text' | 'json';
  sections?: string[];
}

/**
 * Handle 'ax spec explain' command
 */
export async function handleSpecExplain(
  workspacePath: string,
  options: SpecExplainOptions
): Promise<void> {
  console.log(chalk.blue.bold('\n📖 Spec-Kit: Explain Spec\n'));

  try {
    // Load spec file
    const specContent = readFileSync(options.file, 'utf-8');
    const spec = yaml.load(specContent) as SpecYAML;

    // Validate first
    const validation = validateSpec(spec);
    if (!validation.valid) {
      console.error(chalk.red('\n✗ Spec validation failed:\n'));
      validation.errors.forEach(err => {
        console.error(chalk.red(`  ✗ ${err.message}`));
      });
      throw new Error('Cannot explain invalid spec');
    }

    // Generate explanation
    const format = options.format || 'markdown';
    const sections = options.sections || [
      'overview',
      'architecture',
      'security',
      'cost',
      'performance',
      'compliance',
      'recommendations'
    ];

    const explanation = generateExplanation(spec, sections);

    // Output based on format
    if (format === 'json') {
      console.log(JSON.stringify(explanation, null, 2));
    } else if (format === 'text') {
      outputText(explanation);
    } else {
      outputMarkdown(explanation);
    }

    logger.info('Spec explained', {
      file: options.file,
      format,
      sections
    });
  } catch (error) {
    console.error(chalk.red(`\n✗ Failed to explain spec: ${(error as Error).message}\n`));
    logger.error('Spec explain failed', { error });
    throw error;
  }
}

/**
 * Generate explanation object
 */
function generateExplanation(spec: SpecYAML, sections: string[]): any {
  const explanation: any = {};

  if (sections.includes('overview')) {
    explanation.overview = analyzeOverview(spec);
  }

  if (sections.includes('architecture')) {
    explanation.architecture = analyzeArchitecture(spec);
  }

  if (sections.includes('security')) {
    explanation.security = analyzeSecurity(spec);
  }

  if (sections.includes('cost')) {
    explanation.cost = analyzeCost(spec);
  }

  if (sections.includes('performance')) {
    explanation.performance = analyzePerformance(spec);
  }

  if (sections.includes('compliance')) {
    explanation.compliance = analyzeCompliance(spec);
  }

  if (sections.includes('recommendations')) {
    explanation.recommendations = generateRecommendations(spec);
  }

  return explanation;
}

/**
 * Analyze overview
 */
function analyzeOverview(spec: SpecYAML): any {
  return {
    id: spec.metadata.id,
    name: spec.metadata.name,
    description: spec.metadata.description,
    version: spec.metadata.version || 'Not specified',
    author: spec.metadata.author || 'Not specified',
    tags: spec.metadata.tags || [],
    actorCount: spec.actors.length,
    primaryProvider: spec.providers?.primary?.name || 'System default',
    policyGoal: spec.policy?.goal || 'balanced'
  };
}

/**
 * Analyze architecture
 */
function analyzeArchitecture(spec: SpecYAML): any {
  const actors = spec.actors.map(actor => ({
    id: actor.id,
    agent: actor.agent,
    description: actor.description || 'No description',
    hasFileAccess: !!(actor.permissions?.filesystem),
    hasNetworkAccess: actor.permissions?.network?.enabled ?? false,
    hasEnvAccess: !!(actor.permissions?.environment),
    timeout: actor.timeout || 300000
  }));

  // Generate Mermaid diagram
  const mermaid = generateMermaidDiagram(spec);

  return {
    actors,
    diagram: mermaid,
    observabilityEnabled: !!(spec.observability),
    recoveryEnabled: !!(spec.recovery)
  };
}

/**
 * Generate Mermaid diagram
 */
function generateMermaidDiagram(spec: SpecYAML): string {
  const lines: string[] = [
    'graph TD',
    ''
  ];

  // Add actors
  spec.actors.forEach((actor, idx) => {
    const label = `${actor.id}\\n[${actor.agent}]`;
    lines.push(`  Actor${idx}["${label}"]`);
  });

  // Add provider connections
  if (spec.providers) {
    lines.push('');
    lines.push('  Provider["AI Provider"]');
    spec.actors.forEach((_, idx) => {
      lines.push(`  Actor${idx} --> Provider`);
    });
  }

  return lines.join('\n');
}

/**
 * Analyze security
 */
function analyzeSecurity(spec: SpecYAML): any {
  const findings: any[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  spec.actors.forEach((actor, idx) => {
    // Network access
    if (actor.permissions?.network?.enabled) {
      if (!actor.permissions.network.whitelist || actor.permissions.network.whitelist.length === 0) {
        findings.push({
          severity: 'high',
          actor: actor.id,
          issue: 'Network access enabled without whitelist',
          recommendation: 'Add network.whitelist with allowed domains'
        });
        riskLevel = 'high';
      }

      if (!actor.permissions.network.requireTls) {
        findings.push({
          severity: 'medium',
          actor: actor.id,
          issue: 'TLS not required for network connections',
          recommendation: 'Set network.requireTls: true'
        });
        if (riskLevel === 'low') riskLevel = 'medium';
      }
    }

    // Filesystem access
    if (actor.permissions?.filesystem) {
      const writePatterns = actor.permissions.filesystem.write || [];
      const dangerousPatterns = ['/**', '/*', '**/*'];

      if (writePatterns.some(p => dangerousPatterns.includes(p))) {
        findings.push({
          severity: 'high',
          actor: actor.id,
          issue: 'Overly broad filesystem write permissions',
          recommendation: 'Restrict write paths to specific directories'
        });
        riskLevel = 'high';
      }
    }

    // Environment variables
    if (actor.permissions?.environment?.read) {
      const sensitiveVars = ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE'];
      const hasAccess = actor.permissions.environment.read.some(v =>
        sensitiveVars.some(s => v.toUpperCase().includes(s))
      );

      if (hasAccess) {
        findings.push({
          severity: 'medium',
          actor: actor.id,
          issue: 'Access to potentially sensitive environment variables',
          recommendation: 'Review environment variable access list'
        });
        if (riskLevel === 'low') riskLevel = 'medium';
      }
    }
  });

  return {
    riskLevel,
    findings,
    auditEnabled: spec.observability?.audit?.enabled ?? false,
    strictMode: spec.validation?.strictMode ?? false
  };
}

/**
 * Analyze cost
 */
function analyzeCost(spec: SpecYAML): any {
  const primary = spec.providers?.primary;
  const budget = primary?.budget;

  if (!budget) {
    return {
      configured: false,
      message: 'No budget limits configured. Consider setting cost caps.'
    };
  }

  const utilizationWarning = budget.softCap && budget.hardCap
    ? (budget.softCap / budget.hardCap) < 0.5
      ? 'Soft cap is less than 50% of hard cap - may trigger warnings frequently'
      : null
    : null;

  return {
    configured: true,
    softCap: budget.softCap,
    hardCap: budget.hardCap,
    period: budget.period || 'Not specified',
    utilizationWarning,
    costOptimized: spec.policy?.goal === 'cost' || spec.policy?.optimization?.weights?.cost! > 0.5
  };
}

/**
 * Analyze performance
 */
function analyzePerformance(spec: SpecYAML): any {
  const constraints = spec.policy?.constraints?.latency;

  if (!constraints) {
    return {
      configured: false,
      message: 'No latency constraints configured'
    };
  }

  const assessment = {
    p50Target: constraints.p50,
    p95Target: constraints.p95,
    p99Target: constraints.p99,
    targetTier: categorizeLatency(constraints.p95)
  };

  return {
    configured: true,
    ...assessment,
    latencyOptimized: spec.policy?.goal === 'latency' || spec.policy?.optimization?.weights?.latency! > 0.5
  };
}

/**
 * Categorize latency target
 */
function categorizeLatency(p95: number | undefined): string {
  if (!p95) return 'Not specified';
  if (p95 < 1000) return 'Real-time (<1s)';
  if (p95 < 3000) return 'Interactive (<3s)';
  if (p95 < 10000) return 'Responsive (<10s)';
  return 'Batch (>10s)';
}

/**
 * Analyze compliance
 */
function analyzeCompliance(spec: SpecYAML): any {
  const checklist: any[] = [];

  // GDPR
  const gdprCompliant =
    spec.observability?.audit?.enabled &&
    spec.policy?.constraints?.privacy?.dataClassification !== 'public';

  checklist.push({
    standard: 'GDPR',
    status: gdprCompliant ? 'compliant' : 'needs-review',
    notes: gdprCompliant
      ? 'Audit logging enabled and data classification set'
      : 'Enable audit logging and set data classification'
  });

  // SOC2
  const soc2Compliant =
    spec.observability?.audit?.enabled &&
    spec.observability?.logs?.enabled &&
    spec.recovery?.retry;

  checklist.push({
    standard: 'SOC2',
    status: soc2Compliant ? 'compliant' : 'needs-review',
    notes: soc2Compliant
      ? 'Audit, logging, and recovery configured'
      : 'Configure observability and recovery'
  });

  // FISMA
  const fismaCompliant =
    spec.validation?.strictMode &&
    spec.policy?.constraints?.privacy?.dataClassification === 'phi';

  checklist.push({
    standard: 'FISMA',
    status: fismaCompliant ? 'compliant' : 'needs-review',
    notes: fismaCompliant
      ? 'Strict mode and PHI classification set'
      : 'Enable strict mode and set PHI classification'
  });

  return { checklist };
}

/**
 * Generate recommendations
 */
function generateRecommendations(spec: SpecYAML): string[] {
  const recommendations: string[] = [];

  if (!spec.providers) {
    recommendations.push('Add provider configuration to explicitly control AI provider selection');
  }

  if (!spec.policy) {
    recommendations.push('Add policy configuration to optimize routing (cost, latency, reliability)');
  }

  if (!spec.observability) {
    recommendations.push('Enable observability (metrics, logs, tracing) for production monitoring');
  }

  if (!spec.recovery) {
    recommendations.push('Configure recovery (retry, timeout, circuit breaker) for reliability');
  }

  if (spec.actors.some(a => !a.permissions)) {
    recommendations.push('Define explicit permissions for all actors to follow principle of least privilege');
  }

  if (spec.providers?.primary && !spec.providers.primary.budget) {
    recommendations.push('Set budget limits on primary provider to prevent cost overruns');
  }

  if (!spec.validation?.strictMode) {
    recommendations.push('Consider enabling strict validation mode for production deployments');
  }

  return recommendations;
}

/**
 * Output explanation as markdown
 */
function outputMarkdown(explanation: any): void {
  console.log('# Spec Explanation\n');

  if (explanation.overview) {
    console.log('## Overview\n');
    console.log(`- **ID**: ${explanation.overview.id}`);
    console.log(`- **Name**: ${explanation.overview.name}`);
    console.log(`- **Description**: ${explanation.overview.description}`);
    console.log(`- **Version**: ${explanation.overview.version}`);
    console.log(`- **Author**: ${explanation.overview.author}`);
    console.log(`- **Tags**: ${explanation.overview.tags.join(', ') || 'None'}`);
    console.log(`- **Actors**: ${explanation.overview.actorCount}`);
    console.log(`- **Provider**: ${explanation.overview.primaryProvider}`);
    console.log(`- **Policy Goal**: ${explanation.overview.policyGoal}\n`);
  }

  if (explanation.architecture) {
    console.log('## Architecture\n');
    console.log('### Actors\n');
    explanation.architecture.actors.forEach((actor: any) => {
      console.log(`#### ${actor.id} (${actor.agent})`);
      console.log(`- ${actor.description}`);
      console.log(`- File access: ${actor.hasFileAccess ? '✓' : '✗'}`);
      console.log(`- Network access: ${actor.hasNetworkAccess ? '✓' : '✗'}`);
      console.log(`- Environment access: ${actor.hasEnvAccess ? '✓' : '✗'}`);
      console.log(`- Timeout: ${actor.timeout}ms\n`);
    });

    console.log('### Dependency Diagram\n');
    console.log('```mermaid');
    console.log(explanation.architecture.diagram);
    console.log('```\n');
  }

  if (explanation.security) {
    console.log('## Security Analysis\n');
    console.log(`**Risk Level**: ${explanation.security.riskLevel.toUpperCase()}\n`);

    if (explanation.security.findings.length > 0) {
      console.log('### Findings\n');
      explanation.security.findings.forEach((finding: any) => {
        const icon = finding.severity === 'high' ? '🔴' : finding.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${icon} **${finding.severity.toUpperCase()}** - ${finding.actor}`);
        console.log(`   - Issue: ${finding.issue}`);
        console.log(`   - Recommendation: ${finding.recommendation}\n`);
      });
    } else {
      console.log('No security issues found.\n');
    }

    console.log(`- Audit logging: ${explanation.security.auditEnabled ? '✓ Enabled' : '✗ Disabled'}`);
    console.log(`- Strict mode: ${explanation.security.strictMode ? '✓ Enabled' : '✗ Disabled'}\n`);
  }

  if (explanation.cost) {
    console.log('## Cost Analysis\n');
    if (explanation.cost.configured) {
      console.log(`- Soft cap: $${explanation.cost.softCap || 'Not set'}`);
      console.log(`- Hard cap: $${explanation.cost.hardCap || 'Not set'}`);
      console.log(`- Period: ${explanation.cost.period}`);
      console.log(`- Cost optimized: ${explanation.cost.costOptimized ? '✓' : '✗'}`);
      if (explanation.cost.utilizationWarning) {
        console.log(`\n⚠️  ${explanation.cost.utilizationWarning}`);
      }
    } else {
      console.log(explanation.cost.message);
    }
    console.log();
  }

  if (explanation.performance) {
    console.log('## Performance Analysis\n');
    if (explanation.performance.configured) {
      console.log(`- P50 target: ${explanation.performance.p50Target}ms`);
      console.log(`- P95 target: ${explanation.performance.p95Target}ms`);
      console.log(`- P99 target: ${explanation.performance.p99Target}ms`);
      console.log(`- Target tier: ${explanation.performance.targetTier}`);
      console.log(`- Latency optimized: ${explanation.performance.latencyOptimized ? '✓' : '✗'}`);
    } else {
      console.log(explanation.performance.message);
    }
    console.log();
  }

  if (explanation.compliance) {
    console.log('## Compliance Checklist\n');
    explanation.compliance.checklist.forEach((item: any) => {
      const icon = item.status === 'compliant' ? '✓' : '⚠️';
      console.log(`${icon} **${item.standard}**: ${item.status}`);
      console.log(`   ${item.notes}\n`);
    });
  }

  if (explanation.recommendations) {
    console.log('## Recommendations\n');
    explanation.recommendations.forEach((rec: string, idx: number) => {
      console.log(`${idx + 1}. ${rec}`);
    });
    console.log();
  }
}

/**
 * Output explanation as plain text
 */
function outputText(explanation: any): void {
  // Similar to markdown but without formatting
  outputMarkdown(explanation);
}
