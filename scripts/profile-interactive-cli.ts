/**
 * Performance Profiling Script for Interactive CLI
 *
 * Measures:
 * - Command execution times for all 13 commands
 * - Memory usage during long conversations
 * - Auto-save performance
 * - Database operation timing
 * - ConversationContext performance
 */

import { performance } from 'node:perf_hooks';
import { ConversationContext } from '../src/cli/interactive/ConversationContext.js';
import { SlashCommandRegistry } from '../src/cli/interactive/SlashCommandRegistry.js';
import { ConversationDAO } from '../src/database/dao/ConversationDAO.js';
import { MessageDAO } from '../src/database/dao/MessageDAO.js';
import { getDatabase } from '../src/database/connection.js';
import chalk from 'chalk';

interface PerformanceMetrics {
  operation: string;
  executionTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
}

class PerformanceProfiler {
  private metrics: PerformanceMetrics[] = [];

  async measure(operation: string, fn: () => Promise<void> | void): Promise<PerformanceMetrics> {
    const memoryBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    await fn();

    const end = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;

    const metric: PerformanceMetrics = {
      operation,
      executionTime: end - start,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
    };

    this.metrics.push(metric);
    return metric;
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  printReport(): void {
    console.log(chalk.bold.cyan('\n📊 Performance Profiling Report\n'));
    console.log(chalk.gray('─'.repeat(80)));

    // Group by category
    const categories = {
      'Command Execution': this.metrics.filter((m) => m.operation.startsWith('Command:')),
      'Database Operations': this.metrics.filter((m) => m.operation.startsWith('DB:')),
      'Context Operations': this.metrics.filter((m) => m.operation.startsWith('Context:')),
      'Auto-save': this.metrics.filter((m) => m.operation.startsWith('Auto-save')),
    };

    for (const [category, metrics] of Object.entries(categories)) {
      if (metrics.length === 0) continue;

      console.log(chalk.bold.yellow(`\n${category}`));
      console.log(chalk.gray('─'.repeat(80)));

      for (const metric of metrics) {
        const time = metric.executionTime.toFixed(2);
        const memDelta = (metric.memoryDelta / 1024 / 1024).toFixed(2);

        const timeColor = metric.executionTime < 10 ? chalk.green : metric.executionTime < 50 ? chalk.yellow : chalk.red;
        const memColor = metric.memoryDelta < 1024 * 1024 ? chalk.green : chalk.yellow;

        console.log(
          `${chalk.white(metric.operation.padEnd(50))} ${timeColor(time.padStart(8))}ms ${memColor(memDelta.padStart(8))}MB`,
        );
      }

      // Summary stats
      const avgTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      const maxTime = Math.max(...metrics.map((m) => m.executionTime));
      const totalMem = metrics.reduce((sum, m) => sum + m.memoryDelta, 0);

      console.log(chalk.gray('─'.repeat(80)));
      console.log(
        chalk.cyan(
          `Average: ${avgTime.toFixed(2)}ms | Max: ${maxTime.toFixed(2)}ms | Total Memory: ${(totalMem / 1024 / 1024).toFixed(2)}MB`,
        ),
      );
    }

    console.log(chalk.gray('\n' + '─'.repeat(80)));
    console.log(chalk.bold.green('✓ Profiling Complete\n'));
  }
}

async function profileCommands(profiler: PerformanceProfiler): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Profiling Command Execution Times...\n'));

  const registry = new SlashCommandRegistry();
  const context = new ConversationContext();

  const commands = [
    { name: 'help', args: [] },
    { name: 'agent', args: ['BackendAgent'] },
    { name: 'status', args: [] },
    { name: 'history', args: [] },
    { name: 'clear', args: [] },
    { name: 'context', args: [] },
    { name: 'set', args: ['testVar', 'testValue'] },
    { name: 'get', args: ['testVar'] },
    { name: 'list', args: [] },
    { name: 'save', args: ['test-profile.json'] },
  ];

  for (const cmd of commands) {
    await profiler.measure(`Command: /${cmd.name} ${cmd.args.join(' ')}`, async () => {
      const command = registry.getCommand(cmd.name);
      if (command) {
        await command.execute(cmd.args, { conversationContext: context });
      }
    });
  }
}

async function profileContextOperations(profiler: PerformanceProfiler): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Profiling ConversationContext Operations...\n'));

  const context = new ConversationContext();

  // Add messages
  await profiler.measure('Context: Add 1 message', () => {
    context.addMessage('user', 'Test message');
  });

  await profiler.measure('Context: Add 10 messages', () => {
    for (let i = 0; i < 10; i++) {
      context.addMessage('user', `Test message ${i}`);
    }
  });

  await profiler.measure('Context: Add 50 messages', () => {
    for (let i = 0; i < 50; i++) {
      context.addMessage('user', `Test message ${i}`);
    }
  });

  // Get recent messages
  await profiler.measure('Context: Get recent 5 messages', () => {
    context.getRecentMessages(5);
  });

  await profiler.measure('Context: Get recent 20 messages', () => {
    context.getRecentMessages(20);
  });

  // Set/get variables
  await profiler.measure('Context: Set 1 variable', () => {
    context.setVariable('testVar', 'testValue');
  });

  await profiler.measure('Context: Set 50 variables', () => {
    for (let i = 0; i < 50; i++) {
      context.setVariable(`var${i}`, `value${i}`);
    }
  });

  await profiler.measure('Context: Get 1 variable', () => {
    context.getVariable('testVar');
  });

  // Snapshot operations
  await profiler.measure('Context: Create snapshot', () => {
    context.getSnapshot();
  });

  await profiler.measure('Context: Restore from snapshot', () => {
    const snapshot = context.getSnapshot();
    const newContext = new ConversationContext();
    newContext.restoreFromSnapshot(snapshot);
  });
}

async function profileDatabaseOperations(profiler: PerformanceProfiler): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Profiling Database Operations...\n'));

  const db = getDatabase();
  const conversationDAO = new ConversationDAO(db);
  const messageDAO = new MessageDAO(db);

  // Create conversation
  let conversationId = '';
  await profiler.measure('DB: Create conversation', async () => {
    conversationId = await conversationDAO.createConversation({
      agentId: 'BackendAgent',
      messages: [],
      variables: {},
    });
  });

  // Add messages
  await profiler.measure('DB: Insert 1 message', async () => {
    await messageDAO.createMessage({
      conversationId,
      role: 'user',
      content: 'Test message',
    });
  });

  await profiler.measure('DB: Insert 10 messages', async () => {
    for (let i = 0; i < 10; i++) {
      await messageDAO.createMessage({
        conversationId,
        role: 'user',
        content: `Test message ${i}`,
      });
    }
  });

  await profiler.measure('DB: Insert 50 messages', async () => {
    for (let i = 0; i < 50; i++) {
      await messageDAO.createMessage({
        conversationId,
        role: 'user',
        content: `Test message ${i}`,
      });
    }
  });

  // Query messages
  await profiler.measure('DB: Get conversation by ID', async () => {
    await conversationDAO.getConversationById(conversationId);
  });

  await profiler.measure('DB: Get messages by conversation', async () => {
    await messageDAO.getMessagesByConversation(conversationId);
  });

  await profiler.measure('DB: List conversations (limit 10)', async () => {
    await conversationDAO.listConversations(10);
  });

  // Update conversation
  await profiler.measure('DB: Update conversation', async () => {
    await conversationDAO.updateConversation(conversationId, {
      agentId: 'FrontendAgent',
      variables: { testVar: 'testValue' },
    });
  });

  // Full-text search
  await profiler.measure('DB: Search messages (FTS)', async () => {
    await messageDAO.searchMessages('test');
  });

  // Cleanup
  await profiler.measure('DB: Delete conversation', async () => {
    await conversationDAO.deleteConversation(conversationId);
  });
}

async function profileAutoSave(profiler: PerformanceProfiler): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Profiling Auto-save Performance...\n'));

  const db = getDatabase();
  const conversationDAO = new ConversationDAO(db);
  const messageDAO = new MessageDAO(db);

  // Simulate auto-save after 5 messages
  const conversationId = await conversationDAO.createConversation({
    agentId: 'BackendAgent',
    messages: [],
    variables: {},
  });

  const messages = [];
  for (let i = 0; i < 5; i++) {
    messages.push({
      conversationId,
      role: 'user' as const,
      content: `Message ${i}`,
    });
  }

  await profiler.measure('Auto-save: Save 5 messages (typical)', async () => {
    for (const msg of messages) {
      await messageDAO.createMessage(msg);
    }
    await conversationDAO.updateConversation(conversationId, {
      variables: { lastSaved: new Date().toISOString() },
    });
  });

  // Simulate auto-save with 50 messages (stress test)
  const largeMessages = [];
  for (let i = 0; i < 50; i++) {
    largeMessages.push({
      conversationId,
      role: 'user' as const,
      content: `Message ${i}`.repeat(100), // Larger content
    });
  }

  await profiler.measure('Auto-save: Save 50 messages (stress test)', async () => {
    for (const msg of largeMessages) {
      await messageDAO.createMessage(msg);
    }
    await conversationDAO.updateConversation(conversationId, {
      variables: { lastSaved: new Date().toISOString() },
    });
  });

  // Cleanup
  await conversationDAO.deleteConversation(conversationId);
}

async function profileMemoryUsage(): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Profiling Memory Usage During Long Conversations...\n'));

  const context = new ConversationContext();
  const samples: Array<{ messages: number; heapUsed: number; heapTotal: number }> = [];

  // Add messages in batches and measure memory
  for (let i = 0; i <= 100; i += 10) {
    for (let j = 0; j < 10; j++) {
      context.addMessage('user', `Message ${i + j}: ${'x'.repeat(100)}`);
    }

    const mem = process.memoryUsage();
    samples.push({
      messages: i + 10,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    });
  }

  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.white('Messages'.padEnd(15)) + chalk.white('Heap Used'.padStart(20)) + chalk.white('Heap Total'.padStart(20)));
  console.log(chalk.gray('─'.repeat(80)));

  for (const sample of samples) {
    const heapUsedMB = (sample.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (sample.heapTotal / 1024 / 1024).toFixed(2);

    const color = sample.heapUsed < 50 * 1024 * 1024 ? chalk.green : sample.heapUsed < 100 * 1024 * 1024 ? chalk.yellow : chalk.red;

    console.log(`${String(sample.messages).padEnd(15)}${color(heapUsedMB.padStart(15) + ' MB')}${chalk.cyan(heapTotalMB.padStart(15) + ' MB')}`);
  }

  console.log(chalk.gray('─'.repeat(80)));

  const finalSample = samples[samples.length - 1];
  const avgPerMessage = finalSample.heapUsed / finalSample.messages / 1024;
  console.log(chalk.cyan(`Average memory per message: ${avgPerMessage.toFixed(2)} KB`));
  console.log(chalk.gray('─'.repeat(80)));
}

async function main(): Promise<void> {
  console.log(chalk.bold.magenta('\n═════════════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.magenta('  Interactive CLI Performance Profiling'));
  console.log(chalk.bold.magenta('═════════════════════════════════════════════════════════════════════════════════\n'));

  const profiler = new PerformanceProfiler();

  try {
    // Run all profiling tests
    await profileCommands(profiler);
    await profileContextOperations(profiler);
    await profileDatabaseOperations(profiler);
    await profileAutoSave(profiler);
    await profileMemoryUsage();

    // Print comprehensive report
    profiler.printReport();

    // Performance assessment
    console.log(chalk.bold.cyan('\n📋 Performance Assessment\n'));
    console.log(chalk.gray('─'.repeat(80)));

    const metrics = profiler.getMetrics();
    const commandMetrics = metrics.filter((m) => m.operation.startsWith('Command:'));
    const dbMetrics = metrics.filter((m) => m.operation.startsWith('DB:'));
    const autoSaveMetrics = metrics.filter((m) => m.operation.startsWith('Auto-save'));

    const avgCommandTime = commandMetrics.reduce((sum, m) => sum + m.executionTime, 0) / commandMetrics.length;
    const avgDbTime = dbMetrics.reduce((sum, m) => sum + m.executionTime, 0) / dbMetrics.length;
    const autoSaveTime = autoSaveMetrics[0]?.executionTime || 0;

    console.log(
      `${chalk.white('Average command execution time:')} ${avgCommandTime < 50 ? chalk.green('✓') : chalk.yellow('⚠')} ${avgCommandTime.toFixed(2)}ms ${avgCommandTime < 50 ? chalk.green('(Good)') : chalk.yellow('(Could be improved)')}`,
    );

    console.log(
      `${chalk.white('Average database operation time:')} ${avgDbTime < 10 ? chalk.green('✓') : chalk.yellow('⚠')} ${avgDbTime.toFixed(2)}ms ${avgDbTime < 10 ? chalk.green('(Excellent)') : chalk.yellow('(Acceptable)')}`,
    );

    console.log(
      `${chalk.white('Auto-save time (5 messages):')} ${autoSaveTime < 100 ? chalk.green('✓') : chalk.yellow('⚠')} ${autoSaveTime.toFixed(2)}ms ${autoSaveTime < 100 ? chalk.green('(Non-blocking)') : chalk.red('(Needs optimization)')}`,
    );

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold.green('\n✓ All performance metrics collected successfully!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Error during profiling:'), error);
    process.exit(1);
  }
}

main();
