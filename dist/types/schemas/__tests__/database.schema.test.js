/**
 * database.schema.test.ts
 *
 * Comprehensive tests for database DAO validation schemas.
 *
 * ADR-014 Phase 5: Testing
 * Week 2 Day 6 - Part 2: Database Schema Tests
 *
 * Test Coverage:
 * - FileInputSchema: 10 test cases
 * - FileUpdateSchema: 7 test cases
 * - SymbolInputSchema: 20 test cases
 * - BatchValidation: 10 test cases
 * Total: 47 test cases
 */
import { describe, it, expect } from 'vitest';
import { FileInputSchema, FileUpdateSchema, SymbolInputSchema, validateFileInputBatch, validateSymbolInputBatch, validateChunkInputBatch, } from '../database.schema.js';
// ============================================================================
// FileInputSchema Tests (10 test cases)
// ============================================================================
describe('FileInputSchema', () => {
    const validFileInput = {
        path: '/src/services/UserService.ts',
        content: 'export class UserService { }',
        language: 'typescript',
    };
    describe('Valid file inputs', () => {
        it('should validate minimal valid file input', () => {
            const minimal = {
                path: '/test.ts',
                content: 'const x = 1;',
            };
            expect(() => FileInputSchema.parse(minimal)).not.toThrow();
        });
        it('should validate file input with language', () => {
            expect(() => FileInputSchema.parse(validFileInput)).not.toThrow();
            const result = FileInputSchema.parse(validFileInput);
            expect(result.path).toBe('/src/services/UserService.ts');
            expect(result.language).toBe('typescript');
        });
        it('should validate file with empty content', () => {
            const empty = { ...validFileInput, content: '' };
            expect(() => FileInputSchema.parse(empty)).not.toThrow();
        });
        it('should validate file with large content (< 10MB)', () => {
            const largeContent = 'a'.repeat(9_999_999); // Just under 10MB
            const large = { ...validFileInput, content: largeContent };
            expect(() => FileInputSchema.parse(large)).not.toThrow();
        });
    });
    describe('Invalid file inputs', () => {
        it('should reject empty path', () => {
            const invalid = { ...validFileInput, path: '' };
            expect(() => FileInputSchema.parse(invalid)).toThrow('File path cannot be empty');
        });
        it('should reject missing path', () => {
            const { path, ...invalid } = validFileInput;
            expect(() => FileInputSchema.parse(invalid)).toThrow();
        });
        it('should reject missing content', () => {
            const { content, ...invalid } = validFileInput;
            expect(() => FileInputSchema.parse(invalid)).toThrow();
        });
        it('should reject content exceeding 10MB', () => {
            const hugeContent = 'a'.repeat(10_000_001); // Over 10MB
            const invalid = { ...validFileInput, content: hugeContent };
            expect(() => FileInputSchema.parse(invalid)).toThrow('File content exceeds 10MB limit');
        });
        it('should reject non-string path', () => {
            const invalid = { ...validFileInput, path: 123 };
            expect(() => FileInputSchema.parse(invalid)).toThrow();
        });
        it('should reject non-string content', () => {
            const invalid = { ...validFileInput, content: { text: 'code' } };
            expect(() => FileInputSchema.parse(invalid)).toThrow();
        });
    });
});
// ============================================================================
// FileUpdateSchema Tests (7 test cases)
// ============================================================================
describe('FileUpdateSchema', () => {
    describe('Valid file updates', () => {
        it('should validate content-only update', () => {
            const update = {
                content: 'export class UpdatedService { }',
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
                language: 'typescript',
            };
            expect(() => FileUpdateSchema.parse(update)).not.toThrow();
        });
        it('should validate empty content update', () => {
            const update = {
                content: '',
            };
            expect(() => FileUpdateSchema.parse(update)).not.toThrow();
        });
    });
    describe('Invalid file updates', () => {
        it('should reject empty update object', () => {
            const invalid = {};
            expect(() => FileUpdateSchema.parse(invalid)).toThrow('At least one field must be provided for update');
        });
        it('should reject content exceeding 10MB', () => {
            const invalid = {
                content: 'a'.repeat(10_000_001),
            };
            expect(() => FileUpdateSchema.parse(invalid)).toThrow('File content exceeds 10MB limit');
        });
        it('should reject non-string content', () => {
            const invalid = {
                content: 123,
            };
            expect(() => FileUpdateSchema.parse(invalid)).toThrow();
        });
    });
});
// ============================================================================
// SymbolInputSchema Tests (20 test cases)
// ============================================================================
describe('SymbolInputSchema', () => {
    const validSymbolInput = {
        file_id: 42,
        name: 'getUserById',
        kind: 'function',
        line: 10,
        column: 2,
    };
    describe('Valid symbol inputs', () => {
        it('should validate minimal symbol input', () => {
            expect(() => SymbolInputSchema.parse(validSymbolInput)).not.toThrow();
            const result = SymbolInputSchema.parse(validSymbolInput);
            expect(result.file_id).toBe(42);
            expect(result.name).toBe('getUserById');
        });
        it('should validate symbol with end position', () => {
            const withEnd = {
                ...validSymbolInput,
                end_line: 15,
                end_column: 1,
            };
            expect(() => SymbolInputSchema.parse(withEnd)).not.toThrow();
        });
        it('should validate symbol with same end_line as line', () => {
            const sameLine = {
                ...validSymbolInput,
                line: 10,
                column: 2,
                end_line: 10,
                end_column: 20,
            };
            expect(() => SymbolInputSchema.parse(sameLine)).not.toThrow();
        });
        it('should validate column 0', () => {
            const zeroCol = { ...validSymbolInput, column: 0 };
            expect(() => SymbolInputSchema.parse(zeroCol)).not.toThrow();
        });
        it('should validate all symbol kinds', () => {
            const kinds = ['function', 'class', 'interface', 'type', 'variable', 'constant', 'method', 'enum', 'struct', 'trait', 'module'];
            kinds.forEach((kind) => {
                const symbol = { ...validSymbolInput, kind };
                expect(() => SymbolInputSchema.parse(symbol)).not.toThrow();
            });
        });
    });
    describe('Invalid symbol inputs - Basic validation', () => {
        it('should reject zero file_id', () => {
            const invalid = { ...validSymbolInput, file_id: 0 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('file_id must be a positive integer');
        });
        it('should reject negative file_id', () => {
            const invalid = { ...validSymbolInput, file_id: -1 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('file_id must be a positive integer');
        });
        it('should reject floating-point file_id', () => {
            const invalid = { ...validSymbolInput, file_id: 42.5 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow();
        });
        it('should reject empty name', () => {
            const invalid = { ...validSymbolInput, name: '' };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
        });
        it('should reject invalid kind', () => {
            const invalid = { ...validSymbolInput, kind: 'invalidKind' };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow();
        });
        it('should reject zero line', () => {
            const invalid = { ...validSymbolInput, line: 0 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('Line number must be positive');
        });
        it('should reject negative line', () => {
            const invalid = { ...validSymbolInput, line: -1 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('Line number must be positive');
        });
        it('should reject negative column', () => {
            const invalid = { ...validSymbolInput, column: -1 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('Column number must be non-negative');
        });
        it('should reject floating-point line', () => {
            const invalid = { ...validSymbolInput, line: 10.5 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow();
        });
        it('should reject floating-point column', () => {
            const invalid = { ...validSymbolInput, column: 2.5 };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow();
        });
    });
    describe('Invalid symbol inputs - Cross-field validation', () => {
        it('should reject end_line < line', () => {
            const invalid = {
                ...validSymbolInput,
                line: 10,
                end_line: 9,
            };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('end_line must be greater than or equal to line');
        });
        it('should reject end_column <= column on same line', () => {
            const invalid = {
                ...validSymbolInput,
                line: 10,
                column: 2,
                end_line: 10,
                end_column: 2,
            };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('end_column must be greater than column when on the same line');
        });
        it('should reject end_column < column on same line', () => {
            const invalid = {
                ...validSymbolInput,
                line: 10,
                column: 10,
                end_line: 10,
                end_column: 5,
            };
            expect(() => SymbolInputSchema.parse(invalid)).toThrow('end_column must be greater than column when on the same line');
        });
        it('should allow end_column < column on different lines', () => {
            const valid = {
                ...validSymbolInput,
                line: 10,
                column: 10,
                end_line: 15,
                end_column: 1,
            };
            expect(() => SymbolInputSchema.parse(valid)).not.toThrow();
        });
    });
});
// ============================================================================
// Batch Validation Tests (10 test cases)
// ============================================================================
describe('Batch Validation', () => {
    describe('validateFileInputBatch', () => {
        it('should validate all valid file inputs', () => {
            const inputs = [
                { path: '/file1.ts', content: 'code1' },
                { path: '/file2.ts', content: 'code2' },
                { path: '/file3.ts', content: 'code3' },
            ];
            const result = validateFileInputBatch(inputs);
            expect(result.validated).toHaveLength(3);
            expect(result.errors).toHaveLength(0);
        });
        it('should collect errors for invalid file inputs', () => {
            const inputs = [
                { path: '/file1.ts', content: 'code1' }, // Valid
                { path: '', content: 'code2' }, // Invalid: empty path
                { path: '/file3.ts', content: 'code3' }, // Valid
                { path: '/file4.ts' }, // Invalid: missing content
            ];
            const result = validateFileInputBatch(inputs);
            expect(result.validated).toHaveLength(2);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].index).toBe(1);
            expect(result.errors[1].index).toBe(3);
        });
        it('should handle empty input array', () => {
            const result = validateFileInputBatch([]);
            expect(result.validated).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('validateSymbolInputBatch', () => {
        it('should validate all valid symbol inputs', () => {
            const inputs = [
                { file_id: 1, name: 'foo', kind: 'function', line: 1, column: 0 },
                { file_id: 2, name: 'Bar', kind: 'class', line: 10, column: 0 },
                { file_id: 3, name: 'baz', kind: 'variable', line: 5, column: 2 },
            ];
            const result = validateSymbolInputBatch(inputs);
            expect(result.validated).toHaveLength(3);
            expect(result.errors).toHaveLength(0);
        });
        it('should collect errors for invalid symbol inputs', () => {
            const inputs = [
                { file_id: 1, name: 'foo', kind: 'function', line: 1, column: 0 }, // Valid
                { file_id: 0, name: 'bar', kind: 'class', line: 10, column: 0 }, // Invalid: zero file_id
                { file_id: 3, name: '', kind: 'variable', line: 5, column: 2 }, // Invalid: empty name
            ];
            const result = validateSymbolInputBatch(inputs);
            expect(result.validated).toHaveLength(1);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].index).toBe(1);
            expect(result.errors[1].index).toBe(2);
        });
        it('should handle empty input array', () => {
            const result = validateSymbolInputBatch([]);
            expect(result.validated).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('validateChunkInputBatch', () => {
        it('should validate all valid chunk inputs', () => {
            const inputs = [
                { file_id: 1, text: 'chunk1', start_line: 1, end_line: 10 },
                { file_id: 2, text: 'chunk2', start_line: 11, end_line: 20 },
            ];
            const result = validateChunkInputBatch(inputs);
            expect(result.validated).toHaveLength(2);
            expect(result.errors).toHaveLength(0);
        });
        it('should collect errors for invalid chunk inputs', () => {
            const inputs = [
                { file_id: 1, text: 'chunk1', start_line: 1, end_line: 10 }, // Valid
                { file_id: 2, text: 'chunk2', start_line: 10, end_line: 5 }, // Invalid: end_line < start_line
            ];
            const result = validateChunkInputBatch(inputs);
            expect(result.validated).toHaveLength(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].index).toBe(1);
        });
        it('should handle empty input array', () => {
            const result = validateChunkInputBatch([]);
            expect(result.validated).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('Performance characteristics', () => {
        it('should handle large batches efficiently', () => {
            const inputs = Array(1000).fill(null).map((_, i) => ({
                file_id: i + 1,
                name: `symbol${i}`,
                kind: 'function',
                line: i + 1,
                column: 0,
            }));
            const startTime = performance.now();
            const result = validateSymbolInputBatch(inputs);
            const endTime = performance.now();
            const duration = endTime - startTime;
            expect(result.validated).toHaveLength(1000);
            expect(result.errors).toHaveLength(0);
            expect(duration).toBeLessThan(100); // Should complete in <100ms
        });
    });
});
//# sourceMappingURL=database.schema.test.js.map