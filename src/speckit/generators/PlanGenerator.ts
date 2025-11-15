/**
 * PlanGenerator - Workflow Execution Plan Generator
 *
 * Week 3-4 Implementation - Day 2
 * Generates detailed execution plans from workflow definitions with
 * cost estimates, resource requirements, and risk assessments
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type {
  PlanOptions,
  WorkflowDefinition,
  ExecutionPlan,
  ExecutionPhase,
  ResourceRequirements,
  RiskAssessment,
} from '../types/speckit.types.js';
import { DependencyGraph } from '../utils/DependencyGraph.js';
import { CostEstimator } from '../utils/CostEstimator.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';

/**
 * PlanGenerator analyzes workflow definitions and generates
 * comprehensive execution plans with phases, costs, and risks
 */
export class PlanGenerator {
  private readonly VERSION = '1.0.0';
  private costEstimator: CostEstimator;
  private workflowParser: WorkflowParser;

  constructor(workflowParser: WorkflowParser) {
    this.costEstimator = new CostEstimator();
    this.workflowParser = workflowParser;
  }

  /**
   * Generate execution plan from workflow definition
   */
  async generatePlan(
    workflow: WorkflowDefinition,
    options: PlanOptions = {}
  ): Promise<ExecutionPlan> {
    if (options.verbose) {
      console.log(chalk.cyan('\n📊 Analyzing workflow...'));
    }

    // Basic validation
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        }
      }
    }

    // Build dependency graph
    const graph = new DependencyGraph(workflow);

    if (options.verbose) {
      console.log(chalk.gray(`   Steps: ${workflow.steps.length}`));
      console.log(chalk.gray(`   Dependencies: ${graph.getEdges().length}`));
    }

    // Check for cycles
    if (graph.hasCycles()) {
      const cycles = graph.detectCycles();
      throw new Error(
        `Workflow contains circular dependencies: ${cycles.map(c => c.join(' → ')).join('; ')}`
      );
    }

    if (options.verbose) {
      console.log(chalk.cyan('\n📈 Generating execution phases...'));
    }

    // Generate execution phases
    const phases = this.generatePhases(workflow, graph, options);

    if (options.verbose) {
      console.log(chalk.gray(`   Phases: ${phases.length}`));
    }

    // Calculate critical path
    const criticalPath = graph.getCriticalPath();

    if (options.verbose) {
      console.log(chalk.cyan('\n💰 Estimating costs...'));
    }

    // Estimate costs
    let totalCost = 0;
    let costEstimate = null;

    if (options.includeCost !== false) {
      if (options.optimize === 'cost') {
        const { estimate } = this.costEstimator.getCheapestProvider(workflow);
        costEstimate = estimate;
      } else if (options.optimize === 'speed') {
        const { estimate } = this.costEstimator.getFastestProvider(workflow);
        costEstimate = estimate;
      } else {
        // Balanced
        const { estimate } = this.costEstimator.getBalancedProvider(workflow);
        costEstimate = estimate;
      }

      totalCost = costEstimate.cost;

      if (options.verbose) {
        console.log(chalk.gray(`   Provider: ${costEstimate.provider}`));
        console.log(chalk.gray(`   Model: ${costEstimate.model}`));
        console.log(chalk.gray(`   Estimated cost: ${this.costEstimator.formatCost(totalCost)}`));
      }
    }

    if (options.verbose) {
      console.log(chalk.cyan('\n📦 Calculating resource requirements...'));
    }

    // Calculate resource requirements
    const resources = this.calculateResourceRequirements(workflow, graph, costEstimate);

    if (options.verbose) {
      console.log(chalk.gray(`   API calls: ${resources.apiCalls}`));
      console.log(chalk.gray(`   Tokens: ${this.costEstimator.formatTokens(resources.tokens)}`));
    }

    if (options.verbose) {
      console.log(chalk.cyan('\n⚠️  Assessing risks...'));
    }

    // Assess risks
    const risks = this.assessRisks(workflow, graph, phases);

    if (options.verbose) {
      const highRisks = risks.filter(r => r.level === 'high').length;
      console.log(chalk.gray(`   High risks: ${highRisks}`));
      console.log(chalk.gray(`   Total risks: ${risks.length}`));
    }

    // Calculate total duration
    const totalDuration = graph.getCriticalPathDuration();

    // Generate summary
    const summary = this.generateSummary(workflow, phases, totalDuration, totalCost);

    const plan: ExecutionPlan = {
      summary,
      totalDuration,
      totalCost,
      phases,
      criticalPath,
      resources,
      risks,
    };

    return plan;
  }

  /**
   * Generate execution phases from workflow
   */
  private generatePhases(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    options: PlanOptions
  ): ExecutionPhase[] {
    const levels = graph.getExecutionLevels();
    const phases: ExecutionPhase[] = [];

    for (let i = 0; i < levels.length; i++) {
      const stepIds = levels[i];

      if (stepIds.length === 0) {
        continue;
      }

      // Calculate phase duration (max duration in the level)
      const phaseDuration = Math.max(
        ...stepIds.map(id => {
          const node = graph.getNode(id);
          return node?.duration || 30000;
        })
      );

      // Calculate phase cost
      let phaseCost = 0;
      if (options.includeCost !== false) {
        const phaseSteps = stepIds.map(id =>
          workflow.steps.find(s => s.id === id)!
        );

        for (const step of phaseSteps) {
          const stepCostEstimate = this.costEstimator.estimateStepCost(step);
          phaseCost += stepCostEstimate.cost;
        }
      }

      // Determine if phase can be parallelized
      const parallelizable = stepIds.length > 1;

      // Generate phase description
      const phaseSteps = stepIds.map(id => workflow.steps.find(s => s.id === id)!);
      const description = this.generatePhaseDescription(phaseSteps, parallelizable);

      const phase: ExecutionPhase = {
        id: `phase-${i + 1}`,
        name: `Phase ${i + 1}`,
        description,
        steps: stepIds,
        duration: phaseDuration,
        cost: phaseCost,
        parallelizable,
      };

      phases.push(phase);
    }

    return phases;
  }

  /**
   * Generate phase description
   */
  private generatePhaseDescription(
    steps: any[],
    parallelizable: boolean
  ): string {
    if (steps.length === 1) {
      return `Execute: ${steps[0].name}`;
    }

    const stepNames = steps.map(s => s.name).join(', ');

    if (parallelizable) {
      return `Execute in parallel: ${stepNames}`;
    } else {
      return `Execute sequentially: ${stepNames}`;
    }
  }

  /**
   * Calculate resource requirements
   */
  private calculateResourceRequirements(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    costEstimate: any
  ): ResourceRequirements {
    // Count API calls (one per step)
    const apiCalls = workflow.steps.length;

    // Estimate tokens
    const tokens = costEstimate?.totalTokens || 0;

    // Get required agents
    const agents = Array.from(
      new Set(workflow.steps.map(s => s.agent))
    );

    // Calculate max concurrency
    const parallelizable = graph.getParallelizableNodes();
    const maxConcurrency = Math.max(
      ...Array.from(parallelizable.values()).map(nodes => nodes.length),
      1
    );

    return {
      apiCalls,
      tokens,
      agents,
      maxConcurrency,
    };
  }

  /**
   * Assess workflow execution risks
   */
  private assessRisks(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    phases: ExecutionPhase[]
  ): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Risk: Long critical path
    const criticalPathDuration = graph.getCriticalPathDuration();
    if (criticalPathDuration > 300000) {
      // > 5 minutes
      risks.push({
        level: 'high',
        category: 'Performance',
        description: 'Critical path duration exceeds 5 minutes',
        mitigation: 'Consider breaking down long-running steps or increasing parallelism',
        impact: 'Workflow execution may take longer than expected',
      });
    } else if (criticalPathDuration > 120000) {
      // > 2 minutes
      risks.push({
        level: 'medium',
        category: 'Performance',
        description: 'Critical path duration exceeds 2 minutes',
        mitigation: 'Monitor execution time and optimize if needed',
        impact: 'Users may experience delays',
      });
    }

    // Risk: High dependency count
    const maxDeps = Math.max(
      ...workflow.steps.map(s => s.dependsOn?.length || 0)
    );

    if (maxDeps > 5) {
      risks.push({
        level: 'high',
        category: 'Complexity',
        description: `Some steps have ${maxDeps} dependencies`,
        mitigation: 'Review dependency structure and simplify if possible',
        impact: 'Complex dependencies increase failure risk',
      });
    } else if (maxDeps > 3) {
      risks.push({
        level: 'medium',
        category: 'Complexity',
        description: `Some steps have ${maxDeps} dependencies`,
        mitigation: 'Monitor for dependency-related issues',
        impact: 'Moderate complexity may affect maintainability',
      });
    }

    // Risk: No retry configuration
    const stepsWithoutRetry = workflow.steps.filter(
      s => !s.retryConfig || s.retryConfig.maxRetries === 0
    );

    if (stepsWithoutRetry.length > 0) {
      risks.push({
        level: 'medium',
        category: 'Reliability',
        description: `${stepsWithoutRetry.length} steps have no retry configuration`,
        mitigation: 'Add retry configuration to critical steps',
        impact: 'Temporary failures may cause workflow to fail',
      });
    }

    // Risk: Large number of steps
    if (workflow.steps.length > 20) {
      risks.push({
        level: 'medium',
        category: 'Complexity',
        description: `Workflow has ${workflow.steps.length} steps`,
        mitigation: 'Consider splitting into smaller workflows',
        impact: 'Large workflows are harder to debug and maintain',
      });
    }

    // Risk: Low parallelism
    const parallelPhases = phases.filter(p => p.parallelizable).length;
    const parallelismRatio = parallelPhases / phases.length;

    if (parallelismRatio < 0.3) {
      risks.push({
        level: 'low',
        category: 'Performance',
        description: 'Low parallelization potential (<30%)',
        mitigation: 'Review dependencies to enable more parallel execution',
        impact: 'Workflow may take longer than necessary',
      });
    }

    // Risk: Missing timeouts
    const stepsWithoutTimeout = workflow.steps.filter(s => !s.timeout);

    if (stepsWithoutTimeout.length > 0) {
      risks.push({
        level: 'low',
        category: 'Reliability',
        description: `${stepsWithoutTimeout.length} steps have no timeout`,
        mitigation: 'Add timeout configuration to prevent hanging',
        impact: 'Steps may hang indefinitely on failure',
      });
    }

    return risks;
  }

  /**
   * Generate plan summary
   */
  private generateSummary(
    workflow: WorkflowDefinition,
    phases: ExecutionPhase[],
    totalDuration: number,
    totalCost: number
  ): string {
    const lines: string[] = [];

    lines.push(`Execution plan for: ${workflow.name}`);
    lines.push(`Version: ${workflow.version}`);
    lines.push('');
    lines.push(`Total steps: ${workflow.steps.length}`);
    lines.push(`Execution phases: ${phases.length}`);
    lines.push(`Estimated duration: ${this.formatDuration(totalDuration)}`);

    if (totalCost > 0) {
      lines.push(`Estimated cost: ${this.costEstimator.formatCost(totalCost)}`);
    }

    lines.push('');
    lines.push('The workflow will execute in phases:');

    for (const phase of phases) {
      lines.push(`  ${phase.name}: ${phase.description}`);
    }

    return lines.join('\n');
  }

  /**
   * Write plan to file
   */
  async writePlan(
    plan: ExecutionPlan,
    workflow: WorkflowDefinition,
    options: PlanOptions
  ): Promise<string> {
    const outputDir = options.outputPath || 'plans';
    const fileName = this.sanitizeFileName(workflow.name) + '-plan.md';
    const outputPath = path.join(outputDir, fileName);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate markdown content
    const content = this.generateMarkdown(plan, workflow, options);

    // Write file
    await fs.writeFile(outputPath, content, 'utf-8');

    return outputPath;
  }

  /**
   * Generate markdown documentation for the plan
   */
  private generateMarkdown(
    plan: ExecutionPlan,
    workflow: WorkflowDefinition,
    options: PlanOptions
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Execution Plan: ${workflow.name}`);
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Generator:** PlanGenerator v${this.VERSION}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(plan.summary);
    lines.push('');

    // Phases
    lines.push('## Execution Phases');
    lines.push('');

    for (const phase of plan.phases) {
      lines.push(`### ${phase.name}`);
      lines.push('');
      lines.push(`**Description:** ${phase.description}`);
      lines.push(`**Duration:** ${this.formatDuration(phase.duration)}`);

      if (options.includeCost !== false && phase.cost > 0) {
        lines.push(`**Cost:** ${this.costEstimator.formatCost(phase.cost)}`);
      }

      lines.push(`**Parallelizable:** ${phase.parallelizable ? 'Yes' : 'No'}`);
      lines.push('');

      lines.push('**Steps:**');
      for (const stepId of phase.steps) {
        const step = workflow.steps.find(s => s.id === stepId);
        if (step) {
          lines.push(`- ${step.name} (${step.agent})`);
        }
      }
      lines.push('');
    }

    // Critical Path
    lines.push('## Critical Path');
    lines.push('');
    lines.push('The following steps form the critical path:');
    lines.push('');

    for (const stepId of plan.criticalPath) {
      const step = workflow.steps.find(s => s.id === stepId);
      if (step) {
        lines.push(`1. ${step.name}`);
      }
    }
    lines.push('');

    // Resource Requirements
    if (options.includeResources !== false) {
      lines.push('## Resource Requirements');
      lines.push('');
      lines.push(`**API Calls:** ${plan.resources.apiCalls}`);
      lines.push(`**Tokens:** ${this.costEstimator.formatTokens(plan.resources.tokens)}`);
      lines.push(`**Agents:** ${plan.resources.agents.join(', ')}`);
      lines.push(`**Max Concurrency:** ${plan.resources.maxConcurrency}`);
      lines.push('');
    }

    // Risk Assessment
    lines.push('## Risk Assessment');
    lines.push('');

    if (plan.risks.length === 0) {
      lines.push('No significant risks identified.');
    } else {
      for (const risk of plan.risks) {
        const emoji = risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢';
        lines.push(`### ${emoji} ${risk.category} - ${risk.level.toUpperCase()}`);
        lines.push('');
        lines.push(`**Description:** ${risk.description}`);
        lines.push(`**Mitigation:** ${risk.mitigation}`);
        lines.push(`**Impact:** ${risk.impact}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
