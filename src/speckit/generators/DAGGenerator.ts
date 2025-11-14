/**
 * DAG Generator
 *
 * Week 3-4 Implementation - Day 3
 * Generates dependency graph visualizations in multiple formats (ASCII, DOT, Mermaid)
 */

import { DependencyGraph } from '../utils/DependencyGraph.js';
import type { WorkflowDefinition, WorkflowStep, DAGFormat, DAGOptions } from '../types/speckit.types.js';

/**
 * DAG output result
 */
export interface DAGResult {
  format: DAGFormat;
  content: string;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    criticalPathLength: number;
    maxDepth: number;
  };
}

/**
 * DAGGenerator
 *
 * Generates dependency graph visualizations from workflow definitions
 *
 * Supports multiple output formats:
 * - ASCII: Terminal-friendly text visualization
 * - DOT: Graphviz format for rendering high-quality diagrams
 * - Mermaid: Markdown-compatible diagrams
 *
 * Features:
 * - Critical path highlighting
 * - Step details (duration, dependencies)
 * - Flexible node labeling
 * - Configurable orientation
 */
export class DAGGenerator {
  /**
   * Generate DAG visualization
   */
  async generate(workflow: WorkflowDefinition, options: DAGOptions = {}): Promise<DAGResult> {
    // Default options
    const format = options.format || 'ascii';
    const highlightCriticalPath = options.highlightCriticalPath !== false;
    const includeStepDetails = options.includeStepDetails !== false;
    const orientation = options.orientation || 'TB';
    const nodeLabels = options.nodeLabels || 'name';

    // Build dependency graph
    const graph = new DependencyGraph(workflow);

    // Get graph metadata
    const metadata = graph.getMetadata();
    const criticalPath = graph.getCriticalPath();

    // Generate content based on format
    let content: string;
    switch (format) {
      case 'ascii':
        content = this.generateASCII(workflow, graph, criticalPath, highlightCriticalPath, nodeLabels);
        break;
      case 'dot':
        content = this.generateDOT(workflow, graph, criticalPath, highlightCriticalPath, orientation, nodeLabels, includeStepDetails);
        break;
      case 'mermaid':
        content = this.generateMermaid(workflow, graph, criticalPath, highlightCriticalPath, orientation, nodeLabels);
        break;
      default:
        throw new Error(`Unsupported DAG format: ${format}`);
    }

    return {
      format,
      content,
      metadata: {
        nodeCount: metadata.nodeCount,
        edgeCount: metadata.edgeCount,
        criticalPathLength: criticalPath.length,
        maxDepth: metadata.maxDepth,
      },
    };
  }

  /**
   * Generate ASCII art visualization
   */
  private generateASCII(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    criticalPath: string[],
    highlight: boolean,
    nodeLabels: 'id' | 'name' | 'both'
  ): string {
    const lines: string[] = [];
    const levels = graph.getExecutionLevels();
    const criticalSet = new Set(criticalPath);

    lines.push('┌─────────────────────────────────────────────────────────┐');
    lines.push(`│ Workflow: ${workflow.name.padEnd(42)} │`);
    lines.push('└─────────────────────────────────────────────────────────┘');
    lines.push('');

    // Render each level
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const levelLabel = `Level ${i + 1}:`;
      lines.push(levelLabel);

      for (const stepId of level) {
        const step = workflow.steps.find(s => s.id === stepId);
        if (!step) continue;

        const isCritical = criticalSet.has(stepId);
        const label = this.getNodeLabel(step, nodeLabels);

        // Format node
        let nodeLine: string;
        if (highlight && isCritical) {
          nodeLine = `  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`;
          lines.push(nodeLine);
          nodeLine = `  ┃ ★ ${label.padEnd(40)} ┃`;
          lines.push(nodeLine);
          nodeLine = `  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
          lines.push(nodeLine);
        } else {
          nodeLine = `  ┌───────────────────────────────────────────┐`;
          lines.push(nodeLine);
          nodeLine = `  │ ${label.padEnd(42)} │`;
          lines.push(nodeLine);
          nodeLine = `  └───────────────────────────────────────────┘`;
          lines.push(nodeLine);
        }

        // Show dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          const depLabels = step.dependsOn.map(depId => {
            const depStep = workflow.steps.find(s => s.id === depId);
            return depStep ? this.getNodeLabel(depStep, nodeLabels) : depId;
          });
          lines.push(`      ↑ depends on: ${depLabels.join(', ')}`);
        }

        lines.push('');
      }

      // Add level separator (except last level)
      if (i < levels.length - 1) {
        lines.push('      ↓');
        lines.push('');
      }
    }

    // Add legend if highlighting
    if (highlight) {
      lines.push('');
      lines.push('Legend:');
      lines.push('  ┏━━━━━━┓  Critical path (determines total duration)');
      lines.push('  ┃ ★    ┃');
      lines.push('  ┗━━━━━━┛');
      lines.push('');
      lines.push('  ┌──────┐  Regular step');
      lines.push('  │      │');
      lines.push('  └──────┘');
    }

    return lines.join('\n');
  }

  /**
   * Generate DOT (Graphviz) format
   */
  private generateDOT(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    criticalPath: string[],
    highlight: boolean,
    orientation: 'TB' | 'LR',
    nodeLabels: 'id' | 'name' | 'both',
    includeDetails: boolean
  ): string {
    const lines: string[] = [];
    const criticalSet = new Set(criticalPath);

    // Graph header
    lines.push(`digraph "${workflow.name}" {`);
    lines.push(`  label="${workflow.name}\\nv${workflow.version}";`);
    lines.push(`  labelloc="t";`);
    lines.push(`  rankdir=${orientation};`);
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    // Define nodes
    lines.push('  // Nodes');
    for (const step of workflow.steps) {
      const isCritical = criticalSet.has(step.id);
      const label = this.getNodeLabel(step, nodeLabels);

      // Build node label with optional details
      let nodeLabel = label;
      if (includeDetails && step.duration) {
        const durationSec = Math.round(step.duration / 1000);
        nodeLabel += `\\n(${durationSec}s)`;
      }

      // Node styling
      const style = isCritical && highlight
        ? 'style=filled, fillcolor=gold, color=red, penwidth=2.0'
        : 'style=filled, fillcolor=lightblue';

      lines.push(`  "${step.id}" [label="${nodeLabel}", ${style}];`);
    }

    lines.push('');

    // Define edges
    lines.push('  // Edges');
    for (const step of workflow.steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          const isCriticalEdge = criticalSet.has(depId) && criticalSet.has(step.id);
          const edgeStyle = isCriticalEdge && highlight
            ? 'color=red, penwidth=2.0'
            : 'color=gray';

          lines.push(`  "${depId}" -> "${step.id}" [${edgeStyle}];`);
        }
      }
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaid(
    workflow: WorkflowDefinition,
    graph: DependencyGraph,
    criticalPath: string[],
    highlight: boolean,
    orientation: 'TB' | 'LR',
    nodeLabels: 'id' | 'name' | 'both'
  ): string {
    const lines: string[] = [];
    const criticalSet = new Set(criticalPath);

    // Graph header
    lines.push(`graph ${orientation}`);
    lines.push('');

    // Define nodes
    for (const step of workflow.steps) {
      const isCritical = criticalSet.has(step.id);
      const label = this.getNodeLabel(step, nodeLabels);

      // Node shape: [[]] for critical, [] for regular
      if (isCritical && highlight) {
        lines.push(`  ${step.id}[["⭐ ${label}"]]`);
      } else {
        lines.push(`  ${step.id}["${label}"]`);
      }
    }

    lines.push('');

    // Define edges
    for (const step of workflow.steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          const isCriticalEdge = criticalSet.has(depId) && criticalSet.has(step.id);

          // Arrow style: ==> for critical, --> for regular
          const arrow = isCriticalEdge && highlight ? '==>' : '-->';
          lines.push(`  ${depId} ${arrow} ${step.id}`);
        }
      }
    }

    // Add styling if highlighting
    if (highlight) {
      lines.push('');
      lines.push('  %% Styling');
      lines.push('  classDef critical fill:#ffd700,stroke:#ff0000,stroke-width:2px');

      const criticalNodes = Array.from(criticalSet).join(',');
      if (criticalNodes) {
        lines.push(`  class ${criticalNodes} critical`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get node label based on labeling strategy
   */
  private getNodeLabel(step: WorkflowStep, strategy: 'id' | 'name' | 'both'): string {
    switch (strategy) {
      case 'id':
        return step.id;
      case 'name':
        return step.name || step.id;
      case 'both':
        return step.name ? `${step.name} (${step.id})` : step.id;
      default:
        return step.id;
    }
  }

  /**
   * Write DAG to file
   */
  async writeDAG(result: DAGResult, workflow: WorkflowDefinition, outputPath?: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Determine output directory and filename
    const outputDir = outputPath || 'dags';
    const extension = this.getFileExtension(result.format);
    const filename = `${workflow.name.toLowerCase().replace(/\s+/g, '-')}-dag.${extension}`;
    const fullPath = path.join(outputDir, filename);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, result.content, 'utf-8');

    return fullPath;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: DAGFormat): string {
    switch (format) {
      case 'ascii':
        return 'txt';
      case 'dot':
        return 'dot';
      case 'mermaid':
        return 'mmd';
      default:
        return 'txt';
    }
  }
}
