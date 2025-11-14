import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol, Call, Import } from './LanguageParser.js';
/**
 * Parser for Apache Thrift IDL (Interface Definition Language)
 *
 * Thrift is an RPC framework and IDL for building scalable cross-language services.
 * This parser extracts:
 * - Services: Service definitions with RPC methods
 * - Structs: Data structure definitions
 * - Enums: Enumeration types
 * - Exceptions: Exception types
 * - Typedefs: Type aliases
 * - Constants: Constant declarations
 * - Functions: RPC method definitions
 * - Includes: File imports
 *
 * Use cases:
 * - Microservices communication
 * - Cross-language RPC
 * - API schema definition
 * - Distributed systems
 *
 * File extensions: .thrift
 */
export declare class ThriftParserService extends BaseLanguageParser {
    readonly language = "thrift";
    readonly extensions: string[];
    protected getGrammar(): Parser.Language;
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract Thrift service definition
     * Example: service MyService { ... }
     */
    private extractService;
    /**
     * Extract Thrift struct definition
     * Example: struct User { 1: string name, 2: i32 age }
     */
    private extractStruct;
    /**
     * Extract Thrift enum definition
     * Example: enum Status { OK = 0, ERROR = 1 }
     */
    private extractEnum;
    /**
     * Extract Thrift exception definition
     * Example: exception MyException { 1: string message }
     */
    private extractException;
    /**
     * Extract Thrift typedef
     * Example: typedef map<string, string> StringMap
     */
    private extractTypedef;
    /**
     * Extract Thrift constant
     * Example: const i32 MY_CONSTANT = 42
     */
    private extractConstant;
    /**
     * Extract Thrift function (RPC method in service)
     * Example: string getName(1: i32 userId)
     */
    private extractFunction;
    protected extractCall(node: Parser.SyntaxNode): Call | null;
    protected extractImport(node: Parser.SyntaxNode): Import | null;
    /**
     * Extract struct fields
     */
    private extractStructFields;
    /**
     * Extract enum values
     */
    private extractEnumValues;
    /**
     * Extract function parameters
     */
    private extractFunctionParameters;
}
//# sourceMappingURL=ThriftParserService.d.ts.map