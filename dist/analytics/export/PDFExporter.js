/**
 * PDF Exporter
 *
 * Exports quality reports as PDF documents
 */
import { jsPDF } from 'jspdf';
export class PDFExporter {
    pageWidth = 210; // A4 width in mm
    pageHeight = 297; // A4 height in mm
    margin = 20;
    lineHeight = 7;
    /**
     * Export quality report as PDF
     */
    export(report, options) {
        const doc = new jsPDF();
        let yPosition = this.margin;
        // Title
        yPosition = this.addTitle(doc, 'Code Quality Report', yPosition);
        // Summary Section
        yPosition = this.addSectionTitle(doc, 'Summary', yPosition);
        yPosition = this.addSummary(doc, report, yPosition);
        // Metrics Section
        if (options.includeDetails !== false) {
            yPosition = this.checkPageBreak(doc, yPosition, 60);
            yPosition = this.addSectionTitle(doc, 'Quality Metrics', yPosition);
            yPosition = this.addMetrics(doc, report, yPosition);
        }
        // Top Issues Section
        if (options.includeDetails !== false && report.codeSmells.length > 0) {
            yPosition = this.checkPageBreak(doc, yPosition, 80);
            yPosition = this.addSectionTitle(doc, 'Top Code Smells', yPosition);
            yPosition = this.addCodeSmells(doc, report, yPosition);
        }
        // Footer
        this.addFooter(doc, report);
        const content = doc.output('arraybuffer');
        const buffer = Buffer.from(content);
        return {
            format: 'pdf',
            outputPath: options.outputPath,
            content: buffer,
            size: buffer.length,
            generatedAt: Date.now(),
        };
    }
    /**
     * Add title to PDF
     */
    addTitle(doc, title, yPosition) {
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(title, this.margin, yPosition);
        doc.setFont('helvetica', 'normal');
        return yPosition + this.lineHeight * 2;
    }
    /**
     * Add section title
     */
    addSectionTitle(doc, title, yPosition) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, this.margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        return yPosition + this.lineHeight * 1.5;
    }
    /**
     * Add summary section
     */
    addSummary(doc, report, yPosition) {
        const summary = report.summary;
        const summaryData = [
            ['Total Files', summary.totalFiles.toString()],
            ['Average Complexity', summary.averageComplexity.toFixed(2)],
            ['Maintainability Score', summary.maintainabilityScore.toFixed(2) + '/100'],
            ['Code Smell Count', summary.codeSmellCount.toString()],
            ['Analysis Date', new Date(summary.analysisDate).toLocaleString()],
        ];
        summaryData.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label + ':', this.margin, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(value, this.margin + 60, yPosition);
            yPosition += this.lineHeight;
        });
        return yPosition + this.lineHeight;
    }
    /**
     * Add metrics section
     */
    addMetrics(doc, report, yPosition) {
        const metrics = report.metrics;
        // Complexity Distribution
        doc.setFont('helvetica', 'bold');
        doc.text('Complexity Distribution:', this.margin, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += this.lineHeight;
        doc.text(`  Low: ${metrics.complexityDistribution.low} files`, this.margin, yPosition);
        yPosition += this.lineHeight;
        doc.text(`  Medium: ${metrics.complexityDistribution.medium} files`, this.margin, yPosition);
        yPosition += this.lineHeight;
        doc.text(`  High: ${metrics.complexityDistribution.high} files`, this.margin, yPosition);
        yPosition += this.lineHeight * 1.5;
        // Maintainability Distribution
        doc.setFont('helvetica', 'bold');
        doc.text('Maintainability Distribution:', this.margin, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += this.lineHeight;
        doc.text(`  Excellent: ${metrics.maintainabilityDistribution.excellent} files`, this.margin, yPosition);
        yPosition += this.lineHeight;
        doc.text(`  Good: ${metrics.maintainabilityDistribution.good} files`, this.margin, yPosition);
        yPosition += this.lineHeight;
        doc.text(`  Fair: ${metrics.maintainabilityDistribution.fair} files`, this.margin, yPosition);
        yPosition += this.lineHeight;
        doc.text(`  Poor: ${metrics.maintainabilityDistribution.poor} files`, this.margin, yPosition);
        yPosition += this.lineHeight * 1.5;
        // Language Breakdown (top 5)
        doc.setFont('helvetica', 'bold');
        doc.text('Language Breakdown (Top 5):', this.margin, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += this.lineHeight;
        const topLanguages = Object.entries(metrics.languageBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        topLanguages.forEach(([lang, count]) => {
            doc.text(`  ${lang}: ${count} files`, this.margin, yPosition);
            yPosition += this.lineHeight;
        });
        return yPosition + this.lineHeight;
    }
    /**
     * Add code smells section (top 10)
     */
    addCodeSmells(doc, report, yPosition) {
        const topSmells = report.codeSmells
            .sort((a, b) => {
            const severityOrder = { high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        })
            .slice(0, 10);
        topSmells.forEach((smell, index) => {
            yPosition = this.checkPageBreak(doc, yPosition, 20);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${smell.type} (${smell.severity})`, this.margin, yPosition);
            doc.setFont('helvetica', 'normal');
            yPosition += this.lineHeight;
            // Wrap file path if too long
            const maxWidth = this.pageWidth - this.margin * 2;
            const filePathLines = doc.splitTextToSize(`File: ${smell.filePath}:${smell.line}`, maxWidth);
            filePathLines.forEach((line) => {
                doc.text(line, this.margin, yPosition);
                yPosition += this.lineHeight;
            });
            // Wrap message if too long
            const messageLines = doc.splitTextToSize(smell.message, maxWidth);
            messageLines.forEach((line) => {
                doc.text(line, this.margin, yPosition);
                yPosition += this.lineHeight;
            });
            yPosition += this.lineHeight * 0.5;
        });
        return yPosition;
    }
    /**
     * Add footer to all pages
     */
    addFooter(doc, report) {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            // Page number
            doc.text(`Page ${i} of ${pageCount}`, this.pageWidth / 2, this.pageHeight - 10, {
                align: 'center',
            });
            // Generated by AutomatosX
            doc.text('Generated by AutomatosX v2', this.margin, this.pageHeight - 10);
            // Date
            const date = new Date(report.summary.analysisDate).toLocaleDateString();
            doc.text(date, this.pageWidth - this.margin, this.pageHeight - 10, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
        }
    }
    /**
     * Check if page break is needed
     */
    checkPageBreak(doc, yPosition, requiredSpace) {
        if (yPosition + requiredSpace > this.pageHeight - this.margin) {
            doc.addPage();
            return this.margin;
        }
        return yPosition;
    }
}
//# sourceMappingURL=PDFExporter.js.map