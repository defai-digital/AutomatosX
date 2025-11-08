/**
 * ErrorHandler.ts
 *
 * Enhanced error handling with user-friendly messages and recovery suggestions
 */

import chalk from 'chalk';

/**
 * Error categories for better error handling
 */
export enum ErrorCategory {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  NO_FILES_TO_INDEX = 'NO_FILES_TO_INDEX',
  NO_RESULTS_FOUND = 'NO_RESULTS_FOUND',
  INVALID_QUERY = 'INVALID_QUERY',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PARSER_ERROR = 'PARSER_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error with recovery suggestions
 */
export interface EnhancedError {
  category: ErrorCategory;
  message: string;
  suggestions: string[];
  originalError?: Error;
}

/**
 * Error handler with recovery suggestions
 */
export class ErrorHandler {
  /**
   * Create enhanced error from standard error
   */
  static enhance(error: Error | unknown): EnhancedError {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Detect error category from message
    if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      if (errorMsg.includes('directory')) {
        return this.directoryNotFound(errorMsg, error as Error);
      }
      return this.fileNotFound(errorMsg, error as Error);
    }

    if (errorMsg.includes('EACCES') || errorMsg.includes('permission denied')) {
      return this.permissionError(errorMsg, error as Error);
    }

    if (errorMsg.includes('database') || errorMsg.includes('sqlite')) {
      return this.databaseError(errorMsg, error as Error);
    }

    if (errorMsg.includes('parse') || errorMsg.includes('syntax')) {
      return this.parserError(errorMsg, error as Error);
    }

    if (errorMsg.includes('migration')) {
      return this.migrationError(errorMsg, error as Error);
    }

    return this.unknownError(errorMsg, error as Error);
  }

  /**
   * File not found error
   */
  static fileNotFound(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.FILE_NOT_FOUND,
      message: `File not found: ${message}`,
      suggestions: [
        'Check the file path is correct',
        'Use absolute path or path relative to current directory',
        'Run `ls` to verify the file exists',
        'Check file permissions',
      ],
      originalError,
    };
  }

  /**
   * Directory not found error
   */
  static directoryNotFound(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.DIRECTORY_NOT_FOUND,
      message: `Directory not found: ${message}`,
      suggestions: [
        'Check the directory path is correct',
        'Use `.` for current directory',
        'Run `pwd` to see your current directory',
        'Run `ls` to list available directories',
      ],
      originalError,
    };
  }

  /**
   * No files to index error
   */
  static noFilesToIndex(extensions: string[]): EnhancedError {
    return {
      category: ErrorCategory.NO_FILES_TO_INDEX,
      message: 'No files found matching the specified extensions',
      suggestions: [
        `Current extensions: ${extensions.join(', ')}`,
        'Try different extensions with -e flag',
        'Check if directory contains source files',
        'Verify ignored patterns are not too broad',
        'Example: ax index . -e .ts,.js,.py',
      ],
    };
  }

  /**
   * No results found error
   */
  static noResultsFound(query: string): EnhancedError {
    return {
      category: ErrorCategory.NO_RESULTS_FOUND,
      message: `No results found for query: "${query}"`,
      suggestions: [
        'Try different search terms',
        'Check spelling of function/class names',
        'Use partial matching (e.g., "handleUser" instead of "handleUserSubmit")',
        'Make sure files are indexed: ax index .',
        'Try natural language query: ax find "function that handles users"',
        'Use filters: ax find "lang:typescript handler"',
      ],
    };
  }

  /**
   * Invalid query error
   */
  static invalidQuery(query: string, reason: string): EnhancedError {
    return {
      category: ErrorCategory.INVALID_QUERY,
      message: `Invalid query: ${reason}`,
      suggestions: [
        'Query should be at least 2 characters',
        'Use quotes for multi-word queries',
        'Filter syntax: lang:typescript kind:function file:src/',
        'Examples:',
        '  ax find "getUserById"',
        '  ax find "lang:python class"',
        '  ax find "function that validates email"',
      ],
    };
  }

  /**
   * Database error
   */
  static databaseError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.DATABASE_ERROR,
      message: `Database error: ${message}`,
      suggestions: [
        'Try clearing the database: rm -rf .automatosx/db',
        'Re-run migrations will happen automatically',
        'Re-index your files: ax index .',
        'Check disk space with `df -h`',
        'Check file permissions in .automatosx/ directory',
      ],
      originalError,
    };
  }

  /**
   * Parser error
   */
  static parserError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.PARSER_ERROR,
      message: `Parser error: ${message}`,
      suggestions: [
        'Check if file has valid syntax',
        'Verify file extension matches content',
        'Try linting the file first',
        'Skip problematic files with --ignore flag',
        'File may have syntax errors that prevent parsing',
      ],
      originalError,
    };
  }

  /**
   * Migration error
   */
  static migrationError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.MIGRATION_ERROR,
      message: `Migration error: ${message}`,
      suggestions: [
        'Database schema migration failed',
        'Try clearing database: rm -rf .automatosx/db',
        'Re-run the command to trigger migrations',
        'Check for conflicting database files',
        'Report issue if problem persists',
      ],
      originalError,
    };
  }

  /**
   * Configuration error
   */
  static configurationError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.CONFIGURATION_ERROR,
      message: `Configuration error: ${message}`,
      suggestions: [
        'Check .axrc.json syntax is valid JSON',
        'Verify configuration values are within allowed ranges',
        'See default config: ax config show',
        'Delete .axrc.json to use defaults',
        'Configuration documentation: https://docs.automatosx.com/config',
      ],
      originalError,
    };
  }

  /**
   * Permission error
   */
  static permissionError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.PERMISSION_ERROR,
      message: `Permission denied: ${message}`,
      suggestions: [
        'Check file/directory permissions',
        'You may need elevated privileges',
        'Try: chmod +r <file> to add read permissions',
        'Check if files are owned by another user',
        'Use sudo only if necessary and you understand the risks',
      ],
      originalError,
    };
  }

  /**
   * Unknown error
   */
  static unknownError(message: string, originalError?: Error): EnhancedError {
    return {
      category: ErrorCategory.UNKNOWN_ERROR,
      message: `Unexpected error: ${message}`,
      suggestions: [
        'Try running the command again',
        'Check for typos in command arguments',
        'Run with --verbose for more details (if available)',
        'Report issue with error message and command used',
        'GitHub Issues: https://github.com/automatosx/automatosx/issues',
      ],
      originalError,
    };
  }

  /**
   * Display enhanced error with formatting
   */
  static display(error: EnhancedError, verbose: boolean = false): void {
    console.log();
    console.log(chalk.red(chalk.bold('✗ Error:')) + ' ' + chalk.red(error.message));

    if (error.suggestions.length > 0) {
      console.log();
      console.log(chalk.yellow(chalk.bold('💡 Suggestions:')));
      error.suggestions.forEach((suggestion, index) => {
        // Check if this is an example or detail line (starts with space)
        if (suggestion.startsWith('  ')) {
          console.log(chalk.dim(suggestion));
        } else {
          console.log(chalk.yellow(`  ${index + 1}.`) + ' ' + chalk.dim(suggestion));
        }
      });
    }

    if (verbose && error.originalError) {
      console.log();
      console.log(chalk.dim(chalk.bold('Debug Info:')));
      console.log(chalk.dim(error.originalError.stack || error.originalError.message));
    }

    console.log();
  }

  /**
   * Handle error and exit
   */
  static handleAndExit(error: Error | unknown, verbose: boolean = false): never {
    const enhanced = this.enhance(error);
    this.display(enhanced, verbose);
    process.exit(1);
  }

  /**
   * Create error for no index data
   */
  static noIndexData(): EnhancedError {
    return {
      category: ErrorCategory.NO_RESULTS_FOUND,
      message: 'No files have been indexed yet',
      suggestions: [
        'Index your codebase first: ax index .',
        'Or index a specific directory: ax index src/',
        'Watch for changes: ax watch .',
        'Check what extensions are indexed: ax index --help',
      ],
    };
  }

  /**
   * Validate query and throw if invalid
   */
  static validateQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    if (query.trim().length < 2) {
      throw new Error('Query must be at least 2 characters');
    }
  }

  /**
   * Validate directory exists
   */
  static validateDirectoryExists(path: string): void {
    const fs = require('fs');

    try {
      const stats = fs.statSync(path);
      if (!stats.isDirectory()) {
        throw new Error(`${path} is not a directory`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Directory not found: ${path}`);
      }
      throw error;
    }
  }

  /**
   * Validate file exists
   */
  static validateFileExists(path: string): void {
    const fs = require('fs');

    try {
      const stats = fs.statSync(path);
      if (!stats.isFile()) {
        throw new Error(`${path} is not a file`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${path}`);
      }
      throw error;
    }
  }
}

/**
 * Success message helper
 */
export class SuccessMessage {
  /**
   * Display success message
   */
  static display(message: string, details?: string[]): void {
    console.log();
    console.log(chalk.green(chalk.bold('✓ Success:')) + ' ' + message);

    if (details && details.length > 0) {
      console.log();
      details.forEach((detail) => {
        console.log(chalk.dim('  • ' + detail));
      });
    }

    console.log();
  }
}

/**
 * Warning message helper
 */
export class WarningMessage {
  /**
   * Display warning message
   */
  static display(message: string, details?: string[]): void {
    console.log();
    console.log(chalk.yellow(chalk.bold('⚠ Warning:')) + ' ' + message);

    if (details && details.length > 0) {
      console.log();
      details.forEach((detail) => {
        console.log(chalk.dim('  • ' + detail));
      });
    }

    console.log();
  }
}

/**
 * Info message helper
 */
export class InfoMessage {
  /**
   * Display info message
   */
  static display(message: string, details?: string[]): void {
    console.log();
    console.log(chalk.cyan(chalk.bold('ℹ Info:')) + ' ' + message);

    if (details && details.length > 0) {
      console.log();
      details.forEach((detail) => {
        console.log(chalk.dim('  • ' + detail));
      });
    }

    console.log();
  }
}
