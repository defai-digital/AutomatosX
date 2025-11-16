# Performance Analysis Ability

Identify and fix performance bottlenecks.

## Performance Metrics

1. **Response Time**
   - Target: <100ms for API calls
   - Target: <1s for page loads
   - Measure: p50, p95, p99 latencies

2. **Throughput**
   - Requests per second
   - Concurrent users supported
   - Resource utilization

3. **Resource Usage**
   - CPU: Target <70% average
   - Memory: No leaks, stable usage
   - Disk I/O: Minimize random access
   - Network: Bandwidth optimization

## Analysis Process

1. **Measure** (establish baseline)
   - Use profilers (Chrome DevTools, Python cProfile)
   - Monitor production metrics
   - Identify slow operations

2. **Analyze** (find bottlenecks)
   - Check database queries (N+1 problem)
   - Review algorithm complexity
   - Identify network round trips
   - Check memory allocations

3. **Optimize** (targeted improvements)
   - Add caching (Redis, CDN)
   - Optimize database queries (indexes, query optimization)
   - Use async/parallel processing
   - Reduce payload sizes

4. **Verify** (measure improvements)
   - Re-run benchmarks
   - Compare before/after
   - Check for regressions
   - Monitor in production

## Common Performance Issues

- N+1 query problem (ORM)
- Missing database indexes
- Synchronous I/O blocking
- Large payload sizes
- No caching strategy
- Memory leaks
- Inefficient algorithms (O(n²) when O(n) possible)
