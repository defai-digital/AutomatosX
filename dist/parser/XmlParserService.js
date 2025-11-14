import Xml from '@tree-sitter-grammars/tree-sitter-xml';
import { BaseLanguageParser } from './LanguageParser.js';
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
export class XmlParserService extends BaseLanguageParser {
    language = 'xml';
    extensions = ['.xml', '.pom', '.csproj', '.vbproj', '.fsproj', '.config'];
    getGrammar() {
        return Xml;
    }
    extractSymbol(node) {
        switch (node.type) {
            case 'element':
                return this.extractElement(node);
            default:
                return null;
        }
    }
    /**
     * Extract XML element
     * Prioritizes Maven dependencies and NuGet package references
     */
    extractElement(node) {
        const startTagNode = node.childForFieldName('start_tag');
        if (!startTagNode)
            return null;
        const nameNode = startTagNode.childForFieldName('name');
        if (!nameNode)
            return null;
        const elementName = nameNode.text;
        // Special handling for Maven dependencies
        if (elementName === 'dependency') {
            return this.extractMavenDependency(node);
        }
        // Special handling for NuGet package references
        if (elementName === 'PackageReference') {
            return this.extractNuGetPackageReference(node);
        }
        // Special handling for Maven plugins
        if (elementName === 'plugin') {
            return this.extractMavenPlugin(node);
        }
        // Special handling for root elements
        if (elementName === 'project' || elementName === 'Project') {
            return this.extractRootProject(node);
        }
        // Generic element extraction
        const attributes = this.extractAttributes(startTagNode);
        const textContent = this.extractTextContent(node);
        return {
            name: elementName,
            kind: SymbolKind.Variable,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            signature: `<${elementName}${attributes.length > 0 ? ' ...' : ''}>`,
            metadata: {
                attributes,
                hasContent: textContent.length > 0,
                isXmlElement: true,
            },
        };
    }
    /**
     * Extract Maven dependency element
     * Example: <dependency><groupId>...</groupId><artifactId>...</artifactId><version>...</version></dependency>
     */
    extractMavenDependency(node) {
        const groupId = this.findChildElementText(node, 'groupId');
        const artifactId = this.findChildElementText(node, 'artifactId');
        const version = this.findChildElementText(node, 'version');
        const scope = this.findChildElementText(node, 'scope');
        const name = artifactId || 'unknown';
        const fullName = groupId && artifactId ? `${groupId}:${artifactId}` : name;
        return {
            name: fullName,
            kind: SymbolKind.Constant,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            signature: `dependency: ${fullName}${version ? `@${version}` : ''}`,
            metadata: {
                groupId,
                artifactId,
                version,
                scope,
                isMavenDependency: true,
            },
        };
    }
    /**
     * Extract NuGet PackageReference element
     * Example: <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
     */
    extractNuGetPackageReference(node) {
        const startTagNode = node.childForFieldName('start_tag');
        if (!startTagNode)
            return null;
        const attributes = this.extractAttributesAsMap(startTagNode);
        const packageName = attributes.get('Include') || 'unknown';
        const version = attributes.get('Version');
        return {
            name: packageName,
            kind: SymbolKind.Constant,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            signature: `package: ${packageName}${version ? `@${version}` : ''}`,
            metadata: {
                packageName,
                version,
                isNuGetPackage: true,
            },
        };
    }
    /**
     * Extract Maven plugin element
     * Example: <plugin><groupId>...</groupId><artifactId>...</artifactId><version>...</version></plugin>
     */
    extractMavenPlugin(node) {
        const groupId = this.findChildElementText(node, 'groupId');
        const artifactId = this.findChildElementText(node, 'artifactId');
        const version = this.findChildElementText(node, 'version');
        const name = artifactId || 'unknown';
        const fullName = groupId && artifactId ? `${groupId}:${artifactId}` : name;
        return {
            name: fullName,
            kind: SymbolKind.Function,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            signature: `plugin: ${fullName}${version ? `@${version}` : ''}`,
            metadata: {
                groupId,
                artifactId,
                version,
                isMavenPlugin: true,
            },
        };
    }
    /**
     * Extract root project element
     * Captures basic project metadata
     */
    extractRootProject(node) {
        const startTagNode = node.childForFieldName('start_tag');
        if (!startTagNode)
            return null;
        const attributes = this.extractAttributesAsMap(startTagNode);
        return {
            name: 'project',
            kind: SymbolKind.Module,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            signature: 'project',
            metadata: {
                attributes: Array.from(attributes.entries()).map(([k, v]) => `${k}="${v}"`),
                isRootProject: true,
            },
        };
    }
    /**
     * Find child element by name and return its text content
     */
    findChildElementText(node, elementName) {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'element') {
                const startTag = child.childForFieldName('start_tag');
                if (startTag) {
                    const nameNode = startTag.childForFieldName('name');
                    if (nameNode?.text === elementName) {
                        return this.extractTextContent(child);
                    }
                }
            }
        }
        return undefined;
    }
    /**
     * Extract text content from XML element
     */
    extractTextContent(node) {
        const contentNode = node.childForFieldName('content');
        if (!contentNode)
            return '';
        let text = '';
        for (let i = 0; i < contentNode.childCount; i++) {
            const child = contentNode.child(i);
            if (child?.type === 'text') {
                text += child.text;
            }
        }
        return text.trim();
    }
    /**
     * Extract attributes from start tag
     */
    extractAttributes(startTagNode) {
        const attributes = [];
        for (let i = 0; i < startTagNode.childCount; i++) {
            const child = startTagNode.child(i);
            if (child?.type === 'attribute') {
                const nameNode = child.childForFieldName('name');
                const valueNode = child.childForFieldName('value');
                if (nameNode) {
                    const attrName = nameNode.text;
                    const attrValue = valueNode?.text || '';
                    attributes.push(`${attrName}=${attrValue}`);
                }
            }
        }
        return attributes;
    }
    /**
     * Extract attributes as a Map for easier lookup
     */
    extractAttributesAsMap(startTagNode) {
        const attributes = new Map();
        for (let i = 0; i < startTagNode.childCount; i++) {
            const child = startTagNode.child(i);
            if (child?.type === 'attribute') {
                const nameNode = child.childForFieldName('name');
                const valueNode = child.childForFieldName('value');
                if (nameNode) {
                    const attrName = nameNode.text;
                    // Remove quotes from value
                    const attrValue = valueNode?.text.replace(/^["']|["']$/g, '') || '';
                    attributes.set(attrName, attrValue);
                }
            }
        }
        return attributes;
    }
    extractCall(node) {
        // XML doesn't have function calls
        return null;
    }
    extractImport(node) {
        // XML doesn't have imports in the traditional sense
        // Could potentially extract <import> elements in Spring XML configs
        return null;
    }
}
//# sourceMappingURL=XmlParserService.js.map