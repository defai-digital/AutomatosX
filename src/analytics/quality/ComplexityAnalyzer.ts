// ComplexityAnalyzer.ts - Code complexity metrics calculation
// Day 67: Code Quality Analyzer Implementation
// Calculates cyclomatic, cognitive, and Halstead complexity metrics

import Parser from 'tree-sitter';
import { ParserRegistry } from '../../parser/ParserRegistry.js';
import { Language } from '../../types/index.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  vocabulary: number;          // n = n1 + n2
  length: number;              // N = N1 + N2
  calculatedLength: number;    // N^ = n1*log2(n1) + n2*log2(n2)
  volume: number;              // V = N * log2(n)
  difficulty: number;          // D = (n1/2) * (N2/n2)
  effort: number;              // E = D * V
  timeToProgram: number;       // T = E / 18 (seconds)
  bugsDelivered: number;       // B = V / 3000

  // Detailed metrics
  uniqueOperators: number;     // n1
  uniqueOperands: number;      // n2
  totalOperators: number;      // N1
  totalOperands: number;       // N2
}

export interface ComplexityMetrics {
  cyclomatic: CyclomaticComplexity;
  cognitive: CognitiveComplexity;
  halstead: HalsteadMetrics;
  linesOfCode: number;
  maintainabilityIndex: number;
  // Optional properties for FunctionComplexity compatibility
  name?: string;
  startLine?: number;
  endLine?: number;
  parameters?: number;
}

export interface FunctionComplexity extends ComplexityMetrics {
  name: string;
  startLine: number;
  endLine: number;
  parameters?: number;  // Number of function parameters
}

export interface FileComplexity {
  filePath: string;
  language: Language;
  overall: ComplexityMetrics;
  functions: FunctionComplexity[];
  averageComplexity: number;
  maxComplexity: number;
}

// ============================================================================
// CYCLOMATIC COMPLEXITY ANALYZER
// ============================================================================

export class CyclomaticAnalyzer {
  /**
   * Calculate cyclomatic complexity for a code block
   * M = E - N + 2P
   * where E = edges, N = nodes, P = connected components
   *
   * Simplified: M = number of decision points + 1
   */
  static calculate(node: Parser.SyntaxNode): CyclomaticComplexity {
    let decisionPoints = 0;

    const decisionNodeTypes = [
      'if_statement',
      'while_statement',
      'for_statement',
      'do_statement',
      'switch_statement',
      'case_statement',
      'catch_clause',
      'conditional_expression',  // ternary
      'logical_operator',        // && ||
      'binary_expression',       // for logical operators
    ];

    const traverse = (n: Parser.SyntaxNode) => {
      if (decisionNodeTypes.includes(n.type)) {
        // Special handling for logical operators
        if (n.type === 'binary_expression') {
          const operator = n.childForFieldName('operator')?.text;
          if (operator === '&&' || operator === '||') {
            decisionPoints++;
          }
        } else {
          decisionPoints++;
        }
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);

    const complexity = decisionPoints + 1;

    // Fixed: Guard against integer overflow for large decision point counts
    // Math.pow(2, n) exceeds MAX_SAFE_INTEGER when n >= 53
    // Cap at 50 decision points to prevent overflow (2^50 = ~1.126e15, still safe)
    const safePaths = decisionPoints <= 50
      ? Math.pow(2, decisionPoints)
      : Number.MAX_SAFE_INTEGER;

    return {
      complexity,
      decisionPoints,
      paths: safePaths,
    };
  }
}

// ============================================================================
// COGNITIVE COMPLEXITY ANALYZER
// ============================================================================

export class CognitiveAnalyzer {
  /**
   * Calculate cognitive complexity
   * More nuanced than cyclomatic - accounts for nesting depth
   */
  static calculate(node: Parser.SyntaxNode): CognitiveComplexity {
    let structuralComplexity = 0;
    let nestingPenalty = 0;

    const incrementingNodeTypes = [
      'if_statement',
      'else_clause',
      'switch_statement',
      'for_statement',
      'while_statement',
      'do_statement',
      'catch_clause',
      'conditional_expression',
    ];

    const nestingNodeTypes = [
      'if_statement',
      'for_statement',
      'while_statement',
      'do_statement',
      'function_declaration',
      'method_definition',
      'arrow_function',
    ];

    const traverse = (n: Parser.SyntaxNode, nestingLevel: number) => {
      // Increment for control flow structures
      if (incrementingNodeTypes.includes(n.type)) {
        structuralComplexity++;
        nestingPenalty += nestingLevel;
      }

      // Handle logical operators with nesting
      if (n.type === 'binary_expression') {
        const operator = n.childForFieldName('operator')?.text;
        if (operator === '&&' || operator === '||') {
          structuralComplexity++;
          nestingPenalty += nestingLevel;
        }
      }

      // Recurse with increased nesting for nested structures
      const newNestingLevel = nestingNodeTypes.includes(n.type) ? nestingLevel + 1 : nestingLevel;
      for (const child of n.children) {
        traverse(child, newNestingLevel);
      }
    };

    traverse(node, 0);

    return {
      complexity: structuralComplexity + nestingPenalty,
      nestingPenalty,
      structuralComplexity,
    };
  }
}

// ============================================================================
// HALSTEAD METRICS ANALYZER
// ============================================================================

export class HalsteadAnalyzer {
  /**
   * Calculate Halstead complexity metrics
   */
  static calculate(node: Parser.SyntaxNode): HalsteadMetrics {
    const operators = new Set<string>();
    const operands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    const operatorNodeTypes = [
      'binary_expression',
      'unary_expression',
      'assignment_expression',
      'augmented_assignment_expression',
      'update_expression',
      'logical_operator',
      'comparison_operator',
      'arithmetic_operator',
    ];

    const operandNodeTypes = [
      'identifier',
      'number',
      'string',
      'true',
      'false',
      'null',
      'undefined',
    ];

    const traverse = (n: Parser.SyntaxNode) => {
      // Collect operators
      if (operatorNodeTypes.includes(n.type)) {
        const operator = n.childForFieldName('operator')?.text || n.text;
        if (operator) {
          operators.add(operator);
          totalOperators++;
        }
      }

      // Collect operands
      if (operandNodeTypes.includes(n.type)) {
        const operand = n.text;
        if (operand) {
          operands.add(operand);
          totalOperands++;
        }
      }

      for (const child of n.children) {
        traverse(child);
      }
    };

    traverse(node);

    const n1 = operators.size;           // unique operators
    const n2 = operands.size;            // unique operands
    const N1 = totalOperators;           // total operators
    const N2 = totalOperands;            // total operands

    const n = n1 + n2;                   // vocabulary
    const N = N1 + N2;                   // length

    // Calculated program length
    const calculatedLength = n1 > 0 && n2 > 0
      ? n1 * Math.log2(n1) + n2 * Math.log2(n2)
      : 0;

    // Volume
    const volume = N > 0 && n > 0 ? N * Math.log2(n) : 0;

    // Difficulty
    const difficulty = n1 > 0 && n2 > 0 && N2 > 0
      ? (n1 / 2) * (N2 / n2)
      : 0;

    // Effort
    const effort = difficulty * volume;

    // Time to program (seconds)
    const timeToProgram = effort / 18;

    // Delivered bugs
    const bugsDelivered = volume / 3000;

    return {
      vocabulary: n,
      length: N,
      calculatedLength,
      volume,
      difficulty,
      effort,
      timeToProgram,
      bugsDelivered,
      uniqueOperators: n1,
      uniqueOperands: n2,
      totalOperators: N1,
      totalOperands: N2,
    };
  }
}

// ============================================================================
// COMPLEXITY ANALYZER ORCHESTRATOR
// ============================================================================

export class ComplexityAnalyzer {
  private parserRegistry: ParserRegistry;

  constructor(parserRegistry?: ParserRegistry) {
    this.parserRegistry = parserRegistry || new ParserRegistry();
  }

  /**
   * Analyze complexity for entire file
   */
  async analyzeFile(filePath: string, content: string, language: Language): Promise<FileComplexity> {
    const parser = this.parserRegistry.getParser(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    // Get the raw tree-sitter parser and parse content
    const treeSitterParser = parser.getParser();
    const tree = treeSitterParser.parse(content);
    const rootNode = tree.rootNode;

    // Calculate overall file complexity
    const overall = this.analyzeNode(rootNode, content);

    // Extract and analyze functions
    const functions = await this.extractFunctions(rootNode, content, parser, language);

    // Calculate statistics
    const functionComplexities = functions.map(f => f.cyclomatic.complexity);
    const averageComplexity = functionComplexities.length > 0
      ? functionComplexities.reduce((sum, c) => sum + c, 0) / functionComplexities.length
      : 0;
    const maxComplexity = functionComplexities.length > 0
      ? Math.max(...functionComplexities)
      : 0;

    return {
      filePath,
      language,
      overall,
      functions,
      averageComplexity,
      maxComplexity,
    };
  }

  /**
   * Analyze a single AST node
   */
  private analyzeNode(node: Parser.SyntaxNode, content: string): ComplexityMetrics {
    const cyclomatic = CyclomaticAnalyzer.calculate(node);
    const cognitive = CognitiveAnalyzer.calculate(node);
    const halstead = HalsteadAnalyzer.calculate(node);

    const linesOfCode = this.countLines(node, content);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      halstead.volume,
      cyclomatic.complexity,
      linesOfCode
    );

    return {
      cyclomatic,
      cognitive,
      halstead,
      linesOfCode,
      maintainabilityIndex,
    };
  }

  /**
   * Extract and analyze individual functions
   */
  private async extractFunctions(
    rootNode: Parser.SyntaxNode,
    content: string,
    parser: any,
    language: Language
  ): Promise<FunctionComplexity[]> {
    const functions: FunctionComplexity[] = [];

    const functionNodeTypes = [
      'function_declaration',
      'method_definition',
      'arrow_function',
      'function_expression',
    ];

    const traverse = (node: Parser.SyntaxNode) => {
      if (functionNodeTypes.includes(node.type)) {
        const name = this.extractFunctionName(node);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;

        const metrics = this.analyzeNode(node, content);

        functions.push({
          name,
          startLine,
          endLine,
          ...metrics,
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(rootNode);
    return functions;
  }

  /**
   * Extract function name from AST node
   */
  private extractFunctionName(node: Parser.SyntaxNode): string {
    // Try to get name from different node types
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return nameNode.text;
    }

    // For arrow functions assigned to variables
    const parent = node.parent;
    if (parent?.type === 'variable_declarator') {
      const varName = parent.childForFieldName('name');
      if (varName) {
        return varName.text;
      }
    }

    // Default to anonymous
    return '<anonymous>';
  }

  /**
   * Count lines of code
   */
  private countLines(node: Parser.SyntaxNode, content: string): number {
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    return endLine - startLine + 1;
  }

  /**
   * Calculate Maintainability Index
   * MI = 171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)
   * Normalized to 0-100 scale
   */
  private calculateMaintainabilityIndex(
    volume: number,
    cyclomaticComplexity: number,
    linesOfCode: number
  ): number {
    if (volume === 0 || linesOfCode === 0) {
      return 100;
    }

    const rawMI = Math.max(0,
      171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)
    );

    // Normalize to 0-100 scale
    const normalizedMI = (rawMI / 171) * 100;
    return Math.min(100, Math.max(0, normalizedMI));
  }

  /**
   * Get complexity grade based on cyclomatic complexity
   */
  static getComplexityGrade(complexity: number): string {
    if (complexity <= 5) return 'A'; // Low risk
    if (complexity <= 10) return 'B'; // Moderate risk
    if (complexity <= 20) return 'C'; // High risk
    if (complexity <= 30) return 'D'; // Very high risk
    return 'F'; // Unmaintainable
  }

  /**
   * Get maintainability grade
   */
  static getMaintainabilityGrade(index: number): string {
    if (index >= 80) return 'A'; // Highly maintainable
    if (index >= 60) return 'B'; // Maintainable
    if (index >= 40) return 'C'; // Moderate
    if (index >= 20) return 'D'; // Low maintainability
    return 'F'; // Very low maintainability
  }
}
