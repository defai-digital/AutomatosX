/**
 * Synthesizer
 *
 * Combine multiple research sources into a coherent answer.
 *
 * Invariants:
 * - INV-RSH-200: Source attribution included
 * - INV-RSH-201: Code examples attributed
 * - INV-RSH-202: Conflicting information noted
 * - INV-RSH-203: No hallucinated URLs
 */

import type {
  SynthesisRequest,
  ResearchSource,
  CodeExample,
} from '@defai.digital/contracts';
import type { SynthesizerPort } from './types.js';

/**
 * Create a stub synthesizer
 */
export function createStubSynthesizer(): SynthesizerPort {
  return {
    async synthesize(request: SynthesisRequest): Promise<string> {
      console.warn(
        '[research-domain] Using stub synthesizer - no AI synthesis. ' +
          'Inject a real SynthesizerPort for production use.'
      );

      // Create a simple concatenation-based synthesis
      return createSimpleSynthesis(request);
    },
  };
}

/**
 * Create a simple template-based synthesis
 * Used as fallback when no AI synthesizer is available
 */
function createSimpleSynthesis(request: SynthesisRequest): string {
  const { query, sources, includeCode } = request;
  const lines: string[] = [];

  lines.push(`# Research: ${query}\n`);

  // Summary section
  lines.push('## Summary\n');
  lines.push(`Based on ${sources.length} source(s):\n`);

  // Source summaries
  for (const source of sources) {
    const reliability = formatReliability(source.reliability);
    lines.push(`### ${source.title} ${reliability}`);
    lines.push(`*Source: ${source.url}*\n`);
    lines.push(truncateText(source.snippet, 500));
    lines.push('');
  }

  // Code examples
  if (includeCode) {
    const allCode = collectCodeExamples(sources);
    if (allCode.length > 0) {
      lines.push('\n## Code Examples\n');
      for (const example of allCode.slice(0, 5)) {
        lines.push(`\`\`\`${example.language}`);
        lines.push(example.code);
        lines.push('```');
        if (example.source) {
          lines.push(`*Source: ${example.source}*`);
        }
        lines.push('');
      }
    }
  }

  // References
  lines.push('\n## References\n');
  for (let i = 0; i < sources.length; i++) {
    lines.push(`${i + 1}. [${sources[i]!.title}](${sources[i]!.url})`);
  }

  return lines.join('\n');
}

/**
 * Format reliability badge
 */
function formatReliability(reliability: string): string {
  switch (reliability) {
    case 'official':
      return '[Official]';
    case 'community':
      return '[Community]';
    case 'generated':
      return '[AI Generated]';
    default:
      return '';
  }
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Collect code examples from all sources
 * INV-RSH-201: Code examples attributed
 */
function collectCodeExamples(sources: ResearchSource[]): CodeExample[] {
  const examples: CodeExample[] = [];

  for (const source of sources) {
    if (source.content) {
      // Extract code blocks from content
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;

      while ((match = codeBlockRegex.exec(source.content)) !== null) {
        examples.push({
          code: match[2]?.trim() ?? '',
          language: match[1] ?? 'text',
          source: source.url,
          tested: false,
        });
      }
    }
  }

  return examples;
}

/**
 * Detect conflicting information between sources
 * INV-RSH-202: Conflicting information noted
 */
export function detectConflicts(sources: ResearchSource[]): string[] {
  const conflicts: string[] = [];

  // Simple heuristic: check for contradictory keywords
  const contradictoryPairs = [
    ['deprecated', 'recommended'],
    ['avoid', 'best practice'],
    ['not recommended', 'should use'],
    ['legacy', 'modern'],
  ];

  for (const [word1, word2] of contradictoryPairs) {
    const hasWord1 = sources.some((s) =>
      s.snippet.toLowerCase().includes(word1!)
    );
    const hasWord2 = sources.some((s) =>
      s.snippet.toLowerCase().includes(word2!)
    );

    if (hasWord1 && hasWord2) {
      conflicts.push(
        `Sources have conflicting views: some mention "${word1}" while others suggest "${word2}"`
      );
    }
  }

  return conflicts;
}

/**
 * Validate all URLs in synthesis come from sources
 * INV-RSH-203: No hallucinated URLs
 */
export function validateUrls(synthesis: string, sources: ResearchSource[]): boolean {
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  const urls = synthesis.match(urlRegex) ?? [];
  const sourceUrls = new Set(sources.map((s) => s.url));

  for (const url of urls) {
    // Allow URLs that are from our sources
    if (sourceUrls.has(url)) {
      continue;
    }

    // Allow URLs that are subpaths of source URLs
    const isSubpath = Array.from(sourceUrls).some((sourceUrl) =>
      url.startsWith(sourceUrl.replace(/\/$/, ''))
    );
    if (isSubpath) {
      continue;
    }

    // URL not from sources - this is a hallucination
    return false;
  }

  return true;
}
