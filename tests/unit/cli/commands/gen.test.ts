/**
 * Gen Command Unit Tests
 *
 * Full coverage for auto-generation CLI commands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions with vi.hoisted
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockYamlLoad = vi.hoisted(() => vi.fn());
const mockValidateSpec = vi.hoisted(() => vi.fn());
const mockValidateDag = vi.hoisted(() => vi.fn());
const mockPlanGenerate = vi.hoisted(() => vi.fn());
const mockPlanExportMarkdown = vi.hoisted(() => vi.fn());
const mockDagGenerate = vi.hoisted(() => vi.fn());
const mockDagExportMermaid = vi.hoisted(() => vi.fn());
const mockDagExportDot = vi.hoisted(() => vi.fn());
const mockDagExportJson = vi.hoisted(() => vi.fn());
const mockScaffoldGenerate = vi.hoisted(() => vi.fn());
const mockScaffoldExecute = vi.hoisted(() => vi.fn());
const mockTestGenerate = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());

// Mock ora spinner - needs to be hoisted too
const mockSpinner = vi.hoisted(() => ({
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  warn: vi.fn().mockReturnThis(),
  text: '',
}));

// Mock dependencies before imports
vi.mock('chalk', () => ({
  default: {
    red: Object.assign((s: string) => s, { bold: (s: string) => s }),
    yellow: Object.assign((s: string) => s, { bold: (s: string) => s }),
    green: Object.assign((s: string) => s, { bold: (s: string) => s }),
    gray: (s: string) => s,
    cyan: Object.assign((s: string) => s, { bold: (s: string) => s }),
    blue: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock('ora', () => ({
  default: () => mockSpinner,
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock('js-yaml', () => ({
  load: mockYamlLoad,
  default: { load: mockYamlLoad },
}));

vi.mock('@/core/spec/PlanGenerator.js', () => ({
  getDefaultPlanGenerator: () => ({
    generate: mockPlanGenerate,
    exportMarkdown: mockPlanExportMarkdown,
  }),
}));

vi.mock('@/core/spec/DagGenerator.js', () => ({
  getDefaultDagGenerator: () => ({
    generate: mockDagGenerate,
    exportMermaid: mockDagExportMermaid,
    exportDot: mockDagExportDot,
    exportJson: mockDagExportJson,
  }),
  validateDag: mockValidateDag,
}));

vi.mock('@/core/spec/ScaffoldGenerator.js', () => ({
  getDefaultScaffoldGenerator: () => ({
    generate: mockScaffoldGenerate,
    execute: mockScaffoldExecute,
  }),
}));

vi.mock('@/core/spec/TestGenerator.js', () => ({
  getDefaultTestGenerator: () => ({
    generate: mockTestGenerate,
  }),
}));

vi.mock('@/core/spec/SpecSchemaValidator.js', () => ({
  validateSpec: mockValidateSpec,
}));

vi.mock('@/shared/logging/logger.js', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { genCommand } from '../../../../src/cli/commands/gen.js';

describe('genCommand', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  // Default spec
  const defaultSpec = {
    metadata: { id: 'test-spec', name: 'Test Spec' },
  };

  // Default plan result
  const defaultPlan = {
    overview: {
      specId: 'test-spec',
      specName: 'Test Spec',
      actorCount: 2,
      phaseCount: 3,
      estimatedDuration: '1h',
      estimatedCost: { min: 10, max: 50, currency: 'USD' },
    },
    phases: [
      { phase: 1, name: 'Phase 1', actors: ['agent1'], estimatedDuration: '30m', parallelizable: true },
    ],
    resourceRequirements: { memory: '4GB', cpu: '2 cores', storage: '10GB', network: 'standard' },
    risks: [{ severity: 'high', title: 'Risk 1', description: 'Desc', mitigation: 'Mitigation' }],
    recommendations: ['Recommendation 1'],
  };

  // Default DAG result
  const defaultDag = {
    specHash: 'abc123456789',
    nodes: [],
    edges: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Reset spinner mocks
    mockSpinner.start.mockClear().mockReturnThis();
    mockSpinner.stop.mockClear().mockReturnThis();
    mockSpinner.succeed.mockClear().mockReturnThis();
    mockSpinner.fail.mockClear().mockReturnThis();
    mockSpinner.warn.mockClear().mockReturnThis();

    // Setup default mocks
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('metadata:\n  id: test-spec');
    mockYamlLoad.mockReturnValue(defaultSpec);
    mockValidateSpec.mockReturnValue({ valid: true, errors: [] });
    mockPlanGenerate.mockReturnValue(defaultPlan);
    mockPlanExportMarkdown.mockReturnValue('# Plan\n\nContent');
    mockDagGenerate.mockReturnValue(defaultDag);
    mockDagExportMermaid.mockReturnValue('graph TD\nA --> B');
    mockDagExportDot.mockReturnValue('digraph {}');
    mockDagExportJson.mockReturnValue('{}');
    mockValidateDag.mockReturnValue({ valid: true, errors: [], warnings: [] });
    mockScaffoldGenerate.mockReturnValue({ directories: ['dir1'], files: [{ path: 'file1.ts', content: '' }] });
    mockScaffoldExecute.mockResolvedValue(undefined);
    mockTestGenerate.mockReturnValue([{ path: 'test.ts', content: '' }]);
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  describe('command definition', () => {
    it('should have correct command name', () => {
      expect(genCommand.command).toBe('gen <subcommand>');
    });

    it('should have description', () => {
      expect(genCommand.describe).toContain('Auto-generation');
    });

    it('should have builder function', () => {
      expect(typeof genCommand.builder).toBe('function');
    });

    it('should configure options in builder', () => {
      const mockYargs: any = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
      };

      (genCommand.builder as Function)(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('subcommand', expect.objectContaining({
        type: 'string',
        choices: ['plan', 'dag', 'scaffold', 'tests'],
      }));
    });
  });

  describe('handler - missing spec file', () => {
    it('should exit with error when spec file not provided', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should accept file from positional arg', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        _: ['gen', 'spec.yaml'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });
  });

  describe('handler - path safety', () => {
    it('should block Unix system directories', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: '/etc/passwd',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    // Note: Windows path safety check only works on Windows
    // On macOS/Linux, resolve() converts Windows paths to Unix-style paths
  });

  describe('handler - unknown subcommand', () => {
    it('should exit with error for unknown subcommand', async () => {
      await genCommand.handler({
        subcommand: 'unknown',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handler - plan subcommand', () => {
    it('should generate plan successfully', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockPlanGenerate).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should exit when spec file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await genCommand.handler({
        subcommand: 'plan',
        file: 'missing.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when spec validation fails', async () => {
      mockValidateSpec.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid field' }],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.fail).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should output JSON when format is json', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'json',
        pretty: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should save JSON to file when output specified', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'json',
        output: 'plan.json',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should output markdown when format is markdown', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'markdown',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockPlanExportMarkdown).toHaveBeenCalled();
    });

    it('should save markdown to file', async () => {
      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'markdown',
        output: 'plan.md',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should display summary for other formats', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        overview: { ...defaultPlan.overview, estimatedCost: { min: 0, max: 0, currency: 'USD' } },
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('handler - dag subcommand', () => {
    it('should generate DAG successfully', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockDagGenerate).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should exit when spec file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await genCommand.handler({
        subcommand: 'dag',
        file: 'missing.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when spec validation fails', async () => {
      mockValidateSpec.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid' }],
      });

      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should validate DAG when validate option is true', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        validate: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockValidateDag).toHaveBeenCalled();
    });

    it('should exit when DAG validation fails', async () => {
      mockValidateDag.mockReturnValue({
        valid: false,
        errors: ['Cycle detected'],
        warnings: [],
      });

      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        validate: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should show warnings', async () => {
      mockValidateDag.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Warning 1'],
      });

      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        validate: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should output mermaid diagram', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'mermaid',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockDagExportMermaid).toHaveBeenCalled();
    });

    it('should save mermaid to file', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'mermaid',
        output: 'dag.mmd',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should output DOT diagram', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'dot',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockDagExportDot).toHaveBeenCalled();
    });

    it('should save DOT to file', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'dot',
        output: 'dag.dot',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should output JSON by default', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'json',
        pretty: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockDagExportJson).toHaveBeenCalled();
    });

    it('should save JSON to file', async () => {
      await genCommand.handler({
        subcommand: 'dag',
        file: 'spec.yaml',
        format: 'json',
        output: 'dag.json',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('handler - scaffold subcommand', () => {
    it('should generate scaffold successfully', async () => {
      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockScaffoldGenerate).toHaveBeenCalled();
      expect(mockScaffoldExecute).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should exit when spec file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'missing.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when spec validation fails', async () => {
      mockValidateSpec.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid' }],
      });

      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should use output directory when specified', async () => {
      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        output: './custom-output',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockScaffoldGenerate).toHaveBeenCalled();
    });

    it('should sanitize spec ID for directory name', async () => {
      mockYamlLoad.mockReturnValue({
        metadata: { id: 'test@spec!', name: 'Test' },
      });

      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('should warn when force flag is enabled', async () => {
      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        force: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockSpinner.warn).toHaveBeenCalled();
    });

    it('should display directories created (more than 10)', async () => {
      mockScaffoldGenerate.mockReturnValue({
        directories: Array(15).fill('dir').map((d, i) => `${d}${i}`),
        files: [],
      });

      await genCommand.handler({
        subcommand: 'scaffold',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('handler - tests subcommand', () => {
    it('should generate tests successfully', async () => {
      await genCommand.handler({
        subcommand: 'tests',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockTestGenerate).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    it('should exit when spec file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await genCommand.handler({
        subcommand: 'tests',
        file: 'missing.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when spec validation fails', async () => {
      mockValidateSpec.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid' }],
      });

      await genCommand.handler({
        subcommand: 'tests',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should use output directory when specified', async () => {
      await genCommand.handler({
        subcommand: 'tests',
        file: 'spec.yaml',
        output: './tests',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockTestGenerate).toHaveBeenCalled();
    });

    it('should skip existing files without force', async () => {
      mockTestGenerate.mockReturnValue([
        { path: 'existing.test.ts', content: 'test' },
      ]);
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('existing') || path.includes('spec.yaml');
      });

      await genCommand.handler({
        subcommand: 'tests',
        file: 'spec.yaml',
        force: false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should overwrite with force flag', async () => {
      mockTestGenerate.mockReturnValue([
        { path: 'existing.test.ts', content: 'test' },
      ]);

      await genCommand.handler({
        subcommand: 'tests',
        file: 'spec.yaml',
        force: true,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('handler - error handling', () => {
    it('should handle errors gracefully', async () => {
      mockPlanGenerate.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('displayPlanSummary', () => {
    it('should display plan with cost enabled', async () => {
      mockPlanGenerate.mockReturnValue(defaultPlan);

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle risks with unknown severity', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        risks: [{ severity: 'unknown', title: 'Risk', description: 'Desc', mitigation: 'Mit' }],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle plan without risks', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        risks: [],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle plan without recommendations', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        recommendations: [],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display medium severity risks in yellow', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        risks: [{ severity: 'medium', title: 'Risk', description: 'Desc', mitigation: 'Mit' }],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display low severity risks in green', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        risks: [{ severity: 'low', title: 'Risk', description: 'Desc', mitigation: 'Mit' }],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display non-parallelizable phases', async () => {
      mockPlanGenerate.mockReturnValue({
        ...defaultPlan,
        phases: [
          { phase: 1, name: 'Phase 1', actors: ['agent1'], estimatedDuration: '30m', parallelizable: false },
        ],
      });

      await genCommand.handler({
        subcommand: 'plan',
        file: 'spec.yaml',
        format: 'dot',
        'export-markdown': false,
        _: ['gen'],
        $0: 'ax',
      } as any);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
