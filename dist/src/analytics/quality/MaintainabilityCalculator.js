// MaintainabilityCalculator.ts - Code maintainability analysis
// Day 67: Code Quality Analyzer Implementation
// Calculates maintainability metrics, technical debt, and quality scores
export var CodeSmellType;
(function (CodeSmellType) {
    CodeSmellType["HighComplexity"] = "HIGH_COMPLEXITY";
    CodeSmellType["LowMaintainability"] = "LOW_MAINTAINABILITY";
    CodeSmellType["LongFunction"] = "LONG_FUNCTION";
    CodeSmellType["LowCohesion"] = "LOW_COHESION";
    CodeSmellType["HighCoupling"] = "HIGH_COUPLING";
    CodeSmellType["DuplicateCode"] = "DUPLICATE_CODE";
    CodeSmellType["GodObject"] = "GOD_OBJECT";
    CodeSmellType["LongParameterList"] = "LONG_PARAMETER_LIST";
    CodeSmellType["FeatureEnvy"] = "FEATURE_ENVY";
    CodeSmellType["DataClumps"] = "DATA_CLUMPS";
    CodeSmellType["MagicNumbers"] = "MAGIC_NUMBERS";
})(CodeSmellType || (CodeSmellType = {}));
// ============================================================================
// MAINTAINABILITY CALCULATOR
// ============================================================================
export class MaintainabilityCalculator {
    thresholds;
    constructor(thresholds) {
        this.thresholds = {
            maxCyclomaticComplexity: 10,
            maxCognitiveComplexity: 15,
            maxFunctionLines: 50,
            minMaintainabilityIndex: 60,
            maxFunctionsPerFile: 20,
            ...thresholds,
        };
    }
    /**
     * Calculate comprehensive maintainability metrics
     */
    calculateMaintainability(fileComplexity) {
        const maintainabilityIndex = fileComplexity.overall.maintainabilityIndex;
        const grade = this.calculateGrade(maintainabilityIndex);
        const codeSmells = this.detectCodeSmells(fileComplexity);
        const technicalDebt = this.calculateTechnicalDebt(fileComplexity, codeSmells);
        const qualityScore = this.calculateQualityScore(fileComplexity, codeSmells);
        const recommendations = this.generateRecommendations(fileComplexity, codeSmells);
        return {
            maintainabilityIndex,
            grade,
            technicalDebt,
            qualityScore,
            codeSmells,
            recommendations,
        };
    }
    /**
     * Calculate maintainability grade
     */
    calculateGrade(maintainabilityIndex) {
        if (maintainabilityIndex >= 80)
            return 'A';
        if (maintainabilityIndex >= 60)
            return 'B';
        if (maintainabilityIndex >= 40)
            return 'C';
        if (maintainabilityIndex >= 20)
            return 'D';
        return 'F';
    }
    /**
     * Detect code smells
     */
    detectCodeSmells(fileComplexity) {
        const smells = [];
        // Check overall file complexity
        if (fileComplexity.overall.cyclomatic.complexity > this.thresholds.maxCyclomaticComplexity * 2) {
            smells.push({
                type: CodeSmellType.HighComplexity,
                severity: 'high',
                message: `File has very high cyclomatic complexity (${fileComplexity.overall.cyclomatic.complexity})`,
            });
        }
        // Check file maintainability
        if (fileComplexity.overall.maintainabilityIndex < this.thresholds.minMaintainabilityIndex) {
            smells.push({
                type: CodeSmellType.LowMaintainability,
                severity: fileComplexity.overall.maintainabilityIndex < 40 ? 'high' : 'medium',
                message: `File has low maintainability index (${fileComplexity.overall.maintainabilityIndex.toFixed(1)})`,
            });
        }
        // Check for God Object (too many functions)
        if (fileComplexity.functions.length > this.thresholds.maxFunctionsPerFile) {
            smells.push({
                type: CodeSmellType.GodObject,
                severity: 'medium',
                message: `File has too many functions (${fileComplexity.functions.length}). Consider splitting into multiple files.`,
            });
        }
        // Check individual functions
        for (const func of fileComplexity.functions) {
            // High cyclomatic complexity
            if (func.cyclomatic.complexity > this.thresholds.maxCyclomaticComplexity) {
                smells.push({
                    type: CodeSmellType.HighComplexity,
                    severity: func.cyclomatic.complexity > this.thresholds.maxCyclomaticComplexity * 2 ? 'high' : 'medium',
                    message: `Function '${func.name}' has high cyclomatic complexity (${func.cyclomatic.complexity})`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
            // High cognitive complexity
            if (func.cognitive.complexity > this.thresholds.maxCognitiveComplexity) {
                smells.push({
                    type: CodeSmellType.HighComplexity,
                    severity: 'medium',
                    message: `Function '${func.name}' has high cognitive complexity (${func.cognitive.complexity})`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
            // Long function
            if (func.linesOfCode > this.thresholds.maxFunctionLines) {
                smells.push({
                    type: CodeSmellType.LongFunction,
                    severity: func.linesOfCode > this.thresholds.maxFunctionLines * 2 ? 'high' : 'medium',
                    message: `Function '${func.name}' is too long (${func.linesOfCode} lines). Consider breaking it down.`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
            // Low maintainability
            if (func.maintainabilityIndex < this.thresholds.minMaintainabilityIndex) {
                smells.push({
                    type: CodeSmellType.LowMaintainability,
                    severity: 'medium',
                    message: `Function '${func.name}' has low maintainability (${func.maintainabilityIndex.toFixed(1)})`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
            // Long parameter list
            if (func.parameters && func.parameters > 5) {
                smells.push({
                    type: CodeSmellType.LongParameterList,
                    severity: func.parameters > 7 ? 'high' : 'medium',
                    message: `Function '${func.name}' has too many parameters (${func.parameters}). Consider using an object parameter.`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
            // Magic numbers (heuristic: check for numeric literals in function)
            const magicNumberCount = this.detectMagicNumbers(func);
            if (magicNumberCount > 3) {
                smells.push({
                    type: CodeSmellType.MagicNumbers,
                    severity: magicNumberCount > 5 ? 'high' : 'medium',
                    message: `Function '${func.name}' contains ${magicNumberCount} potential magic numbers. Consider using named constants.`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
        }
        // Check for data clumps (parameters appearing together frequently)
        const dataClumps = this.detectDataClumps(fileComplexity.functions);
        smells.push(...dataClumps);
        // Check for feature envy (functions with many external references)
        const featureEnvy = this.detectFeatureEnvy(fileComplexity.functions);
        smells.push(...featureEnvy);
        return smells;
    }
    /**
     * Calculate technical debt
     * Based on SQALE methodology
     */
    calculateTechnicalDebt(fileComplexity, codeSmells) {
        let totalMinutes = 0;
        // Base debt from complexity
        const avgComplexity = fileComplexity.averageComplexity;
        if (avgComplexity > this.thresholds.maxCyclomaticComplexity) {
            totalMinutes += (avgComplexity - this.thresholds.maxCyclomaticComplexity) * 10;
        }
        // Debt from code smells
        for (const smell of codeSmells) {
            switch (smell.severity) {
                case 'high':
                    totalMinutes += 60; // 1 hour per high severity smell
                    break;
                case 'medium':
                    totalMinutes += 30; // 30 minutes per medium severity smell
                    break;
                case 'low':
                    totalMinutes += 15; // 15 minutes per low severity smell
                    break;
            }
        }
        // Debt from low maintainability
        if (fileComplexity.overall.maintainabilityIndex < 60) {
            const maintDebt = (60 - fileComplexity.overall.maintainabilityIndex) * 2;
            totalMinutes += maintDebt;
        }
        const totalHours = totalMinutes / 60;
        const totalDays = totalHours / 8;
        // Calculate severity
        let severity;
        if (totalHours < 1) {
            severity = 'low';
        }
        else if (totalHours < 4) {
            severity = 'medium';
        }
        else if (totalHours < 16) {
            severity = 'high';
        }
        else {
            severity = 'critical';
        }
        // Calculate debt ratio (debt time / development time estimate)
        const developmentTimeMinutes = fileComplexity.overall.linesOfCode * 2; // Assume 2 minutes per LOC
        const ratio = totalMinutes / developmentTimeMinutes;
        return {
            totalMinutes,
            totalHours,
            totalDays,
            severity,
            ratio,
        };
    }
    /**
     * Calculate overall quality score (0-100)
     */
    calculateQualityScore(fileComplexity, codeSmells) {
        let score = 100;
        // Deduct for complexity
        const avgComplexity = fileComplexity.averageComplexity;
        if (avgComplexity > this.thresholds.maxCyclomaticComplexity) {
            score -= Math.min(30, (avgComplexity - this.thresholds.maxCyclomaticComplexity) * 3);
        }
        // Deduct for maintainability
        const maintainabilityIndex = fileComplexity.overall.maintainabilityIndex;
        if (maintainabilityIndex < 80) {
            score -= (80 - maintainabilityIndex) * 0.5;
        }
        // Deduct for code smells
        for (const smell of codeSmells) {
            switch (smell.severity) {
                case 'high':
                    score -= 10;
                    break;
                case 'medium':
                    score -= 5;
                    break;
                case 'low':
                    score -= 2;
                    break;
            }
        }
        return Math.max(0, Math.min(100, score));
    }
    /**
     * Generate actionable recommendations
     */
    generateRecommendations(fileComplexity, codeSmells) {
        const recommendations = [];
        // High complexity recommendations
        const highComplexityFunctions = fileComplexity.functions.filter(f => f.cyclomatic.complexity > this.thresholds.maxCyclomaticComplexity);
        if (highComplexityFunctions.length > 0) {
            recommendations.push(`Refactor ${highComplexityFunctions.length} high-complexity function(s): ${highComplexityFunctions.map(f => f.name).join(', ')}`);
        }
        // Long function recommendations
        const longFunctions = fileComplexity.functions.filter(f => f.linesOfCode > this.thresholds.maxFunctionLines);
        if (longFunctions.length > 0) {
            recommendations.push(`Break down ${longFunctions.length} long function(s) into smaller, focused functions`);
        }
        // Low maintainability recommendations
        if (fileComplexity.overall.maintainabilityIndex < this.thresholds.minMaintainabilityIndex) {
            recommendations.push('Improve code maintainability by reducing complexity and adding documentation');
        }
        // God object recommendations
        if (fileComplexity.functions.length > this.thresholds.maxFunctionsPerFile) {
            recommendations.push(`Consider splitting file into multiple modules (currently ${fileComplexity.functions.length} functions)`);
        }
        // Nesting recommendations
        const deeplyNestedFunctions = fileComplexity.functions.filter(f => f.cognitive.nestingPenalty > 10);
        if (deeplyNestedFunctions.length > 0) {
            recommendations.push('Reduce nesting depth by extracting nested logic into separate functions');
        }
        // General recommendations based on quality score
        const qualityScore = this.calculateQualityScore(fileComplexity, codeSmells);
        if (qualityScore < 50) {
            recommendations.push('Consider rewriting this file - quality score is critically low');
        }
        else if (qualityScore < 70) {
            recommendations.push('Prioritize refactoring this file in the next sprint');
        }
        return recommendations;
    }
    /**
     * Calculate technical debt trend
     */
    calculateDebtTrend(historicalData) {
        if (historicalData.length < 2) {
            return { trend: 'stable', changePercent: 0 };
        }
        const sorted = historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const oldest = sorted[0].debt;
        const newest = sorted[sorted.length - 1].debt;
        const changePercent = ((newest - oldest) / oldest) * 100;
        let trend;
        if (Math.abs(changePercent) < 5) {
            trend = 'stable';
        }
        else if (changePercent > 0) {
            trend = 'increasing';
        }
        else {
            trend = 'decreasing';
        }
        return { trend, changePercent };
    }
    /**
     * Get priority for refactoring
     */
    getRefactoringPriority(metrics) {
        let priority = 0;
        // Factor in quality score
        priority += (100 - metrics.qualityScore) * 0.4;
        // Factor in technical debt
        switch (metrics.technicalDebt.severity) {
            case 'critical':
                priority += 40;
                break;
            case 'high':
                priority += 30;
                break;
            case 'medium':
                priority += 20;
                break;
            case 'low':
                priority += 10;
                break;
        }
        // Factor in code smells
        const highSeveritySmells = metrics.codeSmells.filter(s => s.severity === 'high').length;
        priority += highSeveritySmells * 5;
        return Math.min(100, priority);
    }
    /**
     * Detect magic numbers in function
     * Heuristic: Estimate based on function size and complexity
     */
    detectMagicNumbers(func) {
        // Simplified heuristic: assume ~1 magic number per 20 lines in complex functions
        if (func.cyclomatic.complexity > 5 && func.linesOfCode > 20) {
            return Math.floor(func.linesOfCode / 20) + Math.floor(func.cyclomatic.complexity / 5);
        }
        return 0;
    }
    /**
     * Detect data clumps (parameter groups appearing together)
     * Heuristic: Functions with similar parameter counts and high coupling
     */
    detectDataClumps(functions) {
        const smells = [];
        // Group functions by parameter count
        const functionsByParamCount = new Map();
        for (const func of functions) {
            const paramCount = func.parameters || 0;
            if (paramCount >= 3) { // Only consider functions with 3+ parameters
                if (!functionsByParamCount.has(paramCount)) {
                    functionsByParamCount.set(paramCount, []);
                }
                functionsByParamCount.get(paramCount).push(func);
            }
        }
        // If multiple functions share the same parameter count (3+), flag as potential data clump
        for (const [paramCount, funcs] of functionsByParamCount.entries()) {
            if (funcs.length >= 3) { // 3+ functions with same parameter count
                smells.push({
                    type: CodeSmellType.DataClumps,
                    severity: paramCount >= 5 ? 'high' : 'medium',
                    message: `${funcs.length} functions share ${paramCount} parameters. Consider creating a parameter object or data class.`,
                });
                break; // Only report once per file
            }
        }
        return smells;
    }
    /**
     * Detect feature envy (functions with low cohesion, likely accessing external data)
     * Heuristic: Long functions with high complexity and low maintainability
     */
    detectFeatureEnvy(functions) {
        const smells = [];
        for (const func of functions) {
            // Feature envy indicators:
            // 1. Long function (> 50 lines)
            // 2. High complexity (> 10)
            // 3. Low maintainability (< 50)
            const isLong = func.linesOfCode > 50;
            const isComplex = func.cyclomatic.complexity > 10;
            const hasLowMaintainability = func.maintainabilityIndex < 50;
            if (isLong && isComplex && hasLowMaintainability) {
                smells.push({
                    type: CodeSmellType.FeatureEnvy,
                    severity: 'medium',
                    message: `Function '${func.name}' may be accessing too much external data. Consider moving logic closer to data.`,
                    location: {
                        function: func.name,
                        startLine: func.startLine,
                        endLine: func.endLine,
                    },
                });
            }
        }
        return smells;
    }
}
//# sourceMappingURL=MaintainabilityCalculator.js.map