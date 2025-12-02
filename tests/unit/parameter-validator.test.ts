import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParameterValidator } from '../../src/core/parameter-validator';
import type { ExecutionRequest } from '../../src/types/provider';
import { logger } from '../../src/utils/logger';

describe('ParameterValidator', () => {
  // Spy on logger.warn
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('validateAndWarn', () => {
    it('should not warn for OpenAI with maxTokens', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 2048
      };

      ParameterValidator.validateAndWarn('openai', request);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not warn for OpenAI with temperature', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        temperature: 0.7
      };

      ParameterValidator.validateAndWarn('openai', request);

      expect(warnSpy).not.toHaveBeenCalled();
    });


    it('should warn for Gemini with maxTokens', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 2048
      };

      ParameterValidator.validateAndWarn('gemini-cli', request);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support maxTokens')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('2048')
      );
    });

    it('should warn for Gemini with temperature', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        temperature: 0.7
      };

      ParameterValidator.validateAndWarn('gemini-cli', request);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support temperature')
      );
    });

    it('should warn for Claude with maxTokens', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 4096
      };

      ParameterValidator.validateAndWarn('claude-code', request);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support maxTokens')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('4096')
      );
    });

    it('should not warn when warnOnUnsupported is false', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 2048
      };

      ParameterValidator.validateAndWarn('gemini-cli', request, false);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should warn for unknown provider', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 2048
      };

      ParameterValidator.validateAndWarn('unknown-provider', request);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider')
      );
    });

    it('should handle multiple unsupported parameters', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 2048,
        temperature: 0.5
      };

      ParameterValidator.validateAndWarn('gemini-cli', request);

      // Should warn 2 times (one for each parameter)
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProviderSupport', () => {
    it('should return support info for OpenAI', () => {
      const support = ParameterValidator.getProviderSupport('openai');

      expect(support).toBeDefined();
      expect(support?.name).toBe('Codex CLI');
      expect(support?.supportsMaxTokens).toBe(true);
      expect(support?.supportsTemperature).toBe(true);
      expect(support?.supportsTopP).toBe(false);  // v5.0.6: Removed for simplification
    });

    it('should return support info for Gemini', () => {
      const support = ParameterValidator.getProviderSupport('gemini-cli');

      expect(support).toBeDefined();
      expect(support?.name).toBe('Google Gemini');
      expect(support?.supportsMaxTokens).toBe(false);
      expect(support?.supportsTemperature).toBe(false);
      expect(support?.supportsTopP).toBe(false);
    });

    it('should return support info for Claude', () => {
      const support = ParameterValidator.getProviderSupport('claude-code');

      expect(support).toBeDefined();
      expect(support?.name).toBe('Claude Code');
      expect(support?.supportsMaxTokens).toBe(false);
    });

    it('should return undefined for unknown provider', () => {
      const support = ParameterValidator.getProviderSupport('unknown');

      expect(support).toBeUndefined();
    });
  });

  describe('supportsParameter', () => {
    it('should return true for OpenAI maxTokens', () => {
      expect(ParameterValidator.supportsParameter('openai', 'maxTokens')).toBe(true);
    });

    it('should return true for OpenAI temperature', () => {
      expect(ParameterValidator.supportsParameter('openai', 'temperature')).toBe(true);
    });

    it('should return false for OpenAI topP (removed in v5.0.6)', () => {
      expect(ParameterValidator.supportsParameter('openai', 'topP')).toBe(false);
    });

    it('should return false for Gemini maxTokens', () => {
      expect(ParameterValidator.supportsParameter('gemini-cli', 'maxTokens')).toBe(false);
    });

    it('should return false for Claude temperature', () => {
      expect(ParameterValidator.supportsParameter('claude-code', 'temperature')).toBe(false);
    });

    it('should return false for unknown provider', () => {
      expect(ParameterValidator.supportsParameter('unknown', 'maxTokens')).toBe(false);
    });
  });

  describe('getProvidersSupporting', () => {
    it('should return providers supporting maxTokens', () => {
      const providers = ParameterValidator.getProvidersSupporting('maxTokens');

      expect(providers).toContain('openai');
      expect(providers).not.toContain('gemini-cli');
      expect(providers).not.toContain('claude-code');
    });

    it('should return providers supporting temperature', () => {
      const providers = ParameterValidator.getProvidersSupporting('temperature');

      expect(providers).toContain('openai');
      expect(providers).not.toContain('gemini-cli');
      expect(providers).not.toContain('claude-code');
    });

    it('should return providers supporting topP (none in v5.0.6)', () => {
      const providers = ParameterValidator.getProvidersSupporting('topP');

      expect(providers.length).toBe(0);
    });
  });

  describe('getSupportMatrix', () => {
    it('should return complete support matrix', () => {
      const matrix = ParameterValidator.getSupportMatrix();

      expect(matrix).toBeDefined();
      expect(matrix['openai']).toBeDefined();
      expect(matrix['gemini-cli']).toBeDefined();
      expect(matrix['claude-code']).toBeDefined();
    });

    it('should return a copy (not reference)', () => {
      const matrix1 = ParameterValidator.getSupportMatrix();
      const matrix2 = ParameterValidator.getSupportMatrix();

      expect(matrix1).not.toBe(matrix2);
      expect(matrix1).toEqual(matrix2);
    });
  });
});
