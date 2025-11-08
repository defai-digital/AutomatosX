# P3 Week 2 - Remote Submission & Aggregation Plan

**Date**: 2025-11-07
**Phase**: P3.2 - Remote Submission & Aggregation
**Status**: 🚀 Planning Complete, Ready for Implementation

---

## Executive Summary

P3 Week 2 focuses on building the infrastructure for **remote telemetry submission** and **server-side aggregation**. This enables AutomatosX to collect anonymous usage data at scale while maintaining privacy-first principles.

**Goals**:
1. Implement remote submission client with retry logic
2. Create batch processing and queue management
3. Build aggregation service for analytics
4. Add rate limiting and exponential backoff
5. Implement comprehensive testing

**Timeline**: 5 days (Days 1-5)

---

## Architecture Overview

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Local Client   │────▶│  Submission      │────▶│  Remote Server  │
│  (TelemetryService)   │  Queue & Retry   │     │  (Endpoint)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Local SQLite   │     │  Rate Limiter    │     │  Aggregation    │
│  Database       │     │  & Backoff       │     │  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Components to Build

1. **TelemetrySubmissionClient** - HTTP client for remote submission
2. **TelemetryQueue** - Local queue for pending submissions
3. **RetryManager** - Exponential backoff and retry logic
4. **RateLimiter** - Prevent API abuse
5. **AggregationService** - Server-side data aggregation (placeholder)

---

## Day 1: Remote Submission Client

### Goals
- Create HTTP client for telemetry submission
- Implement request/response handling
- Add authentication (API key)
- Handle network errors gracefully

### Files to Create

#### 1. `src/services/TelemetrySubmissionClient.ts` (~200 lines)

**Purpose**: HTTP client for submitting telemetry to remote server

**Key Features**:
- HTTPS requests with timeout
- API key authentication
- Request payload validation
- Response parsing
- Network error handling

**Interface**:
```typescript
class TelemetrySubmissionClient {
  constructor(config: SubmissionConfig);

  // Submit batch of events
  async submitBatch(events: TelemetryEvent[]): Promise<SubmissionResult>;

  // Test connection
  async ping(): Promise<boolean>;

  // Get server info
  async getServerInfo(): Promise<ServerInfo>;
}

interface SubmissionConfig {
  endpoint: string;
  apiKey?: string;
  timeout: number; // Default: 30000ms
  maxRetries: number; // Default: 3
}

interface SubmissionResult {
  success: boolean;
  accepted: number;
  rejected: number;
  errors?: string[];
}
```

**Privacy Features**:
- Verify all data is anonymized before submission
- No additional metadata added
- Secure HTTPS only
- Optional API key for authentication

**Implementation Pattern**:
```typescript
import { z } from 'zod';

// Validation schemas
const SubmissionConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  timeout: z.number().default(30000),
  maxRetries: z.number().default(3),
});

const SubmissionResultSchema = z.object({
  success: z.boolean(),
  accepted: z.number(),
  rejected: z.number(),
  errors: z.array(z.string()).optional(),
});

export class TelemetrySubmissionClient {
  private config: SubmissionConfig;

  constructor(config: SubmissionConfig) {
    this.config = SubmissionConfigSchema.parse(config);
  }

  async submitBatch(events: TelemetryEvent[]): Promise<SubmissionResult> {
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey || '',
          'User-Agent': 'AutomatosX-Telemetry/2.0',
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return SubmissionResultSchema.parse(result);
    } catch (error) {
      return {
        success: false,
        accepted: 0,
        rejected: events.length,
        errors: [error.message],
      };
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

---

## Day 2: Queue & Retry Management

### Goals
- Implement local queue for pending submissions
- Add retry logic with exponential backoff
- Handle offline scenarios
- Persist queue state to SQLite

### Files to Create

#### 1. `src/services/TelemetryQueue.ts` (~250 lines)

**Purpose**: Manage queue of events awaiting remote submission

**Key Features**:
- SQLite-based persistence
- FIFO queue operations
- Batch size management
- Retry tracking
- Automatic cleanup

**Database Schema** (Migration 006):
```sql
-- src/migrations/006_create_telemetry_queue.sql

CREATE TABLE IF NOT EXISTS telemetry_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  queued_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  next_retry_at INTEGER,
  last_error TEXT,
  FOREIGN KEY (event_id) REFERENCES telemetry_events(id) ON DELETE CASCADE
);

CREATE INDEX idx_telemetry_queue_next_retry ON telemetry_queue(next_retry_at);
CREATE INDEX idx_telemetry_queue_queued_at ON telemetry_queue(queued_at);
```

**Interface**:
```typescript
class TelemetryQueue {
  // Add events to queue
  enqueue(eventIds: number[]): void;

  // Get next batch for submission (max N events)
  dequeue(batchSize: number): QueuedEvent[];

  // Mark events as successfully submitted
  markSubmitted(eventIds: number[]): void;

  // Mark events as failed, schedule retry
  markFailed(eventIds: number[], error: string): void;

  // Get queue stats
  getStats(): QueueStats;

  // Clean up old queue entries
  cleanup(olderThan: Date): void;
}

interface QueuedEvent {
  id: number;
  eventId: number;
  queuedAt: number;
  retryCount: number;
  nextRetryAt: number | null;
}

interface QueueStats {
  pending: number;
  retrying: number;
  oldestQueuedAt: number | null;
}
```

#### 2. `src/services/RetryManager.ts` (~150 lines)

**Purpose**: Calculate retry delays with exponential backoff

**Key Features**:
- Exponential backoff (2^retryCount * baseDelay)
- Jitter to prevent thundering herd
- Max retry limit (default: 5)
- Max delay cap (default: 1 hour)

**Interface**:
```typescript
class RetryManager {
  // Calculate next retry delay
  getNextRetryDelay(retryCount: number): number;

  // Check if should retry
  shouldRetry(retryCount: number): boolean;

  // Get retry timestamp
  getNextRetryTimestamp(retryCount: number): number;
}
```

**Implementation**:
```typescript
export class RetryManager {
  private baseDelay = 1000; // 1 second
  private maxRetries = 5;
  private maxDelay = 3600000; // 1 hour

  getNextRetryDelay(retryCount: number): number {
    // Exponential backoff: 2^retryCount * baseDelay
    const delay = Math.min(
      Math.pow(2, retryCount) * this.baseDelay,
      this.maxDelay
    );

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  }

  shouldRetry(retryCount: number): boolean {
    return retryCount < this.maxRetries;
  }

  getNextRetryTimestamp(retryCount: number): number {
    return Date.now() + this.getNextRetryDelay(retryCount);
  }
}
```

**Backoff Schedule**:
- Retry 0: 1s (±250ms)
- Retry 1: 2s (±500ms)
- Retry 2: 4s (±1s)
- Retry 3: 8s (±2s)
- Retry 4: 16s (±4s)
- Retry 5: 32s (±8s) [last attempt]

---

## Day 3: Rate Limiting & Submission Orchestration

### Goals
- Implement rate limiting to prevent API abuse
- Create submission orchestrator
- Add background submission worker
- Handle connection state

### Files to Create

#### 1. `src/services/RateLimiter.ts` (~100 lines)

**Purpose**: Token bucket rate limiter

**Key Features**:
- Token bucket algorithm
- Configurable rate (events/minute)
- Burst allowance
- Thread-safe

**Interface**:
```typescript
class RateLimiter {
  constructor(config: RateLimiterConfig);

  // Check if can submit N events
  canSubmit(count: number): boolean;

  // Consume tokens for N events
  consume(count: number): boolean;

  // Get time until next token available
  getWaitTime(): number;
}

interface RateLimiterConfig {
  rate: number; // Events per minute
  burst: number; // Max burst size
}
```

**Implementation**:
```typescript
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private rate: number; // tokens per ms
  private burst: number;

  constructor(config: RateLimiterConfig) {
    this.burst = config.burst;
    this.tokens = config.burst;
    this.rate = config.rate / 60000; // Convert per-minute to per-ms
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.rate;

    this.tokens = Math.min(this.burst, this.tokens + newTokens);
    this.lastRefill = now;
  }

  canSubmit(count: number): boolean {
    this.refill();
    return this.tokens >= count;
  }

  consume(count: number): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  getWaitTime(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.rate);
  }
}
```

#### 2. `src/services/TelemetrySubmissionOrchestrator.ts` (~300 lines)

**Purpose**: Orchestrate remote submission workflow

**Key Features**:
- Background worker for periodic submission
- Automatic retry of failed submissions
- Rate limiting integration
- Network state detection
- Graceful shutdown

**Interface**:
```typescript
class TelemetrySubmissionOrchestrator {
  constructor(
    client: TelemetrySubmissionClient,
    queue: TelemetryQueue,
    rateLimiter: RateLimiter
  );

  // Start background worker
  start(): void;

  // Stop background worker
  stop(): void;

  // Submit now (manual trigger)
  submitNow(): Promise<SubmissionStats>;

  // Get submission stats
  getStats(): SubmissionStats;
}

interface SubmissionStats {
  totalSubmitted: number;
  totalFailed: number;
  queueSize: number;
  lastSubmissionAt: number | null;
  lastError: string | null;
}
```

**Worker Loop**:
```typescript
private async workerLoop(): Promise<void> {
  while (this.running) {
    try {
      // Wait for interval
      await this.sleep(this.interval);

      // Check if online
      if (!this.isOnline()) {
        continue;
      }

      // Check rate limit
      if (!this.rateLimiter.canSubmit(this.batchSize)) {
        const waitTime = this.rateLimiter.getWaitTime();
        await this.sleep(waitTime);
        continue;
      }

      // Get next batch from queue
      const batch = this.queue.dequeue(this.batchSize);

      if (batch.length === 0) {
        continue;
      }

      // Get events for batch
      const events = batch.map(qe => this.getEvent(qe.eventId));

      // Submit batch
      const result = await this.client.submitBatch(events);

      if (result.success) {
        // Mark as submitted
        this.queue.markSubmitted(batch.map(qe => qe.eventId));
        this.stats.totalSubmitted += result.accepted;
      } else {
        // Mark as failed, schedule retry
        this.queue.markFailed(
          batch.map(qe => qe.eventId),
          result.errors?.join(', ') || 'Unknown error'
        );
        this.stats.totalFailed += batch.length;
      }

      this.stats.lastSubmissionAt = Date.now();
    } catch (error) {
      this.stats.lastError = error.message;
    }
  }
}
```

---

## Day 4: Integration & Configuration

### Goals
- Integrate submission into TelemetryService
- Add configuration options
- Update CLI commands
- Add submission status commands

### Updates Needed

#### 1. Update `TelemetryService.ts`

**New Methods**:
```typescript
class TelemetryService {
  // ... existing methods ...

  // Start remote submission
  async enableRemoteSubmission(): Promise<void>;

  // Stop remote submission
  async disableRemoteSubmission(): Promise<void>;

  // Get submission stats
  getSubmissionStats(): SubmissionStats;

  // Force immediate submission
  async submitNow(): Promise<SubmissionStats>;
}
```

**Configuration Update**:
```typescript
interface TelemetryConfig {
  // ... existing fields ...
  remoteEndpoint?: string;
  remoteApiKey?: string;
  submissionInterval?: number; // Default: 300000 (5 minutes)
  submissionBatchSize?: number; // Default: 100
  submissionRateLimit?: number; // Default: 1000 events/minute
}
```

#### 2. Update `src/cli/commands/telemetry.ts`

**New Subcommands**:
```bash
ax telemetry submit      # Trigger immediate submission
ax telemetry queue       # Show queue status
```

**Updated Commands**:
```bash
ax telemetry status      # Include submission status
ax telemetry enable      # Configure remote endpoint
```

---

## Day 5: Testing & Documentation

### Goals
- Create comprehensive unit tests
- Add integration tests
- Document submission architecture
- Create troubleshooting guide

### Tests to Create

#### 1. `TelemetrySubmissionClient.test.ts` (~200 lines)
- Test successful submission
- Test network errors
- Test timeout handling
- Test retry logic
- Test authentication

#### 2. `TelemetryQueue.test.ts` (~200 lines)
- Test enqueue/dequeue
- Test retry scheduling
- Test cleanup
- Test stats

#### 3. `RateLimiter.test.ts` (~100 lines)
- Test token consumption
- Test refill rate
- Test burst handling
- Test wait time calculation

#### 4. `TelemetrySubmissionOrchestrator.test.ts` (~250 lines)
- Test worker loop
- Test network state handling
- Test graceful shutdown
- Test stats tracking

**Total Test Coverage**: ~750 lines, 40+ tests

---

## Configuration

### Environment Variables

```bash
# Remote submission endpoint
AUTOMATOSX_TELEMETRY_ENDPOINT=https://telemetry.automatosx.com/v1/submit

# API key for authentication (optional)
AUTOMATOSX_TELEMETRY_API_KEY=your-api-key-here

# Submission interval in milliseconds (default: 300000 = 5 minutes)
AUTOMATOSX_TELEMETRY_INTERVAL=300000

# Batch size (default: 100)
AUTOMATOSX_TELEMETRY_BATCH_SIZE=100

# Rate limit (events per minute, default: 1000)
AUTOMATOSX_TELEMETRY_RATE_LIMIT=1000
```

### Database Config

Update `telemetry_config` table:
```sql
ALTER TABLE telemetry_config ADD COLUMN remote_endpoint TEXT;
ALTER TABLE telemetry_config ADD COLUMN remote_api_key TEXT;
ALTER TABLE telemetry_config ADD COLUMN submission_interval INTEGER DEFAULT 300000;
ALTER TABLE telemetry_config ADD COLUMN submission_batch_size INTEGER DEFAULT 100;
ALTER TABLE telemetry_config ADD COLUMN submission_rate_limit INTEGER DEFAULT 1000;
```

---

## Privacy & Security

### Privacy Guarantees

1. **No Additional Data**: Remote submission doesn't add any metadata
2. **Already Anonymized**: All data anonymized at collection time
3. **Encrypted Transport**: HTTPS only
4. **Optional**: Remote submission is opt-in
5. **Local First**: All data available locally even if remote fails

### Security Measures

1. **HTTPS Only**: Reject non-HTTPS endpoints
2. **API Key**: Optional authentication
3. **Rate Limiting**: Prevent abuse
4. **Timeout**: Network timeout to prevent hangs
5. **Validation**: Validate all responses

---

## Error Handling

### Network Errors

**Scenarios**:
- Offline (no internet)
- Timeout (slow connection)
- DNS failure
- Connection refused
- HTTP errors (4xx, 5xx)

**Strategy**:
- Detect offline state, skip submission
- Exponential backoff for retries
- Queue events for later submission
- Silent failure (never break application)

### Queue Management

**Scenarios**:
- Queue grows too large
- Old events accumulate
- Disk space issues

**Strategy**:
- Max queue size (default: 10,000 events)
- Automatic cleanup (events older than 30 days)
- Drop oldest events when queue full
- Warn user if queue is large

---

## Performance

### Targets

- **Submission overhead**: < 5ms per event (queuing only)
- **Background worker**: < 1% CPU usage
- **Network**: Batch submissions to reduce requests
- **Memory**: < 10MB for queue management

### Optimizations

1. **Batch submissions**: 100 events per request
2. **Background worker**: Runs every 5 minutes
3. **Rate limiting**: Prevents API overload
4. **SQLite queue**: Persistent, fast
5. **Async operations**: Non-blocking

---

## Monitoring & Observability

### Metrics to Track

1. **Submission success rate**: % of successful submissions
2. **Queue size**: Number of pending events
3. **Retry rate**: Number of retries per submission
4. **Network errors**: Count of network failures
5. **Latency**: Time to submit batch

### CLI Commands

```bash
# Show submission stats
ax telemetry status

# Show queue status
ax telemetry queue

# Trigger immediate submission
ax telemetry submit

# View submission history
ax telemetry stats --type submission
```

---

## Migration Path

### From Week 1 (Local Only)

**Automatic**:
- Existing local data remains untouched
- Queue starts empty
- No changes to existing behavior

**User Action Required**:
```bash
# Enable remote submission
ax telemetry enable --remote

# Configure endpoint (if not default)
ax telemetry config set remote-endpoint https://your-endpoint.com
```

---

## Summary Statistics

### Files to Create

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `src/services/TelemetrySubmissionClient.ts` | TS | 200 | HTTP client |
| `src/services/TelemetryQueue.ts` | TS | 250 | Queue management |
| `src/services/RetryManager.ts` | TS | 150 | Retry logic |
| `src/services/RateLimiter.ts` | TS | 100 | Rate limiting |
| `src/services/TelemetrySubmissionOrchestrator.ts` | TS | 300 | Orchestration |
| `src/migrations/006_create_telemetry_queue.sql` | SQL | 20 | Queue schema |
| `src/services/__tests__/TelemetrySubmissionClient.test.ts` | Test | 200 | Client tests |
| `src/services/__tests__/TelemetryQueue.test.ts` | Test | 200 | Queue tests |
| `src/services/__tests__/RateLimiter.test.ts` | Test | 100 | Rate limiter tests |
| `src/services/__tests__/TelemetrySubmissionOrchestrator.test.ts` | Test | 250 | Orchestrator tests |
| **Total** | - | **1,770** | **10 files** |

### Files to Modify

- `src/services/TelemetryService.ts` (+100 lines)
- `src/cli/commands/telemetry.ts` (+150 lines)
- `src/types/schemas/telemetry.schema.ts` (+50 lines)

**Total New/Modified**: ~2,070 lines

---

## Timeline

### Day 1 (8 hours)
- [ ] Create `TelemetrySubmissionClient.ts`
- [ ] Create basic tests
- [ ] Test HTTP submission

### Day 2 (8 hours)
- [ ] Create `TelemetryQueue.ts`
- [ ] Create `RetryManager.ts`
- [ ] Create migration 006
- [ ] Test queue operations

### Day 3 (8 hours)
- [ ] Create `RateLimiter.ts`
- [ ] Create `TelemetrySubmissionOrchestrator.ts`
- [ ] Test orchestration

### Day 4 (8 hours)
- [ ] Update `TelemetryService.ts`
- [ ] Update CLI commands
- [ ] Integration testing

### Day 5 (8 hours)
- [ ] Complete test suite
- [ ] Documentation
- [ ] Final verification

**Total Effort**: 5 days (40 hours)

---

## Success Criteria

- [ ] All 40+ tests passing
- [ ] Submission success rate > 95%
- [ ] Queue management functional
- [ ] Rate limiting working
- [ ] Retry logic tested
- [ ] CLI commands updated
- [ ] Documentation complete
- [ ] Performance targets met

---

## Conclusion

P3 Week 2 builds on the solid foundation of Week 1 to enable **remote telemetry submission** with:
- Robust retry logic
- Rate limiting
- Queue management
- Privacy-first design maintained
- Comprehensive testing

This enables AutomatosX to collect anonymous usage data at scale while maintaining all privacy guarantees and never breaking the user experience.

---

**Planning Date**: 2025-11-07
**Status**: ✅ Plan Complete, Ready for Implementation
**Next Step**: Begin Day 1 implementation (TelemetrySubmissionClient)
