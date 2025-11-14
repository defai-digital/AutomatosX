/**
 * ParserRegistry.ts
 *
 * Central registry for language parsers
 * Manages multiple language parsers and routes to the appropriate one based on file extension
 */
import { extname } from 'path';
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
// New parsers
import { CParserService } from './CParserService.js';
import { ObjectiveCParserService } from './ObjectiveCParserService.js';
import { ScalaParserService } from './ScalaParserService.js';
import { LuaParserService } from './LuaParserService.js';
import { BashParserService } from './BashParserService.js';
import { ZshParserService } from './ZshParserService.js';
import { JsonParserService } from './JsonParserService.js';
import { YamlParserService } from './YamlParserService.js';
import { TomlParserService } from './TomlParserService.js';
import { MarkdownParserService } from './MarkdownParserService.js';
import { CsvParserService } from './CsvParserService.js';
import { OcamlParserService } from './OcamlParserService.js';
import { ElmParserService } from './ElmParserService.js';
import { MakefileParserService } from './MakefileParserService.js';
import { RegexParserService } from './RegexParserService.js';
import { CudaParserService } from './CudaParserService.js';
// FPGA and scientific computing parsers
import { VerilogParserService } from './VerilogParserService.js';
import { SystemVerilogParserService } from './SystemVerilogParserService.js';
import { JuliaParserService } from './JuliaParserService.js';
import { MatlabParserService } from './MatlabParserService.js';
// Major language parsers
import { HaskellParserService } from './HaskellParserService.js';
import { DartParserService } from './DartParserService.js';
import { ElixirParserService } from './ElixirParserService.js';
import { ZigParserService } from './ZigParserService.js';
import { SolidityParserService } from './SolidityParserService.js';
import { PerlParserService } from './PerlParserService.js';
import { GleamParserService } from './GleamParserService.js';
// DevOps/IaC parsers
import { HclParserService } from './HclParserService.js';
import { GroovyParserService } from './GroovyParserService.js';
import { PuppetParserService } from './PuppetParserService.js';
import { ThriftParserService } from './ThriftParserService.js';
// Data/Config parsers
import { XmlParserService } from './XmlParserService.js';
/**
 * ParserRegistry - Manages language parsers and routes to the appropriate one
 */
export class ParserRegistry {
    parsers = new Map();
    extensionMap = new Map();
    constructor() {
        // Register default parsers
        this.registerDefaultParsers();
    }
    /**
     * Register default language parsers
     */
    registerDefaultParsers() {
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
        // Systems languages
        this.registerParser(new CParserService());
        this.registerParser(new ObjectiveCParserService());
        this.registerParser(new CudaParserService());
        // JVM/Data languages
        this.registerParser(new ScalaParserService());
        // Shell/Scripting
        this.registerParser(new LuaParserService());
        this.registerParser(new BashParserService());
        this.registerParser(new ZshParserService());
        // Config/Data formats
        this.registerParser(new JsonParserService());
        this.registerParser(new YamlParserService());
        this.registerParser(new TomlParserService());
        this.registerParser(new XmlParserService());
        // Documentation
        this.registerParser(new MarkdownParserService());
        this.registerParser(new CsvParserService());
        // Functional
        this.registerParser(new OcamlParserService());
        this.registerParser(new ElmParserService());
        // DevOps
        this.registerParser(new MakefileParserService());
        // Utility
        this.registerParser(new RegexParserService());
        // FPGA/Hardware description
        this.registerParser(new VerilogParserService());
        this.registerParser(new SystemVerilogParserService());
        // Scientific computing
        this.registerParser(new JuliaParserService());
        this.registerParser(new MatlabParserService());
        // Major languages expansion
        this.registerParser(new HaskellParserService());
        this.registerParser(new DartParserService());
        this.registerParser(new ElixirParserService());
        this.registerParser(new ZigParserService());
        this.registerParser(new SolidityParserService());
        this.registerParser(new PerlParserService());
        this.registerParser(new GleamParserService());
        // DevOps/Infrastructure as Code
        this.registerParser(new HclParserService());
        this.registerParser(new GroovyParserService());
        this.registerParser(new PuppetParserService());
        // Messaging/RPC frameworks
        this.registerParser(new ThriftParserService());
    }
    /**
     * Register a language parser
     *
     * @param parser - Language parser instance
     */
    registerParser(parser) {
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
    getParser(language) {
        return this.parsers.get(language);
    }
    /**
     * Get parser by file extension
     *
     * @param extension - File extension (e.g., '.ts', '.py')
     * @returns Language parser or undefined
     */
    getParserByExtension(extension) {
        return this.extensionMap.get(extension);
    }
    /**
     * Get parser by file path
     *
     * @param filePath - Path to source file
     * @returns Language parser or undefined
     */
    getParserByPath(filePath) {
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
    parse(content, filePath) {
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
    isSupported(filePath) {
        const ext = extname(filePath);
        return this.extensionMap.has(ext);
    }
    /**
     * Get list of supported languages
     *
     * @returns Array of language identifiers
     */
    getSupportedLanguages() {
        return Array.from(this.parsers.keys());
    }
    /**
     * Get list of supported file extensions
     *
     * @returns Array of file extensions
     */
    getSupportedExtensions() {
        return Array.from(this.extensionMap.keys());
    }
    /**
     * Get language for a file path
     *
     * @param filePath - Path to source file
     * @returns Language identifier or undefined
     */
    getLanguageForPath(filePath) {
        const parser = this.getParserByPath(filePath);
        return parser?.language;
    }
}
/**
 * Singleton instance of ParserRegistry
 */
let registryInstance = null;
/**
 * Get the singleton ParserRegistry instance
 *
 * @returns ParserRegistry instance
 */
export function getParserRegistry() {
    if (!registryInstance) {
        registryInstance = new ParserRegistry();
    }
    return registryInstance;
}
/**
 * Reset the singleton instance (useful for testing)
 */
export function resetParserRegistry() {
    registryInstance = null;
}
//# sourceMappingURL=ParserRegistry.js.map