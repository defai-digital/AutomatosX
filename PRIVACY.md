# AutomatosX - Privacy Policy & Telemetry

**Last Updated:** 2025-11-07
**Version:** 2.0.0

## Overview

AutomatosX respects your privacy. This document explains what data is collected when telemetry is enabled, how it's used, and your choices.

## Privacy-First Design

AutomatosX telemetry is designed with **privacy as the default**:

- **Opt-in Required**: Telemetry is **disabled by default**. You must explicitly enable it.
- **Local-Only Storage**: All telemetry data is stored **locally on your machine** in SQLite.
- **No PII Collection**: We **never collect** file paths, code content, or user identifiers.
- **Anonymous Session IDs**: Session tracking uses random UUIDs with no connection to your identity.
- **Full Transparency**: All telemetry code is **open source** - you can inspect exactly what's collected.
- **User Control**: You can enable, disable, view, or delete telemetry data at any time.

## What Data is Collected

When telemetry is **enabled**, AutomatosX collects:

### 1. Command Execution Metrics

**Purpose**: Understand which features are used most and optimize performance.

**Data Collected**:
- Command name (e.g., `find`, `def`, `flow`, `lint`)
- Execution duration (milliseconds)
- Exit code (success/failure)
- Timestamp
- Anonymous session ID

**NOT Collected**:
- Command arguments
- File paths
- Search queries (truncated to 100 chars max for queries)
- Directory names

### 2. Query Performance

**Purpose**: Optimize search and query algorithms.

**Data Collected**:
- Query type (`symbol`, `text`, `hybrid`)
- Query string (truncated to max 100 characters)
- Result count
- Duration (milliseconds)
- Cache hit/miss status
- Language filter (if applied)

**NOT Collected**:
- Actual search results
- File names or paths in results
- Full query strings (truncated for privacy)

### 3. Parser Invocation Statistics

**Purpose**: Improve parser performance and reliability.

**Data Collected**:
- Language (e.g., `typescript`, `python`, `go`)
- File extension (e.g., `.ts`, `.py`, `.go`)
- Parse duration (milliseconds)
- Symbol count extracted
- Line count processed
- Error type (if parsing failed)

**NOT Collected**:
- File paths
- File names
- Code content
- Symbol names or signatures

### 4. Error Occurrences

**Purpose**: Identify and fix bugs proactively.

**Data Collected**:
- Error type (e.g., `TypeError`, `SyntaxError`)
- Error message (truncated to 200 chars)
- Stack trace (truncated to 500 chars, with paths sanitized)
- Error context (generic metadata only)
- Fatal vs non-fatal classification

**NOT Collected**:
- User-specific information in error messages
- Full stack traces (truncated and sanitized)
- File paths (removed before storage)

### 5. Performance Metrics

**Purpose**: Monitor and optimize performance.

**Data Collected**:
- Metric name (e.g., `query_cache_hit_rate`, `indexing_throughput`)
- Metric value (number)
- Unit (`ms`, `bytes`, `count`, `percentage`)
- Context (generic labels only)

**NOT Collected**:
- System information (CPU, RAM, OS version)
- Network activity
- User environment variables

### 6. Feature Usage

**Purpose**: Understand feature adoption for roadmap planning.

**Data Collected**:
- Feature name
- Enabled/disabled status
- A/B test variant (if applicable)

**NOT Collected**:
- User preferences
- Configuration values
- Feature-specific data

## What is NOT Collected

AutomatosX **never collects**:

- ❌ **File paths or directory structures**
- ❌ **File names**
- ❌ **Code content or snippets**
- ❌ **Symbol names, function names, or identifiers**
- ❌ **Search queries** (except truncated to 100 chars for performance analysis)
- ❌ **User identifiable information** (name, email, IP address, etc.)
- ❌ **Machine identifiers** (hostname, MAC address, etc.)
- ❌ **Environment variables**
- ❌ **Network activity or API calls**
- ❌ **Git repository information**
- ❌ **Clipboard data**
- ❌ **Screenshots or images**

## Data Storage

### Local Storage

All telemetry data is stored **locally** on your machine:

- **Database**: SQLite (`.automatosx/telemetry.db`)
- **Location**: Same directory as your AutomatosX index
- **Encryption**: Optional (if your filesystem uses encryption)
- **Access**: Only you can read this data

### Remote Submission (Opt-In)

If you enable **remote submission** (`--remote` flag):

- **Endpoint**: TBD (not yet implemented in P3.1)
- **Frequency**: Daily batches
- **Encryption**: HTTPS/TLS only
- **Anonymization**: Additional anonymization before submission
- **Retention**: 90 days maximum

**Note**: Remote submission is **disabled by default** and requires explicit opt-in.

## How Data is Used

Telemetry data helps improve AutomatosX:

1. **Performance Optimization**: Identify slow operations and optimize algorithms
2. **Error Detection**: Proactively identify and fix bugs
3. **Feature Prioritization**: Understand which features are used most
4. **Quality Assurance**: Monitor reliability and stability
5. **User Experience**: Improve CLI design and workflows

## Your Controls

### Enable Telemetry

```bash
# Enable telemetry (local-only)
ax telemetry enable

# Enable with remote submission
ax telemetry enable --remote
```

### Disable Telemetry

```bash
# Disable telemetry collection
ax telemetry disable
```

### View Telemetry Status

```bash
# Check if telemetry is enabled
ax telemetry status
```

### View Collected Data

```bash
# View aggregated statistics
ax telemetry stats

# View detailed stats by type
ax telemetry stats --type command
ax telemetry stats --type query
ax telemetry stats --type error

# View stats for date range
ax telemetry stats --start 2025-01-01 --end 2025-01-31
```

### Delete Telemetry Data

```bash
# Clear all telemetry data
ax telemetry clear

# Clear data before a specific date
ax telemetry clear --before 2025-01-01
```

### Export Telemetry Data

```bash
# Export to JSON for inspection
ax telemetry export

# Export to file
ax telemetry export --output telemetry-export.json

# Export date range
ax telemetry export --start 2025-01-01 --end 2025-01-31
```

## Data Retention

- **Local Storage**: Indefinite (until you clear it)
- **Remote Storage**: 90 days maximum (if remote submission enabled)
- **Aggregated Stats**: Retained for analytics, but de-identified

## Third-Party Services

AutomatosX **does not** use third-party analytics services:

- ❌ No Google Analytics
- ❌ No Mixpanel
- ❌ No Sentry
- ❌ No Segment
- ❌ No other tracking services

All telemetry is **self-hosted** and under your control.

## Data Sharing

- **We do NOT sell** your telemetry data
- **We do NOT share** your data with third parties
- **We do NOT use** your data for advertising
- **We do NOT combine** telemetry with other data sources

## GDPR & Privacy Regulations

AutomatosX telemetry is designed to comply with GDPR and other privacy regulations:

- **Consent**: Required before any data collection (opt-in)
- **Right to Access**: View all collected data (`ax telemetry stats`, `ax telemetry export`)
- **Right to Deletion**: Delete all data (`ax telemetry clear`)
- **Right to Portability**: Export data in JSON format
- **Right to Object**: Disable telemetry anytime
- **Data Minimization**: Only collect essential metrics
- **Anonymization**: No PII collection

## Security

Telemetry data is protected:

- **Local Storage**: Filesystem permissions (your OS controls access)
- **In-Transit**: HTTPS/TLS for remote submission (if enabled)
- **Anonymization**: No identifiable information in any telemetry event
- **Open Source**: All telemetry code is auditable

## Updates to This Policy

This policy may be updated to reflect new features or regulations. Changes will be noted in:

- Version number (top of document)
- Last updated date
- CHANGELOG.md

Significant changes will require re-consent (telemetry will auto-disable).

## Contact

Questions about telemetry or privacy?

- **GitHub Issues**: https://github.com/YOUR_ORG/automatosx-v2/issues
- **Email**: privacy@YOUR_DOMAIN.com
- **Documentation**: See README.md for more details

## Transparency Commitment

We are committed to:

- **Full transparency** about what data is collected
- **Open source** telemetry code for audit
- **User control** over all telemetry settings
- **Privacy-first** design in all features
- **Clear communication** about any changes

## Summary

- ✅ **Opt-in required** - Telemetry is disabled by default
- ✅ **Privacy-first** - No PII, file paths, or code content collected
- ✅ **Local storage** - All data on your machine by default
- ✅ **User control** - Enable, disable, view, or delete anytime
- ✅ **Open source** - All telemetry code is auditable
- ✅ **GDPR compliant** - Designed to meet privacy regulations

---

**Thank you for helping improve AutomatosX!** Your privacy is our priority.
