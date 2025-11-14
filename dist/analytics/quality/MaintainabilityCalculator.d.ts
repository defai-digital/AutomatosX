import { FileComplexity } from './ComplexityAnalyzer.js';
export interface MaintainabilityMetrics {
    maintainabilityIndex: number;
    grade: string;
    technicalDebt: TechnicalDebt;
    qualityScore: number;
    codeSmells: CodeSmell[];
    recommendations: string[];
}
export interface TechnicalDebt {
    totalMinutes: number;
    totalHours: number;
    totalDays: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    ratio: number;
}
export interface CodeSmell {
    type: CodeSmellType;
    severity: 'low' | 'medium' | 'high';
    message: string;
    location?: {
        function?: string;
        startLine?: number;
        endLine?: number;
    };
}
export declare enum CodeSmellType {
    HighComplexity = "HIGH_COMPLEXITY",
    LowMaintainability = "LOW_MAINTAINABILITY",
    LongFunction = "LONG_FUNCTION",
    LowCohesion = "LOW_COHESION",
    HighCoupling = "HIGH_COUPLING",
    DuplicateCode = "DUPLICATE_CODE",
    GodObject = "GOD_OBJECT",
    LongParameterList = "LONG_PARAMETER_LIST",
    FeatureEnvy = "FEATURE_ENVY",
    DataClumps = "DATA_CLUMPS",
    MagicNumbers = "MAGIC_NUMBERS"
}
export interface QualityThresholds {
    maxCyclomaticComplexity: number;
    maxCognitiveComplexity: number;
    maxFunctionLines: number;
    minMaintainabilityIndex: number;
    maxFunctionsPerFile: number;
}
export declare class MaintainabilityCalculator {
    private thresholds;
    constructor(thresholds?: Partial<QualityThresholds>);
    /**
     * Calculate comprehensive maintainability metrics
     */
    calculateMaintainability(fileComplexity: FileComplexity): MaintainabilityMetrics;
    /**
     * Calculate maintainability grade
     */
    private calculateGrade;
    /**
     * Detect code smells
     */
    private detectCodeSmells;
    /**
     * Calculate technical debt
     * Based on SQALE methodology
     */
    private calculateTechnicalDebt;
    /**
     * Calculate overall quality score (0-100)
     */
    private calculateQualityScore;
    /**
     * Generate actionable recommendations
     */
    private generateRecommendations;
    /**
     * Calculate technical debt trend
     */
    calculateDebtTrend(historicalData: {
        timestamp: Date;
        debt: number;
    }[]): {
        trend: 'increasing' | 'decreasing' | 'stable';
        changePercent: number;
    };
    /**
     * Get priority for refactoring
     */
    getRefactoringPriority(metrics: MaintainabilityMetrics): number;
    /**
     * Detect magic numbers in function
     * Heuristic: Estimate based on function size and complexity
     */
    private detectMagicNumbers;
    /**
     * Detect data clumps (parameter groups appearing together)
     * Heuristic: Functions with similar parameter counts and high coupling
     */
    private detectDataClumps;
    /**
     * Detect feature envy (functions with low cohesion, likely accessing external data)
     * Heuristic: Long functions with high complexity and low maintainability
     */
    private detectFeatureEnvy;
}
//# sourceMappingURL=MaintainabilityCalculator.d.ts.map