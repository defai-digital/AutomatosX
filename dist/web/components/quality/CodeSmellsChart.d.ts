/**
 * CodeSmellsChart Component
 * Displays code smell type distribution using Recharts PieChart
 */
import React from 'react';
import type { FileQualityReport } from '../../types/redux.js';
interface CodeSmellsChartProps {
    fileReports: FileQualityReport[];
}
export declare function CodeSmellsChart({ fileReports }: CodeSmellsChartProps): React.ReactElement;
export default CodeSmellsChart;
//# sourceMappingURL=CodeSmellsChart.d.ts.map