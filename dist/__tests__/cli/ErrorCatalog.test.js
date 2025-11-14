/**
 * Error Catalog Tests
 * Sprint 6 Day 56: Error catalog tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorCatalog, ErrorSeverity, ErrorCategory, createCatalogError, } from '../../cli/ErrorCatalog.js';
describe('ErrorCatalog', () => {
    describe('Error Retrieval', () => {
        it('should get error by code', () => {
            const error = ErrorCatalog.getError('DB-001');
            expect(error).toBeDefined();
            expect(error?.code).toBe('DB-001');
            expect(error?.message).toContain('Database');
        });
        it('should return undefined for non-existent code', () => {
            const error = ErrorCatalog.getError('INVALID-999');
            expect(error).toBeUndefined();
        });
        it('should get all errors', () => {
            const allErrors = ErrorCatalog.getAllErrors();
            expect(allErrors.length).toBeGreaterThan(0);
            expect(allErrors.every((e) => e.code && e.message)).toBe(true);
        });
        it('should check if error exists', () => {
            expect(ErrorCatalog.hasError('DB-001')).toBe(true);
            expect(ErrorCatalog.hasError('INVALID-999')).toBe(false);
        });
        it('should get error count', () => {
            const count = ErrorCatalog.getErrorCount();
            expect(count).toBeGreaterThan(20);
        });
        it('should get all error codes', () => {
            const codes = ErrorCatalog.getAllErrorCodes();
            expect(codes).toContain('DB-001');
            expect(codes).toContain('FS-001');
            expect(codes).toContain('PLG-001');
        });
    });
    describe('Error Filtering', () => {
        it('should get errors by category', () => {
            const dbErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.DATABASE);
            expect(dbErrors.length).toBeGreaterThan(0);
            expect(dbErrors.every((e) => e.category === ErrorCategory.DATABASE)).toBe(true);
        });
        it('should get errors by severity', () => {
            const criticalErrors = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.CRITICAL);
            expect(criticalErrors.length).toBeGreaterThan(0);
            expect(criticalErrors.every((e) => e.severity === ErrorSeverity.CRITICAL)).toBe(true);
        });
        it('should filter file system errors', () => {
            const fsErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.FILE_SYSTEM);
            expect(fsErrors.length).toBeGreaterThan(0);
            expect(fsErrors.some((e) => e.code === 'FS-001')).toBe(true);
        });
        it('should filter error severity errors', () => {
            const errorSeverity = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.ERROR);
            expect(errorSeverity.length).toBeGreaterThan(0);
        });
        it('should filter warning severity errors', () => {
            const warnings = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.WARNING);
            expect(warnings.length).toBeGreaterThan(0);
        });
    });
    describe('Error Formatting', () => {
        it('should format error without context', () => {
            const formatted = ErrorCatalog.formatError('DB-001');
            expect(formatted).toContain('[DB-001]');
            expect(formatted).toContain('Database connection failed');
            expect(formatted).toContain('What to do:');
        });
        it('should format error with context', () => {
            const formatted = ErrorCatalog.formatError('DB-001', {
                path: '/db/code.db',
                reason: 'Permission denied',
            });
            expect(formatted).toContain('[DB-001]');
            expect(formatted).toContain('Details:');
            expect(formatted).toContain('path: /db/code.db');
            expect(formatted).toContain('reason: Permission denied');
        });
        it('should include remediation steps', () => {
            const formatted = ErrorCatalog.formatError('FS-002');
            expect(formatted).toContain('What to do:');
            expect(formatted).toContain('•');
        });
        it('should include learn more link when available', () => {
            const formatted = ErrorCatalog.formatError('DB-001');
            expect(formatted).toContain('Learn more:');
            expect(formatted).toContain('https://');
        });
        it('should handle unknown error codes', () => {
            const formatted = ErrorCatalog.formatError('UNKNOWN-999');
            expect(formatted).toContain('Unknown error: UNKNOWN-999');
        });
    });
    describe('Custom Errors', () => {
        beforeEach(() => {
            ErrorCatalog.clearCustomErrors();
        });
        it('should register custom error', () => {
            const customError = {
                code: 'CUSTOM-001',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.VALIDATION,
                message: 'Custom validation error',
                description: 'This is a custom error for testing',
                remediation: ['Fix the issue', 'Try again'],
            };
            ErrorCatalog.registerError(customError);
            const retrieved = ErrorCatalog.getError('CUSTOM-001');
            expect(retrieved).toBeDefined();
            expect(retrieved?.message).toBe('Custom validation error');
        });
        it('should overwrite existing error on register', () => {
            const original = ErrorCatalog.getError('DB-001');
            const customError = {
                code: 'DB-001',
                severity: ErrorSeverity.INFO,
                category: ErrorCategory.DATABASE,
                message: 'Override message',
                description: 'Override description',
                remediation: ['Override remediation'],
            };
            ErrorCatalog.registerError(customError);
            const overridden = ErrorCatalog.getError('DB-001');
            expect(overridden?.message).toBe('Override message');
            // Restore original
            if (original) {
                ErrorCatalog.registerError(original);
            }
        });
        it('should clear custom errors', () => {
            const customError = {
                code: 'CUSTOM-002',
                severity: ErrorSeverity.INFO,
                category: ErrorCategory.VALIDATION,
                message: 'Custom error',
                description: 'Test',
                remediation: ['Fix'],
            };
            ErrorCatalog.registerError(customError);
            expect(ErrorCatalog.hasError('CUSTOM-002')).toBe(true);
            ErrorCatalog.clearCustomErrors();
            expect(ErrorCatalog.hasError('CUSTOM-002')).toBe(false);
            expect(ErrorCatalog.hasError('DB-001')).toBe(true); // Built-in remains
        });
    });
    describe('Error Categories', () => {
        it('should have database errors', () => {
            const dbErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.DATABASE);
            expect(dbErrors.length).toBeGreaterThanOrEqual(3);
            expect(dbErrors.some((e) => e.code === 'DB-001')).toBe(true);
            expect(dbErrors.some((e) => e.code === 'DB-002')).toBe(true);
            expect(dbErrors.some((e) => e.code === 'DB-003')).toBe(true);
        });
        it('should have file system errors', () => {
            const fsErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.FILE_SYSTEM);
            expect(fsErrors.length).toBeGreaterThanOrEqual(4);
            expect(fsErrors.some((e) => e.code === 'FS-001')).toBe(true);
            expect(fsErrors.some((e) => e.code === 'FS-002')).toBe(true);
            expect(fsErrors.some((e) => e.code === 'FS-003')).toBe(true);
            expect(fsErrors.some((e) => e.code === 'FS-004')).toBe(true);
        });
        it('should have parser errors', () => {
            const parseErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.PARSER);
            expect(parseErrors.length).toBeGreaterThanOrEqual(2);
            expect(parseErrors.some((e) => e.code === 'PARSE-001')).toBe(true);
            expect(parseErrors.some((e) => e.code === 'PARSE-002')).toBe(true);
        });
        it('should have network errors', () => {
            const netErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.NETWORK);
            expect(netErrors.length).toBeGreaterThanOrEqual(2);
            expect(netErrors.some((e) => e.code === 'NET-001')).toBe(true);
            expect(netErrors.some((e) => e.code === 'NET-002')).toBe(true);
        });
        it('should have configuration errors', () => {
            const cfgErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.CONFIGURATION);
            expect(cfgErrors.length).toBeGreaterThanOrEqual(2);
            expect(cfgErrors.some((e) => e.code === 'CFG-001')).toBe(true);
            expect(cfgErrors.some((e) => e.code === 'CFG-002')).toBe(true);
        });
        it('should have plugin errors', () => {
            const plgErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.PLUGIN);
            expect(plgErrors.length).toBeGreaterThanOrEqual(3);
            expect(plgErrors.some((e) => e.code === 'PLG-001')).toBe(true);
            expect(plgErrors.some((e) => e.code === 'PLG-002')).toBe(true);
            expect(plgErrors.some((e) => e.code === 'PLG-003')).toBe(true);
        });
        it('should have migration errors', () => {
            const migErrors = ErrorCatalog.getErrorsByCategory(ErrorCategory.MIGRATION);
            expect(migErrors.length).toBeGreaterThanOrEqual(2);
            expect(migErrors.some((e) => e.code === 'MIG-001')).toBe(true);
            expect(migErrors.some((e) => e.code === 'MIG-002')).toBe(true);
        });
    });
    describe('Error Severities', () => {
        it('should have critical errors', () => {
            const critical = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.CRITICAL);
            expect(critical.length).toBeGreaterThan(0);
            expect(critical.some((e) => e.code === 'DB-001')).toBe(true);
            expect(critical.some((e) => e.code === 'MIG-002')).toBe(true);
        });
        it('should have error severity errors', () => {
            const errors = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.ERROR);
            expect(errors.length).toBeGreaterThan(0);
        });
        it('should have warnings', () => {
            const warnings = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.WARNING);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings.some((e) => e.code === 'FS-003')).toBe(true);
            expect(warnings.some((e) => e.code === 'CFG-002')).toBe(true);
        });
        it('should have info messages', () => {
            const info = ErrorCatalog.getErrorsBySeverity(ErrorSeverity.INFO);
            expect(info.length).toBeGreaterThan(0);
            expect(info.some((e) => e.code === 'PARSE-002')).toBe(true);
        });
    });
    describe('Error Content', () => {
        it('should have complete error structure', () => {
            const error = ErrorCatalog.getError('DB-001');
            expect(error).toBeDefined();
            expect(error?.code).toBe('DB-001');
            expect(error?.severity).toBe(ErrorSeverity.CRITICAL);
            expect(error?.category).toBe(ErrorCategory.DATABASE);
            expect(error?.message).toBeTruthy();
            expect(error?.description).toBeTruthy();
            expect(error?.remediation).toBeInstanceOf(Array);
            expect(error?.remediation.length).toBeGreaterThan(0);
        });
        it('should have actionable remediation steps', () => {
            const error = ErrorCatalog.getError('PLG-001');
            expect(error?.remediation).toBeDefined();
            expect(error?.remediation.length).toBeGreaterThanOrEqual(3);
            expect(error?.remediation.some((r) => r.includes('ax'))).toBe(true);
        });
        it('should have learn more links for complex errors', () => {
            const error = ErrorCatalog.getError('DB-001');
            expect(error?.learnMore).toBeDefined();
            expect(error?.learnMore).toContain('https://');
        });
    });
    describe('createCatalogError', () => {
        it('should create error from catalog', () => {
            const error = createCatalogError('DB-001');
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('DB-001');
            expect(error.message).toContain('[DB-001]');
            expect(error.message).toContain('Database connection failed');
        });
        it('should create error with context', () => {
            const error = createCatalogError('FS-001', {
                path: '/missing/file.ts',
            });
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('path: /missing/file.ts');
        });
        it('should handle unknown error codes', () => {
            const error = createCatalogError('UNKNOWN-999');
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Unknown error: UNKNOWN-999');
        });
    });
});
//# sourceMappingURL=ErrorCatalog.test.js.map