import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import type { TraceRecord, TraceStore, TraceSurface } from '@defai.digital/trace-store';

export type ReviewFocus = 'all' | 'security' | 'correctness' | 'maintainability';
export type ReviewSeverity = 'critical' | 'warning' | 'note';

export interface ReviewFinding {
  severity: ReviewSeverity;
  category: Exclude<ReviewFocus, 'all'>;
  ruleId: string;
  message: string;
  file: string;
  line: number;
}

export interface RuntimeReviewRequest {
  paths: string[];
  focus?: ReviewFocus;
  maxFiles?: number;
  traceId?: string;
  sessionId?: string;
  basePath: string;
  surface?: TraceSurface;
}

export interface RuntimeReviewResponse {
  traceId: string;
  success: boolean;
  focus: ReviewFocus;
  filesScanned: number;
  findings: ReviewFinding[];
  summary: Record<ReviewSeverity, number>;
  reportPath: string;
  dataPath: string;
  error?: {
    code?: string;
    message?: string;
  };
}

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.tmp', '.automatosx']);

export async function runReviewAnalysis(
  traceStore: TraceStore,
  request: RuntimeReviewRequest,
): Promise<RuntimeReviewResponse> {
  const traceId = request.traceId ?? randomUUID();
  const startedAt = new Date().toISOString();
  const focus = request.focus ?? 'all';
  const maxFiles = request.maxFiles ?? 25;

  await traceStore.upsertTrace({
    traceId,
    workflowId: 'review',
    surface: request.surface ?? 'cli',
    status: 'running',
    startedAt,
    input: {
      paths: request.paths,
      focus,
      maxFiles,
    },
    stepResults: [],
    metadata: {
      sessionId: request.sessionId,
    },
  });

  try {
    const files = await collectFiles(request.paths, maxFiles);
    const findings: ReviewFinding[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      findings.push(...scanFile(file, content, focus, request.basePath));
    }

    const counts = summarizeFindings(findings);
    const artifactDir = join(request.basePath, '.automatosx', 'reviews', traceId);
    const reportPath = join(artifactDir, 'report.md');
    const dataPath = join(artifactDir, 'review.json');
    await mkdir(artifactDir, { recursive: true });
    await writeFile(reportPath, buildMarkdownReport(traceId, focus, files, findings, counts), 'utf8');
    await writeFile(dataPath, `${JSON.stringify({
      traceId,
      focus,
      paths: request.paths,
      files: files.map((file) => relative(request.basePath, file)),
      findings,
      summary: counts,
    }, null, 2)}\n`, 'utf8');

    const completedAt = new Date().toISOString();
    await traceStore.upsertTrace({
      traceId,
      workflowId: 'review',
      surface: request.surface ?? 'cli',
      status: 'completed',
      startedAt,
      completedAt,
      input: {
        paths: request.paths,
        focus,
        maxFiles,
      },
      stepResults: [
        {
          stepId: 'analyze',
          success: true,
          durationMs: safeDurationMs(startedAt, completedAt),
          retryCount: 0,
        },
      ],
      output: {
        findings,
        summary: counts,
        reportPath,
        dataPath,
      },
      metadata: {
        filesScanned: files.length,
        focus,
        sessionId: request.sessionId,
      },
    });

    return {
      traceId,
      success: true,
      focus,
      filesScanned: files.length,
      findings,
      summary: counts,
      reportPath,
      dataPath,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);

    await traceStore.upsertTrace({
      traceId,
      workflowId: 'review',
      surface: request.surface ?? 'cli',
      status: 'failed',
      startedAt,
      completedAt,
      input: {
        paths: request.paths,
        focus,
        maxFiles,
      },
      stepResults: [
        {
          stepId: 'analyze',
          success: false,
          durationMs: safeDurationMs(startedAt, completedAt),
          retryCount: 0,
          error: message,
        },
      ],
      error: {
        code: 'REVIEW_FAILED',
        message,
      },
      metadata: {
        sessionId: request.sessionId,
      },
    });

    return {
      traceId,
      success: false,
      focus,
      filesScanned: 0,
      findings: [],
      summary: {
        critical: 0,
        warning: 0,
        note: 0,
      },
      reportPath: join(request.basePath, '.automatosx', 'reviews', traceId, 'report.md'),
      dataPath: join(request.basePath, '.automatosx', 'reviews', traceId, 'review.json'),
      error: {
        code: 'REVIEW_FAILED',
        message,
      },
    };
  }
}

export async function listReviewTraces(traceStore: TraceStore, limit?: number): Promise<TraceRecord[]> {
  const traces = await traceStore.listTraces(limit);
  return traces.filter((trace) => trace.workflowId === 'review');
}

function safeDurationMs(startedAt: string, completedAt: string): number {
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

async function collectFiles(inputPaths: string[], maxFiles: number): Promise<string[]> {
  const results: string[] = [];
  for (const rawPath of inputPaths) {
    const filePath = resolve(rawPath);
    await visit(filePath, results, maxFiles);
    if (results.length >= maxFiles) {
      break;
    }
  }
  return results;
}

async function visit(filePath: string, results: string[], maxFiles: number): Promise<void> {
  if (results.length >= maxFiles) {
    return;
  }

  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(filePath);
  } catch {
    return;
  }

  if (stats.isDirectory()) {
    let entries;
    try {
      entries = await readdir(filePath, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      await visit(join(filePath, entry.name), results, maxFiles);
      if (results.length >= maxFiles) {
        break;
      }
    }
    return;
  }

  if (stats.isFile() && ALLOWED_EXTENSIONS.has(extname(filePath))) {
    results.push(filePath);
  }
}

function scanFile(filePath: string, content: string, focus: ReviewFocus, basePath: string): ReviewFinding[] {
  const relativePath = relative(basePath, filePath);
  const lines = content.split('\n');
  const findings: ReviewFinding[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;

    pushFinding(findings, focus, 'security', /(?:eval\(|new Function\()/, {
      severity: 'critical',
      category: 'security',
      ruleId: 'security.dynamic-eval',
      message: 'Avoid dynamic code execution in retained review surface.',
      file: relativePath,
      line: lineNumber,
    }, line);
    pushFinding(findings, focus, 'security', /(?:execSync|exec\(|spawn\(|child_process)/, {
      severity: 'warning',
      category: 'security',
      ruleId: 'security.command-exec',
      message: 'Review shell execution usage and validate inputs carefully.',
      file: relativePath,
      line: lineNumber,
    }, line);
    pushFinding(findings, focus, 'security', /(?:api[_-]?key|secret|token)\s*[:=]\s*['"`][^'"`]+['"`]/i, {
      severity: 'warning',
      category: 'security',
      ruleId: 'security.hardcoded-secret',
      message: 'Potential hardcoded secret detected.',
      file: relativePath,
      line: lineNumber,
    }, line);

    pushFinding(findings, focus, 'correctness', /@ts-ignore/, {
      severity: 'warning',
      category: 'correctness',
      ruleId: 'correctness.ts-ignore',
      message: 'Review suppressed TypeScript errors before release.',
      file: relativePath,
      line: lineNumber,
    }, line);
    pushFinding(findings, focus, 'correctness', /FIXME/, {
      severity: 'warning',
      category: 'correctness',
      ruleId: 'correctness.fixme',
      message: 'Outstanding FIXME indicates incomplete logic or known bug.',
      file: relativePath,
      line: lineNumber,
    }, line);

    pushFinding(findings, focus, 'maintainability', /TODO/, {
      severity: 'note',
      category: 'maintainability',
      ruleId: 'maintainability.todo',
      message: 'TODO found in retained review scope.',
      file: relativePath,
      line: lineNumber,
    }, line);
    pushFinding(findings, focus, 'maintainability', /console\.log\(/, {
      severity: 'note',
      category: 'maintainability',
      ruleId: 'maintainability.console-log',
      message: 'Console logging should be reviewed before shipping.',
      file: relativePath,
      line: lineNumber,
    }, line);
    pushFinding(findings, focus, 'maintainability', /:\s*any\b/, {
      severity: 'note',
      category: 'maintainability',
      ruleId: 'maintainability.any-type',
      message: 'Explicit any reduces type safety and should be reviewed.',
      file: relativePath,
      line: lineNumber,
    }, line);
  }

  return findings;
}

function pushFinding(
  findings: ReviewFinding[],
  focus: ReviewFocus,
  category: Exclude<ReviewFocus, 'all'>,
  pattern: RegExp,
  finding: ReviewFinding,
  line: string,
): void {
  if ((focus === 'all' || focus === category) && pattern.test(line)) {
    findings.push(finding);
  }
}

function summarizeFindings(findings: ReviewFinding[]): Record<ReviewSeverity, number> {
  return {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    warning: findings.filter((finding) => finding.severity === 'warning').length,
    note: findings.filter((finding) => finding.severity === 'note').length,
  };
}

function buildMarkdownReport(
  traceId: string,
  focus: ReviewFocus,
  files: string[],
  findings: ReviewFinding[],
  counts: Record<ReviewSeverity, number>,
): string {
  const lines = [
    `# Review ${traceId}`,
    '',
    `- Focus: ${focus}`,
    `- Files scanned: ${files.length}`,
    `- Critical: ${counts.critical}`,
    `- Warning: ${counts.warning}`,
    `- Note: ${counts.note}`,
    '',
    '## Findings',
  ];

  if (findings.length === 0) {
    lines.push('- No findings detected by the retained v14 review heuristics.');
    return `${lines.join('\n')}\n`;
  }

  for (const finding of findings) {
    lines.push(`- [${finding.severity}] ${finding.file}:${finding.line} ${finding.ruleId} - ${finding.message}`);
  }

  return `${lines.join('\n')}\n`;
}
