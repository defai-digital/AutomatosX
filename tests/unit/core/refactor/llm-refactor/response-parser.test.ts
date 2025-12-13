/**
 * LLM Refactor Response Parser Tests
 *
 * @module tests/unit/core/refactor/llm-refactor/response-parser
 * @since v12.10.0
 */

import { describe, it, expect } from 'vitest';
import {
  parseRefactorResponse,
  validateResultCoverage,
  createDefaultResults,
  sanitizeRefactoredCode,
} from '../../../../../src/core/refactor/llm-refactor/response-parser.js';

describe('parseRefactorResponse', () => {
  describe('valid JSON parsing', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        refactorings: [
          {
            id: 'finding-1',
            success: true,
            refactoredCode: 'const MAX_RETRIES = 3;',
            explanation: 'Extracted magic number',
            confidence: 0.95,
            safeToAutoApply: true,
          },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings).toHaveLength(1);
      expect(result.response?.refactorings[0]!.id).toBe('finding-1');
      expect(result.response?.refactorings[0]!.success).toBe(true);
      expect(result.response?.refactorings[0]!.confidence).toBe(0.95);
    });

    it('should parse response with multiple refactorings', () => {
      const response = JSON.stringify({
        refactorings: [
          {
            id: 'finding-1',
            success: true,
            refactoredCode: 'code1',
            confidence: 0.9,
            safeToAutoApply: true,
          },
          {
            id: 'finding-2',
            success: false,
            error: 'Too complex',
            confidence: 0.3,
            safeToAutoApply: false,
          },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings).toHaveLength(2);
      expect(result.response?.refactorings[0]!.success).toBe(true);
      expect(result.response?.refactorings[1]!.success).toBe(false);
      expect(result.response?.refactorings[1]!.error).toBe('Too complex');
    });

    it('should apply default values for optional fields', () => {
      const response = JSON.stringify({
        refactorings: [
          {
            id: 'finding-1',
            success: true,
          },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings[0]!.confidence).toBe(0.5); // default
      expect(result.response?.refactorings[0]!.safeToAutoApply).toBe(false); // default
    });
  });

  describe('markdown code block extraction', () => {
    it('should extract JSON from markdown code block', () => {
      const response = `Here is the refactoring:

\`\`\`json
{
  "refactorings": [
    {
      "id": "finding-1",
      "success": true,
      "refactoredCode": "const x = 1;",
      "confidence": 0.8,
      "safeToAutoApply": true
    }
  ]
}
\`\`\`

Let me know if you need anything else.`;

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings).toHaveLength(1);
    });

    it('should extract JSON from code block without language specifier', () => {
      const response = `\`\`\`
{"refactorings": [{"id": "f1", "success": true, "confidence": 0.9, "safeToAutoApply": true}]}
\`\`\``;

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings[0]!.id).toBe('f1');
    });
  });

  describe('JSON object extraction', () => {
    it('should extract JSON object from mixed text', () => {
      const response = `I've analyzed the code. Here's my response:
{"refactorings": [{"id": "f1", "success": true, "confidence": 0.85, "safeToAutoApply": true}]}
That should fix the issue.`;

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings[0]!.id).toBe('f1');
    });

    it('should wrap JSON array in object when embedded in text', () => {
      // Arrays at the start of response are not wrapped - only embedded arrays are
      const response = `Here's the refactoring: [{"id": "f1", "success": true, "confidence": 0.9, "safeToAutoApply": true}]`;

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
      expect(result.response?.refactorings[0]!.id).toBe('f1');
    });
  });

  describe('error handling', () => {
    it('should return error for empty response', () => {
      const result = parseRefactorResponse('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should return error for null response', () => {
      const result = parseRefactorResponse(null as unknown as string);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should return error for invalid JSON', () => {
      const result = parseRefactorResponse('{ invalid json }');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('should return error for missing refactorings array', () => {
      const result = parseRefactorResponse('{"data": []}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should return error for empty refactorings array', () => {
      const result = parseRefactorResponse('{"refactorings": []}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should return error for missing required id field', () => {
      const result = parseRefactorResponse('{"refactorings": [{"success": true}]}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should return error when no JSON found in text', () => {
      const result = parseRefactorResponse('This is just plain text without any JSON.');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not find JSON');
    });
  });

  describe('validation', () => {
    it('should reject confidence values outside 0-1 range', () => {
      const response = JSON.stringify({
        refactorings: [
          {
            id: 'f1',
            success: true,
            confidence: 1.5, // Invalid
            safeToAutoApply: true,
          },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should reject negative confidence values', () => {
      const response = JSON.stringify({
        refactorings: [
          {
            id: 'f1',
            success: true,
            confidence: -0.5,
            safeToAutoApply: true,
          },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(false);
    });

    it('should accept confidence at boundary values', () => {
      const response = JSON.stringify({
        refactorings: [
          { id: 'f1', success: true, confidence: 0, safeToAutoApply: true },
          { id: 'f2', success: true, confidence: 1, safeToAutoApply: true },
        ],
      });

      const result = parseRefactorResponse(response);

      expect(result.success).toBe(true);
    });
  });

  describe('rawResponse preservation', () => {
    it('should preserve raw response on success', () => {
      const response = '{"refactorings": [{"id": "f1", "success": true}]}';
      const result = parseRefactorResponse(response);

      expect(result.rawResponse).toBe(response);
    });

    it('should preserve raw response on failure', () => {
      const response = 'invalid';
      const result = parseRefactorResponse(response);

      expect(result.rawResponse).toBe(response);
    });
  });
});

describe('validateResultCoverage', () => {
  it('should identify missing finding IDs', () => {
    const response = {
      refactorings: [
        { id: 'f1', success: true, confidence: 0.9, safeToAutoApply: true },
        { id: 'f2', success: true, confidence: 0.8, safeToAutoApply: true },
      ],
    };
    const expectedIds = ['f1', 'f2', 'f3', 'f4'];

    const result = validateResultCoverage(response, expectedIds);

    expect(result.missing).toEqual(['f3', 'f4']);
    expect(result.extra).toEqual([]);
  });

  it('should identify extra finding IDs', () => {
    const response = {
      refactorings: [
        { id: 'f1', success: true, confidence: 0.9, safeToAutoApply: true },
        { id: 'f2', success: true, confidence: 0.8, safeToAutoApply: true },
        { id: 'f3', success: true, confidence: 0.7, safeToAutoApply: true },
      ],
    };
    const expectedIds = ['f1', 'f2'];

    const result = validateResultCoverage(response, expectedIds);

    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual(['f3']);
  });

  it('should handle complete coverage', () => {
    const response = {
      refactorings: [
        { id: 'f1', success: true, confidence: 0.9, safeToAutoApply: true },
        { id: 'f2', success: true, confidence: 0.8, safeToAutoApply: true },
      ],
    };
    const expectedIds = ['f1', 'f2'];

    const result = validateResultCoverage(response, expectedIds);

    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it('should handle empty expected IDs', () => {
    const response = {
      refactorings: [
        { id: 'f1', success: true, confidence: 0.9, safeToAutoApply: true },
      ],
    };

    const result = validateResultCoverage(response, []);

    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual(['f1']);
  });

  it('should handle empty response', () => {
    const response = { refactorings: [] };
    const expectedIds = ['f1', 'f2'];

    const result = validateResultCoverage(response, expectedIds);

    expect(result.missing).toEqual(['f1', 'f2']);
    expect(result.extra).toEqual([]);
  });
});

describe('createDefaultResults', () => {
  it('should create default results for missing IDs', () => {
    const missingIds = ['f1', 'f2', 'f3'];

    const results = createDefaultResults(missingIds);

    expect(results).toHaveLength(3);
    results.forEach((result, index) => {
      expect(result.id).toBe(`f${index + 1}`);
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.safeToAutoApply).toBe(false);
      expect(result.error).toBe('No result from LLM');
    });
  });

  it('should return empty array for empty input', () => {
    const results = createDefaultResults([]);

    expect(results).toEqual([]);
  });

  it('should include manualReviewReason', () => {
    const results = createDefaultResults(['f1']);

    expect(results[0]!.manualReviewReason).toBe('LLM did not provide result');
  });
});

describe('sanitizeRefactoredCode', () => {
  describe('basic sanitization', () => {
    it('should trim whitespace', () => {
      const result = sanitizeRefactoredCode('  const x = 1;  ');

      expect(result).toBe('const x = 1;');
    });

    it('should return code as-is when already clean', () => {
      const code = 'const x = 1;';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe(code);
    });
  });

  describe('markdown code block removal', () => {
    it('should remove markdown code block markers with language', () => {
      const code = '```typescript\nconst x = 1;\n```';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe('const x = 1;');
    });

    it('should remove markdown code block markers without language', () => {
      const code = '```\nconst x = 1;\n```';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe('const x = 1;');
    });

    it('should handle code block with multiple lines', () => {
      const code = '```typescript\nconst x = 1;\nconst y = 2;\nreturn x + y;\n```';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe('const x = 1;\nconst y = 2;\nreturn x + y;');
    });

    it('should handle incomplete closing marker', () => {
      const code = '```typescript\nconst x = 1;';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe('const x = 1;');
    });
  });

  describe('invalid input handling', () => {
    it('should return null for undefined', () => {
      const result = sanitizeRefactoredCode(undefined);

      expect(result).toBeNull();
    });

    it('should return null for null', () => {
      const result = sanitizeRefactoredCode(null as unknown as string);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = sanitizeRefactoredCode('');

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      const result = sanitizeRefactoredCode('   \n\t  ');

      expect(result).toBeNull();
    });

    it('should return null for empty code block', () => {
      const result = sanitizeRefactoredCode('```\n```');

      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = sanitizeRefactoredCode(123 as unknown as string);

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should preserve internal backticks', () => {
      const code = 'const template = `hello ${name}`;';
      const result = sanitizeRefactoredCode(code);

      expect(result).toBe(code);
    });

    it('should handle code with triple backticks inside', () => {
      const code = '```typescript\nconst md = "use ``` for code";\n```';
      const result = sanitizeRefactoredCode(code);

      // Should remove outer markers but preserve content
      expect(result).toContain('const md');
    });
  });
});
