/**
 * MCP Provider Mapping Tests
 *
 * Tests the provider name mapping between MCP API and internal system.
 */

import { describe, it, expect } from 'vitest';
import { mapMcpProviderToActual, mapActualProviderToMcp } from '../../../src/mcp/utils/provider-mapping.js';

describe('MCP Provider Mapping', () => {
  describe('mapMcpProviderToActual', () => {
    it('should map "gemini" to "gemini-cli"', () => {
      expect(mapMcpProviderToActual('gemini')).toBe('gemini-cli');
    });

    it('should map "claude" to "claude-code"', () => {
      expect(mapMcpProviderToActual('claude')).toBe('claude-code');
    });

    it('should map "openai" to "openai" (unchanged)', () => {
      expect(mapMcpProviderToActual('openai')).toBe('openai');
    });

    it('should return undefined for undefined input', () => {
      expect(mapMcpProviderToActual(undefined)).toBeUndefined();
    });

    it('should pass through unknown provider names unchanged', () => {
      expect(mapMcpProviderToActual('unknown-provider')).toBe('unknown-provider');
    });

    it('should handle empty string', () => {
      expect(mapMcpProviderToActual('')).toBe('');
    });
  });

  describe('mapActualProviderToMcp', () => {
    it('should map "gemini-cli" to "gemini"', () => {
      expect(mapActualProviderToMcp('gemini-cli')).toBe('gemini');
    });

    it('should map "claude-code" to "claude"', () => {
      expect(mapActualProviderToMcp('claude-code')).toBe('claude');
    });

    it('should map "openai" to "openai" (unchanged)', () => {
      expect(mapActualProviderToMcp('openai')).toBe('openai');
    });

    it('should pass through unknown provider names unchanged', () => {
      expect(mapActualProviderToMcp('unknown-provider')).toBe('unknown-provider');
    });

    it('should handle empty string', () => {
      expect(mapActualProviderToMcp('')).toBe('');
    });
  });

  describe('Bidirectional Mapping', () => {
    it('should map MCP -> Actual -> MCP correctly for gemini', () => {
      const mcpName = 'gemini';
      const actualName = mapMcpProviderToActual(mcpName);
      const backToMcp = mapActualProviderToMcp(actualName!);
      expect(backToMcp).toBe(mcpName);
    });

    it('should map MCP -> Actual -> MCP correctly for claude', () => {
      const mcpName = 'claude';
      const actualName = mapMcpProviderToActual(mcpName);
      const backToMcp = mapActualProviderToMcp(actualName!);
      expect(backToMcp).toBe(mcpName);
    });

    it('should map MCP -> Actual -> MCP correctly for openai', () => {
      const mcpName = 'openai';
      const actualName = mapMcpProviderToActual(mcpName);
      const backToMcp = mapActualProviderToMcp(actualName!);
      expect(backToMcp).toBe(mcpName);
    });

    it('should map Actual -> MCP -> Actual correctly for gemini-cli', () => {
      const actualName = 'gemini-cli';
      const mcpName = mapActualProviderToMcp(actualName);
      const backToActual = mapMcpProviderToActual(mcpName);
      expect(backToActual).toBe(actualName);
    });

    it('should map Actual -> MCP -> Actual correctly for claude-code', () => {
      const actualName = 'claude-code';
      const mcpName = mapActualProviderToMcp(actualName);
      const backToActual = mapMcpProviderToActual(mcpName);
      expect(backToActual).toBe(actualName);
    });
  });
});
