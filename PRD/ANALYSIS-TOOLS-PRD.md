# Analysis Tools PRD: LLM-Delegated Bugfix & Refactor

**Version**: 1.0.0
**Date**: 2025-12-15
**Status**: Draft

---

## Executive Summary

Redesign the bugfix and refactor CLI commands to delegate analysis to LLM providers instead of implementing rule-based AST analysis. This approach eliminates false positives while leveraging AutomatosX's existing provider infrastructure.

### Problem Statement

Rule-based AST analysis produces false positives because it matches syntax patterns without understanding semantic intent. This erodes developer trust and wastes time investigating non-issues.

### Solution

Make bugfix/refactor commands thin orchestration wrappers that:
1. Gather code context from specified paths
2. Delegate analysis to LLM provider via routing engine
3. Parse structured responses into contract-compliant results
4. Format output for CLI display

### Architecture Alignment

| Principle | How This PRD Aligns |
|-----------|---------------------|
| **Contract-Driven** | Simplified Zod schemas for analysis requests/results |
| **Domain-Driven** | New `analysis-domain` package for analysis orchestration |
| **Provider-Agnostic** | Uses routing-engine to select provider |
| **Workflow-Compatible** | Analysis can be workflow steps |

---

## Contracts

### Analysis Request Schema

```typescript
// packages/contracts/src/analysis/v1/schema.ts

import { z } from 'zod';

/**
 * Analysis task type
 */
export const AnalysisTaskSchema = z.enum(['bugfix', 'refactor', 'review', 'explain']);
export type AnalysisTask = z.infer<typeof AnalysisTaskSchema>;

/**
 * Analysis severity filter
 */
export const AnalysisSeveritySchema = z.enum(['all', 'medium', 'high', 'critical']);
export type AnalysisSeverity = z.infer<typeof AnalysisSeveritySchema>;

/**
 * Analysis request
 */
export const AnalysisRequestSchema = z.object({
  /** Analysis task type */
  task: AnalysisTaskSchema,

  /** File paths to analyze */
  paths: z.array(z.string()).min(1).max(50),

  /** Additional context for the analysis */
  context: z.string().max(2000).optional(),

  /** Minimum severity to report */
  severity: AnalysisSeveritySchema.default('all'),

  /** Maximum files to analyze */
  maxFiles: z.number().int().min(1).max(100).default(20),

  /** Maximum lines per file to include */
  maxLinesPerFile: z.number().int().min(100).max(5000).default(1000),

  /** Provider to use (optional - uses routing if not specified) */
  providerId: z.string().optional(),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
```

### Analysis Finding Schema

```typescript
/**
 * Single finding from analysis
 */
export const AnalysisFindingSchema = z.object({
  /** Unique finding ID */
  findingId: z.string(),

  /** File path */
  file: z.string(),

  /** Line number (if applicable) */
  line: z.number().int().min(1).optional(),

  /** End line (for ranges) */
  lineEnd: z.number().int().min(1).optional(),

  /** Issue title */
  title: z.string().max(200),

  /** Detailed description */
  description: z.string().max(2000),

  /** Severity level */
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),

  /** Category (for grouping) */
  category: z.string().max(50),

  /** Suggested fix or improvement */
  suggestion: z.string().max(5000).optional(),

  /** Code snippet showing the issue */
  codeSnippet: z.string().max(1000).optional(),

  /** Confidence score 0-1 */
  confidence: z.number().min(0).max(1),
});

export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;
```

### Analysis Result Schema

```typescript
/**
 * Analysis result
 */
export const AnalysisResultSchema = z.object({
  /** Unique result ID */
  resultId: z.string().uuid(),

  /** Task that was performed */
  task: AnalysisTaskSchema,

  /** Findings from analysis */
  findings: z.array(AnalysisFindingSchema),

  /** Summary of findings */
  summary: z.string().max(1000),

  /** Files that were analyzed */
  filesAnalyzed: z.array(z.string()),

  /** Total lines analyzed */
  linesAnalyzed: z.number().int().min(0),

  /** Provider that performed analysis */
  providerId: z.string(),

  /** Analysis duration in ms */
  durationMs: z.number().int().min(0),

  /** Timestamp */
  completedAt: z.string().datetime(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
```

### Error Codes

```typescript
export const AnalysisErrorCodes = {
  NO_FILES_FOUND: 'ANALYSIS_NO_FILES_FOUND',
  FILE_READ_ERROR: 'ANALYSIS_FILE_READ_ERROR',
  PROVIDER_ERROR: 'ANALYSIS_PROVIDER_ERROR',
  PARSE_ERROR: 'ANALYSIS_PARSE_ERROR',
  CONTEXT_TOO_LARGE: 'ANALYSIS_CONTEXT_TOO_LARGE',
  TIMEOUT: 'ANALYSIS_TIMEOUT',
} as const;

export type AnalysisErrorCode = (typeof AnalysisErrorCodes)[keyof typeof AnalysisErrorCodes];
```

---

## Domain: analysis-domain

### Location

`packages/core/analysis-domain/`

### Purpose

Orchestrate code analysis by:
1. Gathering code context from file system
2. Building analysis prompts
3. Delegating to provider
4. Parsing structured responses

### Key Components

#### CodeContextBuilder

```typescript
export interface CodeContextBuilder {
  /** Gather code from paths */
  gatherCode(paths: string[], options: GatherOptions): Promise<CodeContext>;
}

export interface CodeContext {
  files: Array<{
    path: string;
    content: string;
    lines: number;
    language: string;
  }>;
  totalLines: number;
  truncated: boolean;
}

export interface GatherOptions {
  maxFiles: number;
  maxLinesPerFile: number;
  excludePatterns?: string[];
}
```

#### AnalysisPromptBuilder

```typescript
export interface AnalysisPromptBuilder {
  /** Build prompt for analysis task */
  buildPrompt(task: AnalysisTask, context: CodeContext, userContext?: string): string;
}
```

#### AnalysisResponseParser

```typescript
export interface AnalysisResponseParser {
  /** Parse LLM response into structured findings */
  parseResponse(response: string, task: AnalysisTask): AnalysisFinding[];
}
```

#### AnalysisService

```typescript
export interface AnalysisService {
  /** Perform analysis */
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
}
```

### Implementation

```typescript
// packages/core/analysis-domain/src/analysis-service.ts

export function createAnalysisService(deps: {
  contextBuilder: CodeContextBuilder;
  promptBuilder: AnalysisPromptBuilder;
  responseParser: AnalysisResponseParser;
  providerRouter: ProviderRouter;
}): AnalysisService {
  return {
    async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
      const startTime = Date.now();

      // 1. Gather code context
      const codeContext = await deps.contextBuilder.gatherCode(request.paths, {
        maxFiles: request.maxFiles,
        maxLinesPerFile: request.maxLinesPerFile,
      });

      if (codeContext.files.length === 0) {
        throw new AnalysisError(AnalysisErrorCodes.NO_FILES_FOUND);
      }

      // 2. Build prompt
      const prompt = deps.promptBuilder.buildPrompt(
        request.task,
        codeContext,
        request.context
      );

      // 3. Route to provider
      const provider = request.providerId
        ? await deps.providerRouter.getProvider(request.providerId)
        : await deps.providerRouter.selectProvider('analysis');

      // 4. Execute analysis
      const response = await provider.complete({
        prompt,
        maxTokens: 4000,
        temperature: 0.1, // Low temperature for consistent analysis
      });

      // 5. Parse response
      const findings = deps.responseParser.parseResponse(response.content, request.task);

      // 6. Filter by severity
      const filteredFindings = filterBySeverity(findings, request.severity);

      return {
        resultId: crypto.randomUUID(),
        task: request.task,
        findings: filteredFindings,
        summary: generateSummary(filteredFindings, request.task),
        filesAnalyzed: codeContext.files.map(f => f.path),
        linesAnalyzed: codeContext.totalLines,
        providerId: provider.id,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    },
  };
}
```

---

## CLI Commands

### Updated bugfix Command

```typescript
// packages/cli/src/commands/bugfix.ts

export async function bugfixCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const parsed = parseBugfixArgs(args);

  switch (parsed.subcommand) {
    case 'scan':
      return runAnalysis('bugfix', parsed.paths, options);
    case 'help':
    default:
      return showBugfixHelp();
  }
}

async function runAnalysis(
  task: AnalysisTask,
  paths: string[],
  options: CLIOptions
): Promise<CommandResult> {
  if (paths.length === 0) {
    return {
      success: false,
      exitCode: 1,
      message: 'Error: At least one path is required',
      data: undefined,
    };
  }

  try {
    const service = getAnalysisService();
    const result = await service.analyze({
      task,
      paths,
      severity: options.severity ?? 'all',
      maxFiles: options.maxFiles ?? 20,
    });

    if (options.format === 'json') {
      return {
        success: true,
        exitCode: 0,
        message: undefined,
        data: result,
      };
    }

    return {
      success: true,
      exitCode: 0,
      message: formatAnalysisResult(result),
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
    };
  }
}
```

### Updated refactor Command

Same pattern as bugfix, with `task: 'refactor'`.

---

## Prompts

### Bugfix Analysis Prompt

```typescript
const BUGFIX_PROMPT = `You are a code analyzer. Analyze the following code for bugs and potential issues.

Focus on:
- Logic errors
- Null/undefined reference issues
- Resource leaks (unclosed handles, missing cleanup)
- Type mismatches
- Concurrency issues
- Security vulnerabilities
- Error handling gaps

Code to analyze:
{code}

{userContext}

Return your findings as JSON:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Brief issue title",
      "description": "Detailed description of the issue",
      "severity": "high",
      "category": "null-reference",
      "suggestion": "How to fix this issue",
      "confidence": 0.9
    }
  ]
}

Only report actual issues. Do not report style preferences or minor improvements.
If no issues are found, return {"findings": []}.`;
```

### Refactor Analysis Prompt

```typescript
const REFACTOR_PROMPT = `You are a code refactoring advisor. Analyze the following code for refactoring opportunities.

Focus on:
- Functions that are too long or complex
- Duplicate code that could be extracted
- Poor naming that reduces readability
- Complex conditionals that could be simplified
- Opportunities to improve type safety
- Code that violates single responsibility
- Outdated patterns that could be modernized

Code to analyze:
{code}

{userContext}

Return your findings as JSON:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "lineEnd": 60,
      "title": "Brief opportunity title",
      "description": "Description of the refactoring opportunity",
      "severity": "medium",
      "category": "extract-function",
      "suggestion": "Suggested refactoring approach",
      "confidence": 0.85
    }
  ]
}

Focus on impactful improvements. Do not report trivial style issues.
If no opportunities are found, return {"findings": []}.`;
```

---

## Implementation Plan

### Phase 1: Contracts (1 hour)

| Task | File |
|------|------|
| Create analysis schemas | `packages/contracts/src/analysis/v1/schema.ts` |
| Create index | `packages/contracts/src/analysis/v1/index.ts` |
| Update main exports | `packages/contracts/src/index.ts` |

### Phase 2: Analysis Domain (3-4 hours)

| Task | File |
|------|------|
| Create package structure | `packages/core/analysis-domain/` |
| Implement CodeContextBuilder | `src/context-builder.ts` |
| Implement PromptBuilder | `src/prompt-builder.ts` |
| Implement ResponseParser | `src/response-parser.ts` |
| Implement AnalysisService | `src/analysis-service.ts` |
| Create exports | `src/index.ts` |

### Phase 3: CLI Integration (2 hours)

| Task | File |
|------|------|
| Update bugfix command | `packages/cli/src/commands/bugfix.ts` |
| Update refactor command | `packages/cli/src/commands/refactor.ts` |
| Add analysis service factory | `packages/cli/src/services/analysis.ts` |

### Phase 4: Tests (2 hours)

| Task | File |
|------|------|
| Contract tests | `tests/contract/analysis.test.ts` |
| Domain tests | `tests/core/analysis-domain.test.ts` |
| CLI tests | `tests/cli/analysis-commands.test.ts` |

---

## File Structure

```
packages/
├── contracts/src/analysis/v1/
│   ├── schema.ts          # Zod schemas
│   └── index.ts           # Exports
├── core/analysis-domain/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── context-builder.ts
│       ├── prompt-builder.ts
│       ├── response-parser.ts
│       ├── analysis-service.ts
│       ├── types.ts
│       └── index.ts
└── cli/src/
    ├── commands/
    │   ├── bugfix.ts      # Updated
    │   └── refactor.ts    # Updated
    └── services/
        └── analysis.ts    # Service factory

tests/
├── contract/analysis.test.ts
├── core/analysis-domain.test.ts
└── cli/analysis-commands.test.ts
```

---

## Success Criteria

- [ ] Analysis contracts defined with Zod
- [ ] analysis-domain package created
- [ ] CodeContextBuilder gathers code from file paths
- [ ] PromptBuilder creates task-specific prompts
- [ ] ResponseParser extracts findings from LLM response
- [ ] CLI commands delegate to analysis service
- [ ] JSON output supported
- [ ] Graceful error handling
- [ ] Tests pass
- [ ] Build succeeds

---

## Out of Scope

- AST-based rule detection (intentionally removed)
- Auto-apply fixes (future enhancement)
- Caching of analysis results (premature optimization)
- Multi-language support beyond what LLM provides
- IDE integrations

---

## Migration Notes

The existing bugfix/refactor contracts in `packages/contracts/src/bugfix/` and `packages/contracts/src/refactor/` will be **deprecated** but not removed. The new `analysis/v1` contracts replace them with a unified approach.

CLI command interfaces remain backward compatible:
- `ax bugfix scan <paths>` - works as before
- `ax refactor scan <paths>` - works as before

The difference is internal: commands now delegate to LLM instead of returning empty placeholders.
