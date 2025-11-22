# Cache Architecture

This document describes the caching mechanisms in AutomatosX, including design decisions, implementation details, and operational considerations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Cache Layers](#cache-layers)
- [Cache Policies](#cache-policies)
- [Implementation Details](#implementation-details)
- [Observability](#observability)
- [Operational Guide](#operational-guide)

---

## Overview

AutomatosX implements a multi-layer caching strategy to optimize provider operations:

1. **Availability Cache** - Provider CLI availability checks
2. **Version Cache** - Provider version detection results
3. **Response Cache** (optional) - LLM response caching

**Design Goals**:
- **Performance**: Reduce latency by 99% for repeated checks
- **Reliability**: Graceful degradation on cache errors
- **Observability**: Comprehensive metrics for monitoring
- **Adaptability**: Dynamic TTL based on provider stability

---

## Architecture

### Cache Hierarchy

```
┌─────────────────────────────────────────┐
│           Router                        │
│  ┌────────────────────────────────────┐ │
│  │  Health Check Service              │ │
│  │  - Background refresh              │ │
│  │  - Cache warmup                    │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│           Provider                      │
│  ┌────────────────────────────────────┐ │
│  │  Availability Cache                │ │
│  │  - TTL: 60s (adaptive: 30-120s)   │ │
│  │  - In-memory                       │ │
│  │  - Single entry per provider       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Version Cache                     │ │
│  │  - TTL: 300s                       │ │
│  │  - In-memory Map                   │ │
│  │  - Multiple entries (per command)  │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Cache Metrics                     │ │
│  │  - Hit/miss counters               │ │
│  │  - Age tracking                    │ │
│  │  - Health history                  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Data Flow

```
Request
  │
  ▼
┌─────────────────┐
│ Check Cache     │ ───► Cache Hit ───► Return Cached
│                 │         (99%)        (<1ms)
└─────────────────┘
  │
  │ Cache Miss (1%)
  ▼
┌─────────────────┐
│ Execute CLI     │
│ Check           │
│ (100ms)         │
└─────────────────┘
  │
  ▼
┌─────────────────┐
│ Update Cache    │ ───► Success ───► Cache Updated
│ (if successful) │
└─────────────────┘         │
                            │ Failure
                            ▼
                      Cache NOT Updated
                      (Cache Poisoning
                       Prevention)
```

---

## Cache Layers

### 1. Availability Cache

**Purpose**: Cache provider availability checks.

**Storage**:
```typescript
interface AvailabilityCache {
  available: boolean;    // Availability status
  timestamp: number;     // Cache entry time
}

// Stored per provider
private availabilityCache?: AvailabilityCache;
```

**TTL Strategy**:
- **Baseline**: 60 seconds (1 minute)
- **Adaptive** (v5.6.3):
  - Highly stable (uptime > 99%): **120 seconds**
  - Normal (uptime 90-99%): **60 seconds**
  - Unstable (uptime < 90%): **30 seconds**

**Cache Key**: Provider name (implicit - one cache per provider instance)

**Cache Invalidation**:
- TTL expiration (time-based)
- Manual clear: `provider.clearCaches()`
- No invalidation on failure (cache poisoning prevention)

**Memory Footprint**: ~100 bytes per provider

---

### 2. Version Cache

**Purpose**: Cache provider version detection results.

**Storage**:
```typescript
interface VersionCacheEntry {
  version: string;       // Detected version
  timestamp: number;     // Cache entry time
}

// Stored per CLI command
private versionCache: Map<string, VersionCacheEntry>;
```

**TTL Strategy**:
- **Fixed**: 300 seconds (5 minutes)
- **Rationale**: Version changes are infrequent

**Cache Key**: CLI command path (e.g., `/usr/local/bin/gemini`)

**Cache Invalidation**:
- TTL expiration (time-based)
- Manual clear: `provider.clearCaches()`

**Memory Footprint**: ~500 bytes per cached command

**Size Limit**: Unbounded, but practical limit ~10 commands per provider

---

### 3. Response Cache (Optional)

**Purpose**: Cache LLM responses for identical prompts.

**Storage**:
- **L1**: In-memory LRU cache (fast, volatile)
- **L2**: SQLite database (persistent, slower)

**Configuration**:
```json
// ax.config.json
{
  "performance": {
    "providerCache": {
      "enabled": false,     // Disabled by default
      "maxEntries": 100,    // L1 cache size
      "ttl": 600000         // 10 minutes
    }
  }
}
```

**Cache Key**: `SHA256(provider + prompt + modelParams)`

**Note**: **Disabled by default** due to non-determinism concerns. Enable for read-only/repetitive workloads.

---

## Cache Policies

### 1. Cache Poisoning Prevention (v5.6.3)

**Problem**: Caching failures causes persistent bad state.

**Example**:
```typescript
// ❌ BAD: Cache everything
if (checkResult !== null) {
  cache.set(key, checkResult);  // Caches failures!
}

// ✅ GOOD: Only cache successes
if (checkResult === true) {
  cache.set(key, checkResult);  // Only caches success
}
```

**Policy**: **Only cache successful results**

**Applies to**:
- ✅ Availability cache: Only cache `available === true`
- ✅ Version cache: Only cache `version !== null`
- ❌ Response cache: Not applicable (responses are inherently "successful")

**Benefits**:
- Failed providers retry immediately (no stale cache)
- Transient failures don't persist
- Faster recovery from temporary issues

---

### 2. Graceful Cache Degradation (v5.6.3)

**Problem**: Cache errors crash the provider.

**Example**:
```typescript
// ❌ BAD: Unhandled cache error
const age = Date.now() - cache.timestamp;  // Throws if cache corrupted

// ✅ GOOD: Graceful fallback
try {
  const age = Date.now() - cache.timestamp;
  if (age < ttl) return cache.value;
} catch (error) {
  logger.warn('Cache read failed, falling back to fresh check');
  cache = undefined;  // Clear corrupted cache
}
```

**Policy**: **All cache operations wrapped in try-catch**

**Applies to**:
- ✅ Cache reads (availability, version)
- ✅ Cache writes (availability, version)
- ✅ Cache deletions (version)

**Fallback Behavior**:
- **Read error**: Clear cache, perform fresh check
- **Write error**: Log warning, continue without caching
- **Delete error**: Ignore (best-effort cleanup)

---

### 3. Adaptive TTL (v5.6.3)

**Problem**: Fixed TTL doesn't adapt to provider behavior.

**Policy**: **Adjust TTL based on provider uptime**

**Algorithm**:
```typescript
function calculateAdaptiveTTL(uptime: number): number {
  if (uptime > 99)  return 120000;  // 2 minutes
  if (uptime < 90)  return 30000;   // 30 seconds
  return 60000;  // 1 minute (baseline)
}
```

**Uptime Calculation**:
```typescript
// Track last 100 availability checks
uptime = (successful_checks / total_checks) * 100
```

**Benefits**:
- **Stable providers**: Longer cache → fewer checks → better performance
- **Unstable providers**: Shorter cache → faster failure detection → better reliability
- **Automatic**: No manual tuning required

**Trade-offs**:
- Requires history (minimum 10 checks)
- Falls back to baseline TTL if insufficient data

---

### 4. Cache Warmup (v5.6.3)

**Problem**: First request always has cold start latency.

**Policy**: **Proactively warm up caches on startup**

**Implementation**:
```typescript
// Router initialization
if (config.healthCheckInterval) {
  // Immediate warmup (non-blocking)
  await warmupCaches();

  // Periodic refresh
  setInterval(performHealthChecks, config.healthCheckInterval);
}
```

**Behavior**:
- **Parallel**: Uses `Promise.allSettled` for concurrent warmup
- **Non-blocking**: Runs in background, doesn't delay router initialization
- **Failure-tolerant**: Continues even if individual providers fail

**Benefits**:
- Eliminates first-request cold start (100ms → <1ms)
- Improves p50/p95 latency
- Better user experience

---

## Implementation Details

### Availability Cache Implementation

**Location**: `src/providers/base-provider.ts`

**Code**:
```typescript
async isAvailable(): Promise<boolean> {
  // 1. Check cache
  try {
    if (this.availabilityCache) {
      const age = Date.now() - this.availabilityCache.timestamp;
      const ttl = this.calculateAdaptiveTTL();  // Phase 3

      if (age < ttl) {
        // Cache hit
        this.cacheMetrics.availabilityHits++;
        this.availabilityCacheMetrics.lastHit = Date.now();
        return this.availabilityCache.available;
      }
    }
  } catch (error) {
    // Graceful degradation
    logger.warn('Cache read failed', { error });
    this.availabilityCache = undefined;
  }

  // 2. Cache miss - perform check
  this.cacheMetrics.availabilityMisses++;
  this.availabilityCacheMetrics.lastMiss = Date.now();

  const available = await this.checkCLIAvailabilityEnhanced();

  // 3. Update cache (only if successful)
  if (available) {
    try {
      this.availabilityCache = {
        available,
        timestamp: Date.now()
      };
    } catch (error) {
      // Graceful degradation
      logger.warn('Cache write failed', { error });
    }
  }

  return available;
}
```

**Key Points**:
- Phase 3 enhancements: Adaptive TTL, cache poisoning prevention, graceful degradation
- Metrics tracked: hits, misses, last hit/miss, age
- Error handling: All cache operations wrapped in try-catch

---

### Version Cache Implementation

**Location**: `src/providers/base-provider.ts`

**Code**:
```typescript
private async getProviderVersion(command: string): Promise<string | null> {
  // 1. Check cache
  try {
    const cached = this.versionCache.get(command);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.VERSION_CACHE_TTL) {
        // Cache hit
        this.cacheMetrics.versionHits++;
        return cached.version;
      }
    }
  } catch (error) {
    // Graceful degradation
    logger.warn('Version cache read failed', { error });
    try {
      this.versionCache.delete(command);
    } catch (deleteError) {
      // Ignore
    }
  }

  // 2. Cache miss - detect version
  this.cacheMetrics.versionMisses++;

  try {
    const version = await this.detectVersion(command);

    // 3. Update cache (only if successful)
    if (version) {
      try {
        this.versionCache.set(command, {
          version,
          timestamp: Date.now()
        });
      } catch (error) {
        // Graceful degradation
        logger.warn('Version cache write failed', { error });
      }
    }

    return version;
  } catch (error) {
    // Don't cache exceptions
    logger.debug('Version detection exception (not cached)');
    throw error;
  }
}
```

**Key Points**:
- Phase 3 enhancements: Cache poisoning prevention, graceful degradation
- Multiple entries per provider (one per CLI command)
- Fixed TTL (5 minutes)

---

### Health Check Integration

**Location**: `src/core/router.ts`

**Code**:
```typescript
private async warmupCaches(): Promise<void> {
  logger.info('Warming up provider caches...');

  const startTime = Date.now();

  await Promise.allSettled(
    this.providers.map(async (provider) => {
      try {
        await provider.isAvailable();
        logger.debug(`Cache warmed for ${provider.name}`);
      } catch (error) {
        logger.warn(`Failed to warm cache for ${provider.name}`, { error });
      }
    })
  );

  const duration = Date.now() - startTime;
  logger.info('Cache warmup completed', { duration, providers: this.providers.length });
}
```

**Key Points**:
- Parallel warmup with `Promise.allSettled`
- Non-blocking (runs in background)
- Failure-tolerant (continues on individual failures)

---

## Observability

### Cache Metrics API

**Get metrics**:
```typescript
const metrics = provider.getCacheMetrics();

// Structure
{
  availability: {
    hits: number;            // Cache hits
    misses: number;          // Cache misses
    hitRate: number;         // Hit rate (0-1)
    avgAge: number;          // Average cache age (ms)
    maxAge: number;          // Max TTL (ms)
    lastHit?: number;        // Last hit timestamp
    lastMiss?: number;       // Last miss timestamp
  },
  version: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;            // Number of cached commands
    avgAge: number;
    maxAge: number;
  },
  health: {
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastCheckTime?: number;
    lastCheckDuration: number;
    uptime: number;          // Uptime percentage (0-100)
  }
}
```

### CLI Commands

**View cache statistics**:
```bash
ax cache stats
```

**Clear cache**:
```bash
ax cache clear
```

**Show specific cache entry** (response cache only):
```bash
ax cache show <key>
```

---

## Operational Guide

### When to Clear Cache

**Scenarios**:
1. **Provider CLI updated**: Version change requires cache refresh
2. **Configuration changed**: Provider settings modified
3. **Debugging**: Suspect stale cache issues
4. **Performance testing**: Measure cold start performance

**Commands**:
```bash
# Clear all caches
ax cache clear

# Programmatically
provider.clearCaches();
```

### Monitoring Cache Health

**Key metrics**:
1. **Hit Rate**: Should be > 50% for active providers
2. **Average Age**: Should be < max TTL
3. **Uptime**: Should be > 95% for stable providers

**Warning signs**:
- Hit rate < 30%: TTL too short or requests too infrequent
- Average age > 50s: Cache expiring too quickly
- Uptime < 90%: Provider reliability issues

**Monitoring setup**:
```typescript
// Log metrics periodically
setInterval(() => {
  const metrics = provider.getCacheMetrics();

  if (metrics.availability.hitRate < 0.3) {
    logger.warn('Low cache hit rate', {
      provider: provider.name,
      hitRate: metrics.availability.hitRate
    });
  }

  if (metrics.health.uptime < 90) {
    logger.warn('Low provider uptime', {
      provider: provider.name,
      uptime: metrics.health.uptime
    });
  }
}, 300000); // Every 5 minutes
```

### Cache Tuning

**Baseline TTL** (if adaptive cache disabled):
```typescript
// In base-provider.ts
AVAILABILITY_CACHE_TTL = 60000;  // 60 seconds (default)

// Increase for very stable providers
AVAILABILITY_CACHE_TTL = 120000; // 2 minutes

// Decrease for unstable providers
AVAILABILITY_CACHE_TTL = 30000;  // 30 seconds
```

**Note**: Adaptive TTL (v5.6.3) automatically tunes this. Manual tuning not recommended.

---

## Performance Characteristics

### Memory Usage

| Cache | Size per Provider | Typical Total |
|-------|------------------|---------------|
| Availability | ~100 bytes | <1 KB |
| Version | ~500 bytes/command | <5 KB |
| Health History | ~10 KB (100 checks) | ~10 KB |
| **Total** | **~15 KB** | **<50 KB** (3 providers) |

### Latency Impact

| Operation | Without Cache | With Cache | Improvement |
|-----------|--------------|------------|-------------|
| Availability check | 100ms | <1ms | **99%** |
| Version detection | 100ms | <1ms | **99%** |
| First request (cold) | 100ms | 100ms | - |
| First request (warm) | 100ms | <1ms | **99%** |

### CPU Overhead

| Feature | CPU Usage |
|---------|-----------|
| Cache operations | <0.1% |
| Health checks (60s interval, 3 providers) | 1-2% |
| Adaptive TTL calculation | <0.01% |

---

## Version History

- **v5.6.3** - Adaptive TTL, cache poisoning prevention, graceful degradation
- **v5.6.2** - Background health checks, cache warmup
- **v5.6.1** - Token bucket optimization
- **v5.6.0** - Initial cache implementation (availability, version)

---

## See Also

- [PERFORMANCE.md](./advanced/performance.md) - Performance optimization guide
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - Troubleshooting guide
- [API Documentation](./api/) - Detailed API reference
