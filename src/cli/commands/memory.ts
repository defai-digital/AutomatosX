/**
 * memory.ts
 *
 * CLI commands for memory and conversation management
 */

import { Command } from 'commander';
import { getDatabase } from '../../database/connection.js';
import { MemoryService } from '../../memory/MemoryService.js';
import { MemoryExporter } from '../../memory/MemoryExporter.js';
import { MemoryAnalytics } from '../../memory/MemoryAnalytics.js';
import Table from 'cli-table3';
import chalk from 'chalk';
import { writeFileSync } from 'fs';

/**
 * Format timestamp to readable string
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format duration (in ms) to readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get MemoryService instance
 */
function getMemoryService(): MemoryService {
  const db = getDatabase();
  return new MemoryService(db);
}

/**
 * Get MemoryExporter instance
 */
function getMemoryExporter(): MemoryExporter {
  const memoryService = getMemoryService();
  return new MemoryExporter(memoryService);
}

/**
 * Create memory commands group
 */
export function createMemoryCommand(): Command {
  const memory = new Command('memory')
    .description('Memory and conversation management')
    .addHelpText(
      'after',
      `
Examples:
  $ ax memory search "REST API"                      # Search (hybrid mode)
  $ ax memory search "authentication" --semantic     # Semantic search
  $ ax memory search "function getUserById" --exact  # Exact keyword search
  $ ax memory index --all                            # Index all messages
  $ ax memory list --agent backend                   # List conversations
  $ ax memory show <conversation-id>                 # Show conversation
  $ ax memory export --output backup.json            # Export conversations
  $ ax memory stats                                  # Show statistics
    `
    );

  // ========================================================================
  // ax memory search
  // ========================================================================
  memory
    .command('search')
    .description('Search conversation history with semantic, hybrid, or exact search')
    .argument('<query>', 'Search query')
    .option('-l, --limit <number>', 'Limit results', '10')
    .option('-a, --agent <agent>', 'Filter by agent ID')
    .option('-u, --user <user>', 'Filter by user ID')
    .option('-c, --conversation <id>', 'Filter by conversation ID')
    .option('-v, --verbose', 'Show full message content')
    .option('--semantic', 'Use semantic search (vector similarity only)')
    .option('--hybrid', 'Use hybrid search (FTS5 + vector, default)')
    .option('--exact', 'Use exact search (FTS5 keyword matching only)')
    .action(async (query, options) => {
      try {
        const memoryService = getMemoryService();
        const limit = parseInt(options.limit);

        // Validate mutually exclusive flags
        const modes = [options.semantic, options.hybrid, options.exact].filter(Boolean);
        if (modes.length > 1) {
          console.error(chalk.red('\nError: Cannot use --semantic, --hybrid, and --exact together\n'));
          process.exit(1);
        }

        // Determine search mode (default: hybrid)
        const searchMode = options.semantic ? 'semantic' :
                           options.exact ? 'exact' :
                           'hybrid';

        console.log(chalk.bold(`\n🔍 Searching (${searchMode}): "${query}"\n`));

        // Route to appropriate search method
        let messages: any[] = [];
        let conversations: any[] = [];
        let total = 0;
        let hasMore = false;

        if (searchMode === 'semantic') {
          // Semantic search (vector-only)
          const results = await memoryService.searchMessagesSemantic(query, {
            conversationId: options.conversation,
            agentId: options.agent,
            userId: options.user,
            limit,
          });

          messages = results.messages;
          total = results.total;
          hasMore = results.hasMore;

          // Fetch conversations for display
          const conversationIds = [...new Set(messages.map(m => m.conversationId))];
          conversations = (await Promise.all(
            conversationIds.map(id => memoryService.getConversation(id))
          )).filter(Boolean) as any[];

        } else if (searchMode === 'hybrid') {
          // Hybrid search (FTS5 + vector)
          const results = await memoryService.searchMessagesHybrid(query, {
            conversationId: options.conversation,
            agentId: options.agent,
            userId: options.user,
            limit,
            ftsWeight: 0.4,
            vectorWeight: 0.6,
          });

          messages = results.messages;
          total = results.total;
          hasMore = results.hasMore;

          // Fetch conversations for display
          const conversationIds = [...new Set(messages.map(m => m.conversationId))];
          conversations = (await Promise.all(
            conversationIds.map(id => memoryService.getConversation(id))
          )).filter(Boolean) as any[];

        } else {
          // Exact search (FTS5-only)
          const results = await memoryService.searchMessages({
            query,
            limit,
            offset: 0,
            conversationId: options.conversation,
            agentId: options.agent,
            userId: options.user,
            sortBy: 'relevance',
            sortOrder: 'desc',
            includeArchived: false,
            includeDeleted: false,
            skipCount: false,
          });

          messages = results.messages;
          conversations = results.conversations;
          total = results.total;
          hasMore = results.hasMore;
        }

        const searchResults = { messages, conversations, total, hasMore };

        if (searchResults.messages.length === 0) {
          console.log(chalk.yellow('No messages found matching your query.\n'));
          return;
        }

        console.log(
          chalk.green(
            `Found ${searchResults.total} messages (showing ${searchResults.messages.length}):\n`
          )
        );

        for (const msg of searchResults.messages) {
          const conversation = searchResults.conversations.find(
            (c) => c.id === msg.conversationId
          );

          console.log(chalk.cyan(`[${msg.role.toUpperCase()}]`), chalk.gray(formatTimestamp(msg.createdAt)));

          // Show relevance scores for semantic/hybrid modes
          if (searchMode !== 'exact' && msg.score !== undefined) {
            if (searchMode === 'hybrid' && msg.ftsScore !== undefined && msg.vectorScore !== undefined) {
              console.log(
                chalk.magenta(`  Score: ${msg.score.toFixed(4)} `) +
                chalk.gray(`(FTS: ${msg.ftsScore.toFixed(3)}, Vector: ${msg.vectorScore.toFixed(3)})`)
              );
            } else {
              console.log(chalk.magenta(`  Score: ${msg.score.toFixed(4)}`));
            }
          }

          if (conversation) {
            console.log(
              chalk.gray(`  Conversation: ${conversation.title} (${conversation.agentId})`)
            );
          }

          if (options.verbose) {
            console.log(chalk.white(`  ${msg.content}`));
          } else {
            console.log(chalk.white(`  ${truncate(msg.content, 120)}`));
          }

          if (msg.tokens) {
            console.log(chalk.gray(`  Tokens: ${msg.tokens}`));
          }

          console.log(); // Empty line
        }

        if (searchResults.hasMore) {
          console.log(
            chalk.blue(
              `💡 Tip: Use --limit to see more results (max: ${searchResults.total})`
            )
          );
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error searching messages:'), error);
        process.exit(1);
      }
    });

  // ========================================================================
  // ax memory list
  // ========================================================================
  memory
    .command('list')
    .description('List recent conversations')
    .option('-a, --agent <agent>', 'Filter by agent ID')
    .option('-u, --user <user>', 'Filter by user ID')
    .option('-s, --state <state>', 'Filter by state (idle/active/archived)')
    .option('-l, --limit <number>', 'Limit results', '10')
    .option('--archived', 'Include archived conversations')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const memoryService = getMemoryService();
        const limit = Math.min(parseInt(options.limit), 100);

        const result = await memoryService.listConversations({
          agentId: options.agent,
          userId: options.user,
          state: options.state,
          limit,
          offset: 0,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          includeArchived: options.archived || false,
          includeDeleted: false,
        });

        if (result.conversations.length === 0) {
          console.log(chalk.yellow('\nNo conversations found.\n'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(
          chalk.bold(
            `\n💬 Conversations (${result.total} total, showing ${result.conversations.length}):\n`
          )
        );

        const table = new Table({
          head: [
            chalk.cyan('ID'),
            chalk.cyan('Title'),
            chalk.cyan('Agent'),
            chalk.cyan('Messages'),
            chalk.cyan('Tokens'),
            chalk.cyan('Updated'),
          ],
          colWidths: [40, 30, 15, 10, 10, 20],
        });

        for (const conv of result.conversations) {
          table.push([
            truncate(conv.id, 36),
            truncate(conv.title, 26),
            conv.agentId,
            chalk.blue(conv.messageCount.toString()),
            chalk.yellow(conv.totalTokens.toString()),
            chalk.gray(formatTimestamp(conv.updatedAt)),
          ]);
        }

        console.log(table.toString());

        if (result.hasMore) {
          console.log(chalk.blue(`\n💡 Tip: Use --limit to see more results`));
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error listing conversations:'), error);
        process.exit(1);
      }
    });

  // ========================================================================
  // ax memory show
  // ========================================================================
  memory
    .command('show')
    .description('Show conversation details with messages')
    .argument('<conversation-id>', 'Conversation ID')
    .option('-l, --limit <number>', 'Limit messages shown', '100')
    .option('--json', 'Output as JSON')
    .action(async (conversationId, options) => {
      try {
        const memoryService = getMemoryService();

        const conversation = await memoryService.getConversationWithMessages(conversationId);

        if (!conversation) {
          console.error(chalk.red(`\nConversation ${conversationId} not found.\n`));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(conversation, null, 2));
          return;
        }

        // Header
        console.log(chalk.bold('\n📝 Conversation Details:\n'));

        const infoTable = new Table({
          colWidths: [20, 60],
        });

        infoTable.push(
          ['ID', chalk.gray(conversation.id)],
          ['Title', chalk.white(conversation.title)],
          ['Agent', chalk.cyan(conversation.agentId)],
          ['State', conversation.state === 'active' ? chalk.green(conversation.state) : chalk.gray(conversation.state)],
          ['Messages', chalk.blue(conversation.messageCount.toString())],
          ['Total Tokens', chalk.yellow(conversation.totalTokens.toString())],
          ['Created', chalk.gray(formatTimestamp(conversation.createdAt))],
          ['Updated', chalk.gray(formatTimestamp(conversation.updatedAt))]
        );

        if (conversation.userId) {
          infoTable.push(['User', chalk.gray(conversation.userId)]);
        }

        if (conversation.archivedAt) {
          infoTable.push([
            'Archived',
            chalk.yellow(formatTimestamp(conversation.archivedAt)),
          ]);
        }

        console.log(infoTable.toString());

        // Messages
        if (conversation.messages && conversation.messages.length > 0) {
          const limit = parseInt(options.limit);
          const messages = conversation.messages.slice(0, limit);

          console.log(chalk.bold(`\n💬 Messages (${messages.length} of ${conversation.messages.length}):\n`));

          for (const msg of messages) {
            const roleColor = msg.role === 'user' ? chalk.cyan : msg.role === 'assistant' ? chalk.green : chalk.gray;

            console.log(roleColor(`[${msg.role.toUpperCase()}]`), chalk.gray(formatTimestamp(msg.createdAt)));
            console.log(chalk.white(msg.content));

            if (msg.tokens) {
              console.log(chalk.gray(`Tokens: ${msg.tokens}`));
            }

            console.log(); // Empty line
          }

          if (conversation.messages.length > limit) {
            console.log(
              chalk.blue(
                `💡 Showing ${limit} of ${conversation.messages.length} messages. Use --limit to see more.`
              )
            );
          }
        } else {
          console.log(chalk.gray('\n(No messages in this conversation)\n'));
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error showing conversation:'), error);
        process.exit(1);
      }
    });

  // ========================================================================
  // ax memory export
  // ========================================================================
  memory
    .command('export')
    .description('Export conversations to file')
    .option('-o, --output <file>', 'Output file', 'memory-export.json')
    .option('-f, --format <format>', 'Format (json, csv, markdown)', 'json')
    .option('-a, --agent <agent>', 'Filter by agent ID')
    .option('-u, --user <user>', 'Filter by user ID')
    .option('--archived', 'Include archived conversations')
    .option('--deleted', 'Include deleted conversations')
    .action(async (options) => {
      try {
        const memoryExporter = getMemoryExporter();

        console.log(chalk.bold('\n📦 Exporting conversations...\n'));

        const format = options.format as 'json' | 'csv' | 'markdown';
        const result = await memoryExporter.export(options.output, format, {
          agentId: options.agent,
          userId: options.user,
          includeArchived: options.archived || false,
          includeDeleted: options.deleted || false,
          format,
        });

        console.log(chalk.green(`✓ Successfully exported ${result.conversationCount} conversations`));
        console.log(chalk.gray(`  Messages: ${result.messageCount}`));
        console.log(chalk.gray(`  Format: ${result.format}`));
        console.log(chalk.gray(`  Size: ${(result.sizeBytes / 1024).toFixed(2)} KB`));
        console.log(chalk.gray(`  File: ${result.filePath}`));

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error exporting conversations:'), error);
        process.exit(1);
      }
    });

  // ========================================================================
  // ax memory index
  // ========================================================================
  memory
    .command('index')
    .description('Index messages for semantic search (generate embeddings)')
    .argument('[conversationId]', 'Conversation ID to index (optional)')
    .option('--all', 'Index all conversations')
    .option('--force', 'Re-index messages that already have embeddings')
    .option('--batch-size <number>', 'Batch size for indexing', '100')
    .action(async (conversationId, options) => {
      try {
        const memoryService = getMemoryService();
        const batchSize = parseInt(options.batchSize);

        // Validate arguments
        if (conversationId && options.all) {
          console.error(chalk.red('\nError: Cannot specify both conversationId and --all\n'));
          process.exit(1);
        }

        const targetConversation = options.all ? undefined : conversationId;

        console.log(chalk.bold('\n🔄 Indexing Messages for Semantic Search\n'));

        if (options.all) {
          console.log(chalk.gray('Target: All conversations'));
        } else if (conversationId) {
          console.log(chalk.gray(`Target: Conversation ${conversationId}`));
        } else {
          console.log(chalk.gray('Target: Recent messages'));
        }

        console.log(chalk.gray(`Batch size: ${batchSize}`));
        console.log(chalk.gray(`Force re-index: ${options.force ? 'Yes' : 'No'}\n`));

        const startTime = Date.now();

        const result = await memoryService.indexExistingMessages(targetConversation, {
          batchSize,
          force: options.force,
          onProgress: (indexed, total) => {
            const percent = ((indexed / total) * 100).toFixed(1);
            process.stdout.write(`\r${chalk.blue('Progress:')} ${indexed}/${total} (${percent}%)  `);
          },
        });

        console.log('\n'); // New line after progress

        // Results table
        const resultsTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [25, 15],
        });

        resultsTable.push(
          ['Messages Indexed', chalk.green(result.indexed.toString())],
          ['Messages Skipped', chalk.yellow(result.skipped.toString())],
          ['Messages Failed', result.failed > 0 ? chalk.red(result.failed.toString()) : chalk.gray('0')],
          ['Duration', chalk.gray(formatDuration(result.duration))]
        );

        console.log(resultsTable.toString());

        // Success message
        if (result.failed === 0) {
          console.log(chalk.green('\n✅ Indexing completed successfully!\n'));
        } else {
          console.log(chalk.yellow('\n⚠️  Indexing completed with errors. Check logs for details.\n'));
        }

        // Show updated coverage
        const stats = await memoryService.getEmbeddingStats();
        console.log(chalk.gray(`Embedding coverage: ${stats.coveragePercent.toFixed(1)}% (${stats.totalEmbeddings}/${stats.totalMessages})\n`));

      } catch (error) {
        console.error(chalk.red('Error indexing messages:'), error);
        process.exit(1);
      }
    });

  // ========================================================================
  // ax memory stats
  // ========================================================================
  memory
    .command('stats')
    .description('Show memory system statistics')
    .option('-v, --verbose', 'Show detailed statistics')
    .action(async (options) => {
      try {
        const memoryService = getMemoryService();

        console.log(chalk.bold('\n📊 Memory System Statistics\n'));

        const analytics = new MemoryAnalytics(memoryService);
        const stats = await analytics.getMemoryUsageMetrics();
        const embeddingStats = await memoryService.getEmbeddingStats();

        // Overview Table
        const overviewTable = new Table({
          head: [chalk.cyan('Metric'), chalk.cyan('Value')],
          colWidths: [30, 20],
        });

        overviewTable.push(
          ['Total Conversations', chalk.blue(stats.totalConversations.toLocaleString())],
          ['Active Conversations', chalk.green(stats.activeConversations.toLocaleString())],
          ['Archived Conversations', chalk.yellow(stats.archivedConversations.toLocaleString())],
          ['Deleted Conversations', chalk.red(stats.deletedConversations.toLocaleString())],
          ['Total Messages', chalk.blue(stats.totalMessages.toLocaleString())],
          ['Total Tokens', chalk.yellow(stats.totalTokens.toLocaleString())],
          [
            'Avg Messages/Conversation',
            chalk.gray(stats.averageMessagesPerConversation.toFixed(1)),
          ],
          ['Avg Tokens/Message', chalk.gray(stats.averageTokensPerMessage.toFixed(1))],
          ['Storage Estimate', chalk.gray(`${stats.storageEstimateMB.toFixed(2)} MB`)],
          ['─'.repeat(28), '─'.repeat(18)], // Separator
          ['Embedding Coverage', chalk.magenta(`${embeddingStats.coveragePercent.toFixed(1)}% (${embeddingStats.totalEmbeddings}/${embeddingStats.totalMessages})`)],
          ['Model Version', chalk.gray(embeddingStats.currentModelVersion || 'N/A')]
        );

        console.log(overviewTable.toString());

        // Time Range
        if (stats.oldestConversation && stats.newestConversation) {
          console.log(chalk.bold('\n📅 Time Range:\n'));
          console.log(
            chalk.gray(`  Oldest: ${formatTimestamp(stats.oldestConversation)}`)
          );
          console.log(
            chalk.gray(`  Newest: ${formatTimestamp(stats.newestConversation)}`)
          );

          const range = stats.newestConversation - stats.oldestConversation;
          console.log(chalk.gray(`  Span: ${formatDuration(range)}`));
        }

        // Insights
        if (stats.totalConversations > 0) {
          console.log(chalk.bold('\n💡 Insights:\n'));

          if (stats.averageMessagesPerConversation < 2) {
            console.log(
              chalk.yellow(
                '  ⚠ Low average messages per conversation - consider consolidating'
              )
            );
          } else if (stats.averageMessagesPerConversation > 10) {
            console.log(
              chalk.green(
                '  ✓ Good conversation engagement with multiple messages'
              )
            );
          }

          if (stats.archivedConversations > stats.activeConversations * 2) {
            console.log(
              chalk.blue(
                '  ℹ Many archived conversations - consider cleaning up old archives'
              )
            );
          }

          const deletedPercent = (stats.deletedConversations / stats.totalConversations) * 100;
          if (deletedPercent > 10) {
            console.log(
              chalk.yellow(
                `  ⚠ ${deletedPercent.toFixed(1)}% of conversations are deleted - consider permanent cleanup`
              )
            );
          }

          // Embedding coverage insights
          if (embeddingStats.totalMessages > 0) {
            if (embeddingStats.coveragePercent < 50) {
              console.log(
                chalk.yellow(
                  '  ⚠ Low embedding coverage - run `ax memory index --all` to enable semantic search'
                )
              );
            } else if (embeddingStats.coveragePercent === 100) {
              console.log(
                chalk.green(
                  '  ✓ All messages indexed for semantic search'
                )
              );
            } else {
              console.log(
                chalk.blue(
                  `  ℹ ${embeddingStats.coveragePercent.toFixed(1)}% of messages indexed for semantic search`
                )
              );
            }
          }
        }

        console.log(); // Empty line for spacing
      } catch (error) {
        console.error(chalk.red('Error getting statistics:'), error);
        process.exit(1);
      }
    });

  return memory;
}
