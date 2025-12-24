# File System Domain Invariants

## Overview

The File System domain provides secure file and directory operations
for scaffold tools. All operations are validated against security
invariants to prevent path traversal and unauthorized file access.

## Security Invariants

### INV-FS-001: Path Traversal Prevention
Paths MUST NOT contain `..` sequences or escape the workspace root.
- **Enforcement**: schema + runtime
- **Test**: Paths with `..` are rejected by schema validation
- **Test**: Resolved paths outside workspace are rejected at runtime
- **Rationale**: Prevent writing to arbitrary filesystem locations

### INV-FS-002: No Silent Overwrites
Existing files MUST NOT be overwritten without explicit `overwrite=true` flag.
- **Enforcement**: runtime
- **Test**: Write to existing file without overwrite flag returns FILE_EXISTS error
- **Test**: Write to existing file with overwrite=true succeeds
- **Rationale**: Prevent accidental data loss

### INV-FS-003: Atomic Writes
File writes MUST be atomic (write to temp file, then rename).
- **Enforcement**: implementation
- **Test**: Interrupted writes don't leave partial files
- **Test**: Temp files are cleaned up on success
- **Rationale**: Prevent corrupted files from interrupted operations

### INV-FS-004: UTF-8 Default Encoding
Default encoding MUST be UTF-8.
- **Enforcement**: schema (default value)
- **Test**: Omitting encoding parameter uses UTF-8
- **Rationale**: Consistent cross-platform text handling

### INV-FS-005: No Symlink Following
Symlinks MUST NOT be followed when writing files.
- **Enforcement**: runtime
- **Test**: Writing to symlink path returns SYMLINK_NOT_ALLOWED
- **Rationale**: Prevent symlink attacks escaping workspace

### INV-FS-006: Workspace Boundary
All file operations MUST be within the workspace root directory.
- **Enforcement**: runtime (path resolution)
- **Test**: Absolute paths outside workspace are rejected
- **Test**: Relative paths that resolve outside workspace are rejected
- **Rationale**: Contain all operations to project directory

## Operational Invariants

### INV-FS-101: Directory Creation Before Write
When `createDirectories=true`, parent directories MUST be created before file write.
- **Enforcement**: runtime
- **Test**: Writing to `a/b/c/file.ts` creates `a/b/c/` if needed
- **Rationale**: Convenient scaffolding without manual directory creation

### INV-FS-102: Idempotent Directory Creation
Creating an already-existing directory MUST succeed (not error).
- **Enforcement**: runtime
- **Test**: `mkdir` on existing directory returns `existed=true, created=false`
- **Rationale**: Idempotent operations simplify retry logic

### INV-FS-103: Batch Operation Order
Batch operations MUST be executed in array order.
- **Enforcement**: runtime
- **Test**: mkdir followed by write to that directory succeeds
- **Rationale**: Predictable operation ordering

### INV-FS-104: Batch Stop on Error
When `stopOnError=true`, batch MUST stop at first failure.
- **Enforcement**: runtime
- **Test**: After first failure, subsequent operations not attempted
- **Rationale**: Prevent cascading errors from partial state

### INV-FS-105: Batch Limit
Batch operations MUST NOT exceed 100 operations.
- **Enforcement**: schema
- **Test**: Batch with 101 operations rejected
- **Rationale**: Prevent DoS via excessive operations

## Audit Invariants

### INV-FS-201: Operation Logging
All file operations SHOULD be logged with path and result.
- **Enforcement**: implementation
- **Test**: File writes produce trace events
- **Rationale**: Audit trail for troubleshooting

### INV-FS-202: Dry Run Support
Dry run mode MUST validate without modifying filesystem.
- **Enforcement**: runtime
- **Test**: dry_run=true checks paths but writes nothing
- **Rationale**: Preview operations before execution

## Error Handling Invariants

### INV-FS-301: Structured Errors
All errors MUST return structured error object with code and message.
- **Enforcement**: schema
- **Test**: Failed operations include `error: { code, message }`
- **Rationale**: Machine-readable error handling

### INV-FS-302: Error Codes Consistency
Error codes MUST match FileSystemErrorCode enum values.
- **Enforcement**: implementation
- **Test**: All error codes are valid enum values
- **Rationale**: Consistent error categorization

### INV-FS-303: No Exception Leakage
File system exceptions MUST be caught and converted to error results.
- **Enforcement**: implementation
- **Test**: ENOENT, EACCES, etc. become structured errors
- **Rationale**: Graceful error handling

## Cross-Domain Invariants

### INV-FS-401: Scaffold Integration
Scaffold tools MUST use file_write for all file creation.
- **Enforcement**: design
- **Test**: scaffold_contract uses file_write, not direct fs
- **Rationale**: Centralized security validation

### INV-FS-402: Guard Policy Awareness
File operations in guarded sessions SHOULD respect guard policies.
- **Enforcement**: optional runtime check
- **Test**: Write to forbidden_path in guarded session warns/fails
- **Rationale**: Governance integration
