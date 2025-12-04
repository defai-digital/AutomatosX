import chalk from 'chalk';
import type { AgentProfile } from '../types/agent.js';
import type { DelegationResult } from '../types/orchestration.js';
import { logger } from '../shared/logging/logger.js';

export interface AgentNode {
  agentName: string;
  agent: AgentProfile;
  dependencies: string[];
  level: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: DelegationResult;
}

export interface DependencyGraph {
  nodes: Map<string, AgentNode>;
  adjacencyList: Map<string, string[]>;
  levels: Map<number, string[]>;
  maxLevel: number;
}

export class DependencyGraphBuilder {
  buildGraph(agents: AgentProfile[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      adjacencyList: new Map(),
      levels: new Map(),
      maxLevel: 0
    };

    for (const agent of agents) {
      if (!agent || !agent.name) {
        continue;
      }

      if (graph.nodes.has(agent.name)) {
        logger.warn('Duplicate agent detected while building dependency graph', {
          agent: agent.name
        });
      }

      const declaredDeps = Array.isArray(agent.dependencies) ? agent.dependencies : [];
      const filteredDeps = [...new Set(declaredDeps.filter(dep => dep !== agent.name))];

      if (declaredDeps.length !== filteredDeps.length) {
        logger.warn('Ignoring self dependency in agent profile', {
          agent: agent.name
        });
      }

      const node: AgentNode = {
        agentName: agent.name,
        agent,
        dependencies: filteredDeps,
        level: 0,
        status: 'pending'
      };

      graph.nodes.set(agent.name, node);
    }

    for (const node of graph.nodes.values()) {
      for (const dependency of node.dependencies) {
        if (!graph.nodes.has(dependency)) {
          logger.warn('Agent dependency references unknown agent', {
            agent: node.agentName,
            dependency
          });
          continue;
        }

        const dependents = graph.adjacencyList.get(dependency);
        if (dependents) {
          if (!dependents.includes(node.agentName)) {
            dependents.push(node.agentName);
          }
        } else {
          graph.adjacencyList.set(dependency, [node.agentName]);
        }
      }
    }

    this.calculateLevels(graph);

    return graph;
  }

  calculateLevels(graph: DependencyGraph): void {
    graph.levels.clear();

    if (graph.nodes.size === 0) {
      graph.maxLevel = 0;
      return;
    }

    const maxIterations = graph.nodes.size;
    let iteration = 0;

    while (iteration < maxIterations) {
      let changed = false;

      for (const node of graph.nodes.values()) {
        if (node.dependencies.length === 0) {
          if (node.level !== 0) {
            node.level = 0;
            changed = true;
          }
          continue;
        }

        let maxDepLevel = -1;
        for (const dependency of node.dependencies) {
          const depNode = graph.nodes.get(dependency);
          if (depNode) {
            maxDepLevel = Math.max(maxDepLevel, depNode.level);
          }
        }

        const newLevel = Math.max(0, maxDepLevel + 1);
        if (newLevel !== node.level) {
          node.level = newLevel;
          changed = true;
        }
      }

      if (!changed) {
        break;
      }

      iteration++;
    }

    graph.maxLevel = 0;

    for (const node of graph.nodes.values()) {
      const peers = graph.levels.get(node.level);
      if (peers) {
        peers.push(node.agentName);
      } else {
        graph.levels.set(node.level, [node.agentName]);
      }

      if (node.level > graph.maxLevel) {
        graph.maxLevel = node.level;
      }
    }

    for (const peerList of graph.levels.values()) {
      peerList.sort();
    }
  }

  detectCycles(graph: DependencyGraph): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (nodeName: string, path: string[]): void => {
      if (visiting.has(nodeName)) {
        throw new Error(`Circular dependency detected: ${[...path, nodeName].join(' → ')}`);
      }

      if (visited.has(nodeName)) {
        return;
      }

      const node = graph.nodes.get(nodeName);
      if (!node) {
        logger.warn('Dependency references missing agent during cycle detection', {
          agent: nodeName
        });
        visited.add(nodeName);
        return;
      }

      visiting.add(nodeName);

      for (const dependency of node.dependencies) {
        visit(dependency, [...path, nodeName]);
      }

      visiting.delete(nodeName);
      visited.add(nodeName);
    };

    for (const nodeName of graph.nodes.keys()) {
      visit(nodeName, []);
    }
  }

  visualizeDependencyGraph(graph: DependencyGraph): string {
    let output = '\n' + chalk.cyan('📊 Agent Dependency Graph\n\n');

    if (graph.nodes.size === 0) {
      output += chalk.gray('No agents configured\n\n');
      return output;
    }

    for (let level = 0; level <= graph.maxLevel; level++) {
      const agentNames = graph.levels.get(level) ?? [];
      output += chalk.gray(`Level ${level}:\n`);

      if (agentNames.length === 0) {
        output += chalk.gray('  (empty)\n\n');
        continue;
      }

      for (const agentName of agentNames) {
        const node = graph.nodes.get(agentName);
        if (!node) {
          continue;
        }

        const allowsParallel = node.agent.parallel !== false;
        const modeLabel = allowsParallel
          ? chalk.green(' [parallel]')
          : chalk.yellow(' [sequential]');

        // Display as "Name (role)" e.g., "Bob (backend)"
        const displayText = node.agent.displayName
          ? `${node.agent.displayName} (${agentName})`
          : agentName;

        output += `  ${chalk.cyan('○')} ${displayText}${modeLabel}\n`;

        if (node.dependencies.length > 0) {
          // Format dependencies with display names too
          const formattedDeps = node.dependencies.map(dep => {
            const depNode = graph.nodes.get(dep);
            if (depNode?.agent.displayName) {
              return `${depNode.agent.displayName} (${dep})`;
            }
            return dep;
          });
          output += chalk.gray(`     ↳ depends on: ${formattedDeps.join(', ')}\n`);
        }
      }

      output += '\n';
    }

    return output;
  }
}
