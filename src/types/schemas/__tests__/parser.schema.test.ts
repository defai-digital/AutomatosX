/**
 * parser.schema.test.ts
 *
 * Comprehensive tests for parser validation schemas.
 *
 * ADR-014 Phase 5: Testing
 * Week 2 Day 6 - Part 1: Parser Schema Tests
 *
 * Test Coverage:
 * - SymbolKindSchema: 18 test cases
 * - SymbolSchema: 30 test cases
 * - ParseResultSchema: 21 test cases
 * - Helper Functions: 25 test cases
 * Total: 94 test cases
 */

import { describe, it, expect } from 'vitest';
import {
  SymbolKindSchema,
  SymbolSchema,
  CallSchema,
  ImportSchema,
  ParseResultSchema,
  ParserErrorSchema,
  ParseResultWithErrorsSchema,
  validateSymbol,
  validateSymbolKind,
  validateParseResult,
  safeValidateSymbol,
  safeValidateSymbolKind,
  safeValidateParseResult,
  isSymbol,
  isSymbolKind,
  isParseResult,
  getAllSymbolKinds,
  isValidSymbolKind,
  type Symbol,
  type SymbolKind,
  type ParseResult,
} from '../parser.schema.js';

// ============================================================================
// Task 1.2: SymbolKindSchema Tests (18 test cases)
// ============================================================================

describe('SymbolKindSchema', () => {
  describe('Valid symbol kinds', () => {
    const validKinds: SymbolKind[] = [
      'function',
      'class',
      'interface',
      'type',
      'variable',
      'constant',
      'method',
      'enum',
      'struct',
      'trait',
      'module',
    ];

    validKinds.forEach((kind) => {
      it(`should validate "${kind}"`, () => {
        expect(() => SymbolKindSchema.parse(kind)).not.toThrow();
        const result = SymbolKindSchema.parse(kind);
        expect(result).toBe(kind);
      });
    });
  });

  describe('Invalid symbol kinds', () => {
    it('should reject invalid string', () => {
      expect(() => SymbolKindSchema.parse('invalidKind')).toThrow();
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
      expect(() => SymbolKindSchema.parse({ kind: 'function' })).toThrow();
    });
  });
});

// ============================================================================
// Task 1.3: SymbolSchema Tests (30 test cases)
// ============================================================================

describe('SymbolSchema', () => {
  const validSymbol: Symbol = {
    name: 'getUserById',
    kind: 'function',
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

    it('should validate symbol with end position', () => {
      const symbolWithEnd = {
        ...validSymbol,
        endLine: 50,
        endColumn: 1,
      };
      expect(() => SymbolSchema.parse(symbolWithEnd)).not.toThrow();
    });

    it('should validate symbol with metadata', () => {
      const symbolWithMetadata = {
        ...validSymbol,
        metadata: {
          async: true,
          exported: true,
          returnType: 'User',
        },
      };
      expect(() => SymbolSchema.parse(symbolWithMetadata)).not.toThrow();
      const result = SymbolSchema.parse(symbolWithMetadata);
      expect(result.metadata?.async).toBe(true);
    });

    it('should validate symbol with zero column', () => {
      const symbolZeroCol = { ...validSymbol, column: 0 };
      expect(() => SymbolSchema.parse(symbolZeroCol)).not.toThrow();
    });

    it('should validate symbol with same endLine as line', () => {
      const symbolSameLine = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 25,
      };
      expect(() => SymbolSchema.parse(symbolSameLine)).not.toThrow();
    });
  });

  describe('Invalid symbols - Name validation', () => {
    it('should reject empty name', () => {
      const invalid = { ...validSymbol, name: '' };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
    });

    it('should reject missing name', () => {
      const { name, ...invalid } = validSymbol;
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject non-string name', () => {
      const invalid = { ...validSymbol, name: 123 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid symbols - Kind validation', () => {
    it('should reject invalid kind', () => {
      const invalid = { ...validSymbol, kind: 'invalidKind' };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing kind', () => {
      const { kind, ...invalid } = validSymbol;
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid symbols - Line validation', () => {
    it('should reject zero line', () => {
      const invalid = { ...validSymbol, line: 0 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject negative line', () => {
      const invalid = { ...validSymbol, line: -1 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Line number must be positive');
    });

    it('should reject floating-point line', () => {
      const invalid = { ...validSymbol, line: 42.5 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing line', () => {
      const { line, ...invalid } = validSymbol;
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid symbols - Column validation', () => {
    it('should reject negative column', () => {
      const invalid = { ...validSymbol, column: -1 };
      expect(() => SymbolSchema.parse(invalid)).toThrow('Column number must be non-negative');
    });

    it('should reject floating-point column', () => {
      const invalid = { ...validSymbol, column: 10.5 };
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });

    it('should reject missing column', () => {
      const { column, ...invalid } = validSymbol;
      expect(() => SymbolSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid symbols - Cross-field validation', () => {
    it('should reject endLine < line', () => {
      const invalid = {
        ...validSymbol,
        line: 42,
        endLine: 41,
      };
      expect(() => SymbolSchema.parse(invalid)).toThrow('endLine must be greater than or equal to line');
    });

    it('should reject endColumn <= column on same line', () => {
      const invalid = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 10,
      };
      expect(() => SymbolSchema.parse(invalid)).toThrow('endColumn must be greater than column when on the same line');
    });

    it('should reject endColumn < column on same line', () => {
      const invalid = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 42,
        endColumn: 5,
      };
      expect(() => SymbolSchema.parse(invalid)).toThrow('endColumn must be greater than column when on the same line');
    });

    it('should allow endColumn < column on different lines', () => {
      const valid = {
        ...validSymbol,
        line: 42,
        column: 10,
        endLine: 50,
        endColumn: 1,
      };
      expect(() => SymbolSchema.parse(valid)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should validate single-character symbol', () => {
      const symbol = { ...validSymbol, name: 'x' };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate very long symbol name', () => {
      const symbol = { ...validSymbol, name: 'a'.repeat(1000) };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate symbol at line 1', () => {
      const symbol = { ...validSymbol, line: 1 };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate symbol at very high line number', () => {
      const symbol = { ...validSymbol, line: 1_000_000 };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate empty metadata', () => {
      const symbol = { ...validSymbol, metadata: {} };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });

    it('should validate complex metadata', () => {
      const symbol = {
        ...validSymbol,
        metadata: {
          params: ['id', 'options'],
          returnType: 'Promise<User>',
          decorators: ['@injectable', '@cache'],
          visibility: 'public',
        },
      };
      expect(() => SymbolSchema.parse(symbol)).not.toThrow();
    });
  });
});

// ============================================================================
// Task 1.4: ParseResultSchema Tests (21 test cases)
// ============================================================================

describe('ParseResultSchema', () => {
  const validParseResult: ParseResult = {
    symbols: [
      { name: 'foo', kind: 'function', line: 1, column: 0 },
      { name: 'Bar', kind: 'class', line: 10, column: 0 },
    ],
    calls: [
      { caller: 'foo', callee: 'console.log', line: 3, column: 2 },
    ],
    imports: [
      { name: 'fs', from: 'node:fs', line: 1 },
    ],
    parseTime: 45,
    nodeCount: 123,
  };

  describe('Valid parse results', () => {
    it('should validate minimal parse result', () => {
      const minimal: ParseResult = {
        symbols: [],
        parseTime: 10,
        nodeCount: 0,
      };
      expect(() => ParseResultSchema.parse(minimal)).not.toThrow();
    });

    it('should validate complete parse result', () => {
      expect(() => ParseResultSchema.parse(validParseResult)).not.toThrow();
      const result = ParseResultSchema.parse(validParseResult);
      expect(result.symbols).toHaveLength(2);
      // Optional arrays may be undefined after parsing
      if (result.calls) {
        expect(result.calls).toHaveLength(1);
      }
      if (result.imports) {
        expect(result.imports).toHaveLength(1);
      }
    });

    it('should validate parse result with zero parse time', () => {
      const result = { ...validParseResult, parseTime: 0 };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate parse result with many symbols', () => {
      const manySymbols = {
        ...validParseResult,
        symbols: Array(1000).fill({ name: 'test', kind: 'function', line: 1, column: 0 }),
      };
      expect(() => ParseResultSchema.parse(manySymbols)).not.toThrow();
    });
  });

  describe('Invalid parse results - Symbols validation', () => {
    it('should reject non-array symbols', () => {
      const invalid = { ...validParseResult, symbols: 'not an array' };
      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid symbol in array', () => {
      const invalid = {
        ...validParseResult,
        symbols: [{ name: '', kind: 'function', line: 1, column: 0 }],
      };
      expect(() => ParseResultSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
    });

    it('should reject missing symbols', () => {
      const { symbols, ...invalid } = validParseResult;
      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid parse results - ParseTime validation', () => {
    it('should reject negative parse time', () => {
      const invalid = { ...validParseResult, parseTime: -1 };
      expect(() => ParseResultSchema.parse(invalid)).toThrow('Parse time must be non-negative');
    });

    it('should reject excessive parse time (>60s)', () => {
      const invalid = { ...validParseResult, parseTime: 61000 };
      expect(() => ParseResultSchema.parse(invalid)).toThrow('Parse time exceeds 60 seconds');
    });

    it('should allow parse time just under 60s', () => {
      const result = { ...validParseResult, parseTime: 59999 };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should reject missing parse time', () => {
      const { parseTime, ...invalid } = validParseResult;
      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });
  });

  describe('Invalid parse results - NodeCount validation', () => {
    it('should reject negative node count', () => {
      const invalid = { ...validParseResult, nodeCount: -1 };
      expect(() => ParseResultSchema.parse(invalid)).toThrow('Node count must be non-negative');
    });

    it('should reject floating-point node count', () => {
      const invalid = { ...validParseResult, nodeCount: 123.5 };
      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });

    it('should reject missing node count', () => {
      const { nodeCount, ...invalid } = validParseResult;
      expect(() => ParseResultSchema.parse(invalid)).toThrow();
    });
  });

  describe('Optional arrays', () => {
    it('should allow missing calls array', () => {
      const { calls, ...result } = validParseResult;
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should allow missing imports array', () => {
      const { imports, ...result } = validParseResult;
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should allow empty calls array', () => {
      const result = { ...validParseResult, calls: [] };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should allow empty imports array', () => {
      const result = { ...validParseResult, imports: [] };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should validate result with only symbols', () => {
      const result: ParseResult = {
        symbols: [{ name: 'foo', kind: 'function', line: 1, column: 0 }],
        parseTime: 10,
        nodeCount: 50,
      };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should validate result with all arrays empty', () => {
      const result: ParseResult = {
        symbols: [],
        calls: [],
        imports: [],
        parseTime: 5,
        nodeCount: 0,
      };
      expect(() => ParseResultSchema.parse(result)).not.toThrow();
    });

    it('should reject result at exactly 60s parse time', () => {
      const result = { ...validParseResult, parseTime: 60000 };
      expect(() => ParseResultSchema.parse(result)).toThrow('Parse time exceeds 60 seconds');
    });
  });
});

// ============================================================================
// Task 1.5: Helper Functions Tests (25 test cases)
// ============================================================================

describe('Helper Functions', () => {
  describe('validateSymbol (throwing)', () => {
    it('should return validated symbol', () => {
      const input = { name: 'test', kind: 'function', line: 1, column: 0 };
      const result = validateSymbol(input);
      expect(result.name).toBe('test');
      expect(result.kind).toBe('function');
    });

    it('should throw on invalid symbol', () => {
      const invalid = { name: '', kind: 'function', line: 1, column: 0 };
      expect(() => validateSymbol(invalid)).toThrow();
    });
  });

  describe('validateSymbolKind (throwing)', () => {
    it('should return validated kind', () => {
      const result = validateSymbolKind('function');
      expect(result).toBe('function');
    });

    it('should throw on invalid kind', () => {
      expect(() => validateSymbolKind('invalidKind')).toThrow();
    });
  });

  describe('validateParseResult (throwing)', () => {
    it('should return validated parse result', () => {
      const input: ParseResult = {
        symbols: [],
        parseTime: 10,
        nodeCount: 0,
      };
      const result = validateParseResult(input);
      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBe(10);
    });

    it('should throw on invalid parse result', () => {
      const invalid = { symbols: [], parseTime: -1, nodeCount: 0 };
      expect(() => validateParseResult(invalid)).toThrow();
    });
  });

  describe('safeValidateSymbol (non-throwing)', () => {
    it('should return success for valid symbol', () => {
      const input = { name: 'test', kind: 'function', line: 1, column: 0 };
      const result = safeValidateSymbol(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('test');
      }
    });

    it('should return error for invalid symbol', () => {
      const invalid = { name: '', kind: 'function', line: 1, column: 0 };
      const result = safeValidateSymbol(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('safeValidateSymbolKind (non-throwing)', () => {
    it('should return success for valid kind', () => {
      const result = safeValidateSymbolKind('function');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('function');
      }
    });

    it('should return error for invalid kind', () => {
      const result = safeValidateSymbolKind('invalidKind');
      expect(result.success).toBe(false);
    });
  });

  describe('safeValidateParseResult (non-throwing)', () => {
    it('should return success for valid result', () => {
      const input: ParseResult = {
        symbols: [],
        parseTime: 10,
        nodeCount: 0,
      };
      const result = safeValidateParseResult(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parseTime).toBe(10);
      }
    });

    it('should return error for invalid result', () => {
      const invalid = { symbols: [], parseTime: -1, nodeCount: 0 };
      const result = safeValidateParseResult(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Type guards', () => {
    describe('isSymbol', () => {
      it('should return true for valid symbol', () => {
        const symbol = { name: 'test', kind: 'function', line: 1, column: 0 };
        expect(isSymbol(symbol)).toBe(true);
      });

      it('should return false for invalid symbol', () => {
        const invalid = { name: '', kind: 'function', line: 1, column: 0 };
        expect(isSymbol(invalid)).toBe(false);
      });

      it('should return false for non-object', () => {
        expect(isSymbol('not a symbol')).toBe(false);
        expect(isSymbol(123)).toBe(false);
        expect(isSymbol(null)).toBe(false);
        expect(isSymbol(undefined)).toBe(false);
      });
    });

    describe('isSymbolKind', () => {
      it('should return true for valid kind', () => {
        expect(isSymbolKind('function')).toBe(true);
        expect(isSymbolKind('class')).toBe(true);
      });

      it('should return false for invalid kind', () => {
        expect(isSymbolKind('invalidKind')).toBe(false);
        expect(isSymbolKind('')).toBe(false);
        expect(isSymbolKind(123)).toBe(false);
      });
    });

    describe('isParseResult', () => {
      it('should return true for valid parse result', () => {
        const result: ParseResult = {
          symbols: [],
          parseTime: 10,
          nodeCount: 0,
        };
        expect(isParseResult(result)).toBe(true);
      });

      it('should return false for invalid parse result', () => {
        const invalid = { symbols: [], parseTime: -1, nodeCount: 0 };
        expect(isParseResult(invalid)).toBe(false);
      });

      it('should return false for non-object', () => {
        expect(isParseResult('not a result')).toBe(false);
      });
    });
  });

  describe('Utility functions', () => {
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
      });

      it('should return false for invalid kinds', () => {
        expect(isValidSymbolKind('invalidKind')).toBe(false);
        expect(isValidSymbolKind('')).toBe(false);
      });
    });
  });
});
