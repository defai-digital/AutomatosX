/**
 * Redux State Types
 * Type definitions for the application Redux store
 */
export interface QualityMetrics {
    fileCount: number;
    averageComplexity: number;
    averageMaintainability: number;
    totalTechDebt: number;
    gradeDistribution: {
        A: number;
        B: number;
        C: number;
        D: number;
        F: number;
    };
    riskDistribution: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
}
export interface FileQualityReport {
    filePath: string;
    language: string;
    grade: string;
    qualityScore: number;
    complexity: number;
    maintainability: number;
    techDebt: number;
    riskLevel: string;
    timestamp: string;
}
export interface DependencyNode {
    id: string;
    label: string;
    type: 'file' | 'function' | 'class';
    dependencies: string[];
    dependents: string[];
}
export interface DependencyGraph {
    nodes: DependencyNode[];
    edges: Array<{
        source: string;
        target: string;
    }>;
    circularDependencies: string[][];
}
export interface IndexStatus {
    totalFiles: number;
    indexedFiles: number;
    lastIndexed: string | null;
    isIndexing: boolean;
    errors: string[];
}
export interface QualityFilters {
    grade: string[];
    riskLevel: string[];
    minQualityScore: number;
}
export interface QualityState {
    metrics: QualityMetrics | null;
    fileReports: FileQualityReport[];
    selectedFile: FileQualityReport | null;
    filters: QualityFilters;
    loading: boolean;
    error: string | null;
}
export interface DependencyState {
    graph: DependencyGraph | null;
    selectedNode: DependencyNode | null;
    loading: boolean;
    error: string | null;
}
export interface IndexState {
    status: IndexStatus;
    loading: boolean;
    error: string | null;
}
export interface UIState {
    theme: 'light' | 'dark';
    sidebarOpen: boolean;
    notifications: Notification[];
}
export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
}
export interface RootState {
    quality: QualityState;
    dependency: DependencyState;
    index: IndexState;
    ui: UIState;
}
//# sourceMappingURL=redux.d.ts.map