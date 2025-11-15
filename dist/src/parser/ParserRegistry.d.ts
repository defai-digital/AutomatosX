/**
 * ParserRegistry.ts
 *
 * Central registry for language parsers
 * Manages multiple language parsers and routes to the appropriate one based on file extension
 */
import { LanguageParser, ParseResult } from './LanguageParser.js';
/**
 * ParserRegistry - Manages language parsers and routes to the appropriate one
 */
export declare class ParserRegistry {
    private parsers;
    private extensionMap;
    constructor();
    /**
     * Register default language parsers
     */
    private registerDefaultParsers;
    /**
     * Register a language parser
     *
     * @param parser - Language parser instance
     */
    registerParser(parser: LanguageParser): void;
    /**
     * Get parser by language name
     *
     * @param language - Language identifier (e.g., 'typescript', 'python')
     * @returns Language parser or undefined
     */
    getParser(language: string): LanguageParser | undefined;
    /**
     * Get parser by file extension
     *
     * @param extension - File extension (e.g., '.ts', '.py')
     * @returns Language parser or undefined
     */
    getParserByExtension(extension: string): LanguageParser | undefined;
    /**
     * Get parser by file path
     *
     * @param filePath - Path to source file
     * @returns Language parser or undefined
     */
    getParserByPath(filePath: string): LanguageParser | undefined;
    /**
     * Parse source code using the appropriate parser
     *
     * @param content - Source code content
     * @param filePath - Path to source file (used to determine language)
     * @returns Parse result with extracted symbols
     * @throws Error if no parser found for file type
     */
    parse(content: string, filePath: string): ParseResult;
    /**
     * Check if a file type is supported
     *
     * @param filePath - Path to source file
     * @returns True if supported, false otherwise
     */
    isSupported(filePath: string): boolean;
    /**
     * Get list of supported languages
     *
     * @returns Array of language identifiers
     */
    getSupportedLanguages(): string[];
    /**
     * Get list of supported file extensions
     *
     * @returns Array of file extensions
     */
    getSupportedExtensions(): string[];
    /**
     * Get language for a file path
     *
     * @param filePath - Path to source file
     * @returns Language identifier or undefined
     */
    getLanguageForPath(filePath: string): string | undefined;
}
/**
 * Get the singleton ParserRegistry instance
 *
 * @returns ParserRegistry instance
 */
export declare function getParserRegistry(): ParserRegistry;
/**
 * Reset the singleton instance (useful for testing)
 */
export declare function resetParserRegistry(): void;
//# sourceMappingURL=ParserRegistry.d.ts.map