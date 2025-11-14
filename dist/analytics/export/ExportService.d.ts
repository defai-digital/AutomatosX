/**
 * Export Service
 *
 * Main service for exporting quality reports in various formats
 */
import type { QualityReport, ExportOptions, ExportResult, ExportFormat } from './types.js';
export declare class ExportService {
    private jsonExporter;
    private csvExporter;
    private pdfExporter;
    constructor();
    /**
     * Export quality report in specified format
     */
    export(report: QualityReport, options: ExportOptions): Promise<ExportResult>;
    /**
     * Export code smells as CSV
     */
    exportCodeSmells(report: QualityReport, options: ExportOptions): Promise<ExportResult>;
    /**
     * Export summary only (reduced size)
     */
    exportSummary(report: QualityReport, options: ExportOptions): Promise<ExportResult>;
    /**
     * Export to multiple formats at once
     */
    exportMultiple(report: QualityReport, formats: ExportFormat[], baseOutputPath: string): Promise<ExportResult[]>;
    /**
     * Write export result to file
     */
    private writeToFile;
    /**
     * Get output path for specific format
     */
    private getOutputPathForFormat;
    /**
     * Validate export options
     */
    validateOptions(options: ExportOptions): void;
    /**
     * Get file extension for format
     */
    getFileExtension(format: ExportFormat): string;
    /**
     * Get MIME type for format
     */
    getMimeType(format: ExportFormat): string;
}
//# sourceMappingURL=ExportService.d.ts.map