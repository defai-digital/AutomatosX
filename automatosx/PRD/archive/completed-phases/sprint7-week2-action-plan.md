# Sprint 7 Week 2: Advanced Analytics Action Plan

**Sprint**: Sprint 7 (Days 61-70)
**Week**: Week 14 (Days 66-70)
**Focus**: Advanced Analytics Implementation
**Created**: 2025-11-08

---

## Overview

This action plan provides day-by-day implementation guidance for Sprint 7 Week 2 (Advanced Analytics). Each day delivers a complete, tested analytics component building toward a comprehensive code intelligence platform.

**Goal**: Transform raw code data into actionable insights with terminal-based dashboards and a powerful query engine.

---

## Pre-Week 2 Setup

### Environment Check

Before starting Day 66, verify:

```bash
# Check Week 1 completion
ls packages/rescript-core/src/state/StateMachine.res
ls packages/rescript-core/src/planning/TaskPlanner.res
ls packages/rescript-core/src/workflow/Orchestrator.res
ls packages/rescript-core/src/events/EventBus.res
ls packages/rescript-core/src/bridge/Bridge.res

# Verify tests
npm test -- src/__tests__/rescript/ 2>&1 | grep "200 passed"  # Week 1 tests

# Check database
sqlite3 .automatosx/db/code-intelligence.db ".tables"  # Should have files, symbols, chunks, etc.
```

### Install Dependencies

```bash
# Terminal UI libraries
npm install --save ink@^4.0.0 chalk@^5.6.0 cli-table3@^0.6.5 asciichart@^1.5.0

# Data visualization
npm install --save d3@^7.8.0  # For graph algorithms

# Query parsing
npm install --save sql-parser@^1.0.0  # Or build custom parser

# Dev dependencies
npm install --save-dev @types/cli-table3 @types/d3
```

### Create Directory Structure

```bash
mkdir -p src/analytics/{quality,dependencies,debt,dashboards,query}
mkdir -p src/analytics/__tests__/{quality,dependencies,debt,dashboards,query}
mkdir -p src/migrations  # For new DB tables
```

---

## Day 66: Code Quality Analyzer

### Morning (4 hours): Core Implementation

**1. Create Complexity Analyzer** (90 min)

`src/analytics/quality/ComplexityAnalyzer.ts`:

```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  halstead: HalsteadMetrics;
  nesting: number;
}

export interface HalsteadMetrics {
  vocabulary: number;
  length: number;
  volume: number;
  difficulty: number;
  effort: number;
}

export class ComplexityAnalyzer {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }

  public analyze(source: string): ComplexityMetrics {
    const tree = this.parser.parse(source);

    return {
      cyclomatic: this.calculateCyclomatic(tree.rootNode),
      cognitive: this.calculateCognitive(tree.rootNode),
      halstead: this.calculateHalstead(tree.rootNode),
      nesting: this.calculateMaxNesting(tree.rootNode),
    };
  }

  private calculateCyclomatic(node: Parser.SyntaxNode): number {
    let complexity = 1; // Start with 1 for the function itself

    const visit = (n: Parser.SyntaxNode) => {
      // Add 1 for each decision point
      if (
        n.type === 'if_statement' ||
        n.type === 'while_statement' ||
        n.type === 'for_statement' ||
        n.type === 'case_clause' ||
        n.type === 'catch_clause' ||
        n.type === 'conditional_expression' ||
        n.type === 'binary_expression' && (n.text.includes('&&') || n.text.includes('||'))
      ) {
        complexity++;
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
    return complexity;
  }

  private calculateCognitive(node: Parser.SyntaxNode): number {
    let cognitive = 0;
    let nestingLevel = 0;

    const visit = (n: Parser.SyntaxNode, level: number) => {
      // Increment cognitive complexity based on nesting
      if (n.type === 'if_statement') {
        cognitive += (1 + level);
        level++;
      } else if (n.type === 'while_statement' || n.type === 'for_statement') {
        cognitive += (1 + level);
        level++;
      } else if (n.type === 'binary_expression' && (n.text.includes('&&') || n.text.includes('||'))) {
        cognitive++;
      }

      for (const child of n.children) {
        visit(child, level);
      }
    };

    visit(node, 0);
    return cognitive;
  }

  private calculateHalstead(node: Parser.SyntaxNode): HalsteadMetrics {
    const operators = new Set<string>();
    const operands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    // Traverse AST and collect operators/operands
    const visit = (n: Parser.SyntaxNode) => {
      if (this.isOperator(n)) {
        operators.add(n.text);
        totalOperators++;
      } else if (this.isOperand(n)) {
        operands.add(n.text);
        totalOperands++;
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);

    const n1 = operators.size;  // Unique operators
    const n2 = operands.size;   // Unique operands
    const N1 = totalOperators;  // Total operators
    const N2 = totalOperands;   // Total operands

    const n = n1 + n2;          // Vocabulary
    const N = N1 + N2;          // Length
    const V = N * Math.log2(n || 1);  // Volume
    const D = (n1 / 2) * (N2 / (n2 || 1));  // Difficulty
    const E = D * V;            // Effort

    return { vocabulary: n, length: N, volume: V, difficulty: D, effort: E };
  }

  private calculateMaxNesting(node: Parser.SyntaxNode): number {
    let maxNesting = 0;

    const visit = (n: Parser.SyntaxNode, currentNesting: number) => {
      let nesting = currentNesting;

      if (
        n.type === 'if_statement' ||
        n.type === 'while_statement' ||
        n.type === 'for_statement' ||
        n.type === 'try_statement'
      ) {
        nesting++;
        maxNesting = Math.max(maxNesting, nesting);
      }

      for (const child of n.children) {
        visit(child, nesting);
      }
    };

    visit(node, 0);
    return maxNesting;
  }

  private isOperator(node: Parser.SyntaxNode): boolean {
    const operatorTypes = [
      'binary_expression', 'unary_expression', 'assignment_expression',
      'augmented_assignment_expression', '+', '-', '*', '/', '%', '=', '==', '!=',
    ];
    return operatorTypes.includes(node.type);
  }

  private isOperand(node: Parser.SyntaxNode): boolean {
    const operandTypes = [
      'identifier', 'number', 'string', 'true', 'false', 'null',
    ];
    return operandTypes.includes(node.type);
  }
}
```

**2. Create Maintainability Calculator** (90 min)

`src/analytics/quality/MaintainabilityCalculator.ts`:

```typescript
import { ComplexityAnalyzer, ComplexityMetrics } from './ComplexityAnalyzer.js';

export interface MaintainabilityScore {
  index: number;        // 0-100
  rating: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: MaintainabilityIssue[];
}

export interface MaintainabilityIssue {
  type: 'complexity' | 'length' | 'duplication' | 'coupling';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: { line: number; column: number };
  suggestion: string;
}

export class MaintainabilityCalculator {
  private complexityAnalyzer: ComplexityAnalyzer;

  constructor() {
    this.complexityAnalyzer = new ComplexityAnalyzer();
  }

  public calculate(source: string, filePath: string): MaintainabilityScore {
    const complexity = this.complexityAnalyzer.analyze(source);
    const lines = source.split('\n').length;
    const commentRatio = this.calculateCommentRatio(source);

    // Microsoft maintainability index formula (adapted)
    const halsteadVolume = complexity.halstead.volume;
    const cyclomaticComplexity = complexity.cyclomatic;
    const linesOfCode = lines;

    const maintainabilityIndex = Math.max(
      0,
      (171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)) *
        100 /
        171
    );

    const rating = this.getRating(maintainabilityIndex);
    const issues = this.detectIssues(complexity, lines, filePath);

    return {
      index: Math.round(maintainabilityIndex),
      rating,
      issues,
    };
  }

  private calculateCommentRatio(source: string): number {
    const commentLines = source.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    }).length;

    const totalLines = source.split('\n').length;
    return totalLines > 0 ? commentLines / totalLines : 0;
  }

  private getRating(index: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (index >= 80) return 'A';
    if (index >= 60) return 'B';
    if (index >= 40) return 'C';
    if (index >= 20) return 'D';
    return 'F';
  }

  private detectIssues(
    complexity: ComplexityMetrics,
    lines: number,
    filePath: string
  ): MaintainabilityIssue[] {
    const issues: MaintainabilityIssue[] = [];

    // High cyclomatic complexity
    if (complexity.cyclomatic > 10) {
      issues.push({
        type: 'complexity',
        severity: complexity.cyclomatic > 20 ? 'critical' : 'high',
        location: { line: 1, column: 1 },
        suggestion: `Reduce cyclomatic complexity from ${complexity.cyclomatic} to ≤10 by extracting methods`,
      });
    }

    // Long file
    if (lines > 500) {
      issues.push({
        type: 'length',
        severity: lines > 1000 ? 'high' : 'medium',
        location: { line: 1, column: 1 },
        suggestion: `File is ${lines} lines. Consider splitting into multiple files.`,
      });
    }

    // High nesting
    if (complexity.nesting > 4) {
      issues.push({
        type: 'complexity',
        severity: 'medium',
        location: { line: 1, column: 1 },
        suggestion: `Max nesting level is ${complexity.nesting}. Flatten control flow.`,
      });
    }

    return issues;
  }
}
```

**3. Create Quality Service** (60 min)

`src/analytics/quality/QualityService.ts`:

```typescript
import { ComplexityAnalyzer } from './ComplexityAnalyzer.js';
import { MaintainabilityCalculator } from './MaintainabilityCalculator.js';
import { readFileSync } from 'fs';

export interface QualityReport {
  file: string;
  complexity: import('./ComplexityAnalyzer.js').ComplexityMetrics;
  maintainability: import('./MaintainabilityCalculator.js').MaintainabilityScore;
  linesOfCode: number;
  timestamp: Date;
}

export class QualityService {
  private complexityAnalyzer: ComplexityAnalyzer;
  private maintainabilityCalculator: MaintainabilityCalculator;

  constructor() {
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.maintainabilityCalculator = new MaintainabilityCalculator();
  }

  public async analyzeFile(filePath: string): Promise<QualityReport> {
    const source = readFileSync(filePath, 'utf-8');
    const complexity = this.complexityAnalyzer.analyze(source);
    const maintainability = this.maintainabilityCalculator.calculate(source, filePath);

    return {
      file: filePath,
      complexity,
      maintainability,
      linesOfCode: source.split('\n').length,
      timestamp: new Date(),
    };
  }

  public async analyzeDirectory(dirPath: string): Promise<QualityReport[]> {
    // Recursively analyze all files in directory
    // Return aggregated quality reports
    return [];
  }
}
```

### Afternoon (4 hours): Testing + Migration

**4. Write Tests** (120 min)

`src/analytics/__tests__/quality/ComplexityAnalyzer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ComplexityAnalyzer } from '../../quality/ComplexityAnalyzer.js';

describe('ComplexityAnalyzer', () => {
  const analyzer = new ComplexityAnalyzer();

  describe('Cyclomatic Complexity', () => {
    it('should calculate complexity 1 for simple function', () => {
      const source = `function add(a, b) { return a + b; }`;
      const result = analyzer.analyze(source);
      expect(result.cyclomatic).toBe(1);
    });

    it('should calculate complexity 2 for function with if', () => {
      const source = `
        function max(a, b) {
          if (a > b) return a;
          return b;
        }
      `;
      const result = analyzer.analyze(source);
      expect(result.cyclomatic).toBe(2);
    });

    it('should calculate complexity 4 for nested conditions', () => {
      const source = `
        function classify(x, y) {
          if (x > 0) {
            if (y > 0) return 'Q1';
            return 'Q4';
          }
          if (y > 0) return 'Q2';
          return 'Q3';
        }
      `;
      const result = analyzer.analyze(source);
      expect(result.cyclomatic).toBe(4);
    });

    // Add 9 more tests for cyclomatic complexity
  });

  describe('Cognitive Complexity', () => {
    it('should calculate cognitive complexity for nested if', () => {
      const source = `
        function process(data) {
          if (data) {               // +1
            if (data.valid) {      // +2 (nested)
              return data.value;
            }
          }
        }
      `;
      const result = analyzer.analyze(source);
      expect(result.cognitive).toBeGreaterThan(result.cyclomatic);
    });

    // Add 9 more tests for cognitive complexity
  });

  describe('Halstead Metrics', () => {
    it('should calculate Halstead metrics', () => {
      const source = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
      `;
      const result = analyzer.analyze(source);
      expect(result.halstead.vocabulary).toBeGreaterThan(0);
      expect(result.halstead.volume).toBeGreaterThan(0);
    });

    // Add 9 more tests for Halstead metrics
  });

  describe('Nesting Depth', () => {
    it('should calculate max nesting depth', () => {
      const source = `
        function deep() {
          if (a) {
            if (b) {
              if (c) {
                return true;
              }
            }
          }
        }
      `;
      const result = analyzer.analyze(source);
      expect(result.nesting).toBe(3);
    });

    // Add 9 more tests for nesting depth
  });
});
```

**Total**: 40 tests for Day 66 (12 + 10 + 10 + 8)

**5. Database Migration** (60 min)

`src/migrations/007_create_code_metrics.sql`:

```sql
-- Code metrics table for storing quality analysis results
CREATE TABLE IF NOT EXISTS code_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  symbol_id INTEGER,
  complexity_cyclomatic INTEGER NOT NULL,
  complexity_cognitive INTEGER NOT NULL,
  halstead_volume REAL NOT NULL,
  halstead_difficulty REAL NOT NULL,
  halstead_effort REAL NOT NULL,
  maintainability_index REAL NOT NULL,
  lines_of_code INTEGER NOT NULL,
  comment_ratio REAL NOT NULL,
  nesting_depth INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_code_metrics_file ON code_metrics(file_id);
CREATE INDEX IF NOT EXISTS idx_code_metrics_complexity ON code_metrics(complexity_cyclomatic);
CREATE INDEX IF NOT EXISTS idx_code_metrics_maintainability ON code_metrics(maintainability_index);

-- Trigger to update metrics timestamp
CREATE TRIGGER IF NOT EXISTS update_code_metrics_timestamp
AFTER UPDATE ON code_metrics
FOR EACH ROW
BEGIN
  UPDATE code_metrics SET created_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
```

**6. CLI Integration** (60 min)

`src/cli/commands/analyze.ts`:

```typescript
import { Command } from 'commander';
import { QualityService } from '../../analytics/quality/QualityService.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export function createAnalyzeCommand(): Command {
  const command = new Command('analyze');

  command
    .description('Analyze code quality metrics')
    .argument('<path>', 'File or directory to analyze')
    .option('--format <type>', 'Output format (table|json)', 'table')
    .option('--threshold <value>', 'Complexity threshold', '10')
    .action(async (path, options) => {
      const service = new QualityService();
      const report = await service.analyzeFile(path);

      if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      } else {
        const table = new Table({
          head: ['Metric', 'Value', 'Status'],
        });

        table.push(
          ['Cyclomatic Complexity', report.complexity.cyclomatic, getComplexityStatus(report.complexity.cyclomatic)],
          ['Cognitive Complexity', report.complexity.cognitive, ''],
          ['Maintainability Index', report.maintainability.index, report.maintainability.rating],
          ['Lines of Code', report.linesOfCode, ''],
          ['Max Nesting', report.complexity.nesting, '']
        );

        console.log(table.toString());

        if (report.maintainability.issues.length > 0) {
          console.log(chalk.yellow('\nIssues Found:'));
          report.maintainability.issues.forEach(issue => {
            console.log(chalk.red(`  - ${issue.suggestion}`));
          });
        }
      }
    });

  return command;
}

function getComplexityStatus(complexity: number): string {
  if (complexity <= 5) return chalk.green('✓ Low');
  if (complexity <= 10) return chalk.yellow('⚠ Medium');
  return chalk.red('✗ High');
}
```

### End of Day 66

**Checklist**:
- ✅ ComplexityAnalyzer implemented
- ✅ MaintainabilityCalculator implemented
- ✅ QualityService created
- ✅ 40 tests written and passing
- ✅ Database migration created
- ✅ CLI command integrated

**Deliverables**:
- 3 source files (400+ lines)
- 40 tests (100% pass rate)
- 1 DB migration
- 1 CLI command

---

## Day 67: Dependency Graph Analyzer

[Similar detailed breakdown for Days 67-70...]

---

## Week 2 Gate Review (End of Day 70)

### Success Criteria

- ✅ 200 tests passing (40 × 5 days)
- ✅ All 5 analytics components functional
- ✅ 4 database tables created
- ✅ CLI commands working
- ✅ Dashboard rendering correctly
- ✅ Query engine executing AQL

### Performance Validation

Run benchmark suite:

```bash
npm run bench -- src/analytics/__tests__/benchmarks/
```

Expected results:
- Complexity analysis: <50ms/file
- Dependency graph: <5s for 1000 files
- Query execution: <100ms for 100K symbols

---

## Post-Week 2

### Documentation

1. API documentation (TypeDoc)
2. CLI reference
3. Query language guide
4. Dashboard configuration examples

### Next Steps

**Sprint 8** (Days 71-80):
- Web UI dashboard
- LSP server
- VS Code extension
- Real-time collaboration

---

**Status**: ✅ **READY FOR DAY 66**
**Duration**: 5 days (Days 66-70)
**Team**: 1-2 engineers
**Prerequisites**: Week 1 complete ✅

