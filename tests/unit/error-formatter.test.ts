/**
 * Error Formatter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatError,
  formatErrorJSON,
  formatErrorSummary,
  formatErrorList,
  printError,
  printErrorSummary,
  printErrorList
} from '../../src/utils/error-formatter.js';
import { ConfigError, ErrorCode, BaseError } from '../../src/utils/errors.js';

describe('Error Formatter', () => {
  describe('formatError', () => {
    it('should format error with code and message', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, { colors: false });

      expect(formatted).toContain('Error');
      expect(formatted).toContain('[E1000]');
      expect(formatted).toContain('Configuration file not found');
      expect(formatted).toContain('/path/to/config.json');
    });

    it('should include suggestions', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, { colors: false });

      expect(formatted).toContain('Suggestions');
      expect(formatted).toContain('automatosx init');
      expect(formatted).toContain('--config');
    });

    it('should hide suggestions when showSuggestions is false', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, {
        colors: false,
        showSuggestions: false
      });

      expect(formatted).not.toContain('Suggestions');
    });

    it('should hide error code when showCode is false', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, {
        colors: false,
        showCode: false
      });

      expect(formatted).not.toContain('[E1000]');
    });

    it('should include context in verbose mode', () => {
      const error = new BaseError(
        'Test error',
        ErrorCode.UNKNOWN_ERROR,
        [],
        { key: 'value', number: 42 }
      );

      const formatted = formatError(error, {
        colors: false,
        verbose: true
      });

      expect(formatted).toContain('Context');
      expect(formatted).toContain('key');
      expect(formatted).toContain('value');
      expect(formatted).toContain('42');
    });

    it('should include stack trace in verbose mode', () => {
      const error = new BaseError('Test error', ErrorCode.UNKNOWN_ERROR);
      const formatted = formatError(error, {
        colors: false,
        verbose: true
      });

      expect(formatted).toContain('Stack Trace');
    });

    it('should handle non-BaseError objects', () => {
      const error = new Error('Normal error');
      const formatted = formatError(error, { colors: false });

      expect(formatted).toContain('Error');
      expect(formatted).toContain('Normal error');
      expect(formatted).toContain('[E9999]'); // UNKNOWN_ERROR
    });

    it('should handle string errors', () => {
      const formatted = formatError('Something went wrong', { colors: false });

      expect(formatted).toContain('Error');
      expect(formatted).toContain('Something went wrong');
    });

    it('should format with colors option enabled', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, { colors: true });

      // Note: chalk auto-detects if terminal supports colors
      // In test environment, colors may be disabled
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('Error');
    });

    it('should format without colors when disabled', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const formatted = formatError(error, { colors: false });

      expect(formatted).toBeTruthy();
      expect(formatted).toContain('Error');
    });
  });

  describe('formatErrorJSON', () => {
    it('should format error as JSON', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const json = formatErrorJSON(error);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('ConfigError');
      expect(parsed.code).toBe('E1000');
      expect(parsed.message).toContain('Configuration file not found');
      expect(parsed.suggestions).toBeInstanceOf(Array);
      expect(parsed.context).toHaveProperty('path');
    });

    it('should handle non-BaseError objects', () => {
      const error = new Error('Normal error');
      const json = formatErrorJSON(error);
      const parsed = JSON.parse(json);

      expect(parsed.code).toBe('E9999');
      expect(parsed.message).toBe('Normal error');
    });

    it('should be valid JSON', () => {
      const error = ConfigError.invalid('Test reason');
      const json = formatErrorJSON(error);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('formatErrorSummary', () => {
    it('should format one-line summary', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const summary = formatErrorSummary(error, { colors: false });

      expect(summary).toContain('[E1000]');
      expect(summary).toContain('Configuration file not found');
      expect(summary).not.toContain('\n'); // Single line
      expect(summary).not.toContain('Suggestions'); // No suggestions in summary
    });

    it('should format with colors option enabled', () => {
      const error = ConfigError.notFound('/path/to/config.json');
      const summary = formatErrorSummary(error, { colors: true });

      expect(summary).toBeTruthy();
      expect(summary).toContain('[E1000]');
    });

    it('should handle non-BaseError objects', () => {
      const error = new Error('Test');
      const summary = formatErrorSummary(error, { colors: false });

      expect(summary).toContain('[E9999]');
      expect(summary).toContain('Test');
    });
  });

  describe('formatErrorList', () => {
    it('should format multiple errors', () => {
      const errors = [
        ConfigError.notFound('/config1.json'),
        ConfigError.notFound('/config2.json'),
        ConfigError.invalid('Test reason')
      ];

      const formatted = formatErrorList(errors, { colors: false });

      expect(formatted).toContain('3 Error(s) Occurred');
      expect(formatted).toContain('1.');
      expect(formatted).toContain('2.');
      expect(formatted).toContain('3.');
      expect(formatted).toContain('[E1000]');
      expect(formatted).toContain('[E1001]');
    });

    it('should handle empty error list', () => {
      const formatted = formatErrorList([], { colors: false });

      expect(formatted).toContain('0 Error(s) Occurred');
    });

    it('should handle single error', () => {
      const errors = [ConfigError.notFound('/config.json')];
      const formatted = formatErrorList(errors, { colors: false });

      expect(formatted).toContain('1 Error(s) Occurred');
    });

    it('should format with colors option enabled', () => {
      const errors = [ConfigError.notFound('/config.json')];
      const formatted = formatErrorList(errors, { colors: true });

      expect(formatted).toBeTruthy();
      expect(formatted).toContain('1 Error(s) Occurred');
    });
  });

  describe('Console Output', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should print error to console', () => {
      const error = ConfigError.notFound('/config.json');

      printError(error, { colors: false });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('Error');
      expect(output).toContain('[E1000]');
    });

    it('should print error summary to console', () => {
      const error = ConfigError.notFound('/config.json');

      printErrorSummary(error, { colors: false });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('[E1000]');
      expect(output).not.toContain('\n');
    });

    it('should print error list to console', () => {
      const errors = [
        ConfigError.notFound('/config1.json'),
        ConfigError.notFound('/config2.json')
      ];

      printErrorList(errors, { colors: false });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('2 Error(s) Occurred');
    });
  });
});
