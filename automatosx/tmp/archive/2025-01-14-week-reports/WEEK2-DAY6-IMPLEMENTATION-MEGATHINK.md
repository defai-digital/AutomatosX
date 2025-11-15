# Week 2 Day 6: Implementation Megathinking

**Date**: 2025-01-14
**Scope**: Complete testing and feature flags for ADR-014 Zod Validation
**Timeline**: 6 hours
**Status**: 📋 **READY TO EXECUTE**

---

## Executive Summary

This document provides a step-by-step implementation guide for Week 2 Day 6, covering:
1. **Schema Unit Tests** (3 hours) - 65+ test cases for parser and database schemas
2. **Integration Tests** (2 hours) - 63+ test cases for real-world workflows
3. **Feature Flags** (1 hour) - Non-breaking validation with metrics

**Goal**: Achieve 100% test coverage for all 20 validation schemas and enable optional validation in production.

---

## Pre-Implementation Checklist

### Environment Setup

```bash
# Verify current working directory
pwd
# Should be: /Users/akiralam/code/automatosx2

# Check git status
git status
# Should show: parser.schema.ts, database.schema.ts, and documentation files

# Verify Node.js version
node --version
# Should be: v24.x

# Verify dependencies
npm list vitest zod
# Should show: vitest@latest, zod@latest

# Check existing test structure
ls -la src/__tests__/
ls -la src/types/schemas/
```

### Current State Verification

**Completed** ✅:
- Week 2 Days 1-3: ReScript stabilization (167/183 tests passing, 91%)
- Week 2 Days 4-5: ADR-014 implementation (20 schemas, 887 lines)
  - `src/types/schemas/parser.schema.ts` (355 lines, 5 schemas)
  - `src/types/schemas/database.schema.ts` (532 lines, 15 schemas)

**Test Status**:
```bash
npm test 2>&1 | tail -20
```

Expected: 167/183 tests passing (91%)

**Files to Create**:
1. `src/types/schemas/__tests__/parser.schema.test.ts`
2. `src/types/schemas/__tests__/database.schema.test.ts`
3. `src/__tests__/integration/parser-validation.integration.test.ts`
4. `src/__tests__/integration/database-validation.integration.test.ts`
5. `src/config/ValidationConfig.ts`
6. `src/utils/ValidationMetrics.ts`

---

## Part 1: Parser Schema Tests (1.5 hours)

### Task 1.1: Create Test File Structure (5 minutes)

**Objective**: Set up test file with proper imports and structure

```bash
# Create test directory if it doesn't exist
mkdir -p src/types/schemas/__tests__

# Create parser schema test file
touch src/types/schemas/__tests__/parser.schema.test.ts
```

**File**: `src/types/schemas/__tests__/parser.schema.test.ts`

**Initial Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import {
  // Schemas
  SymbolKindSchema,
  SymbolSchema,
  ParseResultSchema,
  LanguageDetectionSchema,
  ParserErrorSchema,
  ParseResultWithErrorsSchema,

  // Types
  SymbolKind,
  Symbol,
  ParseResult,

  // Validation functions
  validateSymbol,
  validateParseResult,
  validateParseResultWithErrors,
  validateLanguageDetection,

  // Safe validation
  safeValidateSymbol,
  safeValidateParseResult,

  // Type guards
  isSymbol,
  isParseResult,

  // Helpers
  getAllSymbolKinds,
  isValidSymbolKind,
} from '../parser.schema.js';

describe('parser.schema', () => {
  // Tests will go here
});
```

---

### Task 1.2: SymbolKindSchema Tests (10 minutes)

**Objective**: Test enum validation for all 11 symbol kinds

```typescript
describe('SymbolKindSchema', () => {
  describe('Valid symbol kinds', () => {
    it('should validate "function"', () => {
      expect(() => SymbolKindSchema.parse('function')).not.toThrow();
    });

    it('should validate "class"', () => {
      expect(() => SymbolKindSchema.parse('class')).not.toThrow();
    });

    it('should validate "interface"', () => {
      expect(() => SymbolKindSchema.parse('interface')).not.toThrow();
    });

    it('should validate "type"', () => {
      expect(() => SymbolKindSchema.parse('type')).not.toThrow();
    });

    it('should validate "variable"', () => {
      expect(() => SymbolKindSchema.parse('variable')).not.toThrow();
    });

    it('should validate "constant"', () => {
      expect(() => SymbolKindSchema.parse('constant')).not.toThrow();
    });

    it('should validate "method"', () => {
      expect(() => SymbolKindSchema.parse('method')).not.toThrow();
    });

    it('should validate "enum"', () => {
      expect(() => SymbolKindSchema.parse('enum')).not.toThrow();
    });

    it('should validate "struct"', () => {
      expect(() => SymbolKindSchema.parse('struct')).not.toThrow();
    });

    it('should validate "trait"', () => {
      expect(() => SymbolKindSchema.parse('trait')).not.toThrow();
    });

    it('should validate "module"', () => {
      expect(() => SymbolKindSchema.parse('module')).not.toThrow();
    });

    it('should validate all kinds in bulk', () => {
      const kinds = ['function', 'class', 'interface', 'type', 'variable',
                     'constant', 'method', 'enum', 'struct', 'trait', 'module'];

      kinds.forEach(kind => {
        expect(() => SymbolKindSchema.parse(kind)).not.toThrow();
      });
    });
  });

  describe('Invalid symbol kinds', () => {
    it('should reject unknown kind', () => {
      expect(() => SymbolKindSchema.parse('unknown')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => SymbolKindSchema.parse('')).toThrow();
    });

    it('should reject number', () => {
      expect(() => SymbolKindSchema.parse(42)).toThrow();
    });

    it('should reject null', () => {
      expect(() => SymbolKindSchema.parse(null)).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => SymbolKindSchema.parse(undefined)).toThrow();
    });

    it('should reject object', () => {
      expect(() => SymbolKindSchema.parse({})).toThrow();
    });
  });
});
```

**Expected**: 18 test cases, all passing

---

### Task 1.3: SymbolSchema Tests (30 minutes)

**Objective**: Test complex domain object with cross-field validation

```typescript
describe('SymbolSchema', () => {
  const validSymbol = {
    name: 'getUserById',
    kind: 'function' as const,
    line: 42,
    column: 10,
  };

  describe('Valid symbols', () => {
    it('should validate minimal valid symbol', () => {
      expect(() => SymbolSchema.parse(validSymbol)).not.toThrow();

      const result = SymbolSchema.parse(validSymbol);
      expect(result.name).toBe('getUserById');
      expect(result.kind).toBe('function');
      expect(result.line).toBe(42);
      expect(result.column).toBe(10);
    });

    it('should validate symbol with endLine and endColumn', () => {
      const symbol = {
        ...validSymbol,
        endLine: 45,
        endColumn: 1,
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate symbol with metadata', () => {
      const symbol = {
        ...validSymbol,
        metadata: { async: true, exported: true, deprecated: false },
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();

      const result = SymbolSchema.parse(symbol);
      expect(result.metadata).toEqual({ async: true, exported: true, deprecated: false });
    });

    it('should validate symbol with empty metadata', () => {
      const symbol = {
        ...validSymbol,
        metadata: {},
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate endLine === line with valid endColumn', () => {
      const symbol = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 20, // > column
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate endLine > line with any endColumn', () => {
      const symbol = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 45,
        endColumn: 5, // Can be < column when different line
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate all symbol kinds', () => {
      const kinds: SymbolKind[] = ['function', 'class', 'interface', 'type', 'variable',
                                    'constant', 'method', 'enum', 'struct', 'trait', 'module'];

      kinds.forEach(kind => {
        const symbol = { ...validSymbol, kind };
        expect(() => SymbolSchema.parse(symbol)).not.toThrow();
      });
    });
  });

  describe('Invalid symbols - field validation', () => {
    it('should reject empty name', () => {
      const invalid = { ...validSymbol, name: '' };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
    });

    it('should reject invalid kind', () => {
      const invalid = { ...validSymbol, kind: 'unknown' };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject zero line number', () => {
      const invalid = { ...validSymbol, line: 0 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject negative line number', () => {
      const invalid = { ...validSymbol, line: -1 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject negative column number', () => {
      const invalid = { ...validSymbol, column: -1 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Column number must be non-negative');
    });

    it('should reject fractional line number', () => {
      const invalid = { ...validSymbol, line: 42.5 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject fractional column number', () => {
      const invalid = { ...validSymbol, column: 10.5 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (name)', () => {
      const invalid = { kind: 'function', line: 42, column: 10 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (kind)', () => {
      const invalid = { name: 'foo', line: 42, column: 10 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (line)', () => {
      const invalid = { name: 'foo', kind: 'function', column: 10 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (column)', () => {
      const invalid = { name: 'foo', kind: 'function', line: 42 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid symbols - cross-field validation', () => {
    it('should reject endLine < line', () => {
      const invalid = {
        ...validSymbol,
        line: 42,
        endLine: 41,
      };

      expect(() => SymbolSchema.parse(invalid)).toThrow('endLine must be greater than or equal to line');
    });

    it('should reject endColumn <= column when endLine === line', () => {
      const invalid1 = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 10, // Equal
      };

      expect(() => SymbolSchema.parse(invalid1)).toThrow('endColumn must be greater than column');

      const invalid2 = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 5, // Less than
      };

      expect(() => SymbolSchema.parse(invalid2)).toThrow('endColumn must be greater than column');
    });
  });

  describe('Edge cases', () => {
    it('should validate line = 1, column = 0 (start of file)', () => {
      const symbol = {
        name: 'firstFunction',
        kind: 'function' as const,
        line: 1,
        column: 0,
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate large line numbers', () => {
      const symbol = {
        ...validSymbol,
        line: 999999,
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate large column numbers', () => {
      const symbol = {
        ...validSymbol,
        column: 999999,
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate complex metadata', () => {
      const symbol = {
        ...validSymbol,
        metadata: {
          async: true,
          exported: true,
          deprecated: false,
          visibility: 'public',
          parameters: ['id', 'options'],
          returnType: 'Promise<User>',
          tags: ['api', 'auth'],
        },
      };

      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });
  });
});
```

**Expected**: 30 test cases, all passing

---

### Task 1.4: ParseResultSchema Tests (20 minutes)

**Objective**: Test parse result validation with sanity checks

```typescript
describe('ParseResultSchema', () => {
  const validResult = {
    symbols: [],
    parseTime: 12.5,
    nodeCount: 145,
  };

  describe('Valid parse results', () => {
    it('should validate empty symbol list', () => {
      expect(() => ParseResultSchema.parse(validResult)).not.toThrow();
    });

    it('should validate with single symbol', () => {
      const result = {
        symbols: [
          { name: 'foo', kind: 'function' as const, line: 1, column: 0 },
        ],
        parseTime: 5.2,
        nodeCount: 50,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate with multiple symbols', () => {
      const result = {
        symbols: [
          { name: 'User', kind: 'class' as const, line: 1, column: 0 },
          { name: 'getUserById', kind: 'method' as const, line: 5, column: 2 },
          { name: 'createUser', kind: 'method' as const, line: 10, column: 2 },
          { name: 'userId', kind: 'variable' as const, line: 15, column: 4 },
        ],
        parseTime: 15.8,
        nodeCount: 250,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate zero parse time', () => {
      const result = {
        ...validResult,
        parseTime: 0,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate zero node count', () => {
      const result = {
        ...validResult,
        nodeCount: 0,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate fast parse (< 1ms)', () => {
      const result = {
        ...validResult,
        parseTime: 0.5,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate slow but acceptable parse (< 60s)', () => {
      const result = {
        ...validResult,
        parseTime: 30000, // 30 seconds
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });
  });

  describe('Invalid parse results', () => {
    it('should reject negative parse time', () => {
      const invalid = {
        ...validResult,
        parseTime: -1,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow('Parse time must be non-negative');
    });

    it('should reject negative node count', () => {
      const invalid = {
        ...validResult,
        nodeCount: -1,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow('Node count must be non-negative');
    });

    it('should reject fractional node count', () => {
      const invalid = {
        ...validResult,
        nodeCount: 145.5,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject parse time >= 60 seconds', () => {
      const invalid = {
        ...validResult,
        parseTime: 60000, // 60 seconds
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow('Parse time exceeds 60 seconds');
    });

    it('should reject extremely long parse time', () => {
      const invalid = {
        ...validResult,
        parseTime: 120000, // 2 minutes
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow('Parse time exceeds 60 seconds');
    });

    it('should reject invalid symbol in list', () => {
      const invalid = {
        symbols: [
          { name: '', kind: 'function' as const, line: 1, column: 0 }, // Empty name
        ],
        parseTime: 5.2,
        nodeCount: 50,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (symbols)', () => {
      const invalid = {
        parseTime: 5.2,
        nodeCount: 50,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (parseTime)', () => {
      const invalid = {
        symbols: [],
        nodeCount: 50,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject missing required field (nodeCount)', () => {
      const invalid = {
        symbols: [],
        parseTime: 5.2,
      };

      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should validate large symbol list (1000+ symbols)', () => {
      const symbols = Array(1000).fill(null).map((_, i) => ({
        name: `symbol${i}`,
        kind: 'function' as const,
        line: i + 1,
        column: 0,
      }));

      const result = {
        symbols,
        parseTime: 500, // 500ms
        nodeCount: 10000,
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate very large node count', () => {
      const result = {
        ...validResult,
        nodeCount: 1000000, // 1 million nodes
      };

      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });
  });
});
```

**Expected**: 21 test cases, all passing

---

### Task 1.5: Helper Functions Tests (15 minutes)

**Objective**: Test validation helpers, type guards, and utility functions

```typescript
describe('Helper Functions', () => {
  describe('validateSymbol', () => {
    it('should validate and return typed symbol', () => {
      const input = {
        name: 'foo',
        kind: 'function' as const,
        line: 1,
        column: 0,
      };

      const result = validateSymbol(input);

      expect(result.name).toBe('foo');
      expect(result.kind).toBe('function');
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
    });

    it('should throw on invalid data', () => {
      expect(() => validateSymbol({ invalid: 'data' })).toThrow();
      expect(() => validateSymbol(null)).toThrow();
      expect(() => validateSymbol(undefined)).toThrow();
      expect(() => validateSymbol('string')).toThrow();
      expect(() => validateSymbol(42)).toThrow();
    });
  });

  describe('safeValidateSymbol', () => {
    it('should return success object for valid data', () => {
      const input = {
        name: 'foo',
        kind: 'function' as const,
        line: 1,
        column: 0,
      };

      const result = safeValidateSymbol(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('foo');
      }
    });

    it('should return error object for invalid data', () => {
      const invalid = {
        name: '', // Empty name
        kind: 'function' as const,
        line: 1,
        column: 0,
      };

      const result = safeValidateSymbol(invalid);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should not throw on invalid data', () => {
      expect(() => safeValidateSymbol({ invalid: 'data' })).not.toThrow();
      expect(() => safeValidateSymbol(null)).not.toThrow();
      expect(() => safeValidateSymbol(undefined)).not.toThrow();
    });
  });

  describe('isSymbol type guard', () => {
    it('should return true for valid symbol', () => {
      const valid = {
        name: 'foo',
        kind: 'function' as const,
        line: 1,
        column: 0,
      };

      expect(isSymbol(valid)).toBe(true);
    });

    it('should return false for invalid symbol', () => {
      expect(isSymbol({ name: '', kind: 'function', line: 1, column: 0 })).toBe(false);
      expect(isSymbol({ invalid: 'data' })).toBe(false);
      expect(isSymbol(null)).toBe(false);
      expect(isSymbol(undefined)).toBe(false);
      expect(isSymbol('string')).toBe(false);
      expect(isSymbol(42)).toBe(false);
    });
  });

  describe('isParseResult type guard', () => {
    it('should return true for valid parse result', () => {
      const valid = {
        symbols: [],
        parseTime: 5.2,
        nodeCount: 50,
      };

      expect(isParseResult(valid)).toBe(true);
    });

    it('should return false for invalid parse result', () => {
      expect(isParseResult({ symbols: [], parseTime: -1, nodeCount: 50 })).toBe(false);
      expect(isParseResult({ invalid: 'data' })).toBe(false);
      expect(isParseResult(null)).toBe(false);
    });
  });

  describe('getAllSymbolKinds', () => {
    it('should return all 11 symbol kinds', () => {
      const kinds = getAllSymbolKinds();

      expect(kinds).toHaveLength(11);
      expect(kinds).toContain('function');
      expect(kinds).toContain('class');
      expect(kinds).toContain('interface');
      expect(kinds).toContain('type');
      expect(kinds).toContain('variable');
      expect(kinds).toContain('constant');
      expect(kinds).toContain('method');
      expect(kinds).toContain('enum');
      expect(kinds).toContain('struct');
      expect(kinds).toContain('trait');
      expect(kinds).toContain('module');
    });
  });

  describe('isValidSymbolKind', () => {
    it('should return true for valid kinds', () => {
      expect(isValidSymbolKind('function')).toBe(true);
      expect(isValidSymbolKind('class')).toBe(true);
      expect(isValidSymbolKind('interface')).toBe(true);
      expect(isValidSymbolKind('type')).toBe(true);
      expect(isValidSymbolKind('variable')).toBe(true);
      expect(isValidSymbolKind('constant')).toBe(true);
      expect(isValidSymbolKind('method')).toBe(true);
      expect(isValidSymbolKind('enum')).toBe(true);
      expect(isValidSymbolKind('struct')).toBe(true);
      expect(isValidSymbolKind('trait')).toBe(true);
      expect(isValidSymbolKind('module')).toBe(true);
    });

    it('should return false for invalid kinds', () => {
      expect(isValidSymbolKind('unknown')).toBe(false);
      expect(isValidSymbolKind('')).toBe(false);
      expect(isValidSymbolKind('FUNCTION')).toBe(false); // Case sensitive
    });
  });
});
```

**Expected**: 25+ test cases, all passing

---

### Task 1.6: Run Parser Schema Tests (10 minutes)

```bash
# Run parser schema tests
npm test -- src/types/schemas/__tests__/parser.schema.test.ts

# Expected output:
# ✓ parser.schema (94 tests)
#   ✓ SymbolKindSchema (18 tests)
#   ✓ SymbolSchema (30 tests)
#   ✓ ParseResultSchema (21 tests)
#   ✓ Helper Functions (25 tests)
#
# Test Files  1 passed (1)
#      Tests  94 passed (94)
```

**If any tests fail**:
1. Check error message
2. Fix schema or test
3. Re-run tests

**Time**: 10 minutes (including fixes)

---

## Part 2: Database Schema Tests (1.5 hours)

### Task 2.1: Create Database Test File (5 minutes)

```bash
# Create database schema test file
touch src/types/schemas/__tests__/database.schema.test.ts
```

**File**: `src/types/schemas/__tests__/database.schema.test.ts`

**Initial Structure**:
```typescript
import { describe, it, expect } from 'vitest';
import {
  // File schemas
  FileInputSchema,
  FileUpdateSchema,
  FileRecordSchema,

  // Symbol schemas
  SymbolInputSchema,
  SymbolRecordSchema,

  // Chunk schemas
  ChunkInputSchema,
  ChunkRecordSchema,

  // Call schemas
  CallInputSchema,
  CallRecordSchema,

  // Import schemas
  ImportInputSchema,
  ImportRecordSchema,

  // Validation functions
  validateFileInput,
  validateFileUpdate,
  validateSymbolInput,
  validateChunkInput,
  validateCallInput,
  validateImportInput,

  // Safe validation
  safeValidateFileInput,
  safeValidateSymbolInput,
  safeValidateChunkInput,

  // Type guards
  isFileInput,
  isSymbolInput,
  isChunkInput,

  // Batch validation
  validateFileInputBatch,
  validateSymbolInputBatch,
  validateChunkInputBatch,
} from '../database.schema.js';

describe('database.schema', () => {
  // Tests will go here
});
```

---

### Task 2.2: FileInputSchema Tests (20 minutes)

**Objective**: Test file input validation with size limits

```typescript
describe('FileInputSchema', () => {
  const validFile = {
    path: '/src/services/UserService.ts',
    content: 'export class UserService { ... }',
    language: 'typescript',
  };

  describe('Valid file inputs', () => {
    it('should validate complete file input', () => {
      expect(() => FileInputSchema.parse(validFile)).not.toThrow();

      const result = FileInputSchema.parse(validFile);
      expect(result.path).toBe('/src/services/UserService.ts');
      expect(result.content).toBe('export class UserService { ... }');
      expect(result.language).toBe('typescript');
    });

    it('should validate without optional language', () => {
      const file = {
        path: '/test.txt',
        content: 'test content',
      };

      expect(() => FileInputSchema.parse(file)).not.toThrow();
    });

    it('should validate empty content', () => {
      const file = {
        path: '/empty.txt',
        content: '',
      };

      expect(() => FileInputSchema.parse(file)).not.toThrow();
    });

    it('should validate large content (< 10MB)', () => {
      const largeContent = 'x'.repeat(5_000_000); // 5MB
      const file = {
        path: '/large.txt',
        content: largeContent,
      };

      expect(() => FileInputSchema.parse(file)).not.toThrow();
    });

    it('should validate exactly 10MB content', () => {
      const exactContent = 'x'.repeat(10_000_000); // Exactly 10MB
      const file = {
        path: '/exact.txt',
        content: exactContent,
      };

      expect(() => FileInputSchema.parse(file)).not.toThrow();
    });
  });

  describe('Invalid file inputs', () => {
    it('should reject empty path', () => {
      const invalid = {
        ...validFile,
        path: '',
      };

      expect(() => FileInputSchema.parse(invalid)).toThrow('File path cannot be empty');
    });

    it('should reject content > 10MB', () => {
      const tooLarge = 'x'.repeat(10_000_001); // 10MB + 1 byte
      const invalid = {
        path: '/large.txt',
        content: tooLarge,
      };

      expect(() => FileInputSchema.parse(invalid)).toThrow('File content exceeds 10MB limit');
    });

    it('should reject missing path', () => {
      const invalid = {
        content: 'test',
      };

      expect(() => FileInputSchema.parse(invalid)).toThrow();
    });

    it('should reject missing content', () => {
      const invalid = {
        path: '/test.txt',
      };

      expect(() => FileInputSchema.parse(invalid)).toThrow();
    });
  });
});

describe('FileUpdateSchema', () => {
  describe('Valid file updates', () => {
    it('should validate content-only update', () => {
      const update = {
        content: 'new content',
      };

      expect(() => FileUpdateSchema.parse(update)).not.toThrow();
    });

    it('should validate language-only update', () => {
      const update = {
        language: 'javascript',
      };

      expect(() => FileUpdateSchema.parse(update)).not.toThrow();
    });

    it('should validate both fields update', () => {
      const update = {
        content: 'new content',
        language: 'python',
      };

      expect(() => FileUpdateSchema.parse(update)).not.toThrow();
    });
  });

  describe('Invalid file updates', () => {
    it('should reject empty update', () => {
      const invalid = {};

      expect(() => FileUpdateSchema.parse(invalid)).toThrow('At least one field must be provided');
    });

    it('should reject content > 10MB', () => {
      const tooLarge = 'x'.repeat(10_000_001);
      const invalid = {
        content: tooLarge,
      };

      expect(() => FileUpdateSchema.parse(invalid)).toThrow('File content exceeds 10MB limit');
    });
  });
});
```

**Expected**: 17 test cases, all passing

---

### Task 2.3: SymbolInputSchema Tests (25 minutes)

**Objective**: Test symbol input with foreign key and cross-field validation

```typescript
describe('SymbolInputSchema', () => {
  const validSymbol = {
    file_id: 42,
    name: 'getUserById',
    kind: 'function' as const,
    line: 10,
    column: 2,
  };

  describe('Valid symbol inputs', () => {
    it('should validate minimal symbol input', () => {
      expect(() => SymbolInputSchema.parse(validSymbol)).not.toThrow();
    });

    it('should validate with end position', () => {
      const symbol = {
        ...validSymbol,
        end_line: 15,
        end_column: 1,
      };

      expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
    });

    it('should validate file_id = 1', () => {
      const symbol = {
        ...validSymbol,
        file_id: 1,
      };

      expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
    });

    it('should validate large file_id', () => {
      const symbol = {
        ...validSymbol,
        file_id: 999999,
      };

      expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
    });

    it('should validate end_line === line with valid end_column', () => {
      const symbol = {
        ...validSymbol,
        line: 10,
        column: 2,
        end_line: 10,
        end_column: 20,
      };

      expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
    });

    it('should validate end_line > line with any end_column', () => {
      const symbol = {
        ...validSymbol,
        line: 10,
        column: 10,
        end_line: 15,
        end_column: 2, // Can be < column when different line
      };

      expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
    });
  });

  describe('Invalid symbol inputs', () => {
    it('should reject file_id = 0', () => {
      const invalid = {
        ...validSymbol,
        file_id: 0,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('file_id must be a positive integer');
    });

    it('should reject negative file_id', () => {
      const invalid = {
        ...validSymbol,
        file_id: -1,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('file_id must be a positive integer');
    });

    it('should reject fractional file_id', () => {
      const invalid = {
        ...validSymbol,
        file_id: 42.5,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow();
    });

    it('should reject empty name', () => {
      const invalid = {
        ...validSymbol,
        name: '',
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
    });

    it('should reject invalid kind', () => {
      const invalid = {
        ...validSymbol,
        kind: 'unknown',
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow();
    });

    it('should reject zero line', () => {
      const invalid = {
        ...validSymbol,
        line: 0,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject negative line', () => {
      const invalid = {
        ...validSymbol,
        line: -1,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject negative column', () => {
      const invalid = {
        ...validSymbol,
        column: -1,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('Column number must be non-negative');
    });

    it('should reject end_line < line', () => {
      const invalid = {
        ...validSymbol,
        line: 10,
        end_line: 9,
      };

      expect(() => SymbolInputSchema.parse(invalid)).toThrow('end_line must be greater than or equal to line');
    });

    it('should reject end_column <= column when same line', () => {
      const invalid1 = {
        ...validSymbol,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 5, // Equal
      };

      expect(() => SymbolInputSchema.parse(invalid1)).toThrow('end_column must be greater than column');

      const invalid2 = {
        ...validSymbol,
        line: 10,
        column: 5,
        end_line: 10,
        end_column: 3, // Less
      };

      expect(() => SymbolInputSchema.parse(invalid2)).toThrow('end_column must be greater than column');
    });
  });
});
```

**Expected**: 20 test cases, all passing

---

### Task 2.4: Batch Validation Tests (20 minutes)

**Objective**: Test batch validation with error collection

```typescript
describe('Batch Validation', () => {
  describe('validateFileInputBatch', () => {
    it('should validate all valid files', () => {
      const files = [
        { path: '/file1.ts', content: 'content1', language: 'typescript' },
        { path: '/file2.js', content: 'content2', language: 'javascript' },
        { path: '/file3.py', content: 'content3', language: 'python' },
      ];

      const { validated, errors } = validateFileInputBatch(files);

      expect(validated).toHaveLength(3);
      expect(errors).toHaveLength(0);
    });

    it('should collect errors for invalid files', () => {
      const files = [
        { path: '/file1.ts', content: 'content1' }, // Valid
        { path: '', content: 'content2' }, // Invalid: empty path
        { path: '/file3.ts', content: 'content3' }, // Valid
        { path: '/file4.ts', content: 'x'.repeat(10_000_001) }, // Invalid: too large
      ];

      const { validated, errors } = validateFileInputBatch(files);

      expect(validated).toHaveLength(2);
      expect(errors).toHaveLength(2);
      expect(errors[0].index).toBe(1);
      expect(errors[1].index).toBe(3);
    });

    it('should handle empty array', () => {
      const { validated, errors } = validateFileInputBatch([]);

      expect(validated).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('should handle all invalid files', () => {
      const files = [
        { path: '', content: 'test' },
        { path: '', content: 'test' },
        { path: '', content: 'test' },
      ];

      const { validated, errors } = validateFileInputBatch(files);

      expect(validated).toHaveLength(0);
      expect(errors).toHaveLength(3);
    });
  });

  describe('validateSymbolInputBatch', () => {
    it('should validate all valid symbols', () => {
      const symbols = [
        { file_id: 1, name: 'foo', kind: 'function' as const, line: 1, column: 0 },
        { file_id: 1, name: 'Bar', kind: 'class' as const, line: 10, column: 0 },
        { file_id: 1, name: 'baz', kind: 'variable' as const, line: 20, column: 0 },
      ];

      const { validated, errors } = validateSymbolInputBatch(symbols);

      expect(validated).toHaveLength(3);
      expect(errors).toHaveLength(0);
    });

    it('should collect errors for invalid symbols', () => {
      const symbols = [
        { file_id: 1, name: 'foo', kind: 'function' as const, line: 1, column: 0 }, // Valid
        { file_id: -1, name: 'bar', kind: 'class' as const, line: 10, column: 0 }, // Invalid: negative file_id
        { file_id: 1, name: '', kind: 'method' as const, line: 15, column: 0 }, // Invalid: empty name
        { file_id: 1, name: 'baz', kind: 'variable' as const, line: 20, column: 0 }, // Valid
      ];

      const { validated, errors } = validateSymbolInputBatch(symbols);

      expect(validated).toHaveLength(2);
      expect(errors).toHaveLength(2);
      expect(errors[0].index).toBe(1);
      expect(errors[1].index).toBe(2);
    });
  });

  describe('validateChunkInputBatch', () => {
    it('should validate all valid chunks', () => {
      const chunks = [
        { file_id: 1, text: 'chunk1', start_line: 1, end_line: 10 },
        { file_id: 1, text: 'chunk2', start_line: 11, end_line: 20 },
        { file_id: 1, text: 'chunk3', start_line: 21, end_line: 30 },
      ];

      const { validated, errors } = validateChunkInputBatch(chunks);

      expect(validated).toHaveLength(3);
      expect(errors).toHaveLength(0);
    });

    it('should collect errors for invalid chunks', () => {
      const chunks = [
        { file_id: 1, text: 'chunk1', start_line: 1, end_line: 10 }, // Valid
        { file_id: 1, text: '', start_line: 11, end_line: 20 }, // Invalid: empty text
        { file_id: 1, text: 'chunk3', start_line: 30, end_line: 20 }, // Invalid: end < start
      ];

      const { validated, errors } = validateChunkInputBatch(chunks);

      expect(validated).toHaveLength(1);
      expect(errors).toHaveLength(2);
    });
  });
});
```

**Expected**: 10 test cases, all passing

---

### Task 2.5: Run Database Schema Tests (10 minutes)

```bash
# Run database schema tests
npm test -- src/types/schemas/__tests__/database.schema.test.ts

# Expected output:
# ✓ database.schema (47+ tests)
#   ✓ FileInputSchema (10 tests)
#   ✓ FileUpdateSchema (7 tests)
#   ✓ SymbolInputSchema (20 tests)
#   ✓ Batch Validation (10 tests)
#
# Test Files  1 passed (1)
#      Tests  47 passed (47)
```

**Time**: 10 minutes (including fixes)

---

## Part 3: Integration Tests (2 hours)

### Task 3.1: Parser Integration Tests (1 hour)

**Create File**:
```bash
mkdir -p src/__tests__/integration
touch src/__tests__/integration/parser-validation.integration.test.ts
```

**Implementation**: See Week 2 Day 6 completion megathink for full code

**Run Tests**:
```bash
npm test -- src/__tests__/integration/parser-validation.integration.test.ts
```

**Expected**: 48+ tests passing

---

### Task 3.2: Database Integration Tests (1 hour)

**Create File**:
```bash
touch src/__tests__/integration/database-validation.integration.test.ts
```

**Implementation**: See Week 2 Day 6 completion megathink for full code

**Run Tests**:
```bash
npm test -- src/__tests__/integration/database-validation.integration.test.ts
```

**Expected**: 15+ tests passing

---

## Part 4: Feature Flags (1 hour)

### Task 4.1: ValidationConfig (20 minutes)

**Create File**:
```bash
mkdir -p src/config
touch src/config/ValidationConfig.ts
```

**Implementation**: See Week 2 Day 6 completion megathink for full code

---

### Task 4.2: ValidationMetrics (20 minutes)

**Create File**:
```bash
mkdir -p src/utils
touch src/utils/ValidationMetrics.ts
```

**Implementation**: See Week 2 Day 6 completion megathink for full code

---

### Task 4.3: Integrate with Parser (20 minutes)

**Modify**: `src/parser/LanguageParser.ts`

**Implementation**: See Week 2 Day 6 completion megathink for full code

---

## Final Verification

### Run All Tests

```bash
# Run all tests
npm test

# Expected output:
# Test Files  XX passed (XX)
#      Tests  260+ passed (260+)
#   Start at  XX:XX:XX
#   Duration  XXs

# Verify test count increased
# Before: 167/183 passing
# After: 260+ passing (adding 93+ new tests)
```

### Verify Schema Coverage

```bash
# Check test coverage
npm run test:coverage -- src/types/schemas/

# Expected: 100% coverage for parser.schema.ts and database.schema.ts
```

---

## Success Criteria

✅ **Parser Schema Tests**:
- 94 test cases
- 100% coverage
- All passing

✅ **Database Schema Tests**:
- 47 test cases
- 100% coverage
- All passing

✅ **Integration Tests**:
- 63 test cases
- Real workflows tested
- All passing

✅ **Feature Flags**:
- ValidationConfig implemented
- ValidationMetrics implemented
- Non-breaking integration

✅ **Total Impact**:
- 204 new test cases
- Test count: 167 → 371+ (122% increase)
- Validation coverage: 87.5% (7/8 boundaries)

---

## Timeline Summary

| Task | Duration | Tests |
|------|----------|-------|
| Parser Schema Tests | 1.5 hours | 94 tests |
| Database Schema Tests | 1.5 hours | 47 tests |
| Parser Integration | 1 hour | 48 tests |
| Database Integration | 1 hour | 15 tests |
| Feature Flags | 1 hour | Infrastructure |
| **Total** | **6 hours** | **204 tests** |

---

**Status**: 📋 **READY TO EXECUTE**
**Confidence**: **HIGH**
**Next Step**: Begin with Task 1.1 - Create Parser Schema Test File
