# Telemetry User Guide

**AutomatosX Telemetry System - Privacy-First Usage Analytics**

---

## Table of Contents

1. [What is Telemetry?](#what-is-telemetry)
2. [Privacy First](#privacy-first)
3. [Getting Started](#getting-started)
4. [CLI Commands](#cli-commands)
5. [Understanding Your Data](#understanding-your-data)
6. [FAQ](#faq)
7. [Privacy Policy](#privacy-policy)

---

## What is Telemetry?

Telemetry is **anonymous usage data** that helps us understand how AutomatosX is being used and where we can improve the tool. Think of it as giving us feedback without having to write anything - the system automatically tracks what commands you use, how fast they run, and what errors you encounter.

### Why Enable Telemetry?

**Benefits for you**:
- Help prioritize features based on what you actually use
- Identify performance bottlenecks affecting your workflows
- Get bugs fixed faster by providing anonymous error reports
- Contribute to making AutomatosX better for everyone

**What's in it for us**:
- Understand which features are most valuable
- Make data-driven decisions about where to focus development
- Identify performance regressions before they affect users
- Track adoption of new features

### What Makes Our Telemetry Different?

**Privacy-First Design**:
- 🚫 **No personally identifiable information (PII)** ever collected
- 🔒 **Local-first**: All data stored on your machine by default
- ✅ **Explicit consent**: You must opt-in to enable telemetry
- 📊 **Full transparency**: View all collected data anytime
- 🗑️ **Your control**: Clear data or disable telemetry whenever you want

---

## Privacy First

### What We Collect

✅ **Anonymous usage metrics**:
- Command execution times (e.g., "ax find took 145ms")
- Query types and result counts (e.g., "symbol query returned 5 results")
- Parser invocations and language statistics (e.g., "parsed TypeScript file in 8ms")
- Error types and counts (e.g., "parse error occurred 3 times")
- Performance metrics (e.g., "cache hit rate 42%")

**Example event**:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "query_performed",
  "eventData": {
    "queryType": "symbol",
    "query": "calculateTotal",
    "resultCount": 5,
    "duration": 12,
    "cached": false,
    "language": "typescript"
  },
  "timestamp": 1699390800000
}
```

### What We DON'T Collect

❌ **NO personally identifiable information**:
- NO file paths or directory names
- NO code content or snippets
- NO user identifiers or machine names
- NO IP addresses or network information
- NO environment variables
- NO system information beyond language and OS type

**Privacy Boundaries**:
- **Query strings are truncated** to 100 characters max
- **Error messages are truncated** to 200 characters max
- **Stack traces are truncated** to 500 characters max
- **No stack traces with file paths** are ever collected

---

## Getting Started

### Step 1: Enable Telemetry

Enable local-only telemetry (data stored on your machine):

```bash
ax telemetry enable
```

**Output**:
```
✓ Telemetry enabled successfully!

Telemetry data will be collected locally.
Remote submission is disabled (local only).

What data is collected:
  • Command execution times
  • Query performance metrics
  • Parser invocation statistics
  • Error occurrences (no stack traces)
  • Performance metrics

What is NOT collected:
  • File paths or names
  • Code content
  • User identifiers
  • Any personally identifiable information

You can disable telemetry anytime with:
  ax telemetry disable
```

### Step 2: (Optional) Enable Remote Submission

Enable telemetry with remote submission (helps us aggregate data):

```bash
ax telemetry enable --remote
```

**Output**:
```
✓ Telemetry enabled successfully!

Telemetry data will be collected locally.
Remote submission is enabled.

[Same privacy information as above]
```

**What happens with remote submission?**
- Events are queued locally in SQLite
- Automatically submitted every 30 seconds in background
- Rate-limited to 60 events/minute (burst: 10)
- Automatic retry with exponential backoff on network failures
- Queue survives application restarts (offline-capable)

### Step 3: Check Your Status

View your current telemetry configuration:

```bash
ax telemetry status
```

**Output** (when enabled with remote):
```
📊 Telemetry Status

┌────────────────────────┬────────────────────────────────┐
│ Setting                │ Value                          │
├────────────────────────┼────────────────────────────────┤
│ Enabled                │ Yes                            │
│ Remote Submission      │ Yes                            │
│ Session ID             │ 550e8400-e29b...               │
│ Consent Date           │ 2025-11-07                     │
│ Opt-out Date           │ N/A                            │
└────────────────────────┴────────────────────────────────┘

📤 Remote Submission Queue:

┌────────────────────────┬─────────────────┐
│ Metric                 │ Count           │
├────────────────────────┼─────────────────┤
│ Pending Events         │ 15              │
│ Retrying Events        │ 3               │
│ Total in Queue         │ 18              │
└────────────────────────┴─────────────────┘

  Manual submission: ax telemetry submit

💾 Local Storage:

┌────────────────────────┬─────────────────┐
│ Metric                 │ Value           │
├────────────────────────┼─────────────────┤
│ Total Events           │ 1,234           │
└────────────────────────┴─────────────────┘
```

---

## CLI Commands

### `ax telemetry status`

**Purpose**: Show current telemetry configuration and state

**Usage**:
```bash
ax telemetry status
```

**Displays**:
- Configuration (enabled, remote, session ID, consent/opt-out dates)
- Remote submission queue stats (if remote enabled)
- Local storage stats (total events)

---

### `ax telemetry enable [--remote]`

**Purpose**: Enable telemetry collection

**Usage**:
```bash
ax telemetry enable              # Local only
ax telemetry enable --remote     # Local + remote submission
```

**Flags**:
- `-r, --remote` - Enable remote submission in addition to local storage

**Notes**:
- Records consent timestamp
- Generates anonymous session ID
- Remote submission is **opt-in** (disabled by default)

---

### `ax telemetry disable`

**Purpose**: Disable telemetry collection

**Usage**:
```bash
ax telemetry disable
```

**What happens**:
- Stops collecting new telemetry events
- Stops remote submission (if enabled)
- Records opt-out timestamp
- **Preserves existing data** (use `clear` to delete)

**Output**:
```
✓ Telemetry disabled successfully

No telemetry data will be collected.
Existing data has been preserved.

To clear existing data:
  ax telemetry clear
```

---

### `ax telemetry stats [options]`

**Purpose**: View aggregated telemetry statistics and analytics

**Usage**:
```bash
ax telemetry stats                              # Show all stats
ax telemetry stats --start 2025-11-01           # Filter by start date
ax telemetry stats --end 2025-11-07             # Filter by end date
ax telemetry stats --type command               # Show specific type
```

**Flags**:
- `-s, --start <date>` - Start date filter (YYYY-MM-DD)
- `-e, --end <date>` - End date filter (YYYY-MM-DD)
- `-t, --type <type>` - Stat type filter (`command`, `query`, `error`, `performance`)

**Output Example**:
```
📊 Telemetry Statistics

📝 Command Usage:
┌────────────────────┬────────┬────────────────┬────────┬────────┐
│ Command            │ Count  │ Avg Duration   │ Min    │ Max    │
├────────────────────┼────────┼────────────────┼────────┼────────┤
│ ax find            │ 523    │ 145.23ms       │ 12ms   │ 890ms  │
│ ax def             │ 234    │ 89.12ms        │ 8ms    │ 450ms  │
│ ax flow            │ 89     │ 234.56ms       │ 45ms   │ 1.2s   │
│ ax lint            │ 45     │ 567.89ms       │ 123ms  │ 2.3s   │
└────────────────────┴────────┴────────────────┴────────┴────────┘

🔍 Query Performance:
┌────────────────────┬────────┬────────────────┬────────┬────────┐
│ Query Type         │ Count  │ Avg Duration   │ Min    │ Max    │
├────────────────────┼────────┼────────────────┼────────┼────────┤
│ symbol             │ 523    │ 12.34ms        │ 2ms    │ 45ms   │
│ text               │ 234    │ 45.67ms        │ 15ms   │ 180ms  │
│ hybrid             │ 89     │ 78.90ms        │ 30ms   │ 250ms  │
└────────────────────┴────────┴────────────────┴────────┴────────┘

❌ Error Summary:
┌────────────────────────────────────────┬────────┐
│ Error Type                             │ Count  │
├────────────────────────────────────────┼────────┤
│ ParseError: Unexpected token           │ 12     │
│ NetworkError: Connection timeout       │ 3      │
│ Error: Unknown error                   │ 1      │
└────────────────────────────────────────┴────────┘

⚡ Performance Metrics:
┌────────────────────────────────────────┬────────┐
│ Metric                                 │ Count  │
├────────────────────────────────────────┼────────┤
│ cache_hit                              │ 520    │
│ cache_miss                             │ 720    │
│ index_size_bytes                       │ 1      │
└────────────────────────────────────────┴────────┘

📈 Summary:
  Total Events: 1,891
  Date Range: 2025-11-01 to Now
```

**Use Cases**:
- **Identify slow commands**: See which commands take the longest
- **Track query performance**: Monitor cache hit rates and query times
- **Review errors**: See what errors are most common
- **Understand usage**: Know which features you use most

---

### `ax telemetry submit`

**Purpose**: Manually trigger remote submission of queued events

**Usage**:
```bash
ax telemetry submit
```

**When to use**:
- Force immediate submission instead of waiting for background timer
- Test remote submission is working
- Submit before going offline

**Output** (success):
```
📤 Submitting queued events...

Queue before: 15 pending, 3 retrying

✓ Submitted 15 events successfully
Queue after: 0 pending, 3 retrying
```

**Output** (rate limited):
```
📤 Submitting queued events...

⚠ Submission skipped (rate limited or no events)

Automatic submission will occur in background.
```

**Output** (remote not enabled):
```
📤 Submitting queued events...

⚠ Remote submission is not enabled

To enable remote submission:
  ax telemetry enable --remote
```

**Notes**:
- Requires remote submission to be enabled (`--remote` flag)
- Subject to rate limiting (60 events/min, burst 10)
- Automatic submission happens every 30 seconds in background

---

### `ax telemetry clear [options]`

**Purpose**: Clear telemetry data from local database

**Usage**:
```bash
ax telemetry clear                   # Clear all data (interactive)
ax telemetry clear --before 2025-10-01  # Clear data before date
```

**Flags**:
- `--before <date>` - Clear data before specified date (YYYY-MM-DD)

**Output** (all data):
```
✓ All telemetry data cleared successfully
  Cleared 18 queued submissions

Telemetry collection remains enabled.
New events will continue to be collected.
```

**Output** (before date):
```
✓ Cleared telemetry data before 2025-10-01

Telemetry collection remains enabled.
New events will continue to be collected.
```

**Notes**:
- Does **not** disable telemetry (use `disable` for that)
- Clears both local events and submission queue
- Useful for privacy or storage management

---

### `ax telemetry export [options]`

**Purpose**: Export telemetry data for debugging or analysis

**Usage**:
```bash
ax telemetry export                           # Print to stdout
ax telemetry export --output telemetry.json   # Save to file
ax telemetry export --start 2025-11-01        # Filter by date
```

**Flags**:
- `-o, --output <file>` - Output file path (default: stdout)
- `-s, --start <date>` - Start date filter (YYYY-MM-DD)
- `-e, --end <date>` - End date filter (YYYY-MM-DD)

**Output** (to file):
```
✓ Exported 1,234 events to telemetry.json
```

**Output Format** (JSON):
```json
[
  {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "command_executed",
    "eventData": {
      "command": "find",
      "args": ["calculateTotal"],
      "duration": 145,
      "exitCode": 0
    },
    "timestamp": 1699390800000
  }
]
```

**Use Cases**:
- Debug telemetry collection issues
- Analyze your own usage patterns
- Share anonymized data for support requests
- Audit what data is being collected

---

## Understanding Your Data

### Event Types

**1. Command Execution** (`command_executed`)
- Tracks which commands you run
- Measures execution time and exit codes
- Helps prioritize feature development

**2. Query Performance** (`query_performed`)
- Tracks symbol, text, and hybrid queries
- Measures query performance and cache hits
- Helps optimize search algorithms

**3. Parser Invocation** (`parser_invoked`)
- Tracks which languages are parsed
- Measures parser performance
- Helps improve parsing speed

**4. Error Occurrence** (`error_occurred`)
- Tracks error types and frequencies
- No PII in messages or stack traces
- Helps prioritize bug fixes

**5. Performance Metrics** (`performance_metric`)
- Tracks cache hit/miss rates
- Measures index sizes and memory usage
- Helps identify performance regressions

**6. Feature Usage** (`feature_used`)
- Tracks which features are enabled/disabled
- Helps understand feature adoption
- Informs feature deprecation decisions

### Data Storage

**Local Storage**:
- **Location**: `~/.automatosx/telemetry.db` (SQLite database)
- **Format**: Structured SQLite tables with indices
- **Size**: ~200-500 bytes per event (1,000 events ≈ 500KB)
- **Retention**: No automatic cleanup (you control retention)

**Remote Submission**:
- **Protocol**: HTTPS with API key authentication
- **Rate Limit**: 60 events/minute (burst: 10)
- **Retry Logic**: Exponential backoff (1s → 2s → 4s → 8s → 16s)
- **Queue**: SQLite-backed, survives restarts
- **Max Retries**: 5 attempts, then event dropped

### Privacy Safeguards

**Automatic Truncation**:
- Query strings: 100 characters max
- Error messages: 200 characters max
- Stack traces: 500 characters max

**No PII Collection**:
- File paths stripped before storage
- Code content never captured
- User identifiers anonymized
- Session IDs are random UUIDs

**User Control**:
- Opt-in required (disabled by default)
- View all data anytime (`stats`, `export`)
- Clear data anytime (`clear`)
- Disable anytime (`disable`)

---

## FAQ

### How do I know what data is being collected?

Use `ax telemetry export` to see the exact JSON events stored in your database. Every event is transparent and auditable.

### Can I use telemetry without remote submission?

Yes! Local-only mode (`ax telemetry enable`) stores all data on your machine. No data is ever sent to remote servers unless you explicitly enable remote submission with `--remote`.

### What happens if I go offline?

Events continue to be collected locally. If remote submission is enabled, events are queued and will be submitted automatically when you're back online.

### How much disk space does telemetry use?

Approximately 200-500 bytes per event:
- 1,000 events ≈ 500 KB
- 10,000 events ≈ 5 MB
- 100,000 events ≈ 50 MB

Use `ax telemetry clear` to manage storage.

### Can I see telemetry data for a specific time period?

Yes! Use date filters:
```bash
ax telemetry stats --start 2025-11-01 --end 2025-11-07
ax telemetry export --start 2025-11-01 --output last-week.json
```

### Does telemetry slow down AutomatosX?

No. Telemetry overhead is <1ms per event and runs asynchronously. You won't notice any performance impact.

### Can I disable telemetry temporarily?

Yes. Use `ax telemetry disable` to stop collection. Your existing data is preserved. Re-enable with `ax telemetry enable` when ready.

### What if I want to delete all my data?

Use `ax telemetry clear` to delete all local events and queued submissions. This cannot be undone.

### Where can I see the telemetry privacy policy?

See the [Privacy Policy](#privacy-policy) section below, or read the full policy in `automatosx/PRD/telemetry-privacy-policy.md`.

### Who has access to telemetry data?

**Local data**: Only you (stored on your machine).
**Remote data**: AutomatosX maintainers (if you enable remote submission). Data is aggregated and anonymized before analysis.

### How long is telemetry data retained?

**Local**: Retained indefinitely (you control retention with `clear`).
**Remote**: Retained for 90 days, then aggregated and anonymized for long-term analysis.

---

## Privacy Policy

### Data Collection

**What We Collect**:
- Anonymous usage metrics (command execution, query performance)
- Parser invocation statistics (language, duration, symbol counts)
- Error types and counts (truncated messages, no PII)
- Performance metrics (cache rates, index sizes)

**What We DON'T Collect**:
- File paths, directory names, or code content
- User identifiers, machine names, or IP addresses
- Environment variables or system configuration
- Any personally identifiable information (PII)

### Data Usage

**Purpose**:
- Improve AutomatosX performance and reliability
- Prioritize feature development based on usage
- Identify and fix bugs affecting users
- Track adoption of new features

**How Data Is Used**:
- Aggregated statistics for development decisions
- Performance monitoring and regression detection
- Error tracking and bug prioritization
- Anonymous usage analytics

### Data Storage

**Local Storage**:
- Stored in `~/.automatosx/telemetry.db` on your machine
- You have full control (view, export, clear, disable)
- No automatic transmission to remote servers

**Remote Submission** (opt-in only):
- HTTPS-only transmission with API key authentication
- Rate-limited to prevent abuse (60 events/min)
- Automatic retry with exponential backoff
- Data stored on secure servers with encryption at rest

### User Rights

**Right to View**: Use `ax telemetry stats` or `ax telemetry export` to view all collected data.

**Right to Delete**: Use `ax telemetry clear` to delete all local data anytime.

**Right to Disable**: Use `ax telemetry disable` to stop collection anytime.

**Right to Opt-Out of Remote**: Disable remote submission while keeping local telemetry.

### Data Sharing

**We do NOT**:
- Sell or share your data with third parties
- Use data for advertising or marketing
- Track individual users across sessions
- Collect PII or identifying information

**We DO**:
- Aggregate anonymous data for public statistics
- Share anonymized performance metrics in release notes
- Publish usage trends (e.g., "80% of users use ax find daily")

### Changes to Privacy Policy

We will notify users of privacy policy changes through:
- GitHub repository announcements
- Release notes in new versions
- In-app notifications (if significant changes)

**Current Version**: 1.0 (2025-11-07)

### Contact

**Questions or Concerns**:
- Open an issue: https://github.com/automatosx/automatosx/issues
- Email: privacy@automatosx.com

---

**Last Updated**: 2025-11-07
**Version**: 1.0
**License**: Same as AutomatosX (see LICENSE file)
