/**
 * QueryFilterParser.test.ts
 *
 * Comprehensive tests for query filter parsing
 */
import { describe, it, expect } from 'vitest';
import { QueryFilterParser } from '../QueryFilterParser.js';
describe('QueryFilterParser', () => {
    const parser = new QueryFilterParser();
    describe('Basic Filter Extraction', () => {
        it('should extract language filter', () => {
            const result = parser.parse('find auth lang:python');
            expect(result.searchTerms).toBe('find auth');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.kinds).toEqual([]);
            expect(result.filters.filePatterns).toEqual([]);
        });
        it('should extract kind filter', () => {
            const result = parser.parse('search error kind:function');
            expect(result.searchTerms).toBe('search error');
            expect(result.filters.kinds).toEqual(['function']);
            expect(result.filters.languages).toEqual([]);
        });
        it('should extract file filter', () => {
            const result = parser.parse('api file:src/services/*.ts');
            expect(result.searchTerms).toBe('api');
            expect(result.filters.filePatterns).toEqual(['src/services/*.ts']);
        });
        it('should extract multiple filters of same type', () => {
            const result = parser.parse('find lang:python lang:typescript');
            expect(result.filters.languages).toContain('python');
            expect(result.filters.languages).toContain('typescript');
            expect(result.filters.languages).toHaveLength(2);
        });
    });
    describe('Negation Filters', () => {
        it('should extract negated language filter', () => {
            const result = parser.parse('search code -lang:test');
            expect(result.searchTerms).toBe('search code');
            expect(result.filters.excludeLanguages).toEqual(['test']);
            expect(result.filters.languages).toEqual([]);
        });
        it('should extract negated kind filter', () => {
            const result = parser.parse('find functions -kind:method');
            expect(result.searchTerms).toBe('find functions');
            expect(result.filters.excludeKinds).toEqual(['method']);
        });
        it('should extract negated file filter', () => {
            const result = parser.parse('search -file:**/*.test.ts');
            expect(result.searchTerms).toBe('search');
            expect(result.filters.excludeFiles).toEqual(['**/*.test.ts']);
        });
        it('should handle mix of positive and negative filters', () => {
            const result = parser.parse('auth lang:python -lang:javascript');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.excludeLanguages).toEqual(['javascript']);
        });
    });
    describe('Multiple Filters', () => {
        it('should extract multiple different filter types', () => {
            const result = parser.parse('find auth lang:python kind:function file:src/**/*.py');
            expect(result.searchTerms).toBe('find auth');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.kinds).toEqual(['function']);
            expect(result.filters.filePatterns).toEqual(['src/**/*.py']);
        });
        it('should extract complex query with negations', () => {
            const result = parser.parse('api endpoints lang:typescript -kind:test -file:**/*.spec.ts');
            expect(result.searchTerms).toBe('api endpoints');
            expect(result.filters.languages).toEqual(['typescript']);
            expect(result.filters.excludeKinds).toEqual(['test']);
            expect(result.filters.excludeFiles).toEqual(['**/*.spec.ts']);
        });
        it('should handle filters at different positions in query', () => {
            const result = parser.parse('lang:python find auth kind:function in services file:src/*.py');
            expect(result.searchTerms).toBe('find auth in services');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.kinds).toEqual(['function']);
            expect(result.filters.filePatterns).toEqual(['src/*.py']);
        });
    });
    describe('Edge Cases', () => {
        it('should handle query with no filters', () => {
            const result = parser.parse('just a regular search query');
            expect(result.searchTerms).toBe('just a regular search query');
            expect(result.filters.languages).toEqual([]);
            expect(result.filters.kinds).toEqual([]);
            expect(result.filters.filePatterns).toEqual([]);
        });
        it('should handle query with only filters (no search terms)', () => {
            const result = parser.parse('lang:python kind:function');
            expect(result.searchTerms).toBe('');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.kinds).toEqual(['function']);
        });
        it('should handle empty query', () => {
            const result = parser.parse('');
            expect(result.searchTerms).toBe('');
            expect(result.filters.languages).toEqual([]);
        });
        it('should handle query with extra whitespace', () => {
            const result = parser.parse('find   auth   lang:python   kind:function');
            expect(result.searchTerms).toBe('find auth');
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.kinds).toEqual(['function']);
        });
        it('should ignore invalid language values', () => {
            const result = parser.parse('search lang:invalid lang:python');
            // Invalid languages are silently ignored
            expect(result.filters.languages).toEqual(['python']);
            expect(result.filters.languages).not.toContain('invalid');
        });
        it('should ignore invalid kind values', () => {
            const result = parser.parse('search kind:notakind kind:function');
            expect(result.filters.kinds).toEqual(['function']);
            expect(result.filters.kinds).not.toContain('notakind');
        });
    });
    describe('File Pattern Filtering', () => {
        it('should support glob patterns', () => {
            const result = parser.parse('file:src/**/*.ts');
            expect(result.filters.filePatterns).toEqual(['src/**/*.ts']);
        });
        it('should support exact file paths', () => {
            const result = parser.parse('file:src/services/FileService.ts');
            expect(result.filters.filePatterns).toEqual([
                'src/services/FileService.ts',
            ]);
        });
        it('should support wildcard in filenames', () => {
            const result = parser.parse('file:*.test.ts');
            expect(result.filters.filePatterns).toEqual(['*.test.ts']);
        });
        it('should support paths with hyphens', () => {
            const result = parser.parse('file:src/my-service/index.ts');
            expect(result.filters.filePatterns).toEqual(['src/my-service/index.ts']);
        });
    });
    describe('Valid Values', () => {
        it('should recognize all valid languages', () => {
            const languages = ['typescript', 'javascript', 'python', 'go', 'rust'];
            for (const lang of languages) {
                const result = parser.parse(`lang:${lang}`);
                expect(result.filters.languages).toContain(lang);
            }
        });
        it('should recognize all valid symbol kinds', () => {
            const kinds = [
                'function',
                'class',
                'method',
                'interface',
                'type',
                'variable',
                'constant',
                'enum',
                'struct',
                'trait',
                'impl',
                'module',
            ];
            for (const kind of kinds) {
                const result = parser.parse(`kind:${kind}`);
                expect(result.filters.kinds).toContain(kind);
            }
        });
    });
    describe('originalQuery preservation', () => {
        it('should preserve original query', () => {
            const query = 'find auth lang:python kind:function';
            const result = parser.parse(query);
            expect(result.originalQuery).toBe(query);
        });
    });
    describe('Static Helper Methods', () => {
        it('should return valid languages', () => {
            const languages = QueryFilterParser.getValidLanguages();
            expect(languages).toContain('typescript');
            expect(languages).toContain('python');
            expect(languages).toContain('go');
            expect(languages.length).toBeGreaterThan(0);
        });
        it('should return valid kinds', () => {
            const kinds = QueryFilterParser.getValidKinds();
            expect(kinds).toContain('function');
            expect(kinds).toContain('class');
            expect(kinds).toContain('method');
            expect(kinds.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=QueryFilterParser.test.js.map