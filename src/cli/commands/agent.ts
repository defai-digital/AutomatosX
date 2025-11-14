/**
 * agent.ts
 * CLI commands for agent management and execution
 * Phase 7: Agent System Implementation - Day 4
 */

import { Command } from 'commander';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { TaskRouter } from '../../agents/TaskRouter.js';
import { AgentRuntime } from '../../agents/AgentRuntime.js';
import { Task, TaskStatus } from '../../types/agents.types.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

// Import all agents
import { BackendAgent } from '../../agents/BackendAgent.js';
import { FrontendAgent } from '../../agents/FrontendAgent.js';
import { SecurityAgent } from '../../agents/SecurityAgent.js';
import { QualityAgent } from '../../agents/QualityAgent.js';
import { DevOpsAgent } from '../../agents/DevOpsAgent.js';
import { ArchitectAgent } from '../../agents/ArchitectAgent.js';
import { DataAgent } from '../../agents/DataAgent.js';
import { ProductAgent } from '../../agents/ProductAgent.js';
import { DataScienceAgent } from '../../agents/DataScienceAgent.js';
import { DatabaseAgent } from '../../agents/DatabaseAgent.js';
import { APIAgent } from '../../agents/APIAgent.js';
import { PerformanceAgent } from '../../agents/PerformanceAgent.js';
import { MobileAgent } from '../../agents/MobileAgent.js';
import { InfrastructureAgent } from '../../agents/InfrastructureAgent.js';
import { TestingAgent } from '../../agents/TestingAgent.js';
import { CTOAgent } from '../../agents/CTOAgent.js';
import { CEOAgent } from '../../agents/CEOAgent.js';
import { WriterAgent } from '../../agents/WriterAgent.js';
import { ResearcherAgent } from '../../agents/ResearcherAgent.js';
import { StandardsAgent } from '../../agents/StandardsAgent.js';

/**
 * Initialize agent registry with all available agents
 */
function initializeRegistry(): AgentRegistry {
  const registry = new AgentRegistry();

  // Register core agents
  registry.register(new BackendAgent());
  registry.register(new FrontendAgent());
  registry.register(new SecurityAgent());
  registry.register(new QualityAgent());
  registry.register(new DevOpsAgent());
  registry.register(new ArchitectAgent());
  registry.register(new DataAgent());
  registry.register(new ProductAgent());

  // Register specialized agents
  registry.register(new DataScienceAgent());
  registry.register(new DatabaseAgent());
  registry.register(new APIAgent());
  registry.register(new PerformanceAgent());
  registry.register(new MobileAgent());
  registry.register(new InfrastructureAgent());
  registry.register(new TestingAgent());
  registry.register(new CTOAgent());
  registry.register(new CEOAgent());
  registry.register(new WriterAgent());
  registry.register(new ResearcherAgent());
  registry.register(new StandardsAgent());

  return registry;
}

/**
 * Command: ax agent list
 * List all available agents
 */
function createListCommand(): Command {
  return new Command('list')
    .description('List all available agents')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('-t, --type <type>', 'Filter by agent category (core, specialized, all)', 'all')
    .action(async (options) => {
      try {
        const registry = initializeRegistry();
        const agents = registry.listAgents();

        // Filter by type if specified
        let filteredAgents = agents;
        if (options.type === 'core') {
          const coreTypes = ['backend', 'frontend', 'security', 'quality', 'devops', 'architecture', 'data', 'product'];
          filteredAgents = agents.filter(agent => coreTypes.includes(agent.getMetadata().type));
        } else if (options.type === 'specialized') {
          const coreTypes = ['backend', 'frontend', 'security', 'quality', 'devops', 'architecture', 'data', 'product'];
          filteredAgents = agents.filter(agent => !coreTypes.includes(agent.getMetadata().type));
        }

        if (options.format === 'json') {
          const agentData = filteredAgents.map(agent => {
            const metadata = agent.getMetadata();
            return {
              type: metadata.type,
              name: metadata.name,
              description: metadata.description,
              capabilities: metadata.capabilities.map(c => c.name),
              specializations: metadata.specializations,
            };
          });
          console.log(JSON.stringify(agentData, null, 2));
        } else {
          // Table format
          console.log('\nAvailable Agents:');
          console.log('─'.repeat(80));
          for (const agent of filteredAgents) {
            const metadata = agent.getMetadata();
            console.log(`\n${metadata.name} (@${metadata.type})`);
            console.log(`  ${metadata.description}`);
            console.log(`  Capabilities: ${metadata.capabilities.map(c => c.name).join(', ')}`);
          }
          console.log('\n─'.repeat(80));
          console.log(`Total: ${filteredAgents.length} agents\n`);
        }
      } catch (error) {
        ErrorHandler.handleError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax agent describe <type>
 * Show detailed information about a specific agent
 */
function createDescribeCommand(): Command {
  return new Command('describe')
    .description('Show detailed information about a specific agent')
    .argument('<type>', 'Agent type (e.g., backend, security)')
    .option('-v, --verbose', 'Show verbose output including all details')
    .action(async (type, options) => {
      try {
        const registry = initializeRegistry();
        const agent = registry.getAgent(type);

        if (!agent) {
          console.error(`Agent not found: ${type}`);
          console.log('\nAvailable agents:');
          registry.listAgents().forEach(a => console.log(`  - ${a.getMetadata().type}`));
          process.exit(1);
        }

        const metadata = agent.getMetadata();

        console.log(`\n${metadata.name} (@${metadata.type})`);
        console.log('─'.repeat(80));
        console.log(`\nDescription:`);
        console.log(`  ${metadata.description}\n`);

        console.log(`Capabilities:`);
        metadata.capabilities.forEach(cap => {
          console.log(`  • ${cap.name}: ${cap.description}`);
          if (options.verbose) {
            console.log(`    Keywords: ${cap.keywords.join(', ')}`);
          }
        });

        console.log(`\nSpecializations:`);
        console.log(`  ${metadata.specializations.join(', ')}\n`);

        if (options.verbose) {
          console.log(`Configuration:`);
          console.log(`  Temperature: ${metadata.temperature}`);
          console.log(`  Max Tokens: ${metadata.maxTokens}\n`);
        }

        console.log(`Example tasks:`);
        console.log(`  ax run @${type} "your task description"`);
        console.log('─'.repeat(80) + '\n');
      } catch (error) {
        ErrorHandler.handleError(error);
        process.exit(1);
      }
    });
}

/**
 * Command: ax run @<agent> "<task>"
 * Execute a task with a specific agent
 */
function createRunCommand(): Command {
  return new Command('run')
    .description('Execute a task with a specific agent or auto-route')
    .argument('<task>', 'Task description (use @agent to specify agent)')
    .option('-a, --agent <type>', 'Explicitly specify agent type')
    .option('-v, --verbose', 'Show verbose output')
    .action(async (taskDescription, options) => {
      try {
        const registry = initializeRegistry();
        const router = new TaskRouter(registry);
        const runtime = new AgentRuntime(registry);

        // Create task
        const task: Task = {
          id: `task-${Date.now()}`,
          description: taskDescription,
          status: 'pending' as TaskStatus,
          priority: 'medium' as const,
          createdAt: Date.now(),
        };

        // Determine agent
        let agent;
        if (options.agent) {
          agent = registry.getAgent(options.agent);
          if (!agent) {
            console.error(`Agent not found: ${options.agent}`);
            process.exit(1);
          }
        } else {
          agent = router.routeToAgent(task);
          if (!agent) {
            console.error('Could not find suitable agent for this task');
            process.exit(1);
          }
        }

        const agentMetadata = agent.getMetadata();
        console.log(`\nRouted to: ${agentMetadata.name} (@${agentMetadata.type})`);

        if (options.verbose) {
          const confidence = router.getRoutingConfidence(task);
          console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);
        }

        console.log(`\nExecuting task: "${taskDescription}"`);
        console.log('─'.repeat(80));

        // Execute task
        const result = await runtime.executeTask(task, {
          preferredAgent: agentMetadata.type,
        });

        if (result.success) {
          console.log('\n✅ Task completed successfully\n');
          if (result.data) {
            console.log(result.data);
          }
          if (result.artifacts && result.artifacts.length > 0) {
            console.log(`\nGenerated ${result.artifacts.length} artifact(s):`);
            result.artifacts.forEach((artifact, idx) => {
              console.log(`  ${idx + 1}. ${artifact.name} (${artifact.type})`);
            });
          }
        } else {
          console.log('\n❌ Task failed');
          if (result.message) {
            console.log(`Error: ${result.message}`);
          }
        }

        console.log('\n' + '─'.repeat(80) + '\n');
      } catch (error) {
        ErrorHandler.handleError(error);
        process.exit(1);
      }
    });
}

/**
 * Register all agent commands
 */
export function registerAgentCommands(program: Command): void {
  const agentCommand = new Command('agent')
    .description('Manage and interact with AI agents');

  agentCommand.addCommand(createListCommand());
  agentCommand.addCommand(createDescribeCommand());

  // Also add standalone 'run' command to main program
  program.addCommand(createRunCommand());

  program.addCommand(agentCommand);
}
