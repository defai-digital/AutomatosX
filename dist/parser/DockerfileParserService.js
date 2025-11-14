/**
 * DockerfileParserService.ts
 *
 * Dockerfile language parser using Tree-sitter
 * Extracts structure from Dockerfiles
 */
import Dockerfile from 'tree-sitter-dockerfile';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * DockerfileParserService - Extracts structure from Dockerfiles
 */
export class DockerfileParserService extends BaseLanguageParser {
    language = 'dockerfile';
    extensions = ['Dockerfile', '.dockerfile', 'Containerfile'];
    constructor() {
        super(Dockerfile);
    }
    /**
     * Extract symbol from AST node
     * For Dockerfiles, we extract FROM, ARG, ENV as symbols
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'from_instruction':
                return this.extractFrom(node);
            case 'arg_instruction':
                return this.extractArg(node);
            case 'env_instruction':
                return this.extractEnv(node);
            case 'label_instruction':
                return this.extractLabel(node);
            default:
                return null;
        }
    }
    /**
     * Extract FROM instruction
     */
    extractFrom(node) {
        const image = node.descendantsOfType('image_spec')[0] ||
            node.descendantsOfType('image_name')[0];
        if (!image)
            return null;
        return this.createSymbol(node, `FROM ${image.text}`, 'module');
    }
    /**
     * Extract ARG instruction
     */
    extractArg(node) {
        const name = node.descendantsOfType('arg_name')[0] ||
            node.descendantsOfType('variable')[0];
        if (!name)
            return null;
        return this.createSymbol(node, name.text, 'variable');
    }
    /**
     * Extract ENV instruction
     */
    extractEnv(node) {
        const name = node.descendantsOfType('env_key')[0] ||
            node.descendantsOfType('variable')[0];
        if (!name)
            return null;
        return this.createSymbol(node, name.text, 'constant');
    }
    /**
     * Extract LABEL instruction
     */
    extractLabel(node) {
        const pairs = node.descendantsOfType('label_pair');
        if (pairs.length === 0)
            return null;
        const keys = pairs.map(p => {
            const key = p.descendantsOfType('label_key')[0];
            return key ? key.text : null;
        }).filter(Boolean);
        if (keys.length === 0)
            return null;
        return this.createSymbol(node, keys.join(', '), 'constant');
    }
}
//# sourceMappingURL=DockerfileParserService.js.map