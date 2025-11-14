/**
 * Day 73: Dependency Graph Visualization Tests
 * Comprehensive tests for all dependency graph components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import dependencyReducer from '../redux/slices/dependencySlice.js';
import uiReducer from '../redux/slices/uiSlice.js';
import type { DependencyNode, DependencyGraph } from '../types/redux.js';
import { DependencyGraphVisualization } from '../components/dependencies/DependencyGraphVisualization.js';
import { GraphControls } from '../components/dependencies/GraphControls.js';
import { CircularDependencyDetector } from '../components/dependencies/CircularDependencyDetector.js';
import { NodeDetailsPanel } from '../components/dependencies/NodeDetailsPanel.js';
import { DependencyFilters } from '../components/dependencies/DependencyFilters.js';
import { GraphStatistics } from '../components/dependencies/GraphStatistics.js';
import { DependenciesPage } from '../pages/DependenciesPage.js';
import * as d3 from 'd3';

// Mock D3.js
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({
      remove: vi.fn(),
    })),
    append: vi.fn(() => ({
      append: vi.fn(() => ({
        attr: vi.fn(() => ({
          attr: vi.fn(() => ({
            attr: vi.fn(() => ({
              attr: vi.fn(() => ({
                attr: vi.fn(() => ({
                  attr: vi.fn(() => ({
                    append: vi.fn(() => ({
                      attr: vi.fn(() => ({ attr: vi.fn() })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        selectAll: vi.fn(() => ({
          data: vi.fn(() => ({
            enter: vi.fn(() => ({
              append: vi.fn(() => ({
                attr: vi.fn(() => ({
                  attr: vi.fn(() => ({
                    attr: vi.fn(() => ({
                      attr: vi.fn(() => ({
                        attr: vi.fn(() => ({
                          style: vi.fn(() => ({
                            on: vi.fn(() => ({
                              call: vi.fn(),
                            })),
                          })),
                        })),
                      })),
                    })),
                  })),
                })),
                text: vi.fn(() => ({
                  attr: vi.fn(() => ({
                    attr: vi.fn(() => ({
                      attr: vi.fn(() => ({
                        attr: vi.fn(() => ({
                          style: vi.fn(),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    })),
    attr: vi.fn(() => ({
      attr: vi.fn(() => ({
        attr: vi.fn(() => ({
          attr: vi.fn(),
        })),
      })),
    })),
    call: vi.fn(),
    transition: vi.fn(() => ({
      call: vi.fn(),
    })),
  })),
  zoom: vi.fn(() => ({
    scaleExtent: vi.fn(() => ({
      on: vi.fn(() => ({})),
    })),
    scaleBy: vi.fn(),
    transform: vi.fn(),
  })),
  zoomIdentity: {},
  forceSimulation: vi.fn(() => ({
    force: vi.fn(() => ({
      force: vi.fn(() => ({
        force: vi.fn(() => ({
          force: vi.fn(),
        })),
      })),
    })),
    on: vi.fn(),
    stop: vi.fn(),
    alphaTarget: vi.fn(() => ({
      restart: vi.fn(),
    })),
  })),
  forceLink: vi.fn(() => ({
    id: vi.fn(() => ({
      distance: vi.fn(),
    })),
  })),
  forceManyBody: vi.fn(() => ({
    strength: vi.fn(),
  })),
  forceCenter: vi.fn(),
  forceCollide: vi.fn(() => ({
    radius: vi.fn(),
  })),
  forceY: vi.fn(() => ({
    strength: vi.fn(),
  })),
  drag: vi.fn(() => ({
    on: vi.fn(() => ({
      on: vi.fn(() => ({
        on: vi.fn(),
      })),
    })),
  })),
}));

// Test data
const mockNodes: DependencyNode[] = [
  {
    id: 'file1',
    label: 'src/services/FileService.ts',
    type: 'file',
    dependencies: ['file2', 'file3'],
    dependents: [],
  },
  {
    id: 'file2',
    label: 'src/database/FileDAO.ts',
    type: 'file',
    dependencies: ['file4'],
    dependents: ['file1'],
  },
  {
    id: 'file3',
    label: 'src/parser/ParserRegistry.ts',
    type: 'file',
    dependencies: ['file5'],
    dependents: ['file1'],
  },
  {
    id: 'file4',
    label: 'src/database/connection.ts',
    type: 'file',
    dependencies: [],
    dependents: ['file2'],
  },
  {
    id: 'file5',
    label: 'src/parser/TypeScriptParser.ts',
    type: 'file',
    dependencies: [],
    dependents: ['file3'],
  },
  {
    id: 'func1',
    label: 'getUserById',
    type: 'function',
    dependencies: ['func2'],
    dependents: [],
  },
  {
    id: 'func2',
    label: 'queryDatabase',
    type: 'function',
    dependencies: [],
    dependents: ['func1'],
  },
  {
    id: 'class1',
    label: 'UserService',
    type: 'class',
    dependencies: ['class2'],
    dependents: [],
  },
  {
    id: 'class2',
    label: 'DatabaseService',
    type: 'class',
    dependencies: [],
    dependents: ['class1'],
  },
];

const mockEdges = [
  { source: 'file1', target: 'file2' },
  { source: 'file1', target: 'file3' },
  { source: 'file2', target: 'file4' },
  { source: 'file3', target: 'file5' },
  { source: 'func1', target: 'func2' },
  { source: 'class1', target: 'class2' },
];

const mockCircularDeps = [
  ['file1', 'file2', 'file1'],
  ['file3', 'file4', 'file5', 'file3'],
];

const mockGraph: DependencyGraph = {
  nodes: mockNodes,
  edges: mockEdges,
  circularDependencies: mockCircularDeps,
};

function createTestStore(initialState?: any) {
  return configureStore({
    reducer: {
      dependency: dependencyReducer,
      ui: uiReducer,
    },
    preloadedState: initialState,
  });
}

// ========================================
// DependencyGraphVisualization Tests (4 tests)
// ========================================
describe('DependencyGraphVisualization', () => {
  it('renders loading state when graph is null', () => {
    render(
      <DependencyGraphVisualization
        graph={null}
        selectedNode={null}
        onNodeClick={vi.fn()}
      />
    );
    expect(screen.getByText(/loading dependency graph/i)).toBeInTheDocument();
  });

  it('renders empty state when graph has no nodes', () => {
    const emptyGraph: DependencyGraph = {
      nodes: [],
      edges: [],
      circularDependencies: [],
    };
    render(
      <DependencyGraphVisualization
        graph={emptyGraph}
        selectedNode={null}
        onNodeClick={vi.fn()}
      />
    );
    expect(screen.getByText(/no dependencies found/i)).toBeInTheDocument();
  });

  it('accepts all required props', () => {
    expect(() => {
      render(
        <DependencyGraphVisualization
          graph={mockGraph}
          selectedNode={null}
          onNodeClick={vi.fn()}
        />
      );
    }).not.toThrow();
  });

  it('accepts optional layout props', () => {
    expect(() => {
      render(
        <DependencyGraphVisualization
          graph={mockGraph}
          selectedNode={null}
          onNodeClick={vi.fn()}
          layoutAlgorithm="hierarchical"
          showLabels={false}
          nodeSize={12}
        />
      );
    }).not.toThrow();
  });
});

// ========================================
// GraphControls Tests (7 tests)
// ========================================
describe('GraphControls', () => {
  it('renders all control buttons', () => {
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={vi.fn()}
      />
    );
    expect(screen.getByText(/graph controls/i)).toBeInTheDocument();
  });

  it('calls onZoomIn when zoom in button clicked', () => {
    const onZoomIn = vi.fn();
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={onZoomIn}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={vi.fn()}
      />
    );
    const zoomInButton = screen.getByLabelText(/zoom in/i);
    fireEvent.click(zoomInButton);
    expect(onZoomIn).toHaveBeenCalled();
  });

  it('calls onZoomOut when zoom out button clicked', () => {
    const onZoomOut = vi.fn();
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={onZoomOut}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={vi.fn()}
      />
    );
    const zoomOutButton = screen.getByLabelText(/zoom out/i);
    fireEvent.click(zoomOutButton);
    expect(onZoomOut).toHaveBeenCalled();
  });

  it('calls onLayoutChange when layout is changed', () => {
    const onLayoutChange = vi.fn();
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={onLayoutChange}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={vi.fn()}
      />
    );
    const select = screen.getByLabelText(/layout algorithm/i);
    fireEvent.mouseDown(select);
    const hierarchicalOption = screen.getByText(/hierarchical/i);
    fireEvent.click(hierarchicalOption);
    expect(onLayoutChange).toHaveBeenCalledWith('hierarchical');
  });

  it('calls onNodeSizeChange when slider is moved', () => {
    const onNodeSizeChange = vi.fn();
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={onNodeSizeChange}
        onToggleLabels={vi.fn()}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: 12 } });
    expect(onNodeSizeChange).toHaveBeenCalledWith(12);
  });

  it('calls onToggleLabels when labels switch is toggled', () => {
    const onToggleLabels = vi.fn();
    render(
      <GraphControls
        layoutAlgorithm="force"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={onToggleLabels}
      />
    );
    const labelSwitch = screen.getByRole('checkbox', { name: /show labels/i });
    fireEvent.click(labelSwitch);
    expect(onToggleLabels).toHaveBeenCalled();
  });

  it('displays current layout algorithm', () => {
    render(
      <GraphControls
        layoutAlgorithm="circular"
        showLabels={true}
        nodeSize={8}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        onCenterGraph={vi.fn()}
        onLayoutChange={vi.fn()}
        onNodeSizeChange={vi.fn()}
        onToggleLabels={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue(/circular/i)).toBeInTheDocument();
  });
});

// ========================================
// CircularDependencyDetector Tests (7 tests)
// ========================================
describe('CircularDependencyDetector', () => {
  it('shows success message when no circular dependencies', () => {
    render(
      <CircularDependencyDetector
        circularDependencies={[]}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/no circular dependencies detected/i)).toBeInTheDocument();
  });

  it('displays count of circular dependencies', () => {
    render(
      <CircularDependencyDetector
        circularDependencies={mockCircularDeps}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/2 cycles found/i)).toBeInTheDocument();
  });

  it('renders list of circular dependency cycles', () => {
    render(
      <CircularDependencyDetector
        circularDependencies={mockCircularDeps}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/cycle 1/i)).toBeInTheDocument();
    expect(screen.getByText(/cycle 2/i)).toBeInTheDocument();
  });

  it('calls onHighlightCycle when cycle is clicked', () => {
    const onHighlightCycle = vi.fn();
    render(
      <CircularDependencyDetector
        circularDependencies={mockCircularDeps}
        onHighlightCycle={onHighlightCycle}
      />
    );
    const cycle1 = screen.getByText(/cycle 1/i);
    fireEvent.click(cycle1);
    expect(onHighlightCycle).toHaveBeenCalledWith(mockCircularDeps[0]);
  });

  it('shows warning severity for cycles with 3-4 files', () => {
    render(
      <CircularDependencyDetector
        circularDependencies={[['file1', 'file2', 'file3']]}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/3 files/i)).toBeInTheDocument();
  });

  it('shows error severity for cycles with 5+ files', () => {
    const largeCycle = ['file1', 'file2', 'file3', 'file4', 'file5', 'file6'];
    render(
      <CircularDependencyDetector
        circularDependencies={[largeCycle]}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/6 files/i)).toBeInTheDocument();
  });

  it('displays warning about circular dependencies', () => {
    render(
      <CircularDependencyDetector
        circularDependencies={mockCircularDeps}
        onHighlightCycle={vi.fn()}
      />
    );
    expect(screen.getByText(/circular dependencies can lead to/i)).toBeInTheDocument();
  });
});

// ========================================
// NodeDetailsPanel Tests (6 tests)
// ========================================
describe('NodeDetailsPanel', () => {
  it('shows placeholder when no node selected', () => {
    render(<NodeDetailsPanel node={null} onClose={vi.fn()} />);
    expect(screen.getByText(/select a node to view details/i)).toBeInTheDocument();
  });

  it('displays node type and path', () => {
    render(<NodeDetailsPanel node={mockNodes[0]} onClose={vi.fn()} />);
    expect(screen.getByText('file')).toBeInTheDocument();
    expect(screen.getByText(/src\/services\/FileService\.ts/i)).toBeInTheDocument();
  });

  it('displays fan-out metric', () => {
    render(<NodeDetailsPanel node={mockNodes[0]} onClose={vi.fn()} />);
    expect(screen.getByText(/fan-out: 2/i)).toBeInTheDocument();
  });

  it('displays fan-in metric', () => {
    render(<NodeDetailsPanel node={mockNodes[1]} onClose={vi.fn()} />);
    expect(screen.getByText(/fan-in: 1/i)).toBeInTheDocument();
  });

  it('displays centrality metric', () => {
    render(<NodeDetailsPanel node={mockNodes[1]} onClose={vi.fn()} />);
    // fan-in: 1, fan-out: 1, centrality: 2
    expect(screen.getByText(/centrality: 2/i)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<NodeDetailsPanel node={mockNodes[0]} onClose={onClose} />);
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});

// ========================================
// DependencyFilters Tests (6 tests)
// ========================================
describe('DependencyFilters', () => {
  const mockFilters = {
    nodeTypes: [],
    fileExtensions: [],
    directoryPaths: [],
    hideExternal: false,
    showOnlyCircular: false,
    searchQuery: '',
  };

  it('renders filter controls', () => {
    render(
      <DependencyFilters
        filters={mockFilters}
        onFiltersChange={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    expect(screen.getByText(/filters/i)).toBeInTheDocument();
  });

  it('displays active filters count', () => {
    const activeFilters = {
      ...mockFilters,
      nodeTypes: ['file' as const],
      fileExtensions: ['.ts'],
    };
    render(
      <DependencyFilters
        filters={activeFilters}
        onFiltersChange={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onFiltersChange when node type is toggled', () => {
    const onFiltersChange = vi.fn();
    render(
      <DependencyFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={vi.fn()}
      />
    );
    const fileCheckbox = screen.getByLabelText(/files/i);
    fireEvent.click(fileCheckbox);
    expect(onFiltersChange).toHaveBeenCalledWith({ nodeTypes: ['file'] });
  });

  it('calls onFiltersChange when search query changes', () => {
    const onFiltersChange = vi.fn();
    render(
      <DependencyFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={vi.fn()}
      />
    );
    const searchBox = screen.getByPlaceholderText(/enter node name/i);
    fireEvent.change(searchBox, { target: { value: 'FileService' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ searchQuery: 'FileService' });
  });

  it('calls onClearFilters when clear button clicked', () => {
    const onClearFilters = vi.fn();
    const activeFilters = {
      ...mockFilters,
      nodeTypes: ['file' as const],
    };
    render(
      <DependencyFilters
        filters={activeFilters}
        onFiltersChange={vi.fn()}
        onClearFilters={onClearFilters}
      />
    );
    const clearButton = screen.getByLabelText(/clear all filters/i);
    fireEvent.click(clearButton);
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('toggles hide external dependencies switch', () => {
    const onFiltersChange = vi.fn();
    render(
      <DependencyFilters
        filters={mockFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={vi.fn()}
      />
    );
    const hideExternalSwitch = screen.getByLabelText(/hide external dependencies/i);
    fireEvent.click(hideExternalSwitch);
    expect(onFiltersChange).toHaveBeenCalledWith({ hideExternal: true });
  });
});

// ========================================
// GraphStatistics Tests (4 tests)
// ========================================
describe('GraphStatistics', () => {
  const mockStats = {
    totalNodes: 100,
    totalEdges: 150,
    circularDependenciesCount: 5,
    averageFanOut: 1.5,
    mostConnectedNodes: [
      { id: 'node1', label: 'FileService.ts', connections: 25 },
      { id: 'node2', label: 'Parser.ts', connections: 20 },
      { id: 'node3', label: 'Database.ts', connections: 18 },
    ],
    isolatedNodesCount: 10,
  };

  it('displays total nodes count', () => {
    render(<GraphStatistics {...mockStats} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/total nodes/i)).toBeInTheDocument();
  });

  it('displays circular dependencies count', () => {
    render(<GraphStatistics {...mockStats} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/circular deps/i)).toBeInTheDocument();
  });

  it('displays most connected nodes list', () => {
    render(<GraphStatistics {...mockStats} />);
    expect(screen.getByText(/1\. FileService\.ts/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Parser\.ts/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Database\.ts/i)).toBeInTheDocument();
  });

  it('displays isolated nodes count', () => {
    render(<GraphStatistics {...mockStats} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/isolated nodes/i)).toBeInTheDocument();
  });
});

// ========================================
// Redux Slice Tests (7 tests)
// ========================================
describe('dependencySlice', () => {
  it('handles selectNode action', () => {
    const store = createTestStore();
    store.dispatch({ type: 'dependency/selectNode', payload: mockNodes[0] });
    const state = store.getState();
    expect(state.dependency.selectedNode).toEqual(mockNodes[0]);
  });

  it('handles clearSelection action', () => {
    const store = createTestStore({
      dependency: { selectedNode: mockNodes[0] },
    });
    store.dispatch({ type: 'dependency/clearSelection' });
    const state = store.getState();
    expect(state.dependency.selectedNode).toBeNull();
  });

  it('handles setFilters action', () => {
    const store = createTestStore();
    store.dispatch({
      type: 'dependency/setFilters',
      payload: { nodeTypes: ['file'] },
    });
    const state = store.getState();
    expect(state.dependency.filters.nodeTypes).toEqual(['file']);
  });

  it('handles clearFilters action', () => {
    const store = createTestStore({
      dependency: {
        filters: { nodeTypes: ['file'], searchQuery: 'test' },
      },
    });
    store.dispatch({ type: 'dependency/clearFilters' });
    const state = store.getState();
    expect(state.dependency.filters.nodeTypes).toEqual([]);
    expect(state.dependency.filters.searchQuery).toBe('');
  });

  it('handles setLayoutAlgorithm action', () => {
    const store = createTestStore();
    store.dispatch({
      type: 'dependency/setLayoutAlgorithm',
      payload: 'hierarchical',
    });
    const state = store.getState();
    expect(state.dependency.layoutAlgorithm).toBe('hierarchical');
  });

  it('handles toggleLabels action', () => {
    const store = createTestStore({
      dependency: { showLabels: true },
    });
    store.dispatch({ type: 'dependency/toggleLabels' });
    const state = store.getState();
    expect(state.dependency.showLabels).toBe(false);
  });

  it('handles setNodeSize action', () => {
    const store = createTestStore();
    store.dispatch({ type: 'dependency/setNodeSize', payload: 12 });
    const state = store.getState();
    expect(state.dependency.nodeSize).toBe(12);
  });
});

// ========================================
// DependenciesPage Integration Tests (5 tests)
// ========================================
describe('DependenciesPage', () => {
  it('renders page with all components', async () => {
    const store = createTestStore({
      dependency: {
        graph: mockGraph,
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
      },
    });

    render(
      <Provider store={store}>
        <DependenciesPage />
      </Provider>
    );

    expect(screen.getByText(/dependency graph visualization/i)).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const store = createTestStore({
      dependency: {
        graph: null,
        selectedNode: null,
        loading: true,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <DependenciesPage />
      </Provider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error alert', () => {
    const store = createTestStore({
      dependency: {
        graph: null,
        selectedNode: null,
        loading: false,
        error: 'Failed to load dependency graph',
      },
    });

    render(
      <Provider store={store}>
        <DependenciesPage />
      </Provider>
    );

    expect(screen.getByText(/failed to load dependency graph/i)).toBeInTheDocument();
  });

  it('renders graph statistics', () => {
    const store = createTestStore({
      dependency: {
        graph: mockGraph,
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
      },
    });

    render(
      <Provider store={store}>
        <DependenciesPage />
      </Provider>
    );

    expect(screen.getByText(/graph statistics/i)).toBeInTheDocument();
  });

  it('renders circular dependency detector', () => {
    const store = createTestStore({
      dependency: {
        graph: mockGraph,
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
      },
    });

    render(
      <Provider store={store}>
        <DependenciesPage />
      </Provider>
    );

    expect(screen.getByText(/circular dependencies/i)).toBeInTheDocument();
  });
});
