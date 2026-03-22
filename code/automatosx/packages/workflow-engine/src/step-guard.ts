import type {
  WorkflowStepGuard,
  StepGuardResult,
  StepGuardContext,
  StepGuardPolicy,
  StepGateResult,
  GuardPosition,
  GuardCheckStatus,
  StageProgressEvent,
  StageProgressStatus,
} from '@defai.digital/contracts';
import {
  createStepGuardResult,
  createProgressEvent,
  getErrorMessage,
} from '@defai.digital/contracts';

export type GateCheckFn = (context: StepGuardContext) => Promise<StepGateResult>;

export interface GateRegistry {
  register(gateId: string, check: GateCheckFn): void;
  get(gateId: string): GateCheckFn | undefined;
  has(gateId: string): boolean;
  list(): string[];
}

export interface StepGuardEngineConfig {
  enabled: boolean;
  defaultOnFail: 'block' | 'warn' | 'continue';
  gateRegistry?: GateRegistry;
  onProgressEvent?: (event: StageProgressEvent) => void;
}

export const DEFAULT_STEP_GUARD_ENGINE_CONFIG: StepGuardEngineConfig = {
  enabled: true,
  defaultOnFail: 'warn',
};

export class StepGuardEngine {
  private readonly config: StepGuardEngineConfig;
  private readonly gateRegistry: GateRegistry;
  private readonly policies = new Map<string, StepGuardPolicy>();
  private readonly onProgressEvent: ((event: StageProgressEvent) => void) | undefined;

  constructor(config: Partial<StepGuardEngineConfig> = {}) {
    this.config = { ...DEFAULT_STEP_GUARD_ENGINE_CONFIG, ...config };
    this.gateRegistry = config.gateRegistry ?? createGateRegistry();
    this.onProgressEvent = config.onProgressEvent;
    this.registerDefaultGates();
  }

  registerPolicy(policy: StepGuardPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  getPolicies(): StepGuardPolicy[] {
    return Array.from(this.policies.values());
  }

  registerGate(gateId: string, check: GateCheckFn): void {
    this.gateRegistry.register(gateId, check);
  }

  async runBeforeGuards(context: StepGuardContext): Promise<StepGuardResult[]> {
    return this.runGuards(context, 'before');
  }

  async runAfterGuards(context: StepGuardContext): Promise<StepGuardResult[]> {
    return this.runGuards(context, 'after');
  }

  shouldBlock(results: StepGuardResult[]): boolean {
    return results.some((result) => result.blocked);
  }

  emitProgress(
    executionId: string,
    agentId: string,
    stageIndex: number,
    stageTotal: number,
    stageName: string,
    stageType: string,
    status: StageProgressStatus,
    options: {
      sessionId?: string;
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
      metadata?: Record<string, unknown>;
    } = {},
  ): void {
    if (this.onProgressEvent) {
      const event = createProgressEvent(
        executionId,
        agentId,
        stageIndex,
        stageTotal,
        stageName,
        stageType,
        status,
        options,
      );
      this.onProgressEvent(event);
    }
  }

  private async runGuards(
    context: StepGuardContext,
    position: GuardPosition,
  ): Promise<StepGuardResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const results: StepGuardResult[] = [];
    const applicablePolicies = this.getApplicablePolicies(context);
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    for (const policy of applicablePolicies) {
      for (const guard of policy.guards) {
        if (!guard.enabled) continue;
        if (guard.position !== position) continue;
        if (!this.matchesStep(guard.stepId, context.stepId)) continue;
        results.push(await this.runGuard(guard, context));
      }
    }

    return results;
  }

  private async runGuard(
    guard: WorkflowStepGuard,
    context: StepGuardContext,
  ): Promise<StepGuardResult> {
    const startTime = Date.now();
    const gateResults = await Promise.all(
      guard.gates.map(async (gateId) => {
        const gateFn = this.gateRegistry.get(gateId);
        if (!gateFn) {
          return {
            gateId,
            status: 'WARN' as const,
            message: `Gate "${gateId}" not found`,
          };
        }

        try {
          return await gateFn(context);
        } catch (error) {
          return {
            gateId,
            status: 'FAIL' as const,
            message: getErrorMessage(error, 'Gate check failed'),
          };
        }
      }),
    );

    const hasFailure = gateResults.some((gate) => gate.status === 'FAIL');
    const blocked = hasFailure && guard.onFail === 'block';
    const result = createStepGuardResult(
      guard.guardId,
      context.stepId,
      guard.position,
      gateResults,
      blocked,
    );
    result.durationMs = Date.now() - startTime;
    return result;
  }

  private getApplicablePolicies(context: StepGuardContext): StepGuardPolicy[] {
    const applicable: StepGuardPolicy[] = [];
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;
      if (!this.matchesPatterns(policy.agentPatterns, context.agentId)) continue;
      if (policy.stepTypes && !policy.stepTypes.includes(context.stepType)) continue;
      if (context.workflowId && !this.matchesPatterns(policy.workflowPatterns, context.workflowId)) continue;
      applicable.push(policy);
    }
    return applicable;
  }

  private matchesStep(pattern: string, stepId: string): boolean {
    if (pattern === '*') return true;
    return this.globMatch(pattern, stepId);
  }

  private matchesPatterns(patterns: string[], value: string): boolean {
    return patterns.some((pattern) => pattern === '*' || this.globMatch(pattern, value));
  }

  private globMatch(pattern: string, value: string): boolean {
    try {
      const regex = new RegExp(`^${pattern.split('*').map(this.escapeRegex).join('.*')}$`);
      return regex.test(value);
    } catch {
      console.warn(`[step-guard] Invalid glob pattern: "${pattern}"`);
      return false;
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private registerDefaultGates(): void {
    this.gateRegistry.register('validation', async (context) => {
      const config = context.stepConfig;
      const errors: string[] = [];
      const warnings: string[] = [];

      if (config != null && Object.keys(config).length > 0) {
        switch (context.stepType) {
          case 'prompt':
            if (!config.prompt && !config.template) {
              errors.push('Prompt step requires "prompt" or "template" in config');
            }
            break;
          case 'tool':
            if (!config.toolName && !config.tool) {
              errors.push('Tool step requires "toolName" or "tool" in config');
            }
            break;
          case 'conditional':
            if (!config.condition && !config.when) {
              errors.push('Conditional step requires "condition" or "when" in config');
            }
            break;
          case 'loop':
            if (!config.items && !config.count && !config.until) {
              errors.push('Loop step requires "items", "count", or "until" in config');
            }
            break;
          case 'parallel':
            break;
          case 'discuss':
            if (!config.prompt && !config.topic) {
              errors.push('Discuss step requires "prompt" or "topic" in config');
            }
            break;
          case 'delegate':
            if (!config.agentId && !config.targetAgent) {
              errors.push('Delegate step requires "agentId" or "targetAgent" in config');
            }
            break;
        }
      }

      if (!/^[a-z][a-z0-9-]*$/.test(context.stepId)) {
        warnings.push(`Step ID "${context.stepId}" should be kebab-case (lowercase letters, numbers, hyphens)`);
      }

      if (errors.length > 0) {
        return {
          gateId: 'validation',
          status: 'FAIL' as GuardCheckStatus,
          message: `Validation failed: ${errors.join('; ')}`,
          details: { errors, warnings },
        };
      }

      if (warnings.length > 0) {
        return {
          gateId: 'validation',
          status: 'WARN' as GuardCheckStatus,
          message: `Validation passed with warnings: ${warnings.join('; ')}`,
          details: { warnings },
        };
      }

      return {
        gateId: 'validation',
        status: 'PASS' as GuardCheckStatus,
        message: 'Step configuration is valid',
        details: { stepType: context.stepType },
      };
    });

    this.gateRegistry.register('capability', async (context) => {
      const warnings: string[] = [];
      const config = context.stepConfig;

      switch (context.stepType) {
        case 'prompt':
        case 'discuss':
          break;
        case 'tool': {
          const toolName = config?.toolName ?? config?.tool;
          if (toolName && typeof toolName === 'string') {
            const knownTools = ['read', 'write', 'search', 'execute', 'fetch'];
            if (!knownTools.includes(toolName.toLowerCase())) {
              warnings.push(`Tool "${toolName}" may require custom executor`);
            }
          }
          break;
        }
        case 'delegate': {
          const targetAgent = config?.agentId ?? config?.targetAgent;
          if (!targetAgent) {
            warnings.push('Delegate step has no target agent specified');
          }
          break;
        }
      }

      if (warnings.length > 0) {
        return {
          gateId: 'capability',
          status: 'WARN' as GuardCheckStatus,
          message: `Capability warnings: ${warnings.join('; ')}`,
          details: { warnings, agentId: context.agentId },
        };
      }

      return {
        gateId: 'capability',
        status: 'PASS' as GuardCheckStatus,
        message: `Agent ${context.agentId} has required capabilities for ${context.stepType} step`,
        details: { stepType: context.stepType },
      };
    });

    this.gateRegistry.register('resource', async (context) => {
      const issues: string[] = [];
      const MAX_STEPS_WARNING = 50;
      const MAX_STEPS_LIMIT = 100;

      if (context.totalSteps > MAX_STEPS_LIMIT) {
        return {
          gateId: 'resource',
          status: 'FAIL' as GuardCheckStatus,
          message: `Workflow exceeds maximum step limit (${String(context.totalSteps)} > ${String(MAX_STEPS_LIMIT)})`,
          details: {
            totalSteps: context.totalSteps,
            limit: MAX_STEPS_LIMIT,
          },
        };
      }

      if (context.totalSteps > MAX_STEPS_WARNING) {
        issues.push(`Workflow has ${String(context.totalSteps)} steps (warning threshold: ${String(MAX_STEPS_WARNING)})`);
      }

      const outputKeys = Object.keys(context.previousOutputs ?? {});
      const currentStepOutputCount = outputKeys.filter((key) => key.startsWith(context.stepId)).length;
      if (currentStepOutputCount > 5) {
        issues.push(`Step "${context.stepId}" has run ${String(currentStepOutputCount)} times - possible loop`);
      }

      if (issues.length > 0) {
        return {
          gateId: 'resource',
          status: 'WARN' as GuardCheckStatus,
          message: `Resource warnings: ${issues.join('; ')}`,
          details: {
            stepIndex: context.stepIndex,
            totalSteps: context.totalSteps,
            warnings: issues,
          },
        };
      }

      return {
        gateId: 'resource',
        status: 'PASS' as GuardCheckStatus,
        message: 'Resource limits not exceeded',
        details: {
          stepIndex: context.stepIndex,
          totalSteps: context.totalSteps,
          remainingSteps: context.totalSteps - context.stepIndex - 1,
        },
      };
    });

    this.gateRegistry.register('progress', async (context) => {
      const progress = context.totalSteps > 0
        ? ((context.stepIndex + 1) / context.totalSteps) * 100
        : 0;
      return {
        gateId: 'progress',
        status: 'PASS' as GuardCheckStatus,
        message: `Execution at ${progress.toFixed(0)}%`,
        details: {
          stepIndex: context.stepIndex,
          totalSteps: context.totalSteps,
          percentComplete: progress,
        },
      };
    });

    this.gateRegistry.register('path_violation', async (context) => {
      const changedPaths = extractChangedPaths(context);
      const allowedPaths = normalizeStringArray(
        context.stepConfig?.allowedPaths ?? context.stepConfig?.pathsAllowlist,
      );

      if (changedPaths.length === 0) {
        return {
          gateId: 'path_violation',
          status: 'PASS' as GuardCheckStatus,
          message: 'No changed paths declared for this step',
          details: { changedPaths: [] },
        };
      }

      if (allowedPaths.length === 0) {
        return {
          gateId: 'path_violation',
          status: 'WARN' as GuardCheckStatus,
          message: 'Changed paths were provided but no allowed-path policy was configured',
          details: { changedPaths },
          suggestion: 'Provide stepConfig.allowedPaths to enforce a workspace write boundary.',
        };
      }

      const violations = changedPaths.filter((path) => !matchesAnyPattern(path, allowedPaths));
      if (violations.length > 0) {
        return {
          gateId: 'path_violation',
          status: 'FAIL' as GuardCheckStatus,
          message: `Changed paths fall outside the allowed scope: ${violations.join(', ')}`,
          details: { changedPaths, allowedPaths, violations },
          suggestion: 'Restrict writes to allowed paths or widen the allowlist explicitly.',
        };
      }

      return {
        gateId: 'path_violation',
        status: 'PASS' as GuardCheckStatus,
        message: 'All changed paths are within the allowed scope',
        details: { changedPaths, allowedPaths },
      };
    });

    this.gateRegistry.register('change_radius', async (context) => {
      const changedPaths = extractChangedPaths(context);
      const limit = extractChangeRadiusLimit(context.stepConfig);

      if (changedPaths.length === 0) {
        return {
          gateId: 'change_radius',
          status: 'PASS' as GuardCheckStatus,
          message: 'No changed paths declared for this step',
          details: { changedPaths: [], limit },
        };
      }

      if (changedPaths.length > limit) {
        return {
          gateId: 'change_radius',
          status: 'FAIL' as GuardCheckStatus,
          message: `Change radius exceeded (${String(changedPaths.length)} files > ${String(limit)} allowed)`,
          details: { changedPaths, limit, changedCount: changedPaths.length },
          suggestion: 'Reduce the number of touched files or raise the explicit changeRadius budget.',
        };
      }

      return {
        gateId: 'change_radius',
        status: 'PASS' as GuardCheckStatus,
        message: `Change radius within limit (${String(changedPaths.length)}/${String(limit)})`,
        details: { changedPaths, limit, changedCount: changedPaths.length },
      };
    });

    this.gateRegistry.register('sensitive_change', async (context) => {
      const changedPaths = extractChangedPaths(context);
      const sensitivePaths = normalizeStringArray(context.stepConfig?.sensitivePaths);
      const patterns = sensitivePaths.length > 0 ? sensitivePaths : DEFAULT_SENSITIVE_PATH_PATTERNS;

      const matches = changedPaths.filter((path) => matchesAnyPattern(path, patterns));
      if (matches.length > 0) {
        return {
          gateId: 'sensitive_change',
          status: 'FAIL' as GuardCheckStatus,
          message: `Sensitive paths were targeted: ${matches.join(', ')}`,
          details: { changedPaths, sensitivePaths: patterns, matches },
          suggestion: 'Require explicit human review before changing sensitive paths.',
        };
      }

      return {
        gateId: 'sensitive_change',
        status: 'PASS' as GuardCheckStatus,
        message: 'No sensitive paths were targeted',
        details: { changedPaths, sensitivePaths: patterns },
      };
    });

    this.gateRegistry.register('secrets_detection', async (context) => {
      const matches = collectPotentialSecrets(context.stepConfig, context.previousOutputs);
      if (matches.length > 0) {
        return {
          gateId: 'secrets_detection',
          status: 'FAIL' as GuardCheckStatus,
          message: `Potential secret material detected: ${matches.map((match) => match.pattern).join(', ')}`,
          details: { matches },
          suggestion: 'Remove credentials or secret-like content before continuing.',
        };
      }

      return {
        gateId: 'secrets_detection',
        status: 'PASS' as GuardCheckStatus,
        message: 'No obvious secret material detected in step content',
        details: {},
      };
    });
  }
}

const DEFAULT_CHANGE_RADIUS_LIMIT = 10;
const DEFAULT_SENSITIVE_PATH_PATTERNS = [
  '.github/**',
  'auth/**',
  'infra/**',
  'config/secrets/**',
  '.env*',
  '**/*.pem',
  '**/id_rsa*',
];

const SECRET_PATTERNS: Array<{ pattern: string; regex: RegExp }> = [
  { pattern: 'private-key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { pattern: 'openai-key', regex: /\bsk-[A-Za-z0-9]{16,}\b/ },
  { pattern: 'aws-secret', regex: /\b(?:aws[_-]?secret|secret[_-]?access[_-]?key)\b.{0,20}[A-Za-z0-9/+]{20,}/i },
  { pattern: 'generic-token', regex: /\b(?:api[_-]?key|token|secret)\b\s*[:=]\s*['"][^'"\n]{8,}['"]/i },
];

function extractChangedPaths(context: StepGuardContext): string[] {
  const stepConfig = context.stepConfig ?? {};
  return normalizeStringArray(
    stepConfig.changedPaths
      ?? stepConfig.paths
      ?? stepConfig.files
      ?? context.previousOutputs.changedPaths
      ?? context.previousOutputs.paths
      ?? context.previousOutputs.files,
  );
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => normalizeWorkspacePath(entry))
    : [];
}

function extractChangeRadiusLimit(stepConfig: StepGuardContext['stepConfig']): number {
  const raw = stepConfig?.changeRadius
    ?? stepConfig?.maxChangedFiles
    ?? stepConfig?.maxFiles;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_CHANGE_RADIUS_LIMIT;
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function matchesAnyPattern(path: string, patterns: string[]): boolean {
  const normalizedPath = normalizeWorkspacePath(path);
  return patterns.some((pattern) => globMatchPattern(normalizedPath, pattern));
}

function globMatchPattern(value: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }
  const normalizedPattern = normalizeWorkspacePath(pattern);
  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function collectPotentialSecrets(
  stepConfig: StepGuardContext['stepConfig'],
  previousOutputs: StepGuardContext['previousOutputs'],
): Array<{ pattern: string; snippet: string }> {
  const values = [
    ...collectStringValues(stepConfig),
    ...collectStringValues(previousOutputs),
  ];
  const findings: Array<{ pattern: string; snippet: string }> = [];
  for (const value of values) {
    for (const matcher of SECRET_PATTERNS) {
      const match = value.match(matcher.regex);
      if (match !== null) {
        findings.push({
          pattern: matcher.pattern,
          snippet: match[0].slice(0, 80),
        });
      }
    }
  }
  return findings;
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringValues(entry, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap((entry) => collectStringValues(entry, depth + 1));
  }
  return [];
}

export function createGateRegistry(): GateRegistry {
  const gates = new Map<string, GateCheckFn>();
  return {
    register(gateId: string, check: GateCheckFn): void {
      gates.set(gateId, check);
    },
    get(gateId: string): GateCheckFn | undefined {
      return gates.get(gateId);
    },
    has(gateId: string): boolean {
      return gates.has(gateId);
    },
    list(): string[] {
      return Array.from(gates.keys());
    },
  };
}

export function createStepGuardEngine(config?: Partial<StepGuardEngineConfig>): StepGuardEngine {
  return new StepGuardEngine(config);
}

export class ProgressTracker {
  private readonly executionId: string;
  private readonly agentId: string;
  private readonly sessionId: string | undefined;
  private readonly totalSteps: number;
  private readonly onEvent: (event: StageProgressEvent) => void;

  constructor(
    executionId: string,
    agentId: string,
    totalSteps: number,
    onEvent: (event: StageProgressEvent) => void,
    sessionId?: string,
  ) {
    this.executionId = executionId;
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.totalSteps = totalSteps;
    this.onEvent = onEvent;
  }

  starting(stepIndex: number, stepId: string, stepType: string): void {
    this.emit(stepIndex, stepId, stepType, 'starting');
  }

  completed(stepIndex: number, stepId: string, stepType: string, durationMs: number): void {
    this.emit(stepIndex, stepId, stepType, 'completed', { durationMs });
  }

  failed(stepIndex: number, stepId: string, stepType: string, error: string, durationMs: number): void {
    this.emit(stepIndex, stepId, stepType, 'failed', { durationMs, error });
  }

  skipped(stepIndex: number, stepId: string, stepType: string): void {
    this.emit(stepIndex, stepId, stepType, 'skipped');
  }

  blocked(stepIndex: number, stepId: string, stepType: string, guardResult: StepGuardResult): void {
    this.emit(stepIndex, stepId, stepType, 'blocked', { guardResult });
  }

  private emit(
    stepIndex: number,
    stepId: string,
    stepType: string,
    status: StageProgressStatus,
    options: {
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
    } = {},
  ): void {
    const eventOptions: {
      sessionId?: string;
      durationMs?: number;
      error?: string;
      guardResult?: StepGuardResult;
    } = { ...options };

    if (this.sessionId !== undefined) {
      eventOptions.sessionId = this.sessionId;
    }

    const event = createProgressEvent(
      this.executionId,
      this.agentId,
      stepIndex,
      this.totalSteps,
      stepId,
      stepType,
      status,
      eventOptions,
    );
    this.onEvent(event);
  }
}

export function createProgressTracker(
  executionId: string,
  agentId: string,
  totalSteps: number,
  onEvent: (event: StageProgressEvent) => void,
  sessionId?: string,
): ProgressTracker {
  return new ProgressTracker(executionId, agentId, totalSteps, onEvent, sessionId);
}
