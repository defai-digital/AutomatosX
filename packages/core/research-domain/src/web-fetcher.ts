/**
 * Web Fetcher
 *
 * Fetch and parse web content for research.
 *
 * Invariants:
 * - INV-RSH-100: Timeout enforced
 * - INV-RSH-101: Concurrent fetches limited
 * - INV-RSH-102: Failed sources don't block
 */

import type {
  FetchRequest,
  FetchResponse,
  ResearchSource,
  CodeExample,
  SourceReliability,
} from '@defai.digital/contracts';
import { getErrorMessage } from '@defai.digital/contracts';
import type { WebFetcherPort } from './types.js';

/**
 * Default timeout for semaphore acquire in milliseconds
 */
const DEFAULT_SEMAPHORE_TIMEOUT_MS = 30000;

/**
 * Error thrown when semaphore acquire times out
 * INV-RSH-103: Semaphore acquire has timeout to prevent deadlocks
 */
class SemaphoreTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Semaphore acquire timed out after ${timeoutMs}ms`);
    this.name = 'SemaphoreTimeoutError';
  }
}

/**
 * Simple semaphore for limiting concurrent operations
 * INV-RSH-101: Concurrent fetches limited
 * INV-RSH-103: Acquire has timeout to prevent deadlocks
 */
class Semaphore {
  private permits: number;
  private waiting: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit, with timeout to prevent deadlocks
   * INV-RSH-103: Throws SemaphoreTimeoutError if timeout expires
   */
  async acquire(timeoutMs: number = DEFAULT_SEMAPHORE_TIMEOUT_MS): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Wait for a permit to become available, with timeout
    return new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      this.waiting.push(waiter);

      // Set up timeout to prevent deadlock
      const timeoutId = setTimeout(() => {
        const index = this.waiting.indexOf(waiter);
        if (index !== -1) {
          this.waiting.splice(index, 1);
          reject(new SemaphoreTimeoutError(timeoutMs));
        }
      }, timeoutMs);

      // Wrap resolve to clear timeout when permit is acquired
      const originalResolve = waiter.resolve;
      waiter.resolve = () => {
        clearTimeout(timeoutId);
        originalResolve();
      };
    });
    // Permit was transferred directly by release(), no need to decrement
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      // Transfer permit directly to waiting acquirer
      // Don't increment permits - the permit goes straight to the waiter
      next.resolve();
    } else {
      // No one waiting, return permit to pool
      this.permits++;
    }
  }
}

export { SemaphoreTimeoutError };

/**
 * Create a stub web fetcher
 */
export function createStubWebFetcher(): WebFetcherPort {
  return {
    async fetch(request: FetchRequest): Promise<FetchResponse> {
      console.warn(
        '[research-domain] Using stub web fetcher - no real fetch. ' +
          'Inject a real WebFetcherPort for production use.'
      );

      return {
        url: request.url,
        title: 'Stub Response',
        content: 'This is a stub response. Configure a real web fetcher for actual content.',
        codeBlocks: [],
        reliability: 'unknown',
        fetchedAt: new Date().toISOString(),
        success: true,
      };
    },

    async search(_query: string, _maxResults: number): Promise<ResearchSource[]> {
      console.warn(
        '[research-domain] Using stub search - no real search. ' +
          'Inject a real WebFetcherPort for production use.'
      );

      return [];
    },
  };
}

/**
 * Create a web fetcher with rate limiting
 */
export function createWebFetcher(options: {
  maxConcurrent?: number;
  defaultTimeout?: number;
  userAgent?: string;
}): WebFetcherPort {
  const semaphore = new Semaphore(options.maxConcurrent ?? 5);
  const defaultTimeout = options.defaultTimeout ?? 10000;
  const userAgent =
    options.userAgent ?? 'AutomatosX-Research/1.0 (+https://github.com/defai-digital/automatosx)';

  return {
    async fetch(request: FetchRequest): Promise<FetchResponse> {
      await semaphore.acquire();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          request.timeout ?? defaultTimeout
        );

        try {
          const response = await fetch(request.url, {
            signal: controller.signal,
            headers: {
              'User-Agent': userAgent,
              Accept: 'text/html,application/xhtml+xml,text/plain',
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            return {
              url: request.url,
              title: '',
              content: '',
              codeBlocks: [],
              reliability: 'unknown',
              fetchedAt: new Date().toISOString(),
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            };
          }

          const html = await response.text();
          const { title, content, codeBlocks } = parseHtml(html, request.maxLength);
          const reliability = determineReliability(request.url);

          return {
            url: request.url,
            title,
            content,
            codeBlocks: request.extractCode ? codeBlocks : [],
            reliability,
            fetchedAt: new Date().toISOString(),
            success: true,
          };
        } catch (error) {
          clearTimeout(timeoutId);

          return {
            url: request.url,
            title: '',
            content: '',
            codeBlocks: [],
            reliability: 'unknown',
            fetchedAt: new Date().toISOString(),
            success: false,
            error: getErrorMessage(error, 'Fetch failed'),
          };
        }
      } finally {
        semaphore.release();
      }
    },

    async search(_query: string, _maxResults: number): Promise<ResearchSource[]> {
      // Web search requires external API (not implemented in stub)
      console.warn(
        '[research-domain] Web search not implemented in basic fetcher. ' +
          'Configure a search API for web search functionality.'
      );
      return [];
    },
  };
}

/**
 * Maximum HTML size to process for code extraction
 * INV-RSH-103: Limit input size to prevent ReDoS attacks
 */
const MAX_HTML_SIZE_FOR_CODE_EXTRACTION = 1_000_000; // 1MB

/**
 * Maximum number of code blocks to extract
 * INV-RSH-104: Limit code block count to prevent excessive processing
 */
const MAX_CODE_BLOCKS = 50;

/**
 * Parse HTML content
 */
function parseHtml(
  html: string,
  maxLength: number
): { title: string; content: string; codeBlocks: CodeExample[] } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? '';

  // Extract code blocks with protection against ReDoS
  const codeBlocks: CodeExample[] = [];

  // INV-RSH-103: Limit HTML size before regex to prevent ReDoS
  const safeHtml = html.length > MAX_HTML_SIZE_FOR_CODE_EXTRACTION
    ? html.slice(0, MAX_HTML_SIZE_FOR_CODE_EXTRACTION)
    : html;

  // INV-RSH-103: Use safer regex pattern with bounded attribute matching
  // Pattern limits attribute length and avoids nested quantifiers
  const codeRegex = /<(pre|code)(?:\s+[^>]{0,500})?>([\s\S]{0,10000}?)<\/\1>/gi;
  // Separate pattern for language detection (simpler, applied only to small matches)
  const langRegex = /class="[^"]*\blanguage-(\w+)\b[^"]*"/i;

  let match;
  let matchCount = 0;

  while ((match = codeRegex.exec(safeHtml)) !== null) {
    // INV-RSH-104: Limit number of code blocks extracted
    if (matchCount >= MAX_CODE_BLOCKS) break;
    matchCount++;

    const tagContent = match[0] ?? '';
    const langMatch = langRegex.exec(tagContent);
    const language = langMatch?.[1] ?? 'text';
    const code = stripHtml(match[2] ?? '').trim();

    if (code.length > 10 && code.length < 5000) {
      codeBlocks.push({
        code,
        language,
        tested: false,
      });
    }
  }

  // Extract main content (simplified)
  let content = html
    // Remove script and style
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate if needed
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '...';
  }

  return { title, content, codeBlocks };
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/**
 * Determine source reliability based on URL
 */
function determineReliability(url: string): SourceReliability {
  const hostname = new URL(url).hostname.toLowerCase();

  // Official documentation sources
  const officialDomains = [
    'docs.github.com',
    'developer.mozilla.org',
    'nodejs.org',
    'typescriptlang.org',
    'react.dev',
    'vuejs.org',
    'angular.io',
    'python.org',
    'go.dev',
    'rust-lang.org',
    'docs.microsoft.com',
    'cloud.google.com',
    'docs.aws.amazon.com',
  ];

  if (officialDomains.some((d) => hostname.includes(d))) {
    return 'official';
  }

  // Community sources
  const communityDomains = [
    'stackoverflow.com',
    'github.com',
    'dev.to',
    'medium.com',
    'hashnode.dev',
  ];

  if (communityDomains.some((d) => hostname.includes(d))) {
    return 'community';
  }

  return 'unknown';
}
