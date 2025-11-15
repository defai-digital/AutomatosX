/**
 * Type declarations for web-tree-sitter
 * Since @types/web-tree-sitter doesn't exist, we define minimal types here
 */

declare module 'web-tree-sitter' {
  export interface Point {
    row: number;
    column: number;
  }

  export interface Range {
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
  }

  export interface SyntaxNode {
    type: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    text: string;
    parent: SyntaxNode | null;
    children: SyntaxNode[];
    namedChildren: SyntaxNode[];
    childCount: number;
    namedChildCount: number;
    firstChild: SyntaxNode | null;
    firstNamedChild: SyntaxNode | null;
    lastChild: SyntaxNode | null;
    lastNamedChild: SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    nextNamedSibling: SyntaxNode | null;
    previousSibling: SyntaxNode | null;
    previousNamedSibling: SyntaxNode | null;
    hasChanges: boolean;
    hasError: boolean;
    isError: boolean;
    isMissing: boolean;
    isNamed: boolean;

    walk(): TreeCursor;
    descendantsOfType(type: string | string[], startPosition?: Point, endPosition?: Point): SyntaxNode[];
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    childForFieldName(fieldName: string): SyntaxNode | null;
    descendantForIndex(index: number): SyntaxNode;
    descendantForPosition(position: Point): SyntaxNode;
    namedDescendantForIndex(index: number): SyntaxNode;
    namedDescendantForPosition(position: Point): SyntaxNode;
  }

  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    nodeIsNamed: boolean;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    currentNode: SyntaxNode;

    reset(node: SyntaxNode): void;
    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoFirstChildForIndex(index: number): boolean;
    gotoNextSibling(): boolean;
  }

  export interface Edit {
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: Point;
    oldEndPosition: Point;
    newEndPosition: Point;
  }

  export interface Tree {
    rootNode: SyntaxNode;
    edit(edit: Edit): void;
    walk(): TreeCursor;
    getChangedRanges(other: Tree): Range[];
    getEditedRange(edit: Edit): Range;
    printDotGraph(): string;
    copy(): Tree;
    delete(): void;
  }

  export interface Language {
    // Language object returned by Parser.Language.load()
  }

  export class Parser {
    static Language: {
      load(path: string): Promise<Language>;
    };

    delete(): void;
    parse(input: string | ((index: number, position?: Point) => string), oldTree?: Tree): Tree;
    getLanguage(): Language;
    setLanguage(language: Language): void;
    getTimeoutMicros(): number;
    setTimeoutMicros(timeout: number): void;
    reset(): void;
  }

  export default Parser;
}
