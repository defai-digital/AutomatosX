/**
 * ComplexityChart Component
 * Displays code complexity distribution by file using Recharts BarChart
 */
import React from 'react';
import type { FileQualityReport } from '../../types/redux.js';
interface ComplexityChartProps {
    fileReports: FileQualityReport[];
    maxFiles?: number;
}
export declare function ComplexityChart({ fileReports, maxFiles }: ComplexityChartProps): React.ReactElement;
export default ComplexityChart;
//# sourceMappingURL=ComplexityChart.d.ts.map