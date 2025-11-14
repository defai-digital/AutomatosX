/**
 * ADRGenerator - Generate Architectural Decision Records
 * Automatically detects design patterns and architectural decisions in codebase
 */

import { SpecKitGenerator } from './SpecKitGenerator.js';
import { PatternDetector, type DetectedPattern } from './PatternDetector.js';
import type {
  GenerateOptions,
  GenerateResult,
  AnalysisResult,
} from '../types/speckit.types.js';

export interface ADRGenerateOptions extends GenerateOptions {
  pattern?: string; // Specific pattern to document
  includeExamples?: boolean; // Include code examples
  includeRationale?: boolean; // Include decision rationale
  template?: 'standard' | 'y-statement' | 'custom';
}

/**
 * ADRGenerator - Generate Architectural Decision Records
 */
export class ADRGenerator extends SpecKitGenerator<ADRGenerateOptions> {
  protected readonly generatorName = 'ADR';

  /**
   * Analyze project to extract architectural information
   */
  protected async analyze(
    options: ADRGenerateOptions
  ): Promise<AnalysisResult> {
    this.log(options, 'Analyzing codebase for architectural patterns...');

    // Use PatternDetector to find patterns
    const detector = new PatternDetector(this.searchCode.bind(this));

    let patterns: DetectedPattern[];
    if (options.pattern) {
      // Detect specific pattern
      const result = await detector.detect(options.pattern);
      patterns = result ? [result] : [];
    } else {
      // Detect all patterns
      patterns = await detector.detectAll();
    }

    this.log(
      options,
      `Found ${patterns.length} architectural patterns`
    );

    return {
      files: [...new Set(patterns.flatMap((p) => p.files))],
      patterns,
      stats: {
        totalPatterns: patterns.length,
        designPatterns: patterns.filter((p) => p.type === 'design').length,
        architecturalPatterns: patterns.filter((p) => p.type === 'architectural')
          .length,
      },
      dependencies: [],
      architecture: patterns.map((p) => ({
        name: p.name,
        type: p.type,
        files: p.files,
      })),
    };
  }

  /**
   * Detect patterns (already done in analyze, just pass through)
   */
  protected async detect(
    analysis: AnalysisResult,
    options: ADRGenerateOptions
  ): Promise<DetectedPattern[]> {
    return analysis.patterns || [];
  }

  /**
   * Generate ADR content using AI
   */
  protected async generateContent(
    patterns: DetectedPattern[],
    analysis: AnalysisResult,
    options: ADRGenerateOptions
  ): Promise<string> {
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
  private buildADRPrompt(
    patterns: DetectedPattern[],
    analysis: AnalysisResult,
    options: ADRGenerateOptions
  ): string {
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
    } else if (template === 'y-statement') {
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
  private generateEmptyADR(options: ADRGenerateOptions): string {
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
}
