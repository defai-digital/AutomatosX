/**
 * PRDGenerator - Generate Product Requirements Documents from codebase
 *
 * Analyzes codebase to detect features and generates comprehensive PRDs including:
 * - Product vision and goals
 * - Feature specifications with user stories
 * - Technical requirements and constraints
 * - Success metrics and KPIs
 * - Architecture decisions and dependencies
 *
 * @extends SpecKitGenerator
 */
import { SpecKitGenerator } from './SpecKitGenerator.js';
import { type DetectedFeature } from './FeatureDetector.js';
import type { GenerateOptions, AnalysisResult } from '../types/speckit.types.js';
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import type { MemoryService } from '../memory/MemoryService.js';
export interface PRDGenerateOptions extends GenerateOptions {
    /** Focus on specific feature (optional) */
    feature?: string;
    /** Include architecture section */
    includeArchitecture?: boolean;
    /** Include user stories */
    includeUserStories?: boolean;
    /** Include success metrics */
    includeMetrics?: boolean;
    /** Include UI mockups section */
    includeMockups?: boolean;
    /** Target audience for document */
    audience?: 'technical' | 'business' | 'mixed';
    /** PRD template style */
    template?: 'standard' | 'lean' | 'detailed';
}
/**
 * PRDGenerator - Generates Product Requirements Documents
 *
 * Template Method Pattern Implementation:
 * 1. analyze() - Detect features using FeatureDetector
 * 2. detect() - Filter and prioritize features
 * 3. generateContent() - Generate PRD using AI with feature context
 * 4. format() - Apply PRD structure and formatting (from base)
 * 5. validate() - Ensure completeness and quality (from base)
 * 6. save() - Write to file (from base)
 */
export declare class PRDGenerator extends SpecKitGenerator<PRDGenerateOptions> {
    protected readonly generatorName = "prd";
    private featureDetector;
    constructor(providerRouter: ProviderRouterV2, memoryService: MemoryService);
    /**
     * Step 1: Analyze codebase to detect features
     */
    protected analyze(options: PRDGenerateOptions): Promise<AnalysisResult>;
    /**
     * Step 2: Filter and prioritize detected features
     */
    protected detect(analysis: AnalysisResult, options: PRDGenerateOptions): Promise<DetectedFeature[]>;
    /**
     * Step 3: Generate PRD content using AI
     */
    protected generateContent(features: DetectedFeature[], analysis: AnalysisResult, options: PRDGenerateOptions): Promise<string>;
    /**
     * Build AI prompt for PRD generation
     */
    private buildPRDPrompt;
    /**
     * Generate empty PRD when no features are detected
     */
    private generateEmptyPRD;
    /**
     * Infer programming language from file extension
     */
    private inferLanguage;
    /**
     * Infer feature category from description
     */
    private inferCategory;
}
//# sourceMappingURL=PRDGenerator.d.ts.map