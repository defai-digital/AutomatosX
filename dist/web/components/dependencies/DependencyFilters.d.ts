/**
 * DependencyFilters Component
 * Filtering controls for dependency graph visualization
 */
import React from 'react';
import type { DependencyFilters as Filters } from '../../redux/slices/dependencySlice.js';
export interface DependencyFiltersProps {
    filters: Filters;
    onFiltersChange: (filters: Partial<Filters>) => void;
    onClearFilters: () => void;
}
export declare function DependencyFilters({ filters, onFiltersChange, onClearFilters, }: DependencyFiltersProps): React.ReactElement;
export default DependencyFilters;
//# sourceMappingURL=DependencyFilters.d.ts.map