/**
 * Export Service Tests
 *
 * Tests for quality report export functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../../export/ExportService.js';
import { JSONExporter } from '../../export/JSONExporter.js';
import { CSVExporter } from '../../export/CSVExporter.js';
import { PDFExporter } from '../../export/PDFExporter.js';
import type { QualityReport } from '../../export/types.js';

describe('ExportService', () => {
  let service: ExportService;
  let mockReport: QualityReport;

  beforeEach(() => {
    service = new ExportService();

    // Create mock quality report
    mockReport = {
      summary: {
        totalFiles: 10,
        averageComplexity: 5.5,
        maintainabilityScore: 75.0,
        codeSmellCount: 15,
        analysisDate: Date.now(),
      },
      files: [
        {
          filePath: '/test/file1.ts',
          language: 'typescript',
          complexity: 5,
          maintainability: 80,
          linesOfCode: 100,
          codeSmells: 2,
        },
        {
          filePath: '/test/file2.ts',
          language: 'typescript',
          complexity: 6,
          maintainability: 70,
          linesOfCode: 150,
          codeSmells: 3,
        },
      ],
      codeSmells: [
        {
          type: 'LONG_METHOD',
          severity: 'medium',
          filePath: '/test/file1.ts',
          line: 10,
          message: 'Method is too long',
          suggestion: 'Consider breaking into smaller methods',
        },
        {
          type: 'COMPLEX_CONDITIONAL',
          severity: 'high',
          filePath: '/test/file2.ts',
          line: 20,
          message: 'Complex conditional logic',
        },
      ],
      metrics: {
        complexityDistribution: {
          low: 5,
          medium: 3,
          high: 2,
        },
        maintainabilityDistribution: {
          excellent: 2,
          good: 5,
          fair: 2,
          poor: 1,
        },
        languageBreakdown: {
          typescript: 8,
          javascript: 2,
        },
        codeSmellsByType: {
          LONG_METHOD: 5,
          COMPLEX_CONDITIONAL: 10,
        },
      },
    };
  });

  describe('JSON Export', () => {
    it('should export report as JSON', async () => {
      const result = await service.export(mockReport, {
        format: 'json',
      });

      expect(result.format).toBe('json');
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should include all report data in JSON', async () => {
      const result = await service.export(mockReport, {
        format: 'json',
      });

      const parsed = JSON.parse(result.content as string);
      expect(parsed.summary).toEqual(mockReport.summary);
      expect(parsed.files).toHaveLength(2);
      expect(parsed.codeSmells).toHaveLength(2);
      expect(parsed.metrics).toEqual(mockReport.metrics);
    });

    it('should export summary only', async () => {
      const result = await service.exportSummary(mockReport, {
        format: 'json',
      });

      const parsed = JSON.parse(result.content as string);
      expect(parsed.summary).toEqual(mockReport.summary);
      expect(parsed.metrics).toEqual(mockReport.metrics);
      expect(parsed.files).toBeUndefined();
    });
  });

  describe('CSV Export', () => {
    it('should export report as CSV', async () => {
      const result = await service.export(mockReport, {
        format: 'csv',
      });

      expect(result.format).toBe('csv');
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should include CSV headers', async () => {
      const result = await service.export(mockReport, {
        format: 'csv',
      });

      const content = result.content as string;
      expect(content).toContain('filePath');
      expect(content).toContain('language');
      expect(content).toContain('complexity');
      expect(content).toContain('maintainability');
    });

    it('should export code smells as CSV', async () => {
      const result = await service.exportCodeSmells(mockReport, {
        format: 'csv',
      });

      const content = result.content as string;
      expect(content).toContain('type');
      expect(content).toContain('severity');
      expect(content).toContain('LONG_METHOD');
      expect(content).toContain('COMPLEX_CONDITIONAL');
    });

    it('should export summary as CSV', async () => {
      const result = await service.exportSummary(mockReport, {
        format: 'csv',
      });

      const content = result.content as string;
      expect(content).toContain('Total Files');
      expect(content).toContain('Average Complexity');
      expect(content).toContain('10'); // totalFiles value
    });
  });

  describe('PDF Export', () => {
    it('should export report as PDF', async () => {
      const result = await service.export(mockReport, {
        format: 'pdf',
      });

      expect(result.format).toBe('pdf');
      expect(result.content).toBeDefined();
      expect(Buffer.isBuffer(result.content)).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should generate PDF with reasonable size', async () => {
      const result = await service.export(mockReport, {
        format: 'pdf',
      });

      // PDF should be between 1KB and 100KB for this small report
      expect(result.size).toBeGreaterThan(1024);
      expect(result.size).toBeLessThan(100 * 1024);
    });
  });

  describe('Multi-Format Export', () => {
    it('should export to multiple formats', async () => {
      // Use tmp directory which should exist
      const tmpDir = '/tmp/automatosx-test';
      const results = await service.exportMultiple(mockReport, ['json', 'csv'], `${tmpDir}/report`);

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('json');
      expect(results[1].format).toBe('csv');
    });
  });

  describe('Validation', () => {
    it('should validate export options', () => {
      expect(() => {
        service.validateOptions({ format: 'json' });
      }).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => {
        service.validateOptions({ format: 'invalid' as any });
      }).toThrow('Invalid export format');
    });

    it('should reject relative output path', () => {
      expect(() => {
        service.validateOptions({
          format: 'json',
          outputPath: 'relative/path.json',
        });
      }).toThrow('Output path must be absolute');
    });
  });

  describe('Utilities', () => {
    it('should get correct file extension', () => {
      expect(service.getFileExtension('json')).toBe('json');
      expect(service.getFileExtension('csv')).toBe('csv');
      expect(service.getFileExtension('pdf')).toBe('pdf');
    });

    it('should get correct MIME type', () => {
      expect(service.getMimeType('json')).toBe('application/json');
      expect(service.getMimeType('csv')).toBe('text/csv');
      expect(service.getMimeType('pdf')).toBe('application/pdf');
    });
  });
});

describe('JSONExporter', () => {
  let exporter: JSONExporter;
  let mockReport: QualityReport;

  beforeEach(() => {
    exporter = new JSONExporter();
    mockReport = {
      summary: { totalFiles: 5, averageComplexity: 3, maintainabilityScore: 80, codeSmellCount: 5, analysisDate: Date.now() },
      files: [],
      codeSmells: [],
      metrics: {
        complexityDistribution: { low: 3, medium: 1, high: 1 },
        maintainabilityDistribution: { excellent: 1, good: 2, fair: 1, poor: 1 },
        languageBreakdown: { typescript: 5 },
        codeSmellsByType: {},
      },
    };
  });

  it('should export formatted JSON', () => {
    const result = exporter.export(mockReport, { format: 'json' });
    const content = result.content as string;

    expect(content).toContain('\n'); // Has formatting
    expect(JSON.parse(content)).toEqual(mockReport);
  });

  it('should export compact JSON', () => {
    const formatted = exporter.export(mockReport, { format: 'json' });
    const compact = exporter.exportCompact(mockReport, { format: 'json' });

    expect((compact.content as string).length).toBeLessThan((formatted.content as string).length);
  });
});

describe('CSVExporter', () => {
  let exporter: CSVExporter;
  let mockReport: QualityReport;

  beforeEach(() => {
    exporter = new CSVExporter();
    mockReport = {
      summary: { totalFiles: 1, averageComplexity: 5, maintainabilityScore: 75, codeSmellCount: 2, analysisDate: Date.now() },
      files: [
        { filePath: '/test.ts', language: 'typescript', complexity: 5, maintainability: 75, linesOfCode: 100, codeSmells: 2 },
      ],
      codeSmells: [
        { type: 'LONG_METHOD', severity: 'medium', filePath: '/test.ts', line: 10, message: 'Too long' },
      ],
      metrics: {
        complexityDistribution: { low: 0, medium: 1, high: 0 },
        maintainabilityDistribution: { excellent: 0, good: 1, fair: 0, poor: 0 },
        languageBreakdown: { typescript: 1 },
        codeSmellsByType: { LONG_METHOD: 1 },
      },
    };
  });

  it('should generate valid CSV', () => {
    const result = exporter.export(mockReport, { format: 'csv' });
    const lines = (result.content as string).split('\n');

    expect(lines.length).toBeGreaterThan(1); // Header + data rows
    expect(lines[0]).toContain('filePath'); // Header
  });

  it('should export code smells', () => {
    const result = exporter.exportCodeSmells(mockReport, { format: 'csv' });
    const content = result.content as string;

    expect(content).toContain('LONG_METHOD');
    expect(content).toContain('medium');
  });
});
