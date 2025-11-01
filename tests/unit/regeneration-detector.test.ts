/**
 * RegenerationDetector Tests
 *
 * Tests for spec change detection and regeneration prompts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { RegenerationDetector } from '@/core/spec/RegenerationDetector.js';
import type { DagJson } from '@/types/dag.js';

describe('RegenerationDetector', () => {
  let testDir: string;
  let detector: RegenerationDetector;
  let specPath: string;
  let dagPath: string;

  beforeEach(async () => {
    // Create temp directory
    testDir = await mkdtemp(join(tmpdir(), 'regeneration-test-'));
    detector = new RegenerationDetector();
    specPath = join(testDir, 'test-spec.ax.yaml');
    dagPath = join(testDir, 'test-dag.json');
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash correctly', () => {
      const content = 'test content';
      const hash = detector.calculateHash(content);

      expect(hash).toBe('6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72');
      expect(hash).toHaveLength(64); // SHA-256 is 64 hex characters
    });

    it('should produce consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = detector.calculateHash(content);
      const hash2 = detector.calculateHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = detector.calculateHash('content 1');
      const hash2 = detector.calculateHash('content 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for non-string content', () => {
      expect(() => {
        detector.calculateHash(123 as any);
      }).toThrow('content must be a string');
    });
  });

  describe('needsRegeneration', () => {
    it('should return false when spec and DAG hashes match', async () => {
      const specContent = `
metadata:
  id: test-spec
  name: Test Spec
actors:
  - id: actor1
    agent: backend
    description: Test actor
`;

      // Calculate hash
      const hash = detector.calculateHash(specContent);

      // Create spec file
      await writeFile(specPath, specContent, 'utf-8');

      // Create DAG file with matching hash
      const dag: DagJson = {
        version: '1.0',
        specHash: hash,
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      // Check regeneration
      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should return true when spec and DAG hashes differ', async () => {
      const specContent1 = 'spec content version 1';
      const specContent2 = 'spec content version 2';

      // Calculate hash for version 1
      const hash1 = detector.calculateHash(specContent1);

      // Create spec file with version 2
      await writeFile(specPath, specContent2, 'utf-8');

      // Create DAG file with version 1 hash
      const dag: DagJson = {
        version: '1.0',
        specHash: hash1, // Old hash
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      // Check regeneration
      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(true);
      expect(result.reason).toBe('Spec has changed since DAG was generated');
    });

    it('should return true when DAG file does not exist', async () => {
      const specContent = 'spec content';
      await writeFile(specPath, specContent, 'utf-8');

      // Don't create DAG file
      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(true);
      expect(result.reason).toBe('DAG file does not exist');
    });

    it('should throw error when spec file does not exist', async () => {
      // Create DAG file
      const dag: DagJson = {
        version: '1.0',
        specHash: 'abcd1234',
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      // Don't create spec file
      await expect(
        detector.needsRegeneration(specPath, dagPath)
      ).rejects.toThrow('Spec file not found');
    });

    it('should return true when DAG missing specHash field', async () => {
      const specContent = 'spec content';
      await writeFile(specPath, specContent, 'utf-8');

      // Create DAG without specHash
      const dag = {
        version: '1.0',
        // Missing specHash
        metadata: {
          id: 'test-spec',
          name: 'Test Spec'
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(true);
      expect(result.reason).toBe('DAG missing specHash field');
    });

    it('should throw error for invalid DAG JSON', async () => {
      const specContent = 'spec content';
      await writeFile(specPath, specContent, 'utf-8');

      // Create invalid JSON
      await writeFile(dagPath, '{ invalid json }', 'utf-8');

      await expect(
        detector.needsRegeneration(specPath, dagPath)
      ).rejects.toThrow('Failed to parse DAG JSON');
    });

    it('should throw error for invalid specPath', async () => {
      await expect(
        detector.needsRegeneration('', dagPath)
      ).rejects.toThrow('specPath must be a non-empty string');
    });

    it('should throw error for invalid dagPath', async () => {
      await expect(
        detector.needsRegeneration(specPath, '')
      ).rejects.toThrow('dagPath must be a non-empty string');
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RegenerationDetector.getInstance();
      const instance2 = RegenerationDetector.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return same instance as new RegenerationDetector()', () => {
      const instance1 = RegenerationDetector.getInstance();
      const instance2 = new RegenerationDetector();

      // They should have same prototype
      expect(Object.getPrototypeOf(instance1)).toBe(Object.getPrototypeOf(instance2));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty spec content', async () => {
      const specContent = '';
      const hash = detector.calculateHash(specContent);

      await writeFile(specPath, specContent, 'utf-8');

      const dag: DagJson = {
        version: '1.0',
        specHash: hash,
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(false);
    });

    it('should handle spec with special characters', async () => {
      const specContent = '# Spec with émojis 🚀 and špëçîål çhãrãçtërs';
      const hash = detector.calculateHash(specContent);

      await writeFile(specPath, specContent, 'utf-8');

      const dag: DagJson = {
        version: '1.0',
        specHash: hash,
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(false);
    });

    it('should handle very large spec files', async () => {
      // Create large spec (1MB)
      const specContent = 'x'.repeat(1024 * 1024);
      const hash = detector.calculateHash(specContent);

      await writeFile(specPath, specContent, 'utf-8');

      const dag: DagJson = {
        version: '1.0',
        specHash: hash,
        metadata: {
          id: 'test-spec',
          name: 'Test Spec',
          generated: new Date().toISOString()
        },
        nodes: [],
        edges: []
      };

      await writeFile(dagPath, JSON.stringify(dag), 'utf-8');

      const result = await detector.needsRegeneration(specPath, dagPath);

      expect(result.needsRegen).toBe(false);
    });
  });
});
