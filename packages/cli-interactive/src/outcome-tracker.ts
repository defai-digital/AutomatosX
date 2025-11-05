/**
 * Outcome Trackers
 *
 * Lightweight checkpoints for task completion status
 * Phase 3 P1: Track user outcomes instead of just commands
 */

import chalk from 'chalk';

export type OutcomeStatus = 'pending' | 'in_progress' | 'complete' | 'warning' | 'error';

export interface Outcome {
  id: string;
  label: string;
  status: OutcomeStatus;
  message?: string;
  timestamp: Date;
  details?: string[];
  metric?: {
    value: number;
    unit: string;
    threshold?: number;
  };
}

export interface OutcomeTracker {
  sessionId: string;
  outcomes: Outcome[];
}

/**
 * Status icons
 */
const STATUS_ICONS: Record<OutcomeStatus, string> = {
  pending: chalk.dim('⏳'),
  in_progress: chalk.yellow('◉'),
  complete: chalk.green('✓'),
  warning: chalk.yellow('⚠'),
  error: chalk.red('✗')
};

/**
 * Create a new outcome tracker
 */
export function createOutcomeTracker(sessionId: string): OutcomeTracker {
  return {
    sessionId,
    outcomes: []
  };
}

/**
 * Add an outcome to the tracker
 */
export function addOutcome(
  tracker: OutcomeTracker,
  outcome: Omit<Outcome, 'timestamp'>
): OutcomeTracker {
  return {
    ...tracker,
    outcomes: [
      ...tracker.outcomes,
      {
        ...outcome,
        timestamp: new Date()
      }
    ]
  };
}

/**
 * Update an existing outcome
 */
export function updateOutcome(
  tracker: OutcomeTracker,
  id: string,
  updates: Partial<Outcome>
): OutcomeTracker {
  return {
    ...tracker,
    outcomes: tracker.outcomes.map(outcome =>
      outcome.id === id
        ? { ...outcome, ...updates, timestamp: new Date() }
        : outcome
    )
  };
}

/**
 * Render outcome tracker (Claude-style checkpoints)
 */
export function renderOutcomeTracker(tracker: OutcomeTracker, options: {
  showTimestamps?: boolean;
  showDetails?: boolean;
  compact?: boolean;
} = {}): string {
  const {
    showTimestamps = false,
    showDetails = true,
    compact = false
  } = options;

  if (tracker.outcomes.length === 0) {
    return '';
  }

  const lines: string[] = [];

  if (!compact) {
    lines.push('');
    lines.push(chalk.bold.cyan('Task Progress'));
    lines.push('');
  }

  tracker.outcomes.forEach(outcome => {
    const icon = STATUS_ICONS[outcome.status];
    const label = chalk.bold.white(outcome.label);

    // Metric (if present)
    let metricStr = '';
    if (outcome.metric) {
      const { value, unit, threshold } = outcome.metric;
      const valueStr = `${value}${unit}`;

      if (threshold !== undefined) {
        const isGood = value >= threshold;
        metricStr = isGood
          ? chalk.green(` (${valueStr})`)
          : chalk.yellow(` (${valueStr}, target: ${threshold}${unit})`);
      } else {
        metricStr = chalk.dim(` (${valueStr})`);
      }
    }

    // Timestamp
    const timestamp = showTimestamps
      ? chalk.dim(` [${outcome.timestamp.toLocaleTimeString()}]`)
      : '';

    // Main line
    lines.push(`  ${icon} ${label}${metricStr}${timestamp}`);

    // Message
    if (outcome.message) {
      lines.push(`     ${chalk.dim(outcome.message)}`);
    }

    // Details
    if (showDetails && outcome.details && outcome.details.length > 0) {
      outcome.details.forEach(detail => {
        lines.push(`     ${chalk.dim('•')} ${chalk.dim(detail)}`);
      });
    }
  });

  if (!compact) {
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render compact outcome status bar
 */
export function renderOutcomeStatusBar(tracker: OutcomeTracker): string {
  const complete = tracker.outcomes.filter(o => o.status === 'complete').length;
  const warning = tracker.outcomes.filter(o => o.status === 'warning').length;
  const error = tracker.outcomes.filter(o => o.status === 'error').length;
  const total = tracker.outcomes.length;

  const parts: string[] = [];

  if (complete > 0) {
    parts.push(chalk.green(`✓ ${complete}`));
  }

  if (warning > 0) {
    parts.push(chalk.yellow(`⚠ ${warning}`));
  }

  if (error > 0) {
    parts.push(chalk.red(`✗ ${error}`));
  }

  if (parts.length === 0) {
    return chalk.dim(`${total} tasks pending`);
  }

  return parts.join(' ') + chalk.dim(` / ${total}`);
}

/**
 * Common outcome presets for typical developer workflows
 */
export const OUTCOME_PRESETS = {
  tests: {
    id: 'tests',
    label: 'Tests passing',
    status: 'pending' as OutcomeStatus
  },
  build: {
    id: 'build',
    label: 'Build complete',
    status: 'pending' as OutcomeStatus
  },
  lint: {
    id: 'lint',
    label: 'Linting clean',
    status: 'pending' as OutcomeStatus
  },
  coverage: {
    id: 'coverage',
    label: 'Coverage threshold',
    status: 'pending' as OutcomeStatus
  },
  deploy: {
    id: 'deploy',
    label: 'Deployed',
    status: 'pending' as OutcomeStatus
  },
  security: {
    id: 'security',
    label: 'Security audit',
    status: 'pending' as OutcomeStatus
  },
  review: {
    id: 'review',
    label: 'Code reviewed',
    status: 'pending' as OutcomeStatus
  }
};

/**
 * Auto-detect outcomes from command execution
 */
export function detectOutcomeFromCommand(
  command: string,
  output: string,
  exitCode: number
): Partial<Outcome> | null {
  // Test command
  if (command === 'test' || command.includes('jest') || command.includes('vitest')) {
    const testsMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);

    if (exitCode === 0 && testsMatch) {
      const testCount = testsMatch[1] ?? '0';
      return {
        id: 'tests',
        label: 'Tests passing',
        status: 'complete',
        message: `${testCount} tests passed`,
        metric: {
          value: parseInt(testCount),
          unit: ' tests'
        }
      };
    } else if (failedMatch) {
      const failCount = failedMatch[1] ?? '0';
      return {
        id: 'tests',
        label: 'Tests failing',
        status: 'error',
        message: `${failCount} tests failed`
      };
    }
  }

  // Build command
  if (command === 'build' || command.includes('webpack') || command.includes('vite')) {
    if (exitCode === 0) {
      return {
        id: 'build',
        label: 'Build complete',
        status: 'complete',
        message: 'Production build succeeded'
      };
    } else {
      return {
        id: 'build',
        label: 'Build failed',
        status: 'error',
        message: 'Build errors detected'
      };
    }
  }

  // Lint command
  if (command === 'lint' || command.includes('eslint')) {
    const warningsMatch = output.match(/(\d+) warning/);
    const errorsMatch = output.match(/(\d+) error/);

    if (exitCode === 0 && !warningsMatch && !errorsMatch) {
      return {
        id: 'lint',
        label: 'Linting clean',
        status: 'complete',
        message: 'No linting issues'
      };
    } else if (warningsMatch && !errorsMatch) {
      const warnCount = warningsMatch[1] ?? '0';
      return {
        id: 'lint',
        label: 'Linting warnings',
        status: 'warning',
        message: `${warnCount} warnings`,
        metric: {
          value: parseInt(warnCount),
          unit: ' warnings'
        }
      };
    } else if (errorsMatch) {
      const errCount = errorsMatch[1] ?? '0';
      return {
        id: 'lint',
        label: 'Linting errors',
        status: 'error',
        message: `${errCount} errors`
      };
    }
  }

  // Coverage command
  if (command === 'coverage' || output.includes('% Stmts')) {
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);

    if (coverageMatch && coverageMatch[1]) {
      const coverage = parseFloat(coverageMatch[1]);
      const threshold = 80; // Default threshold

      return {
        id: 'coverage',
        label: 'Code coverage',
        status: coverage >= threshold ? 'complete' : 'warning',
        message: coverage >= threshold ? 'Coverage goal met' : 'Below coverage threshold',
        metric: {
          value: coverage,
          unit: '%',
          threshold
        }
      };
    }
  }

  return null;
}

/**
 * Get outcome completion percentage
 */
export function getOutcomeProgress(tracker: OutcomeTracker): {
  percentage: number;
  complete: number;
  total: number;
} {
  const total = tracker.outcomes.length;
  const complete = tracker.outcomes.filter(o => o.status === 'complete').length;
  const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

  return { percentage, complete, total };
}

/**
 * Render progress bar
 */
export function renderProgressBar(tracker: OutcomeTracker, width: number = 30): string {
  const { percentage, complete, total } = getOutcomeProgress(tracker);

  const filled = Math.round((width * percentage) / 100);
  const empty = width - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const label = chalk.white(`${complete}/${total}`);
  const percent = chalk.dim(`${percentage}%`);

  return `${bar} ${label} ${percent}`;
}

/**
 * Suggested next actions based on outcomes
 */
export function suggestNextActions(tracker: OutcomeTracker): string[] {
  const suggestions: string[] = [];

  const hasPendingTests = tracker.outcomes.some(o => o.id === 'tests' && o.status === 'pending');
  const hasCompletedTests = tracker.outcomes.some(o => o.id === 'tests' && o.status === 'complete');
  const hasPendingBuild = tracker.outcomes.some(o => o.id === 'build' && o.status === 'pending');
  const hasCompletedBuild = tracker.outcomes.some(o => o.id === 'build' && o.status === 'complete');

  if (hasPendingTests) {
    suggestions.push('Run tests to verify changes');
  }

  if (hasCompletedTests && hasPendingBuild) {
    suggestions.push('Build project for production');
  }

  if (hasCompletedBuild) {
    suggestions.push('Review changes with git status');
    suggestions.push('Commit and push changes');
  }

  return suggestions;
}

/**
 * Render next action suggestions
 */
export function renderNextActions(tracker: OutcomeTracker): string {
  const suggestions = suggestNextActions(tracker);

  if (suggestions.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold.yellow('💡 Suggested Next Steps'));
  lines.push('');

  suggestions.forEach((suggestion, idx) => {
    lines.push(`  ${chalk.cyan(`${idx + 1}.`)} ${chalk.white(suggestion)}`);
  });

  lines.push('');

  return lines.join('\n');
}
