/**
 * JSON Exporter
 *
 * Exports quality reports in JSON format
 */
export class JSONExporter {
    /**
     * Export quality report as JSON
     */
    export(report, options) {
        const content = JSON.stringify(report, null, 2);
        const buffer = Buffer.from(content, 'utf-8');
        return {
            format: 'json',
            outputPath: options.outputPath,
            content,
            size: buffer.length,
            generatedAt: Date.now(),
        };
    }
    /**
     * Export quality report as compact JSON (no formatting)
     */
    exportCompact(report, options) {
        const content = JSON.stringify(report);
        const buffer = Buffer.from(content, 'utf-8');
        return {
            format: 'json',
            outputPath: options.outputPath,
            content,
            size: buffer.length,
            generatedAt: Date.now(),
        };
    }
    /**
     * Export summary only (reduced size)
     */
    exportSummary(report, options) {
        const summary = {
            summary: report.summary,
            metrics: report.metrics,
            generatedAt: Date.now(),
        };
        const content = JSON.stringify(summary, null, 2);
        const buffer = Buffer.from(content, 'utf-8');
        return {
            format: 'json',
            outputPath: options.outputPath,
            content,
            size: buffer.length,
            generatedAt: Date.now(),
        };
    }
}
//# sourceMappingURL=JSONExporter.js.map