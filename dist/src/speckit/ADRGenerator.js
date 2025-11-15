/**
 * ADRGenerator - Generate Architectural Decision Records
 * Automatically detects design patterns and architectural decisions in codebase
 */
import { SpecKitGenerator } from './SpecKitGenerator.js';
import { PatternDetector } from './PatternDetector.js';
/**
 * ADRGenerator - Generate Architectural Decision Records
 */
export class ADRGenerator extends SpecKitGenerator {
    generatorName = 'ADR';
    /**
     * Analyze project to extract architectural information
     */
    async analyze(options) {
        this.log(options, 'Analyzing codebase for architectural patterns...');
        // Use PatternDetector to find patterns
        const detector = new PatternDetector(this.searchCode.bind(this));
        let detectorPatterns;
        if (options.pattern) {
            // Detect specific pattern
            const result = await detector.detect(options.pattern);
            detectorPatterns = result ? [result] : [];
        }
        else {
            // Detect all patterns
            detectorPatterns = await detector.detectAll();
        }
        this.log(options, `Found ${detectorPatterns.length} architectural patterns`);
        // Convert file paths to AnalyzedFile objects
        const uniqueFiles = [...new Set(detectorPatterns.flatMap((p) => p.files))];
        const analyzedFiles = uniqueFiles.map(filePath => ({
            path: filePath,
            language: this.inferLanguage(filePath),
            lines: 0, // Not available from pattern detection
            symbols: [],
            imports: [],
            exports: [],
        }));
        // Convert DetectorPattern to speckit.types.DetectedPattern
        const detectedPatterns = detectorPatterns.map((p) => {
            const locations = p.files.map(file => ({
                file,
                line: 1,
                context: p.description || '',
            }));
            const examples = p.examples.map(ex => ({
                code: ex.code,
                language: this.inferLanguage(ex.file),
                explanation: ex.context || '',
            }));
            return {
                type: p.type === 'design' ? 'design' : p.type === 'architectural' ? 'architectural' : 'integration',
                name: p.name,
                description: p.description || '',
                locations,
                confidence: p.confidence,
                examples,
            };
        });
        // Convert pattern info to ArchitecturalInsight[]
        const architecturalInsights = detectorPatterns.map((p) => ({
            category: p.type === 'design' ? 'pattern' : 'best-practice',
            title: p.name,
            description: p.description || `${p.name} pattern detected in ${p.files.length} files`,
            impact: p.confidence > 0.7 ? 'high' : p.confidence > 0.5 ? 'medium' : 'low',
            recommendation: p.benefits?.[0],
        }));
        return {
            files: analyzedFiles,
            patterns: detectedPatterns,
            stats: {
                totalFiles: analyzedFiles.length,
                totalLines: 0, // Not available from pattern detection
                languages: this.countLanguages(analyzedFiles),
            },
            dependencies: [],
            architecture: architecturalInsights,
        };
    }
    /**
     * Detect patterns (already done in analyze, just pass through)
     */
    async detect(analysis, options) {
        // Convert back to DetectorPattern format for generateContent
        return analysis.patterns.map(p => {
            const files = [...new Set(p.locations.map(loc => loc.file))];
            const examples = p.examples.map(ex => ({
                file: files[0] || '',
                line: 1,
                code: ex.code,
                context: ex.explanation,
            }));
            return {
                name: p.name,
                type: p.type,
                files,
                examples,
                confidence: p.confidence,
                description: p.description,
                benefits: [],
                tradeoffs: [],
            };
        });
    }
    /**
     * Generate ADR content using AI
     */
    async generateContent(patterns, analysis, options) {
        this.log(options, 'Generating ADR content with AI...');
        if (patterns.length === 0) {
            return this.generateEmptyADR(options);
        }
        // Build prompt for AI
        const prompt = this.buildADRPrompt(patterns, analysis, options);
        // Call AI to generate content
        const response = await this.callAI(prompt, options);
        return response;
    }
    /**
     * Build prompt for AI to generate ADR
     */
    buildADRPrompt(patterns, analysis, options) {
        const template = options.template || 'standard';
        let prompt = `Generate an Architectural Decision Record (ADR) documenting the following patterns found in this codebase:\n\n`;
        // Add pattern details
        for (const pattern of patterns) {
            prompt += `## Pattern: ${pattern.name}\n`;
            prompt += `Type: ${pattern.type}\n`;
            prompt += `Confidence: ${(pattern.confidence * 100).toFixed(0)}%\n`;
            prompt += `Files using this pattern: ${pattern.files.length}\n`;
            if (pattern.description) {
                prompt += `\nDescription: ${pattern.description}\n`;
            }
            if (pattern.benefits && pattern.benefits.length > 0) {
                prompt += `\nBenefits:\n${pattern.benefits.map((b) => `- ${b}`).join('\n')}\n`;
            }
            if (pattern.tradeoffs && pattern.tradeoffs.length > 0) {
                prompt += `\nTradeoffs:\n${pattern.tradeoffs.map((t) => `- ${t}`).join('\n')}\n`;
            }
            if (options.includeExamples && pattern.examples.length > 0) {
                prompt += `\nExamples:\n`;
                for (const example of pattern.examples.slice(0, 2)) {
                    prompt += `\nFile: ${example.file}:${example.line}\n`;
                    prompt += `\`\`\`\n${example.code.slice(0, 200)}\n\`\`\`\n`;
                }
            }
            prompt += `\n---\n\n`;
        }
        // Add template instructions
        if (template === 'standard') {
            prompt += `\nGenerate a comprehensive ADR document with these sections:\n`;
            prompt += `1. Title and Status\n`;
            prompt += `2. Context (what patterns were found and why they matter)\n`;
            prompt += `3. Decision (which patterns to keep/adopt)\n`;
            prompt += `4. Consequences (benefits and tradeoffs)\n`;
            prompt += `5. Related Patterns\n`;
        }
        else if (template === 'y-statement') {
            prompt += `\nGenerate an ADR using the Y-statement format:\n`;
            prompt += `"In the context of [USE CASE], facing [CONCERN], we decided for [OPTION] to achieve [QUALITY], accepting [DOWNSIDE]."\n`;
        }
        if (options.includeRationale) {
            prompt += `\nInclude detailed rationale for why these patterns were chosen.\n`;
        }
        prompt += `\nFormat the output as Markdown with proper headings and code blocks.\n`;
        if (options.context) {
            prompt += `\nAdditional context: ${options.context}\n`;
        }
        return prompt;
    }
    /**
     * Generate empty ADR when no patterns found
     */
    generateEmptyADR(options) {
        return `# Architectural Decision Record

## Status

Draft

## Context

No significant architectural patterns were detected in the codebase during analysis.

This may indicate:
- A small or new codebase
- Non-standard pattern implementations
- Need for manual architecture review

## Decision

Manual architecture review recommended.

## Consequences

**Benefits:**
- Opportunity to establish architectural patterns
- Clean slate for design decisions

**Tradeoffs:**
- Requires manual effort to document architecture
- May lack standard patterns for maintainability

## Related Patterns

Consider adopting standard patterns as the codebase grows:
- Repository pattern for data access
- Dependency Injection for loose coupling
- Strategy pattern for algorithmic flexibility
- Observer pattern for event handling

## Notes

Generated by AutomatosX SpecKit on ${new Date().toISOString().split('T')[0]}

Run with specific patterns if needed:
\`\`\`bash
ax speckit adr --pattern "Singleton"
\`\`\`
`;
    }
    /**
     * Infer language from file extension
     */
    inferLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const languageMap = {
            'ts': 'typescript',
            'js': 'javascript',
            'tsx': 'typescript',
            'jsx': 'javascript',
            'py': 'python',
            'go': 'go',
            'rs': 'rust',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
        };
        return languageMap[ext] || 'unknown';
    }
    /**
     * Count files by language
     */
    countLanguages(files) {
        const counts = {};
        for (const file of files) {
            counts[file.language] = (counts[file.language] || 0) + 1;
        }
        return counts;
    }
}
//# sourceMappingURL=ADRGenerator.js.map