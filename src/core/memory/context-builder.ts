/**
 * Memory Context Builder - Formats memory search results for LLM prompts
 *
 * v9.0.2: Extracted from duplicated code across multiple files
 *
 * Provides consistent formatting for memory context injection into prompts.
 */

export interface MemorySearchResult {
  id: number;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
  agent?: string;
  createdAt?: string;
}

export interface MemoryFormatOptions {
  includeScore?: boolean;
  includeMetadata?: boolean;
  includeAgent?: boolean;
  includeTimestamp?: boolean;
  maxResults?: number;
  scoreThreshold?: number;
}

const DEFAULT_OPTIONS: Required<MemoryFormatOptions> = {
  includeScore: true,
  includeMetadata: false,
  includeAgent: false,
  includeTimestamp: false,
  maxResults: Number.MAX_SAFE_INTEGER,
  scoreThreshold: 0
};

/**
 * Memory Context Builder
 *
 * Formats memory search results for LLM prompt injection
 */
export class MemoryContextBuilder {
  /**
   * Format memory results as markdown for prompt injection
   */
  static formatForPrompt(
    results: MemorySearchResult[],
    options: MemoryFormatOptions = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Filter by score threshold
    let filtered = results;
    if (opts.scoreThreshold > 0) {
      filtered = results.filter(r => (r.score ?? 0) >= opts.scoreThreshold);
    }

    // Limit results
    if (opts.maxResults < filtered.length) {
      filtered = filtered.slice(0, opts.maxResults);
    }

    if (filtered.length === 0) {
      return '';
    }

    return filtered.map((entry, i) => {
      const parts: string[] = [`## Memory ${i + 1}`];

      // Add score
      if (opts.includeScore && entry.score !== undefined) {
        const scorePercent = (entry.score * 100).toFixed(1);
        parts[0] += ` (relevance: ${scorePercent}%)`;
      }

      // Add agent
      if (opts.includeAgent && entry.agent) {
        parts.push(`**Agent:** ${entry.agent}`);
      }

      // Add timestamp
      if (opts.includeTimestamp && entry.createdAt) {
        parts.push(`**Created:** ${entry.createdAt}`);
      }

      // Add metadata
      if (opts.includeMetadata && entry.metadata) {
        const metadataStr = Object.entries(entry.metadata)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        if (metadataStr) {
          parts.push(`**Metadata:** ${metadataStr}`);
        }
      }

      // Add content
      parts.push('');
      parts.push(entry.content);
      parts.push('');

      return parts.join('\n');
    }).join('\n');
  }

  /**
   * Format memory results as JSON
   */
  static formatAsJson(
    results: MemorySearchResult[],
    options: MemoryFormatOptions = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let filtered = results;
    if (opts.scoreThreshold > 0) {
      filtered = results.filter(r => (r.score ?? 0) >= opts.scoreThreshold);
    }

    if (opts.maxResults < filtered.length) {
      filtered = filtered.slice(0, opts.maxResults);
    }

    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Format memory results as plain text
   */
  static formatAsText(
    results: MemorySearchResult[],
    options: MemoryFormatOptions = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let filtered = results;
    if (opts.scoreThreshold > 0) {
      filtered = results.filter(r => (r.score ?? 0) >= opts.scoreThreshold);
    }

    if (opts.maxResults < filtered.length) {
      filtered = filtered.slice(0, opts.maxResults);
    }

    return filtered.map((entry, i) => {
      const score = opts.includeScore && entry.score !== undefined
        ? ` (${(entry.score * 100).toFixed(1)}%)`
        : '';
      return `[${i + 1}]${score} ${entry.content}`;
    }).join('\n\n');
  }

  /**
   * Get summary statistics for memory results
   */
  static getSummary(results: MemorySearchResult[]): {
    count: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
  } {
    if (results.length === 0) {
      return { count: 0, avgScore: 0, minScore: 0, maxScore: 0 };
    }

    const scores = results
      .map(r => r.score ?? 0)
      .filter(s => s > 0);

    if (scores.length === 0) {
      return { count: results.length, avgScore: 0, minScore: 0, maxScore: 0 };
    }

    const sum = scores.reduce((acc, s) => acc + s, 0);
    const avg = sum / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return {
      count: results.length,
      avgScore: avg,
      minScore: min,
      maxScore: max
    };
  }
}
