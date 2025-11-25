# Observability

Implement logging, metrics, and tracing to understand system behavior. Monitor health, troubleshoot issues, and optimize performance.

## Three Pillars

### 1. Logs
```javascript
// ✅ Good: Structured logging
logger.info('User login', {
  user_id: user.id,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

### 2. Metrics
```javascript
// ✅ Good: Application metrics (Prometheus)
const counter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

app.use((req, res, next) => {
  res.on('finish', () => {
    counter.inc({ method: req.method, route: req.route, status: res.statusCode });
  });
});
```

### 3. Traces
```javascript
// ✅ Good: Distributed tracing
const span = tracer.startSpan('get_user');
try {
  const user = await db.getUser(id);
  res.json(user);
} finally {
  span.finish();
}
```

## Don'ts ❌

```javascript
// ❌ Bad: Log sensitive data
logger.info('Login', { username, password });  // Never!

// ❌ Bad: Unstructured logs
console.log('User ' + user.id + ' logged in');
```

## Best Practices
- Use log levels appropriately
- Implement correlation IDs for tracing
- Set up dashboards for key metrics
- Configure alerts with thresholds
- Use APM tools (Datadog, New Relic)
- Implement SLOs and error budgets
