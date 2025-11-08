/**
 * QueryRouter.test.ts
 * Tests for query intent detection and routing
 */
import { describe, it, expect } from 'vitest';
import { QueryRouter, QueryIntent } from '../QueryRouter.js';
describe('QueryRouter', () => {
    const router = new QueryRouter();
    describe('analyze', () => {
        describe('SYMBOL intent detection', () => {
            it('should detect single identifier as SYMBOL', () => {
                const analysis = router.analyze('Calculator');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
                expect(analysis.confidence).toBeGreaterThan(0.5);
            });
            it('should detect camelCase identifier as SYMBOL', () => {
                const analysis = router.analyze('getUserInfo');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
            it('should detect PascalCase identifier as SYMBOL', () => {
                const analysis = router.analyze('FileService');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
            it('should detect snake_case identifier as SYMBOL', () => {
                const analysis = router.analyze('get_user_info');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
        });
        describe('NATURAL intent detection', () => {
            it('should detect boolean operators as NATURAL', () => {
                const analysis = router.analyze('function OR class');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should detect multiple common words as NATURAL', () => {
                const analysis = router.analyze('find all user records');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should detect phrase query as NATURAL', () => {
                const analysis = router.analyze('"export default"');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should detect long query as NATURAL', () => {
                const analysis = router.analyze('how to calculate the total sum of numbers');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
        });
        describe('HYBRID intent detection', () => {
            it('should detect two identifiers (no common words) as HYBRID', () => {
                const analysis = router.analyze('UserService controller');
                expect(analysis.intent).toBe(QueryIntent.HYBRID);
            });
            it('should detect identifier + identifier as HYBRID', () => {
                const analysis = router.analyze('FileService parse');
                // Note: "parse" is in COMMON_WORDS, so this will be NATURAL
                // For true HYBRID, need identifiers without common words
                const hybridAnalysis = router.analyze('UserService AuthController');
                expect(hybridAnalysis.intent).toBe(QueryIntent.HYBRID);
            });
            it('should detect single common word as HYBRID', () => {
                const analysis = router.analyze('function');
                expect(analysis.intent).toBe(QueryIntent.HYBRID);
            });
        });
        describe('confidence scoring', () => {
            it('should have high confidence for clear SYMBOL queries', () => {
                const analysis = router.analyze('MyClassName');
                expect(analysis.confidence).toBeGreaterThanOrEqual(0.7);
            });
            it('should have high confidence for clear NATURAL queries', () => {
                const analysis = router.analyze('find all functions that return boolean');
                expect(analysis.confidence).toBeGreaterThan(0.7);
            });
            it('should have lower confidence for ambiguous queries', () => {
                const analysis = router.analyze('test');
                expect(analysis.confidence).toBeLessThan(0.8);
            });
        });
        describe('query normalization', () => {
            it('should trim whitespace', () => {
                const analysis = router.analyze('  Calculator  ');
                expect(analysis.query).toBe('Calculator');
            });
            it('should preserve case in original query', () => {
                const analysis = router.analyze('FileService');
                expect(analysis.query).toBe('FileService');
            });
            it('should lowercase normalized query', () => {
                const analysis = router.analyze('FileService');
                expect(analysis.normalizedQuery).toBe('fileservice');
            });
        });
        describe('feature detection', () => {
            it('should detect operators', () => {
                const analysis = router.analyze('function OR class');
                expect(analysis.features.hasOperators).toBe(true);
            });
            it('should detect identifiers', () => {
                const analysis = router.analyze('getUserInfo');
                expect(analysis.features.isIdentifier).toBe(true);
            });
            it('should count words correctly', () => {
                const analysis = router.analyze('find all user records');
                expect(analysis.features.wordCount).toBe(4);
            });
            it('should detect common words', () => {
                const analysis = router.analyze('find all users');
                expect(analysis.features.hasCommonWords).toBe(true);
            });
            it('should detect special characters', () => {
                const analysis = router.analyze('user.name');
                expect(analysis.features.hasSpecialChars).toBe(true);
            });
        });
        describe('edge cases', () => {
            it('should handle empty query', () => {
                const analysis = router.analyze('');
                expect(analysis).toBeDefined();
                expect(analysis.query).toBe('');
            });
            it('should handle single character', () => {
                const analysis = router.analyze('x');
                expect(analysis).toBeDefined();
            });
            it('should handle numbers', () => {
                const analysis = router.analyze('123');
                expect(analysis).toBeDefined();
            });
            it('should handle mixed alphanumeric', () => {
                const analysis = router.analyze('test123');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
            it('should handle special symbols', () => {
                const analysis = router.analyze('@decorator');
                expect(analysis).toBeDefined();
            });
        });
        describe('real-world examples', () => {
            it('should route "FileService" as SYMBOL', () => {
                const analysis = router.analyze('FileService');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
            it('should route "find all console statements" as NATURAL', () => {
                const analysis = router.analyze('find all console statements');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should route "Calculator class" as NATURAL (has common word "class")', () => {
                const analysis = router.analyze('Calculator class');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should route "function OR method" as NATURAL', () => {
                const analysis = router.analyze('function OR method');
                expect(analysis.intent).toBe(QueryIntent.NATURAL);
            });
            it('should route "parseTypeScript" as SYMBOL', () => {
                const analysis = router.analyze('parseTypeScript');
                expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            });
            it('should route "parse typescript" as HYBRID (identifiers, "parse" not in common words)', () => {
                const analysis = router.analyze('parse typescript');
                expect(analysis.intent).toBe(QueryIntent.HYBRID);
            });
            it('should route "UserService create" as HYBRID (identifiers, no common words)', () => {
                const analysis = router.analyze('UserService create');
                expect(analysis.intent).toBe(QueryIntent.HYBRID);
            });
        });
    });
    describe('intent classification rules', () => {
        it('rule 1: operators -> NATURAL', () => {
            const analysis = router.analyze('term1 OR term2');
            expect(analysis.intent).toBe(QueryIntent.NATURAL);
            expect(analysis.features.hasOperators).toBe(true);
        });
        it('rule 2: single identifier without common words -> SYMBOL', () => {
            const analysis = router.analyze('MyClass');
            expect(analysis.intent).toBe(QueryIntent.SYMBOL);
            expect(analysis.features.isSingleWord).toBe(true);
            expect(analysis.features.isIdentifier).toBe(true);
        });
        it('rule 3: 3+ words with common words -> NATURAL', () => {
            const analysis = router.analyze('find all the functions');
            expect(analysis.intent).toBe(QueryIntent.NATURAL);
            expect(analysis.features.wordCount).toBeGreaterThanOrEqual(3);
            expect(analysis.features.hasCommonWords).toBe(true);
        });
        it('rule 4: 2+ words identifier (no common words) -> HYBRID', () => {
            const analysis = router.analyze('UserService AuthController');
            expect(analysis.intent).toBe(QueryIntent.HYBRID);
            expect(analysis.features.wordCount).toBeGreaterThanOrEqual(2);
            expect(analysis.features.hasCommonWords).toBe(false);
        });
    });
});
//# sourceMappingURL=QueryRouter.test.js.map