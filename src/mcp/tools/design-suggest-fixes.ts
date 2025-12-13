/**
 * MCP Tool: design_suggest_fixes
 *
 * Generates fix patches for design violations without modifying files.
 * Returns patches in unified diff format for review before applying.
 *
 * @since v12.9.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import {
  runDesignCheck,
  loadConfig,
  applyFixes,
  readFileSafe,
} from '@defai.digital/ax-core/design-check';
import type { Violation } from '@defai.digital/ax-core/design-check';

export interface DesignSuggestFixesInput {
  /** File path to generate fixes for */
  file: string;
  /** Specific violations to fix (from design_check). If not provided, detects all. */
  violations?: Array<{
    rule: string;
    line: number;
    column: number;
    found: string;
  }>;
  /** Custom config file path */
  configPath?: string;
}

export interface DesignSuggestFixesOutput {
  /** Whether fix generation succeeded */
  success: boolean;
  /** File that was analyzed */
  file: string;
  /** Individual patches */
  patches: Array<{
    line: number;
    column: number;
    rule: string;
    original: string;
    replacement: string;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
  }>;
  /** Unified diff format */
  unifiedDiff: string;
  /** Count of fixes that would be applied */
  wouldFix: number;
  /** Count of violations that cannot be auto-fixed */
  cannotFix: number;
  /** Reasons for unfixable violations */
  cannotFixReasons?: string[];
}

export function createDesignSuggestFixesHandler(): ToolHandler<
  DesignSuggestFixesInput,
  DesignSuggestFixesOutput
> {
  return async (input: DesignSuggestFixesInput): Promise<DesignSuggestFixesOutput> => {
    logger.info('[MCP] design_suggest_fixes called', { file: input.file });

    try {
      // Validate file path
      if (!input.file) {
        throw new Error('file parameter is required');
      }

      // Load config
      const config = await loadConfig(input.configPath);

      // Read file content
      const fileContent = await readFileSafe(input.file);
      if (!fileContent) {
        throw new Error(`Cannot read file: ${input.file}`);
      }

      // Get violations - either from input or by scanning
      let violations: Violation[];

      if (input.violations && input.violations.length > 0) {
        // Use provided violations, reconstructing full Violation objects
        const result = await runDesignCheck([input.file], {
          format: 'json',
          quiet: false,
          fix: false,
          noColor: true,
          maxWarnings: -1,
          ignorePatterns: [],
        });

        // Match provided violations with detected ones
        violations = result.results[0]?.violations.filter((v) =>
          input.violations!.some(
            (iv) => iv.rule === v.rule && iv.line === v.line && iv.found === v.found
          )
        ) || [];
      } else {
        // Detect all violations
        const result = await runDesignCheck([input.file], {
          format: 'json',
          quiet: false,
          fix: false,
          noColor: true,
          maxWarnings: -1,
          ignorePatterns: [],
        });

        violations = result.results[0]?.violations || [];
      }

      // Filter to fixable violations only
      const fixableViolations = violations.filter((v) => v.fixable);
      const unfixableViolations = violations.filter((v) => !v.fixable);

      // Apply fixes in dry-run mode to see what would change
      const fixResult = applyFixes(fileContent, fixableViolations, config, {
        backup: false,
        dryRun: true,
      });

      // Generate patches from fix result (only include fixes with replacements)
      const patches = fixResult.fixes
        .filter((f) => f.applied && f.replacement !== undefined)
        .map((f) => ({
          line: f.violation.line,
          column: f.violation.column,
          rule: f.violation.rule,
          original: f.violation.found,
          replacement: f.replacement!,
          confidence: getConfidence(f.violation),
          reason: f.violation.suggestion,
        }));

      // Generate unified diff
      const unifiedDiff = generateUnifiedDiff(
        input.file,
        fileContent.content,
        fixResult.fixedContent
      );

      // Collect reasons for unfixable violations
      const cannotFixReasons = [
        ...unfixableViolations.map((v) => `${v.rule} at line ${v.line}: Not auto-fixable`),
        ...fixResult.fixes
          .filter((f) => !f.applied)
          .map((f) => `${f.violation.rule} at line ${f.violation.line}: ${f.error || 'No matching token'}`),
      ];

      const output: DesignSuggestFixesOutput = {
        success: true,
        file: input.file,
        patches,
        unifiedDiff,
        wouldFix: patches.length,
        cannotFix: unfixableViolations.length + fixResult.skippedCount,
        cannotFixReasons: cannotFixReasons.length > 0 ? cannotFixReasons : undefined,
      };

      logger.info('[MCP] design_suggest_fixes completed', {
        file: input.file,
        wouldFix: output.wouldFix,
        cannotFix: output.cannotFix,
      });

      return output;
    } catch (error) {
      logger.error('[MCP] design_suggest_fixes failed', { error });
      throw new Error(`Failed to suggest fixes: ${(error as Error).message}`);
    }
  };
}

/**
 * Determine confidence level for a fix
 */
function getConfidence(violation: Violation): 'high' | 'medium' | 'low' {
  // Exact token matches are high confidence
  if (violation.rule === 'no-hardcoded-colors' && violation.suggestion) {
    return 'high';
  }

  // Spacing within tolerance is medium confidence
  if (violation.rule === 'no-raw-spacing') {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate unified diff format
 */
function generateUnifiedDiff(filePath: string, original: string, modified: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const lines: string[] = [];
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  let inHunk = false;
  let hunkStart = -1;
  let hunkLines: string[] = [];

  for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];

    if (origLine !== modLine) {
      if (!inHunk) {
        inHunk = true;
        hunkStart = Math.max(0, i - 2);
        // Add context before
        for (let j = hunkStart; j < i; j++) {
          if (originalLines[j] !== undefined) {
            hunkLines.push(` ${originalLines[j]}`);
          }
        }
      }

      if (origLine !== undefined) {
        hunkLines.push(`-${origLine}`);
      }
      if (modLine !== undefined) {
        hunkLines.push(`+${modLine}`);
      }
    } else if (inHunk) {
      // Add context after change
      hunkLines.push(` ${origLine}`);
      if (hunkLines.filter((l) => l.startsWith(' ')).length >= 3) {
        // End hunk
        const hunkEnd = i + 1;
        lines.push(`@@ -${hunkStart + 1},${hunkEnd - hunkStart} +${hunkStart + 1},${hunkEnd - hunkStart} @@`);
        lines.push(...hunkLines);
        inHunk = false;
        hunkLines = [];
      }
    }
  }

  // Flush remaining hunk
  if (hunkLines.length > 0) {
    const hunkEnd = originalLines.length;
    lines.push(`@@ -${hunkStart + 1},${hunkEnd - hunkStart} +${hunkStart + 1},${hunkEnd - hunkStart} @@`);
    lines.push(...hunkLines);
  }

  return lines.join('\n');
}

/** JSON Schema for design_suggest_fixes tool */
export const designSuggestFixesSchema = {
  name: 'design_suggest_fixes',
  description: `Preview fix patches for design violations WITHOUT modifying files.

**Safe**: This tool only reads files and generates patches - no changes are made.

**Workflow**:
1. Run design_check to find violations
2. Run design_suggest_fixes to preview patches
3. Review the unified diff
4. Run design_apply_fixes to apply approved patches

**Fixable rules**:
- no-hardcoded-colors: Replaces with exact token matches
- no-raw-spacing: Replaces values within 4px of tokens`,
  inputSchema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        description: 'File path to generate fixes for',
      },
      violations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['rule', 'line', 'found'],
          properties: {
            rule: { type: 'string' },
            line: { type: 'integer' },
            column: { type: 'integer' },
            found: { type: 'string' },
          },
        },
        description: 'Specific violations to fix (from design_check). If omitted, detects all.',
      },
      configPath: {
        type: 'string',
        description: 'Custom config file path',
      },
    },
  },
};
