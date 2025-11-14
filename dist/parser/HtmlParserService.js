/**
 * HtmlParserService.ts
 *
 * HTML language parser using Tree-sitter
 * Extracts symbols from HTML source code
 */
// @ts-ignore - tree-sitter-html doesn't have TypeScript types
import HTML from 'tree-sitter-html';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * HtmlParserService - Extracts symbols from HTML code
 */
export class HtmlParserService extends BaseLanguageParser {
    language = 'html';
    extensions = ['.html', '.htm', '.xhtml'];
    constructor() {
        super(HTML);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'element':
                return this.extractElement(node);
            case 'script_element':
                return this.extractScriptElement(node);
            case 'style_element':
                return this.extractStyleElement(node);
            case 'self_closing_tag':
                return this.extractSelfClosingTag(node);
            default:
                return null;
        }
    }
    /**
     * Extract HTML element
     * Example: <div id="app" class="container">...</div>
     * Example: <button type="submit">Submit</button>
     * Example: <img src="logo.png" alt="Logo" />
     */
    extractElement(node) {
        // Get start tag - it's a child, not a field
        const startTags = node.descendantsOfType('start_tag');
        if (startTags.length === 0) {
            return null;
        }
        const startTag = startTags[0];
        // Get tag name - it's a child node
        const tagNameNode = startTag.descendantsOfType('tag_name')[0];
        if (!tagNameNode) {
            return null;
        }
        const tagName = tagNameNode.text;
        // Get id attribute if present (for unique identification)
        const id = this.getAttributeValue(startTag, 'id');
        const className = this.getAttributeValue(startTag, 'class');
        // Create symbol name with id/class for better identification
        let symbolName = tagName;
        if (id) {
            symbolName = `${tagName}#${id}`;
        }
        else if (className) {
            // Use first class name
            const firstClass = className.split(/\s+/)[0];
            symbolName = `${tagName}.${firstClass}`;
        }
        return this.createSymbol(node, symbolName, 'class', {
            tagName,
            id,
            class: className,
        });
    }
    /**
     * Extract script element
     * Example: <script src="app.js"></script>
     * Example: <script>console.log('Hello');</script>
     */
    extractScriptElement(node) {
        // script_element has different structure, find tag within
        const startTagNodes = node.descendantsOfType('start_tag');
        if (startTagNodes.length === 0)
            return null;
        const startTag = startTagNodes[0];
        const src = this.getAttributeValue(startTag, 'src');
        const type = this.getAttributeValue(startTag, 'type');
        const symbolName = src ? `script[src="${src}"]` : 'script[inline]';
        return this.createSymbol(node, symbolName, 'function', {
            src,
            type,
            inline: !src,
        });
    }
    /**
     * Extract style element
     * Example: <style>body { margin: 0; }</style>
     * Example: <link rel="stylesheet" href="styles.css">
     */
    extractStyleElement(node) {
        // style_element has different structure, find tag within
        const startTagNodes = node.descendantsOfType('start_tag');
        if (startTagNodes.length === 0)
            return null;
        const startTag = startTagNodes[0];
        const href = this.getAttributeValue(startTag, 'href');
        const symbolName = href ? `style[href="${href}"]` : 'style[inline]';
        return this.createSymbol(node, symbolName, 'variable', {
            href,
            inline: !href,
        });
    }
    /**
     * Extract self-closing tag
     * Example: <img src="logo.png" alt="Logo" />
     * Example: <input type="text" id="name" />
     */
    extractSelfClosingTag(node) {
        // Get tag name - it's a child node
        const tagNameNode = node.descendantsOfType('tag_name')[0];
        if (!tagNameNode)
            return null;
        const tagName = tagNameNode.text;
        // Get id attribute if present (for unique identification)
        const id = this.getAttributeValue(node, 'id');
        const className = this.getAttributeValue(node, 'class');
        // Create symbol name with id/class for better identification
        let symbolName = tagName;
        if (id) {
            symbolName = `${tagName}#${id}`;
        }
        else if (className) {
            // Use first class name
            const firstClass = className.split(/\s+/)[0];
            symbolName = `${tagName}.${firstClass}`;
        }
        return this.createSymbol(node, symbolName, 'class', {
            tagName,
            id,
            class: className,
            selfClosing: true,
        });
    }
    /**
     * Get attribute value from a tag
     */
    getAttributeValue(tagNode, attributeName) {
        // Find all attribute nodes
        for (let i = 0; i < tagNode.childCount; i++) {
            const child = tagNode.child(i);
            if (child?.type === 'attribute') {
                // The attribute structure is:
                // attribute -> attribute_name + quoted_attribute_value -> attribute_value
                const attrNameNode = child.descendantsOfType('attribute_name')[0];
                if (attrNameNode && attrNameNode.text === attributeName) {
                    // Look for attribute_value (inside quoted_attribute_value)
                    const attrValueNode = child.descendantsOfType('attribute_value')[0];
                    if (attrValueNode) {
                        return attrValueNode.text;
                    }
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=HtmlParserService.js.map