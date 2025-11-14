# Iterate Mode API Documentation

**AutomatosX v8.0.0 - Programmatic API Reference**

---

## Table of Contents

1. [Overview](#overview)
2. [Core Types](#core-types)
3. [IterateEngine](#iterateengine)
4. [StrategySelector](#strategyselector)
5. [FailureAnalyzer](#failureanalyzer)
6. [SafetyEvaluator](#safetyevaluator)
7. [Usage Examples](#usage-examples)
8. [Error Handling](#error-handling)

---

## Overview

The Iterate Mode API provides programmatic access to AutomatosX's autonomous retry system. Use this API to:

- Integrate retry logic into custom applications
- Build automated testing frameworks
- Create custom retry strategies
- Monitor and analyze retry behavior

### Installation

Iterate Mode is included with AutomatosX v8.0.0:

```bash
npm install automatosx@latest
```

### Basic Import

```typescript
import { IterateEngine } from 'automatosx/services/IterateEngine.js';
import { StrategySelector } from 'automatosx/services/StrategySelector.js';
import { FailureAnalyzer } from 'automatosx/services/FailureAnalyzer.js';
import { SafetyEvaluator } from 'automatosx/services/SafetyEvaluator.js';
import type {
  IterateOptions,
  IterateResult,
  Strategy,
  IterationResult
} from 'automatosx/types/iterate.types.js';
```

---

## Core Types

### IterateOptions

Configuration options for autonomous retry loop.

```typescript
interface IterateOptions {
  /**
   * Maximum number of retry attempts
   * @default 10
   */
  maxIterations: number;

  /**
   * Safety constraint level
   * @default 'normal'
   */
  safetyLevel: 'permissive' | 'normal' | 'paranoid';

  /**
   * Total timeout in milliseconds
   * @default undefined (no timeout)
   */
  timeout?: number;

  /**
   * Create checkpoint every N iterations
   * @default undefined (no checkpoints)
   */
  checkpointInterval?: number;

  /**
   * Strategy selection mode
   * @default 'auto'
   */
  strategySelector?: 'auto' | 'conservative' | 'aggressive';

  /**
   * Callback invoked after each iteration
   * @param iteration - Result of the iteration
   */
  onIteration?: (iteration: IterationResult) => void;

  /**
   * Maximum total cost in USD
   * @default undefined (no cost limit)
   */
  maxCost?: number;

  /**
   * Enable verbose console output
   * @default false
   */
  verbose?: boolean;
}
```

**Example**:
```typescript
const options: IterateOptions = {
  maxIterations: 15,
  safetyLevel: 'normal',
  timeout: 1800000, // 30 minutes
  checkpointInterval: 5,
  maxCost: 50.0,
  verbose: true,
  onIteration: (iteration) => {
    console.log(`Iteration ${iteration.iteration}: ${iteration.success ? 'SUCCESS' : 'FAILED'}`);
  }
};
```

---

### IterateResult

Result returned after iterate loop completes.

```typescript
interface IterateResult {
  /**
   * Whether workflow completed successfully
   */
  success: boolean;

  /**
   * Number of iterations executed
   */
  iterations: number;

  /**
   * Total duration in milliseconds
   */
  totalDuration: number;

  /**
   * Total cost in USD
   */
  totalCost: number;

  /**
   * Final strategy used
   */
  finalStrategy: Strategy;

  /**
   * Complete iteration history
   */
  history: IterationResult[];

  /**
   * Checkpoint IDs created during execution
   */
  checkpoints: string[];

  /**
   * Reason iteration loop stopped
   */
  stopReason: 'success' | 'max_iterations' | 'timeout' | 'safety_violation' | 'cost_limit';

  /**
   * Failure analysis (if failed)
   */
  failureAnalysis?: FailureAnalysis;
}
```

**Example**:
```typescript
const result: IterateResult = await engine.iterate('workflow.yaml', options);

if (result.success) {
  console.log(`Success after ${result.iterations} iterations`);
  console.log(`Total cost: $${result.totalCost.toFixed(2)}`);
} else {
  console.error(`Failed: ${result.stopReason}`);
  console.error(`Last error: ${result.failureAnalysis?.errorType}`);
}
```

---

### Strategy

Retry strategy configuration.

```typescript
interface Strategy {
  /**
   * Unique strategy name
   */
  name: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Strategy-specific configuration
   */
  config: StrategyConfig;

  /**
   * Priority score (1-10, higher = preferred)
   */
  priority: number;

  /**
   * Error types this strategy handles
   */
  applicableErrors: string[];
}

interface StrategyConfig {
  /**
   * Operation timeout in milliseconds
   */
  timeout?: number;

  /**
   * Retry backoff strategy
   */
  retryBackoff?: 'exponential' | 'linear' | 'constant';

  /**
   * Maximum parallel operations
   */
  parallelism?: number;

  /**
   * Enable result caching
   */
  useCache?: boolean;

  /**
   * Enable provider fallback
   */
  fallbackProviders?: boolean;

  /**
   * Skip optional workflow steps
   */
  skipOptionalSteps?: boolean;

  /**
   * Continue execution on step errors
   */
  continueOnError?: boolean;
}
```

**Example**:
```typescript
const customStrategy: Strategy = {
  name: 'custom-slow',
  description: 'Extra-long timeout for very slow operations',
  config: {
    timeout: 1200000, // 20 minutes
    retryBackoff: 'exponential',
    parallelism: 3,
    useCache: true
  },
  priority: 7,
  applicableErrors: ['timeout', 'slow_response']
};
```

---

### IterationResult

Result of a single iteration.

```typescript
interface IterationResult {
  /**
   * Iteration number (1-indexed)
   */
  iteration: number;

  /**
   * Whether iteration succeeded
   */
  success: boolean;

  /**
   * Whether workflow is complete
   */
  complete: boolean;

  /**
   * Strategy used for this iteration
   */
  strategy: Strategy;

  /**
   * Current workflow progress
   */
  progress: ProgressSnapshot;

  /**
   * Iteration duration in milliseconds
   */
  duration: number;

  /**
   * Iteration cost in USD
   */
  cost: number;

  /**
   * Additional metadata
   */
  metadata: Record<string, unknown>;

  /**
   * Error (if failed)
   */
  error?: Error;

  /**
   * Checkpoint ID (if created)
   */
  checkpointId?: string;
}

interface ProgressSnapshot {
  /**
   * Total number of workflow steps
   */
  totalSteps: number;

  /**
   * Number of completed steps
   */
  completedSteps: number;

  /**
   * Number of failed steps
   */
  failedSteps: number;

  /**
   * Completion percentage (0-100)
   */
  completionPercent: number;

  /**
   * Detailed step status
   */
  steps?: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
  }>;
}
```

---

### FailureAnalysis

Detailed analysis of workflow failure.

```typescript
interface FailureAnalysis {
  /**
   * Classified error type
   */
  errorType: 'timeout' | 'rateLimit' | 'network' | 'auth' | 'validation' |
             'resource' | 'provider' | 'permanent' | 'unknown';

  /**
   * Whether error is likely transient
   */
  transient: boolean;

  /**
   * Error severity level
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Detected failure pattern
   */
  pattern?: 'repeated_same_error' | 'consistent_failure' | 'performance_degradation';

  /**
   * Recommended actions
   */
  recommendations: string[];

  /**
   * Analysis confidence (0.0-1.0)
   */
  confidence: number;

  /**
   * Step that failed
   */
  failedStep?: string;
}
```

---

### SafetyEvaluation

Safety constraint check result.

```typescript
interface SafetyEvaluation {
  /**
   * Whether iteration is safe to proceed
   */
  safe: boolean;

  /**
   * Reason if unsafe
   */
  reason?: string;

  /**
   * Warning messages
   */
  warnings: string[];

  /**
   * Calculated risk score (0.0-1.0)
   */
  riskScore: number;

  /**
   * Cumulative cost so far
   */
  costSoFar: number;

  /**
   * Cumulative duration so far
   */
  durationSoFar: number;
}
```

---

## IterateEngine

Main orchestrator for autonomous retry loops.

### Constructor

```typescript
constructor(
  workflowEngine: WorkflowEngine,
  checkpointService: CheckpointService,
  selectionMode: 'auto' | 'conservative' | 'aggressive' = 'auto'
)
```

**Parameters**:
- `workflowEngine`: Engine for executing workflows
- `checkpointService`: Service for creating/restoring checkpoints
- `selectionMode`: Strategy selection mode

**Example**:
```typescript
import { WorkflowEngine } from 'automatosx/services/WorkflowEngine.js';
import { CheckpointService } from 'automatosx/services/CheckpointService.js';

const workflowEngine = new WorkflowEngine();
const checkpointService = new CheckpointService();
const engine = new IterateEngine(workflowEngine, checkpointService, 'auto');
```

---

### iterate()

Execute workflow with autonomous retry loop.

```typescript
async iterate(
  workflowPath: string,
  options: IterateOptions
): Promise<IterateResult>
```

**Parameters**:
- `workflowPath`: Path to workflow definition file
- `options`: Iteration configuration

**Returns**: Promise resolving to IterateResult

**Throws**: Never throws - all errors captured in result

**Example**:
```typescript
const result = await engine.iterate('workflows/data-pipeline.yaml', {
  maxIterations: 10,
  safetyLevel: 'normal',
  timeout: 1800000,
  verbose: true
});

console.log(`Completed in ${result.iterations} iterations`);
```

---

### getStrategySelector()

Get the strategy selector instance.

```typescript
getStrategySelector(): StrategySelector
```

**Returns**: StrategySelector instance

**Example**:
```typescript
const selector = engine.getStrategySelector();
const strategies = selector.listStrategies();
console.log(`Available strategies: ${strategies.map(s => s.name).join(', ')}`);
```

---

### getFailureAnalyzer()

Get the failure analyzer instance.

```typescript
getFailureAnalyzer(): FailureAnalyzer
```

**Returns**: FailureAnalyzer instance

**Example**:
```typescript
const analyzer = engine.getFailureAnalyzer();
// Use for custom failure analysis
```

---

### getSafetyEvaluator()

Get the safety evaluator instance.

```typescript
getSafetyEvaluator(): SafetyEvaluator
```

**Returns**: SafetyEvaluator instance

**Example**:
```typescript
const evaluator = engine.getSafetyEvaluator();
const thresholds = evaluator.getSafetyThresholds('paranoid');
console.log(`Max cost: $${thresholds.maxTotalCost}`);
```

---

## StrategySelector

Selects appropriate retry strategies based on failure analysis.

### Constructor

```typescript
constructor(mode: 'auto' | 'conservative' | 'aggressive' = 'auto')
```

**Example**:
```typescript
const selector = new StrategySelector('auto');
```

---

### selectInitial()

Select strategy for first iteration.

```typescript
async selectInitial(): Promise<Strategy>
```

**Returns**: Default strategy (always)

**Example**:
```typescript
const initial = await selector.selectInitial();
console.log(initial.name); // "default"
```

---

### selectNext()

Select next strategy based on failure analysis.

```typescript
async selectNext(
  analysis: FailureAnalysis,
  history: IterationResult[]
): Promise<Strategy>
```

**Parameters**:
- `analysis`: Failure analysis from previous iteration
- `history`: Complete iteration history

**Returns**: Most appropriate strategy

**Example**:
```typescript
const analysis: FailureAnalysis = {
  errorType: 'timeout',
  transient: true,
  severity: 'medium',
  recommendations: ['Increase timeout'],
  confidence: 0.9
};

const next = await selector.selectNext(analysis, []);
console.log(next.name); // "aggressive-timeout"
```

---

### getStrategy()

Get strategy by name.

```typescript
getStrategy(name: string): Strategy | undefined
```

**Parameters**:
- `name`: Strategy name

**Returns**: Strategy if found, undefined otherwise

**Example**:
```typescript
const strategy = selector.getStrategy('fallback-providers');
if (strategy) {
  console.log(strategy.description);
}
```

---

### listStrategies()

List all available strategies.

```typescript
listStrategies(): Strategy[]
```

**Returns**: Array of all strategies

**Example**:
```typescript
const strategies = selector.listStrategies();
strategies.forEach(s => {
  console.log(`${s.name}: ${s.description}`);
});
```

---

### recordSuccess()

Record successful strategy use.

```typescript
recordSuccess(strategy: Strategy): void
```

**Parameters**:
- `strategy`: Strategy that succeeded

**Example**:
```typescript
selector.recordSuccess(strategy);
// Future selections will prefer this strategy
```

---

### resetHistory()

Clear success history.

```typescript
resetHistory(): void
```

**Example**:
```typescript
selector.resetHistory();
// Starts fresh with no success bias
```

---

## FailureAnalyzer

Analyzes workflow failures to classify errors and detect patterns.

### Constructor

```typescript
constructor()
```

**Example**:
```typescript
const analyzer = new FailureAnalyzer();
```

---

### analyze()

Analyze workflow failure.

```typescript
async analyze(
  error: Error,
  iteration: IterationResult,
  history: IterationResult[]
): Promise<FailureAnalysis>
```

**Parameters**:
- `error`: Error that occurred
- `iteration`: Current iteration result
- `history`: Previous iteration results

**Returns**: Detailed failure analysis

**Example**:
```typescript
const error = new Error('Connection timeout');
error.name = 'TimeoutError';

const analysis = await analyzer.analyze(error, iteration, history);
console.log(`Error type: ${analysis.errorType}`);
console.log(`Transient: ${analysis.transient}`);
console.log(`Recommendations: ${analysis.recommendations.join(', ')}`);
```

---

## SafetyEvaluator

Evaluates safety constraints to prevent runaway execution.

### Constructor

```typescript
constructor()
```

**Example**:
```typescript
const evaluator = new SafetyEvaluator();
```

---

### evaluate()

Evaluate safety constraints.

```typescript
async evaluate(
  strategy: Strategy,
  safetyLevel: 'permissive' | 'normal' | 'paranoid',
  history: IterationResult[]
): Promise<SafetyEvaluation>
```

**Parameters**:
- `strategy`: Current strategy
- `safetyLevel`: Constraint level
- `history`: Iteration history

**Returns**: Safety evaluation result

**Example**:
```typescript
const evaluation = await evaluator.evaluate(strategy, 'normal', history);

if (!evaluation.safe) {
  console.error(`Unsafe to continue: ${evaluation.reason}`);
}

if (evaluation.warnings.length > 0) {
  console.warn(`Warnings: ${evaluation.warnings.join(', ')}`);
}

console.log(`Risk score: ${(evaluation.riskScore * 100).toFixed(1)}%`);
```

---

### getSafetyThresholds()

Get safety thresholds for a level.

```typescript
getSafetyThresholds(level: 'permissive' | 'normal' | 'paranoid'): SafetyThresholds
```

**Parameters**:
- `level`: Safety level

**Returns**: Threshold configuration

**Example**:
```typescript
const thresholds = evaluator.getSafetyThresholds('paranoid');
console.log(`Max cost: $${thresholds.maxTotalCost}`);
console.log(`Max duration: ${thresholds.maxTotalDuration}ms`);
console.log(`Max failures: ${thresholds.maxConsecutiveFailures}`);
console.log(`Risk tolerance: ${thresholds.riskTolerance}`);
```

---

## Usage Examples

### Example 1: Basic Retry Loop

```typescript
import { IterateEngine } from 'automatosx/services/IterateEngine.js';
import { WorkflowEngine } from 'automatosx/services/WorkflowEngine.js';
import { CheckpointService } from 'automatosx/services/CheckpointService.js';

async function runWithRetry() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService(),
    'auto'
  );

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 10,
    safetyLevel: 'normal',
    verbose: true
  });

  if (result.success) {
    console.log('✓ Workflow completed');
  } else {
    console.error(`✗ Failed: ${result.stopReason}`);
  }

  return result;
}
```

---

### Example 2: Custom Iteration Callback

```typescript
async function runWithMonitoring() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService()
  );

  const metrics = {
    attempts: 0,
    totalCost: 0,
    strategiesUsed: new Set<string>()
  };

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 15,
    safetyLevel: 'normal',
    onIteration: (iteration) => {
      metrics.attempts++;
      metrics.totalCost += iteration.cost;
      metrics.strategiesUsed.add(iteration.strategy.name);

      console.log(`
        Iteration ${iteration.iteration}:
        - Status: ${iteration.success ? 'SUCCESS' : 'FAILED'}
        - Strategy: ${iteration.strategy.name}
        - Duration: ${iteration.duration}ms
        - Cost: $${iteration.cost.toFixed(2)}
      `);
    }
  });

  console.log('\nFinal Metrics:');
  console.log(`- Attempts: ${metrics.attempts}`);
  console.log(`- Total Cost: $${metrics.totalCost.toFixed(2)}`);
  console.log(`- Strategies: ${Array.from(metrics.strategiesUsed).join(', ')}`);

  return result;
}
```

---

### Example 3: Custom Strategy Selection

```typescript
async function runWithCustomStrategy() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService(),
    'conservative' // Use conservative selection
  );

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 5,
    safetyLevel: 'paranoid',
    maxCost: 10.0,
    timeout: 600000 // 10 minutes
  });

  return result;
}
```

---

### Example 4: Checkpoint Recovery

```typescript
async function runWithCheckpoints() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService()
  );

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 20,
    safetyLevel: 'normal',
    checkpointInterval: 5, // Checkpoint every 5 iterations
    verbose: true
  });

  if (!result.success) {
    console.log(`Created ${result.checkpoints.length} checkpoints`);
    console.log('Can resume from checkpoint IDs:');
    result.checkpoints.forEach(id => console.log(`  - ${id}`));
  }

  return result;
}
```

---

### Example 5: Failure Analysis

```typescript
async function analyzeFailures() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService()
  );

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 10,
    safetyLevel: 'normal'
  });

  if (!result.success && result.failureAnalysis) {
    const analysis = result.failureAnalysis;

    console.log('\nFailure Analysis:');
    console.log(`- Error Type: ${analysis.errorType}`);
    console.log(`- Transient: ${analysis.transient ? 'Yes' : 'No'}`);
    console.log(`- Severity: ${analysis.severity}`);
    console.log(`- Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);

    if (analysis.pattern) {
      console.log(`- Pattern: ${analysis.pattern}`);
    }

    console.log('\nRecommendations:');
    analysis.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  return result;
}
```

---

### Example 6: Safety Threshold Monitoring

```typescript
async function monitorSafety() {
  const engine = new IterateEngine(
    new WorkflowEngine(),
    new CheckpointService()
  );

  const evaluator = engine.getSafetyEvaluator();
  const thresholds = evaluator.getSafetyThresholds('normal');

  console.log('Safety Thresholds (Normal):');
  console.log(`- Max Cost: $${thresholds.maxTotalCost}`);
  console.log(`- Max Duration: ${thresholds.maxTotalDuration / 60000} minutes`);
  console.log(`- Max Consecutive Failures: ${thresholds.maxConsecutiveFailures}`);

  const result = await engine.iterate('workflow.yaml', {
    maxIterations: 10,
    safetyLevel: 'normal',
    onIteration: (iteration) => {
      console.log(`Safety: ${iteration.iteration} iterations, ` +
                  `$${iteration.cost} cost, ` +
                  `${iteration.duration}ms duration`);
    }
  });

  return result;
}
```

---

## Error Handling

### Error Capture

IterateEngine **never throws exceptions**. All errors are captured in the result:

```typescript
const result = await engine.iterate('workflow.yaml', options);

// Never need try/catch - result always returned
if (!result.success) {
  console.error(`Stop reason: ${result.stopReason}`);

  if (result.failureAnalysis) {
    console.error(`Error type: ${result.failureAnalysis.errorType}`);
  }
}
```

### Accessing Errors

```typescript
// Last iteration error
const lastIteration = result.history[result.history.length - 1];
if (lastIteration && lastIteration.error) {
  console.error('Last error:', lastIteration.error.message);
  console.error('Stack:', lastIteration.error.stack);
}

// All errors
result.history.forEach((iteration, i) => {
  if (iteration.error) {
    console.error(`Iteration ${i + 1} error: ${iteration.error.message}`);
  }
});
```

### Error Types

Common error patterns and their handling:

**Timeout Errors**:
```typescript
if (result.stopReason === 'timeout') {
  console.log('Total timeout exceeded');
  console.log('Consider increasing --timeout option');
}
```

**Cost Limit Errors**:
```typescript
if (result.stopReason === 'cost_limit') {
  console.log(`Exceeded budget: $${result.totalCost.toFixed(2)}`);
  console.log('Consider increasing --max-cost option');
}
```

**Safety Violations**:
```typescript
if (result.stopReason === 'safety_violation') {
  console.log('Safety constraints violated');
  console.log('Consider using --safety permissive');
}
```

**Max Iterations**:
```typescript
if (result.stopReason === 'max_iterations') {
  console.log(`Exhausted ${result.iterations} attempts`);
  console.log('Consider increasing --max-iterations');
}
```

---

## TypeScript Type Guards

Useful type guards for working with results:

```typescript
function isSuccessful(result: IterateResult): result is IterateResult & { success: true } {
  return result.success === true;
}

function hasFailed(result: IterateResult): result is IterateResult & {
  success: false;
  failureAnalysis: FailureAnalysis
} {
  return result.success === false && result.failureAnalysis !== undefined;
}

// Usage
const result = await engine.iterate('workflow.yaml', options);

if (isSuccessful(result)) {
  // TypeScript knows result.success is true
  console.log(`Completed in ${result.iterations} iterations`);
}

if (hasFailed(result)) {
  // TypeScript knows result.failureAnalysis exists
  console.error(`Failed with ${result.failureAnalysis.errorType}`);
}
```

---

## Next Steps

- **User Guide**: See [Iterate Mode User Guide](./iterate-mode-guide.md)
- **Strategies**: See [Strategy Reference](./iterate-strategies.md)
- **Architecture**: See [Architecture Documentation](./iterate-architecture.md)

---

**Need Help?** Report issues at https://github.com/automatosx/automatosx/issues
