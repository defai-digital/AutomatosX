/**
 * agent.ts
 * CLI commands for agent management and execution
 * Phase 7: Agent System Implementation - Day 4
 */
import { Command } from 'commander';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { TaskRouter } from '../../agents/TaskRouter.js';
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
function initializeRegistry() {
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
function createListCommand() {
    return new Command('list')
        .description('List all available agents')
        .option('-f, --format <format>', 'Output format (table, json)', 'table')
        .option('-t, --type <type>', 'Filter by agent category (core, specialized, all)', 'all')
        .action(async (options) => {
        try {
            const registry = initializeRegistry();
            const agents = registry.getAll();
            // Filter by type if specified
            let filteredAgents = agents;
            if (options.type === 'core') {
                const coreTypes = ['backend', 'frontend', 'security', 'quality', 'devops', 'architecture', 'data', 'product'];
                filteredAgents = agents.filter(agent => coreTypes.includes(agent.getMetadata().type));
            }
            else if (options.type === 'specialized') {
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
            }
            else {
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
        }
        catch (error) {
            ErrorHandler.handleAndExit(error);
        }
    });
}
/**
 * Command: ax agent describe <type>
 * Show detailed information about a specific agent
 */
function createDescribeCommand() {
    return new Command('describe')
        .description('Show detailed information about a specific agent')
        .argument('<type>', 'Agent type (e.g., backend, security)')
        .option('-v, --verbose', 'Show verbose output including all details')
        .action(async (type, options) => {
        try {
            const registry = initializeRegistry();
            const agent = registry.get(type);
            if (!agent) {
                console.error(`Agent not found: ${type}`);
                console.log('\nAvailable agents:');
                registry.getAll().forEach(a => console.log(`  - ${a.getMetadata().type}`));
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
        }
        catch (error) {
            ErrorHandler.handleAndExit(error);
        }
    });
}
/**
 * Command: ax run @<agent> "<task>"
 * Execute a task with a specific agent
 * BUG FIX #35: Use AgentExecutor instead of null runtime
 */
function createRunCommand() {
    return new Command('run')
        .description('Execute a task with a specific agent or auto-route')
        .argument('<task>', 'Task description (use @agent to specify agent)')
        .option('-a, --agent <type>', 'Explicitly specify agent type')
        .option('-v, --verbose', 'Show verbose output')
        .action(async (taskDescription, options) => {
        try {
            const registry = initializeRegistry();
            const router = new TaskRouter(registry);
            // BUG FIX #35: Import and use AgentExecutor
            const { AgentExecutor } = await import('../../agents/AgentExecutor.js');
            const executor = new AgentExecutor(process.cwd());
            // Create task
            const task = {
                id: `task-${Date.now()}`,
                description: taskDescription,
                status: 'pending',
                priority: 'medium',
                createdAt: Date.now(),
            };
            // Determine agent
            let agentType;
            let agentMetadata;
            if (options.agent) {
                const agent = registry.get(options.agent);
                if (!agent) {
                    console.error(`Agent not found: ${options.agent}`);
                    process.exit(1);
                }
                agentType = options.agent;
                agentMetadata = agent.getMetadata();
            }
            else {
                const routedAgent = router.routeToAgent(task);
                if (!routedAgent) {
                    console.error('Could not find suitable agent for this task');
                    process.exit(1);
                }
                agentMetadata = routedAgent.getMetadata();
                agentType = agentMetadata.type;
            }
            console.log(`\nRouted to: ${agentMetadata.name} (@${agentType})`);
            if (options.verbose) {
                const confidence = router.getRoutingConfidence(task);
                console.log(`Confidence: ${(confidence * 100).toFixed(1)}%`);
            }
            console.log(`\nExecuting task: "${taskDescription}"`);
            console.log('─'.repeat(80));
            // BUG FIX #35: Execute task with AgentExecutor
            const result = await executor.execute({
                agent: agentType,
                task: taskDescription,
                verbose: options.verbose
            });
            if (result.success) {
                console.log('\n✅ Task completed successfully\n');
                if (result.response) {
                    console.log(result.response);
                }
            }
            else {
                console.log('\n❌ Task failed');
                if (result.error) {
                    console.log(`Error: ${result.error.message}`);
                }
            }
            console.log('\n' + '─'.repeat(80) + '\n');
        }
        catch (error) {
            ErrorHandler.handleAndExit(error);
        }
    });
}
/**
 * Register all agent commands
 * BUG FIX #36: Remove duplicate 'run' command registration
 * The 'run' command is already registered in src/cli/commands/run.ts
 */
export function registerAgentCommands(program) {
    const agentCommand = new Command('agent')
        .description('Manage and interact with AI agents');
    agentCommand.addCommand(createListCommand());
    agentCommand.addCommand(createDescribeCommand());
    // BUG FIX #36: Don't register standalone 'run' command here
    // It's already registered via createRunCommand() from src/cli/commands/run.ts
    // program.addCommand(createRunCommand());
    program.addCommand(agentCommand);
}
//# sourceMappingURL=agent.js.map