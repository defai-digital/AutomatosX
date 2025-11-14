/**
 * HclParserService.ts
 *
 * HCL (HashiCorp Configuration Language) parser using Tree-sitter
 * Extracts symbols from Terraform, Vault, Waypoint, and Nomad configurations
 */
import Hcl from '@tree-sitter-grammars/tree-sitter-hcl';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * HclParserService - Extracts symbols from HCL/Terraform code
 */
export class HclParserService extends BaseLanguageParser {
    language = 'hcl';
    extensions = ['.tf', '.hcl', '.nomad'];
    constructor() {
        super(Hcl);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'block':
                return this.extractBlock(node);
            case 'attribute':
                return this.extractAttribute(node);
            case 'variable_declaration':
                return this.extractVariable(node);
            case 'output_declaration':
                return this.extractOutput(node);
            case 'resource_declaration':
                return this.extractResource(node);
            case 'data_declaration':
                return this.extractData(node);
            case 'module_declaration':
                return this.extractModule(node);
            case 'locals_declaration':
                return this.extractLocals(node);
            default:
                return null;
        }
    }
    /**
     * Extract generic block (terraform, provider, etc.)
     */
    extractBlock(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        const blockType = identifiers[0].text;
        const name = identifiers.length > 1 ? identifiers[1].text : blockType;
        // Determine symbol kind based on block type
        let kind = 'module';
        if (blockType === 'resource')
            kind = 'class';
        else if (blockType === 'data')
            kind = 'constant';
        else if (blockType === 'module')
            kind = 'module';
        else if (blockType === 'provider')
            kind = 'module';
        return this.createSymbol(node, name, kind);
    }
    /**
     * Extract attribute/variable assignment
     */
    extractAttribute(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        return this.createSymbol(node, identifiers[0].text, 'variable');
    }
    /**
     * Extract variable declaration
     */
    extractVariable(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        return this.createSymbol(node, identifiers[0].text, 'variable');
    }
    /**
     * Extract output declaration
     */
    extractOutput(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        return this.createSymbol(node, identifiers[0].text, 'constant');
    }
    /**
     * Extract resource declaration
     */
    extractResource(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length < 2)
            return null;
        // resource "aws_instance" "web" { ... }
        // identifiers[0] = resource type, identifiers[1] = resource name
        const resourceType = identifiers[0].text;
        const resourceName = identifiers[1].text;
        return this.createSymbol(node, `${resourceType}.${resourceName}`, 'class');
    }
    /**
     * Extract data source declaration
     */
    extractData(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length < 2)
            return null;
        const dataType = identifiers[0].text;
        const dataName = identifiers[1].text;
        return this.createSymbol(node, `${dataType}.${dataName}`, 'constant');
    }
    /**
     * Extract module declaration
     */
    extractModule(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        return this.createSymbol(node, identifiers[0].text, 'module');
    }
    /**
     * Extract locals block
     */
    extractLocals(node) {
        const identifiers = node.descendantsOfType('identifier');
        if (identifiers.length === 0)
            return null;
        return this.createSymbol(node, 'locals', 'constant');
    }
}
//# sourceMappingURL=HclParserService.js.map