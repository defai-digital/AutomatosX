/**
 * Token Usage Investigation
 *
 * Investigates how to get token usage from ax-cli SDK
 */

import { createAgent, getUsageTracker } from '@defai.digital/ax-cli/sdk';

async function investigateTokens() {
  console.log('=== Investigating Token Usage ===\n');

  try {
    // Initialize SDK (deprecated - SDK handles initialization automatically)
    console.log('1. Initializing SDK...');
    // Note: initializeSDK() is deprecated - SDK auto-initializes on first use
    console.log('   ⏭️  Skipping (deprecated - auto-initializes)\n');

    // Create agent (credentials from ax-cli setup)
    console.log('2. Creating agent...');
    const agent = await createAgent({ maxToolRounds: 10 });
    console.log('   ✅ Agent created\n');

    // Check agent methods for token-related APIs
    console.log('3. Checking agent methods...');
    const agentProto = Object.getPrototypeOf(agent);
    const allMethods = Object.getOwnPropertyNames(agentProto);

    console.log('   All methods:', allMethods.length);

    const tokenMethods = allMethods.filter(m =>
      m.toLowerCase().includes('token') ||
      m.toLowerCase().includes('usage') ||
      m.toLowerCase().includes('stat') ||
      m.toLowerCase().includes('count')
    );

    console.log('   Token-related methods:', tokenMethods);
    console.log('');

    // Execute test message
    console.log('4. Executing test message...');
    const result = await agent.processUserMessage('Count to 3');
    console.log('   ✅ Execution complete');
    console.log('   Result type:', typeof result);
    console.log('   Is array:', Array.isArray(result));
    console.log('   Length:', Array.isArray(result) ? result.length : 'N/A');
    console.log('');

    // Check agent state
    console.log('5. Checking agent state...');
    const stateChecks = [
      { name: 'getState', exists: typeof (agent as any).getState === 'function' },
      { name: 'getUsage', exists: typeof (agent as any).getUsage === 'function' },
      { name: 'getTokenCount', exists: typeof (agent as any).getTokenCount === 'function' },
      { name: 'getStats', exists: typeof (agent as any).getStats === 'function' },
      { name: 'state', exists: 'state' in agent },
      { name: 'usage', exists: 'usage' in agent },
      { name: 'tokens', exists: 'tokens' in agent }
    ];

    for (const check of stateChecks) {
      console.log(`   ${check.exists ? '✅' : '❌'} ${check.name}: ${check.exists ? 'EXISTS' : 'not found'}`);

      if (check.exists && typeof (agent as any)[check.name] === 'function') {
        try {
          const value = (agent as any)[check.name]();
          console.log(`      Value:`, value);
        } catch (e) {
          console.log(`      Error calling:`, e instanceof Error ? e.message : String(e));
        }
      } else if (check.exists && check.name in agent) {
        console.log(`      Value:`, (agent as any)[check.name]);
      }
    }
    console.log('');

    // Check usage tracker
    console.log('6. Checking usage tracker...');
    try {
      const tracker = getUsageTracker();
      console.log('   ✅ Tracker exists');
      console.log('   Tracker type:', typeof tracker);

      const trackerProto = Object.getPrototypeOf(tracker);
      const trackerMethods = Object.getOwnPropertyNames(trackerProto);
      console.log('   Tracker methods:', trackerMethods);

      // Try common methods
      if (typeof (tracker as any).getUsage === 'function') {
        console.log('   Tracker usage:', (tracker as any).getUsage());
      }
      if (typeof (tracker as any).getTotalUsage === 'function') {
        console.log('   Tracker total:', (tracker as any).getTotalUsage());
      }
      if (typeof (tracker as any).getStats === 'function') {
        console.log('   Tracker stats:', (tracker as any).getStats());
      }
    } catch (e) {
      console.log('   ❌ Usage tracker error:', e instanceof Error ? e.message : String(e));
    }
    console.log('');

    // Check message structure
    console.log('7. Checking message structure...');
    if (Array.isArray(result) && result.length > 0) {
      const lastMessage = result[result.length - 1]!; // Non-null assertion: length check guarantees existence
      console.log('   Last message type:', lastMessage.type);
      console.log('   Last message keys:', Object.keys(lastMessage));

      // Check for token fields
      const tokenFields = ['tokens', 'usage', 'tokenCount', 'inputTokens', 'outputTokens'];
      for (const field of tokenFields) {
        if (field in lastMessage) {
          console.log(`   ✅ ${field}:`, (lastMessage as any)[field]);
        }
      }

      console.log('\n   Full message:');
      console.log(JSON.stringify(lastMessage, null, 2));
    }
    console.log('');

    // Summary
    console.log('=== SUMMARY ===\n');
    console.log('Token tracking options found:');

    const foundOptions = [];

    if (tokenMethods.length > 0) {
      foundOptions.push(`- Agent methods: ${tokenMethods.join(', ')}`);
    }

    if (stateChecks.some(c => c.exists)) {
      foundOptions.push(`- Agent properties: ${stateChecks.filter(c => c.exists).map(c => c.name).join(', ')}`);
    }

    if (foundOptions.length === 0) {
      console.log('❌ No built-in token tracking found in SDK');
      console.log('\nRecommendation: Use fallback estimation based on content length');
    } else {
      console.log(foundOptions.join('\n'));
    }

  } catch (error) {
    console.error('\n❌ Investigation failed:');
    console.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run investigation
investigateTokens();
