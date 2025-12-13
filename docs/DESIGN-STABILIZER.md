# Design Stabilizer MCP Tools

## Overview

Design Stabilizer provides MCP tools for enforcing design system consistency across your codebase. It detects hardcoded colors, raw spacing values, and accessibility issues, then suggests and applies automated fixes.

**Version**: v12.9.0
**Status**: Production Ready

## Quick Start

### Check a file for violations
```
design_check({ paths: ["src/components/Button.tsx"] })
```

### Scan entire codebase
```
design_check_stream({ paths: ["src/**/*.tsx"], chunkSize: 50 })
```

### Preview and apply fixes
```
design_suggest_fixes({ file: "src/components/Button.tsx" })
design_apply_fixes({ file: "src/components/Button.tsx" })
```

## Available Tools

### design_check

Scan files for design system violations.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| paths | string[] | Yes | File paths or glob patterns |
| format | "json" \| "stylish" | No | Output format (default: json) |
| quiet | boolean | No | Only report errors |
| rule | string | No | Run specific rule only |
| ignorePatterns | string[] | No | Additional ignore patterns |
| configPath | string | No | Custom config file path |
| includeCoverage | boolean | No | Include token coverage stats |
| limit | integer | No | Max violations per file (default: 100) |

**Output:**
```typescript
{
  success: boolean;
  summary: {
    files: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    skipped: number;
  };
  results: Array<{
    file: string;
    violations: Array<{
      rule: string;
      severity: "error" | "warning";
      message: string;
      line: number;
      column: number;
      found: string;
      suggestion?: string;
      fixable: boolean;
    }>;
  }>;
  coverage?: {
    colorCoverage: number;
    spacingCoverage: number;
  };
  durationMs: number;
}
```

### design_check_stream

Stream design check results for large codebases (100+ files).

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| paths | string[] | Yes | File paths or glob patterns |
| chunkSize | integer | No | Files per chunk (default: 50, range: 10-200) |
| quiet | boolean | No | Only report errors |
| rule | string | No | Run specific rule only |
| ignorePatterns | string[] | No | Additional ignore patterns |
| configPath | string | No | Custom config file path |
| timeoutMs | integer | No | Timeout in ms (default: 300000 = 5 min) |
| maxViolations | integer | No | Stop after N violations |

**Output:**
```typescript
{
  success: boolean;
  stoppedEarly: boolean;
  stopReason?: "timeout" | "max_violations" | "cancelled";
  summary: {
    filesScanned: number;
    totalFiles: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    skipped: number;
  };
  results: Array<FileResult>;
  progressEvents: number;
  durationMs: number;
}
```

### design_rules

List available design check rules with descriptions and examples.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| configPath | string | No | Config file to check settings |
| filter | string | No | Filter rules by substring |

**Output:**
```typescript
{
  rules: Array<{
    id: string;
    description: string;
    defaultSeverity: "error" | "warning";
    currentSeverity: "error" | "warn" | "off";
    fixable: boolean;
    category: "colors" | "spacing" | "accessibility" | "style";
    examples: { bad: string; good: string };
  }>;
  total: number;
}
```

### design_suggest_fixes

Preview fix patches without modifying files.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | File path to analyze |
| violations | array | No | Specific violations to fix |
| configPath | string | No | Custom config file path |

**Output:**
```typescript
{
  success: boolean;
  file: string;
  patches: Array<{
    line: number;
    column: number;
    rule: string;
    original: string;
    replacement: string;
    confidence: "high" | "medium" | "low";
    reason?: string;
  }>;
  unifiedDiff: string;
  wouldFix: number;
  cannotFix: number;
  cannotFixReasons?: string[];
}
```

### design_apply_fixes

Apply reviewed patches with backup creation.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | string | Yes | File path to fix |
| rules | string[] | No | Specific rules to fix |
| createBackup | boolean | No | Create backup (default: true) |
| verify | boolean | No | Re-run check after (default: true) |
| configPath | string | No | Custom config file path |

**Output:**
```typescript
{
  success: boolean;
  file: string;
  backupPath?: string;
  applied: number;
  failed: number;
  failedReasons?: string[];
  verification?: {
    beforeErrors: number;
    beforeWarnings: number;
    afterErrors: number;
    afterWarnings: number;
    fixed: number;
  };
}
```

## Rules Reference

| Rule | Severity | Fixable | Description |
|------|----------|---------|-------------|
| no-hardcoded-colors | error | Yes | Detects hardcoded hex, RGB, HSL colors |
| no-raw-spacing | warning | Yes | Detects raw pixel spacing values |
| no-inline-styles | warning | No | Detects inline style props in JSX |
| missing-alt-text | error | No | Detects images without alt attributes |
| missing-form-labels | error | No | Detects form inputs without labels |

## Configuration

Create `.ax/design-check.config.json` in your project root:

```json
{
  "$schema": "https://ax.defai.digital/schemas/design-check.schema.json",
  "tokens": {
    "colors": {
      "primary": "#007bff",
      "secondary": "#6c757d",
      "success": "#28a745",
      "error": "#dc3545",
      "warning": "#ffc107",
      "info": "#17a2b8"
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px"
    }
  },
  "rules": {
    "no-hardcoded-colors": "error",
    "no-raw-spacing": "warn",
    "no-inline-styles": "warn",
    "missing-alt-text": "error",
    "missing-form-labels": "error"
  },
  "include": ["**/*.tsx", "**/*.jsx"],
  "ignore": ["node_modules/**", "dist/**", "**/*.test.tsx"]
}
```

## Ignore Comments

Disable rules for specific lines:

```tsx
// ax-ignore-next-line
const color = '#ff0000';

// ax-ignore-next-line no-hardcoded-colors
const specificIgnore = '#00ff00';

/* ax-ignore-file */
// Ignore entire file
```

## Example Workflow

### 1. Initial scan
```
design_check({ paths: ["src/**/*.tsx"] })
// Returns: 45 errors, 23 warnings across 12 files
```

### 2. Review rules
```
design_rules({ filter: "color" })
// Returns rule details for no-hardcoded-colors
```

### 3. Preview fixes for a file
```
design_suggest_fixes({ file: "src/components/Button.tsx" })
// Returns unified diff showing proposed changes
```

### 4. Apply fixes
```
design_apply_fixes({
  file: "src/components/Button.tsx",
  createBackup: true,
  verify: true
})
// Returns: 5 applied, 0 failed, backup at .ax-backup
```

### 5. Verify results
```
design_check({ paths: ["src/components/Button.tsx"] })
// Returns: 0 errors, 0 warnings
```

## Integration with Quality Agent

The quality agent (Queenie) has design-check capability. Ask for design system checks:

- "Check the Button component for design violations"
- "Scan the entire src folder for hardcoded colors"
- "Fix all design system issues in the dashboard"
- "Review accessibility issues in the forms"

## Architecture

```
AutomatosX (MCP Server)
├── design_check        → @defai.digital/ax-core/design-check
├── design_check_stream → Chunked scanning with progress
├── design_rules        → Rule metadata and config
├── design_suggest_fixes → Dry-run fix preview
└── design_apply_fixes  → Apply with backup/verify
```

## Performance

| Scenario | Files | Time |
|----------|-------|------|
| Small scan | 50 | <2s |
| Medium scan | 200 | <5s |
| Large scan (stream) | 1000 | <30s |
| Fix single file | 1 | <1s |

## Error Codes

| Code | Description |
|------|-------------|
| INVALID_PATH | Path validation failed |
| CONFIG_ERROR | Configuration loading failed |
| TIMEOUT | Scan exceeded time limit |
| PARSE_ERROR | File parsing failed |
| UNKNOWN | Unexpected error |

## Troubleshooting

### "Cannot find module @defai.digital/ax-core/design-check"
Ensure ax-core is installed and built:
```bash
pnpm --filter @defai.digital/ax-core build
```

### Fixes not applying
- Check file permissions
- Ensure backup directory is writable
- Verify violation is marked as `fixable: true`

### Slow scanning
- Use `design_check_stream` for large codebases
- Add ignore patterns for generated files
- Reduce `chunkSize` if memory constrained
