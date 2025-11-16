/**
 * AutomatosX v8.0.0 - Example 1: Multi-Agent Collaboration
 *
 * Demonstrates how multiple agents collaborate on a complex task:
 * 1. SecurityAgent scans for vulnerabilities
 * 2. QualityAgent analyzes code quality
 * 3. ArchitectAgent reviews architecture
 * 4. WriterAgent creates comprehensive report
 *
 * Each agent uses their specialized tools and AI provider.
 */

import { AgentRegistry } from '../src/agents/AgentRegistry.js';
import { AgentRuntime } from '../src/agents/AgentRuntime.js';
import { ProviderRouterV2 } from '../src/services/ProviderRouterV2.js';
import { getDatabase } from '../src/database/connection.js';

// Import all agents
import { SecurityAgent } from '../src/agents/SecurityAgent.js';
import { QualityAgent } from '../src/agents/QualityAgent.js';
import { ArchitectAgent } from '../src/agents/ArchitectAgent.js';
import { WriterAgent } from '../src/agents/WriterAgent.js';

async function multiAgentCollaboration() {
  console.log('🤖 Multi-Agent Collaboration Example\n');

  // 1. Setup Provider Router for AI capabilities
  console.log('Setting up provider router...');
  const providerRouter = new ProviderRouterV2({
    providers: {
      claude: {
        enabled: true,
        priority: 1,
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'claude-sonnet-4-5-20250929',
      },
      gemini: {
        enabled: true,
        priority: 2,
        apiKey: process.env.GOOGLE_API_KEY,
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'gemini-2.0-flash-exp',
      },
    },
  });

  // Monitor routing decisions
  providerRouter.on('routing-decision', (decision) => {
    console.log(`  → Provider selected: ${decision.selectedProvider} (${decision.reason})`);
  });

  providerRouter.on('success', ({ provider, response }) => {
    console.log(`  ✓ ${provider} responded in ${response.latency}ms`);
  });

  // 2. Setup Agent Registry
  console.log('Initializing agent registry...');
  const db = getDatabase();
  const registry = new AgentRegistry();

  // Register specialized agents
  const agents = [
    new SecurityAgent(providerRouter, db),
    new QualityAgent(providerRouter, db),
    new ArchitectAgent(providerRouter, db),
    new WriterAgent(providerRouter, db),
  ];

  agents.forEach((agent) => {
    registry.register(agent);
    const metadata = agent.getMetadata();
    console.log(`  ✓ Registered ${metadata.name} (${metadata.specializations.slice(0, 3).join(', ')})`);
  });

  // 3. Create Agent Runtime
  const runtime = new AgentRuntime(registry, providerRouter, db);

  // 4. Define the collaborative task
  const repositoryPath = process.cwd(); // Current project
  console.log(`\n📦 Analyzing repository: ${repositoryPath}\n`);

  // Task 1: Security Analysis
  console.log('🔒 Step 1: Security Analysis');
  const securityTask = {
    id: 'task-security-1',
    type: 'code-analysis' as const,
    description: 'Perform comprehensive security scan',
    context: {
      repositoryPath,
      analysisType: 'security',
      checkTypes: ['vulnerabilities', 'secrets', 'dependencies'],
    },
    assignedAgent: 'security' as const,
    priority: 1,
    createdAt: Date.now(),
  };

  try {
    const securityResult = await runtime.executeTask(securityTask);
    console.log(`  ✓ Security analysis completed`);
    console.log(`    - Duration: ${securityResult.duration}ms`);
    console.log(`    - Findings: ${JSON.stringify(securityResult.result).length} bytes`);
  } catch (error) {
    console.error(`  ✗ Security analysis failed:`, error);
  }

  // Task 2: Code Quality Analysis
  console.log('\n📊 Step 2: Code Quality Analysis');
  const qualityTask = {
    id: 'task-quality-1',
    type: 'code-analysis' as const,
    description: 'Analyze code quality metrics',
    context: {
      repositoryPath,
      analysisType: 'quality',
      metrics: ['complexity', 'maintainability', 'test-coverage'],
    },
    assignedAgent: 'quality' as const,
    priority: 1,
    createdAt: Date.now(),
  };

  try {
    const qualityResult = await runtime.executeTask(qualityTask);
    console.log(`  ✓ Quality analysis completed`);
    console.log(`    - Duration: ${qualityResult.duration}ms`);
  } catch (error) {
    console.error(`  ✗ Quality analysis failed:`, error);
  }

  // Task 3: Architecture Review
  console.log('\n🏗️  Step 3: Architecture Review');
  const architectureTask = {
    id: 'task-arch-1',
    type: 'code-analysis' as const,
    description: 'Review system architecture and design patterns',
    context: {
      repositoryPath,
      analysisType: 'architecture',
      aspects: ['structure', 'patterns', 'dependencies'],
    },
    assignedAgent: 'architecture' as const,
    priority: 1,
    createdAt: Date.now(),
  };

  try {
    const architectureResult = await runtime.executeTask(architectureTask);
    console.log(`  ✓ Architecture review completed`);
    console.log(`    - Duration: ${architectureResult.duration}ms`);
  } catch (error) {
    console.error(`  ✗ Architecture review failed:`, error);
  }

  // Task 4: Generate Comprehensive Report
  console.log('\n📝 Step 4: Report Generation');
  const reportTask = {
    id: 'task-report-1',
    type: 'content-generation' as const,
    description: 'Create comprehensive analysis report aggregating all findings',
    context: {
      reportType: 'code-analysis',
      sections: ['security', 'quality', 'architecture'],
      format: 'markdown',
      outputPath: './analysis-report.md',
    },
    assignedAgent: 'writer' as const,
    priority: 1,
    createdAt: Date.now(),
  };

  try {
    const reportResult = await runtime.executeTask(reportTask);
    console.log(`  ✓ Report generated`);
    console.log(`    - Duration: ${reportResult.duration}ms`);
    console.log(`    - Output: ${reportResult.result}`);
  } catch (error) {
    console.error(`  ✗ Report generation failed:`, error);
  }

  // 5. Show Runtime Statistics
  console.log('\n📈 Runtime Statistics:');
  const stats = runtime.getStatistics();
  console.log(`  - Total tasks executed: ${stats.tasksExecuted}`);
  console.log(`  - Successful: ${stats.tasksSucceeded}`);
  console.log(`  - Failed: ${stats.tasksFailed}`);
  console.log(`  - Average duration: ${Math.round(stats.averageExecutionTime)}ms`);

  // 6. Show Provider Statistics
  console.log('\n🌐 Provider Statistics:');
  const providerStats = providerRouter.getStatistics();
  for (const [provider, stats] of Object.entries(providerStats)) {
    console.log(`  ${provider}:`);
    console.log(`    - Available: ${stats.available}`);
    console.log(`    - Latency: ${stats.latency}ms`);
    console.log(`    - Error rate: ${stats.errorRate * 100}%`);
    console.log(`    - Requests/min: ${stats.requestsLastMinute}`);
  }

  console.log('\n✨ Multi-agent collaboration completed!\n');
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  multiAgentCollaboration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { multiAgentCollaboration };
