/**
 * MCP Tool: design_rules
 *
 * Lists available design check rules with descriptions and configuration.
 *
 * @since v12.9.0
 */

import type { ToolHandler } from '../types.js';
import { logger } from '../../shared/logging/logger.js';
import { getAvailableRules, loadConfig } from '@defai.digital/ax-core/design-check';

export interface DesignRulesInput {
  /** Custom config file path to check rule settings */
  configPath?: string;
  /** Filter rules by substring */
  filter?: string;
}

export interface DesignRulesOutput {
  /** Available rules */
  rules: Array<{
    id: string;
    description: string;
    defaultSeverity: 'error' | 'warning';
    currentSeverity: 'error' | 'warn' | 'off';
    fixable: boolean;
    category: 'colors' | 'spacing' | 'accessibility' | 'style';
    examples: {
      bad: string;
      good: string;
    };
  }>;
  /** Total rule count */
  total: number;
}

/** Rule metadata (not exported from ax-core, defined here) */
const RULE_METADATA: Record<
  string,
  {
    description: string;
    defaultSeverity: 'error' | 'warning';
    fixable: boolean;
    category: 'colors' | 'spacing' | 'accessibility' | 'style';
    examples: { bad: string; good: string };
  }
> = {
  'no-hardcoded-colors': {
    description: 'Detects hardcoded color values (hex, RGB, HSL) that should use design tokens',
    defaultSeverity: 'error',
    fixable: true,
    category: 'colors',
    examples: {
      bad: "color: '#ff0000'",
      good: 'color: theme.colors.error',
    },
  },
  'no-raw-spacing': {
    description: 'Detects raw pixel values for spacing that should use design tokens',
    defaultSeverity: 'warning',
    fixable: true,
    category: 'spacing',
    examples: {
      bad: "padding: '15px'",
      good: 'padding: theme.spacing.md',
    },
  },
  'no-inline-styles': {
    description: 'Detects inline style props in JSX that should use CSS classes or styled components',
    defaultSeverity: 'warning',
    fixable: false,
    category: 'style',
    examples: {
      bad: "<div style={{ color: 'red' }}>",
      good: "<div className='error-text'>",
    },
  },
  'missing-alt-text': {
    description: 'Detects images without alt attributes for accessibility',
    defaultSeverity: 'error',
    fixable: false,
    category: 'accessibility',
    examples: {
      bad: '<img src="/logo.png" />',
      good: '<img src="/logo.png" alt="Company Logo" />',
    },
  },
  'missing-form-labels': {
    description: 'Detects form inputs without proper labels for accessibility',
    defaultSeverity: 'error',
    fixable: false,
    category: 'accessibility',
    examples: {
      bad: '<input type="text" />',
      good: '<input type="text" aria-label="Username" />',
    },
  },
};

export function createDesignRulesHandler(): ToolHandler<DesignRulesInput, DesignRulesOutput> {
  return async (input: DesignRulesInput): Promise<DesignRulesOutput> => {
    logger.info('[MCP] design_rules called', { configPath: input.configPath, filter: input.filter });

    try {
      // Get available rule IDs from ax-core
      const ruleIds = getAvailableRules();

      // Load config to get current severity settings
      const config = await loadConfig(input.configPath);

      // Build rules array with metadata
      let rules = ruleIds.map((id) => {
        const metadata = RULE_METADATA[id] || {
          description: `Design check rule: ${id}`,
          defaultSeverity: 'warning' as const,
          fixable: false,
          category: 'style' as const,
          examples: { bad: '', good: '' },
        };

        const currentSeverity = config.rules[id] || 'off';

        return {
          id,
          description: metadata.description,
          defaultSeverity: metadata.defaultSeverity,
          currentSeverity: currentSeverity as 'error' | 'warn' | 'off',
          fixable: metadata.fixable,
          category: metadata.category,
          examples: metadata.examples,
        };
      });

      // Apply filter if provided
      if (input.filter) {
        const filterLower = input.filter.toLowerCase();
        rules = rules.filter(
          (r) =>
            r.id.toLowerCase().includes(filterLower) ||
            r.description.toLowerCase().includes(filterLower) ||
            r.category.toLowerCase().includes(filterLower)
        );
      }

      logger.info('[MCP] design_rules completed', { total: rules.length });

      return {
        rules,
        total: rules.length,
      };
    } catch (error) {
      logger.error('[MCP] design_rules failed', { error });
      throw new Error(`Failed to list design rules: ${(error as Error).message}`);
    }
  };
}

/** JSON Schema for design_rules tool */
export const designRulesSchema = {
  name: 'design_rules',
  description: `List available design check rules with descriptions, severity settings, and examples.

**Rules available**:
- no-hardcoded-colors: Detect hardcoded colors
- no-raw-spacing: Detect raw pixel spacing
- no-inline-styles: Detect inline style props
- missing-alt-text: Detect images without alt
- missing-form-labels: Detect form inputs without labels

Use this to understand what design_check can detect.`,
  inputSchema: {
    type: 'object',
    properties: {
      configPath: {
        type: 'string',
        description: 'Config file path to check current rule settings',
      },
      filter: {
        type: 'string',
        description: 'Filter rules by substring (matches id, description, or category)',
      },
    },
  },
};
