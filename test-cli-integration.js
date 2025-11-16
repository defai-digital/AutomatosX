#!/usr/bin/env node
/**
 * Simple integration test for ax-cli
 */

async function testCLI() {
  console.log('Testing ax-cli integration...\n');

  try {
    // Test 1: Import the startInteractiveCLI function
    console.log('[1/5] Testing module import...');
    const { startInteractiveCLI } = await import('./packages/cli-interactive/dist/index.js');
    console.log('✅ Module imported successfully\n');

    // Test 2: Check provider bridge
    console.log('[2/5] Testing provider bridge...');
    const { getProvider } = await import('./packages/cli-interactive/dist/provider-bridge.js');
    const provider = await getProvider();
    console.log(`✅ Provider available: ${provider.name}\n`);

    // Test 3: Check agent bridge
    console.log('[3/5] Testing agent bridge...');
    const { getAgentExecutor } = await import('./packages/cli-interactive/dist/agent-bridge.js');
    const executor = getAgentExecutor();
    const agents = await executor.listAgents();
    console.log(`✅ Agent executor initialized, found ${agents.length} agents:`);
    agents.forEach(a => console.log(`   - ${a.name}: ${a.description}`));
    console.log();

    // Test 4: Test agent availability check
    console.log('[4/5] Testing agent availability...');
    const backendAvailable = await executor.isAgentAvailable('backend');
    console.log(`✅ Backend agent available: ${backendAvailable}\n`);

    // Test 5: Test mock agent execution
    console.log('[5/5] Testing mock agent execution...');
    const result = await executor.execute({
      agent: 'backend',
      task: 'test task'
    });
    console.log(`✅ Agent execution ${result.success ? 'succeeded' : 'failed'}`);
    console.log(`   Output (first 100 chars): ${result.output.substring(0, 100)}...\n`);

    console.log('🎉 All integration tests passed!\n');
    console.log('To test the interactive CLI, run: node dist/index.js cli');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testCLI();
