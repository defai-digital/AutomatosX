# Config Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for configuration management. The config system MUST satisfy all invariants.

## Validation Invariants

### INV-CFG-001: Schema Validation

**Statement:** All configuration MUST pass schema validation before persistence.

**Rationale:** Invalid configuration causes runtime errors and unpredictable behavior.

**Enforcement:**
- `AutomatosXConfigSchema.parse()` called before write
- Invalid config rejected with descriptive errors
- Partial writes not allowed

### INV-CFG-002: Atomic Writes

**Statement:** Configuration writes MUST be atomic.

**Rationale:** Partial writes corrupt configuration and break the system.

**Enforcement:**
- Write to temp file, then atomic rename
- Failure leaves previous config intact
- No partial state observable

### INV-CFG-003: Version Migration

**Statement:** Configuration migration MUST be idempotent.

**Rationale:** Multiple migration runs should produce same result.

**Enforcement:**
- Migration checks current version before applying
- Same migration can be applied multiple times safely
- Version strictly increasing

## Resolution Invariants

### INV-CFG-RES-001: Project Overrides User

**Statement:** Project configuration MUST override user configuration.

**Rationale:** Project-specific settings take precedence for that project.

**Enforcement:**
- Resolution order: defaults < user < project
- Deep merge with project values winning
- Explicit null does not override

### INV-CFG-RES-002: User Overrides Defaults

**Statement:** User configuration MUST override defaults.

**Rationale:** User customization takes precedence over system defaults.

**Enforcement:**
- Defaults loaded first
- User values merged over defaults
- Missing user values fall back to defaults

### INV-CFG-RES-003: Undefined Preservation

**Statement:** Undefined values MUST NOT override defined values.

**Rationale:** Accidental undefined should not clear intentional configuration.

**Enforcement:**
- Only explicitly set values merged
- `undefined` and missing keys skipped
- `null` treated as explicit value

## Governance Invariants

### INV-CFG-GOV-001: Audit Trail

**Statement:** All configuration changes MUST emit events.

**Rationale:** Audit trail required for debugging and compliance.

**Enforcement:**
- Events: ConfigSetEvent, ConfigResetEvent, ConfigMigratedEvent
- Events include: path, oldValue, newValue, timestamp
- Events persisted for audit queries

### INV-CFG-GOV-002: Sensitive Protection

**Statement:** Security-sensitive settings MUST require confirmation.

**Rationale:** Accidental security changes can compromise the system.

**Enforcement:**
- Sensitive paths defined in schema
- Changes to sensitive paths require explicit confirm
- Warning logged for all sensitive changes

## Adapter Invariants

### INV-CFG-ADP-001: Atomic File Operations

**Statement:** File operations MUST use atomic write pattern.

**Rationale:** System crash during write should not corrupt config.

**Enforcement:**
- Write to `.tmp` suffix file
- Rename to target after complete write
- Original preserved until rename succeeds

### INV-CFG-ADP-002: Detection Timeout

**Statement:** Provider detection MUST timeout after 5 seconds.

**Rationale:** Slow detection blocks startup and degrades UX.

**Enforcement:**
- Detection wrapped with timeout
- Timeout returns "unavailable" status
- No blocking on slow providers

### INV-CFG-ADP-003: No Network in Detection

**Statement:** Provider detection MUST NOT make network calls.

**Rationale:** Network calls during detection cause slow startup and failures.

**Enforcement:**
- Detection checks local CLI availability only
- `which` or `where` commands only
- No API health checks in detection phase

## Testing Requirements

1. `INV-CFG-001`: Test invalid config rejected
2. `INV-CFG-002`: Test partial write prevented
3. `INV-CFG-003`: Test migration idempotent
4. `INV-CFG-RES-001`: Test project overrides user
5. `INV-CFG-RES-002`: Test user overrides defaults
6. `INV-CFG-RES-003`: Test undefined doesn't override
7. `INV-CFG-GOV-001`: Test events emitted
8. `INV-CFG-GOV-002`: Test sensitive fields protected
9. `INV-CFG-ADP-001`: Test atomic writes
10. `INV-CFG-ADP-002`: Test detection timeout
11. `INV-CFG-ADP-003`: Test no network in detection

## Version History

- V1 (2024-12-16): Initial contract definition
