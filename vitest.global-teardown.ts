/**
 * Vitest Global Teardown
 * Runs once after all tests complete
 */

export default function() {
  // Force garbage collection if available
  // Run Node with --expose-gc flag to enable this
  // Skip force GC in CI to prevent race with native cleanup (better-sqlite3)
  if (global.gc && !process.env.CI) {
    global.gc();
  }

  // Log final memory usage for monitoring
  const used = process.memoryUsage();
  console.log('\n=== Memory Usage After All Tests ===');
  console.log(`  RSS (Resident Set Size): ${Math.round(used.rss / 1024 / 1024)}MB`);
  console.log(`  Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
  console.log(`  Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)}MB`);
  console.log(`  External: ${Math.round(used.external / 1024 / 1024)}MB`);
  console.log(`  Array Buffers: ${Math.round((used.arrayBuffers || 0) / 1024 / 1024)}MB`);
  console.log('====================================\n');
}
