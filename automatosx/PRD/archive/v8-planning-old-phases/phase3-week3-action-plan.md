# Phase 3 Week 3: Monitoring & Observability - Action Plan

**AutomatosX v2 - Advanced Provider Monitoring**

**Date**: 2025-11-10
**Duration**: Week 3 (Days 11-15)
**Status**: 🚀 Ready to Start

---

## Executive Summary

Phase 3 Week 3 implements comprehensive monitoring and observability for the AI Provider Layer. This includes real-time metrics collection, alerting, dashboards, and cost analytics.

### Week 3 Goals

1. **Real-time Metrics Collection** - Capture and aggregate provider performance data
2. **Alert System** - Proactive notification of issues and anomalies
3. **Cost Analytics** - Track spending and project future costs
4. **Monitoring Dashboard** - CLI-based visualization of metrics
5. **Query Language** - Flexible metric queries (Grafana-style)

---

## Week 3 Schedule (Days 11-15)

### Day 11-12: Metrics Collection & Aggregation
**Focus**: Core metrics infrastructure

**Deliverables**:
- [ ] Monitoring database schema (metrics, alerts, thresholds)
- [ ] MetricsCollector service (real-time data capture)
- [ ] MetricsAggregator service (roll-ups: hourly, daily, weekly)
- [ ] Time-series data storage optimization

**Features**:
- Real-time metric capture
- Automatic aggregation (1min, 5min, 1hour, 1day)
- Retention policies (raw: 7 days, aggregated: 90 days)
- Efficient time-series queries

### Day 13: Alert System
**Focus**: Proactive monitoring and notifications

**Deliverables**:
- [ ] AlertManager service
- [ ] Alert rule engine (threshold, anomaly, trend)
- [ ] Alert channels (CLI, webhook, email placeholders)
- [ ] Alert state management (firing, resolved, acknowledged)

**Features**:
- Configurable alert rules
- Multi-condition alerts (AND/OR logic)
- Alert severity levels (info, warning, critical)
- Alert history and acknowledgment

### Day 14: Cost Analytics & Dashboards
**Focus**: Cost visibility and CLI dashboards

**Deliverables**:
- [ ] CostAnalytics service (spending analysis)
- [ ] Cost projection algorithms
- [ ] Budget tracking and alerts
- [ ] CLI dashboard renderer (charts, tables)

**Features**:
- Cost breakdowns (by provider, model, user, time)
- Spend projections (daily, monthly, annual)
- Budget alerts and recommendations
- CLI charts (sparklines, bar charts, tables)

### Day 15: Integration & Testing
**Focus**: End-to-end testing and documentation

**Deliverables**:
- [ ] Monitoring CLI commands (`ax monitor`)
- [ ] Query language implementation
- [ ] Integration tests
- [ ] Week 3 completion summary

**Features**:
- `ax monitor status` - Real-time system status
- `ax monitor metrics` - Query metrics with filters
- `ax monitor alerts` - View and manage alerts
- `ax monitor costs` - Cost analytics dashboard
- Query language: `provider=claude AND latency>1000`

---

## Technical Architecture

### Metrics Collection Pipeline

```
Provider Request/Response
   ↓
MetricsCollector.record()
   ↓
Insert into metrics_raw (SQLite)
   ↓
Background Aggregator (every 1 min)
   ↓
Aggregate to metrics_1min, metrics_1hour, metrics_1day
   ↓
Check Alert Rules
   ↓
Fire Alerts if thresholds exceeded
   ↓
Store in alerts table
```

### Database Schema

**Tables**:
1. `metrics_raw` - Raw metric events (7 day retention)
2. `metrics_1min` - 1-minute aggregates (30 day retention)
3. `metrics_1hour` - 1-hour aggregates (90 day retention)
4. `metrics_1day` - 1-day aggregates (365 day retention)
5. `alert_rules` - Alert configurations
6. `alerts` - Alert instances
7. `alert_history` - Alert state changes
8. `cost_budgets` - Budget configurations
9. `cost_projections` - Cost forecast data

### Metric Types

**Performance Metrics**:
- Latency (p50, p95, p99)
- Throughput (requests per second)
- Error rate
- Success rate
- Token usage

**Cost Metrics**:
- Cost per request
- Cost per provider
- Cost per user
- Cost per model
- Daily/monthly spend

**Cache Metrics**:
- Hit rate
- Miss rate
- Cost savings
- Token savings

**Rate Limit Metrics**:
- Requests allowed
- Requests denied
- Violation count
- Quota utilization

### Alert Types

**Threshold Alerts**:
```typescript
{
  name: "High Latency",
  condition: "avg(latency) > 2000",
  duration: "5m",
  severity: "warning"
}
```

**Anomaly Alerts**:
```typescript
{
  name: "Error Spike",
  condition: "error_rate > baseline * 3",
  duration: "1m",
  severity: "critical"
}
```

**Budget Alerts**:
```typescript
{
  name: "Budget 80% Used",
  condition: "monthly_spend >= budget * 0.8",
  severity: "warning"
}
```

### Query Language

**Syntax** (Grafana-inspired):
```
metric_name{label="value"} [time_range] [aggregation]
```

**Examples**:
```
# Average latency for Claude in last hour
latency{provider="claude"} [1h] avg

# Error rate for all providers
error_rate{} [24h] sum

# Cost per model this month
cost{model=~".*"} [30d] sum by(model)

# P95 latency trend
latency{} [7d] p95 by(provider)
```

---

## Monitoring CLI Commands

### `ax monitor status`
Show real-time system health

```bash
ax monitor status                 # Overall status
ax monitor status --provider claude
ax monitor status --verbose       # Detailed metrics
ax monitor status --json          # JSON output
```

**Output**:
```
Provider Health Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Claude   ✓ Healthy
    Latency: 850ms (p95)
    Success: 99.2%
    Cost: $45.23 today

  Gemini   ✓ Healthy
    Latency: 650ms (p95)
    Success: 99.8%
    Cost: $12.45 today

  OpenAI   ⚠ Degraded
    Latency: 2,100ms (p95) [HIGH]
    Success: 95.3% [LOW]
    Cost: $67.89 today

Active Alerts: 2
  ⚠ OpenAI Latency High (5m)
  ⚠ Budget 85% Used

Cache Hit Rate: 62%
Rate Limit Status: OK
```

### `ax monitor metrics`
Query and visualize metrics

```bash
ax monitor metrics latency --provider claude --range 1h
ax monitor metrics error_rate --range 24h --format chart
ax monitor metrics cost --group-by provider --range 7d
ax monitor metrics --query 'latency{provider="claude"} [1h] p95'
```

**Output** (with ASCII charts):
```
Latency - Last 1 hour (Claude)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2000ms ┤         ╭╮
  1500ms ┤    ╭────╯╰╮
  1000ms ┤ ╭──╯      ╰─╮
   500ms ┤─╯           ╰──
     0ms └─────────────────
         11:00      11:30      12:00

P50: 850ms  P95: 1,200ms  P99: 1,800ms
Avg: 920ms  Min: 650ms    Max: 2,100ms
```

### `ax monitor alerts`
Manage alerts

```bash
ax monitor alerts list               # All active alerts
ax monitor alerts list --resolved    # Show resolved alerts
ax monitor alerts ack <id>           # Acknowledge alert
ax monitor alerts rules              # List alert rules
ax monitor alerts create             # Create new rule (interactive)
ax monitor alerts disable <rule>     # Disable rule
```

**Output**:
```
Active Alerts (2):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠ WARNING  OpenAI Latency High
    Started: 5m ago
    Condition: avg(latency) > 2000ms
    Current: 2,150ms
    [Ack] [Silence]

  ⚠ WARNING  Budget 85% Used
    Started: 1h ago
    Condition: spend >= budget * 0.85
    Current: $425.67 / $500.00
    [Ack] [Silence]

Alert Rules (5):
  ✓ High Latency (enabled)
  ✓ Error Spike (enabled)
  ✓ Budget 80% (enabled)
  ✓ Cache Hit Low (enabled)
  ✓ Rate Limit High (enabled)
```

### `ax monitor costs`
Cost analytics dashboard

```bash
ax monitor costs                     # Today's costs
ax monitor costs --range 30d         # Last 30 days
ax monitor costs --by provider       # Group by provider
ax monitor costs --by model          # Group by model
ax monitor costs --projection        # Show projections
ax monitor costs --budget            # Compare to budget
```

**Output**:
```
Cost Analytics - November 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Spend: $425.67 (85% of budget)
Projected Month: $498.23 (99.6% of budget)

By Provider:
  Claude   $267.89  (62.9%)  ████████████▌
  OpenAI   $98.45   (23.1%)  ████▋
  Gemini   $59.33   (13.9%)  ██▊

By Model:
  claude-3-5-sonnet  $189.23  ███████████▍
  gpt-4-turbo        $98.45   ██████
  gemini-1.5-pro     $42.10   ██▌
  claude-3-haiku     $78.66   ████▊
  gemini-1.5-flash   $17.23   █

Cost Trend (Last 7 days):
  $65.23 ▁▂▃▅▆▇█ $72.15 (10% increase)

Recommendations:
  • Switch 30% of requests to Gemini Flash (save $45/month)
  • Increase cache TTL to 2 hours (save $23/month)
  • Use cost-based routing (save $67/month)

Budget Alert: You're on track to exceed budget by $48
```

---

## Cost Analytics Features

### Cost Tracking

**Per Request**:
```typescript
const cost = calculateCost(provider, model, inputTokens, outputTokens);
await metricsCollector.recordCost({
  provider,
  model,
  cost,
  tokens: { input: inputTokens, output: outputTokens },
  userId,
  timestamp: Date.now()
});
```

**Aggregations**:
- Hourly spend
- Daily spend
- Monthly spend
- Per provider, per model, per user

### Cost Projections

**Linear Projection**:
```typescript
const dailyAvg = totalSpend / daysElapsed;
const monthlyProjection = dailyAvg * 30;
```

**Trend-based Projection**:
```typescript
const trend = calculateTrend(dailySpendHistory);
const monthlyProjection = applyTrend(currentSpend, trend, daysRemaining);
```

**Confidence Intervals**:
```typescript
const projection = {
  estimate: $498.23,
  low: $475.00,      // 10th percentile
  high: $525.00,     // 90th percentile
  confidence: 0.85
};
```

### Budget Management

**Budget Configuration**:
```typescript
interface CostBudget {
  id: string;
  name: string;
  period: 'daily' | 'weekly' | 'monthly';
  limit: number;
  alerts: {
    at50Percent: boolean;
    at80Percent: boolean;
    at95Percent: boolean;
    atExceeded: boolean;
  };
  createdAt: number;
  updatedAt: number;
}
```

**Budget Tracking**:
- Real-time spend vs budget
- Percentage utilized
- Days remaining in period
- Projected overage/underage

---

## Performance Requirements

### Metrics Collection
- **Recording Latency**: < 1ms (async write)
- **Query Latency**: < 50ms (indexed time-series)
- **Aggregation**: Every 1 minute (background job)
- **Retention Cleanup**: Daily (remove old raw metrics)

### Alert Evaluation
- **Check Frequency**: Every 1 minute
- **Evaluation Latency**: < 10ms per rule
- **Alert Delivery**: < 100ms

### Dashboard Rendering
- **Query Time**: < 100ms
- **Chart Rendering**: < 50ms (ASCII)
- **Full Dashboard**: < 500ms

---

## Database Optimization

### Indexes
```sql
CREATE INDEX idx_metrics_time ON metrics_raw(timestamp);
CREATE INDEX idx_metrics_provider ON metrics_raw(provider);
CREATE INDEX idx_metrics_compound ON metrics_raw(provider, timestamp);
CREATE INDEX idx_alerts_state ON alerts(state, created_at);
```

### Partitioning Strategy
- Raw metrics: Partition by day
- Aggregates: Partition by month
- Automatic old partition cleanup

### Retention Policies
```sql
-- Delete raw metrics older than 7 days
DELETE FROM metrics_raw WHERE timestamp < ?;

-- Delete 1-minute aggregates older than 30 days
DELETE FROM metrics_1min WHERE timestamp < ?;

-- Keep 1-hour and 1-day aggregates for 90+ days
```

---

## Integration Points

### ProviderService Integration
```typescript
class ProviderService {
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const response = await this.router.routeRequest(request);

      // Record success metrics
      await this.metricsCollector.record({
        type: 'request',
        provider: response.provider,
        model: response.model,
        latency: Date.now() - startTime,
        tokens: response.tokens,
        cost: this.calculateCost(response),
        success: true,
        timestamp: Date.now()
      });

      return response;
    } catch (error) {
      // Record error metrics
      await this.metricsCollector.record({
        type: 'request',
        provider: request.provider,
        latency: Date.now() - startTime,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }
}
```

### Cache Integration
```typescript
// Record cache metrics
await metricsCollector.record({
  type: 'cache',
  event: result.hit ? 'hit' : 'miss',
  savedCost: result.savedCost,
  savedTokens: result.savedTokens,
  timestamp: Date.now()
});
```

### Rate Limiter Integration
```typescript
// Record rate limit metrics
await metricsCollector.record({
  type: 'rate_limit',
  event: result.allowed ? 'allowed' : 'denied',
  key,
  type: rateLimitType,
  remaining: result.remaining,
  timestamp: Date.now()
});
```

---

## Success Criteria - Week 3

- [ ] Metrics collection pipeline functional
- [ ] Time-series aggregation working
- [ ] Alert system operational
- [ ] Alert rules configurable
- [ ] Cost analytics accurate
- [ ] Budget tracking functional
- [ ] CLI dashboards rendering correctly
- [ ] Query language implemented
- [ ] Integration tests passing
- [ ] Documentation complete

---

## Deliverables Summary

### Code
- `src/migrations/012_create_monitoring_tables.sql` (250 lines)
- `src/services/MetricsCollector.ts` (400 lines)
- `src/services/MetricsAggregator.ts` (300 lines)
- `src/services/AlertManager.ts` (500 lines)
- `src/services/CostAnalytics.ts` (400 lines)
- `src/cli/commands/monitor.ts` (600 lines)
- `src/cli/utils/ChartRenderer.ts` (300 lines)
- `src/__tests__/monitoring/Phase3Week3Integration.test.ts` (400 lines)

**Total**: ~3,150 lines

### Documentation
- `automatosx/PRD/phase3-week3-summary.md` (comprehensive documentation)

---

## Risk Mitigation

### Performance Risks
- **Risk**: Metrics collection slows down requests
- **Mitigation**: Async recording, batch writes, connection pooling

### Storage Risks
- **Risk**: Metrics database grows too large
- **Mitigation**: Aggressive retention policies, automatic cleanup, aggregation

### Alert Fatigue
- **Risk**: Too many alerts overwhelm users
- **Mitigation**: Alert grouping, smart thresholds, acknowledgment

---

## Future Enhancements (P1)

- [ ] Distributed tracing (OpenTelemetry)
- [ ] Anomaly detection (ML-based)
- [ ] Custom metric definitions
- [ ] Metric exports (Prometheus, Datadog)
- [ ] Web dashboard (React)
- [ ] Slack/email integrations
- [ ] SLO/SLA tracking
- [ ] Incident management

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-10
**Status**: 📋 Planning Complete - Ready for Implementation
