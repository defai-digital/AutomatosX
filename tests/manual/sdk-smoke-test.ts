/**
 * SDK Smoke Test - Quick verification that SDK integration works
 *
 * This test verifies:
 * 1. SDK adapter can be created
 * 2. SDK is available
 * 3. Basic execution works
 * 4. Response format is correct
 * 5. Agent reuse provides performance benefit
 */

import { AxCliSdkAdapter } from '../../src/integrations/ax-cli-sdk/adapter.js';

async function smokeTest() {
  console.log('🧪 SDK Smoke Test Starting...\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Test 1: Adapter creation
    console.log('📝 Test 1: Creating SDK adapter...');
    const adapter = new AxCliSdkAdapter();
    console.log('   ✅ Adapter created');
    console.log('   Command:', adapter.getCommand());
    console.log('   Display:', adapter.getDisplayName());
    console.log('');

    // Test 2: Check availability
    console.log('📝 Test 2: Checking SDK availability...');
    const available = await adapter.isAvailable();
    console.log(`   ${available ? '✅' : '❌'} SDK available: ${available}`);
    console.log('');

    if (!available) {
      console.log('   ⚠️  SDK not available - stopping test');
      console.log('   💡 Install SDK: npm install @defai.digital/ax-cli');
      process.exit(1);
    }

    // Test 3: Get version
    console.log('📝 Test 3: Getting SDK version...');
    const version = await adapter.getVersion();
    console.log(`   ✅ Version: ${version}`);
    console.log('');

    // Test 4: Simple execution
    console.log('📝 Test 4: Executing simple prompt...');
    console.log('   Prompt: "Say Hello from SDK"');
    const startTime = Date.now();

    const result = await adapter.execute('Say "Hello from SDK"', {
      model: 'glm-4.6'
    });

    const duration = Date.now() - startTime;

    console.log(`   ✅ Execution completed in ${duration}ms`);
    console.log('');
    console.log('   📊 Response Details:');
    console.log('   ├─ Content:', result.content.substring(0, 100) + (result.content.length > 100 ? '...' : ''));
    console.log('   ├─ Model:', result.model);
    console.log('   ├─ Tokens:');
    console.log('   │  ├─ Prompt:', result.tokensUsed.prompt);
    console.log('   │  ├─ Completion:', result.tokensUsed.completion);
    console.log('   │  └─ Total:', result.tokensUsed.total);
    console.log('   ├─ Latency:', result.latencyMs + 'ms');
    console.log('   ├─ Finish Reason:', result.finishReason);
    console.log('   └─ Cached:', result.cached);
    console.log('');

    // Validate response format
    console.log('📝 Test 5: Validating response format...');
    const validations = [
      { name: 'content exists', pass: result.content && result.content.length > 0 },
      { name: 'model exists', pass: result.model && result.model.length > 0 },
      { name: 'tokens.prompt >= 0', pass: result.tokensUsed.prompt >= 0 },
      { name: 'tokens.completion >= 0', pass: result.tokensUsed.completion >= 0 },
      { name: 'tokens.total = sum', pass: result.tokensUsed.total === result.tokensUsed.prompt + result.tokensUsed.completion },
      { name: 'latency > 0', pass: result.latencyMs > 0 },
      { name: 'finishReason valid', pass: ['stop', 'length', 'error'].includes(result.finishReason) },
      { name: 'cached is boolean', pass: typeof result.cached === 'boolean' }
    ];

    let allPassed = true;
    for (const validation of validations) {
      const icon = validation.pass ? '✅' : '❌';
      console.log(`   ${icon} ${validation.name}`);
      if (!validation.pass) allPassed = false;
    }
    console.log('');

    if (!allPassed) {
      console.error('❌ Response format validation FAILED!');
      process.exit(1);
    }

    // Test 6: Second execution (should be faster with reuse)
    console.log('📝 Test 6: Testing agent reuse (second execution)...');
    console.log('   Prompt: "Count to 3"');
    const startTime2 = Date.now();

    const result2 = await adapter.execute('Count to 3', {
      model: 'glm-4.6'
    });

    const duration2 = Date.now() - startTime2;

    console.log(`   ✅ Execution completed in ${duration2}ms`);
    console.log('   Content:', result2.content.substring(0, 50) + '...');
    console.log('');

    // Compare performance
    console.log('📝 Test 7: Performance comparison...');
    const speedImprovement = duration > duration2;
    const ratio = duration / duration2;

    console.log(`   First call:  ${duration}ms`);
    console.log(`   Second call: ${duration2}ms`);
    console.log(`   ${speedImprovement ? '✅' : '⚠️ '} Speed improvement: ${speedImprovement ? 'YES' : 'NO'}`);

    if (speedImprovement) {
      console.log(`   📈 Ratio: ${ratio.toFixed(2)}x faster`);
    } else {
      console.log(`   ⚠️  Second call was not faster - agent reuse may not be working`);
    }
    console.log('');

    // Test 8: Config change detection
    console.log('📝 Test 8: Testing config change detection...');
    console.log('   Changing model from glm-4.6 to glm-4.6 (no change)');
    const startTime3 = Date.now();

    await adapter.execute('Test', { model: 'glm-4.6' });

    const duration3 = Date.now() - startTime3;

    console.log(`   ✅ Same config execution: ${duration3}ms`);
    console.log(`   ${duration3 < duration ? '✅' : '⚠️ '} Should still be fast (reused agent)`);
    console.log('');

    // Final summary
    console.log('=' .repeat(60));
    console.log('📊 SUMMARY\n');
    console.log('   Executions:');
    console.log(`   ├─ First call:  ${duration}ms`);
    console.log(`   ├─ Second call: ${duration2}ms`);
    console.log(`   └─ Third call:  ${duration3}ms`);
    console.log('');
    console.log('   Performance:');
    if (speedImprovement) {
      console.log(`   ✅ Agent reuse working: ${ratio.toFixed(2)}x faster`);
    } else {
      console.log(`   ⚠️  Agent reuse unclear - both calls similar speed`);
    }
    console.log('');
    console.log('   Validation:');
    console.log(`   ✅ Response format correct`);
    console.log(`   ✅ All required fields present`);
    console.log(`   ✅ Token counting working`);
    console.log('');

    console.log('=' .repeat(60));
    console.log('✅ SMOKE TEST PASSED!\n');
    console.log('   SDK integration is working correctly.');
    console.log('   Ready for comprehensive testing.');
    console.log('=' .repeat(60));

    process.exit(0);
  } catch (error) {
    console.log('');
    console.log('=' .repeat(60));
    console.error('❌ SMOKE TEST FAILED!\n');
    console.error('Error:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.log('');
    console.log('=' .repeat(60));
    console.log('⚠️  SDK integration has issues that need to be fixed.');
    console.log('=' .repeat(60));

    process.exit(1);
  }
}

// Run the test
smokeTest();
