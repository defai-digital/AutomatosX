// Trace Domain
// Execution tracing following contract invariants

export {
  InMemoryTraceStore,
  createInMemoryTraceStore,
} from './store.js';
export {
  TraceRecorder,
  TraceRecorderError,
  createTraceRecorder,
} from './recorder.js';
export {
  TraceAnalyzer,
  createTraceAnalyzer,
  type TraceAnalysis,
  type RoutingDecisionInfo,
  type ErrorInfo,
  type TimelineEntry,
} from './analyzer.js';
export {
  TraceErrorCodes,
  type TraceErrorCode,
  type TraceWriter,
  type TraceReader,
  type TraceStore,
  type TraceSummary,
  type ActiveTrace,
  type TraceOptions,
  type EventOptions,
} from './types.js';
