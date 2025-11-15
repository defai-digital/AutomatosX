/**
 * load-test-validation.ts
 *
 * Load testing script for ADR-014 validation system.
 * Tests concurrent validation throughput and resource usage.
 *
 * Week 3 Day 1 - Load Testing
 *
 * Usage:
 *   npx tsx scripts/load-test-validation.ts
 *
 * Targets:
 *   - Throughput: > 10,000 operations/second
 *   - Memory increase: < 50MB
 *   - Error rate: 0%
 *   - P95 latency: < 5ms
 */

import { performance } from 'perf_hooks';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  validateParseResult,
  validateSymbol,
  validateSymbolBatch,
} from '../src/types/schemas/parser.schema.js';
import {
  validateFileInput,
  validateSymbolInput,
  validateSymbolInputBatch,
} from '../src/types/schemas/database.schema.js';
import type {
  ParseResult,
  Symbol as SymbolType,
} from '../src/parser/LanguageParser.js';
import type {
  FileInput,
  SymbolInput,
} from '../src/types/schemas/database.schema.js';

/**
 * Load test configuration
 */
interface LoadTestConfig {
  name: string;
  concurrency: number;
  operationsPerWorker: number;
  targetOpsPerSec: number;
  targetP95Ms: number;
}

/**
 * Load test result
 */
interface LoadTestResult {
  name: string;
  concurrency: number;
  totalOperations: number;
  durationSec: number;
  opsPerSec: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  errors: number;
  memoryIncreaseKB: number;
  passed: boolean;
}

/**
 * Generate test data
 */
function generateParseResult(): ParseResult {
  const symbols: SymbolType[] = [];
  for (let i = 0; i < 10; i++) {
    symbols.push({
      name: `function${i}`,
      kind: 'function',
      line: i * 10 + 1,
      column: 0,
      endLine: i * 10 + 5,
      endColumn: 10,
    });
  }
  return {
    symbols,
    parseTime: 12.5,
    nodeCount: 150 + symbols.length * 10,
  };
}

function generateSymbolInputs(count: number): SymbolInput[] {
  return Array.from({ length: count }, (_, i) => ({
    file_id: 1,
    name: `function${i}`,
    kind: 'function',
    line: i * 10 + 1,
    column: 0,
    end_line: i * 10 + 5,
    end_column: 10,
  }));
}

function generateFileInput(): FileInput {
  return {
    path: '/project/src/example.ts',
    content: 'export function example() { return 42; }',
    language: 'typescript',
  };
}

/**
 * Run load test
 */
async function loadTest(
  config: LoadTestConfig,
  operation: () => void
): Promise<LoadTestResult> {
  console.log(chalk.blue(`\nRunning: ${config.name}...`));
  console.log(`  Concurrency: ${config.concurrency} workers`);
  console.log(`  Operations per worker: ${config.operationsPerWorker}`);
  console.log(`  Total operations: ${config.concurrency * config.operationsPerWorker}`);

  const times: number[] = [];
  let errors = 0;

  // Measure initial memory
  if (global.gc) {
    global.gc();
  }
  const memoryBefore = process.memoryUsage().heapUsed;

  // Start load test
  const startTime = performance.now();

  const workers = Array(config.concurrency)
    .fill(null)
    .map(() => {
      return new Promise<void>((resolve) => {
        let completed = 0;
        const runOperation = () => {
          try {
            const opStart = performance.now();
            operation();
            const opEnd = performance.now();
            times.push(opEnd - opStart);
          } catch (error) {
            errors++;
          }

          completed++;
          if (completed >= config.operationsPerWorker) {
            resolve();
          } else {
            // Use setImmediate to yield to event loop
            setImmediate(runOperation);
          }
        };
        runOperation();
      });
    });

  await Promise.all(workers);

  const endTime = performance.now();

  // Measure final memory
  if (global.gc) {
    global.gc();
  }
  const memoryAfter = process.memoryUsage().heapUsed;
  const memoryIncreaseKB = (memoryAfter - memoryBefore) / 1024;

  // Calculate metrics
  const durationSec = (endTime - startTime) / 1000;
  const totalOperations = config.concurrency * config.operationsPerWorker;
  const opsPerSec = totalOperations / durationSec;

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avgMs = sum / times.length;
  const minMs = times[0];
  const maxMs = times[times.length - 1];
  const p50Ms = times[Math.floor(times.length * 0.5)];
  const p95Ms = times[Math.floor(times.length * 0.95)];
  const p99Ms = times[Math.floor(times.length * 0.99)];

  const passed =
    opsPerSec >= config.targetOpsPerSec &&
    p95Ms <= config.targetP95Ms &&
    errors === 0 &&
    memoryIncreaseKB < 50 * 1024; // 50MB

  return {
    name: config.name,
    concurrency: config.concurrency,
    totalOperations,
    durationSec,
    opsPerSec,
    avgMs,
    p50Ms,
    p95Ms,
    p99Ms,
    minMs,
    maxMs,
    errors,
    memoryIncreaseKB,
    passed,
  };
}

/**
 * Run all load tests
 */
async function runLoadTests(): Promise<LoadTestResult[]> {
  console.log(chalk.blue.bold('\n🚀 ADR-014 Validation Load Tests\n'));

  const results: LoadTestResult[] = [];

  // Test 1: ParseResult validation (low concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateParseResult (10 workers)',
        concurrency: 10,
        operationsPerWorker: 1000,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateParseResult(generateParseResult())
    )
  );

  // Test 2: ParseResult validation (high concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateParseResult (100 workers)',
        concurrency: 100,
        operationsPerWorker: 100,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateParseResult(generateParseResult())
    )
  );

  // Test 3: SymbolInput validation (low concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateSymbolInput (10 workers)',
        concurrency: 10,
        operationsPerWorker: 1000,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateSymbolInput(generateSymbolInputs(1)[0])
    )
  );

  // Test 4: SymbolInput validation (high concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateSymbolInput (100 workers)',
        concurrency: 100,
        operationsPerWorker: 100,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateSymbolInput(generateSymbolInputs(1)[0])
    )
  );

  // Test 5: Batch validation (10 symbols)
  results.push(
    await loadTest(
      {
        name: 'validateSymbolInputBatch (10 symbols, 10 workers)',
        concurrency: 10,
        operationsPerWorker: 1000,
        targetOpsPerSec: 5000,
        targetP95Ms: 10.0,
      },
      () => validateSymbolInputBatch(generateSymbolInputs(10))
    )
  );

  // Test 6: Batch validation (100 symbols)
  results.push(
    await loadTest(
      {
        name: 'validateSymbolInputBatch (100 symbols, 10 workers)',
        concurrency: 10,
        operationsPerWorker: 100,
        targetOpsPerSec: 1000,
        targetP95Ms: 20.0,
      },
      () => validateSymbolInputBatch(generateSymbolInputs(100))
    )
  );

  // Test 7: FileInput validation (low concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateFileInput (10 workers)',
        concurrency: 10,
        operationsPerWorker: 1000,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateFileInput(generateFileInput())
    )
  );

  // Test 8: FileInput validation (high concurrency)
  results.push(
    await loadTest(
      {
        name: 'validateFileInput (100 workers)',
        concurrency: 100,
        operationsPerWorker: 100,
        targetOpsPerSec: 10000,
        targetP95Ms: 5.0,
      },
      () => validateFileInput(generateFileInput())
    )
  );

  // Test 9: Mixed workload (realistic scenario)
  results.push(
    await loadTest(
      {
        name: 'Mixed workload (50 workers)',
        concurrency: 50,
        operationsPerWorker: 100,
        targetOpsPerSec: 5000,
        targetP95Ms: 10.0,
      },
      () => {
        // Simulate realistic workload: 40% parse, 40% symbol, 20% file
        const rand = Math.random();
        if (rand < 0.4) {
          validateParseResult(generateParseResult());
        } else if (rand < 0.8) {
          validateSymbolInput(generateSymbolInputs(1)[0]);
        } else {
          validateFileInput(generateFileInput());
        }
      }
    )
  );

  return results;
}

/**
 * Display results table
 */
function displayResults(results: LoadTestResult[]): void {
  const table = new Table({
    head: [
      chalk.bold('Test'),
      chalk.bold('Concurrency'),
      chalk.bold('Total Ops'),
      chalk.bold('Ops/Sec'),
      chalk.bold('Avg'),
      chalk.bold('P95'),
      chalk.bold('Errors'),
      chalk.bold('Mem (KB)'),
      chalk.bold('Status'),
    ],
    colWidths: [45, 14, 12, 12, 10, 10, 10, 12, 10],
  });

  for (const result of results) {
    const statusSymbol = result.passed ? chalk.green('✓') : chalk.red('✗');
    const statusText = result.passed ? chalk.green('PASS') : chalk.red('FAIL');

    table.push([
      result.name,
      result.concurrency.toString(),
      result.totalOperations.toLocaleString(),
      result.opsPerSec.toFixed(0),
      `${result.avgMs.toFixed(3)}ms`,
      `${result.p95Ms.toFixed(3)}ms`,
      result.errors.toString(),
      result.memoryIncreaseKB.toFixed(0),
      `${statusSymbol} ${statusText}`,
    ]);
  }

  console.log('\n' + table.toString());
}

/**
 * Display summary
 */
function displaySummary(results: LoadTestResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const passRate = (passed / total) * 100;

  const totalOps = results.reduce((sum, r) => sum + r.totalOperations, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationSec, 0);
  const avgOpsPerSec =
    results.reduce((sum, r) => sum + r.opsPerSec, 0) / results.length;
  const totalMemoryKB = results.reduce(
    (sum, r) => sum + r.memoryIncreaseKB,
    0
  );
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log(chalk.bold('\n📈 Summary:\n'));
  console.log(`Total Load Tests: ${total}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
  console.log(`Total Operations: ${totalOps.toLocaleString()}`);
  console.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
  console.log(`Average Throughput: ${avgOpsPerSec.toFixed(0)} ops/sec`);
  console.log(`Total Memory Increase: ${totalMemoryKB.toFixed(0)} KB`);
  console.log(`Total Errors: ${totalErrors}\n`);

  if (failed > 0) {
    console.log(chalk.red.bold('❌ Some load tests failed.\n'));
    console.log(chalk.yellow('Failed tests:'));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(chalk.yellow(`  - ${r.name}:`));
        console.log(
          chalk.yellow(
            `    Ops/sec: ${r.opsPerSec.toFixed(0)} (target: varies)`
          )
        );
        console.log(
          chalk.yellow(
            `    P95: ${r.p95Ms.toFixed(3)}ms (target: ${r.p95Ms <= 20 ? 'varies' : 'varies'})`
          )
        );
        console.log(chalk.yellow(`    Errors: ${r.errors}`));
      });
    console.log('');
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✅ All load tests passed!\n'));
    process.exit(0);
  }
}

/**
 * Main
 */
async function main() {
  try {
    // Check for --expose-gc flag
    if (!global.gc) {
      console.log(
        chalk.yellow(
          '\n⚠️  Warning: Run with --expose-gc flag for accurate memory measurements:'
        )
      );
      console.log(
        chalk.yellow('   node --expose-gc node_modules/.bin/tsx scripts/load-test-validation.ts\n')
      );
    }

    const results = await runLoadTests();
    displayResults(results);
    displaySummary(results);
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Load test failed with error:\n'));
    console.error(error);
    process.exit(1);
  }
}

main();
