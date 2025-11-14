# AutomatosX v2 - Monitoring & Observability Guide

**Version**: 2.0.0
**Phase**: 6 Week 2 - Advanced Monitoring & Observability
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Components](#components)
5. [Configuration](#configuration)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)
8. [Performance](#performance)
9. [Troubleshooting](#troubleshooting)

---

## Overview

AutomatosX v2 includes a comprehensive monitoring and observability system with:

- **Metrics Collection**: Time-series metrics with percentile aggregation (P50, P95, P99)
- **Distributed Tracing**: OpenTelemetry-style tracing for workflow execution paths
- **Structured Logging**: SQLite FTS5 full-text search across all logs
- **Health Checks**: Component-level health monitoring with status events
- **Alerting**: Rule-based alerting with multi-channel notifications
- **Workflow Monitoring**: Execution tracking with progress and error reporting
- **Real-time Dashboard**: WebSocket-powered live monitoring UI
- **REST API**: HTTP endpoints for programmatic access

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitoring System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Metrics    │  │   Tracing    │  │   Logging    │     │
│  │  Collector   │  │   Tracer     │  │   Logger     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  SQLite Storage │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐     │
│  │  Alerting    │  │   Health     │  │   Workflow   │     │
│  │   Service    │  │   Checks     │  │   Monitor    │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                    │
│  ┌──────▼───────┐                                           │
│  │Notification  │                                           │
│  │  Service     │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│  ┌──────┴──────────────────────────────────┐               │
│  │  Email  │  Slack  │  PagerDuty          │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      Access Layer                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐           ┌──────────────┐               │
│  │  WebSocket   │           │   REST API   │               │
│  │   Server     │           │   Endpoints  │               │
│  └──────┬───────┘           └──────┬───────┘               │
│         │                           │                        │
│  ┌──────▼───────────────────────────▼───────┐              │
│  │         Web Dashboard UI                  │              │
│  └───────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Workflow Execution Monitoring**:
```
Workflow Start
    ↓
1. WorkflowMonitor.startExecution(executionId)
2. DistributedTracer.startTrace(executionId)
3. StructuredLogger.info("Workflow started")
    ↓
Workflow Execution (Steps)
    ↓
4. DistributedTracer.startSpan(traceId, "Step 1")
5. MetricsCollector.recordMetric("step.duration", 123)
6. StructuredLogger.debug("Step completed")
7. DistributedTracer.completeSpan(spanId)
    ↓
Workflow Complete
    ↓
8. WorkflowMonitor.completeExecution(executionId)
9. DistributedTracer.completeTrace(traceId)
10. StructuredLogger.info("Workflow completed")
    ↓
Alert Evaluation (if threshold exceeded)
    ↓
11. AlertingService.evaluateRules()
12. NotificationService.sendAlert(alert)
    ↓
WebSocket Broadcast
    ↓
13. MonitoringWebSocketServer.broadcast("alert.triggered")
14. Dashboard receives real-time update
```

---

## Quick Start

### 1. Basic Metrics Collection

```typescript
import { MetricsCollector } from './monitoring/MetricsCollector.js';

const metrics = new MetricsCollector();

// Record a metric
metrics.recordMetric('api.latency', 123, {
  endpoint: '/users',
  method: 'GET',
});

// Get aggregation
const aggregation = metrics.getAggregation(
  'api.latency',
  Date.now() - 3600000, // 1 hour ago
  Date.now()
);

console.log(`P95 latency: ${aggregation?.p95}ms`);
```

### 2. Distributed Tracing

```typescript
import { DistributedTracer } from './monitoring/DistributedTracer.js';

const tracer = new DistributedTracer();

// Start trace for workflow
const traceId = tracer.startTrace('workflow-exec-001');

// Create span
const spanId = tracer.startSpan(traceId, 'Database Query', 'internal', {
  attributes: { query: 'SELECT * FROM users' },
});

// Add event to span
tracer.addSpanEvent(spanId, 'cache.miss', { key: 'users:all' });

// Complete span
tracer.completeSpan(spanId, 'ok');

// Complete trace
tracer.completeTrace(traceId);

// Retrieve trace
const trace = tracer.getTrace(traceId);
console.log(`Trace had ${trace?.spans.length} spans`);
```

### 3. Structured Logging

```typescript
import { StructuredLogger } from './monitoring/StructuredLogger.js';

const logger = new StructuredLogger();

// Log with context
logger.info('User login successful', 'auth-service', {
  executionId: 'exec-001',
  traceId: 'trace-abc',
  userId: 'user-123',
  metadata: { method: 'oauth', provider: 'google' },
});

// Query logs
const logs = logger.queryLogs({
  search: 'login',
  level: 'info',
  source: 'auth-service',
  limit: 100,
});

// Full-text search
const errorLogs = logger.getErrorLogs(50);
```

### 4. Alert Rules

```typescript
import { AlertingService } from './monitoring/AlertingService.js';

const alerting = new AlertingService();

// Create alert rule
const ruleId = alerting.createRule(
  'High API Latency',
  'API P95 latency exceeds 500ms',
  'api.latency',
  {
    operator: 'gt',
    threshold: 500,
    windowMs: 300000, // 5 minutes
    aggregation: 'p95',
  },
  'warning',
  { cooldownMs: 600000 } // 10-minute cooldown
);

// Listen for alerts
alerting.on('alert.triggered', (alert) => {
  console.log(`Alert: ${alert.title} - ${alert.description}`);
});

// Start evaluation
alerting.startEvaluation(60000); // Evaluate every 60 seconds
```

### 5. Health Checks

```typescript
import { HealthCheckService } from './monitoring/HealthCheckService.js';

const health = new HealthCheckService();

// Get system health
const systemHealth = await health.getSystemHealth();
console.log(`Overall status: ${systemHealth.overall}`);
console.log(`Uptime: ${health.getUptimeFormatted()}`);

// Check specific component
const dbHealth = await health.getComponentHealth('database');
console.log(`Database status: ${dbHealth?.status}`);

// Start periodic checks
health.startPeriodicChecks(30000); // Every 30 seconds

// Listen for health changes
health.on('health.changed', ({ from, to }) => {
  console.log(`Health changed: ${from} → ${to}`);
});
```

---

## Components

### MetricsCollector

**Purpose**: Collect and aggregate time-series metrics with percentile calculations.

**Key Methods**:
- `recordMetric(type, value, labels?)` - Record a metric data point
- `getAggregation(type, startTime, endTime)` - Get aggregated stats (count, avg, min, max, p50, p95, p99)
- `getMetricsCount()` - Total metrics recorded

**Use Cases**:
- API latency tracking
- Throughput monitoring
- Resource utilization metrics
- Custom business metrics

### DistributedTracer

**Purpose**: Trace execution paths across workflow steps with hierarchical spans.

**Key Methods**:
- `startTrace(workflowExecutionId)` - Begin a new trace
- `startSpan(traceId, name, kind, options?)` - Create a span
- `addSpanEvent(spanId, name, attributes?)` - Add event to span
- `completeSpan(spanId, status)` - Mark span as complete
- `completeTrace(traceId)` - Finalize trace
- `getTrace(traceId)` - Retrieve complete trace with all spans

**Use Cases**:
- Workflow execution debugging
- Performance bottleneck identification
- Service dependency mapping
- Error propagation tracking

### StructuredLogger

**Purpose**: Centralized logging with full-text search and structured metadata.

**Key Methods**:
- `info/warn/error/debug/fatal(message, source, options?)` - Log at various levels
- `queryLogs(query)` - Search logs with filters
- `getExecutionLogs(executionId)` - Get all logs for a workflow
- `getErrorLogs(limit)` - Get recent error logs
- `flush()` - Force write buffered logs to database

**Features**:
- Log buffering for performance
- FTS5 full-text search
- Context propagation (traceId, spanId, executionId)
- Multi-tenant support

### AlertingService

**Purpose**: Rule-based alerting with threshold monitoring and notifications.

**Key Methods**:
- `createRule(name, description, metricType, condition, severity, options?)` - Define alert rule
- `updateRule(ruleId, updates)` - Modify existing rule
- `deleteRule(ruleId)` - Remove rule
- `startEvaluation(intervalMs)` - Begin periodic rule evaluation
- `acknowledgeAlert(alertId, userId)` - Mark alert as acknowledged
- `resolveAlert(alertId)` - Mark alert as resolved

**Alert Lifecycle**:
```
active → acknowledged → resolved
```

### NotificationService

**Purpose**: Multi-channel notification dispatch for alerts.

**Supported Channels**:
- **Email** (SMTP with Handlebars templates)
- **Slack** (Webhooks with Block Kit formatting)
- **PagerDuty** (Events API v2)

**Key Methods**:
- `sendAlert(alert)` - Dispatch to all enabled channels
- `testAllChannels()` - Verify channel connectivity

**Configuration**:
```typescript
const config = {
  email: {
    enabled: true,
    minSeverity: 'warning',
    config: { /* SMTP settings */ },
  },
  slack: {
    enabled: true,
    minSeverity: 'error',
    config: { webhookUrl: 'https://...' },
  },
  pagerduty: {
    enabled: true,
    minSeverity: 'critical',
    config: { routingKey: 'xxx' },
  },
};
```

---

## Configuration

### automatosx.monitoring.json

```json
{
  "metrics": {
    "enabled": true,
    "retentionDays": 30
  },
  "tracing": {
    "enabled": true,
    "samplingRate": 1.0,
    "retentionDays": 7
  },
  "logging": {
    "enabled": true,
    "minLevel": "info",
    "bufferSize": 50,
    "retentionDays": 30
  },
  "alerting": {
    "enabled": true,
    "evaluationIntervalMs": 60000
  },
  "health": {
    "enabled": true,
    "checkIntervalMs": 30000
  },
  "notifications": {
    "email": {
      "enabled": true,
      "minSeverity": "warning",
      "config": {
        "smtp": {
          "host": "smtp.gmail.com",
          "port": 587,
          "secure": false
        },
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        },
        "from": "alerts@your-domain.com",
        "to": ["admin@your-domain.com"]
      }
    },
    "slack": {
      "enabled": true,
      "minSeverity": "error",
      "config": {
        "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
      }
    },
    "pagerduty": {
      "enabled": false,
      "minSeverity": "critical",
      "config": {
        "routingKey": "your-routing-key"
      }
    }
  },
  "websocket": {
    "enabled": true,
    "port": 8080,
    "updateIntervalMs": 5000
  },
  "api": {
    "enabled": true,
    "baseUrl": "/api/monitoring"
  }
}
```

---

## API Reference

### REST API Endpoints

**Base URL**: `/api/monitoring`

#### Metrics

- `GET /metrics?type=<metric-type>&startTime=<ms>&endTime=<ms>`
  - Returns: `{ type, startTime, endTime, aggregation: { count, avg, min, max, p50, p95, p99 } }`

#### Alerts

- `GET /alerts?status=<active|acknowledged|resolved>&severity=<info|warning|error|critical>`
  - Returns: `Alert[]`
- `POST /alerts/:id/acknowledge` (body: `{ userId }`)
  - Returns: `{ success: true, alertId }`
- `POST /alerts/:id/resolve`
  - Returns: `{ success: true, alertId }`

#### Health

- `GET /health`
  - Returns: `{ overall, timestamp, components: HealthCheck[], uptime, version }`
- `GET /health/:component`
  - Returns: `{ component, status, timestamp, responseTime, message, metadata }`

#### Workflows

- `GET /workflows?status=<active|completed|failed>&limit=<number>`
  - Returns: `WorkflowExecution[]`
- `GET /workflows/:id`
  - Returns: `WorkflowExecution`

#### Traces

- `GET /traces/:id`
  - Returns: `{ traceId, workflowExecutionId, startedAt, completedAt, duration, spans: Span[] }`
- `GET /traces/execution/:id`
  - Returns: `Trace[]`

#### Logs

- `GET /logs?level=<level>&source=<source>&search=<query>&limit=<number>`
  - Returns: `LogEntry[]`
- `GET /logs/execution/:id`
  - Returns: `LogEntry[]`

#### Stats

- `GET /stats`
  - Returns: `{ metrics, alerts, workflows, traces, logs, health, uptime }`

### WebSocket Events

**Connect**: `ws://localhost:8080`

**Events (Server → Client)**:
- `dashboard.update` - Full dashboard state
- `alert.triggered` - New alert created
- `alert.acknowledged` - Alert acknowledged
- `alert.resolved` - Alert resolved
- `workflow.started` - Workflow execution started
- `workflow.completed` - Workflow execution completed
- `workflow.failed` - Workflow execution failed
- `health.changed` - System health status changed
- `metric.recorded` - New metric recorded (if subscribed)

**Events (Client → Server)**:
- `subscribe` - Subscribe to channel (alerts, metrics, workflows)
- `unsubscribe` - Unsubscribe from channel

---

## Deployment

### Production Checklist

1. **Database Configuration**
   - Enable WAL mode: `PRAGMA journal_mode=WAL`
   - Set reasonable page size: `PRAGMA page_size=4096`
   - Configure retention policies

2. **Monitoring Services**
   - Start metrics collector
   - Start alerting evaluation
   - Start health checks
   - Start WebSocket server (if using dashboard)

3. **Notification Channels**
   - Configure SMTP for email alerts
   - Set up Slack webhook
   - Configure PagerDuty routing key

4. **Performance Tuning**
   - Adjust log buffer size based on volume
   - Configure trace sampling rate (0.1 for 10% sampling in production)
   - Set appropriate evaluation intervals

5. **Security**
   - Use environment variables for secrets
   - Enable authentication for API and WebSocket
   - Configure CORS for web dashboard
   - Use HTTPS/WSS in production

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY automatosx.monitoring.json ./

EXPOSE 3000 8080

CMD ["node", "dist/server.js"]
```

### Environment Variables

```bash
# Monitoring Configuration
MONITORING_ENABLED=true
MONITORING_LOG_LEVEL=info
MONITORING_TRACE_SAMPLING=0.1

# Notification Channels
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_USER=alerts@example.com
EMAIL_SMTP_PASS=app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
PAGERDUTY_ROUTING_KEY=your-key

# WebSocket Server
WS_PORT=8080
WS_UPDATE_INTERVAL=5000

# API Server
API_PORT=3000
API_BASE_URL=/api/monitoring
```

---

## Performance

### Benchmarks (In-Memory SQLite)

| Operation | Throughput | Latency (P95) |
|-----------|-----------|---------------|
| Metrics Collection | 10,000+ metrics/sec | <1ms |
| Metrics Aggregation | 1,000 metrics | <100ms |
| Trace Creation | 1,000 spans | <1ms per span |
| Trace Retrieval | 60 spans | <50ms |
| Structured Logging | 10,000+ logs/sec | <0.5ms |
| FTS Log Search | 1,000 logs | <50ms |
| Alert Evaluation | 100 rules | <50ms |
| Workflow Tracking | 100 concurrent | <5ms per operation |
| E2E Monitoring | Full pipeline | <50ms per workflow |

### Database Size

- **1,000 workflows** with full monitoring: ~5-10 MB
- **Retention**: Configurable cleanup (default 30 days metrics/logs, 7 days traces)

---

## Troubleshooting

### Common Issues

**Q: Logs not appearing in search results**
- **A**: Call `logger.flush()` to force write buffered logs to database

**Q: Alerts not triggering**
- **A**: Ensure `alerting.startEvaluation()` is called and metrics exist in the time window

**Q: WebSocket connection failing**
- **A**: Check WebSocket server is started and port is not blocked by firewall

**Q: Notification emails not sending**
- **A**: Verify SMTP credentials, enable "Less secure app access" for Gmail, or use app password

**Q: High database size**
- **A**: Run cleanup methods: `metrics.cleanup(30)`, `logger.cleanup(30)`, `tracer.cleanup(7)`

**Q: Slow metric aggregation**
- **A**: Add indexes on metric labels, reduce time window, or increase database page size

---

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/your-org/automatosx2/issues
- Documentation: https://docs.automatosx.com
- Email: support@automatosx.com

---

**Last Updated**: 2025-11-10
**Version**: 2.0.0
