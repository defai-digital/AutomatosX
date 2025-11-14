# Golden Traces P1 Specification

**Sprint**: Sprint 2 Day 16
**Priority**: P1 (Secondary Test Coverage)
**Purpose**: Edge case and platform-specific test scenarios
**Total Traces**: 20

---

## Overview

This document specifies 20 P1 golden traces for AutomatosX v2. These traces complement the 10 P0 traces by covering:
- Provider fallback scenarios
- Platform-specific behavior (Windows, Linux, macOS)
- Edge cases and error conditions
- Less common CLI command combinations
- Performance edge cases

---

## P1 Trace Catalog

### Category 1: Provider Fallback & Resilience (5 traces)

#### GLD-P1-001: Primary Provider Unavailable

**Scenario**: Claude provider fails, automatic fallback to Gemini

```json
{
  "id": "GLD-P1-001",
  "name": "provider-fallback-claude-to-gemini",
  "priority": "P1",
  "category": "provider",
  "deterministicSeed": 20001,
  "input": {
    "command": "ax run backend \"Analyze API performance\"",
    "args": {
      "agent": "backend",
      "task": "Analyze API performance",
      "provider": "claude"
    },
    "environmentMock": {
      "providers": {
        "claude": { "available": false, "error": "503 Service Unavailable" },
        "gemini": { "available": true },
        "openai": { "available": true }
      }
    }
  },
  "expectedBehavior": {
    "primaryProviderAttempt": "claude",
    "actualProvider": "gemini",
    "fallbackTriggered": true,
    "providerCalls": [
      { "provider": "claude", "status": "failed", "error": "503" },
      { "provider": "gemini", "status": "success" }
    ],
    "warnings": [
      "Primary provider 'claude' unavailable, falling back to 'gemini'"
    ]
  }
}
```

---

#### GLD-P1-002: All Providers Fail

**Scenario**: Complete provider failure, graceful error handling

```json
{
  "id": "GLD-P1-002",
  "name": "all-providers-unavailable",
  "priority": "P1",
  "category": "provider",
  "deterministicSeed": 20002,
  "input": {
    "command": "ax run backend \"Test task\"",
    "args": {
      "agent": "backend",
      "task": "Test task"
    },
    "environmentMock": {
      "providers": {
        "claude": { "available": false, "error": "503" },
        "gemini": { "available": false, "error": "429 Rate limit" },
        "openai": { "available": false, "error": "500 Internal error" }
      }
    }
  },
  "expectedBehavior": {
    "exitCode": 1,
    "errorCode": "PROVIDER_UNAVAILABLE",
    "errorMessage": "All providers unavailable",
    "providerCalls": [
      { "provider": "claude", "status": "failed" },
      { "provider": "gemini", "status": "failed" },
      { "provider": "openai", "status": "failed" }
    ],
    "suggestions": [
      "Check your network connection",
      "Verify API keys are valid",
      "Try again in a few minutes"
    ]
  }
}
```

---

#### GLD-P1-003: Provider Retry with Exponential Backoff

**Scenario**: Transient provider failure, successful retry

```json
{
  "id": "GLD-P1-003",
  "name": "provider-retry-backoff",
  "priority": "P1",
  "category": "provider",
  "deterministicSeed": 20003,
  "input": {
    "command": "ax run backend \"Test task\" --max-retries 3",
    "args": {
      "agent": "backend",
      "task": "Test task",
      "maxRetries": 3
    },
    "environmentMock": {
      "providers": {
        "claude": {
          "attempts": [
            { "status": "fail", "error": "timeout" },
            { "status": "fail", "error": "timeout" },
            { "status": "success" }
          ]
        }
      }
    }
  },
  "expectedBehavior": {
    "providerCalls": [
      { "provider": "claude", "attempt": 1, "status": "failed", "backoff": 1000 },
      { "provider": "claude", "attempt": 2, "status": "failed", "backoff": 2000 },
      { "provider": "claude", "attempt": 3, "status": "success", "backoff": 0 }
    ],
    "totalRetries": 2,
    "finalStatus": "success"
  }
}
```

---

#### GLD-P1-004: Provider Chaos Mode

**Scenario**: Chaos testing with random provider failures

```json
{
  "id": "GLD-P1-004",
  "name": "chaos-mode-provider",
  "priority": "P1",
  "category": "provider",
  "deterministicSeed": 20004,
  "input": {
    "command": "ax run backend \"Test task\" --chaos",
    "args": {
      "agent": "backend",
      "task": "Test task",
      "chaos": true
    },
    "environmentMock": {
      "chaos": {
        "enabled": true,
        "failureRate": 0.3,
        "seed": 20004
      }
    }
  },
  "expectedBehavior": {
    "chaosEventsTriggered": true,
    "providerCalls": [
      { "provider": "claude", "status": "failed", "reason": "chaos-injected" },
      { "provider": "gemini", "status": "success" }
    ],
    "telemetry": {
      "chaosMode": true,
      "chaosEvents": 1
    }
  }
}
```

---

#### GLD-P1-005: Provider Health Monitoring

**Scenario**: Provider SLA tracking and health metrics

```json
{
  "id": "GLD-P1-005",
  "name": "provider-health-tracking",
  "priority": "P1",
  "category": "provider",
  "deterministicSeed": 20005,
  "input": {
    "command": "ax status --providers",
    "args": {
      "providers": true
    }
  },
  "expectedBehavior": {
    "providersHealth": {
      "claude": {
        "available": true,
        "latency": 150,
        "successRate": 0.98,
        "lastSuccessAt": "2025-01-15T10:30:00Z"
      },
      "gemini": {
        "available": true,
        "latency": 120,
        "successRate": 0.99,
        "lastSuccessAt": "2025-01-15T10:29:45Z"
      },
      "openai": {
        "available": false,
        "latency": 0,
        "successRate": 0.75,
        "lastFailureAt": "2025-01-15T10:28:00Z",
        "error": "429 Rate Limit"
      }
    }
  }
}
```

---

### Category 2: Platform-Specific Behavior (5 traces)

#### GLD-P1-006: Windows Path Handling

**Scenario**: Windows-style paths with backslashes

```json
{
  "id": "GLD-P1-006",
  "name": "windows-path-handling",
  "priority": "P1",
  "category": "platform",
  "deterministicSeed": 20006,
  "platform": "win32",
  "input": {
    "command": "ax memory search \"test\" --output C:\\Users\\test\\output.json",
    "args": {
      "query": "test",
      "output": "C:\\Users\\test\\output.json"
    }
  },
  "expectedBehavior": {
    "pathNormalized": "C:\\Users\\test\\output.json",
    "fileCreated": true,
    "platform": "win32"
  }
}
```

---

#### GLD-P1-007: macOS Keychain Integration

**Scenario**: Secure credential storage on macOS

```json
{
  "id": "GLD-P1-007",
  "name": "macos-keychain",
  "priority": "P1",
  "category": "platform",
  "deterministicSeed": 20007,
  "platform": "darwin",
  "input": {
    "command": "ax config set providers.claude.apiKey --keychain",
    "args": {
      "key": "providers.claude.apiKey",
      "value": "sk-test-key",
      "keychain": true
    }
  },
  "expectedBehavior": {
    "keychainAccess": true,
    "secureStorage": true,
    "platform": "darwin"
  }
}
```

---

#### GLD-P1-008: Linux Permission Handling

**Scenario**: File permission checks on Linux

```json
{
  "id": "GLD-P1-008",
  "name": "linux-permissions",
  "priority": "P1",
  "category": "platform",
  "deterministicSeed": 20008,
  "platform": "linux",
  "input": {
    "command": "ax memory export /etc/restricted/memories.db",
    "args": {
      "output": "/etc/restricted/memories.db"
    },
    "environmentMock": {
      "permissions": {
        "/etc/restricted": { "writable": false }
      }
    }
  },
  "expectedBehavior": {
    "exitCode": 1,
    "errorCode": "FILESYSTEM_ERROR",
    "errorMessage": "Permission denied",
    "suggestions": [
      "Check file permissions",
      "Try with sudo",
      "Use a different output directory"
    ]
  }
}
```

---

#### GLD-P1-009: Cross-Platform Line Endings

**Scenario**: CRLF vs LF handling

```json
{
  "id": "GLD-P1-009",
  "name": "cross-platform-line-endings",
  "priority": "P1",
  "category": "platform",
  "deterministicSeed": 20009,
  "input": {
    "command": "ax run backend --task-file task.txt",
    "args": {
      "agent": "backend",
      "taskFile": "task.txt"
    },
    "environmentMock": {
      "files": {
        "task.txt": {
          "content": "Line 1\r\nLine 2\r\nLine 3",
          "encoding": "utf-8"
        }
      }
    }
  },
  "expectedBehavior": {
    "taskParsed": "Line 1\nLine 2\nLine 3",
    "lineEndingsNormalized": true
  }
}
```

---

#### GLD-P1-010: Platform Environment Variables

**Scenario**: Platform-specific env var handling

```json
{
  "id": "GLD-P1-010",
  "name": "platform-env-vars",
  "priority": "P1",
  "category": "platform",
  "deterministicSeed": 20010,
  "input": {
    "command": "ax run backend \"Test task\"",
    "args": {
      "agent": "backend",
      "task": "Test task"
    },
    "environmentMock": {
      "AUTOMATOSX_DATABASE_PATH": "$HOME/.automatosx/db",
      "AUTOMATOSX_CONFIG_PATH": "%APPDATA%\\AutomatosX\\config.json"
    }
  },
  "expectedBehavior": {
    "envVarsResolved": true,
    "databasePath": {
      "darwin": "/Users/test/.automatosx/db",
      "linux": "/home/test/.automatosx/db",
      "win32": "C:\\Users\\test\\.automatosx\\db"
    }
  }
}
```

---

### Category 3: Memory & Caching Edge Cases (5 traces)

#### GLD-P1-011: Cache Invalidation

**Scenario**: Cache invalidation on memory update

```json
{
  "id": "GLD-P1-011",
  "name": "cache-invalidation",
  "priority": "P1",
  "category": "memory",
  "deterministicSeed": 20011,
  "input": {
    "commands": [
      "ax memory search \"authentication\"",
      "ax run backend \"Update auth implementation\"",
      "ax memory search \"authentication\""
    ]
  },
  "expectedBehavior": {
    "firstSearch": { "cached": false, "results": 5 },
    "memoryUpdate": { "newEntriesAdded": 3 },
    "secondSearch": { "cached": false, "results": 8 },
    "cacheInvalidated": true
  }
}
```

---

#### GLD-P1-012: Memory Search with Complex Filters

**Scenario**: Advanced filtering with multiple criteria

```json
{
  "id": "GLD-P1-012",
  "name": "complex-memory-filters",
  "priority": "P1",
  "category": "memory",
  "deterministicSeed": 20012,
  "input": {
    "command": "ax memory search \"api\" --agent backend --tags auth,security --after 2025-01-01 --before 2025-01-31",
    "args": {
      "query": "api",
      "agent": "backend",
      "tags": ["auth", "security"],
      "after": "2025-01-01",
      "before": "2025-01-31"
    }
  },
  "expectedBehavior": {
    "queryBuilt": {
      "searchQuery": "api",
      "filters": ["agent=backend", "tags IN (auth,security)", "date BETWEEN 2025-01-01 AND 2025-01-31"]
    },
    "resultsCount": 12,
    "allResultsMatchFilters": true
  }
}
```

---

#### GLD-P1-013: Memory Database Corruption Recovery

**Scenario**: Detect and recover from corrupted database

```json
{
  "id": "GLD-P1-013",
  "name": "memory-db-corruption-recovery",
  "priority": "P1",
  "category": "memory",
  "deterministicSeed": 20013,
  "input": {
    "command": "ax memory search \"test\"",
    "args": {
      "query": "test"
    },
    "environmentMock": {
      "database": {
        "corrupted": true,
        "backupAvailable": true
      }
    }
  },
  "expectedBehavior": {
    "corruptionDetected": true,
    "backupRestored": true,
    "warnings": ["Database corruption detected, restored from backup"],
    "searchCompleted": true
  }
}
```

---

#### GLD-P1-014: Cache Eviction Under Memory Pressure

**Scenario**: LRU eviction when cache is full

```json
{
  "id": "GLD-P1-014",
  "name": "cache-lru-eviction",
  "priority": "P1",
  "category": "memory",
  "deterministicSeed": 20014,
  "input": {
    "commands": Array.from({ length: 15 }, (_, i) =>
      `ax memory search "query${i}"`
    )
  },
  "expectedBehavior": {
    "cacheMaxSize": 10,
    "totalQueries": 15,
    "evictionsTriggered": 5,
    "oldestQueriesEvicted": ["query0", "query1", "query2", "query3", "query4"],
    "cacheHitRate": 0.0
  }
}
```

---

#### GLD-P1-015: Memory Export/Import

**Scenario**: Full memory database backup and restore

```json
{
  "id": "GLD-P1-015",
  "name": "memory-export-import",
  "priority": "P1",
  "category": "memory",
  "deterministicSeed": 20015,
  "input": {
    "commands": [
      "ax memory export backup.json",
      "ax memory clear",
      "ax memory import backup.json"
    ]
  },
  "expectedBehavior": {
    "export": { "entriesExported": 100, "fileSize": 50000 },
    "clear": { "entriesDeleted": 100 },
    "import": { "entriesImported": 100 },
    "dataIntegrityPreserved": true
  }
}
```

---

### Category 4: Error Handling & Edge Cases (5 traces)

#### GLD-P1-016: Malformed CLI Arguments

**Scenario**: Invalid CLI argument combinations

```json
{
  "id": "GLD-P1-016",
  "name": "malformed-cli-args",
  "priority": "P1",
  "category": "error",
  "deterministicSeed": 20016,
  "input": {
    "command": "ax run backend --streaming --json",
    "args": {
      "agent": "backend",
      "streaming": true,
      "json": true
    }
  },
  "expectedBehavior": {
    "exitCode": 1,
    "errorCode": "VALIDATION_ERROR",
    "errorMessage": "Cannot use --streaming with --json output",
    "suggestions": [
      "Use --streaming for interactive mode",
      "Use --json for programmatic output",
      "Remove one of the conflicting flags"
    ]
  }
}
```

---

#### GLD-P1-017: Task Size Limit

**Scenario**: Task description exceeds maximum length

```json
{
  "id": "GLD-P1-017",
  "name": "task-size-limit",
  "priority": "P1",
  "category": "error",
  "deterministicSeed": 20017,
  "input": {
    "command": "ax run backend \"<10000 character task description>\"",
    "args": {
      "agent": "backend",
      "task": "A".repeat(10000)
    }
  },
  "expectedBehavior": {
    "exitCode": 1,
    "errorCode": "VALIDATION_ERROR",
    "errorMessage": "Task description too long (max 5000 characters)",
    "suggestions": [
      "Shorten the task description",
      "Break into multiple tasks",
      "Use --task-file for large tasks"
    ]
  }
}
```

---

#### GLD-P1-018: Network Timeout

**Scenario**: Provider request timeout

```json
{
  "id": "GLD-P1-018",
  "name": "network-timeout",
  "priority": "P1",
  "category": "error",
  "deterministicSeed": 20018,
  "input": {
    "command": "ax run backend \"Test task\" --timeout 5000",
    "args": {
      "agent": "backend",
      "task": "Test task",
      "timeout": 5000
    },
    "environmentMock": {
      "network": {
        "latency": 6000
      }
    }
  },
  "expectedBehavior": {
    "exitCode": 1,
    "errorCode": "TIMEOUT_ERROR",
    "errorMessage": "Request timed out after 5000ms",
    "suggestions": [
      "Increase timeout with --timeout",
      "Check network connection",
      "Try again later"
    ]
  }
}
```

---

#### GLD-P1-019: Concurrent Agent Executions

**Scenario**: Multiple parallel agent runs

```json
{
  "id": "GLD-P1-019",
  "name": "concurrent-agents",
  "priority": "P1",
  "category": "concurrency",
  "deterministicSeed": 20019,
  "input": {
    "command": "ax run backend \"Task 1\" --parallel & ax run frontend \"Task 2\" --parallel",
    "args": [
      { "agent": "backend", "task": "Task 1", "parallel": true },
      { "agent": "frontend", "task": "Task 2", "parallel": true }
    ]
  },
  "expectedBehavior": {
    "concurrentExecutions": 2,
    "resourceLocking": true,
    "memoryIsolation": true,
    "bothCompleted": true
  }
}
```

---

#### GLD-P1-020: Unicode and Special Characters

**Scenario**: Handle Unicode in task descriptions

```json
{
  "id": "GLD-P1-020",
  "name": "unicode-support",
  "priority": "P1",
  "category": "encoding",
  "deterministicSeed": 20020,
  "input": {
    "command": "ax run backend \"分析API性能 🚀 測試 emoji support\"",
    "args": {
      "agent": "backend",
      "task": "分析API性能 🚀 測試 emoji support"
    }
  },
  "expectedBehavior": {
    "taskParsed": "分析API性能 🚀 測試 emoji support",
    "encodingPreserved": true,
    "emojiRendered": true
  }
}
```

---

## Test Execution Guidelines

### Replay Requirements

1. **Deterministic Seeds**: Each trace has a unique seed (20001-20020)
2. **Platform Isolation**: Platform-specific traces run only on target platform
3. **Provider Mocking**: Mock all provider calls for reproducibility
4. **Filesystem Mocking**: Mock file system operations

### Success Criteria

- **Pass Rate**: ≥95% of P1 traces must pass
- **Execution Time**: Each trace <5 seconds
- **Determinism**: 100% reproducible across runs
- **Platform Coverage**: All platforms tested

### Trace Automation

```bash
# Run all P1 traces
npm run test:golden-traces -- --priority=P1

# Run platform-specific traces
npm run test:golden-traces -- --priority=P1 --platform=win32

# Run trace category
npm run test:golden-traces -- --category=provider
```

---

## Integration with CI

```yaml
# .github/workflows/sprint2-ci.yml
- name: Run P1 Golden Traces
  run: |
    npm run test:golden-traces -- --priority=P1 --reporter=json

- name: Upload trace results
  uses: actions/upload-artifact@v3
  with:
    name: p1-trace-results
    path: test-results/golden-traces-p1.json
```

---

## Maintenance

- **Review Frequency**: Quarterly
- **Update Trigger**: Any v1/v2 parity regression
- **Ownership**: AutomatosX Testing Squad

---

**Document Version**: 1.0
**Created**: 2025-11-08
**Sprint**: Sprint 2 Day 16
