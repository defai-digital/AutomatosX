/**
 * Discuss CLI Command Tests
 *
 * Tests for the ax discuss command functionality.
 */

import { describe, it, expect } from 'vitest';
import { discussCommand } from '@automatosx/cli';
import type { CLIOptions } from '@automatosx/cli';

// Default CLI options for testing
const defaultOptions: CLIOptions = {
  help: false,
  version: false,
  verbose: false,
  format: 'text',
  workflowDir: undefined,
  workflowId: undefined,
  traceId: undefined,
  limit: undefined,
  input: undefined,
  iterate: false,
  maxIterations: undefined,
  maxTime: undefined,
  noContext: false,
  category: undefined,
  tags: undefined,
  agent: undefined,
  task: undefined,
  core: undefined,
  maxTokens: undefined,
};

// ============================================================================
// Help Tests
// ============================================================================

describe('Discuss Command', () => {
  describe('Help', () => {
    it('should show help when no arguments provided', async () => {
      const result = await discussCommand([], defaultOptions);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Discuss Command');
      expect(result.message).toContain('Usage:');
      expect(result.message).toContain('--providers');
      expect(result.message).toContain('--pattern');
    });

    it('should show help when help argument provided', async () => {
      const result = await discussCommand(['help'], defaultOptions);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Discuss Command');
    });

    it('should show help when --help option provided', async () => {
      const result = await discussCommand(['some', 'topic'], { ...defaultOptions, help: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Discuss Command');
    });

    it('should list available providers in help', async () => {
      const result = await discussCommand([], defaultOptions);

      expect(result.message).toContain('Available Providers');
      expect(result.message).toContain('claude');
      expect(result.message).toContain('glm');
    });

    it('should list discussion patterns in help', async () => {
      const result = await discussCommand([], defaultOptions);

      expect(result.message).toContain('Discussion Patterns');
      expect(result.message).toContain('synthesis');
      expect(result.message).toContain('debate');
      expect(result.message).toContain('critique');
      expect(result.message).toContain('voting');
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Validation', () => {
    it('should fail when topic is empty', async () => {
      const result = await discussCommand([''], defaultOptions);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Topic is required');
    });

    it('should fail with unknown provider', async () => {
      const result = await discussCommand(
        ['--providers', 'unknown-provider,claude', 'Test topic'],
        defaultOptions
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown provider');
      expect(result.message).toContain('unknown-provider');
    });

    it('should fail with only one provider', async () => {
      const result = await discussCommand(
        ['--providers', 'claude', 'Test topic'],
        defaultOptions
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('At least 2 providers');
    });
  });

  // ============================================================================
  // Argument Parsing Tests
  // ============================================================================

  describe('Argument Parsing', () => {
    // Note: We test parsing by using invalid providers, which causes
    // the command to fail at validation rather than execution (avoiding timeouts)

    it('should parse topic from positional argument', async () => {
      // Use invalid provider to test parsing without execution timeout
      const result = await discussCommand(
        ['--providers', 'invalid1,invalid2', 'What is the best programming language?'],
        defaultOptions
      );

      // Should fail on invalid provider, not on topic parsing
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown provider');
    });

    it('should parse multi-word topic from multiple args', async () => {
      const result = await discussCommand(
        ['--providers', 'invalid1,invalid2', 'What', 'is', 'the', 'best', 'approach?'],
        defaultOptions
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown provider');
    });

    it('should parse --providers flag', async () => {
      const result = await discussCommand(
        ['--providers', 'invalid1,invalid2', 'Test topic'],
        defaultOptions
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid1');
    });

    it.skip('should accept valid provider names', async () => {
      // SKIPPED: This test actually spawns provider processes which timeout in CI
      // This will still fail because providers are not available,
      // but validates the provider name parsing works
      const result = await discussCommand(
        ['--providers', 'claude,glm', 'Test topic'],
        defaultOptions
      );

      // Either succeeds in getting past validation or fails on availability
      expect(result.exitCode).toBeDefined();
    });

    it('should parse --pattern flag with invalid providers', async () => {
      const result = await discussCommand(
        ['--pattern', 'voting', '--providers', 'invalid1,invalid2', 'Which is better?'],
        defaultOptions
      );

      expect(result.success).toBe(false);
    });

    it('should parse --rounds flag with invalid providers', async () => {
      const result = await discussCommand(
        ['--rounds', '3', '--providers', 'invalid1,invalid2', 'Test topic'],
        defaultOptions
      );

      expect(result.success).toBe(false);
    });

    it('should parse --consensus flag with invalid providers', async () => {
      const result = await discussCommand(
        ['--consensus', 'voting', '--providers', 'invalid1,invalid2', 'Test topic'],
        defaultOptions
      );

      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Output Format Tests
  // ============================================================================

  describe('Output Format', () => {
    it('should return structured data for JSON format', async () => {
      const result = await discussCommand([], { ...defaultOptions, format: 'json' });

      // Help returns undefined data
      expect(result.data).toBeUndefined();
    });
  });
});
