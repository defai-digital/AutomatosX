/**
 * Diagnostics Provider
 *
 * Provides code quality diagnostics for documents.
 * Integrates with QualityService to analyze code quality.
 * Publishes diagnostics for complexity, maintainability, and code smells.
 */
import { QualityService } from '../../analytics/quality/QualityService.js';
import { uriToFilePath, getLanguageId } from '../utils/lsp-utils.js';
const DEFAULT_CONFIG = {
    enabled: true,
    complexityThreshold: 15,
    maintainabilityThreshold: 50,
    debounceMs: 300,
};
/**
 * Diagnostics Provider
 * Analyzes code quality and publishes diagnostics
 */
export class DiagnosticsProvider {
    documentManager;
    qualityService;
    config;
    debounceTimers = new Map();
    diagnosticsCache = new Map();
    constructor(documentManager, config) {
        this.documentManager = documentManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.qualityService = new QualityService();
    }
    /**
     * Analyze document and return diagnostics
     */
    async provideDiagnostics(uri) {
        try {
            // Check cache first
            const cached = this.diagnosticsCache.get(uri);
            if (cached) {
                return cached;
            }
            const filePath = uriToFilePath(uri);
            const languageId = getLanguageId(filePath);
            const language = this.mapLanguageId(languageId);
            if (!language) {
                return [];
            }
            // Analyze file quality
            const qualityReport = await this.qualityService.analyzeFile(filePath, language);
            // Convert quality report to diagnostics
            const diagnostics = this.convertQualityReportToDiagnostics(qualityReport);
            // Cache diagnostics
            this.diagnosticsCache.set(uri, diagnostics);
            return diagnostics;
        }
        catch (error) {
            console.error(`Error providing diagnostics for ${uri}:`, error);
            return [];
        }
    }
    /**
     * Analyze document with debouncing
     */
    async provideDiagnosticsDebounced(uri, callback) {
        // Clear existing timer
        const existingTimer = this.debounceTimers.get(uri);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Set new timer
        const timer = setTimeout(async () => {
            const diagnostics = await this.provideDiagnostics(uri);
            callback(diagnostics);
            this.debounceTimers.delete(uri);
        }, this.config.debounceMs);
        this.debounceTimers.set(uri, timer);
    }
    /**
     * Clear diagnostics for document
     */
    clearDiagnostics(uri) {
        this.diagnosticsCache.delete(uri);
        const timer = this.debounceTimers.get(uri);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(uri);
        }
    }
    /**
     * Convert QualityReport to LSP diagnostics
     */
    convertQualityReportToDiagnostics(report) {
        const diagnostics = [];
        // Add complexity diagnostics
        if (report.complexity.averageComplexity > this.config.complexityThreshold) {
            diagnostics.push({
                severity: this.getSeverityForComplexity(report.complexity.averageComplexity),
                range: this.createFileRange(),
                message: `High cyclomatic complexity: ${report.complexity.averageComplexity.toFixed(1)} (threshold: ${this.config.complexityThreshold})`,
                source: 'automatosx-quality',
                code: 'high-complexity',
            });
        }
        // Add maintainability diagnostics
        if (report.maintainability.maintainabilityIndex < this.config.maintainabilityThreshold) {
            diagnostics.push({
                severity: this.getSeverityForMaintainability(report.maintainability.maintainabilityIndex),
                range: this.createFileRange(),
                message: `Low maintainability index: ${report.maintainability.maintainabilityIndex.toFixed(1)} (threshold: ${this.config.maintainabilityThreshold})`,
                source: 'automatosx-quality',
                code: 'low-maintainability',
            });
        }
        // Add code smell diagnostics
        for (const smell of report.maintainability.codeSmells) {
            const diagnostic = {
                severity: this.mapSmellSeverity(smell.severity),
                range: this.createRangeFromSmell(smell),
                message: smell.message,
                source: 'automatosx-quality',
                code: smell.type || 'code-smell',
            };
            diagnostics.push(diagnostic);
        }
        // Add quality score diagnostic
        if (report.summary.qualityScore < 50) {
            diagnostics.push({
                severity: 2, // Warning
                range: this.createFileRange(),
                message: `Quality score is ${report.summary.qualityScore.toFixed(1)}/100. ${report.summary.topRecommendations[0] || 'Consider refactoring.'}`,
                source: 'automatosx-quality',
                code: 'low-quality-score',
            });
        }
        // Add technical debt diagnostic
        if (report.summary.technicalDebtHours > 8) {
            diagnostics.push({
                severity: 2, // Warning
                range: this.createFileRange(),
                message: `High technical debt: ${report.summary.technicalDebtHours.toFixed(1)} hours estimated to fix`,
                source: 'automatosx-quality',
                code: 'high-technical-debt',
            });
        }
        return diagnostics;
    }
    /**
     * Get diagnostic severity for complexity
     */
    getSeverityForComplexity(complexity) {
        if (complexity > 30) {
            return 1; // Error
        }
        else if (complexity > 20) {
            return 2; // Warning
        }
        else {
            return 3; // Information
        }
    }
    /**
     * Get diagnostic severity for maintainability
     */
    getSeverityForMaintainability(maintainability) {
        if (maintainability < 30) {
            return 1; // Error
        }
        else if (maintainability < 50) {
            return 2; // Warning
        }
        else {
            return 3; // Information
        }
    }
    /**
     * Map code smell severity to LSP severity
     */
    mapSmellSeverity(severity) {
        switch (severity) {
            case 'high':
                return 1; // Error
            case 'medium':
                return 2; // Warning
            case 'low':
                return 3; // Information
            default:
                return 4; // Hint
        }
    }
    /**
     * Create range from code smell
     */
    createRangeFromSmell(smell) {
        // If smell has location info, use it
        if (smell.line !== undefined) {
            return {
                start: { line: smell.line, character: 0 },
                end: { line: smell.line, character: 9999 },
            };
        }
        // Otherwise, use file range
        return this.createFileRange();
    }
    /**
     * Create file-level range (line 0)
     */
    createFileRange() {
        return {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 9999 },
        };
    }
    /**
     * Map language ID to Language enum
     */
    mapLanguageId(languageId) {
        const languageMap = {
            typescript: 'typescript',
            typescriptreact: 'typescript',
            javascript: 'javascript',
            javascriptreact: 'javascript',
            python: 'python',
            go: 'go',
            rust: 'rust',
            ruby: 'ruby',
            java: 'java',
            csharp: 'csharp',
            php: 'php',
            kotlin: 'kotlin',
            swift: 'swift',
            ocaml: 'ocaml',
        };
        return languageMap[languageId] || null;
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            cachedFiles: this.diagnosticsCache.size,
            pendingAnalysis: this.debounceTimers.size,
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.diagnosticsCache.clear();
    }
}
//# sourceMappingURL=DiagnosticsProvider.js.map