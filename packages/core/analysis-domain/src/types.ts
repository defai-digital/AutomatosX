/**
 * Analysis Domain Types
 */

import type {
  AnalysisTask,
  AnalysisRequest,
  AnalysisResult,
  AnalysisFinding,
  CodeContext,
  AnalysisFile,
  FindingSeverity,
  AnalysisSeverityFilter,
} from '@defai.digital/contracts';

/**
 * Options for gathering code context
 */
export interface GatherOptions {
  maxFiles: number;
  maxLinesPerFile: number;
  excludePatterns?: string[];
}

/**
 * Code context builder interface
 */
export interface CodeContextBuilder {
  /** Gather code from paths */
  gatherCode(paths: string[], options?: Partial<GatherOptions>): Promise<CodeContext>;
}

/**
 * Analysis prompt builder interface
 */
export interface AnalysisPromptBuilder {
  /** Build prompt for analysis task */
  buildPrompt(task: AnalysisTask, context: CodeContext, userContext?: string): string;
}

/**
 * Analysis response parser interface
 */
export interface AnalysisResponseParser {
  /** Parse LLM response into structured findings */
  parseResponse(response: string, task: AnalysisTask): AnalysisFinding[];
}

/**
 * Provider interface for analysis
 */
export interface AnalysisProvider {
  id: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface ProviderRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  tokensUsed?: number;
}

/**
 * Provider router interface
 */
export interface ProviderRouter {
  /** Get provider by ID */
  getProvider(providerId: string): Promise<AnalysisProvider>;
  /** Select best provider for task */
  selectProvider(task: string): Promise<AnalysisProvider>;
}

/**
 * Analysis service interface
 */
export interface AnalysisService {
  /** Perform analysis */
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
}

/**
 * Dependencies for creating analysis service
 */
export interface AnalysisServiceDeps {
  contextBuilder: CodeContextBuilder;
  promptBuilder: AnalysisPromptBuilder;
  responseParser: AnalysisResponseParser;
  providerRouter?: ProviderRouter;
}

// Re-export contract types
export type {
  AnalysisTask,
  AnalysisRequest,
  AnalysisResult,
  AnalysisFinding,
  CodeContext,
  AnalysisFile,
  FindingSeverity,
  AnalysisSeverityFilter,
};
