/**
 * Message Formatter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatSuccess,
  formatFailure,
  formatWarning,
  formatInfo,
  formatStep,
  formatHeader,
  formatKeyValue
} from '../../src/utils/message-formatter.js';

describe('Message Formatter', () => {
  describe('formatSuccess', () => {
    it('should format success message with icon and color', () => {
      const result = formatSuccess('Operation completed');
      expect(result).toContain('✓');
      expect(result).toContain('Operation completed');
    });

    it('should format without colors', () => {
      const result = formatSuccess('Done', { colors: false });
      expect(result).toBe('✓ Done');
    });

    it('should format without icon', () => {
      const result = formatSuccess('Done', { icon: false });
      expect(result).toContain('Done');
      expect(result).not.toContain('✓');
    });
  });

  describe('formatFailure', () => {
    it('should format failure message with icon', () => {
      const result = formatFailure('Operation failed');
      expect(result).toContain('✗');
      expect(result).toContain('Operation failed');
    });

    it('should format without colors', () => {
      const result = formatFailure('Failed', { colors: false });
      expect(result).toBe('✗ Failed');
    });

    it('should format without icon', () => {
      const result = formatFailure('Failed', { icon: false });
      expect(result).toContain('Failed');
      expect(result).not.toContain('✗');
    });
  });

  describe('formatWarning', () => {
    it('should format warning message with icon', () => {
      const result = formatWarning('Be careful');
      expect(result).toContain('⚠');
      expect(result).toContain('Be careful');
    });

    it('should format without colors', () => {
      const result = formatWarning('Warning', { colors: false });
      expect(result).toBe('⚠ Warning');
    });
  });

  describe('formatInfo', () => {
    it('should format info message with icon', () => {
      const result = formatInfo('Information');
      expect(result).toContain('ℹ');
      expect(result).toContain('Information');
    });

    it('should format without colors', () => {
      const result = formatInfo('Info', { colors: false });
      expect(result).toBe('ℹ Info');
    });
  });

  describe('formatStep', () => {
    it('should format step with indentation', () => {
      const result = formatStep('Step 1: Initialize', { colors: false });
      expect(result).toBe('   Step 1: Initialize');
    });

    it('should include color formatting', () => {
      const result = formatStep('Step 2: Process');
      expect(result).toContain('Step 2: Process');
    });
  });

  describe('formatHeader', () => {
    it('should format header with newline', () => {
      const result = formatHeader('Configuration', { colors: false });
      expect(result).toBe('\nConfiguration');
    });

    it('should include color formatting', () => {
      const result = formatHeader('Settings');
      expect(result).toContain('Settings');
    });
  });

  describe('formatKeyValue', () => {
    it('should format key-value pair', () => {
      const result = formatKeyValue('Name', 'AutomatosX', { colors: false });
      expect(result).toBe('Name: AutomatosX');
    });

    it('should handle numeric values', () => {
      const result = formatKeyValue('Count', '42', { colors: false });
      expect(result).toBe('Count: 42');
    });

    it('should include color formatting', () => {
      const result = formatKeyValue('Version', '4.0');
      expect(result).toContain('Version');
      expect(result).toContain('4.0');
    });
  });
});
