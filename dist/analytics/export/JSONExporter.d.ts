/**
 * JSON Exporter
 *
 * Exports quality reports in JSON format
 */
import type { QualityReport, ExportResult, ExportOptions } from './types.js';
export declare class JSONExporter {
    /**
     * Export quality report as JSON
     */
    export(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Export quality report as compact JSON (no formatting)
     */
    exportCompact(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Export summary only (reduced size)
     */
    exportSummary(report: QualityReport, options: ExportOptions): ExportResult;
}
//# sourceMappingURL=JSONExporter.d.ts.map