/**
 * Memory Search Suggestions
 *
 * Proactively suggests relevant memory searches based on context
 * to help users leverage past conversations and decisions.
 *
 * Phase 5 P2: Memory visibility and suggestions
 */

import chalk from 'chalk';

export interface MemorySearchResult {
  id: string;
  content: string;
  context: string;
  relevance: number;
  timestamp: Date;
  tags?: string[];
}

export interface MemorySuggestion {
  query: string;
  reason: string;
  estimatedResults: number;
  relevance: 'high' | 'medium' | 'low';
}

/**
 * Generate memory search suggestions based on context
 */
export function generateMemorySuggestions(context: {
  currentTask?: string;
  recentCommands?: string[];
  activeAgents?: string[];
  keywords?: string[];
}): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  // Suggest based on current task
  if (context.currentTask) {
    const taskKeywords = extractKeywords(context.currentTask);

    if (taskKeywords.length > 0) {
      suggestions.push({
        query: taskKeywords.join(' '),
        reason: `Related to current task: "${context.currentTask}"`,
        estimatedResults: 5,
        relevance: 'high'
      });
    }
  }

  // Suggest based on recent commands
  if (context.recentCommands && context.recentCommands.length > 0) {
    const commandTypes = [...new Set(context.recentCommands)];

    commandTypes.forEach(cmd => {
      suggestions.push({
        query: cmd,
        reason: `Previous work with "${cmd}"`,
        estimatedResults: 3,
        relevance: 'medium'
      });
    });
  }

  // Suggest based on active agents
  if (context.activeAgents && context.activeAgents.length > 0) {
    context.activeAgents.forEach(agent => {
      suggestions.push({
        query: `agent:${agent}`,
        reason: `Past ${agent} agent decisions`,
        estimatedResults: 4,
        relevance: 'high'
      });
    });
  }

  // Suggest based on keywords
  if (context.keywords && context.keywords.length > 0) {
    context.keywords.forEach(keyword => {
      suggestions.push({
        query: keyword,
        reason: `Related discussions about "${keyword}"`,
        estimatedResults: 2,
        relevance: 'low'
      });
    });
  }

  // Common patterns
  const commonSuggestions: MemorySuggestion[] = [
    {
      query: 'error',
      reason: 'Past error resolutions',
      estimatedResults: 5,
      relevance: 'medium'
    },
    {
      query: 'implementation',
      reason: 'Implementation examples',
      estimatedResults: 3,
      relevance: 'medium'
    },
    {
      query: 'design decision',
      reason: 'Architecture decisions',
      estimatedResults: 4,
      relevance: 'low'
    }
  ];

  suggestions.push(...commonSuggestions);

  // Deduplicate and limit
  return deduplicateSuggestions(suggestions).slice(0, 5);
}

/**
 * Render memory suggestions
 */
export function renderMemorySuggestions(suggestions: MemorySuggestion[]): string {
  if (suggestions.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.magenta('💡 Memory Suggestions'));
  lines.push(chalk.dim('Past conversations that might help:'));
  lines.push('');

  suggestions.forEach((suggestion, idx) => {
    const relevanceIcon = getRelevanceIcon(suggestion.relevance);
    const query = chalk.cyan(`/memory search "${suggestion.query}"`);
    const reason = chalk.dim(suggestion.reason);
    const count = chalk.dim(`(~${suggestion.estimatedResults} results)`);

    lines.push(`  ${idx + 1}. ${relevanceIcon} ${query}`);
    lines.push(`     ${reason} ${count}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Render memory search results
 */
export function renderMemorySearchResults(
  query: string,
  results: MemorySearchResult[],
  options: { compact?: boolean; maxResults?: number } = {}
): string {
  const { compact = false, maxResults = 10 } = options;

  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan(`Memory Search: "${query}"`));
  lines.push('');

  if (results.length === 0) {
    lines.push(chalk.dim('No results found'));
    lines.push('');
    return lines.join('\n');
  }

  const limited = results.slice(0, maxResults);

  limited.forEach((result, idx) => {
    const relevanceBar = renderRelevanceBar(result.relevance);
    const timestamp = formatRelativeTime(result.timestamp);

    lines.push(`${idx + 1}. ${relevanceBar} ${chalk.dim(timestamp)}`);

    if (compact) {
      // Show only first line of content
      const preview = result.content.split('\n')[0].substring(0, 80);
      lines.push(`   ${chalk.white(preview)}${result.content.length > 80 ? '...' : ''}`);
    } else {
      // Show full context and content
      lines.push(`   ${chalk.yellow('Context:')} ${chalk.dim(result.context)}`);

      const contentLines = result.content.split('\n').slice(0, 3);
      contentLines.forEach(line => {
        lines.push(`   ${chalk.white(line)}`);
      });

      if (result.content.split('\n').length > 3) {
        lines.push(`   ${chalk.dim('... (truncated)')}`);
      }

      if (result.tags && result.tags.length > 0) {
        const tags = result.tags.map(t => chalk.blue(`#${t}`)).join(' ');
        lines.push(`   ${tags}`);
      }
    }

    lines.push('');
  });

  if (results.length > maxResults) {
    lines.push(chalk.dim(`... and ${results.length - maxResults} more results`));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render inline memory hint
 */
export function renderInlineMemoryHint(suggestion: MemorySuggestion): string {
  const icon = getRelevanceIcon(suggestion.relevance);
  return chalk.dim(`${icon} Tip: Try `) + chalk.cyan(`/memory search "${suggestion.query}"`) + chalk.dim(` - ${suggestion.reason}`);
}

/**
 * Render memory statistics
 */
export function renderMemoryStatistics(stats: {
  totalEntries: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  topTags?: Array<{ tag: string; count: number }>;
}): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Memory Statistics'));
  lines.push('');

  lines.push(`  ${chalk.dim('Total entries:')} ${chalk.white(stats.totalEntries.toString())}`);
  lines.push(`  ${chalk.dim('Total size:')} ${chalk.white(formatBytes(stats.totalSize))}`);

  if (stats.oldestEntry) {
    lines.push(`  ${chalk.dim('Oldest entry:')} ${chalk.white(stats.oldestEntry.toLocaleDateString())}`);
  }

  if (stats.newestEntry) {
    lines.push(`  ${chalk.dim('Newest entry:')} ${chalk.white(stats.newestEntry.toLocaleDateString())}`);
  }

  if (stats.topTags && stats.topTags.length > 0) {
    lines.push('');
    lines.push(chalk.bold.white('Top Tags:'));
    stats.topTags.slice(0, 5).forEach(tag => {
      lines.push(`  ${chalk.blue(`#${tag.tag}`)} ${chalk.dim(`(${tag.count})`)}`);
    });
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Auto-suggest memory search during command execution
 */
export function shouldSuggestMemorySearch(command: string, context: { errorOccurred?: boolean; similarPastCommand?: boolean }): MemorySuggestion | null {
  // Suggest on errors
  if (context.errorOccurred) {
    return {
      query: `${command} error`,
      reason: 'Past error resolutions for this command',
      estimatedResults: 3,
      relevance: 'high'
    };
  }

  // Suggest if similar command was run before
  if (context.similarPastCommand) {
    return {
      query: command,
      reason: 'Previous usage of this command',
      estimatedResults: 2,
      relevance: 'medium'
    };
  }

  // Suggest for complex commands
  if (command.includes('&&') || command.includes('|')) {
    return {
      query: 'pipeline',
      reason: 'Complex command patterns',
      estimatedResults: 2,
      relevance: 'low'
    };
  }

  return null;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Return unique keywords
  return [...new Set(words)].slice(0, 3);
}

/**
 * Deduplicate suggestions
 */
function deduplicateSuggestions(suggestions: MemorySuggestion[]): MemorySuggestion[] {
  const seen = new Set<string>();
  const unique: MemorySuggestion[] = [];

  suggestions.forEach(s => {
    if (!seen.has(s.query)) {
      seen.add(s.query);
      unique.push(s);
    }
  });

  // Sort by relevance
  unique.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.relevance] - order[a.relevance];
  });

  return unique;
}

/**
 * Get relevance icon
 */
function getRelevanceIcon(relevance: MemorySuggestion['relevance']): string {
  const icons = {
    high: chalk.green('●●●'),
    medium: chalk.yellow('●●○'),
    low: chalk.dim('●○○')
  };
  return icons[relevance];
}

/**
 * Render relevance bar
 */
function renderRelevanceBar(relevance: number): string {
  const percentage = Math.round(relevance * 100);
  const filled = Math.round((relevance * 10));
  const empty = 10 - filled;

  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(` ${percentage}%`);
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Create memory suggestion prompt
 */
export function createMemorySuggestionPrompt(suggestions: MemorySuggestion[]): string {
  if (suggestions.length === 0) return '';

  const topSuggestion = suggestions[0];
  return renderInlineMemoryHint(topSuggestion);
}
