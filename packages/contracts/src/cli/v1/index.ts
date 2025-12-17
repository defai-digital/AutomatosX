/**
 * CLI Domain Contracts v1
 *
 * @packageDocumentation
 */

// CLI Output Protocol Contracts
export {
  // Output Format Types
  CLIOutputFormatSchema,

  // Token Usage
  TokenUsageSchema,

  // Parsed Output
  ParsedCLIOutputSchema,

  // Error Categories
  CLIErrorCategorySchema,
  ERROR_CATEGORY_GUIDANCE,

  // Classified Error
  ClassifiedCLIErrorSchema,

  // Test Fixtures
  RawCLIOutputSchema,
  ExpectedParseResultSchema,
  CLIOutputFixtureSchema,

  // Documentation
  PROVIDER_OUTPUT_FORMATS,

  // Error Codes (output-specific)
  CLIOutputErrorCodes,

  // Validation Functions
  validateCLIOutputFixture,
  safeValidateCLIOutputFixture,
  validateClassifiedCLIError,
  validateParsedCLIOutput,

  // Factory Functions
  createCLIOutputFixture,
  createClassifiedCLIError,
  getErrorCategoryGuidance,

  // Types
  type CLIOutputFormat,
  type TokenUsage,
  type ParsedCLIOutput,
  type CLIErrorCategory,
  type ClassifiedCLIError,
  type RawCLIOutput,
  type ExpectedParseResult,
  type CLIOutputFixture,
  type CLIOutputErrorCode,
} from './output.js';

// CLI Command Contracts
export {
  // Resume Contracts
  ResumeOptionsSchema,
  CheckpointInfoSchema,
  ResumeResultSchema,

  // History Contracts
  RunStatusSchema,
  RunRecordSchema,
  HistoryOptionsSchema,
  HistoryQuerySchema,

  // Status Contracts
  SystemHealthLevelSchema,
  ProviderStatusSchema,
  SystemStatusSchema,
  StatusOptionsSchema,

  // Cleanup Contracts
  CleanupDataTypeSchema,
  CleanupOptionsSchema,
  CleanupTypeResultSchema,
  CleanupResultSchema,

  // Dangerous Operation Contracts
  ImpactLevelSchema,
  DangerousOperationSchema,
  DangerousOpCheckResultSchema,
  DANGEROUS_OPERATIONS,

  // Error Codes
  CLIErrorCodes,

  // Validation Functions
  validateResumeOptions,
  safeValidateResumeOptions,
  validateHistoryOptions,
  safeValidateHistoryOptions,
  validateCleanupOptions,
  safeValidateCleanupOptions,
  validateStatusOptions,

  // Factory Functions
  createDefaultResumeOptions,
  createDefaultHistoryOptions,
  createDefaultCleanupOptions,
  createDefaultStatusOptions,
  getDangerousOperation,
  isDangerousOperation,

  // Types
  type ResumeOptions,
  type CheckpointInfo,
  type ResumeResult,
  type RunStatus,
  type RunRecord,
  type HistoryOptions,
  type HistoryQuery,
  type SystemHealthLevel,
  type ProviderStatus,
  type SystemStatus,
  type StatusOptions,
  type CleanupDataType,
  type CleanupOptions,
  type CleanupTypeResult,
  type CleanupResult,
  type ImpactLevel,
  type DangerousOperation,
  type DangerousOpCheckResult,
  type CLIErrorCode,
} from './schema.js';
