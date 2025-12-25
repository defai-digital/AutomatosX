/**
 * Scaffold Contract Invariant Tests
 *
 * Tests for scaffold invariants documented in packages/contracts/src/scaffold/v1/invariants.md
 *
 * Invariants tested:
 * - INV-SCF-001: Valid Domain Name Format
 * - INV-SCF-002: No Path Traversal
 * - INV-SCF-003: Valid Package Scope
 * - INV-SCF-101: Contract Files Generated Together
 * - INV-SCF-102: Invariant Codes Follow Format
 * - INV-SCF-201: Domain Package Structure
 * - INV-SCF-301: Policy ID Uniqueness
 * - INV-SCF-302: Positive Change Radius
 * - INV-SCF-303: Valid Gates
 * - INV-SCF-401: Template Existence
 * - INV-SCF-402: Required Domain
 * - INV-SCF-501: Dry Run Idempotent
 */

import { describe, it, expect } from 'vitest';
import {
  DomainNameSchema,
  PackageScopeSchema,
  OutputPathSchema,
  PolicyIdSchema,
  GuardGateSchema,
  TemplateTypeSchema,
  ScaffoldContractInputSchema,
  ScaffoldContractOutputSchema,
  ScaffoldDomainInputSchema,
  ScaffoldDomainOutputSchema,
  ScaffoldGuardInputSchema,
  ScaffoldGuardOutputSchema,
  ScaffoldProjectInputSchema,
  ScaffoldProjectOutputSchema,
  ScaffoldErrorCode,
  CONTRACT_VERSIONS,
} from '@defai.digital/contracts';

describe('Scaffold Contract', () => {
  describe('CONTRACT_VERSIONS', () => {
    it('should include scaffold version', () => {
      expect(CONTRACT_VERSIONS.scaffold).toBe('v1');
    });
  });

  // ============================================================================
  // INV-SCF-001: Valid Domain Name Format
  // ============================================================================
  describe('DomainNameSchema (INV-SCF-001)', () => {
    it('should accept valid domain names', () => {
      const validNames = ['order', 'payment', 'user-profile', 'api-gateway', 'a1b2c3'];

      for (const name of validNames) {
        const result = DomainNameSchema.safeParse(name);
        expect(result.success, `Expected "${name}" to be valid`).toBe(true);
      }
    });

    it('should reject domain names starting with number', () => {
      const result = DomainNameSchema.safeParse('123-order');
      expect(result.success).toBe(false);
    });

    it('should reject domain names with uppercase', () => {
      const result = DomainNameSchema.safeParse('Order');
      expect(result.success).toBe(false);
    });

    it('should reject domain names with underscores', () => {
      const result = DomainNameSchema.safeParse('order_item');
      expect(result.success).toBe(false);
    });

    it('should reject empty domain names', () => {
      const result = DomainNameSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject domain names over 50 characters', () => {
      const longName = 'a'.repeat(51);
      const result = DomainNameSchema.safeParse(longName);
      expect(result.success).toBe(false);
    });

    it('should reject domain names with special characters', () => {
      const invalidNames = ['order!', 'order@', 'order#', 'order.item', 'order/item'];

      for (const name of invalidNames) {
        const result = DomainNameSchema.safeParse(name);
        expect(result.success, `Expected "${name}" to be invalid`).toBe(false);
      }
    });
  });

  // ============================================================================
  // INV-SCF-002: No Path Traversal
  // ============================================================================
  describe('OutputPathSchema (INV-SCF-002)', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        './output',
        '/absolute/path',
        'relative/path',
        'packages/contracts/src/order',
      ];

      for (const path of validPaths) {
        const result = OutputPathSchema.safeParse(path);
        expect(result.success, `Expected "${path}" to be valid`).toBe(true);
      }
    });

    it('should reject paths with ..', () => {
      const invalidPaths = [
        '../parent',
        'path/../traversal',
        '/absolute/../parent',
        '../../etc/passwd',
      ];

      for (const path of invalidPaths) {
        const result = OutputPathSchema.safeParse(path);
        expect(result.success, `Expected "${path}" to be rejected`).toBe(false);
      }
    });

    it('should reject empty paths', () => {
      const result = OutputPathSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // INV-SCF-003: Valid Package Scope
  // ============================================================================
  describe('PackageScopeSchema (INV-SCF-003)', () => {
    it('should accept valid scopes', () => {
      const validScopes = ['@myorg', '@defai.digital', '@company123', '@a'];

      for (const scope of validScopes) {
        const result = PackageScopeSchema.safeParse(scope);
        expect(result.success, `Expected "${scope}" to be valid`).toBe(true);
      }
    });

    it('should reject scopes without @ prefix', () => {
      const result = PackageScopeSchema.safeParse('myorg');
      expect(result.success).toBe(false);
    });

    it('should reject scopes starting with number after @', () => {
      const result = PackageScopeSchema.safeParse('@123org');
      expect(result.success).toBe(false);
    });

    it('should reject scopes with uppercase', () => {
      const result = PackageScopeSchema.safeParse('@MyOrg');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // INV-SCF-301: Policy ID Format
  // ============================================================================
  describe('PolicyIdSchema (INV-SCF-301)', () => {
    it('should accept valid policy IDs', () => {
      const validIds = ['bugfix', 'provider-refactor', 'rebuild', 'my-policy-123'];

      for (const id of validIds) {
        const result = PolicyIdSchema.safeParse(id);
        expect(result.success, `Expected "${id}" to be valid`).toBe(true);
      }
    });

    it('should reject policy IDs starting with number', () => {
      const result = PolicyIdSchema.safeParse('123-policy');
      expect(result.success).toBe(false);
    });

    it('should reject policy IDs with uppercase', () => {
      const result = PolicyIdSchema.safeParse('MyPolicy');
      expect(result.success).toBe(false);
    });

    it('should reject policy IDs over 50 characters', () => {
      const longId = 'a'.repeat(51);
      const result = PolicyIdSchema.safeParse(longId);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // INV-SCF-303: Valid Gates
  // ============================================================================
  describe('GuardGateSchema (INV-SCF-303)', () => {
    it('should accept all valid gate types', () => {
      const validGates = [
        'path_violation',
        'dependency',
        'change_radius',
        'contract_tests',
        'secrets',
      ];

      for (const gate of validGates) {
        const result = GuardGateSchema.safeParse(gate);
        expect(result.success, `Expected "${gate}" to be valid`).toBe(true);
      }
    });

    it('should reject unknown gate types', () => {
      const invalidGates = ['unknown', 'custom_gate', 'PATH_VIOLATION'];

      for (const gate of invalidGates) {
        const result = GuardGateSchema.safeParse(gate);
        expect(result.success, `Expected "${gate}" to be rejected`).toBe(false);
      }
    });
  });

  // ============================================================================
  // INV-SCF-401: Template Types
  // ============================================================================
  describe('TemplateTypeSchema (INV-SCF-401)', () => {
    it('should accept valid template types', () => {
      const validTypes = ['monorepo', 'standalone'];

      for (const type of validTypes) {
        const result = TemplateTypeSchema.safeParse(type);
        expect(result.success, `Expected "${type}" to be valid`).toBe(true);
      }
    });

    it('should reject unknown template types', () => {
      const result = TemplateTypeSchema.safeParse('custom');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ScaffoldContractInput/Output
  // ============================================================================
  describe('ScaffoldContractInputSchema', () => {
    it('should validate minimal input', () => {
      const input = { name: 'order' };
      const result = ScaffoldContractInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
      const input = {
        name: 'order',
        description: 'Order domain contract',
        entities: 'Order,OrderItem,OrderStatus',
        output: './packages/contracts/src/order',
        dryRun: true,
      };
      const result = ScaffoldContractInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply dryRun default', () => {
      const input = { name: 'order' };
      const result = ScaffoldContractInputSchema.parse(input);
      expect(result.dryRun).toBe(false);
    });

    it('should reject invalid domain name', () => {
      const input = { name: 'Order' }; // Uppercase
      const result = ScaffoldContractInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject path traversal in output', () => {
      const input = { name: 'order', output: '../../../etc' };
      const result = ScaffoldContractInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('ScaffoldContractOutputSchema', () => {
    it('should validate success output', () => {
      const output = {
        success: true,
        message: 'Created 3 files',
        files: [
          { path: 'schema.ts', action: 'create' },
          { path: 'invariants.md', action: 'create' },
          { path: 'index.ts', action: 'create' },
        ],
        dryRun: false,
      };
      const result = ScaffoldContractOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate failure output', () => {
      const output = {
        success: false,
        message: 'Domain name invalid',
        dryRun: false,
      };
      const result = ScaffoldContractOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept valid file actions', () => {
      const actions = ['create', 'overwrite', 'skip'];
      for (const action of actions) {
        const output = {
          success: true,
          message: 'OK',
          files: [{ path: 'file.ts', action }],
          dryRun: false,
        };
        const result = ScaffoldContractOutputSchema.safeParse(output);
        expect(result.success, `Expected action "${action}" to be valid`).toBe(true);
      }
    });
  });

  // ============================================================================
  // ScaffoldDomainInput/Output
  // ============================================================================
  describe('ScaffoldDomainInputSchema', () => {
    it('should validate minimal input', () => {
      const input = { name: 'order' };
      const result = ScaffoldDomainInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
      const input = {
        name: 'order',
        contract: './packages/contracts/src/order',
        output: './packages/core/order-domain',
        scope: '@myorg',
        noTests: true,
        noGuard: false,
        dryRun: true,
      };
      const result = ScaffoldDomainInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply default scope', () => {
      const input = { name: 'order' };
      const result = ScaffoldDomainInputSchema.parse(input);
      expect(result.scope).toBe('@defai.digital');
    });

    it('should apply default flags', () => {
      const input = { name: 'order' };
      const result = ScaffoldDomainInputSchema.parse(input);
      expect(result.noTests).toBe(false);
      expect(result.noGuard).toBe(false);
      expect(result.dryRun).toBe(false);
    });
  });

  describe('ScaffoldDomainOutputSchema', () => {
    it('should validate success output', () => {
      const output = {
        success: true,
        message: 'Domain created',
        files: [
          { path: 'package.json', action: 'create' },
          { path: 'src/index.ts', action: 'create' },
        ],
        dryRun: false,
      };
      const result = ScaffoldDomainOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // ScaffoldGuardInput/Output (INV-SCF-302)
  // ============================================================================
  describe('ScaffoldGuardInputSchema (INV-SCF-302)', () => {
    it('should validate minimal input', () => {
      const input = { policyId: 'my-policy' };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
      const input = {
        policyId: 'order-policy',
        domain: 'order',
        radius: 5,
        gates: ['path_violation', 'dependency'],
        dryRun: true,
      };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply default radius', () => {
      const input = { policyId: 'my-policy' };
      const result = ScaffoldGuardInputSchema.parse(input);
      expect(result.radius).toBe(3);
    });

    it('should reject radius below 1', () => {
      const input = { policyId: 'my-policy', radius: 0 };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject radius above 100', () => {
      const input = { policyId: 'my-policy', radius: 101 };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept gates as comma-separated string', () => {
      const input = { policyId: 'my-policy', gates: 'path_violation,dependency' };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept gates as array', () => {
      const input = { policyId: 'my-policy', gates: ['path_violation', 'dependency'] };
      const result = ScaffoldGuardInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('ScaffoldGuardOutputSchema', () => {
    it('should validate success output', () => {
      const output = {
        success: true,
        message: 'Guard policy created',
        files: [{ path: 'policies/my-policy.yaml', action: 'create' }],
        dryRun: false,
      };
      const result = ScaffoldGuardOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // ScaffoldProjectInput/Output (INV-SCF-402)
  // ============================================================================
  describe('ScaffoldProjectInputSchema (INV-SCF-402)', () => {
    it('should validate minimal input', () => {
      const input = {
        projectName: 'my-project',
        domainName: 'order',
      };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
      const input = {
        projectName: 'my-project',
        template: 'monorepo',
        domainName: 'order',
        scope: '@myorg',
        description: 'My awesome project',
        output: './projects',
        dryRun: true,
      };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require projectName', () => {
      const input = { domainName: 'order' };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require domainName (INV-SCF-402)', () => {
      const input = { projectName: 'my-project' };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should apply default template', () => {
      const input = { projectName: 'my-project', domainName: 'order' };
      const result = ScaffoldProjectInputSchema.parse(input);
      expect(result.template).toBe('standalone');
    });

    it('should apply default scope', () => {
      const input = { projectName: 'my-project', domainName: 'order' };
      const result = ScaffoldProjectInputSchema.parse(input);
      expect(result.scope).toBe('@myorg');
    });

    it('should reject project name with uppercase', () => {
      const input = { projectName: 'MyProject', domainName: 'order' };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject project name starting with number', () => {
      const input = { projectName: '123project', domainName: 'order' };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject project name over 100 characters', () => {
      const input = { projectName: 'a'.repeat(101), domainName: 'order' };
      const result = ScaffoldProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('ScaffoldProjectOutputSchema', () => {
    it('should validate success output with nextSteps', () => {
      const output = {
        success: true,
        message: 'Project created',
        files: [
          { path: 'package.json', action: 'create' },
          { path: 'src/index.ts', action: 'create' },
        ],
        dryRun: false,
        nextSteps: ['cd my-project', 'pnpm install', 'pnpm build'],
      };
      const result = ScaffoldProjectOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate output without nextSteps', () => {
      const output = {
        success: true,
        message: 'Project created',
        dryRun: false,
      };
      const result = ScaffoldProjectOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Error Codes
  // ============================================================================
  describe('ScaffoldErrorCode', () => {
    it('should have all required error codes', () => {
      expect(ScaffoldErrorCode.INVALID_DOMAIN_NAME).toBe('SCF_INVALID_DOMAIN_NAME');
      expect(ScaffoldErrorCode.INVALID_POLICY_ID).toBe('SCF_INVALID_POLICY_ID');
      expect(ScaffoldErrorCode.INVALID_SCOPE).toBe('SCF_INVALID_SCOPE');
      expect(ScaffoldErrorCode.TEMPLATE_NOT_FOUND).toBe('SCF_TEMPLATE_NOT_FOUND');
      expect(ScaffoldErrorCode.PATH_TRAVERSAL).toBe('SCF_PATH_TRAVERSAL');
      expect(ScaffoldErrorCode.FILE_EXISTS).toBe('SCF_FILE_EXISTS');
      expect(ScaffoldErrorCode.WRITE_FAILED).toBe('SCF_WRITE_FAILED');
    });
  });

  // ============================================================================
  // INV-SCF-501: Dry Run Behavior
  // ============================================================================
  describe('Dry Run Invariant (INV-SCF-501)', () => {
    it('should default dryRun to false for all input schemas', () => {
      const contractInput = ScaffoldContractInputSchema.parse({ name: 'order' });
      const domainInput = ScaffoldDomainInputSchema.parse({ name: 'order' });
      const guardInput = ScaffoldGuardInputSchema.parse({ policyId: 'my-policy' });
      const projectInput = ScaffoldProjectInputSchema.parse({
        projectName: 'my-project',
        domainName: 'order',
      });

      expect(contractInput.dryRun).toBe(false);
      expect(domainInput.dryRun).toBe(false);
      expect(guardInput.dryRun).toBe(false);
      expect(projectInput.dryRun).toBe(false);
    });

    it('should preserve dryRun flag in output', () => {
      const dryRunOutput = ScaffoldContractOutputSchema.parse({
        success: true,
        message: 'Would create 3 files',
        dryRun: true,
      });

      expect(dryRunOutput.dryRun).toBe(true);
    });
  });
});
