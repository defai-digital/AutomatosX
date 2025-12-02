/**
 * Codex CLI CLI Integration - Usage Examples
 *
 * This file demonstrates various ways to use the Codex CLI integration
 * with AutomatosX, including basic execution, MCP server management, and
 * advanced patterns.
 *
 * @see docs/integrations/openai-codex.md for complete documentation
 */

import {
  CodexBridge,
  CodexCLI,
  CodexMCPManager,
  CodexError,
  CodexErrorType,
  getDefaultBridge,
  getDefaultCLI,
  getDefaultMCPManager,
} from '../../src/integrations/openai-codex/index.js';

// ========================================
// Example 1: Basic CLI Execution
// ========================================

async function example1_basicExecution() {
  console.log('\n=== Example 1: Basic CLI Execution ===\n');

  const cli = new CodexCLI({
    command: 'codex',
    sandboxMode: 'workspace-write',
    timeout: 60000,
  });

  try {
    // Check if codex CLI is available
    const available = await cli.isAvailable();
    if (!available) {
      console.error('Codex CLI not found. Install with: npm i -g @openai/codex');
      return;
    }

    // Get CLI version
    const version = await cli.getVersion();
    console.log(`Using Codex CLI version: ${version}`);

    // Execute a simple prompt
    const result = await cli.execute({
      prompt: 'Explain the benefits of TypeScript in 3 sentences',
      temperature: 0.7,
      maxTokens: 200,
    });

    console.log('\nResponse:');
    console.log(result.content);
    console.log(`\nDuration: ${result.duration}ms`);
    console.log(`Token count: ${result.tokenCount ?? 'N/A'}`);
  } catch (error) {
    if (error instanceof CodexError) {
      console.error(`Codex error [${error.type}]:`, error.message);
      if (error.context) {
        console.error('Context:', error.context);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await cli.cleanup();
  }
}

// ========================================
// Example 2: Streaming Execution
// ========================================

async function example2_streamingExecution() {
  console.log('\n=== Example 2: Streaming Execution ===\n');

  const cli = new CodexCLI({
    command: 'codex',
    sandboxMode: 'workspace-write',
  });

  try {
    const result = await cli.execute({
      prompt: 'Write a short poem about programming',
      streaming: true,
      temperature: 0.9,
    });

    console.log('Streamed response:');
    console.log(result.content);
  } catch (error) {
    console.error('Error:', error instanceof CodexError ? error.message : error);
  } finally {
    await cli.cleanup();
  }
}

// ========================================
// Example 3: MCP Server Management
// ========================================

async function example3_mcpServer() {
  console.log('\n=== Example 3: MCP Server Management ===\n');

  const mcpManager = new CodexMCPManager({
    enabled: true,
    command: 'codex',
    transport: 'stdio',
  });

  try {
    // Start MCP server
    console.log('Starting MCP server...');
    const startStatus = await mcpManager.startServer();
    console.log(`MCP server started (PID: ${startStatus.pid})`);

    // Check server status
    const status = await mcpManager.getStatus();
    console.log('\nServer Status:');
    console.log(`  Running: ${status.running}`);
    console.log(`  PID: ${status.pid}`);
    console.log(`  Uptime: ${status.uptime ? `${status.uptime}ms` : 'N/A'}`);

    // Health check
    const healthy = await mcpManager.isHealthy();
    console.log(`  Healthy: ${healthy}`);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop server
    console.log('\nStopping MCP server...');
    await mcpManager.stopServer();
    console.log('MCP server stopped');
  } catch (error) {
    if (error instanceof CodexError) {
      console.error(`MCP error [${error.type}]:`, error.message);
    } else {
      console.error('Error:', error);
    }
  } finally {
    await mcpManager.cleanup();
  }
}

// ========================================
// Example 4: Full Integration with Bridge
// ========================================

async function example4_fullIntegration() {
  console.log('\n=== Example 4: Full Integration with Bridge ===\n');

  const bridge = new CodexBridge(
    {
      command: 'codex',
      sandboxMode: 'workspace-write',
      timeout: 120000,
      temperature: 0.7,
    },
    {
      enabled: true,
      command: 'codex',
      transport: 'stdio',
      autoStart: false, // Manual start for this example
    }
  );

  try {
    // Initialize bridge (checks CLI availability)
    console.log('Initializing Codex bridge...');
    const initStatus = await bridge.initialize();

    console.log('\nIntegration Status:');
    console.log(`  CLI Available: ${initStatus.cliAvailable}`);
    console.log(`  CLI Version: ${initStatus.version}`);
    console.log(`  Initialized: ${initStatus.initialized}`);

    // Execute a prompt
    console.log('\nExecuting prompt via bridge...');
    const result = await bridge.execute({
      prompt: 'What are the key principles of clean code?',
      maxTokens: 300,
    });

    console.log('\nResponse:');
    console.log(result.content.substring(0, 200) + '...');
    console.log(`Duration: ${result.duration}ms`);

    // Start MCP server if needed
    console.log('\nStarting MCP server...');
    await bridge.startMCPServer();

    const mcpHealthy = await bridge.isMCPServerHealthy();
    console.log(`MCP Server healthy: ${mcpHealthy}`);

    // Execute another prompt (with MCP server running)
    const result2 = await bridge.execute({
      prompt: 'List 5 design patterns',
      maxTokens: 200,
    });

    console.log('\nSecond response:');
    console.log(result2.content);

    // Stop MCP server
    await bridge.stopMCPServer();
    console.log('\nMCP server stopped');
  } catch (error) {
    if (error instanceof CodexError) {
      console.error(`\nError [${error.type}]:`, error.message);
    } else {
      console.error('\nError:', error);
    }
  } finally {
    await bridge.cleanup();
  }
}

// ========================================
// Example 5: Error Handling Patterns
// ========================================

async function example5_errorHandling() {
  console.log('\n=== Example 5: Error Handling Patterns ===\n');

  const cli = new CodexCLI({ command: 'codex' });

  // Pattern 1: Type-specific error handling
  try {
    await cli.execute({ prompt: 'test' });
  } catch (error) {
    if (error instanceof CodexError) {
      switch (error.type) {
        case CodexErrorType.CLI_NOT_FOUND:
          console.error('Install codex: npm i -g @openai/codex');
          break;
        case CodexErrorType.TIMEOUT:
          console.error('Request timed out, try increasing timeout');
          break;
        case CodexErrorType.EXECUTION_FAILED:
          console.error('Execution failed:', error.context);
          break;
        default:
          console.error('Codex error:', error.message);
      }
    }
  } finally {
    await cli.cleanup();
  }

  // Pattern 2: Retry with backoff
  async function executeWithRetry(prompt: string, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await cli.execute({ prompt });
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;

        const delay = 1000 * Math.pow(2, attempt);
        console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  try {
    const result = await executeWithRetry('Generate a haiku');
    console.log('Success after retries:', result.content);
  } catch (error) {
    console.error('All retries failed');
  }
}

// ========================================
// Example 6: Using Default Instances
// ========================================

async function example6_defaultInstances() {
  console.log('\n=== Example 6: Using Default Instances ===\n');

  // Get default CLI instance (shared across calls)
  const cli = getDefaultCLI();

  try {
    const result = await cli.execute({
      prompt: 'What is dependency injection?',
      maxTokens: 150,
    });

    console.log('Response:', result.content);
  } finally {
    await cli.cleanup();
  }

  // Get default bridge instance
  const bridge = getDefaultBridge(
    { command: 'codex', sandboxMode: 'workspace-write' },
    { enabled: false } // MCP disabled
  );

  try {
    await bridge.initialize();
    const result = await bridge.execute({
      prompt: 'Explain SOLID principles in one sentence each',
    });
    console.log('\nSOLID principles:', result.content);
  } finally {
    await bridge.cleanup();
  }
}

// ========================================
// Example 7: Advanced Configuration
// ========================================

async function example7_advancedConfiguration() {
  console.log('\n=== Example 7: Advanced Configuration ===\n');

  // Different sandbox modes
  const modes = ['workspace-write', 'full', 'none'] as const;

  for (const mode of modes) {
    const cli = new CodexCLI({
      command: 'codex',
      sandboxMode: mode,
      timeout: 30000,
    });

    try {
      console.log(`\nTesting sandbox mode: ${mode}`);
      const result = await cli.execute({
        prompt: 'Describe file system access in sandbox mode',
        maxTokens: 100,
      });
      console.log(`Response: ${result.content.substring(0, 100)}...`);
    } catch (error) {
      console.error(`Error in ${mode} mode:`, error);
    } finally {
      await cli.cleanup();
    }
  }

  // MCP with config overrides
  const mcpManager = new CodexMCPManager({
    enabled: true,
    command: 'codex',
    transport: 'stdio',
    configOverrides: {
      timeout: 60000,
      retries: 3,
    },
  });

  try {
    console.log('\nStarting MCP with custom config...');
    await mcpManager.startServer();
    console.log('MCP server started with custom configuration');
    await mcpManager.stopServer();
  } catch (error) {
    console.error('MCP error:', error);
  } finally {
    await mcpManager.cleanup();
  }
}

// ========================================
// Main Entry Point
// ========================================

async function main() {
  console.log('Codex CLI Integration - Usage Examples');
  console.log('==========================================\n');

  const examples = [
    { name: 'Basic Execution', fn: example1_basicExecution },
    { name: 'Streaming Execution', fn: example2_streamingExecution },
    { name: 'MCP Server Management', fn: example3_mcpServer },
    { name: 'Full Integration', fn: example4_fullIntegration },
    { name: 'Error Handling', fn: example5_errorHandling },
    { name: 'Default Instances', fn: example6_defaultInstances },
    { name: 'Advanced Configuration', fn: example7_advancedConfiguration },
  ];

  // Run examples (comment out ones you don't want to run)
  for (const { name, fn } of examples) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log('='.repeat(60));

    try {
      await fn();
    } catch (error) {
      console.error(`\nExample failed: ${error}`);
    }

    // Wait between examples
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n\nAll examples completed!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Export examples for use in other files
export {
  example1_basicExecution,
  example2_streamingExecution,
  example3_mcpServer,
  example4_fullIntegration,
  example5_errorHandling,
  example6_defaultInstances,
  example7_advancedConfiguration,
};
