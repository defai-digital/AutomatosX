import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol, Call, Import } from './LanguageParser.js';
/**
 * Parser for XML (Extensible Markup Language)
 *
 * XML is a markup language used for configuration files, data exchange,
 * and document storage. This parser extracts:
 * - Elements: XML tags and their structure
 * - Attributes: Element attributes and values
 * - Dependencies: For Maven POM.xml and NuGet .csproj files
 *
 * Use cases:
 * - Maven POM.xml dependency management
 * - NuGet .csproj package references
 * - Android manifest files
 * - Configuration files (Spring, Hibernate, etc.)
 * - Data exchange formats
 *
 * File extensions: .xml, .pom, .csproj, .vbproj, .fsproj, .config
 */
export declare class XmlParserService extends BaseLanguageParser {
    readonly language = "xml";
    readonly extensions: string[];
    protected getGrammar(): Parser.Language;
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract XML element
     * Prioritizes Maven dependencies and NuGet package references
     */
    private extractElement;
    /**
     * Extract Maven dependency element
     * Example: <dependency><groupId>...</groupId><artifactId>...</artifactId><version>...</version></dependency>
     */
    private extractMavenDependency;
    /**
     * Extract NuGet PackageReference element
     * Example: <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
     */
    private extractNuGetPackageReference;
    /**
     * Extract Maven plugin element
     * Example: <plugin><groupId>...</groupId><artifactId>...</artifactId><version>...</version></plugin>
     */
    private extractMavenPlugin;
    /**
     * Extract root project element
     * Captures basic project metadata
     */
    private extractRootProject;
    /**
     * Find child element by name and return its text content
     */
    private findChildElementText;
    /**
     * Extract text content from XML element
     */
    private extractTextContent;
    /**
     * Extract attributes from start tag
     */
    private extractAttributes;
    /**
     * Extract attributes as a Map for easier lookup
     */
    private extractAttributesAsMap;
    protected extractCall(node: Parser.SyntaxNode): Call | null;
    protected extractImport(node: Parser.SyntaxNode): Import | null;
}
//# sourceMappingURL=XmlParserService.d.ts.map