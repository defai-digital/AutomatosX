/**
 * AutomatosX v8.0.0 - Example 2: Workflow with Provider Fallback
 *
 * Demonstrates how workflows automatically handle provider failures:
 * 1. Primary provider (Claude) attempts request
 * 2. On failure, automatically falls back to Gemini
 * 3. If Gemini fails, tries OpenAI
 * 4. Workflow continues seamlessly
 *
 * Also shows checkpoint/resume capability for long-running workflows.
 */

import { WorkflowEngineV2 } from '../src/services/WorkflowEngineV2.js';
import { ProviderRouterV2 } from '../src/services/ProviderRouterV2.js';
import { getDatabase } from '../src/database/connection.js';
import type { WorkflowDefinition } from '../src/types/schemas/workflow.schema.js';

async function workflowWithFallback() {
  console.log('🔄 Workflow with Provider Fallback Example\n');

  // 1. Setup Provider Router with fallback chain
  console.log('Setting up provider router with fallback...');
  const providerRouter = new ProviderRouterV2({
    providers: {
      claude: {
        enabled: true,
        priority: 1,
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 2,
        timeout: 30000,
        defaultModel: 'claude-sonnet-4-5-20250929',
      },
      gemini: {
        enabled: true,
        priority: 2,
        apiKey: process.env.GOOGLE_API_KEY,
        maxRetries: 2,
        timeout: 30000,
        defaultModel: 'gemini-2.0-flash-exp',
      },
      openai: {
        enabled: true,
        priority: 3,
        apiKey: process.env.OPENAI_API_KEY,
        maxRetries: 2,
        timeout: 30000,
        defaultModel: 'gpt-4o',
      },
    },
    // Enable chaos mode to simulate random failures
    chaosMode: process.env.CHAOS_MODE === 'true',
  });

  // Monitor provider events
  let attemptCount = 0;
  providerRouter.on('attempt', ({ provider, attempt }) => {
    attemptCount++;
    console.log(`  [Attempt ${attemptCount}] Trying ${provider} (retry ${attempt})...`);
  });

  providerRouter.on('error', ({ provider, error }) => {
    console.log(`  ✗ ${provider} failed: ${error.message}`);
  });

  providerRouter.on('success', ({ provider, response }) => {
    console.log(`  ✓ ${provider} succeeded in ${response.latency}ms`);
  });

  // 2. Create Workflow Definition
  const workflow: WorkflowDefinition = {
    name: 'code-review-with-fallback',
    version: '1.0.0',
    description: 'Code review workflow with automatic provider fallback',
    author: 'AutomatosX',
    tags: ['code-review', 'fallback-demo'],
    steps: [
      {
        key: 'analyze-structure',
        description: 'Analyze code structure and organization',
        agent: 'architecture',
        action: 'analyze-structure',
        provider: 'claude', // Prefer Claude
        timeout: 30000,
        continueOnError: false,
      },
      {
        key: 'check-security',
        description: 'Scan for security vulnerabilities',
        agent: 'security',
        action: 'security-scan',
        provider: 'gemini', // Prefer Gemini
        timeout: 30000,
        continueOnError: false,
        dependsOn: ['analyze-structure'],
      },
      {
        key: 'assess-quality',
        description: 'Evaluate code quality and maintainability',
        agent: 'quality',
        action: 'quality-assessment',
        // No provider specified - router will choose automatically
        timeout: 30000,
        continueOnError: false,
        dependsOn: ['analyze-structure'],
      },
      {
        key: 'generate-recommendations',
        description: 'Generate improvement recommendations',
        agent: 'writer',
        action: 'create-recommendations',
        provider: 'claude', // Prefer Claude for writing
        timeout: 30000,
        continueOnError: false,
        dependsOn: ['check-security', 'assess-quality'],
      },
    ],
  };

  // 3. Initialize Workflow Engine
  const db = getDatabase();
  const engine = new WorkflowEngineV2(db);

  console.log('\n📋 Workflow Definition:');
  console.log(`  - Name: ${workflow.name}`);
  console.log(`  - Steps: ${workflow.steps.length}`);
  console.log(`  - Dependency levels: ${workflow.steps.reduce((max, s) => Math.max(max, (s.dependsOn?.length || 0) + 1), 1)}`);

  // 4. Execute Workflow
  console.log('\n🚀 Starting workflow execution...\n');

  try {
    const result = await engine.executeWorkflow(workflow, {
      context: {
        repositoryPath: process.cwd(),
        branch: 'main',
      },
      triggeredBy: 'example-script',
      priority: 1,
    });

    console.log('\n✅ Workflow completed successfully!');
    console.log(`\n📊 Execution Summary:`);
    console.log(`  - Execution ID: ${result.executionId}`);
    console.log(`  - Duration: ${result.summary.duration}ms`);
    console.log(`  - Steps completed: ${result.summary.stepsCompleted}/${result.summary.stepsTotal}`);
    console.log(`  - Steps failed: ${result.summary.stepsFailed}`);

    console.log(`\n📝 Step Results:`);
    result.steps.forEach((step) => {
      const status = step.success ? '✓' : '✗';
      console.log(`  ${status} ${step.stepKey}: ${step.duration}ms`);
      if (step.error) {
        console.log(`     Error: ${step.error}`);
      }
    });

    // 5. Demonstrate Checkpoint/Resume
    console.log('\n💾 Checkpoint/Resume Capability:');
    console.log('  Note: Checkpoints are created automatically after each level');
    console.log('  To resume from checkpoint, use:');
    console.log('    const result = await engine.resumeWorkflow(checkpointId)');

  } catch (error) {
    console.error('\n❌ Workflow failed:', error);

    // Show partial results if available
    if (error instanceof Error && 'summary' in error) {
      const summary = (error as any).summary;
      console.log(`\n📊 Partial Execution:`);
      console.log(`  - Steps completed: ${summary.stepsCompleted}/${summary.stepsTotal}`);
      console.log(`  - Duration before failure: ${summary.duration}ms`);
    }

    // In production, you would:
    // 1. Get the last checkpoint ID
    // 2. Fix the issue (e.g., enable more providers)
    // 3. Resume from checkpoint
    console.log('\n💡 Recovery Options:');
    console.log('  1. Resume from last checkpoint');
    console.log('  2. Retry with different provider configuration');
    console.log('  3. Enable additional fallback providers');
  }

  // 6. Show Provider Health
  console.log('\n🏥 Provider Health Status:');
  const healthStatus = providerRouter.getHealthStatus();
  for (const [provider, health] of healthStatus.entries()) {
    const status = health.available ? '✓' : '✗';
    console.log(`  ${status} ${provider}:`);
    console.log(`     - Latency: ${Math.round(health.latency)}ms`);
    console.log(`     - Error rate: ${Math.round(health.errorRate * 100)}%`);
    console.log(`     - Requests: ${health.requestsInLastMinute}/min`);
    if (health.lastError) {
      console.log(`     - Last error: ${health.lastError}`);
    }
  }

  console.log('\n✨ Example completed!\n');

  // Cleanup
  db.close();
}

// Run example
if (import.meta.url === `file://${process.argv[1]}`) {
  workflowWithFallback()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { workflowWithFallback };
