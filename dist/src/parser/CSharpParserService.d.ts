/**
 * CSharpParserService.ts
 *
 * C# language parser using Tree-sitter
 * Extracts symbols from C# source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * CSharpParserService - Extracts symbols from C# code
 */
export declare class CSharpParserService extends BaseLanguageParser {
    readonly language = "csharp";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract class declaration
     * Example: public class Calculator { }
     * Example: public class Calculator<T> where T : struct { }
     */
    private extractClass;
    /**
     * Extract interface declaration
     * Example: public interface ICalculator { }
     * Example: public interface IRepository<T> { }
     */
    private extractInterface;
    /**
     * Extract struct declaration
     * Example: public struct Point { }
     * Example: public readonly struct Vector3 { }
     */
    private extractStruct;
    /**
     * Extract enum declaration
     * Example: public enum Status { Active, Inactive }
     * Example: public enum HttpStatusCode : int { }
     */
    private extractEnum;
    /**
     * Extract method or constructor declaration
     * Example: public void Calculate(int x, int y) { }
     * Example: public Calculator() { }
     */
    private extractMethod;
    /**
     * Extract property declaration
     * Example: public int Count { get; set; }
     * Example: public string Name { get; private set; }
     */
    private extractProperty;
    /**
     * Extract field declaration
     * Example: private int _count;
     * Example: public const int MaxSize = 100;
     */
    private extractField;
    /**
     * Extract delegate declaration
     * Example: public delegate void EventHandler(object sender, EventArgs e);
     */
    private extractDelegate;
    /**
     * Extract event declaration
     * Example: public event EventHandler Click;
     * Example: public event EventHandler<T> DataReceived { add; remove; }
     */
    private extractEvent;
    /**
     * Get modifiers from a node (public, private, static, const, etc.)
     */
    private getModifiers;
}
//# sourceMappingURL=CSharpParserService.d.ts.map