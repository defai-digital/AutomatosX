/**
 * CSV Exporter
 *
 * Exports quality reports in CSV format
 */
import type { QualityReport, ExportResult, ExportOptions } from './types.js';
export declare class CSVExporter {
    /**
     * Export quality report as CSV (file-level metrics)
     */
    export(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Export code smells as CSV
     */
    exportCodeSmells(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Export summary metrics as CSV
     */
    exportSummary(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Convert file reports to CSV rows
     */
    private convertToFileRows;
    /**
     * Convert code smell reports to CSV rows
     */
    private convertToCodeSmellRows;
}
//# sourceMappingURL=CSVExporter.d.ts.map