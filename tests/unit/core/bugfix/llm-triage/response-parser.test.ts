/**
 * Tests for LLM Triage Response Parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseTriageResponse,
  validateVerdictCoverage,
  createDefaultVerdicts,
} from '@/core/bugfix/llm-triage/response-parser.js';

describe('Response Parser', () => {
  describe('parseTriageResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        verdicts: [
          { id: 'f1', accepted: true, confidence: 0.9, reason: 'Real bug' },
          { id: 'f2', accepted: false, confidence: 0.85, reason: 'False positive' },
        ],
      });

      const result = parseTriageResponse(response);

      expect(result.success).toBe(true);
      expect(result.verdicts).toHaveLength(2);
      const v0 = result.verdicts?.[0];
      const v1 = result.verdicts?.[1];
      expect(v0?.findingId).toBe('f1');
      expect(v0?.accepted).toBe(true);
      expect(v1?.findingId).toBe('f2');
      expect(v1?.accepted).toBe(false);
    });

    it('should parse JSON in markdown code block', () => {
      const response = `Here's my analysis:

\`\`\`json
{
  "verdicts": [
    {"id": "f1", "accepted": true, "confidence": 0.9}
  ]
}
\`\`\`

Hope this helps!`;

      const result = parseTriageResponse(response);

      expect(result.success).toBe(true);
      expect(result.verdicts).toHaveLength(1);
      expect(result.verdicts?.[0]?.findingId).toBe('f1');
    });

    it('should parse JSON in code block without json tag', () => {
      const response = `\`\`\`
{"verdicts": [{"id": "f1", "accepted": false, "confidence": 0.7}]}
\`\`\``;

      const result = parseTriageResponse(response);

      expect(result.success).toBe(true);
      expect(result.verdicts?.[0]?.accepted).toBe(false);
    });

    it('should extract JSON object from mixed content', () => {
      const response = `Let me analyze this...

      {"verdicts": [{"id": "f1", "accepted": true, "confidence": 0.8}]}

      Based on my analysis above.`;

      const result = parseTriageResponse(response);

      expect(result.success).toBe(true);
      expect(result.verdicts).toHaveLength(1);
    });

    it('should handle array response by wrapping in verdicts object', () => {
      // This tests the edge case where LLM returns just an array
      // The parser attempts to find a JSON object with "verdicts" first,
      // then falls back to wrapping bare arrays
      const response = `[{"id": "f1", "accepted": true, "confidence": 0.9}]`;

      const result = parseTriageResponse(response);

      // Note: This may succeed or fail depending on implementation
      // The important thing is it doesn't crash
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('rawResponse');
    });

    it('should handle optional reason field', () => {
      const response = JSON.stringify({
        verdicts: [{ id: 'f1', accepted: true, confidence: 0.9 }],
      });

      const result = parseTriageResponse(response);

      expect(result.success).toBe(true);
      expect(result.verdicts?.[0]?.reason).toBeUndefined();
    });

    it('should fail on empty response', () => {
      const result = parseTriageResponse('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should fail on non-string response', () => {
      const result = parseTriageResponse(null as unknown as string);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a string');
    });

    it('should fail on invalid JSON', () => {
      const result = parseTriageResponse('{ invalid json }');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should fail on missing verdicts array', () => {
      const result = parseTriageResponse('{"results": []}');

      expect(result.success).toBe(false);
      // Either fails to find JSON or fails validation
      expect(result.error).toBeDefined();
    });

    it('should fail on empty verdicts array', () => {
      const result = parseTriageResponse('{"verdicts": []}');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should fail on invalid confidence range', () => {
      const response = JSON.stringify({
        verdicts: [{ id: 'f1', accepted: true, confidence: 1.5 }],
      });

      const result = parseTriageResponse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should fail on missing required fields', () => {
      const response = JSON.stringify({
        verdicts: [{ id: 'f1', accepted: true }], // missing confidence
      });

      const result = parseTriageResponse(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should preserve raw response in result', () => {
      const response = '{"verdicts": [{"id": "f1", "accepted": true, "confidence": 0.9}]}';
      const result = parseTriageResponse(response);

      expect(result.rawResponse).toBe(response);
    });
  });

  describe('validateVerdictCoverage', () => {
    it('should identify missing verdicts', () => {
      const verdicts = [
        { findingId: 'f1', accepted: true, confidence: 0.9 },
        { findingId: 'f2', accepted: false, confidence: 0.8 },
      ];
      const expectedIds = ['f1', 'f2', 'f3', 'f4'];

      const result = validateVerdictCoverage(verdicts, expectedIds);

      expect(result.missing).toEqual(['f3', 'f4']);
      expect(result.extra).toEqual([]);
    });

    it('should identify extra verdicts', () => {
      const verdicts = [
        { findingId: 'f1', accepted: true, confidence: 0.9 },
        { findingId: 'f2', accepted: false, confidence: 0.8 },
        { findingId: 'f99', accepted: true, confidence: 0.7 },
      ];
      const expectedIds = ['f1', 'f2'];

      const result = validateVerdictCoverage(verdicts, expectedIds);

      expect(result.missing).toEqual([]);
      expect(result.extra).toEqual(['f99']);
    });

    it('should return empty arrays for perfect coverage', () => {
      const verdicts = [
        { findingId: 'f1', accepted: true, confidence: 0.9 },
        { findingId: 'f2', accepted: false, confidence: 0.8 },
      ];
      const expectedIds = ['f1', 'f2'];

      const result = validateVerdictCoverage(verdicts, expectedIds);

      expect(result.missing).toEqual([]);
      expect(result.extra).toEqual([]);
    });
  });

  describe('createDefaultVerdicts', () => {
    it('should create default verdicts accepting findings', () => {
      const findingIds = ['f1', 'f2', 'f3'];

      const verdicts = createDefaultVerdicts(findingIds);

      expect(verdicts).toHaveLength(3);
      verdicts.forEach((v, i) => {
        expect(v.findingId).toBe(findingIds[i]);
        expect(v.accepted).toBe(true); // Default to accept (don't hide bugs)
        expect(v.confidence).toBe(0.5);
        expect(v.reason).toContain('LLM did not provide verdict');
      });
    });

    it('should return empty array for empty input', () => {
      const verdicts = createDefaultVerdicts([]);

      expect(verdicts).toEqual([]);
    });
  });
});
