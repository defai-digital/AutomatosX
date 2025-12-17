---
abilityId: microservices
displayName: Microservices Architecture
category: architecture
tags: [microservices, distributed, architecture]
priority: 80
---

# Microservices Architecture

## Core Principles

### Service Boundaries
- **Single Responsibility**: Each service owns one business capability
- **Bounded Context**: Clear domain boundaries (DDD)
- **Data Ownership**: Each service owns its data
- **Loose Coupling**: Minimize dependencies between services

### Right-Sizing Services
- Not too small (nano-services)
- Not too large (mini-monoliths)
- Can be deployed independently
- Can be understood by one team

## Communication Patterns

### Synchronous (REST/gRPC)
```typescript
// REST client with retry
async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${USER_SERVICE_URL}/users/${userId}`, {
    headers: { 'X-Request-ID': requestId },
  });

  if (!response.ok) {
    throw new ServiceError('user-service', response.status);
  }

  return response.json();
}

// gRPC client
const client = new UserServiceClient(USER_SERVICE_URL);
const user = await client.getUser({ id: userId });
```

### Asynchronous (Events)
```typescript
// Event publisher
interface OrderCreatedEvent {
  type: 'order.created';
  data: {
    orderId: string;
    userId: string;
    items: OrderItem[];
    total: number;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
  };
}

await eventBus.publish('orders', {
  type: 'order.created',
  data: { orderId, userId, items, total },
  metadata: { timestamp: new Date().toISOString(), correlationId },
});

// Event consumer
eventBus.subscribe('orders', async (event: OrderCreatedEvent) => {
  if (event.type === 'order.created') {
    await inventoryService.reserveItems(event.data.items);
  }
});
```

## Service Discovery

```typescript
// Consul/etcd based discovery
const serviceRegistry = new ServiceRegistry();

// Register service
await serviceRegistry.register({
  name: 'order-service',
  address: process.env.POD_IP,
  port: 3000,
  healthCheck: '/health',
});

// Discover service
const userServiceInstances = await serviceRegistry.discover('user-service');
const instance = loadBalancer.select(userServiceInstances);
```

## Resilience Patterns

### Circuit Breaker
```typescript
const userServiceBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
});

async function getUserSafe(userId: string): Promise<User | null> {
  try {
    return await userServiceBreaker.execute(() => getUser(userId));
  } catch (error) {
    if (error.message === 'Circuit open') {
      return getCachedUser(userId); // Fallback
    }
    throw error;
  }
}
```

### Bulkhead
```typescript
// Limit concurrent requests per service
const bulkhead = new Bulkhead({
  maxConcurrent: 10,
  maxQueue: 100,
});

async function callService() {
  return bulkhead.execute(async () => {
    return await fetch(serviceUrl);
  });
}
```

### Timeout
```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]);
}

// Usage
const user = await withTimeout(getUser(userId), 5000);
```

## Data Management

### Database per Service
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Order       │    │ User        │    │ Inventory   │
│ Service     │    │ Service     │    │ Service     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
  ┌─────────┐        ┌─────────┐        ┌─────────┐
  │ Orders  │        │ Users   │        │ Stock   │
  │ DB      │        │ DB      │        │ DB      │
  └─────────┘        └─────────┘        └─────────┘
```

### Saga Pattern
```typescript
// Choreography-based saga
class OrderSaga {
  async execute(order: Order) {
    try {
      // Step 1: Reserve inventory
      await eventBus.publish('inventory.reserve', { items: order.items });

      // Step 2: Process payment
      await eventBus.publish('payment.process', {
        amount: order.total,
        userId: order.userId,
      });

      // Step 3: Confirm order
      await eventBus.publish('order.confirm', { orderId: order.id });
    } catch (error) {
      // Compensating transactions
      await this.compensate(order);
    }
  }

  async compensate(order: Order) {
    await eventBus.publish('inventory.release', { items: order.items });
    await eventBus.publish('payment.refund', { orderId: order.id });
    await eventBus.publish('order.cancel', { orderId: order.id });
  }
}
```

## Observability

### Distributed Tracing
```typescript
// OpenTelemetry setup
const tracer = trace.getTracer('order-service');

async function processOrder(order: Order) {
  const span = tracer.startSpan('processOrder');
  span.setAttribute('order.id', order.id);

  try {
    const user = await tracer.startActiveSpan('getUser', async (childSpan) => {
      const result = await userService.get(order.userId);
      childSpan.end();
      return result;
    });

    // Continue processing...
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### Correlation IDs
```typescript
// Middleware to propagate correlation ID
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuid();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

// Include in all service calls
await fetch(serviceUrl, {
  headers: { 'X-Correlation-ID': req.correlationId },
});
```

## API Gateway Pattern

```typescript
// Rate limiting per client
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  max: 100,
});

// Request routing
app.use('/api/users/*', proxy('user-service'));
app.use('/api/orders/*', proxy('order-service'));
app.use('/api/inventory/*', proxy('inventory-service'));

// Authentication
app.use(async (req, res, next) => {
  const token = req.headers.authorization;
  req.user = await authService.validate(token);
  next();
});
```

## Anti-Patterns

- Distributed monolith
- Synchronous chains (A → B → C → D)
- Shared databases between services
- No service boundaries
- Missing timeouts and retries
- No centralized logging/tracing
- Too fine-grained services
