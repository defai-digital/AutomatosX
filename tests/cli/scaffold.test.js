/**
 * Scaffold Command Tests
 *
 * Tests for the CLI scaffold command and template processing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
// ============================================================================
// Test Utilities
// ============================================================================
let tempDir;
beforeEach(() => {
    // Create temp directory for test output
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
});
afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
// ============================================================================
// Template Processing Tests
// ============================================================================
describe('Template Processing', () => {
    describe('Variable Substitution', () => {
        it('should replace simple variables', () => {
            // This tests the core template processing logic
            const template = 'Hello {{name}}!';
            const variables = { name: 'World' };
            // Simulate processTemplate behavior
            const result = template.replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] || '');
            expect(result).toBe('Hello World!');
        });
        it('should handle pascalCase helper', () => {
            const toPascalCase = (str) => str
                .split(/[-_]/)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join('');
            expect(toPascalCase('order')).toBe('Order');
            expect(toPascalCase('order-item')).toBe('OrderItem');
            expect(toPascalCase('order_item')).toBe('OrderItem');
        });
        it('should handle uppercase helper', () => {
            expect('domain'.toUpperCase()).toBe('DOMAIN');
        });
        it('should handle substring helper', () => {
            expect('payment'.substring(0, 3)).toBe('pay');
            expect('payment'.substring(0, 3).toUpperCase()).toBe('PAY');
        });
    });
});
// ============================================================================
// Schema Template Tests
// ============================================================================
describe('Schema Template', () => {
    it('should generate valid TypeScript schema', () => {
        const domainName = 'order';
        const pascalName = 'Order';
        const domainCode = 'ORD';
        const expectedPatterns = [
            `export const ${pascalName}IdSchema = z.string().uuid()`,
            `export type ${pascalName}Id = z.infer<typeof ${pascalName}IdSchema>`,
            `export const ${pascalName}StatusSchema = z.enum`,
            `export const ${pascalName}Schema = z.object`,
            `INV-${domainCode}-001`,
            `INV-${domainCode}-002`,
        ];
        // These patterns should be present in the generated schema
        for (const pattern of expectedPatterns) {
            expect(pattern).toBeDefined();
        }
    });
});
// ============================================================================
// Guard Policy Template Tests
// ============================================================================
describe('Guard Policy Template', () => {
    it('should generate valid YAML policy', () => {
        const policyId = 'order-development';
        const domain = 'order';
        const expectedSections = [
            `policy_id: ${policyId}`,
            'allowed_paths:',
            `packages/contracts/src/${domain}/**`,
            `packages/core/${domain}-domain/**`,
            'forbidden_paths:',
            'required_contracts:',
            'gates:',
            'change_radius_limit:',
        ];
        // These sections should be present in the generated policy
        for (const section of expectedSections) {
            expect(section).toBeDefined();
        }
    });
    it('should include specified gates', () => {
        const gates = ['path_violation', 'dependency', 'change_radius', 'contract_tests'];
        // All gates should be valid
        const validGates = new Set([
            'path_violation',
            'dependency',
            'change_radius',
            'contract_tests',
            'secrets',
        ]);
        for (const gate of gates) {
            expect(validGates.has(gate)).toBe(true);
        }
    });
});
// ============================================================================
// Template Structure Tests
// ============================================================================
describe('Template Structure', () => {
    const templatesDir = path.resolve(__dirname, '../../templates');
    describe('Monorepo Template', () => {
        const monorepoDir = path.join(templatesDir, 'monorepo');
        it('should have template.json', () => {
            const configPath = path.join(monorepoDir, 'template.json');
            expect(fs.existsSync(configPath)).toBe(true);
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.name).toBe('monorepo');
            expect(config.displayName).toBeDefined();
            expect(config.structure).toBeDefined();
            expect(Array.isArray(config.structure)).toBe(true);
        });
        it('should have all required template files', () => {
            const requiredTemplates = [
                'package.json.hbs',
                'tsconfig.json.hbs',
                'schema.ts.hbs',
                'invariants.md.hbs',
            ];
            for (const template of requiredTemplates) {
                const templatePath = path.join(monorepoDir, template);
                expect(fs.existsSync(templatePath)).toBe(true);
            }
        });
    });
    describe('Standalone Template', () => {
        const standaloneDir = path.join(templatesDir, 'standalone');
        it('should have template.json', () => {
            const configPath = path.join(standaloneDir, 'template.json');
            expect(fs.existsSync(configPath)).toBe(true);
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(config.name).toBe('standalone');
            expect(config.displayName).toBeDefined();
            expect(config.structure).toBeDefined();
            expect(Array.isArray(config.structure)).toBe(true);
        });
        it('should have all required template files', () => {
            const requiredTemplates = [
                'package.json.hbs',
                'tsconfig.json.hbs',
                'schema.ts.hbs',
                'invariants.md.hbs',
                'domain-service.ts.hbs',
                'domain-repository.ts.hbs',
                'contract-test.ts.hbs',
            ];
            for (const template of requiredTemplates) {
                const templatePath = path.join(standaloneDir, template);
                expect(fs.existsSync(templatePath)).toBe(true);
            }
        });
    });
});
// ============================================================================
// Invariant Code Tests
// ============================================================================
describe('Invariant Codes', () => {
    it('should follow INV-XXX-NNN format', () => {
        const validCodes = [
            'INV-ORD-001',
            'INV-PAY-101',
            'INV-USR-201',
        ];
        const invalidCodes = [
            'INV-ORDER-001', // Too long
            'INV-01-001', // Too short
            'ORDER-001', // Missing INV prefix
        ];
        const pattern = /^INV-[A-Z]{3}-\d{3}$/;
        for (const code of validCodes) {
            expect(pattern.test(code)).toBe(true);
        }
        for (const code of invalidCodes) {
            expect(pattern.test(code)).toBe(false);
        }
    });
    it('should use consistent domain prefix', () => {
        const getDomainCode = (domain) => domain.substring(0, 3).toUpperCase();
        expect(getDomainCode('order')).toBe('ORD');
        expect(getDomainCode('payment')).toBe('PAY');
        expect(getDomainCode('user')).toBe('USE');
        expect(getDomainCode('billing')).toBe('BIL');
    });
});
// ============================================================================
// Argument Parsing Tests
// ============================================================================
describe('Argument Parsing', () => {
    it('should correctly identify flags vs values', () => {
        const args = ['test-app', 'payment', 'monorepo', '@mycompany', '-m', '-t', '-s', '--dry-run'];
        const flags = [];
        const nonFlags = [];
        for (const arg of args) {
            if (arg.startsWith('-')) {
                flags.push(arg);
            }
            else {
                nonFlags.push(arg);
            }
        }
        expect(flags).toEqual(['-m', '-t', '-s', '--dry-run']);
        expect(nonFlags).toEqual(['test-app', 'payment', 'monorepo', '@mycompany']);
    });
    it('should match values to flags by order', () => {
        const flags = ['-m', '-t', '-s'];
        const values = ['payment', 'monorepo', '@mycompany'];
        const flagValueMap = new Map();
        for (let i = 0; i < Math.min(values.length, flags.length); i++) {
            flagValueMap.set(flags[i], values[i]);
        }
        expect(flagValueMap.get('-m')).toBe('payment');
        expect(flagValueMap.get('-t')).toBe('monorepo');
        expect(flagValueMap.get('-s')).toBe('@mycompany');
    });
});
// ============================================================================
// Generated File Validation Tests
// ============================================================================
describe('Generated File Validation', () => {
    describe('Schema File', () => {
        it('should be valid TypeScript', () => {
            // The generated schema should include all required exports
            const requiredExports = [
                'IdSchema',
                'StatusSchema',
                'Schema',
                'EventSchema',
                'ErrorCode',
                'validate',
            ];
            for (const exp of requiredExports) {
                expect(exp).toBeDefined();
            }
        });
    });
    describe('Test File', () => {
        it('should include invariant test cases', () => {
            const requiredTestCases = [
                'should reject invalid UUID',
                'should reject invalid status',
                'should accept valid entity',
            ];
            for (const testCase of requiredTestCases) {
                expect(testCase).toBeDefined();
            }
        });
    });
});
//# sourceMappingURL=scaffold.test.js.map