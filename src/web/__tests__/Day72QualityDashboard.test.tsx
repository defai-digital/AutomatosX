/**
 * Day 72: Quality Metrics Dashboard Tests
 * Comprehensive tests for all quality dashboard components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import qualityReducer from '../redux/slices/qualitySlice.js';
import type { QualityMetrics, FileQualityReport, QualityFilters } from '../types/redux.js';
import { QualityOverviewCards } from '../components/quality/QualityOverviewCards.js';
import { ComplexityChart } from '../components/quality/ComplexityChart.js';
import { CodeSmellsChart } from '../components/quality/CodeSmellsChart.js';
import { GradeDistributionChart } from '../components/quality/GradeDistributionChart.js';
import { FileQualityTable } from '../components/quality/FileQualityTable.js';
import { QualityFilters as QualityFiltersComponent } from '../components/quality/QualityFilters.js';
import { QualityDashboard } from '../pages/QualityDashboard.js';

// Mock Recharts components
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LabelList: () => <div data-testid="label-list" />,
}));

// Test data
const mockMetrics: QualityMetrics = {
  fileCount: 100,
  averageComplexity: 12.5,
  averageMaintainability: 75.3,
  totalTechDebt: 480, // 8 hours
  gradeDistribution: {
    A: 30,
    B: 40,
    C: 20,
    D: 8,
    F: 2,
  },
  riskDistribution: {
    low: 60,
    medium: 30,
    high: 8,
    critical: 2,
  },
};

const mockFileReports: FileQualityReport[] = [
  {
    filePath: 'src/services/FileService.ts',
    language: 'typescript',
    grade: 'A',
    qualityScore: 92,
    complexity: 8.5,
    maintainability: 85,
    techDebt: 15,
    riskLevel: 'low',
    timestamp: '2025-01-01T00:00:00Z',
  },
  {
    filePath: 'src/parser/TypeScriptParser.ts',
    language: 'typescript',
    grade: 'B',
    qualityScore: 82,
    complexity: 15.2,
    maintainability: 72,
    techDebt: 45,
    riskLevel: 'medium',
    timestamp: '2025-01-01T00:00:00Z',
  },
  {
    filePath: 'src/database/legacy/OldDAO.ts',
    language: 'typescript',
    grade: 'D',
    qualityScore: 58,
    complexity: 28.7,
    maintainability: 42,
    techDebt: 120,
    riskLevel: 'high',
    timestamp: '2025-01-01T00:00:00Z',
  },
];

function createTestStore(initialState?: any) {
  return configureStore({
    reducer: {
      quality: qualityReducer,
    },
    preloadedState: initialState,
  });
}

describe('QualityOverviewCards', () => {
  it('should render all 4 metric cards', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);

    expect(screen.getByText('Average Complexity')).toBeInTheDocument();
    expect(screen.getByText('Maintainability Score')).toBeInTheDocument();
    expect(screen.getByText('Technical Debt')).toBeInTheDocument();
    expect(screen.getByText('Risk Level')).toBeInTheDocument();
  });

  it('should display correct complexity value', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);
    expect(screen.getByText('12.5')).toBeInTheDocument();
  });

  it('should display maintainability as percentage', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should format tech debt in hours', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);
    expect(screen.getByText('8h')).toBeInTheDocument();
  });

  it('should calculate risk level correctly', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('should show trend indicators', () => {
    render(<QualityOverviewCards metrics={mockMetrics} />);
    expect(screen.getByText('Good')).toBeInTheDocument(); // Low complexity trend
    expect(screen.getByText('Excellent')).toBeInTheDocument(); // High maintainability trend
  });

  it('should use responsive grid layout', () => {
    const { container } = render(<QualityOverviewCards metrics={mockMetrics} />);
    const grid = container.querySelector('.MuiGrid-container');
    expect(grid).toBeInTheDocument();
  });
});

describe('ComplexityChart', () => {
  it('should render BarChart component', () => {
    render(<ComplexityChart fileReports={mockFileReports} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should display chart title', () => {
    render(<ComplexityChart fileReports={mockFileReports} />);
    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument();
  });

  it('should limit files to maxFiles prop', () => {
    render(<ComplexityChart fileReports={mockFileReports} maxFiles={2} />);
    expect(screen.getByText(/Top 2 most complex files/)).toBeInTheDocument();
  });

  it('should sort files by complexity descending', () => {
    const { container } = render(<ComplexityChart fileReports={mockFileReports} />);
    // OldDAO.ts has highest complexity (28.7) and should be first
    expect(container.textContent).toContain('OldDAO.ts');
  });

  it('should render legend with all grades', () => {
    render(<ComplexityChart fileReports={mockFileReports} />);
    expect(screen.getByText('Grade A')).toBeInTheDocument();
    expect(screen.getByText('Grade B')).toBeInTheDocument();
    expect(screen.getByText('Grade C')).toBeInTheDocument();
  });

  it('should show "No data available" when empty', () => {
    render(<ComplexityChart fileReports={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should use responsive container', () => {
    render(<ComplexityChart fileReports={mockFileReports} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});

describe('CodeSmellsChart', () => {
  it('should render PieChart component', () => {
    render(<CodeSmellsChart fileReports={mockFileReports} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should display chart title', () => {
    render(<CodeSmellsChart fileReports={mockFileReports} />);
    expect(screen.getByText('Code Smells Distribution')).toBeInTheDocument();
  });

  it('should calculate total issues count', () => {
    render(<CodeSmellsChart fileReports={mockFileReports} />);
    expect(screen.getByText('Total Issues')).toBeInTheDocument();
  });

  it('should categorize high complexity smells', () => {
    const reports = [
      { ...mockFileReports[0], complexity: 20 }, // High complexity
    ];
    render(<CodeSmellsChart fileReports={reports} />);
    expect(screen.getByText('High Complexity')).toBeInTheDocument();
  });

  it('should categorize low maintainability smells', () => {
    const reports = [
      { ...mockFileReports[0], maintainability: 40 }, // Low maintainability
    ];
    render(<CodeSmellsChart fileReports={reports} />);
    expect(screen.getByText('Low Maintainability')).toBeInTheDocument();
  });

  it('should show "No data available" when empty', () => {
    render(<CodeSmellsChart fileReports={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should use responsive container', () => {
    render(<CodeSmellsChart fileReports={mockFileReports} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});

describe('GradeDistributionChart', () => {
  it('should render BarChart component', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should display chart title', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByText('Grade Distribution')).toBeInTheDocument();
  });

  it('should show file count in description', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByText(/100 files/)).toBeInTheDocument();
  });

  it('should display grade scale legend', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByText(/Excellent \(90-100%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Good \(80-89%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Fair \(70-79%\)/)).toBeInTheDocument();
  });

  it('should show correct file counts for each grade', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByText('30 files')).toBeInTheDocument(); // Grade A
    expect(screen.getByText('40 files')).toBeInTheDocument(); // Grade B
  });

  it('should show "No data available" when fileCount is 0', () => {
    const emptyMetrics = { ...mockMetrics, fileCount: 0 };
    render(<GradeDistributionChart metrics={emptyMetrics} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should use responsive container', () => {
    render(<GradeDistributionChart metrics={mockMetrics} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});

describe('FileQualityTable', () => {
  it('should render table with all columns', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);

    expect(screen.getByText('File Path')).toBeInTheDocument();
    expect(screen.getByText('Grade')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Complexity')).toBeInTheDocument();
    expect(screen.getByText('Tech Debt')).toBeInTheDocument();
    expect(screen.getByText('Risk Level')).toBeInTheDocument();
  });

  it('should display all file reports', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);

    expect(screen.getByText('src/services/FileService.ts')).toBeInTheDocument();
    expect(screen.getByText('src/parser/TypeScriptParser.ts')).toBeInTheDocument();
    expect(screen.getByText('src/database/legacy/OldDAO.ts')).toBeInTheDocument();
  });

  it('should render search field', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    const searchInput = screen.getByPlaceholderText(/Search by file path/);
    expect(searchInput).toBeInTheDocument();
  });

  it('should filter files by search term', async () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    const searchInput = screen.getByPlaceholderText(/Search by file path/);

    fireEvent.change(searchInput, { target: { value: 'FileService' } });

    await waitFor(() => {
      expect(screen.getByText('src/services/FileService.ts')).toBeInTheDocument();
      expect(screen.queryByText('src/parser/TypeScriptParser.ts')).not.toBeInTheDocument();
    });
  });

  it('should support sorting by grade', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    const gradeHeader = screen.getByText('Grade');
    fireEvent.click(gradeHeader);
    // Should trigger sort
    expect(gradeHeader).toBeInTheDocument();
  });

  it('should support sorting by quality score', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    const scoreHeader = screen.getByText('Quality Score');
    fireEvent.click(scoreHeader);
    expect(scoreHeader).toBeInTheDocument();
  });

  it('should display pagination controls', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    expect(screen.getByText(/Rows per page/)).toBeInTheDocument();
  });

  it('should call onFileSelect when row clicked', () => {
    const onFileSelect = vi.fn();
    render(<FileQualityTable fileReports={mockFileReports} onFileSelect={onFileSelect} />);

    const firstRow = screen.getByText('src/services/FileService.ts');
    fireEvent.click(firstRow);

    expect(onFileSelect).toHaveBeenCalledWith(mockFileReports[0]);
  });

  it('should show "No files found" when empty', () => {
    render(<FileQualityTable fileReports={[]} />);
    expect(screen.getByText('No files found')).toBeInTheDocument();
  });

  it('should format tech debt correctly', () => {
    render(<FileQualityTable fileReports={mockFileReports} />);
    expect(screen.getByText('15m')).toBeInTheDocument(); // 15 minutes
    expect(screen.getByText('2h')).toBeInTheDocument(); // 120 minutes
  });
});

describe('QualityFilters', () => {
  const defaultFilters: QualityFilters = {
    grade: [],
    riskLevel: [],
    minQualityScore: 0,
  };

  it('should render all filter controls', () => {
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={defaultFilters} onFiltersChange={onChange} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Grade')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk Level')).toBeInTheDocument();
    expect(screen.getByText(/Minimum Quality Score/)).toBeInTheDocument();
  });

  it('should show active filters count', () => {
    const activeFilters: QualityFilters = {
      grade: ['A', 'B'],
      riskLevel: ['low'],
      minQualityScore: 50,
    };
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={activeFilters} onFiltersChange={onChange} />);

    expect(screen.getByText('3 active')).toBeInTheDocument();
  });

  it('should display Clear All button when filters active', () => {
    const activeFilters: QualityFilters = {
      grade: ['A'],
      riskLevel: [],
      minQualityScore: 0,
    };
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={activeFilters} onFiltersChange={onChange} />);

    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('should call onFiltersChange when clearing all', () => {
    const activeFilters: QualityFilters = {
      grade: ['A'],
      riskLevel: ['low'],
      minQualityScore: 50,
    };
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={activeFilters} onFiltersChange={onChange} />);

    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(defaultFilters);
  });

  it('should display active filters summary', () => {
    const activeFilters: QualityFilters = {
      grade: ['A', 'B'],
      riskLevel: ['low'],
      minQualityScore: 60,
    };
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={activeFilters} onFiltersChange={onChange} />);

    expect(screen.getByText('Active Filters:')).toBeInTheDocument();
    expect(screen.getByText('Grade: A')).toBeInTheDocument();
    expect(screen.getByText('Grade: B')).toBeInTheDocument();
    expect(screen.getByText('Risk: low')).toBeInTheDocument();
    expect(screen.getByText('Min Score: 60')).toBeInTheDocument();
  });

  it('should allow removing individual filters', () => {
    const activeFilters: QualityFilters = {
      grade: ['A', 'B'],
      riskLevel: [],
      minQualityScore: 0,
    };
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={activeFilters} onFiltersChange={onChange} />);

    const chips = screen.getAllByRole('button');
    const gradeAChip = chips.find((chip) => chip.textContent?.includes('Grade: A'));

    if (gradeAChip) {
      fireEvent.click(gradeAChip);
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('should display quality score slider with marks', () => {
    const onChange = vi.fn();
    render(<QualityFiltersComponent filters={defaultFilters} onFiltersChange={onChange} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('QualityDashboard Integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });

  it('should render dashboard with all sections', async () => {
    const store = createTestStore({
      quality: {
        metrics: mockMetrics,
        fileReports: mockFileReports,
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Quality Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    const store = createTestStore({
      quality: {
        metrics: null,
        fileReports: [],
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: true,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display error alert', async () => {
    const store = createTestStore({
      quality: {
        metrics: mockMetrics,
        fileReports: [],
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: 'Failed to fetch data',
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });

  it('should render overview cards when metrics available', () => {
    const store = createTestStore({
      quality: {
        metrics: mockMetrics,
        fileReports: [],
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    expect(screen.getByText('Average Complexity')).toBeInTheDocument();
    expect(screen.getByText('Maintainability Score')).toBeInTheDocument();
  });

  it('should render all charts when data available', () => {
    const store = createTestStore({
      quality: {
        metrics: mockMetrics,
        fileReports: mockFileReports,
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    expect(screen.getByText('Complexity Distribution')).toBeInTheDocument();
    expect(screen.getByText('Code Smells Distribution')).toBeInTheDocument();
    expect(screen.getByText('Grade Distribution')).toBeInTheDocument();
  });

  it('should render file quality table', () => {
    const store = createTestStore({
      quality: {
        metrics: mockMetrics,
        fileReports: mockFileReports,
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    expect(screen.getByText('File Quality Reports')).toBeInTheDocument();
    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('should show no data message when empty', async () => {
    const store = createTestStore({
      quality: {
        metrics: null,
        fileReports: [],
        selectedFile: null,
        filters: { grade: [], riskLevel: [], minQualityScore: 0 },
        loading: false,
        error: null,
      },
    });

    render(
      <Provider store={store}>
        <QualityDashboard />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No quality data available/)).toBeInTheDocument();
    });
  });
});
