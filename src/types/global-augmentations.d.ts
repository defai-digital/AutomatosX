/**
 * Global type augmentations for missing properties and methods
 * This file provides temporary type definitions to resolve compilation errors
 * TODO: Implement these methods properly in their respective classes
 */

// Parser types
declare module '../parser/LanguageParser.js' {
  export interface ParseResult {
    tree?: any;
  }
}

// Complexity types
declare module '../analytics/quality/ComplexityAnalyzer.js' {
  export interface FunctionComplexity {
    parameters?: any[];
  }

  export interface ComplexityMetrics {
    name?: string;
    startLine?: number;
    endLine?: number;
    parameters?: any[];
  }
}

// Monitoring types - WorkflowStats
declare module '../types/monitoring.types.js' {
  export interface WorkflowStats {
    totalExecutions?: number;
  }
}

// Memory stats
declare module '../types/schemas/memory.schema.js' {
  export interface MemoryStats {
    storageEstimateMB?: number;
  }
}

// Intent types
declare module '../cli/interactive/IntentClassifier.js' {
  export type IntentType =
    | 'search-code'
    | 'search-symbol'
    | 'search-natural'
    | 'symbol-search'
    | 'memory-search'
    | 'memory-create'
    | 'memory-list'
    | 'workflow-run'
    | 'workflow-list'
    | 'workflow-status'
    | 'agent-delegate'
    | 'provider-info'
    | 'help'
    | 'status'
    | 'config'
    | 'unknown'
    | 'rephrase';
}

// SlashCommand type
declare module '../cli/interactive/SlashCommandRegistry.js' {
  export interface SlashCommand {
    name: string;
    aliases?: string[];
    description: string;
    usage?: string;
    examples?: string[];
    handler?: (args: string[], context: any) => Promise<string>;
    execute?: (args: string[], context: any) => Promise<string>;
  }
}
