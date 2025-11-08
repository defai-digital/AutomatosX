/**
 * ParserRegistry.ts
 *
 * Central registry for language parsers
 * Manages multiple language parsers and routes to the appropriate one based on file extension
 */

import { extname } from 'path';
import { LanguageParser, ParseResult } from './LanguageParser.js';
import { TypeScriptParserService } from './TypeScriptParserService.js';
import { PythonParserService } from './PythonParserService.js';
import { GoParserService } from './GoParserService.js';
import { JavaParserService } from './JavaParserService.js';
import { RustParserService } from './RustParserService.js';
import { RubyParserService } from './RubyParserService.js';
import { CSharpParserService } from './CSharpParserService.js';
import { CppParserService } from './CppParserService.js';
import { PhpParserService } from './PhpParserService.js';
import { KotlinParserService } from './KotlinParserService.js';
import { HtmlParserService } from './HtmlParserService.js';
import { SwiftParserService } from './SwiftParserService.js';
import { SqlParserService } from './SqlParserService.js';
import { AssemblyScriptParserService } from './AssemblyScriptParserService.js';

/**
 * ParserRegistry - Manages language parsers and routes to the appropriate one
 */
export class ParserRegistry {
  private parsers: Map<string, LanguageParser> = new Map();
  private extensionMap: Map<string, LanguageParser> = new Map();

  constructor() {
    // Register default parsers
    this.registerDefaultParsers();
  }

  /**
   * Register default language parsers
   */
  private registerDefaultParsers(): void {
    // TypeScript/JavaScript parser
    this.registerParser(new TypeScriptParserService());

    // Python parser
    this.registerParser(new PythonParserService());

    // Go parser
    this.registerParser(new GoParserService());

    // Java parser
    this.registerParser(new JavaParserService());

    // Rust parser
    this.registerParser(new RustParserService());

    // Ruby parser
    this.registerParser(new RubyParserService());

    // C# parser
    this.registerParser(new CSharpParserService());

    // C++ parser
    this.registerParser(new CppParserService());

    // PHP parser
    this.registerParser(new PhpParserService());

    // Kotlin parser
    this.registerParser(new KotlinParserService());

    // Swift parser
    this.registerParser(new SwiftParserService());

    // SQL parser
    this.registerParser(new SqlParserService());

    // AssemblyScript parser (uses .as.ts extension to avoid .ts conflict)
    this.registerParser(new AssemblyScriptParserService());

    // HTML parser
    this.registerParser(new HtmlParserService());
  }

  /**
   * Register a language parser
   *
   * @param parser - Language parser instance
   */
  registerParser(parser: LanguageParser): void {
    this.parsers.set(parser.language, parser);

    // Map all extensions to this parser
    for (const ext of parser.extensions) {
      this.extensionMap.set(ext, parser);
    }
  }

  /**
   * Get parser by language name
   *
   * @param language - Language identifier (e.g., 'typescript', 'python')
   * @returns Language parser or undefined
   */
  getParser(language: string): LanguageParser | undefined {
    return this.parsers.get(language);
  }

  /**
   * Get parser by file extension
   *
   * @param extension - File extension (e.g., '.ts', '.py')
   * @returns Language parser or undefined
   */
  getParserByExtension(extension: string): LanguageParser | undefined {
    return this.extensionMap.get(extension);
  }

  /**
   * Get parser by file path
   *
   * @param filePath - Path to source file
   * @returns Language parser or undefined
   */
  getParserByPath(filePath: string): LanguageParser | undefined {
    const ext = extname(filePath);
    return this.getParserByExtension(ext);
  }

  /**
   * Parse source code using the appropriate parser
   *
   * @param content - Source code content
   * @param filePath - Path to source file (used to determine language)
   * @returns Parse result with extracted symbols
   * @throws Error if no parser found for file type
   */
  parse(content: string, filePath: string): ParseResult {
    const parser = this.getParserByPath(filePath);

    if (!parser) {
      const ext = extname(filePath);
      throw new Error(`No parser registered for file extension: ${ext}`);
    }

    return parser.parse(content);
  }

  /**
   * Check if a file type is supported
   *
   * @param filePath - Path to source file
   * @returns True if supported, false otherwise
   */
  isSupported(filePath: string): boolean {
    const ext = extname(filePath);
    return this.extensionMap.has(ext);
  }

  /**
   * Get list of supported languages
   *
   * @returns Array of language identifiers
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Get list of supported file extensions
   *
   * @returns Array of file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Get language for a file path
   *
   * @param filePath - Path to source file
   * @returns Language identifier or undefined
   */
  getLanguageForPath(filePath: string): string | undefined {
    const parser = this.getParserByPath(filePath);
    return parser?.language;
  }
}

/**
 * Singleton instance of ParserRegistry
 */
let registryInstance: ParserRegistry | null = null;

/**
 * Get the singleton ParserRegistry instance
 *
 * @returns ParserRegistry instance
 */
export function getParserRegistry(): ParserRegistry {
  if (!registryInstance) {
    registryInstance = new ParserRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetParserRegistry(): void {
  registryInstance = null;
}
