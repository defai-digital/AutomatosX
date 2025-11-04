/**
 * Stream Buffer
 *
 * Intelligent buffering for streaming responses
 * Detects and handles code blocks, tables, and other special markdown elements
 */

export interface BufferedSegment {
  type: 'text' | 'code' | 'markdown';
  content: string;
  language?: string;
  complete: boolean;
}

export class StreamBuffer {
  private buffer = '';
  private flushThreshold = 50; // chars
  private lastFlushTime = 0;
  private minFlushInterval = 16; // ms (60 FPS)
  private inCodeBlock = false;
  private codeBlockBuffer = '';
  private codeBlockLanguage = '';
  private maxCodeBlockSize = 100000; // 100KB limit (Bug #5 fix: prevent unbounded growth)

  /**
   * Add token to buffer with smart detection
   * Returns segments ready to be rendered
   */
  add(token: string): BufferedSegment[] {
    this.buffer += token;
    const segments: BufferedSegment[] = [];

    // BUG #35 FIX: Loop to handle multiple fences in same chunk
    // This prevents incomplete blocks when opening and closing ``` arrive together
    let foundFence = true;
    while (foundFence) {
      // Bug #5 fix: More robust code block detection using indexOf
      // This ensures we find ``` anywhere in the buffer, not just at the start
      const codeBlockStart = this.buffer.indexOf('```');

      if (codeBlockStart !== -1) {
        // Found code block marker
        if (!this.inCodeBlock) {
          // Starting a code block
          // Flush any text before the code block
          const textBefore = this.buffer.substring(0, codeBlockStart);
          if (textBefore.trim()) {
            segments.push({
              type: 'text',
              content: textBefore,
              complete: true
            });
          }

          // Enter code block mode
          this.inCodeBlock = true;

          // Extract language from the opening marker
          // Bug #19 fix: Support languages with hyphens, plus signs, and hash symbols (c++, objective-c, c#)
          const afterMarker = this.buffer.substring(codeBlockStart + 3);
          const languageMatch = afterMarker.match(/^([\w\-+#]+)/);
          this.codeBlockLanguage = (languageMatch && languageMatch[1]) ? languageMatch[1] : 'text';

          // Calculate how many characters to skip (``` + language + optional newline)
          let skipLength = 3; // for ```
          if (languageMatch && languageMatch[1]) {
            skipLength += languageMatch[1].length;
          }
          // Skip optional whitespace and newline after language
          const afterLanguage = afterMarker.substring((languageMatch && languageMatch[1]) ? languageMatch[1].length : 0);
          if (afterLanguage.match(/^[ \t]*\n/)) {
            const wsMatch = afterLanguage.match(/^[ \t]*\n/);
            if (wsMatch && wsMatch[0]) {
              skipLength += wsMatch[0].length;
            }
          }

          this.codeBlockBuffer = '';

          // Remove processed text from buffer
          this.buffer = this.buffer.substring(codeBlockStart + skipLength);

        } else {
          // Ending a code block
          // Extract code content (everything before the closing ```)
          const endIndex = this.buffer.indexOf('```');
          if (endIndex !== -1) {
            this.codeBlockBuffer = this.buffer.substring(0, endIndex);

            // Return complete code block
            segments.push({
              type: 'code',
              content: this.codeBlockBuffer.trim(),
              language: this.codeBlockLanguage,
              complete: true
            });

            // Exit code block mode
            this.inCodeBlock = false;
            this.codeBlockBuffer = '';
            this.codeBlockLanguage = '';

            // Remove processed content from buffer
            this.buffer = this.buffer.substring(endIndex + 3);
          } else {
            // No closing fence yet, break loop
            foundFence = false;
          }
        }
      } else {
        // No fence marker found, break loop
        foundFence = false;
      }
    }

    // If in code block, accumulate but don't flush yet
    if (this.inCodeBlock) {
      this.codeBlockBuffer = this.buffer;

      // Bug #5 fix: Protect against unbounded growth (DoS/memory exhaustion)
      if (this.codeBlockBuffer.length > this.maxCodeBlockSize) {
        // Force close the code block - it's malformed or too large
        segments.push({
          type: 'code',
          content: this.codeBlockBuffer,
          language: this.codeBlockLanguage,
          complete: false  // Mark as incomplete (no closing ```)
        });

        // Reset state
        this.inCodeBlock = false;
        this.codeBlockBuffer = '';
        this.codeBlockLanguage = '';
        this.buffer = '';
      }

      return segments;
    }

    // Regular text buffering with throttling
    const now = Date.now();
    const timeSinceFlush = now - this.lastFlushTime;

    // Flush if buffer is large enough or enough time has passed
    if (this.buffer.length >= this.flushThreshold ||
        (this.buffer.length > 0 && timeSinceFlush >= this.minFlushInterval)) {

      segments.push({
        type: 'text',
        content: this.buffer,
        complete: false
      });

      this.buffer = '';
      this.lastFlushTime = now;
    }

    return segments;
  }

  /**
   * Force flush any remaining buffer content
   */
  flush(): BufferedSegment[] {
    const segments: BufferedSegment[] = [];

    // If we're still in a code block, return it as incomplete
    if (this.inCodeBlock && this.codeBlockBuffer) {
      segments.push({
        type: 'code',
        content: this.codeBlockBuffer,
        language: this.codeBlockLanguage,
        complete: false
      });
      this.inCodeBlock = false;
      this.codeBlockBuffer = '';
    }

    // Flush any remaining text buffer
    if (this.buffer.trim()) {
      segments.push({
        type: 'text',
        content: this.buffer,
        complete: true
      });
      this.buffer = '';
    }

    return segments;
  }

  /**
   * Check if currently inside a code block
   */
  isInCodeBlock(): boolean {
    return this.inCodeBlock;
  }

  /**
   * Get current buffer state for debugging
   */
  getState(): {
    bufferLength: number;
    inCodeBlock: boolean;
    codeBlockLength: number;
  } {
    return {
      bufferLength: this.buffer.length,
      inCodeBlock: this.inCodeBlock,
      codeBlockLength: this.codeBlockBuffer.length
    };
  }

  /**
   * Reset buffer to initial state
   */
  reset(): void {
    this.buffer = '';
    this.inCodeBlock = false;
    this.codeBlockBuffer = '';
    this.codeBlockLanguage = '';
    this.lastFlushTime = 0;
  }
}

/**
 * Terminal utilities for smooth rendering
 */
export class TerminalUtils {
  /**
   * Hide cursor during streaming
   */
  static hideCursor(): void {
    process.stdout.write('\x1B[?25l');
  }

  /**
   * Show cursor after streaming
   */
  static showCursor(): void {
    process.stdout.write('\x1B[?25h');
  }

  /**
   * Clear current line
   */
  static clearLine(): void {
    process.stdout.write('\r\x1B[K');
  }

  /**
   * Move cursor up N lines
   * Bug #17 fix: Validate input to prevent invalid ANSI sequences
   */
  static moveCursorUp(lines: number): void {
    // Validate input is finite integer
    if (!Number.isFinite(lines) || !Number.isInteger(lines)) {
      return;
    }

    // Clamp to reasonable range (0-1000 lines)
    const clamped = Math.max(0, Math.min(lines, 1000));

    if (clamped > 0) {
      process.stdout.write(`\x1B[${clamped}A`);
    }
  }

  /**
   * Move cursor down N lines
   * Bug #17 fix: Validate input to prevent invalid ANSI sequences
   */
  static moveCursorDown(lines: number): void {
    // Validate input is finite integer
    if (!Number.isFinite(lines) || !Number.isInteger(lines)) {
      return;
    }

    // Clamp to reasonable range (0-1000 lines)
    const clamped = Math.max(0, Math.min(lines, 1000));

    if (clamped > 0) {
      process.stdout.write(`\x1B[${clamped}B`);
    }
  }

  /**
   * Save cursor position
   */
  static saveCursor(): void {
    process.stdout.write('\x1B[s');
  }

  /**
   * Restore cursor position
   */
  static restoreCursor(): void {
    process.stdout.write('\x1B[u');
  }

  /**
   * Check if terminal supports colors
   * Bug #18 fix: Handle undefined TERM correctly
   */
  static supportsColor(): boolean {
    if (!process.stdout.isTTY) {
      return false;
    }

    const term = process.env.TERM;

    // If TERM is not set or is 'dumb', disable colors
    if (!term || term === 'dumb') {
      return false;
    }

    return true;
  }

  /**
   * Get terminal width
   */
  static getWidth(): number {
    return process.stdout.columns || 80;
  }

  /**
   * Get terminal height
   */
  static getHeight(): number {
    return process.stdout.rows || 24;
  }
}
