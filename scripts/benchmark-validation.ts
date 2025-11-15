/**
 * benchmark-validation.ts
 *
 * Performance benchmark script for ADR-014 validation system.
 * Tests validation performance against defined targets.
 *
 * Week 3 Day 1 - Performance Benchmarking
 *
 * Usage:
 *   npx tsx scripts/benchmark-validation.ts
 *
 * Targets:
 *   - validateParseResult (minimal): < 0.5ms
 *   - validateParseResult (10 symbols): < 2.0ms
 *   - validateSymbolInput: < 0.1ms
 *   - validateSymbolInputBatch (100): < 5.0ms
 *   - validateSymbolInputBatch (1000): < 50.0ms
 *   - validateFileInput: < 0.05ms
 *   - validateFileUpdateInput: < 0.05ms
 *   - Full workflow (parse + validate): < 5.0ms
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
  validateFileUpdate,
  validateSymbolInput,
  validateSymbolInputBatch,
} from '../src/types/schemas/database.schema.js';
import type {
  ParseResult,
  Symbol as SymbolType,
} from '../src/parser/LanguageParser.js';
import type {
  FileInput,
  FileUpdate,
  SymbolInput,
} from '../src/types/schemas/database.schema.js';

/**
 * Benchmark result
 */
interface BenchmarkResult {
  operation: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  targetMs: number;
  passed: boolean;
}

/**
 * Run benchmark for a function
 */
function benchmark(
  name: string,
  fn: () => void,
  iterations: number,
  targetMs: number
): BenchmarkResult {
  const times: number[] = [];

  // Warmup (100 iterations)
  for (let i = 0; i < 100; i++) {
    fn();
  }

  // Clear any GC pressure
  if (global.gc) {
    global.gc();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Sort for percentiles
  times.sort((a, b) => a - b);

  const sum = times.reduce((a, b) => a + b, 0);
  const avgMs = sum / times.length;
  const minMs = times[0];
  const maxMs = times[times.length - 1];
  const p50Ms = times[Math.floor(times.length * 0.5)];
  const p95Ms = times[Math.floor(times.length * 0.95)];
  const p99Ms = times[Math.floor(times.length * 0.99)];

  return {
    operation: name,
    iterations,
    avgMs,
    minMs,
    maxMs,
    p50Ms,
    p95Ms,
    p99Ms,
    targetMs,
    passed: p95Ms <= targetMs,
  };
}

/**
 * Generate test data
 */
function generateMinimalParseResult(): ParseResult {
  return {
    symbols: [],
    parseTime: 5.2,
    nodeCount: 42,
  };
}

function generateParseResultWithSymbols(count: number): ParseResult {
  const symbols: SymbolType[] = [];
  for (let i = 0; i < count; i++) {
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
    nodeCount: 150 + count * 10,
  };
}

function generateSymbolInput(index: number): SymbolInput {
  return {
    file_id: 1,
    name: `function${index}`,
    kind: 'function',
    line: index * 10 + 1,
    column: 0,
    end_line: index * 10 + 5,
    end_column: 10,
  };
}

function generateFileInput(): FileInput {
  return {
    path: '/project/src/example.ts',
    content: 'export function example() { return 42; }',
    language: 'typescript',
  };
}

function generateFileUpdate(): FileUpdate {
  return {
    content: 'export function updated() { return 100; }',
    language: 'typescript',
  };
}

/**
 * Run all benchmarks
 */
async function runBenchmarks(): Promise<BenchmarkResult[]> {
  console.log(chalk.blue.bold('\n📊 ADR-014 Validation Performance Benchmarks\n'));

  const results: BenchmarkResult[] = [];

  // Benchmark 1: validateParseResult (minimal)
  console.log('Running: validateParseResult (minimal)...');
  const minimalParseResult = generateMinimalParseResult();
  results.push(
    benchmark(
      'validateParseResult (minimal)',
      () => validateParseResult(minimalParseResult),
      10000,
      0.5
    )
  );

  // Benchmark 2: validateParseResult (10 symbols)
  console.log('Running: validateParseResult (10 symbols)...');
  const parseResultWith10Symbols = generateParseResultWithSymbols(10);
  results.push(
    benchmark(
      'validateParseResult (10 symbols)',
      () => validateParseResult(parseResultWith10Symbols),
      10000,
      2.0
    )
  );

  // Benchmark 3: validateSymbolInput (single)
  console.log('Running: validateSymbolInput (single)...');
  const symbolInput = generateSymbolInput(0);
  results.push(
    benchmark(
      'validateSymbolInput (single)',
      () => validateSymbolInput(symbolInput),
      10000,
      0.1
    )
  );

  // Benchmark 4: validateSymbolInputBatch (100 symbols)
  console.log('Running: validateSymbolInputBatch (100 symbols)...');
  const symbolInputs100 = Array.from({ length: 100 }, (_, i) =>
    generateSymbolInput(i)
  );
  results.push(
    benchmark(
      'validateSymbolInputBatch (100)',
      () => validateSymbolInputBatch(symbolInputs100),
      1000,
      5.0
    )
  );

  // Benchmark 5: validateSymbolInputBatch (1000 symbols)
  console.log('Running: validateSymbolInputBatch (1000 symbols)...');
  const symbolInputs1000 = Array.from({ length: 1000 }, (_, i) =>
    generateSymbolInput(i)
  );
  results.push(
    benchmark(
      'validateSymbolInputBatch (1000)',
      () => validateSymbolInputBatch(symbolInputs1000),
      100,
      50.0
    )
  );

  // Benchmark 6: validateFileInput
  console.log('Running: validateFileInput...');
  const fileInput = generateFileInput();
  results.push(
    benchmark(
      'validateFileInput',
      () => validateFileInput(fileInput),
      10000,
      0.05
    )
  );

  // Benchmark 7: validateFileUpdate
  console.log('Running: validateFileUpdate...');
  const fileUpdate = generateFileUpdate();
  results.push(
    benchmark(
      'validateFileUpdate',
      () => validateFileUpdate(fileUpdate),
      10000,
      0.05
    )
  );

  // Benchmark 8: Full workflow (parse + validate + insert preparation)
  console.log('Running: Full workflow simulation...');
  results.push(
    benchmark(
      'Full workflow (parse + validate)',
      () => {
        const parseResult = generateParseResultWithSymbols(10);
        validateParseResult(parseResult);
        const fileInput = generateFileInput();
        validateFileInput(fileInput);
        const symbolInputs = parseResult.symbols.map((sym, i) =>
          generateSymbolInput(i)
        );
        validateSymbolInputBatch(symbolInputs);
      },
      1000,
      5.0
    )
  );

  return results;
}

/**
 * Display results table
 */
function displayResults(results: BenchmarkResult[]): void {
  const table = new Table({
    head: [
      chalk.bold('Operation'),
      chalk.bold('Iterations'),
      chalk.bold('Avg'),
      chalk.bold('P50'),
      chalk.bold('P95'),
      chalk.bold('P99'),
      chalk.bold('Target'),
      chalk.bold('Status'),
    ],
    colWidths: [35, 12, 10, 10, 10, 10, 10, 10],
  });

  for (const result of results) {
    const statusSymbol = result.passed ? chalk.green('✓') : chalk.red('✗');
    const statusText = result.passed ? chalk.green('PASS') : chalk.red('FAIL');

    table.push([
      result.operation,
      result.iterations.toLocaleString(),
      `${result.avgMs.toFixed(3)}ms`,
      `${result.p50Ms.toFixed(3)}ms`,
      `${result.p95Ms.toFixed(3)}ms`,
      `${result.p99Ms.toFixed(3)}ms`,
      `${result.targetMs.toFixed(1)}ms`,
      `${statusSymbol} ${statusText}`,
    ]);
  }

  console.log('\n' + table.toString());
}

/**
 * Display summary
 */
function displaySummary(results: BenchmarkResult[]): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const passRate = (passed / total) * 100;

  console.log(chalk.bold('\n📈 Summary:\n'));
  console.log(`Total Benchmarks: ${total}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(`Pass Rate: ${passRate.toFixed(1)}%\n`);

  if (failed > 0) {
    console.log(chalk.red.bold('❌ Some benchmarks failed to meet performance targets.\n'));
    console.log(chalk.yellow('Failed benchmarks:'));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(
          chalk.yellow(
            `  - ${r.operation}: P95 ${r.p95Ms.toFixed(3)}ms > target ${r.targetMs.toFixed(1)}ms`
          )
        );
      });
    console.log('');
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✅ All benchmarks passed!\n'));
    process.exit(0);
  }
}

/**
 * Main
 */
async function main() {
  try {
    const results = await runBenchmarks();
    displayResults(results);
    displaySummary(results);
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Benchmark failed with error:\n'));
    console.error(error);
    process.exit(1);
  }
}

main();
