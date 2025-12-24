/**
 * Analysis Service
 *
 * Orchestrates code analysis by gathering context, building prompts,
 * delegating to providers, and parsing responses.
 */

import {
  type AnalysisRequest,
  type AnalysisResult,
  type AnalysisFinding,
  type AnalysisTask,
  filterFindingsBySeverity,
  AnalysisErrorCodes,
} from '@automatosx/contracts';
import type {
  AnalysisService,
  AnalysisServiceDeps,
  AnalysisProvider,
} from './types.js';
import { deduplicateFindings } from './response-parser.js';
import { getTaskDescription } from './prompt-builder.js';

/**
 * Analysis service error
 */
export class AnalysisError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AnalysisError';
  }

  static noFilesFound(): AnalysisError {
    return new AnalysisError(
      AnalysisErrorCodes.NO_FILES_FOUND,
      'No analyzable files found in the specified paths'
    );
  }

  static providerError(message: string): AnalysisError {
    return new AnalysisError(
      AnalysisErrorCodes.PROVIDER_ERROR,
      `Provider error: ${message}`
    );
  }

  static parseError(message: string): AnalysisError {
    return new AnalysisError(
      AnalysisErrorCodes.PARSE_ERROR,
      `Failed to parse response: ${message}`
    );
  }

  static timeout(): AnalysisError {
    return new AnalysisError(
      AnalysisErrorCodes.TIMEOUT,
      'Analysis timed out'
    );
  }
}

/**
 * Creates an analysis service
 */
export function createAnalysisService(deps: AnalysisServiceDeps): AnalysisService {
  const { contextBuilder, promptBuilder, responseParser, providerRouter } = deps;

  return {
    async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
      const startTime = Date.now();

      // 1. Gather code context
      const codeContext = await contextBuilder.gatherCode(request.paths, {
        maxFiles: request.maxFiles,
        maxLinesPerFile: request.maxLinesPerFile,
      });

      if (codeContext.files.length === 0) {
        throw AnalysisError.noFilesFound();
      }

      // 2. Build prompt
      const prompt = promptBuilder.buildPrompt(
        request.task,
        codeContext,
        request.context
      );

      // 3. Get provider
      let provider: AnalysisProvider;
      if (providerRouter) {
        provider = request.providerId
          ? await providerRouter.getProvider(request.providerId)
          : await providerRouter.selectProvider('analysis');
      } else {
        // Use mock provider if no router provided (for testing/standalone)
        provider = createMockProvider();
      }

      // 4. Execute analysis with timeout (using cancellable timeout to prevent timer leaks)
      let response: string;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => { reject(AnalysisError.timeout()); }, request.timeoutMs);
      });

      try {
        const result = await Promise.race([
          provider.complete({
            prompt,
            maxTokens: 4000,
            temperature: 0.1,
          }),
          timeoutPromise,
        ]);

        // Clean up timeout
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }

        if (!result) {
          throw AnalysisError.timeout();
        }

        response = result.content;
      } catch (error) {
        // Clean up timeout on error too
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        if (error instanceof AnalysisError) throw error;
        throw AnalysisError.providerError(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      // 5. Parse response
      let findings = responseParser.parseResponse(response, request.task);

      // 6. Deduplicate findings
      findings = deduplicateFindings(findings);

      // 7. Filter by severity
      findings = filterFindingsBySeverity(findings, request.severity);

      // 8. Sort by severity and confidence
      findings = sortFindings(findings);

      // 9. Generate summary
      const summary = generateSummary(findings, request.task);

      return {
        resultId: crypto.randomUUID(),
        task: request.task,
        findings,
        summary,
        filesAnalyzed: codeContext.files.map((f: { path: string }) => f.path),
        linesAnalyzed: codeContext.totalLines,
        providerId: provider.id,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    },
  };
}

/**
 * Sort findings by severity (critical first) and confidence
 */
function sortFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  const severityOrder: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  return [...findings].sort((a, b) => {
    const severityDiff =
      (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
}

/**
 * Generate summary from findings
 */
function generateSummary(findings: AnalysisFinding[], task: AnalysisTask): string {
  const taskDesc = getTaskDescription(task);

  if (findings.length === 0) {
    return `${taskDesc}: No issues found.`;
  }

  const bySeverity: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }

  const parts: string[] = [`${taskDesc}: Found ${findings.length} issue(s).`];

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  for (const severity of severityOrder) {
    const count = bySeverity[severity];
    if (count && count > 0) {
      parts.push(`${severity}: ${count}`);
    }
  }

  return parts.join(' ');
}

/**
 * Create a mock provider for testing/standalone use
 */
function createMockProvider(): AnalysisProvider {
  return {
    id: 'mock',
    async complete(_request) {
      // Return empty findings in mock mode
      return {
        content: JSON.stringify({ findings: [] }),
      };
    },
  };
}

/**
 * Create a simple provider from a completion function
 */
export function createSimpleProvider(
  id: string,
  completeFn: (prompt: string) => Promise<string>
): AnalysisProvider {
  return {
    id,
    async complete(request) {
      const content = await completeFn(request.prompt);
      return { content };
    },
  };
}
