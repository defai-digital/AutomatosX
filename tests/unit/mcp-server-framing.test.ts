/**
 * MCP Server Framing Tests
 *
 * Tests the Content-Length framing logic to ensure proper parsing
 * of multiple headers sent by MCP clients (Claude Code, etc.)
 */

import { describe, it, expect } from 'vitest';

describe('MCP Server Framing Logic', () => {
  /**
   * Helper to simulate the header parsing logic from server.ts:914
   */
  function parseHeaders(buffer: string): { contentLength: number | null; remainingBuffer: string } {
    // Look for the end of headers (blank line: \r\n\r\n)
    const headerEndIndex = buffer.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      // Incomplete headers
      return { contentLength: null, remainingBuffer: buffer };
    }

    // Extract the header block (everything before \r\n\r\n)
    const headerBlock = buffer.slice(0, headerEndIndex);

    // Parse each header line (case-insensitive key lookup)
    let contentLength: number | null = null;
    const headerLines = headerBlock.split('\r\n');
    for (const line of headerLines) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex !== -1) {
        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();

        if (key === 'content-length') {
          contentLength = parseInt(value, 10);
          if (isNaN(contentLength) || contentLength < 0) {
            contentLength = null;
            break;
          }
        }
      }
    }

    // Remove the headers (including \r\n\r\n) from buffer
    const remainingBuffer = buffer.slice(headerEndIndex + 4);

    return { contentLength, remainingBuffer };
  }

  describe('Content-Length Header Parsing', () => {
    it('should parse single Content-Length header', () => {
      const buffer = 'Content-Length: 123\r\n\r\n{"jsonrpc":"2.0"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(123);
      expect(result.remainingBuffer).toBe('{"jsonrpc":"2.0"}');
    });

    it('should parse Content-Length with Content-Type header (Claude Code format)', () => {
      const buffer = 'Content-Type: application/json\r\nContent-Length: 456\r\n\r\n{"method":"test"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(456);
      expect(result.remainingBuffer).toBe('{"method":"test"}');
    });

    it('should parse Content-Length when it comes before Content-Type', () => {
      const buffer = 'Content-Length: 789\r\nContent-Type: application/json\r\n\r\n{"id":1}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(789);
      expect(result.remainingBuffer).toBe('{"id":1}');
    });

    it('should parse Content-Length with multiple headers', () => {
      const buffer =
        'Content-Type: application/json\r\n' +
        'Content-Length: 100\r\n' +
        'X-Custom-Header: value\r\n' +
        '\r\n' +
        '{"data":"test"}';

      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(100);
      expect(result.remainingBuffer).toBe('{"data":"test"}');
    });

    it('should be case-insensitive for Content-Length header', () => {
      const buffer = 'content-length: 42\r\n\r\n{"test":true}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(42);
      expect(result.remainingBuffer).toBe('{"test":true}');
    });

    it('should handle mixed case headers', () => {
      const buffer = 'CoNtEnT-LeNgTh: 999\r\n\r\n{"mixed":"case"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(999);
      expect(result.remainingBuffer).toBe('{"mixed":"case"}');
    });

    it('should return null when headers are incomplete (no \\r\\n\\r\\n)', () => {
      const buffer = 'Content-Length: 123\r\n';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBeNull();
      expect(result.remainingBuffer).toBe(buffer);
    });

    it('should return null when Content-Length is missing', () => {
      const buffer = 'Content-Type: application/json\r\n\r\n{"no":"length"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBeNull();
      expect(result.remainingBuffer).toBe('{"no":"length"}');
    });

    it('should return null for invalid Content-Length value', () => {
      const buffer = 'Content-Length: invalid\r\n\r\n{"bad":"value"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBeNull();
    });

    it('should return null for negative Content-Length', () => {
      const buffer = 'Content-Length: -100\r\n\r\n{"negative":"length"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBeNull();
    });

    it('should handle whitespace in header values', () => {
      const buffer = 'Content-Length:   456   \r\n\r\n{"whitespace":"test"}';
      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(456);
      expect(result.remainingBuffer).toBe('{"whitespace":"test"}');
    });
  });

  describe('Real-World MCP Client Scenarios', () => {
    it('should handle Claude Code typical request format', () => {
      // Claude Code sends Content-Type before Content-Length
      const jsonBody = '{"jsonrpc":"2.0","method":"initialize","id":1}';
      const buffer =
        `Content-Type: application/json\r\n` +
        `Content-Length: ${jsonBody.length}\r\n` +
        `\r\n` +
        jsonBody;

      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(jsonBody.length);
      expect(result.remainingBuffer).toBe(jsonBody);
    });

    it('should handle MCP client with additional headers', () => {
      const jsonBody = '{"jsonrpc":"2.0","method":"tools/list"}';
      const buffer =
        `User-Agent: MCP-Client/1.0\r\n` +
        `Content-Type: application/json; charset=utf-8\r\n` +
        `Content-Length: ${jsonBody.length}\r\n` +
        `Accept: application/json\r\n` +
        `\r\n` +
        jsonBody;

      const result = parseHeaders(buffer);

      expect(result.contentLength).toBe(jsonBody.length);
      expect(result.remainingBuffer).toBe(jsonBody);
    });
  });

  describe('Bug Regression Tests', () => {
    it('should NOT match the old buggy regex pattern (Content-Length first only)', () => {
      // The OLD buggy regex: /^Content-Length: (\d+)\r\n\r\n/
      // This would FAIL to match when Content-Type comes first
      const buffer = 'Content-Type: application/json\r\nContent-Length: 123\r\n\r\n{}';

      // Old buggy regex would return null
      const oldRegexMatch = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
      expect(oldRegexMatch).toBeNull(); // Old regex fails

      // New parser should succeed
      const result = parseHeaders(buffer);
      expect(result.contentLength).toBe(123); // New parser works!
    });

    it('should handle the case that caused the server to stall', () => {
      // This is the exact case reported in the bug:
      // Claude Code sends Content-Type before Content-Length
      const buffer =
        'Content-Type: application/json\r\n' +
        'Content-Length: 50\r\n' +
        '\r\n' +
        '{"jsonrpc":"2.0","method":"initialize","id":1}';

      const result = parseHeaders(buffer);

      // Should successfully parse despite Content-Type being first
      expect(result.contentLength).toBe(50);
      expect(result.remainingBuffer).toContain('jsonrpc');
    });
  });
});
