// Sprint 2 Day 13: Memory Search Command Handler
// Handler for `ax memory search "<query>"` CLI command
import { MemorySearchSchema } from '../schemas/MemorySearchSchema.js';
import { errorHandler } from '../../utils/ErrorEnvelope.js';
import { StreamingLogger } from '../../utils/StreamingLogger.js';
/**
 * Memory search handler
 *
 * @param rawArgs - Raw command arguments
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await memorySearchCommand({
 *   query: 'authentication implementation',
 *   agent: 'backend',
 *   limit: 10
 * })
 * ```
 */
export async function memorySearchCommand(rawArgs) {
    const logger = new StreamingLogger({ minLevel: 'info' });
    try {
        // 1. Validate inputs
        logger.debug('Validating command arguments...');
        const args = MemorySearchSchema.parse(rawArgs);
        if (args.verbose) {
            logger.setMinLevel('debug');
        }
        // 2. Log search start
        logger.info(`Searching memory: "${args.query}"`);
        logger.debug('Search parameters', {
            query: args.query,
            agent: args.agent,
            limit: args.limit,
            offset: args.offset,
            sortBy: args.sortBy,
            exactMatch: args.exactMatch,
        });
        // 3. Execute search (TODO: Integrate with MemoryService)
        logger.info('Executing search query...');
        // const memoryService = new MemoryService()
        // const results = await memoryService.search({
        //   query: args.query,
        //   limit: args.limit,
        //   offset: args.offset,
        //   agent: args.agent,
        //   dateFrom: args.dateFrom ? new Date(args.dateFrom) : undefined,
        //   dateTo: args.dateTo ? new Date(args.dateTo) : undefined,
        //   tags: args.tags,
        //   exactMatch: args.exactMatch,
        //   sortBy: args.sortBy,
        // })
        // Mock results for now
        const results = await mockMemorySearch(args, logger);
        // 4. Format and display results
        logger.info(`Found ${results.length} results`);
        if (args.format === 'json' || args.json) {
            console.log(JSON.stringify(results, null, 2));
        }
        else if (args.format === 'table') {
            printTableResults(results, args.verbose);
        }
        else {
            printTextResults(results, args.verbose);
        }
    }
    catch (error) {
        await errorHandler(error, {
            debug: rawArgs?.debug,
            json: rawArgs?.json,
        });
    }
}
/**
 * Mock memory search for testing
 */
async function mockMemorySearch(args, logger) {
    logger.debug('Querying SQLite FTS5 index...');
    await new Promise(resolve => setTimeout(resolve, 50));
    return [
        {
            id: '1',
            agent: 'backend',
            query: 'authentication',
            timestamp: '2025-01-08T10:00:00Z',
            relevance: 0.95,
        },
        {
            id: '2',
            agent: 'backend',
            query: 'user login',
            timestamp: '2025-01-07T14:30:00Z',
            relevance: 0.87,
        },
    ];
}
/**
 * Print results in table format
 */
function printTableResults(results, verbose) {
    console.log('\n┌────────────────────────────────────────────────────────────┐');
    console.log('│ ID   │ Agent      │ Timestamp           │ Relevance │');
    console.log('├────────────────────────────────────────────────────────────┤');
    results.forEach(result => {
        console.log(`│ ${result.id.padEnd(4)} │ ${result.agent.padEnd(10)} │ ${result.timestamp.substring(0, 19)} │ ${(result.relevance * 100).toFixed(0)}%      │`);
    });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}
/**
 * Print results in text format
 */
function printTextResults(results, verbose) {
    results.forEach((result, i) => {
        console.log(`\n${i + 1}. [${result.agent}] ${result.timestamp}`);
        console.log(`   Relevance: ${(result.relevance * 100).toFixed(0)}%`);
        if (verbose) {
            console.log(`   ID: ${result.id}`);
        }
    });
    console.log('');
}
//# sourceMappingURL=memorySearchCommand.js.map