/**
 * FileQualityTable Component
 * Material-UI table with sortable columns, search, and pagination
 */
import React from 'react';
import type { FileQualityReport } from '../../types/redux.js';
interface FileQualityTableProps {
    fileReports: FileQualityReport[];
    onFileSelect?: (file: FileQualityReport) => void;
}
export declare function FileQualityTable({ fileReports, onFileSelect }: FileQualityTableProps): React.ReactElement;
export default FileQualityTable;
//# sourceMappingURL=FileQualityTable.d.ts.map