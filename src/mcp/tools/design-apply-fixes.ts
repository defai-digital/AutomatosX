/**
 * MCP Tool: design_apply_fixes
 *
 * Applies approved fix patches to files and optionally verifies results.
 * Creates backup files before modification.
 *
 * @since v12.9.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { sendMcpProgress, sendMcpProgressBegin, sendMcpProgressEnd } from '../streaming-notifier.js';
import {
  runDesignCheck,
  loadConfig,
  applyFixes,
  writeFixedFile,
  readFileSafe,
  createBackup,
} from '@defai.digital/ax-core/design-check';

export interface DesignApplyFixesInput {
  /** File path to fix */
  file: string;
  /** Specific rules to fix (if omitted, fixes all fixable violations) */
  rules?: string[];
  /** Create backup file before fixing (default: true) */
  createBackup?: boolean;
  /** Re-run design check after fixing to verify (default: true) */
  verify?: boolean;
  /** Custom config file path */
  configPath?: string;
}

export interface DesignApplyFixesOutput {
  /** Whether fixes were applied successfully */
  success: boolean;
  /** File that was modified */
  file: string;
  /** Backup file path (if created) */
  backupPath?: string;
  /** Number of fixes applied */
  applied: number;
  /** Number of fixes that failed */
  failed: number;
  /** Reasons for failed fixes */
  failedReasons?: string[];
  /** Verification results (if verify=true) */
  verification?: {
    beforeErrors: number;
    beforeWarnings: number;
    afterErrors: number;
    afterWarnings: number;
    fixed: number;
  };
}

export function createDesignApplyFixesHandler(): ToolHandler<
  DesignApplyFixesInput,
  DesignApplyFixesOutput
> {
  return async (input: DesignApplyFixesInput): Promise<DesignApplyFixesOutput> => {
    logger.info('[MCP] design_apply_fixes called', {
      file: input.file,
      rules: input.rules,
      createBackup: input.createBackup,
    });

    const progressToken = sendMcpProgressBegin('Apply Fixes', 'Applying design fixes...');

    try {
      // Validate file path
      if (!input.file) {
        throw new Error('file parameter is required');
      }

      const shouldBackup = input.createBackup !== false;
      const shouldVerify = input.verify !== false;

      // Load config
      sendMcpProgress('Loading configuration...', progressToken);
      const config = await loadConfig(input.configPath);

      // Read file content
      const fileContent = await readFileSafe(input.file);
      if (!fileContent) {
        throw new Error(`Cannot read file: ${input.file}`);
      }

      // Get violations before fixing
      sendMcpProgress('Scanning for violations...', progressToken);
      const beforeResult = await runDesignCheck([input.file], {
        format: 'json',
        quiet: false,
        fix: false,
        noColor: true,
        maxWarnings: -1,
        ignorePatterns: [],
      });

      const beforeViolations = beforeResult.results[0]?.violations || [];
      const beforeErrors = beforeViolations.filter((v) => v.severity === 'error').length;
      const beforeWarnings = beforeViolations.filter((v) => v.severity === 'warning').length;

      // Filter violations by rules if specified
      let violationsToFix = beforeViolations.filter((v) => v.fixable);
      if (input.rules && input.rules.length > 0) {
        violationsToFix = violationsToFix.filter((v) => input.rules!.includes(v.rule));
      }

      if (violationsToFix.length === 0) {
        sendMcpProgressEnd(progressToken, 'No fixable violations found');
        return {
          success: true,
          file: input.file,
          applied: 0,
          failed: 0,
          verification: shouldVerify
            ? {
                beforeErrors,
                beforeWarnings,
                afterErrors: beforeErrors,
                afterWarnings: beforeWarnings,
                fixed: 0,
              }
            : undefined,
        };
      }

      // Create backup if requested
      let backupPath: string | undefined;
      if (shouldBackup) {
        sendMcpProgress('Creating backup...', progressToken);
        backupPath = createBackup(input.file);
      }

      // Apply fixes
      sendMcpProgress(`Applying ${violationsToFix.length} fixes...`, progressToken);
      const fixResult = applyFixes(fileContent, violationsToFix, config, {
        backup: false, // We already handled backup
        dryRun: false,
      });

      // Write fixed content
      const writeResult = writeFixedFile(fixResult, {
        backup: false,
        dryRun: false,
      });

      if (!writeResult.success) {
        throw new Error(`Failed to write file: ${writeResult.error}`);
      }

      // Collect failed fix reasons
      const failedReasons = fixResult.fixes
        .filter((f) => !f.applied)
        .map((f) => `${f.violation.rule} at line ${f.violation.line}: ${f.error || 'Unknown reason'}`);

      // Verify results if requested
      let verification: DesignApplyFixesOutput['verification'];
      if (shouldVerify) {
        sendMcpProgress('Verifying results...', progressToken);
        const afterResult = await runDesignCheck([input.file], {
          format: 'json',
          quiet: false,
          fix: false,
          noColor: true,
          maxWarnings: -1,
          ignorePatterns: [],
        });

        const afterViolations = afterResult.results[0]?.violations || [];
        const afterErrors = afterViolations.filter((v) => v.severity === 'error').length;
        const afterWarnings = afterViolations.filter((v) => v.severity === 'warning').length;

        verification = {
          beforeErrors,
          beforeWarnings,
          afterErrors,
          afterWarnings,
          fixed: beforeErrors + beforeWarnings - (afterErrors + afterWarnings),
        };
      }

      const output: DesignApplyFixesOutput = {
        success: true,
        file: input.file,
        backupPath,
        applied: fixResult.appliedCount,
        failed: fixResult.skippedCount,
        failedReasons: failedReasons.length > 0 ? failedReasons : undefined,
        verification,
      };

      logger.info('[MCP] design_apply_fixes completed', {
        file: input.file,
        applied: output.applied,
        failed: output.failed,
      });

      sendMcpProgressEnd(
        progressToken,
        `Applied ${output.applied} fixes${output.failed > 0 ? `, ${output.failed} skipped` : ''}`
      );

      return output;
    } catch (error) {
      logger.error('[MCP] design_apply_fixes failed', { error });
      sendMcpProgressEnd(progressToken, `Error: ${(error as Error).message}`);
      throw new Error(`Failed to apply fixes: ${(error as Error).message}`);
    }
  };
}

/** JSON Schema for design_apply_fixes tool */
export const designApplyFixesSchema = {
  name: 'design_apply_fixes',
  description: `Apply design system fixes to a file.

**Safety features**:
- Creates backup file (.ax-backup) before modification
- Re-verifies after fixing to confirm improvements
- Reports which fixes were skipped and why

**Workflow**:
1. First run design_suggest_fixes to preview changes
2. Review the patches
3. Run design_apply_fixes to apply

**Restore from backup**:
\`mv file.tsx.ax-backup file.tsx\``,
  inputSchema: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        description: 'File path to fix',
      },
      rules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific rules to fix (e.g., ["no-raw-spacing"]). If omitted, fixes all.',
      },
      createBackup: {
        type: 'boolean',
        description: 'Create backup file before fixing (default: true)',
      },
      verify: {
        type: 'boolean',
        description: 'Re-run design check after fixing to verify improvements (default: true)',
      },
      configPath: {
        type: 'string',
        description: 'Custom config file path',
      },
    },
  },
};
