/**
 * GraphStatistics Component
 * Displays statistical information about the dependency graph
 */
import React from 'react';
export interface GraphStatisticsProps {
    totalNodes: number;
    totalEdges: number;
    circularDependenciesCount: number;
    averageFanOut: number;
    mostConnectedNodes: Array<{
        id: string;
        label: string;
        connections: number;
    }>;
    isolatedNodesCount: number;
}
export declare function GraphStatistics({ totalNodes, totalEdges, circularDependenciesCount, averageFanOut, mostConnectedNodes, isolatedNodesCount, }: GraphStatisticsProps): React.ReactElement;
export default GraphStatistics;
//# sourceMappingURL=GraphStatistics.d.ts.map