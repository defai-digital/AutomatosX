import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCommand } from './commands/run.js';
const WORKFLOW_SPEC_BY_ID = {
    ship: {
        commandId: 'ship',
        workflowId: 'ship',
        version: 'v0',
        workflowName: 'ax ship',
        agent: 'quality',
        stages: [
            'Inspect scope and current implementation context',
            'Review quality and risk posture',
            'Summarize test status or recommended test plan',
            'Produce PR-ready summary artifacts',
        ],
        artifactNames: ['review summary', 'test summary or test plan', 'risk notes', 'PR draft summary'],
        positionalArgumentName: 'scope',
        requiredAny: [],
        taskTemplateBase: [
            'Prepare this change for ship readiness.',
            'Inspect the current diff or feature scope and produce a concise ship summary.',
            'Include review findings, test status or recommended test plan, risk notes, and a PR draft summary.',
        ],
        taskTemplateByArgument: {
            scope: 'Focus scope: {{value}}.',
            issue: 'Related issue or requirement: {{value}}.',
            policy: 'Apply policy posture: {{value}}.',
            branch: 'Target branch context: {{value}}.',
        },
    },
    architect: {
        commandId: 'architect',
        workflowId: 'architect',
        version: 'v0',
        workflowName: 'ax architect',
        agent: 'architecture',
        stages: [
            'Interpret requirements and constraints',
            'Develop architecture proposal',
            'Draft ADR and phased implementation plan',
            'Summarize risks and tradeoffs',
        ],
        artifactNames: ['architecture proposal', 'ADR draft', 'phased implementation plan', 'risk matrix'],
        positionalArgumentName: 'request',
        requiredAny: ['request', 'input'],
        taskTemplateBase: [
            'Turn this requirement into an implementation-ready architecture proposal.',
            'Produce an architecture summary, ADR draft, phased implementation plan, and risk matrix.',
        ],
        taskTemplateByArgument: {
            request: 'Primary request: {{value}}.',
            input: 'Reference input file: {{value}}.',
            timeline: 'Target timeline: {{value}}.',
            constraints: 'Constraints: {{value}}.',
        },
    },
    audit: {
        commandId: 'audit',
        workflowId: 'audit',
        version: 'v0',
        workflowName: 'ax audit',
        agent: 'quality',
        stages: [
            'Inspect repository or selected scope',
            'Analyze risks, bottlenecks, and quality gaps',
            'Rank issues by severity',
            'Produce remediation guidance',
        ],
        artifactNames: ['audit report', 'severity ranking', 'bottleneck list', 'remediation plan'],
        positionalArgumentName: 'scope',
        requiredAny: [],
        taskTemplateBase: [
            'Perform a structured audit of this codebase or selected scope.',
            'Identify design drift, dependency risk, quality gaps, and operational bottlenecks.',
            'Produce an audit report with severity ranking and a remediation plan.',
        ],
        taskTemplateByArgument: {
            scope: 'Audit scope: {{value}}.',
            repo: 'Repository or path: {{value}}.',
            depth: 'Audit depth: {{value}}.',
        },
    },
    qa: {
        commandId: 'qa',
        workflowId: 'qa',
        version: 'v0',
        workflowName: 'ax qa',
        agent: 'quality',
        stages: [
            'Interpret target and expected scenarios',
            'Validate user-facing behavior',
            'Capture pass/fail outcomes and defects',
            'Summarize reproduction steps and follow-up actions',
        ],
        artifactNames: ['pass/fail report', 'scenario summary', 'defect summary', 'reproduction steps'],
        positionalArgumentName: 'target',
        requiredAny: ['target', 'url'],
        taskTemplateBase: [
            'Perform a QA validation pass for the provided target.',
            'Check expected behavior, identify defects, and summarize pass/fail outcomes.',
            'Include reproduction steps for issues that are found.',
        ],
        taskTemplateByArgument: {
            target: 'QA target: {{value}}.',
            url: 'Target URL: {{value}}.',
            scenario: 'Expected scenarios: {{value}}.',
        },
    },
    release: {
        commandId: 'release',
        workflowId: 'release',
        version: 'v0',
        workflowName: 'ax release',
        agent: 'writer',
        stages: [
            'Inspect target version and release scope',
            'Summarize merged work and release highlights',
            'Draft release artifacts and upgrade guidance',
            'Produce deployment and docs follow-up checklist',
        ],
        artifactNames: ['changelog draft', 'release notes', 'upgrade notes', 'deployment checklist'],
        positionalArgumentName: 'releaseVersion',
        requiredAny: ['releaseVersion', 'commits', 'target'],
        taskTemplateBase: [
            'Prepare release artifacts for the requested software delivery scope.',
            'Produce a changelog draft, release notes, upgrade notes, and a deployment checklist.',
        ],
        taskTemplateByArgument: {
            releaseVersion: 'Target version: {{value}}.',
            commits: 'Merged PRs or commits: {{value}}.',
            target: 'Release target: {{value}}.',
        },
    },
};
const CLI_BOOLEAN_OPTIONS = new Set(['dryRun', 'verbose', 'quiet']);
export function parseWorkflowCommandInput(commandId, args, globalProvider) {
    const definition = WORKFLOW_SPEC_BY_ID[commandId];
    const parsed = parseCommandArgs(args);
    const positionalValues = parsed.positionals;
    const parsedArguments = {};
    if (definition.positionalArgumentName !== undefined && positionalValues[0] !== undefined) {
        parsedArguments[definition.positionalArgumentName] = positionalValues[0];
    }
    for (const [key, value] of Object.entries(parsed.options)) {
        const normalized = normalizeBooleanValue(value);
        parsedArguments[key] = normalized;
    }
    return {
        commandId,
        arguments: parsedArguments,
        options: {
            provider: (typeof globalProvider === 'string' && globalProvider.length > 0)
                ? globalProvider
                : (typeof parsed.stringOptions.provider === 'string' && parsed.stringOptions.provider.length > 0 ? parsed.stringOptions.provider : undefined),
            dryRun: parsed.boolOptions.dryRun,
            outputDir: parsed.stringOptions.outputDir,
            verbose: parsed.boolOptions.verbose,
            quiet: parsed.boolOptions.quiet,
        },
    };
}
export function validateWorkflowInput(input) {
    const spec = WORKFLOW_SPEC_BY_ID[input.commandId];
    const hasOneRequired = spec.requiredAny.length === 0 || spec.requiredAny.some((key) => hasInputValue(input.arguments[key]));
    if (!hasOneRequired) {
        const required = spec.requiredAny.join(' or ');
        return `A ${required} is required for ${spec.commandId}`;
    }
    return null;
}
export function buildWorkflowInput(input) {
    const spec = WORKFLOW_SPEC_BY_ID[input.commandId];
    const traceId = input.traceContext?.parentTraceId ?? randomUUID();
    const task = buildTaskText(spec, input.arguments);
    return {
        workflowId: spec.workflowId,
        workflowName: spec.workflowName,
        traceId,
        agent: spec.agent,
        task,
        arguments: { ...input.arguments },
        options: {
            provider: input.options.provider,
            outputDir: input.options.outputDir,
            verbose: input.options.verbose,
            quiet: input.options.quiet,
        },
        traceContext: input.traceContext,
    };
}
export function preview(input) {
    const spec = WORKFLOW_SPEC_BY_ID[input.commandId];
    const traceId = input.traceContext?.parentTraceId ?? randomUUID();
    const task = buildTaskText(spec, input.arguments);
    return Promise.resolve({
        workflowId: spec.workflowId,
        workflowName: spec.workflowName,
        traceId,
        agent: spec.agent,
        stages: [...spec.stages],
        task,
        artifactNames: [...spec.artifactNames],
        artifactCount: spec.artifactNames.length,
    });
}
export async function dispatch(input, options) {
    const spec = WORKFLOW_SPEC_BY_ID[input.commandId];
    const traceId = input.traceContext?.parentTraceId ?? randomUUID();
    const task = buildTaskText(spec, input.arguments);
    const artifactNames = [...spec.artifactNames];
    const previewData = {
        workflowId: spec.workflowId,
        workflowName: spec.workflowName,
        traceId,
        agent: spec.agent,
        stages: [...spec.stages],
        task,
        artifactNames,
        artifactCount: artifactNames.length,
    };
    const outputDir = resolveOutputDir(input, previewData.traceId);
    const artifactWriteResult = await writeWorkflowArtifacts(previewData, input, 'pending');
    if (input.options.dryRun) {
        const previewResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'preview');
        return {
            ...previewResult,
            success: true,
            traceId,
        };
    }
    const runtimePayload = {
        ...buildWorkflowInput(input),
        traceId,
        options: {
            provider: input.options.provider,
            outputDir,
            verbose: input.options.verbose,
            quiet: input.options.quiet,
        },
        traceContext: input.traceContext,
    };
    const execute = options?.runtimeDispatcher ?? executeWorkflowWithCLI;
    try {
        const execution = await execute(runtimePayload);
        if (execution.success) {
            const successResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'dispatched');
            return {
                ...successResult,
                success: true,
                traceId,
            };
        }
        const failResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'failed', execution.errorMessage);
        return {
            ...failResult,
            success: false,
            traceId,
            errorCode: execution.errorCode ?? 'workflow_dispatch_failed',
            errorMessage: execution.errorMessage ?? 'Workflow dispatch failed',
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'failed', message);
        return {
            ...failResult,
            success: false,
            traceId,
            errorCode: 'workflow_dispatch_failed',
            errorMessage: message,
        };
    }
}
function resolveOutputDir(input, traceId) {
    if (input.options.outputDir !== undefined && input.options.outputDir.length > 0) {
        return input.options.outputDir;
    }
    return join(process.cwd(), '.automatosx', 'workflows', input.commandId, traceId);
}
function hasInputValue(value) {
    return typeof value === 'string' ? value.length > 0 : false;
}
function buildTaskText(spec, values) {
    const parts = [...spec.taskTemplateBase];
    for (const [key, template] of Object.entries(spec.taskTemplateByArgument)) {
        const value = values[key];
        if (typeof value === 'string' && value.length > 0) {
            parts.push(applyTemplate(template, value));
        }
    }
    return parts.join(' ');
}
function applyTemplate(template, value) {
    return template.replaceAll('{{value}}', value);
}
function parseCommandArgs(args) {
    const resultOptions = {};
    const boolOptions = {
        dryRun: false,
        verbose: false,
        quiet: false,
    };
    const stringOptions = {};
    const positionals = [];
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === undefined) {
            continue;
        }
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const raw = arg.slice(2);
        const [rawKey, rawValue] = raw.split('=', 2);
        const normalizedKey = normalizeCliOptionName(rawKey);
        if (normalizedKey.length === 0) {
            continue;
        }
        if (CLI_BOOLEAN_OPTIONS.has(normalizedKey)) {
            if (rawValue !== undefined) {
                boolOptions[normalizedKey] = rawValue !== 'false';
            }
            else {
                boolOptions[normalizedKey] = true;
            }
            continue;
        }
        if (rawValue !== undefined) {
            resultOptions[normalizedKey] = rawValue;
            stringOptions[normalizedKey] = rawValue;
            continue;
        }
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
            resultOptions[normalizedKey] = next;
            stringOptions[normalizedKey] = next;
            i += 1;
            continue;
        }
        resultOptions[normalizedKey] = 'true';
        stringOptions[normalizedKey] = 'true';
    }
    return { positionals, options: resultOptions, boolOptions, stringOptions };
}
function normalizeCliOptionName(rawKey) {
    if (rawKey === undefined) {
        return '';
    }
    return rawKey.replace(/-([a-z])/g, (_match, character) => character.toUpperCase());
}
function normalizeBooleanValue(value) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return value;
}
async function writeWorkflowArtifacts(preview, input, status) {
    const outputDir = resolveOutputDir(input, preview.traceId);
    const artifactsDir = join(outputDir, 'artifacts');
    await mkdir(artifactsDir, { recursive: true });
    const generatedAt = new Date().toISOString();
    const manifestPath = join(outputDir, 'manifest.json');
    const summaryPath = join(outputDir, 'summary.json');
    const artifactPaths = preview.artifactNames.map((artifactName, index) => {
        const fileName = `${String(index + 1).padStart(2, '0')}-${slugifyArtifactName(artifactName)}.md`;
        return join(artifactsDir, fileName);
    });
    const summary = {
        generatedAt,
        workflow: preview.workflowId,
        version: getWorkflowSpecVersion(preview.workflowId),
        name: preview.workflowName,
        traceId: preview.traceId,
        agent: preview.agent,
        task: preview.task,
        status,
        outputDir,
        inputs: { ...input.arguments },
        stages: [...preview.stages],
        artifacts: preview.artifactNames.map((artifactName, index) => ({ name: artifactName, path: artifactPaths[index] ?? join(artifactsDir, `${String(index + 1).padStart(2, '0')}-${slugifyArtifactName(artifactName)}.md`) })),
    };
    const manifest = {
        generatedAt,
        workflow: {
            id: preview.workflowId,
            version: getWorkflowSpecVersion(preview.workflowId),
            name: preview.workflowName,
        },
        traceId: preview.traceId,
        agent: preview.agent,
        status,
        outputDir,
        inputs: { ...input.arguments },
        task: preview.task,
        files: {
            summary: summaryPath,
            artifacts: artifactPaths,
        },
    };
    await Promise.all([
        writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
        writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    ]);
    const artifactContents = await Promise.all(artifactPaths.map(async (path, index) => ({
        path,
        markdown: await renderArtifactMarkdown(preview, index + 1, status),
    })));
    await Promise.all(artifactContents.map(({ path, markdown }) => writeFile(path, `${markdown}\n`, 'utf8')));
    return {
        outputDir,
        manifestPath,
        summaryPath,
        artifactPaths,
    };
}
async function updateWorkflowArtifactsStatus(result, status, errorMessage) {
    const updatedAt = new Date().toISOString();
    const manifestDataRaw = await readFile(result.manifestPath, 'utf8');
    const summaryDataRaw = await readFile(result.summaryPath, 'utf8');
    const manifestData = JSON.parse(manifestDataRaw);
    const summaryData = JSON.parse(summaryDataRaw);
    const updatedArtifacts = await Promise.all(result.artifactPaths.map(async (artifactPath) => {
        const artifactContent = await readFile(artifactPath, 'utf8');
        return { artifactPath, content: artifactContent.replace(/^- Status: .+$/m, `- Status: ${status}`) };
    }));
    await Promise.all([
        writeFile(result.manifestPath, `${JSON.stringify({
            ...manifestData,
            status,
            updatedAt,
            ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        }, null, 2)}\n`, 'utf8'),
        writeFile(result.summaryPath, `${JSON.stringify({
            ...summaryData,
            status,
            updatedAt,
            ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        }, null, 2)}\n`, 'utf8'),
        ...updatedArtifacts.map(({ artifactPath, content }) => writeFile(artifactPath, content, 'utf8')),
    ]);
    const resolvedTraceId = typeof manifestData['traceId'] === 'string' ? manifestData['traceId'] : randomUUID();
    return {
        success: true,
        traceId: resolvedTraceId,
        outputDir: result.outputDir,
        manifestPath: result.manifestPath,
        summaryPath: result.summaryPath,
        artifactPaths: result.artifactPaths,
    };
}
function getWorkflowSpecVersion(workflowId) {
    for (const value of Object.values(WORKFLOW_SPEC_BY_ID)) {
        if (value.workflowId === workflowId) {
            return value.version;
        }
    }
    return 'v0';
}
function slugifyArtifactName(name) {
    return name
        .toLowerCase()
        .replaceAll('/', '-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'artifact';
}
async function renderArtifactMarkdown(preview, index, status) {
    const artifactName = preview.artifactNames[index - 1] ?? `artifact-${index}`;
    const inputRows = Object.entries(previewInputs(preview)).map(([key, value]) => `- ${key}: ${String(value)}`);
    return [
        `# ${artifactName}`,
        '',
        `- Workflow: ${preview.workflowId}@${getWorkflowSpecVersion(preview.workflowId)}`,
        `- Trace ID: ${preview.traceId}`,
        `- Agent: ${preview.agent}`,
        `- Status: ${status}`,
        '',
        '## Inputs',
        ...(inputRows.length > 0 ? inputRows : ['- No explicit workflow inputs were provided.']),
        '',
        '## Task',
        preview.task,
        '',
        `## Notes`,
        `This artifact was generated as part of workflow ${preview.workflowId}.`,
        `Use workflow execution output to replace or enrich this placeholder.`,
    ].join('\n');
}
function previewInputs(preview) {
    return {
        workflowId: preview.workflowId,
        workflowName: preview.workflowName,
        traceId: preview.traceId,
        agent: preview.agent,
        task: preview.task,
    };
}
async function executeWorkflowWithCLI(payload) {
    const runResult = await runCommand([payload.workflowId], toRunOptions(payload));
    if (!runResult.success) {
        return {
            success: false,
            traceId: payload.traceId,
            outputDir: payload.options.outputDir ?? resolveOutputDirFromPayload(payload),
            manifestPath: undefined,
            summaryPath: undefined,
            artifactPaths: [],
            errorCode: 'workflow_runtime_failed',
            errorMessage: runResult.message ?? 'Workflow runtime failed',
        };
    }
    return {
        success: true,
        traceId: payload.traceId,
        outputDir: payload.options.outputDir ?? resolveOutputDirFromPayload(payload),
        manifestPath: undefined,
        summaryPath: undefined,
        artifactPaths: [],
    };
}
function resolveOutputDirFromPayload(payload) {
    if (payload.options.outputDir !== undefined && payload.options.outputDir.length > 0) {
        return payload.options.outputDir;
    }
    return join(process.cwd(), '.automatosx', 'workflows', payload.workflowId, payload.traceId);
}
function toRunOptions(payload) {
    return {
        help: false,
        version: false,
        verbose: Boolean(payload.options.verbose),
        format: 'text',
        workflowDir: undefined,
        workflowId: payload.workflowId,
        traceId: payload.traceId,
        limit: undefined,
        input: undefined,
        iterate: false,
        maxIterations: undefined,
        maxTime: undefined,
        noContext: false,
        category: undefined,
        tags: undefined,
        agent: payload.workflowId,
        task: payload.task,
        core: undefined,
        maxTokens: undefined,
        refresh: undefined,
        compact: false,
        team: undefined,
        provider: payload.options.provider,
        outputDir: payload.options.outputDir,
        dryRun: false,
        quiet: Boolean(payload.options.quiet),
    };
}
