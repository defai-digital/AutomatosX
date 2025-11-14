/**
 * PDF Exporter
 *
 * Exports quality reports as PDF documents
 */
import type { QualityReport, ExportResult, ExportOptions } from './types.js';
export declare class PDFExporter {
    private readonly pageWidth;
    private readonly pageHeight;
    private readonly margin;
    private readonly lineHeight;
    /**
     * Export quality report as PDF
     */
    export(report: QualityReport, options: ExportOptions): ExportResult;
    /**
     * Add title to PDF
     */
    private addTitle;
    /**
     * Add section title
     */
    private addSectionTitle;
    /**
     * Add summary section
     */
    private addSummary;
    /**
     * Add metrics section
     */
    private addMetrics;
    /**
     * Add code smells section (top 10)
     */
    private addCodeSmells;
    /**
     * Add footer to all pages
     */
    private addFooter;
    /**
     * Check if page break is needed
     */
    private checkPageBreak;
}
//# sourceMappingURL=PDFExporter.d.ts.map