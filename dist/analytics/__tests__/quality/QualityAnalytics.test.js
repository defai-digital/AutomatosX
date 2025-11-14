// QualityAnalytics.test.ts - Tests for code quality analytics
// Day 67: Code Quality Analyzer Implementation
// Tests for ComplexityAnalyzer, MaintainabilityCalculator, and QualityService
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { ComplexityAnalyzer, CyclomaticAnalyzer, CognitiveAnalyzer, HalsteadAnalyzer, } from '../../quality/ComplexityAnalyzer.js';
import { MaintainabilityCalculator, CodeSmellType } from '../../quality/MaintainabilityCalculator.js';
import { QualityService } from '../../quality/QualityService.js';
import { TypeScriptParserService } from '../../../parser/TypeScriptParserService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// Mock ParserRegistry to prevent loading all 50+ language grammars
vi.mock('../../../parser/ParserRegistry.js', () => {
    class MockParserRegistry {
        parsers = new Map();
        extensionMap = new Map();
        constructor() {
            // Only register TypeScript parser to avoid loading all 50+ language grammars
            const TypeScriptParserService = require('../../../parser/TypeScriptParserService.js').TypeScriptParserService;
            const tsParser = new TypeScriptParserService();
            this.registerParser(tsParser);
        }
        registerParser(parser) {
            this.parsers.set(parser.language, parser);
            for (const ext of parser.extensions) {
                this.extensionMap.set(ext, parser);
            }
        }
        getParser(language) {
            return this.parsers.get(language) || null;
        }
        getParserForFile(filePath) {
            const ext = filePath.substring(filePath.lastIndexOf('.'));
            return this.extensionMap.get(ext) || null;
        }
    }
    return { ParserRegistry: MockParserRegistry };
});
// Create a minimal parser registry for tests
class TestParserRegistry {
    parsers = new Map();
    extensionMap = new Map();
    constructor() {
        const tsParser = new TypeScriptParserService();
        this.registerParser(tsParser);
    }
    registerParser(parser) {
        this.parsers.set(parser.language, parser);
        for (const ext of parser.extensions) {
            this.extensionMap.set(ext, parser);
        }
    }
    getParser(language) {
        return this.parsers.get(language) || null;
    }
    getParserForFile(filePath) {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        return this.extensionMap.get(ext) || null;
    }
}
// ============================================================================
// TEST FIXTURES
// ============================================================================
const simpleFunction = `
function add(a, b) {
  return a + b;
}
`;
const complexFunction = `
function processData(data, options) {
  if (!data) {
    return null;
  }

  let result = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i].active) {
      if (options.filter && !options.filter(data[i])) {
        continue;
      }

      if (data[i].type === 'special') {
        result.push(transform(data[i]));
      } else {
        result.push(data[i]);
      }
    }
  }

  return result.length > 0 ? result : null;
}
`;
const veryComplexFunction = `
function complexAlgorithm(input, config) {
  if (!input || !config) {
    throw new Error('Invalid input');
  }

  let output = [];
  let cache = new Map();

  for (let i = 0; i < input.length; i++) {
    if (input[i].skip) {
      continue;
    }

    if (cache.has(input[i].id)) {
      output.push(cache.get(input[i].id));
    } else {
      let processed;

      if (config.mode === 'advanced') {
        if (input[i].priority === 'high') {
          processed = advancedProcess(input[i]);
        } else if (input[i].priority === 'medium') {
          processed = normalProcess(input[i]);
        } else {
          processed = simpleProcess(input[i]);
        }
      } else {
        if (config.transform) {
          processed = config.transform(input[i]);
        } else {
          processed = input[i];
        }
      }

      if (processed && processed.valid) {
        cache.set(input[i].id, processed);
        output.push(processed);
      } else if (config.includeInvalid) {
        output.push(processed);
      }
    }
  }

  return output.length > 0 ? output : [];
}
`;
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function parseCode(code) {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    const tree = parser.parse(code);
    return tree.rootNode;
}
async function createTempFile(content, filename = 'test.ts') {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-test-'));
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
}
async function cleanupTempFile(filePath) {
    const dir = path.dirname(filePath);
    await fs.rm(dir, { recursive: true, force: true });
}
// ============================================================================
// CYCLOMATIC COMPLEXITY TESTS
// ============================================================================
describe('CyclomaticAnalyzer', () => {
    it('should calculate complexity of simple function as 1', () => {
        const node = parseCode(simpleFunction);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBe(1);
        expect(result.decisionPoints).toBe(0);
        expect(result.paths).toBe(1);
    });
    it('should count if statements as decision points', () => {
        const code = `
      function test(x) {
        if (x > 0) {
          return 1;
        }
        return 0;
      }
    `;
        const node = parseCode(code);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(2);
        expect(result.decisionPoints).toBeGreaterThanOrEqual(1);
    });
    it('should count for loops as decision points', () => {
        const code = `
      function test(arr) {
        for (let i = 0; i < arr.length; i++) {
          console.log(arr[i]);
        }
      }
    `;
        const node = parseCode(code);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(2);
    });
    it('should count while loops as decision points', () => {
        const code = `
      function test(x) {
        while (x > 0) {
          x--;
        }
      }
    `;
        const node = parseCode(code);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(2);
    });
    it('should count logical operators as decision points', () => {
        const code = `
      function test(a, b, c) {
        if (a && b || c) {
          return true;
        }
        return false;
      }
    `;
        const node = parseCode(code);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(3);
    });
    it('should handle complex functions', () => {
        const node = parseCode(complexFunction);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(5);
        expect(result.decisionPoints).toBeGreaterThanOrEqual(4);
    });
    it('should handle very complex functions', () => {
        const node = parseCode(veryComplexFunction);
        const result = CyclomaticAnalyzer.calculate(node);
        expect(result.complexity).toBeGreaterThanOrEqual(10);
    });
});
// ============================================================================
// COGNITIVE COMPLEXITY TESTS
// ============================================================================
describe('CognitiveAnalyzer', () => {
    it('should calculate cognitive complexity for simple function', () => {
        const node = parseCode(simpleFunction);
        const result = CognitiveAnalyzer.calculate(node);
        expect(result.complexity).toBe(0);
        expect(result.structuralComplexity).toBe(0);
        expect(result.nestingPenalty).toBe(0);
    });
    it('should penalize nested control structures', () => {
        const code = `
      function test(data) {
        if (data) {
          if (data.valid) {
            if (data.ready) {
              return true;
            }
          }
        }
        return false;
      }
    `;
        const node = parseCode(code);
        const result = CognitiveAnalyzer.calculate(node);
        expect(result.nestingPenalty).toBeGreaterThan(0);
        expect(result.complexity).toBeGreaterThan(result.structuralComplexity);
    });
    it('should count control flow structures', () => {
        const node = parseCode(complexFunction);
        const result = CognitiveAnalyzer.calculate(node);
        expect(result.structuralComplexity).toBeGreaterThanOrEqual(4);
        expect(result.complexity).toBeGreaterThan(0);
    });
    it('should handle deeply nested code', () => {
        const node = parseCode(veryComplexFunction);
        const result = CognitiveAnalyzer.calculate(node);
        expect(result.nestingPenalty).toBeGreaterThan(5);
        expect(result.complexity).toBeGreaterThan(10);
    });
});
// ============================================================================
// HALSTEAD METRICS TESTS
// ============================================================================
describe('HalsteadAnalyzer', () => {
    it('should calculate Halstead metrics for simple function', () => {
        const node = parseCode(simpleFunction);
        const result = HalsteadAnalyzer.calculate(node);
        expect(result.uniqueOperators).toBeGreaterThan(0);
        expect(result.uniqueOperands).toBeGreaterThan(0);
        expect(result.vocabulary).toBeGreaterThan(0);
        expect(result.length).toBeGreaterThan(0);
    });
    it('should calculate volume correctly', () => {
        const node = parseCode(complexFunction);
        const result = HalsteadAnalyzer.calculate(node);
        expect(result.volume).toBeGreaterThan(0);
        expect(result.volume).toBe(result.length * Math.log2(result.vocabulary));
    });
    it('should calculate difficulty correctly', () => {
        const node = parseCode(complexFunction);
        const result = HalsteadAnalyzer.calculate(node);
        if (result.uniqueOperators > 0 && result.uniqueOperands > 0) {
            const expectedDifficulty = (result.uniqueOperators / 2) * (result.totalOperands / result.uniqueOperands);
            expect(result.difficulty).toBeCloseTo(expectedDifficulty, 2);
        }
    });
    it('should calculate effort as difficulty * volume', () => {
        const node = parseCode(complexFunction);
        const result = HalsteadAnalyzer.calculate(node);
        expect(result.effort).toBeCloseTo(result.difficulty * result.volume, 2);
    });
    it('should calculate time to program', () => {
        const node = parseCode(complexFunction);
        const result = HalsteadAnalyzer.calculate(node);
        expect(result.timeToProgram).toBeGreaterThan(0);
        expect(result.timeToProgram).toBeCloseTo(result.effort / 18, 2);
    });
    it('should calculate bugs delivered', () => {
        const node = parseCode(complexFunction);
        const result = HalsteadAnalyzer.calculate(node);
        expect(result.bugsDelivered).toBeGreaterThan(0);
        expect(result.bugsDelivered).toBeCloseTo(result.volume / 3000, 5);
    });
});
// ============================================================================
// COMPLEXITY ANALYZER TESTS
// ============================================================================
describe('ComplexityAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        const testRegistry = new TestParserRegistry();
        analyzer = new ComplexityAnalyzer(testRegistry);
    });
    it('should analyze simple file successfully', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const result = await analyzer.analyzeFile(filePath, simpleFunction, 'typescript');
            expect(result.filePath).toBe(filePath);
            expect(result.language).toBe('typescript');
            expect(result.overall).toBeDefined();
            expect(result.functions.length).toBeGreaterThan(0);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should extract function names correctly', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const result = await analyzer.analyzeFile(filePath, simpleFunction, 'typescript');
            const func = result.functions.find(f => f.name === 'add');
            expect(func).toBeDefined();
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate average complexity correctly', async () => {
        const code = `
      function simple() { return 1; }
      function complex(x) {
        if (x > 0) {
          if (x > 10) {
            return 100;
          }
          return 10;
        }
        return 0;
      }
    `;
        const filePath = await createTempFile(code);
        try {
            const result = await analyzer.analyzeFile(filePath, code, 'typescript');
            expect(result.averageComplexity).toBeGreaterThan(0);
            expect(result.functions.length).toBeGreaterThanOrEqual(2);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate max complexity correctly', async () => {
        const code = `
      function simple() { return 1; }
      function complex(x) {
        if (x > 0) {
          if (x > 10) {
            return 100;
          }
          return 10;
        }
        return 0;
      }
    `;
        const filePath = await createTempFile(code);
        try {
            const result = await analyzer.analyzeFile(filePath, code, 'typescript');
            expect(result.maxComplexity).toBeGreaterThanOrEqual(result.averageComplexity);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should get complexity grade A for low complexity', () => {
        expect(ComplexityAnalyzer.getComplexityGrade(3)).toBe('A');
        expect(ComplexityAnalyzer.getComplexityGrade(5)).toBe('A');
    });
    it('should get complexity grade F for high complexity', () => {
        expect(ComplexityAnalyzer.getComplexityGrade(35)).toBe('F');
        expect(ComplexityAnalyzer.getComplexityGrade(50)).toBe('F');
    });
    it('should get maintainability grade A for high index', () => {
        expect(ComplexityAnalyzer.getMaintainabilityGrade(85)).toBe('A');
        expect(ComplexityAnalyzer.getMaintainabilityGrade(90)).toBe('A');
    });
    it('should get maintainability grade F for low index', () => {
        expect(ComplexityAnalyzer.getMaintainabilityGrade(15)).toBe('F');
        expect(ComplexityAnalyzer.getMaintainabilityGrade(10)).toBe('F');
    });
});
// ============================================================================
// MAINTAINABILITY CALCULATOR TESTS
// ============================================================================
describe('MaintainabilityCalculator', () => {
    let calculator;
    let analyzer;
    beforeEach(() => {
        calculator = new MaintainabilityCalculator();
        const testRegistry = new TestParserRegistry();
        analyzer = new ComplexityAnalyzer(testRegistry);
    });
    it('should calculate maintainability for simple code', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, simpleFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            expect(maintainability.maintainabilityIndex).toBeGreaterThan(0);
            expect(maintainability.grade).toBeDefined();
            expect(maintainability.technicalDebt).toBeDefined();
            expect(maintainability.qualityScore).toBeGreaterThanOrEqual(0);
            expect(maintainability.qualityScore).toBeLessThanOrEqual(100);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should detect high complexity code smell', async () => {
        const filePath = await createTempFile(veryComplexFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, veryComplexFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            const complexitySmells = maintainability.codeSmells.filter(s => s.type === CodeSmellType.HighComplexity);
            expect(complexitySmells.length).toBeGreaterThan(0);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should detect long function code smell', async () => {
        const longCode = `
      function veryLongFunction() {
        ${Array(60).fill('console.log("line");').join('\n')}
      }
    `;
        const filePath = await createTempFile(longCode);
        try {
            const complexity = await analyzer.analyzeFile(filePath, longCode, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            const longFunctionSmells = maintainability.codeSmells.filter(s => s.type === CodeSmellType.LongFunction);
            expect(longFunctionSmells.length).toBeGreaterThan(0);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate technical debt', async () => {
        const filePath = await createTempFile(veryComplexFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, veryComplexFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            expect(maintainability.technicalDebt.totalMinutes).toBeGreaterThan(0);
            expect(maintainability.technicalDebt.totalHours).toBe(maintainability.technicalDebt.totalMinutes / 60);
            expect(maintainability.technicalDebt.severity).toBeDefined();
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should generate recommendations for complex code', async () => {
        const filePath = await createTempFile(veryComplexFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, veryComplexFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            expect(maintainability.recommendations.length).toBeGreaterThan(0);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate quality score', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, simpleFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            expect(maintainability.qualityScore).toBeGreaterThan(50);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate grade correctly', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, simpleFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            expect(['A', 'B', 'C', 'D', 'F']).toContain(maintainability.grade);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should calculate debt trend correctly', () => {
        const historicalData = [
            { timestamp: new Date('2024-01-01'), debt: 100 },
            { timestamp: new Date('2024-01-02'), debt: 120 },
            { timestamp: new Date('2024-01-03'), debt: 150 },
        ];
        const result = calculator.calculateDebtTrend(historicalData);
        expect(result.trend).toBe('increasing');
        expect(result.changePercent).toBeGreaterThan(0);
    });
    it('should detect stable debt trend', () => {
        const historicalData = [
            { timestamp: new Date('2024-01-01'), debt: 100 },
            { timestamp: new Date('2024-01-02'), debt: 102 },
            { timestamp: new Date('2024-01-03'), debt: 101 },
        ];
        const result = calculator.calculateDebtTrend(historicalData);
        expect(result.trend).toBe('stable');
    });
    it('should get refactoring priority', async () => {
        const filePath = await createTempFile(veryComplexFunction);
        try {
            const complexity = await analyzer.analyzeFile(filePath, veryComplexFunction, 'typescript');
            const maintainability = calculator.calculateMaintainability(complexity);
            const priority = calculator.getRefactoringPriority(maintainability);
            expect(priority).toBeGreaterThanOrEqual(0);
            expect(priority).toBeLessThanOrEqual(100);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
});
// ============================================================================
// QUALITY SERVICE TESTS
// ============================================================================
describe('QualityService', () => {
    let service;
    beforeEach(() => {
        const testRegistry = new TestParserRegistry();
        const analyzer = new ComplexityAnalyzer(testRegistry);
        service = new QualityService(undefined, analyzer);
    });
    it('should analyze file successfully', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const report = await service.analyzeFile(filePath, 'typescript');
            expect(report.filePath).toBe(filePath);
            expect(report.language).toBe('typescript');
            expect(report.complexity).toBeDefined();
            expect(report.maintainability).toBeDefined();
            expect(report.summary).toBeDefined();
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should generate quality summary', async () => {
        const filePath = await createTempFile(complexFunction);
        try {
            const report = await service.analyzeFile(filePath, 'typescript');
            expect(report.summary.overallGrade).toBeDefined();
            expect(report.summary.qualityScore).toBeGreaterThanOrEqual(0);
            expect(report.summary.qualityScore).toBeLessThanOrEqual(100);
            expect(report.summary.riskLevel).toBeDefined();
            expect(report.summary.technicalDebtHours).toBeGreaterThanOrEqual(0);
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should format report correctly', async () => {
        const filePath = await createTempFile(simpleFunction);
        try {
            const report = await service.analyzeFile(filePath, 'typescript');
            const formatted = service.formatReport(report);
            expect(formatted).toContain('Quality Report');
            expect(formatted).toContain('Overall Grade');
            expect(formatted).toContain('Quality Score');
        }
        finally {
            await cleanupTempFile(filePath);
        }
    });
    it('should analyze project with multiple files', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-project-'));
        try {
            await fs.writeFile(path.join(tempDir, 'file1.ts'), simpleFunction);
            await fs.writeFile(path.join(tempDir, 'file2.ts'), complexFunction);
            const report = await service.analyzeProject(tempDir, ['typescript']);
            expect(report.fileReports.length).toBeGreaterThanOrEqual(2);
            expect(report.aggregateMetrics.totalFiles).toBeGreaterThanOrEqual(2);
        }
        finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    it('should calculate aggregate metrics correctly', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-project-'));
        try {
            await fs.writeFile(path.join(tempDir, 'file1.ts'), simpleFunction);
            await fs.writeFile(path.join(tempDir, 'file2.ts'), complexFunction);
            const report = await service.analyzeProject(tempDir, ['typescript']);
            expect(report.aggregateMetrics.averageComplexity).toBeGreaterThan(0);
            expect(report.aggregateMetrics.averageMaintainability).toBeGreaterThan(0);
            expect(report.aggregateMetrics.totalTechnicalDebtHours).toBeGreaterThanOrEqual(0);
        }
        finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    it('should calculate grade distribution', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-project-'));
        try {
            await fs.writeFile(path.join(tempDir, 'file1.ts'), simpleFunction);
            await fs.writeFile(path.join(tempDir, 'file2.ts'), complexFunction);
            const report = await service.analyzeProject(tempDir, ['typescript']);
            expect(Object.keys(report.aggregateMetrics.gradeDistribution).length).toBeGreaterThan(0);
        }
        finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    it('should format project report correctly', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-project-'));
        try {
            await fs.writeFile(path.join(tempDir, 'file1.ts'), simpleFunction);
            const report = await service.analyzeProject(tempDir, ['typescript']);
            const formatted = service.formatProjectReport(report);
            expect(formatted).toContain('Project Quality Report');
            expect(formatted).toContain('Files Analyzed');
            expect(formatted).toContain('Grade Distribution');
        }
        finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=QualityAnalytics.test.js.map