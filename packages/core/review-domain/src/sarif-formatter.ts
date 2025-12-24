/**
 * SARIF Formatter
 *
 * Formats review results as SARIF 2.1.0 output.
 * INV-REV-OUT-003: SARIF output MUST comply with SARIF 2.1.0 schema.
 */

import {
  type ReviewResult,
  type SarifOutput,
  type SarifRule,
  type SarifResult,
  sortCommentsBySeverity,
} from '@automatosx/contracts';

/**
 * SARIF schema URL
 */
const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

/**
 * SARIF version
 */
const SARIF_VERSION = '2.1.0';

/**
 * Map review severity to SARIF level
 */
function mapSeverityToLevel(
  severity: 'critical' | 'warning' | 'suggestion' | 'note'
): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'suggestion':
    case 'note':
      return 'note';
  }
}

/**
 * Generate rule ID from category
 */
function categoryToRuleId(category: string): string {
  return category.replace(/\//g, '-');
}

/**
 * Format review result as SARIF
 * INV-REV-OUT-003: SARIF Compliance
 */
export function formatReviewAsSarif(result: ReviewResult): SarifOutput {
  // Sort comments by severity (INV-REV-OUT-001)
  const sortedComments = sortCommentsBySeverity(result.comments);

  // Collect unique rules
  const rulesMap = new Map<string, SarifRule>();
  for (const comment of sortedComments) {
    const ruleId = categoryToRuleId(comment.category);
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        name: comment.category,
        shortDescription: {
          text: `${comment.category} issue`,
        },
        defaultConfiguration: {
          level: mapSeverityToLevel(comment.severity),
        },
      });
    }
  }

  // Build results
  const sarifResults: SarifResult[] = sortedComments.map((comment) => {
    const sarifResult: SarifResult = {
      ruleId: categoryToRuleId(comment.category),
      level: mapSeverityToLevel(comment.severity),
      message: {
        text: `${comment.title}\n\n${comment.body}${comment.rationale ? `\n\nWhy: ${comment.rationale}` : ''}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: comment.file,
            },
            region: {
              startLine: comment.line,
              endLine: comment.lineEnd,
            },
          },
        },
      ],
    };

    // Add fix suggestion if present
    if (comment.suggestion) {
      sarifResult.fixes = [
        {
          description: {
            text: comment.suggestion,
          },
        },
      ];
    }

    return sarifResult;
  });

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'ax-review',
            version: '1.0.0',
            informationUri: 'https://github.com/automatosx/ax',
            rules: Array.from(rulesMap.values()),
          },
        },
        results: sarifResults,
      },
    ],
  };
}

/**
 * Convert SARIF output to JSON string
 */
export function formatSarifAsJson(sarif: SarifOutput): string {
  return JSON.stringify(sarif, null, 2);
}

/**
 * Create an empty SARIF report (no issues found)
 */
export function createEmptySarifReport(): SarifOutput {
  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'ax-review',
            version: '1.0.0',
            informationUri: 'https://github.com/automatosx/ax',
          },
        },
        results: [],
      },
    ],
  };
}
