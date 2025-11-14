/**
 * Dependency Slice
 * Redux slice for managing dependency graph data and analysis
 */
import type { DependencyState, DependencyGraph, DependencyNode, RootState } from '../../types/redux.js';
export interface DependencyFilters {
    nodeTypes: Array<'file' | 'function' | 'class'>;
    fileExtensions: string[];
    directoryPaths: string[];
    hideExternal: boolean;
    showOnlyCircular: boolean;
    searchQuery: string;
}
export interface ExtendedDependencyState extends DependencyState {
    filters: DependencyFilters;
    layoutAlgorithm: 'force' | 'hierarchical' | 'circular';
    showLabels: boolean;
    nodeSize: number;
}
export declare const fetchDependencyGraph: import("@reduxjs/toolkit").AsyncThunk<DependencyGraph, string, import("@reduxjs/toolkit").AsyncThunkConfig>;
export declare const analyzeDependencies: import("@reduxjs/toolkit").AsyncThunk<DependencyGraph, string, import("@reduxjs/toolkit").AsyncThunkConfig>;
export declare const selectNode: import("@reduxjs/toolkit").ActionCreatorWithPayload<DependencyNode | null, "dependency/selectNode">, clearSelection: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"dependency/clearSelection">, setFilters: import("@reduxjs/toolkit").ActionCreatorWithPayload<Partial<DependencyFilters>, "dependency/setFilters">, clearFilters: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"dependency/clearFilters">, setLayoutAlgorithm: import("@reduxjs/toolkit").ActionCreatorWithPayload<"force" | "hierarchical" | "circular", "dependency/setLayoutAlgorithm">, toggleLabels: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"dependency/toggleLabels">, setNodeSize: import("@reduxjs/toolkit").ActionCreatorWithPayload<number, "dependency/setNodeSize">, clearError: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"dependency/clearError">, resetDependency: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"dependency/resetDependency">;
export declare const selectDependencyGraph: (state: RootState) => DependencyGraph | null;
export declare const selectSelectedNode: (state: RootState) => DependencyNode | null;
export declare const selectDependencyFilters: (state: RootState) => DependencyFilters;
export declare const selectLayoutAlgorithm: (state: RootState) => "force" | "hierarchical" | "circular";
export declare const selectShowLabels: (state: RootState) => boolean;
export declare const selectNodeSize: (state: RootState) => number;
export declare const selectDependencyLoading: (state: RootState) => boolean;
export declare const selectDependencyError: (state: RootState) => string | null;
export declare const selectCircularDependencies: ((state: RootState) => string[][]) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: DependencyGraph | null) => string[][];
    memoizedResultFunc: ((resultFuncArgs_0: DependencyGraph | null) => string[][]) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => string[][];
    dependencies: [(state: RootState) => DependencyGraph | null];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
export declare const selectFilteredNodes: ((state: RootState) => DependencyNode[]) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: DependencyGraph | null, resultFuncArgs_1: DependencyFilters) => DependencyNode[];
    memoizedResultFunc: ((resultFuncArgs_0: DependencyGraph | null, resultFuncArgs_1: DependencyFilters) => DependencyNode[]) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => DependencyNode[];
    dependencies: [(state: RootState) => DependencyGraph | null, (state: RootState) => DependencyFilters];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
export declare const selectGraphStatistics: ((state: RootState) => {
    totalNodes: number;
    totalEdges: number;
    circularDependenciesCount: number;
    averageFanOut: number;
    mostConnectedNodes: {
        id: string;
        label: string;
        connections: number;
    }[];
    isolatedNodesCount: number;
}) & {
    clearCache: () => void;
    resultsCount: () => number;
    resetResultsCount: () => void;
} & {
    resultFunc: (resultFuncArgs_0: DependencyGraph | null, resultFuncArgs_1: string[][]) => {
        totalNodes: number;
        totalEdges: number;
        circularDependenciesCount: number;
        averageFanOut: number;
        mostConnectedNodes: {
            id: string;
            label: string;
            connections: number;
        }[];
        isolatedNodesCount: number;
    };
    memoizedResultFunc: ((resultFuncArgs_0: DependencyGraph | null, resultFuncArgs_1: string[][]) => {
        totalNodes: number;
        totalEdges: number;
        circularDependenciesCount: number;
        averageFanOut: number;
        mostConnectedNodes: {
            id: string;
            label: string;
            connections: number;
        }[];
        isolatedNodesCount: number;
    }) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    };
    lastResult: () => {
        totalNodes: number;
        totalEdges: number;
        circularDependenciesCount: number;
        averageFanOut: number;
        mostConnectedNodes: {
            id: string;
            label: string;
            connections: number;
        }[];
        isolatedNodesCount: number;
    };
    dependencies: [(state: RootState) => DependencyGraph | null, ((state: RootState) => string[][]) & {
        clearCache: () => void;
        resultsCount: () => number;
        resetResultsCount: () => void;
    } & {
        resultFunc: (resultFuncArgs_0: DependencyGraph | null) => string[][];
        memoizedResultFunc: ((resultFuncArgs_0: DependencyGraph | null) => string[][]) & {
            clearCache: () => void;
            resultsCount: () => number;
            resetResultsCount: () => void;
        };
        lastResult: () => string[][];
        dependencies: [(state: RootState) => DependencyGraph | null];
        recomputations: () => number;
        resetRecomputations: () => void;
        dependencyRecomputations: () => number;
        resetDependencyRecomputations: () => void;
    } & {
        memoize: typeof import("reselect").weakMapMemoize;
        argsMemoize: typeof import("reselect").weakMapMemoize;
    }];
    recomputations: () => number;
    resetRecomputations: () => void;
    dependencyRecomputations: () => number;
    resetDependencyRecomputations: () => void;
} & {
    memoize: typeof import("reselect").weakMapMemoize;
    argsMemoize: typeof import("reselect").weakMapMemoize;
};
declare const _default: import("redux").Reducer<ExtendedDependencyState>;
export default _default;
//# sourceMappingURL=dependencySlice.d.ts.map