/**
 * Dependency Slice
 * Redux slice for managing dependency graph data and analysis
 */
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
const initialState = {
    graph: null,
    selectedNode: null,
    filters: {
        nodeTypes: [],
        fileExtensions: [],
        directoryPaths: [],
        hideExternal: false,
        showOnlyCircular: false,
        searchQuery: '',
    },
    layoutAlgorithm: 'force',
    showLabels: true,
    nodeSize: 8,
    loading: false,
    error: null,
};
// Async thunks
export const fetchDependencyGraph = createAsyncThunk('dependency/fetchGraph', async (projectPath) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/dependencies/graph?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch dependency graph');
    }
    return response.json();
});
export const analyzeDependencies = createAsyncThunk('dependency/analyze', async (projectPath) => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/dependencies/analyze?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) {
        throw new Error('Failed to analyze dependencies');
    }
    return response.json();
});
const dependencySlice = createSlice({
    name: 'dependency',
    initialState,
    reducers: {
        selectNode: (state, action) => {
            state.selectedNode = action.payload;
        },
        clearSelection: (state) => {
            state.selectedNode = null;
        },
        setFilters: (state, action) => {
            state.filters = { ...state.filters, ...action.payload };
        },
        clearFilters: (state) => {
            state.filters = initialState.filters;
        },
        setLayoutAlgorithm: (state, action) => {
            state.layoutAlgorithm = action.payload;
        },
        toggleLabels: (state) => {
            state.showLabels = !state.showLabels;
        },
        setNodeSize: (state, action) => {
            state.nodeSize = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        resetDependency: () => initialState,
    },
    extraReducers: (builder) => {
        // Fetch dependency graph
        builder
            .addCase(fetchDependencyGraph.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
            .addCase(fetchDependencyGraph.fulfilled, (state, action) => {
            state.loading = false;
            state.graph = action.payload;
        })
            .addCase(fetchDependencyGraph.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to fetch dependency graph';
        });
        // Analyze dependencies
        builder
            .addCase(analyzeDependencies.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
            .addCase(analyzeDependencies.fulfilled, (state, action) => {
            state.loading = false;
            state.graph = action.payload;
        })
            .addCase(analyzeDependencies.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to analyze dependencies';
        });
    },
});
export const { selectNode, clearSelection, setFilters, clearFilters, setLayoutAlgorithm, toggleLabels, setNodeSize, clearError, resetDependency, } = dependencySlice.actions;
// Basic selectors
export const selectDependencyGraph = (state) => state.dependency.graph;
export const selectSelectedNode = (state) => state.dependency.selectedNode;
export const selectDependencyFilters = (state) => state.dependency.filters;
export const selectLayoutAlgorithm = (state) => state.dependency.layoutAlgorithm;
export const selectShowLabels = (state) => state.dependency.showLabels;
export const selectNodeSize = (state) => state.dependency.nodeSize;
export const selectDependencyLoading = (state) => state.dependency.loading;
export const selectDependencyError = (state) => state.dependency.error;
// Circular dependencies selector
export const selectCircularDependencies = createSelector([selectDependencyGraph], (graph) => {
    if (!graph)
        return [];
    return graph.circularDependencies;
});
// Filtered nodes selector
export const selectFilteredNodes = createSelector([selectDependencyGraph, selectDependencyFilters], (graph, filters) => {
    if (!graph)
        return [];
    let nodes = graph.nodes;
    // Filter by node type
    if (filters.nodeTypes.length > 0) {
        nodes = nodes.filter((node) => filters.nodeTypes.includes(node.type));
    }
    // Filter by file extension
    if (filters.fileExtensions.length > 0) {
        nodes = nodes.filter((node) => {
            const ext = node.label.split('.').pop()?.toLowerCase() || '';
            return filters.fileExtensions.includes(`.${ext}`);
        });
    }
    // Filter by directory path
    if (filters.directoryPaths.length > 0) {
        nodes = nodes.filter((node) => {
            return filters.directoryPaths.some((path) => node.label.startsWith(path));
        });
    }
    // Filter by search query
    if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        nodes = nodes.filter((node) => node.label.toLowerCase().includes(query));
    }
    // Filter to show only circular dependencies
    if (filters.showOnlyCircular && graph.circularDependencies.length > 0) {
        const circularNodeIds = new Set(graph.circularDependencies.flat());
        nodes = nodes.filter((node) => circularNodeIds.has(node.id));
    }
    return nodes;
});
// Graph statistics selectors
export const selectGraphStatistics = createSelector([selectDependencyGraph, selectCircularDependencies], (graph, circularDeps) => {
    if (!graph) {
        return {
            totalNodes: 0,
            totalEdges: 0,
            circularDependenciesCount: 0,
            averageFanOut: 0,
            mostConnectedNodes: [],
            isolatedNodesCount: 0,
        };
    }
    const totalNodes = graph.nodes.length;
    const totalEdges = graph.edges.length;
    const circularDependenciesCount = circularDeps.length;
    // Calculate average fan-out
    const totalFanOut = graph.nodes.reduce((sum, node) => sum + node.dependencies.length, 0);
    const averageFanOut = totalNodes > 0 ? totalFanOut / totalNodes : 0;
    // Find most connected nodes (top 5)
    const nodeConnections = graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        connections: node.dependencies.length + node.dependents.length,
    }));
    const mostConnectedNodes = nodeConnections
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5);
    // Count isolated nodes (no dependencies or dependents)
    const isolatedNodesCount = graph.nodes.filter((node) => node.dependencies.length === 0 && node.dependents.length === 0).length;
    return {
        totalNodes,
        totalEdges,
        circularDependenciesCount,
        averageFanOut,
        mostConnectedNodes,
        isolatedNodesCount,
    };
});
export default dependencySlice.reducer;
//# sourceMappingURL=dependencySlice.js.map