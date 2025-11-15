import { ComplexityAnalyzer, FileComplexity } from './ComplexityAnalyzer.js';
import { MaintainabilityMetrics, QualityThresholds } from './MaintainabilityCalculator.js';
import { Language } from '../../types/index.js';
export interface QualityReport {
    filePath: string;
    language: Language;
    timestamp: Date;
    complexity: FileComplexity;
    maintainability: MaintainabilityMetrics;
    summary: QualitySummary;
}
export interface QualitySummary {
    overallGrade: string;
    qualityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    technicalDebtHours: number;
    criticalIssuesCount: number;
    topRecommendations: string[];
}
export interface ProjectQualityReport {
    projectPath: string;
    timestamp: Date;
    fileReports: QualityReport[];
    aggregateMetrics: AggregateMetrics;
    trends: QualityTrends;
}
export interface AggregateMetrics {
    totalFiles: number;
    averageComplexity: number;
    averageMaintainability: number;
    averageQualityScore: number;
    totalTechnicalDebtHours: number;
    totalCodeSmells: number;
    gradeDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
}
export interface QualityTrends {
    complexityTrend: 'improving' | 'stable' | 'degrading';
    maintainabilityTrend: 'improving' | 'stable' | 'degrading';
    debtTrend: 'improving' | 'stable' | 'degrading';
}
export interface QualityServiceOptions {
    thresholds?: Partial<QualityThresholds>;
    includeAllFunctions?: boolean;
    excludePatterns?: string[];
}
export declare class QualityService {
    private complexityAnalyzer;
    private maintainabilityCalculator;
    private options;
    constructor(options?: QualityServiceOptions, complexityAnalyzer?: ComplexityAnalyzer);
    /**
     * Analyze quality for a single file
     */
    analyzeFile(filePath: string, language: Language): Promise<QualityReport>;
    /**
     * Analyze quality for entire project
     */
    analyzeProject(projectPath: string, languages: Language[]): Promise<ProjectQualityReport>;
    /**
     * Generate quality summary
     */
    private generateSummary;
    /**
     * Calculate aggregate metrics across all files
     */
    private calculateAggregateMetrics;
    /**
     * Find source files in project
     */
    private findSourceFiles;
    /**
     * Get worse grade between two grades
     */
    private getWorseGrade;
    /**
     * Format quality report as text
     */
    formatReport(report: QualityReport): string;
    /**
     * Format project quality report as text
     */
    formatProjectReport(report: ProjectQualityReport): string;
}
//# sourceMappingURL=QualityService.d.ts.map