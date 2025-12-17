/**
 * Analysis Domain Contracts v1
 *
 * @packageDocumentation
 */

export {
  // Task and Severity Schemas
  AnalysisTaskSchema,
  AnalysisSeverityFilterSchema,
  FindingSeveritySchema,

  // Request/Response Schemas
  AnalysisRequestSchema,
  AnalysisFindingSchema,
  AnalysisResultSchema,

  // Context Schemas
  AnalysisFileSchema,
  CodeContextSchema,

  // Error Codes
  AnalysisErrorCodes,

  // Validation Functions
  validateAnalysisRequest,
  safeValidateAnalysisRequest,
  validateAnalysisFinding,
  safeValidateAnalysisFinding,
  validateAnalysisResult,

  // Factory Functions
  createDefaultAnalysisRequest,
  createAnalysisFinding,

  // Utility Functions
  filterFindingsBySeverity,
  groupFindingsByCategory,
  groupFindingsBySeverity,
  getLanguageFromPath,

  // Types
  type AnalysisTask,
  type AnalysisSeverityFilter,
  type FindingSeverity,
  type AnalysisRequest,
  type AnalysisFinding,
  type AnalysisResult,
  type AnalysisFile,
  type CodeContext,
  type AnalysisErrorCode,
} from './schema.js';
