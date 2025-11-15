/**
 * staging-validation-test.ts
 *
 * Staging environment validation test script.
 * Tests validation system in staging environment before production rollout.
 *
 * Week 3 Day 2 - Staging Validation
 *
 * Usage:
 *   STAGING_URL=https://staging.automatosx.example.com npx tsx scripts/staging-validation-test.ts
 *
 * Success Criteria:
 *   - Success rate > 99.9%
 *   - P95 latency < 100ms
 *   - Error rate < 0.1%
 */

import { performance } from 'perf_hooks';
import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Staging test configuration
 */
interface StagingTestConfig {
  endpoint: string;
  requestCount: number;
  payload: any;
  method: 'GET' | 'POST';
}

/**
 * Staging test result
 */
interface StagingTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorRate: number;
  errors: string[];
}

/**
 * Mock HTTP client (replace with actual HTTP library in production)
 */
async function makeRequest(
  baseUrl: string,
  endpoint: string,
  method: 'GET' | 'POST',
  payload?: any
): Promise<{ status: number; data: any }> {
  // In production, replace this with actual HTTP calls using axios, fetch, etc.
  // For now, simulate successful requests

  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

  // Simulate 99.5% success rate
  if (Math.random() < 0.995) {
    return {
      status: 200,
      data: { success: true, validated: true },
    };
  } else {
    throw new Error('Simulated network error');
  }
}

/**
 * Run staging test for a specific endpoint
 */
async function testStagingEndpoint(
  baseUrl: string,
  config: StagingTestConfig
): Promise<StagingTestResult> {
  console.log(chalk.blue(`\nTesting: ${config.endpoint}...`));
  console.log(`  Method: ${config.method}`);
  console.log(`  Requests: ${config.requestCount}`);

  const latencies: number[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < config.requestCount; i++) {
    const start = performance.now();
    try {
      const response = await makeRequest(
        baseUrl,
        config.endpoint,
        config.method,
        config.payload
      );
      const end = performance.now();

      if (response.status === 200) {
        successCount++;
        latencies.push(end - start);
      } else {
        failCount++;
        errors.push(`HTTP ${response.status}`);
      }
    } catch (error) {
      const end = performance.now();
      failCount++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);

      // Still record latency for failed requests
      latencies.push(end - start);
    }

    // Rate limiting: 10 requests per second
    if ((i + 1) % 10 === 0 && i < config.requestCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      process.stdout.write('.');
    }
  }

  console.log(''); // New line after progress dots

  // Calculate metrics
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];

  return {
    endpoint: config.endpoint,
    totalRequests: config.requestCount,
    successfulRequests: successCount,
    failedRequests: failCount,
    latencies,
    avgLatencyMs: avgLatency,
    p50LatencyMs: p50Latency,
    p95LatencyMs: p95Latency,
    p99LatencyMs: p99Latency,
    minLatencyMs: minLatency,
    maxLatencyMs: maxLatency,
    errorRate: failCount / config.requestCount,
    errors: errors.slice(0, 10), // Keep first 10 errors
  };
}

/**
 * Run all staging tests
 */
async function runStagingTests(baseUrl: string): Promise<StagingTestResult[]> {
  console.log(chalk.blue.bold('\n🧪 Staging Validation Tests\n'));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);

  const results: StagingTestResult[] = [];

  // Test 1: Parse endpoint with validation
  results.push(
    await testStagingEndpoint(baseUrl, {
      endpoint: '/api/parse',
      method: 'POST',
      requestCount: 100,
      payload: {
        path: '/test/example.ts',
        content: 'export function test() { return 42; }',
        language: 'typescript',
      },
    })
  );

  // Test 2: Index endpoint with validation
  results.push(
    await testStagingEndpoint(baseUrl, {
      endpoint: '/api/index',
      method: 'POST',
      requestCount: 100,
      payload: {
        path: '/test/example.ts',
        content: 'export function test() { return 42; }',
        language: 'typescript',
      },
    })
  );

  // Test 3: Search endpoint
  results.push(
    await testStagingEndpoint(baseUrl, {
      endpoint: '/api/search',
      method: 'POST',
      requestCount: 100,
      payload: {
        query: 'test function',
        limit: 10,
      },
    })
  );

  // Test 4: Symbol definition lookup
  results.push(
    await testStagingEndpoint(baseUrl, {
      endpoint: '/api/def',
      method: 'POST',
      requestCount: 50,
      payload: {
        symbol: 'getUserById',
      },
    })
  );

  // Test 5: Batch indexing
  results.push(
    await testStagingEndpoint(baseUrl, {
      endpoint: '/api/batch/index',
      method: 'POST',
      requestCount: 50,
      payload: {
        files: [
          {
            path: '/test/example1.ts',
            content: 'export function test1() {}',
            language: 'typescript',
          },
          {
            path: '/test/example2.ts',
            content: 'export function test2() {}',
            language: 'typescript',
          },
        ],
      },
    })
  );

  return results;
}

/**
 * Display results table
 */
function displayResults(results: StagingTestResult[]): void {
  const table = new Table({
    head: [
      chalk.bold('Endpoint'),
      chalk.bold('Total'),
      chalk.bold('Success'),
      chalk.bold('Failed'),
      chalk.bold('Avg'),
      chalk.bold('P95'),
      chalk.bold('P99'),
      chalk.bold('Error %'),
      chalk.bold('Status'),
    ],
    colWidths: [25, 8, 10, 8, 10, 10, 10, 10, 10],
  });

  for (const result of results) {
    const successRate = (result.successfulRequests / result.totalRequests) * 100;
    const passed = result.errorRate < 0.001 && result.p95LatencyMs < 100;
    const statusSymbol = passed ? chalk.green('✓') : chalk.red('✗');
    const statusText = passed ? chalk.green('PASS') : chalk.red('FAIL');

    table.push([
      result.endpoint,
      result.totalRequests.toString(),
      result.successfulRequests.toString(),
      result.failedRequests.toString(),
      `${result.avgLatencyMs.toFixed(2)}ms`,
      `${result.p95LatencyMs.toFixed(2)}ms`,
      `${result.p99LatencyMs.toFixed(2)}ms`,
      `${(result.errorRate * 100).toFixed(2)}%`,
      `${statusSymbol} ${statusText}`,
    ]);
  }

  console.log('\n' + table.toString());
}

/**
 * Display summary
 */
function displaySummary(results: StagingTestResult[]): void {
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccess = results.reduce((sum, r) => sum + r.successfulRequests, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0);
  const avgSuccessRate = (totalSuccess / totalRequests) * 100;

  const allLatencies = results.flatMap(r => r.latencies);
  allLatencies.sort((a, b) => a - b);
  const overallAvg =
    allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
  const overallP95 =
    allLatencies[Math.floor(allLatencies.length * 0.95)];
  const overallP99 =
    allLatencies[Math.floor(allLatencies.length * 0.99)];

  const passed = results.filter(
    r => r.errorRate < 0.001 && r.p95LatencyMs < 100
  ).length;
  const failed = results.length - passed;

  console.log(chalk.bold('\n📊 Summary:\n'));
  console.log(`Total Tests: ${results.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(`Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${avgSuccessRate.toFixed(2)}%`);
  console.log('');
  console.log(`Overall Avg Latency: ${overallAvg.toFixed(2)}ms`);
  console.log(`Overall P95 Latency: ${overallP95.toFixed(2)}ms`);
  console.log(`Overall P99 Latency: ${overallP99.toFixed(2)}ms`);
  console.log('');

  // Check success criteria
  const criteriaTable = new Table({
    head: [chalk.bold('Criterion'), chalk.bold('Target'), chalk.bold('Actual'), chalk.bold('Status')],
    colWidths: [30, 15, 15, 10],
  });

  const successRateCriteria = avgSuccessRate > 99.9;
  const p95Criteria = overallP95 < 100;
  const errorRateCriteria = ((totalFailed / totalRequests) * 100) < 0.1;

  criteriaTable.push(
    [
      'Success Rate',
      '> 99.9%',
      `${avgSuccessRate.toFixed(2)}%`,
      successRateCriteria ? chalk.green('✓') : chalk.red('✗'),
    ],
    [
      'P95 Latency',
      '< 100ms',
      `${overallP95.toFixed(2)}ms`,
      p95Criteria ? chalk.green('✓') : chalk.red('✗'),
    ],
    [
      'Error Rate',
      '< 0.1%',
      `${((totalFailed / totalRequests) * 100).toFixed(2)}%`,
      errorRateCriteria ? chalk.green('✓') : chalk.red('✗'),
    ]
  );

  console.log(criteriaTable.toString());
  console.log('');

  if (failed > 0) {
    console.log(chalk.yellow.bold('⚠️  Some tests did not meet criteria:\n'));
    results
      .filter(r => r.errorRate >= 0.001 || r.p95LatencyMs >= 100)
      .forEach(r => {
        console.log(chalk.yellow(`  ${r.endpoint}:`));
        if (r.errorRate >= 0.001) {
          console.log(
            chalk.yellow(
              `    - Error rate: ${(r.errorRate * 100).toFixed(2)}% (target: < 0.1%)`
            )
          );
          if (r.errors.length > 0) {
            console.log(chalk.yellow(`    - Sample errors: ${r.errors.slice(0, 3).join(', ')}`));
          }
        }
        if (r.p95LatencyMs >= 100) {
          console.log(
            chalk.yellow(
              `    - P95 latency: ${r.p95LatencyMs.toFixed(2)}ms (target: < 100ms)`
            )
          );
        }
      });
    console.log('');
  }

  const allCriteriaMet = successRateCriteria && p95Criteria && errorRateCriteria;

  if (allCriteriaMet && failed === 0) {
    console.log(chalk.green.bold('✅ All staging tests passed!\n'));
    console.log(chalk.green('Staging environment is ready for production rollout.\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('❌ Staging tests failed.\n'));
    console.log(chalk.yellow('Action required:'));
    console.log(chalk.yellow('1. Review error patterns and logs'));
    console.log(chalk.yellow('2. Fix validation issues or data quality problems'));
    console.log(chalk.yellow('3. Consider reducing sampling rate or switching to log-only mode'));
    console.log(chalk.yellow('4. Re-run staging tests after fixes\n'));
    process.exit(1);
  }
}

/**
 * Main
 */
async function main() {
  try {
    const baseUrl = process.env.STAGING_URL;

    if (!baseUrl) {
      console.error(
        chalk.red.bold('\n❌ Error: STAGING_URL environment variable not set\n')
      );
      console.log(chalk.yellow('Usage:'));
      console.log(
        chalk.yellow(
          '  STAGING_URL=https://staging.example.com npx tsx scripts/staging-validation-test.ts\n'
        )
      );
      process.exit(1);
    }

    console.log(chalk.blue('⚠️  NOTE: This script uses mock HTTP requests.'));
    console.log(chalk.blue('In production, replace makeRequest() with actual HTTP client (axios, fetch, etc.)\n'));

    const results = await runStagingTests(baseUrl);
    displayResults(results);
    displaySummary(results);
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Staging test failed with error:\n'));
    console.error(error);
    process.exit(1);
  }
}

main();
