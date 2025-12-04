#!/usr/bin/env node

/**
 * Gemini PR Review Script
 * 
 * This script analyzes pull request diffs using Gemini 3.0 and generates
 * comprehensive code review comments with suggestions and feedback.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

interface PRReviewOptions {
  prNumber: number;
  baseRef: string;
  headRef: string;
  diffFile: string;
  outputFile: string;
}

interface FileChange {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
}

interface ReviewComment {
  file?: string;
  line?: number;
  type: 'suggestion' | 'issue' | 'praise' | 'question';
  severity: 'high' | 'medium' | 'low';
  message: string;
  code?: string;
  suggestion?: string;
}

interface ReviewSummary {
  overall: 'approve' | 'request_changes' | 'comment';
  score: number; // 0-100
  key_findings: string[];
  file_count: number;
  lines_added: number;
  lines_deleted: number;
  comments: ReviewComment[];
}

class GeminiPRReview {
  private options: PRReviewOptions;

  constructor(options: PRReviewOptions) {
    this.options = options;
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      console.log(`🤖 Starting Gemini PR Review for #${this.options.prNumber}`);
      
      // Step 1: Parse the diff
      const fileChanges = await this.parseDiff();
      console.log(`📊 Found ${fileChanges.length} changed files`);
      
      // Step 2: Analyze with Gemini
      const review = await this.analyzeWithGemini(fileChanges);
      console.log(`🔍 Analysis complete: ${review.comments.length} comments generated`);
      
      // Step 3: Format and save review
      await this.saveReview(review);
      console.log(`✅ Review saved to ${this.options.outputFile}`);
      
    } catch (error) {
      console.error('❌ PR Review failed:', error);
      process.exit(1);
    }
  }

  /**
   * Parse the git diff file into structured changes
   */
  private async parseDiff(): Promise<FileChange[]> {
    const diffContent = await readFile(this.options.diffFile, 'utf-8');
    const lines = diffContent.split('\n');
    const fileChanges: FileChange[] = [];
    
    let currentFile: Partial<FileChange> | null = null;
    let currentDiff: string[] = [];
    
    for (const line of lines) {
      // New file header
      if (line.startsWith('diff --git')) {
        if (currentFile && currentFile.file) {
          currentFile.diff = currentDiff.join('\n');
          fileChanges.push(currentFile as FileChange);
        }
        
        const parts = line.split(' ');
        const filePath = parts[2]?.substring(2) || parts[3]?.substring(2);
        
        currentFile = {
          file: filePath,
          status: 'modified',
          additions: 0,
          deletions: 0,
          diff: ''
        };
        currentDiff = [line];
      }
      // File mode change
      else if (line.startsWith('new file mode')) {
        if (currentFile) currentFile.status = 'added';
        currentDiff.push(line);
      }
      else if (line.startsWith('deleted file mode')) {
        if (currentFile) currentFile.status = 'deleted';
        currentDiff.push(line);
      }
      // Index line
      else if (line.startsWith('index')) {
        currentDiff.push(line);
      }
      // File path lines
      else if (line.startsWith('---') || line.startsWith('+++')) {
        currentDiff.push(line);
      }
      // Hunk header
      else if (line.startsWith('@@')) {
        currentDiff.push(line);
      }
      // Diff content
      else {
        currentDiff.push(line);
        
        if (line.startsWith('+') && !line.startsWith('+++')) {
          if (currentFile) currentFile.additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          if (currentFile) currentFile.deletions++;
        }
      }
    }
    
    // Add the last file
    if (currentFile && currentFile.file) {
      currentFile.diff = currentDiff.join('\n');
      fileChanges.push(currentFile as FileChange);
    }
    
    return fileChanges;
  }

  /**
   * Analyze code changes using Gemini 3.0
   */
  private async analyzeWithGemini(fileChanges: FileChange[]): Promise<ReviewSummary> {
    // Create analysis prompt
    const prompt = this.createAnalysisPrompt(fileChanges);
    
    // Write prompt to temporary file
    const promptFile = '/tmp/gemini-pr-review-prompt.md';
    await writeFile(promptFile, prompt);
    
    try {
      // Run Gemini analysis
      const result = execSync(`gemini -f "${promptFile}" --output-format json`, {
        encoding: 'utf-8',
        timeout: 120000 // 2 minutes
      });
      
      // Parse the JSON response
      const analysis = JSON.parse(result);
      
      return this.formatReviewSummary(analysis, fileChanges);
      
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      throw new Error('Failed to analyze code with Gemini');
    }
  }

  /**
   * Create the analysis prompt for Gemini
   */
  private createAnalysisPrompt(fileChanges: FileChange[]): string {
    const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);
    
    return `# AutomatosX Pull Request Analysis

You are an expert code reviewer for the AutomatosX project. Analyze the following pull request changes and provide constructive feedback.

## PR Information
- **PR Number:** ${this.options.prNumber}
- **Base Branch:** ${this.options.baseRef}
- **Head Branch:** ${this.options.headRef}
- **Files Changed:** ${fileChanges.length}
- **Lines Added:** ${totalAdditions}
- **Lines Deleted:** ${totalDeletions}

## Code Changes

${fileChanges.map(change => `
### ${change.file} (${change.status})
\`\`\`diff
${change.diff}
\`\`\`
`).join('\n')}

## Review Guidelines

1. **Code Quality**: Check for best practices, patterns, and maintainability
2. **TypeScript**: Verify type safety, interfaces, and proper typing
3. **Testing**: Ensure adequate test coverage and test quality
4. **Documentation**: Check for missing or outdated documentation
5. **Security**: Look for potential security vulnerabilities
6.
6. **Performance**: Identify potential performance issues
7. **Error Handling**: Check proper error handling and edge cases

## Response Format

Please respond with a JSON object in this exact format:

\`\`\`json
{
  "overall": "approve|request_changes|comment",
  "score": 0-100,
  "key_findings": ["finding1", "finding2", "..."],
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 123,
      "type": "suggestion|issue|praise|question",
      "severity": "high|medium|low",
      "message": "Detailed explanation",
      "code": "relevant code snippet",
      "suggestion": "improvement suggestion (if applicable)"
    }
  ]
}
\`\`\`

## Scoring Guidelines
- **90-100**: Excellent, ready to merge (approve)
- **70-89**: Good with minor suggestions (comment)
- **50-69**: Needs some changes (comment)
- **0-49**: Significant issues (request_changes)

Focus on being constructive and helpful. Provide specific, actionable feedback.
`;
  }

  /**
   * Format Gemini response into ReviewSummary
   */
  private formatReviewSummary(analysis: any, fileChanges: FileChange[]): ReviewSummary {
    const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);

    return {
      overall: analysis.overall || 'comment',
      score: analysis.score || 50,
      key_findings: analysis.key_findings || [],
      file_count: fileChanges.length,
      lines_added: totalAdditions,
      lines_deleted: totalDeletions,
      comments: analysis.comments || []
    };
  }

  /**
   * Save formatted review to markdown file
   */
  private async saveReview(review: ReviewSummary): Promise<void> {
    const markdown = this.formatReviewMarkdown(review);
    await writeFile(this.options.outputFile, markdown, 'utf-8');
  }

  /**
   * Format review as GitHub-flavored markdown
   */
  private formatReviewMarkdown(review: ReviewSummary): string {
    const overallEmoji = {
      approve: '✅',
      request_changes: '🔄',
      comment: '💬'
    };

    const severityEmoji = {
      high: '🚨',
      medium: '⚠️',
      low: 'ℹ️'
    };

    const typeEmoji = {
      suggestion: '💡',
      issue: '🐛',
      praise: '👏',
      question: '❓'
    };

    let markdown = `## 🤖 Gemini Code Review

**Overall:** ${overallEmoji[review.overall]} ${review.overall.toUpperCase()}  
**Score:** ${review.score}/100  
**Files Changed:** ${review.file_count}  
**Lines:** +${review.lines_added} -${review.lines_deleted}

`;

    // Key findings
    if (review.key_findings.length > 0) {
      markdown += `### 🔍 Key Findings

${review.key_findings.map(finding => `- ${finding}`).join('\n')}

`;
    }

    // Comments by file
    const commentsByFile = review.comments.reduce((acc, comment) => {
      const file = comment.file || 'General';
      if (!acc[file]) acc[file] = [];
      acc[file].push(comment);
      return acc;
    }, {} as Record<string, ReviewComment[]>);

    for (const [file, comments] of Object.entries(commentsByFile)) {
      markdown += `### ${file}

`;

      for (const comment of comments) {
        markdown += `${severityEmoji[comment.severity]} ${typeEmoji[comment.type]} **${comment.severity.toUpperCase()}**\n\n`;
        markdown += `${comment.message}\n\n`;

        if (comment.code) {
          markdown += `\`\`\`typescript\n${comment.code}\n\`\`\`\n\n`;
        }

        if (comment.suggestion) {
          markdown += `**Suggestion:** ${comment.suggestion}\n\n`;
        }

        if (comment.line) {
          markdown += `*Line ${comment.line}*\n\n`;
        }

        markdown += '---\n\n';
      }
    }

    // Summary
    markdown += `### 📊 Summary

This review was generated by Gemini 3.0 based on automated analysis of the code changes. Please review the suggestions and address any high-priority issues.

${review.overall === 'approve' ? '✅ This PR appears ready for merge!' : 
  review.overall === 'request_changes' ? '🔄 This PR requires changes before merging.' : 
  '💬 This PR has suggestions for improvement.'}

---

*Generated by AutomatosX Gemini PR Review*`;

    return markdown;
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options: Partial<PRReviewOptions> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--pr-number':
        options.prNumber = parseInt(value);
        break;
      case '--base-ref':
        options.baseRef = value;
        break;
      case '--head-ref':
        options.headRef = value;
        break;
      case '--diff-file':
        options.diffFile = value;
        break;
      case '--output':
        options.outputFile = value;
        break;
      case '--help':
        console.log(`
Gemini PR Review Script

Usage: gemini-pr-review.ts [options]

Options:
  --pr-number <number>     Pull request number
  --base-ref <branch>       Base branch name
  --head-ref <branch>       Head branch name  
  --diff-file <path>        Path to diff file
  --output <path>           Output file for review
  --help                    Show this help

Example:
  gemini-pr-review.ts \\
    --pr-number 123 \\
    --base-ref main \\
    --head-ref feature-branch \\
    --diff-file pr.diff \\
    --output review-comment.md
        `);
        process.exit(0);
    }
  }

  // Validate required options
  const required = ['prNumber', 'baseRef', 'headRef', 'diffFile', 'outputFile'];
  const missing = required.filter(key => !(key in options));
  
  if (missing.length > 0) {
    console.error('Missing required options:', missing.join(', '));
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Run review
  const reviewer = new GeminiPRReview(options as PRReviewOptions);
  await reviewer.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { GeminiPRReview, type PRReviewOptions, type ReviewSummary };
