/**
 * CircularDependencyDetector Component
 * Displays circular dependency chains with highlighting and severity indicators
 */
import React from 'react';
export interface CircularDependencyDetectorProps {
    circularDependencies: string[][];
    onHighlightCycle: (cycle: string[]) => void;
    onExportReport?: () => void;
}
export declare function CircularDependencyDetector({ circularDependencies, onHighlightCycle, onExportReport, }: CircularDependencyDetectorProps): React.ReactElement;
export default CircularDependencyDetector;
//# sourceMappingURL=CircularDependencyDetector.d.ts.map