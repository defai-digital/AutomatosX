/**
 * Quality Slice
 * Redux slice for managing code quality metrics and reports
 */
import type { QualityState, QualityMetrics, FileQualityReport, QualityFilters, RootState } from '../../types/redux.js';
export declare const fetchQualityMetrics: import("@reduxjs/toolkit").AsyncThunk<QualityMetrics, string, import("@reduxjs/toolkit").AsyncThunkConfig>;
export declare const fetchFileReports: import("@reduxjs/toolkit").AsyncThunk<FileQualityReport[], string, import("@reduxjs/toolkit").AsyncThunkConfig>;
export declare const fetchFileReport: import("@reduxjs/toolkit").AsyncThunk<FileQualityReport, string, import("@reduxjs/toolkit").AsyncThunkConfig>;
export declare const selectFile: import("@reduxjs/toolkit").ActionCreatorWithPayload<FileQualityReport | null, "quality/selectFile">, setFilters: import("@reduxjs/toolkit").ActionCreatorWithPayload<QualityFilters, "quality/setFilters">, clearFilters: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"quality/clearFilters">, clearError: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"quality/clearError">, resetQuality: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"quality/resetQuality">;
export declare const selectQualityMetrics: (state: RootState) => QualityMetrics | null;
export declare const selectFileReports: (state: RootState) => FileQualityReport[];
export declare const selectSelectedFile: (state: RootState) => FileQualityReport | null;
export declare const selectQualityFilters: (state: RootState) => QualityFilters;
export declare const selectQualityLoading: (state: RootState) => boolean;
export declare const selectQualityError: (state: RootState) => string | null;
export declare const selectFilteredFileReports: ((state: RootState) => FileQualityReport[]) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: FileQualityReport[], resultFuncArgs_1: QualityFilters) => FileQualityReport[];
    memoizedResultFunc: ((resultFuncArgs_0: FileQualityReport[], resultFuncArgs_1: QualityFilters) => FileQualityReport[]) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => FileQualityReport[];
    dependencies: [(state: RootState) => FileQualityReport[], (state: RootState) => QualityFilters];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
declare const _default: import("redux").Reducer<QualityState>;
export default _default;
//# sourceMappingURL=qualitySlice.d.ts.map