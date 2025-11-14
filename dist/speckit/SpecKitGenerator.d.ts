/**
 * SpecKitGenerator - Abstract base class for all spec generators
 *
 * Implements Template Method Pattern for consistent generation pipeline:
 * 1. analyze() - Analyze codebase
 * 2. detect() - Detect patterns/features
 * 3. generateContent() - Generate spec content
 * 4. format() - Format output
 * 5. validate() - Validate result
 * 6. save() - Write to file
 *
 * Subclasses implement abstract methods for specific generators.
 */
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import type { MemoryService } from '../memory/MemoryService.js';
import type { GenerateOptions, GenerateResult, AnalysisResult, GenerationMetadata, ValidationResult, ProgressCallback, CacheEntry } from '../types/speckit.types.js';
/**
 * Abstract base class for all SpecKit generators
 */
export declare abstract class SpecKitGenerator<TOptions extends GenerateOptions = GenerateOptions> {
    /** Generator name (e.g., 'ADR', 'PRD', 'API') */
    protected abstract readonly generatorName: string;
    /** Generator version */
    protected readonly version = "1.0.0";
    /** AI provider router */
    protected readonly providerRouter: ProviderRouterV2;
    /** Memory service for code search */
    protected readonly memoryService: MemoryService;
    /** Generation cache */
    protected readonly cache: Map<string, CacheEntry>;
    /** Cache TTL (5 minutes) */
    protected readonly cacheTTL: number;
    constructor(providerRouter: ProviderRouterV2, memoryService: MemoryService);
    /**
     * Main generation method (Template Method Pattern)
     * Orchestrates the entire generation pipeline
     */
    generate(options: TOptions, onProgress?: ProgressCallback): Promise<GenerateResult>;
    /**
     * Abstract method: Analyze codebase
     * Subclasses implement codebase analysis specific to their needs
     */
    protected abstract analyze(options: TOptions): Promise<AnalysisResult>;
    /**
     * Abstract method: Detect patterns
     * Subclasses implement pattern detection specific to their domain
     */
    protected abstract detect(analysis: AnalysisResult, options: TOptions): Promise<any[]>;
    /**
     * Abstract method: Generate content
     * Subclasses implement content generation using AI
     */
    protected abstract generateContent(patterns: any[], analysis: AnalysisResult, options: TOptions): Promise<string>;
    /**
     * Format output (can be overridden by subclasses)
     */
    protected format(content: string, options: TOptions): Promise<string>;
    /**
     * Validate result (can be overridden by subclasses)
     */
    protected validate(content: string, options: TOptions): Promise<ValidationResult>;
    /**
     * Save result to file
     */
    protected save(content: string, options: TOptions): Promise<void>;
    /**
     * Generate header for output file
     */
    protected generateHeader(options: TOptions): string;
    /**
     * Call AI provider for content generation
     */
    protected callAI(prompt: string, options: TOptions): Promise<string>;
    /**
     * Search codebase using MemoryService
     */
    protected searchCode(query: string, options?: {
        limit?: number;
        language?: string;
    }): Promise<any[]>;
    /**
     * Get cached result
     */
    protected getCached(options: TOptions): CacheEntry | null;
    /**
     * Set cached result
     */
    protected setCached(options: TOptions, content: string, metadata: GenerationMetadata): void;
    /**
     * Generate cache key from options
     */
    protected getCacheKey(options: TOptions): string;
    /**
     * Log message (if verbose)
     */
    protected log(options: TOptions, message: string): void;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache stats
     */
    getCacheStats(): {
        size: number;
        entries: number;
    };
}
//# sourceMappingURL=SpecKitGenerator.d.ts.map