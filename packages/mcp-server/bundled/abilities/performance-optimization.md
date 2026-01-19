---
abilityId: performance-optimization
displayName: Performance Optimization
category: engineering
tags: [performance, optimization, profiling]
priority: 80
---

# Performance Optimization

## Performance Principles

### Measure First
- Never optimize without measurements
- Profile before and after changes
- Use realistic data and conditions
- Set clear performance targets

### Optimize the Right Thing
- Find the actual bottleneck
- 80/20 rule: 80% of time in 20% of code
- Don't optimize prematurely
- Consider user-perceived performance

## Frontend Performance

### Loading Performance
```javascript
// Lazy load components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Code splitting
import(/* webpackChunkName: "feature" */ './feature');

// Preload critical resources
<link rel="preload" href="/critical.css" as="style">
<link rel="prefetch" href="/next-page.js">
```

### Rendering Performance
```javascript
// Memoize expensive computations
const memoizedValue = useMemo(() => expensiveOperation(data), [data]);

// Prevent unnecessary re-renders
const MemoizedComponent = React.memo(Component);

// Virtualize long lists
<VirtualList items={items} itemHeight={50} />
```

### Bundle Optimization
- Tree shaking unused code
- Minification and compression
- Image optimization (WebP, lazy loading)
- Critical CSS inlining

## Backend Performance

### Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- Use EXPLAIN to analyze queries
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Avoid N+1 queries
SELECT orders.*, users.name
FROM orders
JOIN users ON orders.user_id = users.id;
```

### Caching Strategies
```javascript
// In-memory cache
const cache = new Map();
function getCached(key, compute) {
  if (!cache.has(key)) {
    cache.set(key, compute());
  }
  return cache.get(key);
}

// Redis caching
await redis.setex(`user:${id}`, 3600, JSON.stringify(user));
const cached = await redis.get(`user:${id}`);
```

### Connection Pooling
```javascript
// Database connection pool
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Algorithm Optimization

### Time Complexity
- O(1): Constant - hash lookups
- O(log n): Logarithmic - binary search
- O(n): Linear - single loop
- O(n log n): Linearithmic - efficient sorts
- O(n²): Quadratic - nested loops (avoid!)

### Space vs Time Trade-offs
```javascript
// Trading space for time with memoization
const memo = {};
function fibonacci(n) {
  if (n in memo) return memo[n];
  if (n <= 1) return n;
  memo[n] = fibonacci(n - 1) + fibonacci(n - 2);
  return memo[n];
}
```

## Profiling Tools

### Frontend
- Chrome DevTools Performance tab
- Lighthouse audits
- React DevTools Profiler
- webpack-bundle-analyzer

### Backend
- Node.js `--prof` flag
- clinic.js for Node profiling
- Database EXPLAIN plans
- APM tools (DataDog, New Relic)

## Performance Metrics

### Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### API Performance
- **p50 latency**: Median response time
- **p95 latency**: 95th percentile
- **p99 latency**: 99th percentile
- **Throughput**: Requests per second

## Common Anti-patterns

- Premature optimization
- Optimizing non-bottlenecks
- Ignoring caching opportunities
- N+1 database queries
- Blocking the main thread
- Memory leaks
