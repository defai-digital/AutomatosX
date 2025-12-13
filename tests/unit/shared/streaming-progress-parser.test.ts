/**
 * Streaming Progress Parser - streaming event handling
 */

import { describe, it, expect } from 'vitest';
import { StreamingProgressParser } from '../../../src/shared/process/streaming-progress-parser.js';

describe('StreamingProgressParser (streaming events)', () => {
  it('should parse content streaming chunks into response updates', () => {
    const parser = new StreamingProgressParser();
    const progress = parser.parseLine(JSON.stringify({
      type: 'content',
      content: 'Hello streaming world'
    }));

    expect(progress).toEqual({
      type: 'response',
      message: 'Generating response...',
      details: 'Hello streaming world'
    });
  });

  it('should surface progress messages with percentages', () => {
    const parser = new StreamingProgressParser();
    const progress = parser.parseLine(JSON.stringify({
      type: 'progress',
      message: 'Reading files',
      percentage: 42
    }));

    expect(progress).toEqual({
      type: 'thinking',
      message: 'Reading files (42%)'
    });
  });

  it('should handle tool call streaming events', () => {
    const parser = new StreamingProgressParser();
    const progress = parser.parseLine(JSON.stringify({
      type: 'tool_calls',
      toolCalls: [
        { function: { name: 'customTool' } }
      ]
    }));

    expect(progress).toEqual({
      type: 'tool_call',
      message: 'Executing customTool...'
    });
  });

  it('should propagate streaming errors as error updates', () => {
    const parser = new StreamingProgressParser();
    const progress = parser.parseLine(JSON.stringify({
      type: 'error',
      error: 'stream failed'
    }));

    expect(progress).toEqual({
      type: 'error',
      message: 'stream failed'
    });
  });
});
