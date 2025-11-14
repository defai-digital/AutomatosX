/**
 * ADRGenerator - Generate Architectural Decision Records
 * Automatically detects design patterns and architectural decisions in codebase
 */
import { SpecKitGenerator } from './SpecKitGenerator.js';
import { type DetectedPattern } from './PatternDetector.js';
import type { GenerateOptions, AnalysisResult } from '../types/speckit.types.js';
export interface ADRGenerateOptions extends GenerateOptions {
    pattern?: string;
    includeExamples?: boolean;
    includeRationale?: boolean;
    template?: 'standard' | 'y-statement' | 'custom';
}
/**
 * ADRGenerator - Generate Architectural Decision Records
 */
export declare class ADRGenerator extends SpecKitGenerator<ADRGenerateOptions> {
    protected readonly generatorName = "ADR";
    /**
     * Analyze project to extract architectural information
     */
    protected analyze(options: ADRGenerateOptions): Promise<AnalysisResult>;
    /**
     * Detect patterns (already done in analyze, just pass through)
     */
    protected detect(analysis: AnalysisResult, options: ADRGenerateOptions): Promise<DetectedPattern[]>;
    /**
     * Generate ADR content using AI
     */
    protected generateContent(patterns: DetectedPattern[], analysis: AnalysisResult, options: ADRGenerateOptions): Promise<string>;
    /**
     * Build prompt for AI to generate ADR
     */
    private buildADRPrompt;
    /**
     * Generate empty ADR when no patterns found
     */
    private generateEmptyADR;
}
//# sourceMappingURL=ADRGenerator.d.ts.map