/**
 * Shared Types for AutomatosX Spec-Kit Auto-Generation System
 *
 * Week 3-4 Implementation - Day 1
 * Defines common interfaces, types, and enums used across all generators
 */
/**
 * Generator Types
 */
export type GeneratorType = 'spec' | 'plan' | 'dag' | 'scaffold' | 'test';
/**
 * Output Formats
 */
export type OutputFormat = 'yaml' | 'json' | 'markdown' | 'ascii' | 'dot' | 'mermaid';
/**
 * DAG output format
 */
export type DAGFormat = 'ascii' | 'dot' | 'mermaid';
/**
 * Base Generator Options
 */
export interface BaseGeneratorOptions {
    /** Output directory path */
    outputPath?: string;
    /** Project name */
    projectName?: string;
    /** Output format */
    format?: OutputFormat;
    /** Verbose logging */
    verbose?: boolean;
}
/**
 * SpecGenerator Options
 */
export interface SpecOptions extends BaseGeneratorOptions {
    /** Restrict to specific agents */
    agents?: string[];
    /** Maximum number of steps */
    maxSteps?: number;
    /** Include retry configuration */
    includeRetry?: boolean;
    /** Include cost estimates */
    includeCost?: boolean;
}
/**
 * PlanGenerator Options
 */
export interface PlanOptions extends BaseGeneratorOptions {
    /** Include cost breakdown */
    includeCost?: boolean;
    /** Include time estimates */
    includeTime?: boolean;
    /** Include resource allocation */
    includeResources?: boolean;
    /** Optimization level: 'speed' | 'cost' | 'balanced' */
    optimize?: 'speed' | 'cost' | 'balanced';
}
/**
 * DAGGenerator Options
 */
export interface DAGOptions extends BaseGeneratorOptions {
    /** Output format (overrides BaseGeneratorOptions.format) */
    format?: DAGFormat;
    /** Highlight critical path */
    highlightCriticalPath?: boolean;
    /** Include step details (duration, etc.) */
    includeStepDetails?: boolean;
    /** Graph orientation: Top-Bottom or Left-Right */
    orientation?: 'TB' | 'LR';
    /** Node labeling strategy */
    nodeLabels?: 'id' | 'name' | 'both';
}
/**
 * ScaffoldGenerator Options
 */
export interface ScaffoldOptions extends BaseGeneratorOptions {
    /** Include example files */
    includeExamples?: boolean;
    /** Include test files */
    includeTests?: boolean;
    /** Include documentation */
    includeDocs?: boolean;
    /** Include CI/CD templates */
    includeCI?: boolean;
    /** Template style: 'minimal' | 'standard' | 'complete' */
    template?: 'minimal' | 'standard' | 'complete';
    /** Overwrite existing files */
    overwrite?: boolean;
    /** Dry run mode (don't write files) */
    dryRun?: boolean;
    /** Interactive mode (prompt for overwrites) */
    interactive?: boolean;
}
/**
 * Scaffold generation result
 */
export interface ScaffoldResult {
    /** Output path where project was created */
    outputPath: string;
    /** List of created files (relative paths) */
    createdFiles: string[];
    /** List of created directories (relative paths) */
    createdDirectories: string[];
    /** Summary message */
    summary: string;
}
/**
 * Project structure definition
 */
export interface ProjectStructure {
    /** Directory paths to create */
    directories: string[];
    /** File templates to render */
    fileTemplates: FileTemplate[];
}
/**
 * File template definition
 */
export interface FileTemplate {
    /** Relative path where file should be written */
    path: string;
    /** Template name to use */
    template: string;
    /** Whether file should be executable */
    executable?: boolean;
}
/**
 * Rendered file ready to write
 */
export interface RenderedFile {
    /** Relative path where file should be written */
    path: string;
    /** Rendered content */
    content: string;
    /** Whether file should be executable */
    executable?: boolean;
}
/**
 * Template context for rendering
 */
export interface TemplateContext {
    /** Workflow information */
    workflow: {
        name: string;
        version: string;
        description?: string;
        steps: WorkflowStep[];
        stepCount: number;
    };
    /** Generation options */
    options: {
        includeTests: boolean;
        includeCI: boolean;
        includeDocs: boolean;
    };
    /** Generation timestamp */
    timestamp: string;
    /** Generator version */
    generator: string;
}
/**
 * TestGenerator Options
 */
export interface TestOptions extends BaseGeneratorOptions {
    /** Test framework: 'vitest' | 'jest' | 'mocha' */
    framework?: TestFramework;
    /** Include unit tests (default: true) */
    includeUnit?: boolean;
    /** Include integration tests (default: true) */
    includeIntegration?: boolean;
    /** Include E2E tests (default: true) */
    includeE2E?: boolean;
    /** Include mock files (default: true) */
    includeMocks?: boolean;
    /** Include fixture files (default: true) */
    includeFixtures?: boolean;
    /** Coverage threshold percentage (default: 80) */
    coverageThreshold?: number;
}
/**
 * Test Framework Type
 */
export type TestFramework = 'vitest' | 'jest' | 'mocha';
/**
 * Test Generation Result
 */
export interface TestResult {
    /** Output path where tests were created */
    outputPath: string;
    /** List of created test files */
    createdFiles: string[];
    /** Total number of tests generated */
    testCount: number;
    /** Estimated coverage percentage */
    estimatedCoverage: number;
    /** Summary message */
    summary: string;
}
/**
 * Generated Test File
 */
export interface TestFile {
    /** Relative path to test file */
    path: string;
    /** Test file content */
    content: string;
    /** Number of tests in file */
    testCount: number;
    /** Test framework used */
    framework: TestFramework;
}
/**
 * Mock File
 */
export interface MockFile {
    /** Relative path to mock file */
    path: string;
    /** Mock file content */
    content: string;
    /** Type of mock */
    mockType: 'agent' | 'provider' | 'database' | 'filesystem';
}
/**
 * Fixture File
 */
export interface FixtureFile {
    /** Relative path to fixture file */
    path: string;
    /** Fixture content */
    content: string;
    /** Type of fixture */
    fixtureType: 'workflow' | 'step' | 'error' | 'edge-case';
}
/**
 * Test Analysis Result
 */
export interface TestAnalysis {
    /** Testable steps extracted from workflow */
    steps: TestableStep[];
    /** Execution phases for integration tests */
    phases: TestPhase[];
    /** Step dependency map */
    dependencies: Map<string, string[]>;
    /** Required mocks */
    requiredMocks: MockRequirement[];
    /** Coverage requirements */
    coverageNeeds: CoverageRequirements;
}
/**
 * Testable Step
 */
export interface TestableStep {
    /** Step ID */
    id: string;
    /** Step name */
    name: string;
    /** Agent executing the step */
    agent: string;
    /** Action to perform */
    action: string;
    /** Step configuration */
    config: Record<string, unknown>;
    /** Step dependencies */
    dependencies: string[];
    /** Whether step has side effects */
    hasSideEffects: boolean;
    /** Required mock types */
    requiresMocks: string[];
    /** Estimated duration in ms */
    estimatedDuration: number;
    /** Retry configuration if present */
    retryConfig?: RetryConfig;
    /** Timeout in ms if present */
    timeout?: number;
}
/**
 * Test Phase (for integration tests)
 */
export interface TestPhase {
    /** Phase number (1-based) */
    number: number;
    /** Phase name */
    name: string;
    /** Step IDs in this phase */
    steps: string[];
    /** Whether steps can run in parallel */
    canParallelize: boolean;
    /** Estimated phase duration in ms */
    estimatedDuration: number;
}
/**
 * Mock Requirement
 */
export interface MockRequirement {
    /** Type of mock needed */
    type: 'agent' | 'provider' | 'database' | 'filesystem';
    /** Name of the mocked entity */
    name: string;
    /** Methods/functions to mock */
    methods: string[];
}
/**
 * Coverage Requirements
 */
export interface CoverageRequirements {
    /** Statement coverage target */
    statements: number;
    /** Branch coverage target */
    branches: number;
    /** Function coverage target */
    functions: number;
    /** Line coverage target */
    lines: number;
}
/**
 * Test Expectation
 */
export interface TestExpectation {
    /** Type of expectation */
    type: 'success' | 'error' | 'timeout' | 'value' | 'type';
    /** Expected value (if applicable) */
    value?: unknown;
    /** Matcher to use (e.g., 'toBe', 'toEqual') */
    matcher: string;
    /** Optional assertion message */
    message?: string;
}
/**
 * Generated Spec Result
 */
export interface GeneratedSpec {
    /** YAML content */
    yaml: string;
    /** Parsed workflow definition */
    definition: WorkflowDefinition;
    /** Output file path */
    outputPath: string;
    /** Generation metadata */
    metadata: SpecMetadata;
}
/**
 * Workflow Definition (from WorkflowParser)
 */
export interface WorkflowDefinition {
    name: string;
    version: string;
    description: string;
    steps: WorkflowStep[];
    config?: WorkflowConfig;
}
/**
 * Workflow Step
 */
export interface WorkflowStep {
    id: string;
    name: string;
    agent: string;
    action: string;
    config?: Record<string, unknown>;
    dependsOn?: string[];
    retryConfig?: RetryConfig;
    timeout?: number;
}
/**
 * Workflow Config
 */
export interface WorkflowConfig {
    maxConcurrency?: number;
    defaultTimeout?: number;
    errorHandling?: 'fail-fast' | 'continue' | 'rollback';
}
/**
 * Retry Configuration
 */
export interface RetryConfig {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier?: number;
}
/**
 * Spec Generation Metadata
 */
export interface SpecMetadata {
    /** Number of steps */
    stepsCount: number;
    /** Unique agents used */
    agentsUsed: string[];
    /** Estimated duration in ms */
    estimatedDuration: number;
    /** Estimated cost in USD */
    estimatedCost: number;
    /** Complexity: 'low' | 'medium' | 'high' */
    complexity: 'low' | 'medium' | 'high';
    /** Generation timestamp */
    generatedAt: string;
    /** Generator version */
    generatorVersion: string;
}
/**
 * Execution Plan
 */
export interface ExecutionPlan {
    /** Plan summary */
    summary: string;
    /** Total estimated duration in ms */
    totalDuration: number;
    /** Total estimated cost in USD */
    totalCost: number;
    /** Phases breakdown */
    phases: ExecutionPhase[];
    /** Critical path steps */
    criticalPath: string[];
    /** Resource requirements */
    resources: ResourceRequirements;
    /** Risk assessment */
    risks: RiskAssessment[];
}
/**
 * Execution Phase
 */
export interface ExecutionPhase {
    id: string;
    name: string;
    description: string;
    steps: string[];
    duration: number;
    cost: number;
    parallelizable: boolean;
}
/**
 * Resource Requirements
 */
export interface ResourceRequirements {
    /** Estimated API calls */
    apiCalls: number;
    /** Estimated tokens */
    tokens: number;
    /** Required agents */
    agents: string[];
    /** Concurrent operations */
    maxConcurrency: number;
}
/**
 * Risk Assessment
 */
export interface RiskAssessment {
    /** Risk level: 'low' | 'medium' | 'high' */
    level: 'low' | 'medium' | 'high';
    /** Risk category */
    category: string;
    /** Risk description */
    description: string;
    /** Mitigation strategy */
    mitigation: string;
    /** Impact if occurs */
    impact: string;
}
/**
 * Dependency Graph Node
 */
export interface GraphNode {
    id: string;
    name: string;
    agent: string;
    dependencies: string[];
    /** Node level in topological order */
    level: number;
    /** Is on critical path */
    critical: boolean;
    /** Estimated duration */
    duration: number;
}
/**
 * Dependency Graph Edge
 */
export interface GraphEdge {
    from: string;
    to: string;
    /** Edge type: 'depends' | 'triggers' */
    type: 'depends' | 'triggers';
}
/**
 * DAG Visualization
 */
export interface DAGVisualization {
    /** ASCII art representation */
    ascii?: string;
    /** DOT format (Graphviz) */
    dot?: string;
    /** Mermaid diagram */
    mermaid?: string;
    /** Graph metadata */
    metadata: DAGMetadata;
}
/**
 * DAG Metadata
 */
export interface DAGMetadata {
    /** Total nodes */
    nodeCount: number;
    /** Total edges */
    edgeCount: number;
    /** Maximum depth */
    maxDepth: number;
    /** Critical path length */
    criticalPathLength: number;
    /** Has cycles */
    hasCycles: boolean;
    /** Cycles detected */
    cycles?: string[][];
}
/**
 * Project Scaffold
 */
export interface ProjectScaffold {
    /** Root directory */
    root: string;
    /** Directory structure */
    structure: DirectoryNode;
    /** Generated files */
    files: GeneratedFile[];
    /** Setup instructions */
    instructions: string[];
}
/**
 * Directory Node
 */
export interface DirectoryNode {
    name: string;
    type: 'directory' | 'file';
    children?: DirectoryNode[];
    /** File content (if type === 'file') */
    content?: string;
}
/**
 * Generated File
 */
export interface GeneratedFile {
    path: string;
    content: string;
    /** File type: 'workflow' | 'config' | 'test' | 'doc' */
    type: 'workflow' | 'config' | 'test' | 'doc';
    /** Permissions (octal) */
    permissions?: number;
}
/**
 * Test Suite
 */
export interface TestSuite {
    /** Suite name */
    name: string;
    /** Test files */
    files: TestFile[];
    /** Test configuration */
    config: TestConfig;
    /** Coverage requirements */
    coverage: CoverageConfig;
}
/**
 * Test File
 */
export interface TestFile {
    path: string;
    content: string;
    /** Test type: 'unit' | 'integration' | 'e2e' | 'performance' */
    type: 'unit' | 'integration' | 'e2e' | 'performance';
    /** Target file/module */
    target: string;
}
/**
 * Test Configuration
 */
export interface TestConfig {
    framework: 'vitest' | 'jest' | 'mocha';
    timeout: number;
    /** Test environment */
    environment: 'node' | 'jsdom' | 'happy-dom';
    /** Setup files */
    setupFiles?: string[];
}
/**
 * Coverage Configuration
 */
export interface CoverageConfig {
    /** Line coverage threshold */
    lines: number;
    /** Function coverage threshold */
    functions: number;
    /** Branch coverage threshold */
    branches: number;
    /** Statement coverage threshold */
    statements: number;
}
/**
 * Cost Estimate
 */
export interface CostEstimate {
    /** Provider name */
    provider: string;
    /** Model name */
    model: string;
    /** Estimated input tokens */
    inputTokens: number;
    /** Estimated output tokens */
    outputTokens: number;
    /** Total tokens */
    totalTokens: number;
    /** Cost in USD */
    cost: number;
    /** Cost breakdown */
    breakdown: CostBreakdown;
}
/**
 * Cost Breakdown
 */
export interface CostBreakdown {
    /** Input cost */
    inputCost: number;
    /** Output cost */
    outputCost: number;
    /** Per-request cost */
    requestCost?: number;
    /** Estimated API calls */
    apiCalls: number;
}
/**
 * Validation Result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Generation Context
 */
export interface GenerationContext {
    /** User description */
    description: string;
    /** Available agents */
    availableAgents: AgentInfo[];
    /** Existing workflows */
    existingWorkflows?: WorkflowDefinition[];
    /** Project metadata */
    project?: ProjectMetadata;
}
/**
 * Agent Info
 */
export interface AgentInfo {
    name: string;
    description: string;
    capabilities: string[];
    /** Average execution time in ms */
    avgExecutionTime?: number;
    /** Success rate */
    successRate?: number;
}
/**
 * Project Metadata
 */
export interface ProjectMetadata {
    name: string;
    version: string;
    description: string;
    /** Tech stack */
    stack: string[];
    /** Dependencies */
    dependencies?: Record<string, string>;
}
//# sourceMappingURL=speckit.types.d.ts.map