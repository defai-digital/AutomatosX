/**
 * Error Catalog
 * Sprint 6 Day 56: Standardized error messages with codes and remediation guidance
 */
/**
 * Error severity level
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
/**
 * Error category
 */
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["DATABASE"] = "database";
    ErrorCategory["FILE_SYSTEM"] = "file_system";
    ErrorCategory["PARSER"] = "parser";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["CONFIGURATION"] = "configuration";
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["PERMISSION"] = "permission";
    ErrorCategory["RESOURCE"] = "resource";
    ErrorCategory["PLUGIN"] = "plugin";
    ErrorCategory["MIGRATION"] = "migration";
})(ErrorCategory || (ErrorCategory = {}));
/**
 * Error Catalog - Standardized error messages
 */
export class ErrorCatalog {
    static errors = new Map([
        // Database Errors (DB-*)
        [
            'DB-001',
            {
                code: 'DB-001',
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.DATABASE,
                message: 'Database connection failed',
                description: 'Unable to establish connection to the SQLite database',
                remediation: [
                    'Check database file permissions',
                    'Verify database path in configuration',
                    'Ensure disk space is available',
                    'Try reindexing with: ax index --rebuild',
                ],
                learnMore: 'https://docs.automatosx.com/troubleshooting/database',
            },
        ],
        [
            'DB-002',
            {
                code: 'DB-002',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.DATABASE,
                message: 'Database migration failed',
                description: 'Failed to apply database schema migrations',
                remediation: [
                    'Check migration logs for details',
                    'Verify database is not corrupted',
                    'Backup and recreate database if needed',
                    'Contact support if issue persists',
                ],
                learnMore: 'https://docs.automatosx.com/database/migrations',
            },
        ],
        [
            'DB-003',
            {
                code: 'DB-003',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.DATABASE,
                message: 'Query execution failed',
                description: 'Database query failed to execute',
                remediation: [
                    'Check query syntax in error message',
                    'Verify database schema is up to date',
                    'Run: ax status --verbose to check database health',
                    'Clear cache and retry with: ax cache clear',
                ],
            },
        ],
        // File System Errors (FS-*)
        [
            'FS-001',
            {
                code: 'FS-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.FILE_SYSTEM,
                message: 'File not found',
                description: 'The specified file does not exist',
                remediation: [
                    'Verify file path is correct',
                    'Check file has not been moved or deleted',
                    'Ensure relative paths are correct',
                    'Use absolute paths if needed',
                ],
            },
        ],
        [
            'FS-002',
            {
                code: 'FS-002',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.FILE_SYSTEM,
                message: 'Permission denied',
                description: 'Insufficient permissions to access file or directory',
                remediation: [
                    'Check file/directory permissions',
                    'Run command with appropriate privileges',
                    'Verify user has read/write access',
                    'Use chmod/chown to adjust permissions',
                ],
            },
        ],
        [
            'FS-003',
            {
                code: 'FS-003',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.FILE_SYSTEM,
                message: 'File too large',
                description: 'File exceeds maximum indexing size',
                remediation: [
                    'File will be skipped during indexing',
                    'Increase maxFileSize in configuration if needed',
                    'Consider excluding large files from indexing',
                    'Check: automatosx.config.json',
                ],
                learnMore: 'https://docs.automatosx.com/configuration',
            },
        ],
        [
            'FS-004',
            {
                code: 'FS-004',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.FILE_SYSTEM,
                message: 'Disk space insufficient',
                description: 'Not enough disk space to complete operation',
                remediation: [
                    'Free up disk space',
                    'Clear old cache: ax cache clear',
                    'Prune old backups: ax backup prune --days 30',
                    'Move database to larger volume',
                ],
            },
        ],
        // Parser Errors (PARSE-*)
        [
            'PARSE-001',
            {
                code: 'PARSE-001',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.PARSER,
                message: 'Parse error',
                description: 'Failed to parse file syntax',
                remediation: [
                    'File will be indexed with limited symbol extraction',
                    'Check file for syntax errors',
                    'Verify language is supported',
                    'File will still be searchable via full-text',
                ],
            },
        ],
        [
            'PARSE-002',
            {
                code: 'PARSE-002',
                severity: ErrorSeverity.INFO,
                category: ErrorCategory.PARSER,
                message: 'Language not supported',
                description: 'File language is not currently supported for parsing',
                remediation: [
                    'File will be indexed with full-text search only',
                    'Supported languages: TypeScript, JavaScript, Python, Go, Rust, etc.',
                    'Check configuration: ax config show',
                    'Request language support: github.com/defai-digital/automatosx/issues',
                ],
                learnMore: 'https://docs.automatosx.com/parsers',
            },
        ],
        // Network Errors (NET-*)
        [
            'NET-001',
            {
                code: 'NET-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.NETWORK,
                message: 'Network request failed',
                description: 'Failed to complete network request',
                remediation: [
                    'Check internet connection',
                    'Verify proxy settings if applicable',
                    'Retry operation',
                    'Check firewall settings',
                ],
            },
        ],
        [
            'NET-002',
            {
                code: 'NET-002',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.NETWORK,
                message: 'API rate limit exceeded',
                description: 'Too many requests to external API',
                remediation: [
                    'Wait before retrying',
                    'Check rate limit headers',
                    'Reduce request frequency',
                    'Consider caching results',
                ],
            },
        ],
        // Configuration Errors (CFG-*)
        [
            'CFG-001',
            {
                code: 'CFG-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.CONFIGURATION,
                message: 'Invalid configuration',
                description: 'Configuration file contains invalid values',
                remediation: [
                    'Check automatosx.config.json for syntax errors',
                    'Validate against schema',
                    'Reset to defaults: ax config reset',
                    'Review documentation for valid options',
                ],
                learnMore: 'https://docs.automatosx.com/configuration',
            },
        ],
        [
            'CFG-002',
            {
                code: 'CFG-002',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.CONFIGURATION,
                message: 'Configuration not found',
                description: 'No configuration file found, using defaults',
                remediation: [
                    'Create automatosx.config.json in project root',
                    'Use: ax config init to create default config',
                    'Default values will be used',
                    'This is normal for first-time setup',
                ],
            },
        ],
        // Validation Errors (VAL-*)
        [
            'VAL-001',
            {
                code: 'VAL-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.VALIDATION,
                message: 'Invalid input',
                description: 'User input failed validation',
                remediation: [
                    'Check input format matches expected pattern',
                    'Review command usage: ax <command> --help',
                    'Verify required arguments are provided',
                    'Check for typos in command or arguments',
                ],
            },
        ],
        [
            'VAL-002',
            {
                code: 'VAL-002',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.VALIDATION,
                message: 'Missing required argument',
                description: 'Required command argument not provided',
                remediation: [
                    'Check command usage: ax <command> --help',
                    'Provide all required arguments',
                    'Review examples in documentation',
                ],
            },
        ],
        // Permission Errors (PERM-*)
        [
            'PERM-001',
            {
                code: 'PERM-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.PERMISSION,
                message: 'Insufficient permissions',
                description: 'Operation requires elevated privileges',
                remediation: [
                    'Run command with sudo if appropriate',
                    'Check user permissions',
                    'Verify ownership of files/directories',
                    'Use appropriate user account',
                ],
            },
        ],
        // Resource Errors (RES-*)
        [
            'RES-001',
            {
                code: 'RES-001',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.RESOURCE,
                message: 'Memory limit exceeded',
                description: 'Operation exceeded memory limits',
                remediation: [
                    'Reduce batch size',
                    'Process files in smaller chunks',
                    'Increase system memory',
                    'Close other applications',
                ],
            },
        ],
        [
            'RES-002',
            {
                code: 'RES-002',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.RESOURCE,
                message: 'Timeout exceeded',
                description: 'Operation took longer than allowed timeout',
                remediation: [
                    'Increase timeout in configuration',
                    'Reduce scope of operation',
                    'Check system performance',
                    'Retry operation',
                ],
            },
        ],
        // Plugin Errors (PLG-*)
        [
            'PLG-001',
            {
                code: 'PLG-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.PLUGIN,
                message: 'Plugin not found',
                description: 'Specified plugin does not exist',
                remediation: [
                    'Check plugin name spelling',
                    'List available plugins: ax plugin list',
                    'Install plugin: ax plugin install <name>',
                    'Search marketplace: ax marketplace search',
                ],
                learnMore: 'https://docs.automatosx.com/plugins',
            },
        ],
        [
            'PLG-002',
            {
                code: 'PLG-002',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.PLUGIN,
                message: 'Plugin incompatible',
                description: 'Plugin is not compatible with current version',
                remediation: [
                    'Update plugin: ax plugin update <name>',
                    'Check plugin compatibility',
                    'Update AutomatosX: npm update -g @defai.digital/automatosx',
                    'Contact plugin author for compatibility',
                ],
            },
        ],
        [
            'PLG-003',
            {
                code: 'PLG-003',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.PLUGIN,
                message: 'Plugin load failed',
                description: 'Failed to load or initialize plugin',
                remediation: [
                    'Check plugin logs for details',
                    'Verify plugin installation',
                    'Reinstall plugin: ax plugin reinstall <name>',
                    'Check plugin dependencies',
                ],
            },
        ],
        // Migration Errors (MIG-*)
        [
            'MIG-001',
            {
                code: 'MIG-001',
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.MIGRATION,
                message: 'Migration validation failed',
                description: 'v1 configuration is not compatible with v2',
                remediation: [
                    'Review compatibility report',
                    'Fix incompatible plugins and settings',
                    'Run: ax migrate validate for details',
                    'Consult migration guide',
                ],
                learnMore: 'https://docs.automatosx.com/migration',
            },
        ],
        [
            'MIG-002',
            {
                code: 'MIG-002',
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.MIGRATION,
                message: 'Migration rollback required',
                description: 'Migration failed and rollback is needed',
                remediation: [
                    'Stop all AutomatosX processes',
                    'Restore from backup: ax backup restore',
                    'Review migration logs',
                    'Contact support for assistance',
                ],
            },
        ],
    ]);
    /**
     * Get error by code
     */
    static getError(code) {
        return this.errors.get(code);
    }
    /**
     * Get all errors
     */
    static getAllErrors() {
        return Array.from(this.errors.values());
    }
    /**
     * Get errors by category
     */
    static getErrorsByCategory(category) {
        return Array.from(this.errors.values()).filter((e) => e.category === category);
    }
    /**
     * Get errors by severity
     */
    static getErrorsBySeverity(severity) {
        return Array.from(this.errors.values()).filter((e) => e.severity === severity);
    }
    /**
     * Format error for display
     */
    static formatError(code, context) {
        const error = this.getError(code);
        if (!error) {
            return `Unknown error: ${code}`;
        }
        const lines = [];
        // Header with code and severity
        lines.push(`[${error.code}] ${error.message} (${error.severity})`);
        lines.push('');
        // Description
        lines.push(error.description);
        lines.push('');
        // Context if provided
        if (context && Object.keys(context).length > 0) {
            lines.push('Details:');
            for (const [key, value] of Object.entries(context)) {
                lines.push(`  ${key}: ${value}`);
            }
            lines.push('');
        }
        // Remediation steps
        lines.push('What to do:');
        for (const step of error.remediation) {
            lines.push(`  • ${step}`);
        }
        // Learn more link
        if (error.learnMore) {
            lines.push('');
            lines.push(`Learn more: ${error.learnMore}`);
        }
        return lines.join('\n');
    }
    /**
     * Register custom error
     */
    static registerError(error) {
        this.errors.set(error.code, error);
    }
    /**
     * Check if error exists
     */
    static hasError(code) {
        return this.errors.has(code);
    }
    /**
     * Get error count
     */
    static getErrorCount() {
        return this.errors.size;
    }
    /**
     * Get all error codes
     */
    static getAllErrorCodes() {
        return Array.from(this.errors.keys());
    }
    /**
     * Clear all custom errors (built-in errors remain)
     */
    static clearCustomErrors() {
        // Keep only errors with standard prefixes
        const standardPrefixes = ['DB-', 'FS-', 'PARSE-', 'NET-', 'CFG-', 'VAL-', 'PERM-', 'RES-', 'PLG-', 'MIG-'];
        for (const code of this.errors.keys()) {
            const isStandard = standardPrefixes.some((prefix) => code.startsWith(prefix));
            if (!isStandard) {
                this.errors.delete(code);
            }
        }
    }
}
/**
 * Create error instance from catalog
 */
export function createCatalogError(code, context) {
    const error = ErrorCatalog.getError(code);
    if (!error) {
        return new Error(`Unknown error: ${code}`);
    }
    const message = ErrorCatalog.formatError(code, context);
    const err = new Error(message);
    err.name = code;
    return err;
}
//# sourceMappingURL=ErrorCatalog.js.map