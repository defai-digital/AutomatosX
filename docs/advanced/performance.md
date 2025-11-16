# Performance Optimization Guide

This document describes the performance optimizations implemented in AutomatosX, including cache strategies, health check mechanisms, and best practices for optimal performance.

## Table of Contents

- [Overview](#overview)
- [Cache Architecture](#cache-architecture)
- [Health Check Optimization](#health-check-optimization)
- [Performance Metrics](#performance-metrics)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

AutomatosX implements multiple layers of performance optimization to minimize latency and maximize throughput:

1. **Provider Availability Caching** - Reduces repeated CLI checks
2. **Version Detection Caching** - Caches version information for 5 minutes
3. **Adaptive TTL** - Dynamically adjusts cache lifetime based on provider stability
4. **Background Health Checks** - Warms up caches proactively
5. **Token Bucket Optimization** - Efficient rate limiting without memory overhead

**Key Performance Improvements (v5.6.2-5.6.3)**:

- **Cold Start Elimination**: Background cache warmup reduces first-request latency by 90%+ (100ms → <10ms)
- **Reduced Provider Checks**: 50-90% cache hit rate for provider availability checks
- **Adaptive Cache TTL**: Stable providers get longer cache (120s), unstable providers get shorter cache (30s)
- **Memory Efficiency**: Token bucket rate limiting reduces memory usage by 99% for high token counts

---

## Cache Architecture

### 1. Availability Cache

**Purpose**: Cache provider availability checks to avoid repeated CLI command executions.

**Configuration**:
```typescript
// Default TTL: 60 seconds
// Adaptive TTL: 30-120 seconds (based on provider stability)
```

**Behavior**:
- **Cache Hit**: Return cached result if age < TTL
- **Cache Miss**: Execute CLI check, update cache (if successful)
- **Cache Poisoning Prevention**: Only cache successful checks

**Performance Impact**:
```
First check:  100ms (CLI execution)
Cached check:   <1ms (memory read)
→ 99% latency reduction
```

### 2. Version Cache

**Purpose**: Cache provider version detection results.

**Configuration**:
```typescript
// TTL: 5 minutes (300 seconds)
```

**Behavior**:
- Caches version string per CLI command
- Expires after 5 minutes
- Used for version requirement validation

**Performance Impact**:
```
First detection: 100ms (CLI --version)
Cached version:    <1ms (memory read)
→ 99% latency reduction
```

### 3. Adaptive TTL (v5.6.3)

**Purpose**: Dynamically adjust cache TTL based on provider stability.

**Algorithm**:
```typescript
if (uptime > 99%)   → TTL = 120s  // Highly stable
if (uptime < 90%)   → TTL = 30s   // Unstable
else                → TTL = 60s   // Normal
```

**Benefits**:
- **Stable providers**: Longer cache reduces unnecessary checks
- **Unstable providers**: Shorter cache detects failures faster
- **Automatic adaptation**: No manual tuning required

**Example**:
```
Provider A (99.5% uptime):
  - Adaptive TTL: 120s
  - Checks/hour: 30 (vs 60 with fixed 60s TTL)
  - 50% reduction in checks

Provider B (85% uptime):
  - Adaptive TTL: 30s
  - Checks/hour: 120 (vs 60 with fixed 60s TTL)
  - 2x faster failure detection
```

---

## Health Check Optimization

### Background Health Checks (v5.6.2)

**Purpose**: Proactively warm up provider caches in the background.

**Configuration**:
```json
// automatosx.config.json
{
  "router": {
    "healthCheckInterval": 60000  // 60 seconds (default: disabled)
  }
}
```

**Behavior**:
1. **Startup Warmup**: Immediately check all providers on router initialization
2. **Periodic Refresh**: Check all providers every N milliseconds
3. **Non-Blocking**: Runs in background, doesn't block requests
4. **Failure Tolerant**: Continues even if individual providers fail

**Performance Impact**:
```
Without health checks:
  - First request: 100ms (cold cache)
  - Subsequent requests: <1ms (warm cache after TTL expiry)

With health checks (60s interval):
  - First request: <1ms (pre-warmed cache)
  - Subsequent requests: <1ms (continuously warm cache)
  → Eliminates cold start latency
```

### Cache Warmup on Startup (v5.6.3)

**Purpose**: Eliminate first-request cold start by warming up caches immediately.

**Implementation**:
```typescript
// Runs automatically when health checks are enabled
// Uses Promise.allSettled for parallel warmup
```

**Performance Impact**:
```
Without warmup:
  Request 1: 100ms (cold cache)
  Request 2:   1ms (warm cache)

With warmup:
  Request 1:   1ms (pre-warmed cache)
  Request 2:   1ms (warm cache)
  → 99% improvement on first request
```

---

## Performance Metrics

### Cache Metrics API

**Get comprehensive cache metrics**:
```typescript
const provider = getProvider('gemini-cli');
const metrics = provider.getCacheMetrics();

// Availability cache
console.log(metrics.availability.hitRate);      // 0.85 (85% hit rate)
console.log(metrics.availability.avgAge);       // 5000 (5 seconds average age)
console.log(metrics.availability.lastHit);      // 1697123456789 (timestamp)

// Version cache
console.log(metrics.version.size);              // 2 (2 cached commands)
console.log(metrics.version.avgAge);            // 30000 (30 seconds average age)

// Health metrics
console.log(metrics.health.uptime);             // 99.5 (99.5% uptime)
console.log(metrics.health.consecutiveSuccesses); // 100
```

### Router Health Check Status

**Get health check configuration and status**:
```typescript
const router = getRouter();
const status = router.getHealthCheckStatus();

console.log(status.enabled);            // true
console.log(status.interval);           // 60000 (60 seconds)
console.log(status.checksPerformed);    // 120
console.log(status.avgDuration);        // 15 (15ms average duration)
console.log(status.successRate);        // 100 (100% success rate)

// Per-provider metrics
status.providers.forEach(p => {
  console.log(`${p.name}:`);
  console.log(`  Cache Hit Rate: ${p.cacheHitRate * 100}%`);
  console.log(`  Avg Cache Age: ${p.avgCacheAge}ms`);
  console.log(`  Uptime: ${p.uptime}%`);
});
```

### CLI Commands

**View cache statistics**:
```bash
# Router and provider cache stats
ax cache stats

# Output:
#
# 📊 Cache Statistics
#
# Router Status:
#   Health Checks: ✅ Enabled (60s interval)
#   Checks Performed: 120
#   Average Duration: 15ms
#   Success Rate: 100.0%
#
# Provider: gemini-cli
#   Availability Cache:
#     Hit Rate: 85.0% (85 hits / 100 total)
#     Average Age: 5.0s (max: 60s)
#     Last Hit: 2s ago
#     Last Miss: 45s ago
#   Version Cache:
#     Size: 2 commands
#     Average Age: 30.0s (max: 300s)
#   Health:
#     Uptime: 99.5%
#     Consecutive Successes: 100
#     Last Check: 5s ago (took 10ms)
```

---

## Best Practices

### 1. Enable Background Health Checks

**Recommended for production**:
```json
// automatosx.config.json
{
  "router": {
    "healthCheckInterval": 60000  // 60 seconds
  }
}
```

**Benefits**:
- Eliminates cold start latency
- Keeps caches continuously warm
- Proactive failure detection
- Better observability

**Trade-offs**:
- Minor CPU usage (1-2% with 3 providers)
- Background process overhead

**When to use**:
- ✅ Production deployments
- ✅ Long-running services
- ✅ High-throughput applications
- ❌ One-off scripts (adds unnecessary overhead)

### 2. Monitor Cache Performance

**Set up monitoring**:
```typescript
// Log cache metrics periodically
setInterval(() => {
  const metrics = provider.getCacheMetrics();
  logger.info('Cache performance', {
    hitRate: metrics.availability.hitRate,
    avgAge: metrics.availability.avgAge,
    uptime: metrics.health.uptime
  });
}, 300000); // Every 5 minutes
```

**Key metrics to monitor**:
- **Hit Rate < 50%**: Cache TTL may be too short or provider is unstable
- **Avg Age > 50s**: Cache is expiring too quickly, consider increasing TTL
- **Uptime < 95%**: Provider reliability issues, investigate root cause

### 3. Optimize Provider Configuration

**For stable providers**:
```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,
      // No timeout override (use default 25min)
      // Let adaptive TTL automatically increase cache
    }
  }
}
```

**For unstable providers**:
```json
{
  "providers": {
    "experimental-provider": {
      "enabled": true,
      "priority": 3,
      "timeout": 60000,  // Shorter timeout
      // Adaptive TTL will automatically decrease cache
    }
  }
}
```

### 4. Clear Cache When Needed

**Manual cache refresh**:
```bash
# Clear all caches
ax cache clear

# Clear specific provider cache
# (via code)
provider.clearCaches();
```

**When to clear cache**:
- After provider CLI installation/upgrade
- After configuration changes
- During debugging/troubleshooting
- After detecting stale cache issues

---

## Troubleshooting

### Problem: High Latency on First Request

**Symptom**: First request takes 100ms+, subsequent requests are fast.

**Cause**: Cold cache (no warmup).

**Solution**:
```json
// Enable health checks to warm up cache
{
  "router": {
    "healthCheckInterval": 60000
  }
}
```

**Verification**:
```bash
ax cache stats
# Check "Last Hit" - should be < 60s
```

---

### Problem: Low Cache Hit Rate (<50%)

**Symptom**: Cache hit rate below 50% despite frequent requests.

**Possible Causes**:

1. **TTL too short**
   - Check uptime: `ax cache stats`
   - If uptime > 95%, provider should use 60s+ TTL
   - If adaptive TTL is disabled, cache may expire too quickly

2. **Request pattern mismatch**
   - Cache hit requires requests within TTL window
   - If requests are > 60s apart, cache will always miss

3. **Provider instability**
   - Adaptive TTL reduces cache for unstable providers
   - Check `metrics.health.uptime` - if < 90%, expected behavior

**Solution**:
```bash
# Check provider uptime
ax cache stats

# If uptime is low, investigate provider issues
# If uptime is high but hit rate is low, cache may need tuning
```

---

### Problem: Stale Provider Availability

**Symptom**: Provider shows as available but is actually unavailable (or vice versa).

**Cause**: Stale cache.

**Solution**:
```bash
# Clear cache to force fresh check
ax cache clear

# Verify provider is actually available
ax list providers
```

**Prevention**:
- Enable health checks for continuous refresh
- Monitor uptime metrics for early detection
- Adaptive TTL will automatically reduce cache for unstable providers

---

### Problem: Memory Usage Growth

**Symptom**: Memory usage increases over time.

**Possible Causes**:

1. **Version cache accumulation**
   - Each unique CLI command is cached
   - Cache expires after 5 minutes

2. **Health history growth**
   - Limited to last 100 checks per provider
   - Should not exceed ~10KB per provider

**Solution**:
```bash
# Monitor cache size
ax cache stats

# Check version cache size
# Should be < 10 entries per provider
```

**Expected Memory Usage**:
- Availability cache: ~100 bytes per provider
- Version cache: ~500 bytes per provider per command
- Health history: ~10KB per provider (100 checks × 100 bytes)
- **Total**: < 50KB per provider

---

## Performance Benchmarks

### Cache Performance (v5.6.3)

| Metric | Without Cache | With Cache | Improvement |
|--------|--------------|------------|-------------|
| First check | 100ms | 100ms | - |
| Subsequent checks | 100ms | <1ms | **99%** |
| Memory per provider | - | <50KB | - |
| CPU overhead | - | <1% | - |

### Health Check Performance (v5.6.2-5.6.3)

| Metric | Without Health Checks | With Health Checks | Improvement |
|--------|----------------------|-------------------|-------------|
| First request | 100ms | <1ms | **99%** |
| Cache hit rate | 0% (first) | 50-90% | **+∞** |
| Cold start latency | 100ms | 0ms | **100%** |
| Background CPU | 0% | 1-2% | -1-2% |

### Adaptive TTL Performance (v5.6.3)

| Provider Uptime | TTL | Checks/Hour | vs Fixed 60s |
|----------------|-----|-------------|--------------|
| 99.5% (stable) | 120s | 30 | **-50%** |
| 95% (normal) | 60s | 60 | 0% |
| 85% (unstable) | 30s | 120 | **+100%** |

---

## Version History

- **v5.6.3** - Adaptive TTL, cache warmup, enhanced metrics
- **v5.6.2** - Background health checks, cache warmup
- **v5.6.1** - Token bucket optimization
- **v5.6.0** - Initial cache implementation

---

## See Also

- [CACHE.md](./advanced/caching.md) - Cache architecture details
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - General troubleshooting guide
- [API Documentation](./api/) - Detailed API reference
