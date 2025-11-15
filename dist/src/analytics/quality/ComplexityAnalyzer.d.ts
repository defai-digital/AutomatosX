import Parser from 'tree-sitter';
import { ParserRegistry } from '../../parser/ParserRegistry.js';
import { Language } from '../../types/index.js';
export interface CyclomaticComplexity {
    complexity: number;
    decisionPoints: number;
    paths: number;
}
export interface CognitiveComplexity {
    complexity: number;
    nestingPenalty: number;
    structuralComplexity: number;
}
export interface HalsteadMetrics {
    vocabulary: number;
    length: number;
    calculatedLength: number;
    volume: number;
    difficulty: number;
    effort: number;
    timeToProgram: number;
    bugsDelivered: number;
    uniqueOperators: number;
    uniqueOperands: number;
    totalOperators: number;
    totalOperands: number;
}
export interface ComplexityMetrics {
    cyclomatic: CyclomaticComplexity;
    cognitive: CognitiveComplexity;
    halstead: HalsteadMetrics;
    linesOfCode: number;
    maintainabilityIndex: number;
}
export interface FunctionComplexity extends ComplexityMetrics {
    name: string;
    startLine: number;
    endLine: number;
}
export interface FileComplexity {
    filePath: string;
    language: Language;
    overall: ComplexityMetrics;
    functions: FunctionComplexity[];
    averageComplexity: number;
    maxComplexity: number;
}
export declare class CyclomaticAnalyzer {
    /**
     * Calculate cyclomatic complexity for a code block
     * M = E - N + 2P
     * where E = edges, N = nodes, P = connected components
     *
     * Simplified: M = number of decision points + 1
     */
    static calculate(node: Parser.SyntaxNode): CyclomaticComplexity;
}
export declare class CognitiveAnalyzer {
    /**
     * Calculate cognitive complexity
     * More nuanced than cyclomatic - accounts for nesting depth
     */
    static calculate(node: Parser.SyntaxNode): CognitiveComplexity;
}
export declare class HalsteadAnalyzer {
    /**
     * Calculate Halstead complexity metrics
     */
    static calculate(node: Parser.SyntaxNode): HalsteadMetrics;
}
export declare class ComplexityAnalyzer {
    private parserRegistry;
    constructor(parserRegistry?: ParserRegistry);
    /**
     * Analyze complexity for entire file
     */
    analyzeFile(filePath: string, content: string, language: Language): Promise<FileComplexity>;
    /**
     * Analyze a single AST node
     */
    private analyzeNode;
    /**
     * Extract and analyze individual functions
     */
    private extractFunctions;
    /**
     * Extract function name from AST node
     */
    private extractFunctionName;
    /**
     * Count lines of code
     */
    private countLines;
    /**
     * Calculate Maintainability Index
     * MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
     * Normalized to 0-100 scale
     */
    private calculateMaintainabilityIndex;
    /**
     * Get complexity grade based on cyclomatic complexity
     */
    static getComplexityGrade(complexity: number): string;
    /**
     * Get maintainability grade
     */
    static getMaintainabilityGrade(index: number): string;
}
//# sourceMappingURL=ComplexityAnalyzer.d.ts.map