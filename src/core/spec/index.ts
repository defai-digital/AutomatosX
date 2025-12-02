/**
 * Spec-Kit Generation Module
 *
 * v11.0.0: Simplified to generators only (execution removed)
 *
 * Public API for spec file generation and analysis:
 * - PlanGenerator - Generate execution plans
 * - DagGenerator - Generate DAG JSON
 * - ScaffoldGenerator - Generate project structure
 * - TestGenerator - Generate test files
 * - SpecSchemaValidator - Validate spec YAML
 *
 * REMOVED in v11.0.0:
 * - SpecExecutor, SpecRegistry, SpecCache (execution)
 * - SpecEventEmitter, SpecGenerator (runtime)
 *
 * Migration:
 * - Use "ax run <agent> --iterate" for workflow execution
 * - See: docs/migration/spec-kit-deprecation.md
 *
 * @module core/spec
 */

// Generators (kept)
export { PlanGenerator, getDefaultPlanGenerator } from './PlanGenerator.js';
export { DagGenerator, getDefaultDagGenerator, validateDag } from './DagGenerator.js';
export { ScaffoldGenerator, getDefaultScaffoldGenerator } from './ScaffoldGenerator.js';
export { TestGenerator, getDefaultTestGenerator } from './TestGenerator.js';

// Validation (kept for generators)
export { validateSpec } from './SpecSchemaValidator.js';
export { SpecLoader } from './SpecLoader.js';
export { SpecValidator } from './SpecValidator.js';
export { SpecGraphBuilder } from './SpecGraphBuilder.js';

// Types (kept for generators)
export type {
  SpecMetadata,
  SpecTask,
  TaskStatus,
  SpecValidationResult,
  ValidationIssue,
  SpecGraph,
  ParsedSpec
} from '../../types/spec.js';

export { SpecError, SpecErrorCode } from '../../types/spec.js';
