/**
 * DAG Generator Integration Tests
 *
 * End-to-end tests for spec DAG generation:
 * - DAG creation from YAML specs
 * - Node and edge generation
 * - Hash-based change detection
 * - Validation and error handling
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DagGenerator } from '../../../src/core/spec/DagGenerator.js';
import type { SpecYAML } from '../../../src/types/spec-yaml.js';
import type { DagJson } from '../../../src/types/dag.js';

describe('DAG Generator Integration', () => {
  let testDir: string;
  let generator: DagGenerator;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'dag-generator-test-'));
    generator = new DagGenerator();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Basic DAG Generation', () => {
    it('should generate DAG from valid spec', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: {
          id: 'test-spec',
          name: 'Test Specification',
          description: 'A test specification'
        },
        actors: [
          { id: 'design', agent: 'architecture', description: 'Design system' },
          { id: 'implement', agent: 'backend', description: 'Implement feature' },
          { id: 'test', agent: 'quality', description: 'Test implementation' }
        ]
      };

      const specContent = JSON.stringify(spec);
      const dag = generator.generate(spec, specContent, 'test.yaml');

      expect(dag.version).toBe('1.0');
      expect(dag.metadata.id).toBe('test-spec');
      expect(dag.metadata.name).toBe('Test Specification');
      expect(dag.nodes).toHaveLength(3);
      expect(dag.specHash).toBeDefined();
    });

    it('should create nodes for each actor', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'multi-actor', name: 'Multi Actor', description: 'Multi actor test' },
        actors: [
          { id: 'actor1', agent: 'backend', description: 'First actor' },
          { id: 'actor2', agent: 'frontend', description: 'Second actor' },
          { id: 'actor3', agent: 'security', description: 'Third actor' },
          { id: 'actor4', agent: 'quality', description: 'Fourth actor' }
        ]
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      expect(dag.nodes).toHaveLength(4);
      expect(dag.nodes.map(n => n.id)).toEqual(['actor1', 'actor2', 'actor3', 'actor4']);
      expect(dag.nodes.map(n => n.actor)).toEqual(['backend', 'frontend', 'security', 'quality']);
    });
  });

  describe('Hash-Based Change Detection', () => {
    it('should generate consistent hash for same content', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'hash-test', name: 'Hash Test', description: 'Hash test' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const specContent = JSON.stringify(spec);
      const hash1 = generator.calculateHash(specContent);
      const hash2 = generator.calculateHash(specContent);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const spec1: SpecYAML = {
        version: '1.0',
        metadata: { id: 'spec1', name: 'Spec 1', description: 'Spec 1 description' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const spec2: SpecYAML = {
        version: '1.0',
        metadata: { id: 'spec2', name: 'Spec 2', description: 'Spec 2 description' },
        actors: [{ id: 'actor1', agent: 'frontend' }]
      };

      const hash1 = generator.calculateHash(JSON.stringify(spec1));
      const hash2 = generator.calculateHash(JSON.stringify(spec2));

      expect(hash1).not.toBe(hash2);
    });

    it('should detect changes via hash comparison', () => {
      const specV1: SpecYAML = {
        version: '1.0',
        metadata: { id: 'versioned', name: 'Versioned Spec', description: 'Versioned spec test' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const specV2: SpecYAML = {
        ...specV1,
        actors: [
          { id: 'actor1', agent: 'backend' },
          { id: 'actor2', agent: 'frontend' } // Added actor
        ]
      };

      const dag1 = generator.generate(specV1, JSON.stringify(specV1));
      const dag2 = generator.generate(specV2, JSON.stringify(specV2));

      expect(dag1.specHash).not.toBe(dag2.specHash);
    });
  });

  describe('Policy Handling', () => {
    it('should include policy in DAG', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'policy-test', name: 'Policy Test', description: 'Policy test' },
        actors: [{ id: 'actor1', agent: 'backend' }],
        policy: {
          goal: 'latency',
          constraints: { latency: { p99: 5000 } }
        }
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      expect(dag.policy).toBeDefined();
      expect(dag.policy?.goal).toBe('latency');
      expect(dag.policy?.constraints?.latency?.p99).toBe(5000);
    });
  });

  describe('Recovery/Execution Config', () => {
    it('should include execution config from recovery settings', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'recovery-test', name: 'Recovery Test', description: 'Recovery test' },
        actors: [
          { id: 'actor1', agent: 'backend' },
          { id: 'actor2', agent: 'frontend' }
        ],
        recovery: {
          timeout: { task: 30000 },
          retry: { maxAttempts: 3 }
        }
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      expect(dag.execution).toBeDefined();
      expect(dag.execution?.parallel).toBe(true);
      expect(dag.execution?.maxConcurrency).toBe(2);
      expect(dag.execution?.timeoutMs).toBe(30000);
    });
  });

  describe('Actor Metadata', () => {
    it('should include actor timeout in node metadata', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'timeout-test', name: 'Timeout Test', description: 'Timeout test' },
        actors: [
          { id: 'fast-actor', agent: 'backend', timeout: 5000 },
          { id: 'slow-actor', agent: 'quality', timeout: 60000 }
        ]
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      const fastNode = dag.nodes.find(n => n.id === 'fast-actor');
      const slowNode = dag.nodes.find(n => n.id === 'slow-actor');

      expect(fastNode?.metadata?.timeout).toBe(5000);
      expect(slowNode?.metadata?.timeout).toBe(60000);
    });

    it('should include retry settings in node metadata', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'retry-test', name: 'Retry Test', description: 'Retry test' },
        actors: [{ id: 'actor1', agent: 'backend' }],
        recovery: {
          retry: { maxAttempts: 5 }
        }
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      expect(dag.nodes[0]!.metadata?.retries).toBe(5);
    });
  });

  describe('Validation', () => {
    it('should throw for spec without actors', () => {
      const spec = {
        metadata: { id: 'empty', name: 'Empty', description: 'Empty test' },
        actors: []
      } as unknown as SpecYAML;

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow('Spec must have at least one actor');
    });

    it('should throw for spec without metadata', () => {
      const spec = {
        actors: [{ id: 'actor1', agent: 'backend' }]
      } as unknown as SpecYAML;

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow('Spec must have metadata object');
    });

    it('should throw for actor without id', () => {
      const spec = {
        metadata: { id: 'test', name: 'Test', description: 'Test description' },
        actors: [{ agent: 'backend' }]
      } as unknown as SpecYAML;

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow(/must have id field/);
    });

    it('should throw for actor without agent', () => {
      const spec = {
        metadata: { id: 'test', name: 'Test', description: 'Test description' },
        actors: [{ id: 'actor1' }]
      } as unknown as SpecYAML;

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow(/must have agent field/);
    });

    it('should throw for empty specContent', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'test', name: 'Test', description: 'Test description' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      expect(() => generator.generate(spec, ''))
        .toThrow('specContent cannot be empty');
    });

    it('should throw for invalid timeout value', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'test', name: 'Test', description: 'Test description' },
        actors: [{ id: 'actor1', agent: 'backend', timeout: -1000 }]
      };

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow(/timeout must be a positive/);
    });

    it('should throw for invalid maxAttempts value', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'test', name: 'Test', description: 'Test description' },
        actors: [{ id: 'actor1', agent: 'backend' }],
        recovery: { retry: { maxAttempts: 0 } }
      };

      expect(() => generator.generate(spec, JSON.stringify(spec)))
        .toThrow(/maxAttempts must be a positive integer/);
    });
  });

  describe('Source File Tracking', () => {
    it('should include source file in metadata', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'tracked', name: 'Tracked', description: 'Tracked test' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const dag = generator.generate(spec, JSON.stringify(spec), 'specs/test.yaml');

      expect(dag.metadata.sourceFile).toBe('specs/test.yaml');
    });

    it('should work without source file', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'untracked', name: 'Untracked', description: 'Untracked test' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const dag = generator.generate(spec, JSON.stringify(spec));

      expect(dag.metadata.sourceFile).toBeUndefined();
    });
  });

  describe('Generated Timestamp', () => {
    it('should include generation timestamp', () => {
      const spec: SpecYAML = {
        version: '1.0',
        metadata: { id: 'timed', name: 'Timed', description: 'Timed test' },
        actors: [{ id: 'actor1', agent: 'backend' }]
      };

      const beforeGeneration = new Date().toISOString();
      const dag = generator.generate(spec, JSON.stringify(spec));
      const afterGeneration = new Date().toISOString();

      expect(dag.metadata.generated).toBeDefined();
      expect(dag.metadata.generated >= beforeGeneration).toBe(true);
      expect(dag.metadata.generated <= afterGeneration).toBe(true);
    });
  });
});
