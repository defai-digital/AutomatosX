/**
 * Type definitions for the SpecKit Auto-Generation System
 *
 * SpecKit generates documentation and specifications from codebases:
 * - ADRs (Architectural Decision Records)
 * - PRDs (Product Requirements Documents)
 * - API specifications (OpenAPI/Swagger)
 * - Test specifications
 * - Migration guides
 */

/**
 * Base options for all spec generators
 */
export interface GenerateOptions {
  /** Project root directory to analyze */
  projectRoot: string;

  /** Output file path */
  outputPath: string;

  /** AI provider to use for generation */
  provider?: 'claude' | 'gpt4' | 'gemini';

  /** Whether to enable caching */
  enableCache?: boolean;

  /** Additional context or instructions */
  context?: string;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * ADR-specific generation options
 */
export interface ADRGenerateOptions extends GenerateOptions {
  /** Specific pattern to document (e.g., 'state-machine', 'dependency-injection') */
  pattern?: string;

  /** Include code examples in ADR */
  includeExamples?: boolean;

  /** ADR template to use */
  template?: 'standard' | 'y-statement' | 'alexandrian';
}

/**
 * PRD-specific generation options
 */
export interface PRDGenerateOptions extends GenerateOptions {
  /** Feature or system to document */
  feature?: string;

  /** Include technical architecture section */
  includeArchitecture?: boolean;

  /** Include user stories */
  includeUserStories?: boolean;

  /** Target audience */
  audience?: 'technical' | 'business' | 'mixed';
}

/**
 * API spec generation options
 */
export interface APISpecGenerateOptions extends GenerateOptions {
  /** API framework (express, fastify, etc.) */
  framework?: string;

  /** OpenAPI version */
  openApiVersion?: '3.0' | '3.1';

  /** Include example requests/responses */
  includeExamples?: boolean;

  /** Base URL for API */
  baseUrl?: string;
}

/**
 * Test spec generation options
 */
export interface TestSpecGenerateOptions extends GenerateOptions {
  /** Test framework (vitest, jest, etc.) */
  framework?: string;

  /** Include coverage report */
  includeCoverage?: boolean;

  /** Test type (unit, integration, e2e) */
  testType?: 'unit' | 'integration' | 'e2e' | 'all';
}

/**
 * Migration guide generation options
 */
export interface MigrationGenerateOptions extends GenerateOptions {
  /** Source version */
  fromVersion: string;

  /** Target version */
  toVersion: string;

  /** Include breaking changes section */
  includeBreakingChanges?: boolean;

  /** Include code migration examples */
  includeCodeExamples?: boolean;
}

/**
 * Result of code analysis phase
 */
export interface AnalysisResult {
  /** Files analyzed */
  files: AnalyzedFile[];

  /** Detected patterns */
  patterns: DetectedPattern[];

  /** Statistics */
  stats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  };

  /** Dependencies found */
  dependencies: Dependency[];

  /** Architectural insights */
  architecture: ArchitecturalInsight[];
}

/**
 * Analyzed file information
 */
export interface AnalyzedFile {
  path: string;
  language: string;
  lines: number;
  symbols: Symbol[];
  imports: string[];
  exports: string[];
}

/**
 * Detected pattern in codebase
 */
export interface DetectedPattern {
  type: string;
  name: string;
  description: string;
  locations: PatternLocation[];
  confidence: number;
  examples: CodeExample[];
}

/**
 * Location where pattern is used
 */
export interface PatternLocation {
  file: string;
  line: number;
  context: string;
}

/**
 * Code example
 */
export interface CodeExample {
  code: string;
  language: string;
  explanation: string;
}

/**
 * Dependency information
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'system' | 'internal';
  usageCount: number;
}

/**
 * Architectural insight
 */
export interface ArchitecturalInsight {
  category: 'pattern' | 'anti-pattern' | 'best-practice' | 'tech-debt';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

/**
 * Symbol information
 */
export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant';
  line: number;
  signature?: string;
}

/**
 * Generation result
 */
export interface GenerateResult {
  /** Success status */
  success: boolean;

  /** Output file path */
  outputPath: string;

  /** Generated content */
  content: string;

  /** Generation metadata */
  metadata: GenerationMetadata;

  /** Validation results */
  validation?: ValidationResult;

  /** Error message if failed */
  error?: string;
}

/**
 * Generation metadata
 */
export interface GenerationMetadata {
  /** Generator type */
  generator: 'adr' | 'prd' | 'api' | 'test' | 'migration';

  /** Generation timestamp */
  timestamp: Date;

  /** Files analyzed */
  filesAnalyzed: number;

  /** Patterns detected */
  patternsDetected: number;

  /** AI provider used */
  provider: string;

  /** Generation time (ms) */
  generationTime: number;

  /** Cache hit */
  cacheHit: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
}

/**
 * Progress callback for generation
 */
export type ProgressCallback = (stage: GenerationStage, progress: number) => void;

/**
 * Generation stage
 */
export type GenerationStage =
  | 'analyzing'
  | 'detecting'
  | 'generating'
  | 'formatting'
  | 'validating'
  | 'saving';

/**
 * Cache entry for generation results
 */
export interface CacheEntry {
  key: string;
  content: string;
  metadata: GenerationMetadata;
  expiresAt: Date;
}
