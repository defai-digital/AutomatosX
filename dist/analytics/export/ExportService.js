/**
 * Export Service
 *
 * Main service for exporting quality reports in various formats
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { JSONExporter } from './JSONExporter.js';
import { CSVExporter } from './CSVExporter.js';
import { PDFExporter } from './PDFExporter.js';
export class ExportService {
    jsonExporter;
    csvExporter;
    pdfExporter;
    constructor() {
        this.jsonExporter = new JSONExporter();
        this.csvExporter = new CSVExporter();
        this.pdfExporter = new PDFExporter();
    }
    /**
     * Export quality report in specified format
     */
    async export(report, options) {
        let result;
        switch (options.format) {
            case 'json':
                result = this.jsonExporter.export(report, options);
                break;
            case 'csv':
                result = this.csvExporter.export(report, options);
                break;
            case 'pdf':
                result = this.pdfExporter.export(report, options);
                break;
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
        // Write to file if outputPath is specified
        if (options.outputPath) {
            await this.writeToFile(result, options.outputPath);
        }
        return result;
    }
    /**
     * Export code smells as CSV
     */
    async exportCodeSmells(report, options) {
        if (options.format !== 'csv') {
            throw new Error('Code smells export is only supported in CSV format');
        }
        const result = this.csvExporter.exportCodeSmells(report, options);
        if (options.outputPath) {
            await this.writeToFile(result, options.outputPath);
        }
        return result;
    }
    /**
     * Export summary only (reduced size)
     */
    async exportSummary(report, options) {
        let result;
        switch (options.format) {
            case 'json':
                result = this.jsonExporter.exportSummary(report, options);
                break;
            case 'csv':
                result = this.csvExporter.exportSummary(report, options);
                break;
            default:
                throw new Error(`Summary export not supported for format: ${options.format}`);
        }
        if (options.outputPath) {
            await this.writeToFile(result, options.outputPath);
        }
        return result;
    }
    /**
     * Export to multiple formats at once
     */
    async exportMultiple(report, formats, baseOutputPath) {
        const results = [];
        for (const format of formats) {
            const outputPath = this.getOutputPathForFormat(baseOutputPath, format);
            const result = await this.export(report, { format, outputPath });
            results.push(result);
        }
        return results;
    }
    /**
     * Write export result to file
     */
    async writeToFile(result, outputPath) {
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });
        // Write content
        if (result.content) {
            if (Buffer.isBuffer(result.content)) {
                await fs.writeFile(outputPath, result.content);
            }
            else {
                await fs.writeFile(outputPath, result.content, 'utf-8');
            }
        }
    }
    /**
     * Get output path for specific format
     */
    getOutputPathForFormat(basePath, format) {
        const ext = path.extname(basePath);
        const base = ext ? basePath.slice(0, -ext.length) : basePath;
        return `${base}.${format}`;
    }
    /**
     * Validate export options
     */
    validateOptions(options) {
        const validFormats = ['json', 'csv', 'pdf'];
        if (!validFormats.includes(options.format)) {
            throw new Error(`Invalid export format: ${options.format}. Valid formats: ${validFormats.join(', ')}`);
        }
        if (options.outputPath && !path.isAbsolute(options.outputPath)) {
            throw new Error('Output path must be absolute');
        }
    }
    /**
     * Get file extension for format
     */
    getFileExtension(format) {
        return format;
    }
    /**
     * Get MIME type for format
     */
    getMimeType(format) {
        const mimeTypes = {
            json: 'application/json',
            csv: 'text/csv',
            pdf: 'application/pdf',
        };
        return mimeTypes[format];
    }
}
//# sourceMappingURL=ExportService.js.map