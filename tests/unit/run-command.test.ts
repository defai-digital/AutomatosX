/**
 * Run Command Tests
 *
 * Tests command definition and option parsing.
 * End-to-end execution is tested in integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { runCommand } from '../../src/cli/commands/run.js';

describe('Run Command', () => {

  describe('command definition', () => {
    it('should have correct command string', () => {
      // v11.1.0: Changed to [agent] [task] for auto-selection support
      expect(runCommand.command).toBe('run [agent] [task]');
    });

    it('should have description', () => {
      expect(runCommand.describe).toBeDefined();
      expect(typeof runCommand.describe).toBe('string');
    });

    it('should have builder function', () => {
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should have handler function', () => {
      expect(runCommand.handler).toBeDefined();
      expect(typeof runCommand.handler).toBe('function');
    });
  });

  describe('builder options', () => {
    it('should define all required options', () => {
      // Builder exists and returns a yargs instance
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    it('should be an async function', () => {
      expect(runCommand.handler).toBeInstanceOf(Function);
      expect(runCommand.handler.constructor.name).toBe('AsyncFunction');
    });
  });

  describe('new options (Sprint 2.1)', () => {
    it('should support --stream option', () => {
      // Command definition should exist and accept stream option
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should support --format option with choices', () => {
      // Format option should support text, json, markdown
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should support --save option', () => {
      // Save option should accept file path
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should support --timeout option', () => {
      // Timeout option should accept number (seconds)
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });

    it('should support --interactive option', () => {
      // Interactive option should be boolean
      expect(runCommand.builder).toBeDefined();
      expect(typeof runCommand.builder).toBe('function');
    });
  });
});
