# Caching Strategy

## Overview
Design and implement multi-layer caching strategies to optimize application performance, reduce database load, and improve user experience.

## Caching Layers

### 1. Client-Side Caching
- Browser cache (Cache-Control, ETag)
- Service Worker caching
- Local Storage / IndexedDB
- CDN edge caching

### 2. Application-Level Caching
- In-memory cache (Redis, Memcached)
- Application process cache
- Query result caching
- Computed value caching

### 3. Database Caching
- Query result cache
- Prepared statement cache
- Connection pool
- Buffer pool (InnoDB)

## Cache Patterns

### Cache-Aside (Lazy Loading)
1. Check cache
2. If miss → Query database
3. Store in cache
4. Return data

**Use when**: Read-heavy, acceptable stale data

### Write-Through
1. Write to cache
2. Write to database (synchronous)
3. Return success

**Use when**: Data consistency critical

### Write-Behind (Write-Back)
1. Write to cache
2. Queue database write (async)
3. Return success

**Use when**: High write throughput needed

### Read-Through
Cache handles database reads automatically

**Use when**: Simplify application logic

### Refresh-Ahead
Proactively refresh before expiration

**Use when**: Predictable access patterns

## Cache Invalidation

### Time-Based (TTL)
**Pros**: Simple, predictable
**Cons**: May serve stale data

### Event-Based
**Pros**: Always fresh
**Cons**: Complex invalidation logic

### Tag-Based
**Pros**: Flexible, bulk invalidation
**Cons**: Overhead in management

## Cache Key Design

### Naming Conventions
`<namespace>:<entity>:<id>:<attribute>`

Examples:
- `user:123:profile`
- `product:456:inventory`
- `session:abc123:cart`

### Hierarchical Keys
`app:v1:user:123:settings`

### Composite Keys
- `search:query:<hash>:page:1`
- `filter:category:electronics:brand:apple`

## Performance Optimization

### Connection Pooling
- Min/max pool size tuning
- Connection timeout configuration
- Health checks for stale connections

### Compression
- Compress large values (>1KB)
- Trade CPU for memory savings
- Use MessagePack or Snappy

### Batch Operations
- Pipeline multiple commands
- Reduce network round trips

### Read Replicas
- Separate read/write connections
- Route heavy reads to replicas
- Monitor replication lag

## Monitoring & Metrics

### Key Metrics
- Hit rate (hits / (hits + misses))
- Miss rate
- Eviction rate
- Memory usage
- Latency (p50, p95, p99)

### Alerts
- Hit rate < 80%
- Memory usage > 85%
- Eviction rate spike
- Replication lag > 1s

## Eviction Policies
- **noeviction**: Return error when full
- **allkeys-lru**: Evict least recently used
- **volatile-lru**: Evict LRU with TTL set
- **allkeys-random**: Random eviction
- **volatile-ttl**: Evict soonest expiring

## Common Pitfalls

### Cache Stampede
**Problem**: Many requests hit DB on cache miss
**Solution**: Probabilistic early expiration, lock-based refresh, always return stale data while refreshing

### Cache Penetration
**Problem**: Queries for non-existent data bypass cache
**Solution**: Cache null results with short TTL

### Hot Key Problem
**Problem**: Single key gets massive traffic
**Solution**: Key sharding, local cache, load balancing

### Cache Avalanche
**Problem**: Many keys expire simultaneously
**Solution**: Add jitter to TTL (TTL ± random)

## Design Checklist

- [ ] Cache layers identified (client, app, DB)
- [ ] Cache pattern selected (cache-aside, write-through, etc.)
- [ ] Invalidation strategy defined
- [ ] Key naming convention established
- [ ] TTL values justified
- [ ] Eviction policy configured
- [ ] Connection pooling set up
- [ ] Monitoring/alerting configured
- [ ] Security measures implemented
- [ ] Cache stampede prevention
- [ ] Performance testing completed
- [ ] Documentation updated
