/**
 * NodeDetailsPanel Component
 * Displays detailed information about a selected dependency node
 */
import React from 'react';
import type { DependencyNode } from '../../types/redux.js';
export interface NodeDetailsPanelProps {
    node: DependencyNode | null;
    onClose: () => void;
    onGoToDefinition?: (node: DependencyNode) => void;
    onShowInFileTree?: (node: DependencyNode) => void;
}
export declare function NodeDetailsPanel({ node, onClose, onGoToDefinition, onShowInFileTree, }: NodeDetailsPanelProps): React.ReactElement;
export default NodeDetailsPanel;
//# sourceMappingURL=NodeDetailsPanel.d.ts.map