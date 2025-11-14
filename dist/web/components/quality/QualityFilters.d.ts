/**
 * QualityFilters Component
 * Filter controls for quality dashboard with grade, risk level, and quality score filters
 */
import React from 'react';
export interface QualityFiltersState {
    grade: string[];
    riskLevel: string[];
    minQualityScore: number;
}
interface QualityFiltersProps {
    filters: QualityFiltersState;
    onFiltersChange: (filters: QualityFiltersState) => void;
}
export declare function QualityFilters({ filters, onFiltersChange }: QualityFiltersProps): React.ReactElement;
export default QualityFilters;
//# sourceMappingURL=QualityFilters.d.ts.map