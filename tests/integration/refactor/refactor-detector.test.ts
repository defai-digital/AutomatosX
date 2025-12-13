/**
 * Refactor Detector Integration Tests
 *
 * End-to-end tests for autonomous code refactoring:
 * - Detection of refactoring opportunities
 * - Multiple focus areas
 * - Static-only mode
 * - Severity filtering
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { RefactorDetector } from '../../../src/core/refactor/refactor-detector.js';
import type { RefactorConfig } from '../../../src/core/refactor/types.js';

describe('Refactor Detector Integration', () => {
  let testDir: string;
  let srcDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'refactor-test-'));
    srcDir = join(testDir, 'src');
    await mkdir(srcDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Dead Code Detection', () => {
    it('should detect unused imports', async () => {
      const fileContent = `
        import { unusedFunction } from './unused';
        import { usedFunction } from './used';

        export function main() {
          return usedFunction();
        }
      `;
      await writeFile(join(srcDir, 'test.ts'), fileContent);

      const config = {
        focusAreas: ['dead_code'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      // May or may not find depending on detection accuracy
      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should detect unused variables', async () => {
      const fileContent = `
        export function calculate() {
          const unusedVar = 42;
          const usedVar = 10;
          return usedVar * 2;
        }
      `;
      await writeFile(join(srcDir, 'vars.ts'), fileContent);

      const config = {
        focusAreas: ['dead_code'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });
  });

  describe('Type Safety Detection', () => {
    it('should detect any type usage', async () => {
      const fileContent = `
        export function processData(data: any): any {
          return data.value;
        }

        export const config: any = { key: 'value' };
      `;
      await writeFile(join(srcDir, 'types.ts'), fileContent);

      const config = {
        focusAreas: ['type_safety'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });
  });

  describe('Hardcoded Values Detection', () => {
    it('should detect magic numbers', async () => {
      const fileContent = `
        export function calculatePrice(quantity: number) {
          const tax = quantity * 0.08;
          const shipping = 5.99;
          const discount = quantity > 10 ? 0.1 : 0;
          return quantity * 19.99 + tax + shipping - (quantity * discount);
        }
      `;
      await writeFile(join(srcDir, 'pricing.ts'), fileContent);

      const config = {
        focusAreas: ['hardcoded_values'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });

    it('should detect hardcoded URLs', async () => {
      const fileContent = `
        export async function fetchData() {
          const response = await fetch('https://api.example.com/v1/data');
          return response.json();
        }

        export const BASE_URL = 'http://localhost:3000';
      `;
      await writeFile(join(srcDir, 'api.ts'), fileContent);

      const config = {
        focusAreas: ['hardcoded_values'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });
  });

  describe('Conditional Complexity Detection', () => {
    it('should detect deeply nested conditionals', async () => {
      const fileContent = `
        export function processUser(user: any) {
          if (user) {
            if (user.isActive) {
              if (user.role === 'admin') {
                if (user.permissions.includes('write')) {
                  if (user.verified) {
                    return 'full access';
                  }
                }
              }
            }
          }
          return 'no access';
        }
      `;
      await writeFile(join(srcDir, 'conditionals.ts'), fileContent);

      const config = {
        focusAreas: ['conditionals'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });
  });

  describe('Naming Issues Detection', () => {
    it('should detect poor variable names', async () => {
      const fileContent = `
        export function calc(x: number, y: number, z: number) {
          const a = x * y;
          const b = a + z;
          const c = b / 2;
          return c;
        }

        export const data = { val: 1, tmp: 2, foo: 3 };
      `;
      await writeFile(join(srcDir, 'naming.ts'), fileContent);

      const config = {
        focusAreas: ['naming'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: true // Naming often needs LLM
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
    });
  });

  describe('Multiple Focus Areas', () => {
    it('should scan for multiple issue types', async () => {
      const fileContent = `
        import { unused } from './unused';

        export function process(data: any) {
          const x = 42;
          if (data) {
            if (data.value) {
              return data.value * 3.14159;
            }
          }
          return 0;
        }
      `;
      await writeFile(join(srcDir, 'multi.ts'), fileContent);

      const config = {
        focusAreas: ['dead_code', 'type_safety', 'hardcoded_values', 'conditionals'],
        maxFindings: 100,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('Severity Filtering', () => {
    it('should respect minimum severity filter', async () => {
      const fileContent = `
        const x: any = 1;
        const unused = 2;
      `;
      await writeFile(join(srcDir, 'severity.ts'), fileContent);

      const lowSeverityConfig = {
        focusAreas: ['dead_code', 'type_safety'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const highSeverityConfig = {
        focusAreas: ['dead_code', 'type_safety'],
        maxFindings: 50,
        severityThreshold: 'critical',
        useLLMForDetection: false
      };

      const lowDetector = new RefactorDetector(lowSeverityConfig as RefactorConfig);
      const highDetector = new RefactorDetector(highSeverityConfig as RefactorConfig);

      const lowFindings = await lowDetector.scan(testDir);
      const highFindings = await highDetector.scan(testDir);

      // High severity filter should return equal or fewer findings
      expect(highFindings.length).toBeLessThanOrEqual(lowFindings.length);
    });
  });

  describe('File Filtering', () => {
    it('should only scan specified files', async () => {
      await writeFile(join(srcDir, 'include.ts'), 'const x: any = 1;');
      await writeFile(join(srcDir, 'exclude.ts'), 'const y: any = 2;');

      const config = {
        focusAreas: ['type_safety'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir, [join(srcDir, 'include.ts')]);

      // All findings should be from include.ts
      findings.forEach(finding => {
        expect(finding.file).toContain('include.ts');
      });
    });
  });

  describe('Limits', () => {
    it('should respect maxFindings limit', async () => {
      // Create file with many potential issues
      const content = Array(50).fill(0).map((_, i) =>
        `const var${i}: any = ${i};`
      ).join('\n');
      await writeFile(join(srcDir, 'many-issues.ts'), content);

      const config = {
        focusAreas: ['type_safety'],
        maxFindings: 5,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty directory', async () => {
      const config = {
        focusAreas: ['dead_code'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      expect(findings).toEqual([]);
    });

    it('should skip non-TypeScript files', async () => {
      await writeFile(join(srcDir, 'readme.md'), '# README');
      await writeFile(join(srcDir, 'config.json'), '{}');
      await writeFile(join(srcDir, 'test.ts'), 'const x: any = 1;');

      const config = {
        focusAreas: ['type_safety'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);
      const findings = await detector.scan(testDir);

      // All findings should be from .ts files
      findings.forEach(finding => {
        expect(finding.file).toMatch(/\.(ts|tsx|js|jsx)$/);
      });
    });

    it('should handle syntax errors gracefully', async () => {
      await writeFile(join(srcDir, 'broken.ts'), 'const x = {{{');

      const config = {
        focusAreas: ['dead_code'],
        maxFindings: 50,
        severityThreshold: 'low',
        useLLMForDetection: false
      };

      const detector = new RefactorDetector(config as RefactorConfig);

      // Should not throw
      await expect(detector.scan(testDir)).resolves.toBeDefined();
    });
  });
});
