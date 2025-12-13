/**
 * Tests for severity-formatter utility
 *
 * @module tests/unit/shared/logging/severity-formatter
 */

import { describe, it, expect, vi } from 'vitest';
import {
  formatSeverity,
  getSeverityColor,
  getSeverityWeight,
  type Severity
} from '../../../../src/shared/logging/severity-formatter.js';

// Mock chalk to return predictable strings
vi.mock('chalk', () => ({
  default: {
    bgRed: { white: (s: string) => `[bgRed.white]${s}[/bgRed.white]` },
    red: (s: string) => `[red]${s}[/red]`,
    yellow: (s: string) => `[yellow]${s}[/yellow]`,
    gray: (s: string) => `[gray]${s}[/gray]`,
    white: (s: string) => `[white]${s}[/white]`
  }
}));

describe('severity-formatter', () => {
  describe('formatSeverity', () => {
    it('should format critical severity with background red', () => {
      const result = formatSeverity('critical');
      expect(result).toContain('CRITICAL');
      expect(result).toContain('bgRed');
    });

    it('should format high severity in red', () => {
      const result = formatSeverity('high');
      expect(result).toBe('[red][HIGH][/red]');
    });

    it('should format medium severity in yellow', () => {
      const result = formatSeverity('medium');
      expect(result).toBe('[yellow][MED][/yellow]');
    });

    it('should format low severity in gray', () => {
      const result = formatSeverity('low');
      expect(result).toBe('[gray][LOW][/gray]');
    });

    it('should handle unknown severity with uppercase formatting', () => {
      const result = formatSeverity('unknown' as Severity);
      expect(result).toBe('[UNKNOWN]');
    });

    it('should handle empty string severity', () => {
      const result = formatSeverity('' as Severity);
      expect(result).toBe('[]');
    });
  });

  describe('getSeverityColor', () => {
    it('should return bgRed.white for critical', () => {
      const colorFn = getSeverityColor('critical');
      expect(colorFn('test')).toContain('bgRed');
    });

    it('should return red for high', () => {
      const colorFn = getSeverityColor('high');
      expect(colorFn('test')).toBe('[red]test[/red]');
    });

    it('should return yellow for medium', () => {
      const colorFn = getSeverityColor('medium');
      expect(colorFn('test')).toBe('[yellow]test[/yellow]');
    });

    it('should return gray for low', () => {
      const colorFn = getSeverityColor('low');
      expect(colorFn('test')).toBe('[gray]test[/gray]');
    });

    it('should return white for unknown severity', () => {
      const colorFn = getSeverityColor('unknown');
      expect(colorFn('test')).toBe('[white]test[/white]');
    });
  });

  describe('getSeverityWeight', () => {
    it('should return 4 for critical', () => {
      expect(getSeverityWeight('critical')).toBe(4);
    });

    it('should return 3 for high', () => {
      expect(getSeverityWeight('high')).toBe(3);
    });

    it('should return 2 for medium', () => {
      expect(getSeverityWeight('medium')).toBe(2);
    });

    it('should return 1 for low', () => {
      expect(getSeverityWeight('low')).toBe(1);
    });

    it('should return 0 for unknown severity', () => {
      expect(getSeverityWeight('unknown')).toBe(0);
    });

    it('should allow sorting by weight', () => {
      const severities: Severity[] = ['low', 'critical', 'medium', 'high'];
      const sorted = [...severities].sort(
        (a, b) => getSeverityWeight(b) - getSeverityWeight(a)
      );
      expect(sorted).toEqual(['critical', 'high', 'medium', 'low']);
    });
  });
});
