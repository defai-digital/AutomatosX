import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol, Call, Import } from './LanguageParser.js';
/**
 * Parser for Puppet configuration management language
 *
 * Puppet is a configuration management tool that uses a declarative DSL
 * to describe system configuration. This parser extracts:
 * - Classes: Puppet classes for grouping resources
 * - Defined types: Custom resource types
 * - Resources: Individual configuration items
 * - Variables: Variable declarations
 * - Functions: Puppet functions
 * - Modules: Module imports
 *
 * Use cases:
 * - DevOps infrastructure as code
 * - Configuration management
 * - Server provisioning
 * - Continuous deployment
 *
 * File extensions: .pp
 */
export declare class PuppetParserService extends BaseLanguageParser {
    readonly language = "puppet";
    readonly extensions: string[];
    constructor();
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract Puppet class definition
     * Example: class myclass { ... }
     */
    private extractClass;
    /**
     * Extract Puppet defined type (custom resource type)
     * Example: define mytype { ... }
     */
    private extractDefinedType;
    /**
     * Extract Puppet resource declaration
     * Example: file { '/path': ensure => present }
     */
    private extractResource;
    /**
     * Extract Puppet variable assignment
     * Example: $myvar = 'value'
     */
    private extractVariable;
    /**
     * Extract Puppet function definition
     * Example: function myfunc() { ... }
     */
    private extractFunction;
    protected extractCall(node: Parser.SyntaxNode): Call | null;
    protected extractImport(node: Parser.SyntaxNode): Import | null;
    /**
     * Extract parameters from parameter list node
     */
    private extractParameters;
    /**
     * Extract function call arguments
     */
    private extractCallArguments;
    /**
     * Check if class has inherits clause
     */
    private hasInherits;
}
//# sourceMappingURL=PuppetParserService.d.ts.map