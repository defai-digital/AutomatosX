import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai-provider';
import { GeminiProvider } from '../../src/providers/gemini-provider';
import { ClaudeProvider } from '../../src/providers/claude-provider';
import type { ProviderConfig, ExecutionRequest } from '../../src/types/provider';

describe('Provider CLI Arguments (Phase 2)', () => {
  const baseConfig: ProviderConfig = {
    name: 'test-provider',
    enabled: true,
    priority: 1,
    timeout: 900000,
    command: 'test-command'
  };

  describe('OpenAI Provider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({ ...baseConfig, command: 'codex' });
    });

    describe('buildCLIArgs', () => {
      it('should build basic args with sandbox mode (v5.6.5: sandbox write fix)', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt'
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toEqual(['exec', '--sandbox', 'workspace-write']);
      });

      it('should include model parameter for cost optimization (v6.0.7 Phase 3)', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          model: 'gpt-4o'
        };

        const args = (provider as any).buildCLIArgs(request);

        // Phase 3: Model selection enabled for cost optimization
        expect(args).toContain('--model');
        expect(args).toContain('gpt-4o');
        expect(args).toEqual(['exec', '--sandbox', 'workspace-write', '--model', 'gpt-4o']);
      });

      it('should include maxTokens if specified', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          maxTokens: 2048
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('-c');
        expect(args).toContain('max_tokens=2048');
      });

      it('should include temperature if specified', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          temperature: 0.7
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('-c');
        expect(args).toContain('temperature=0.7');
      });


      it('should include all supported parameters including model (v6.0.7 Phase 3)', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          model: 'gpt-4o', // Phase 3: Model selection now supported
          maxTokens: 4096,
          temperature: 0.5
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('exec');
        expect(args).toContain('--sandbox');
        expect(args).toContain('workspace-write');
        // Phase 3: Model IS now passed for cost optimization
        expect(args).toContain('--model');
        expect(args).toContain('gpt-4o');
        // And maxTokens and temperature should be passed
        expect(args).toContain('-c');
        expect(args).toContain('max_tokens=4096');
        expect(args).toContain('temperature=0.5');
      });
    });

    describe('supportsParameter', () => {
      it('should support maxTokens', () => {
        expect((provider as any).supportsParameter('maxTokens')).toBe(true);
      });

      it('should support temperature', () => {
        expect((provider as any).supportsParameter('temperature')).toBe(true);
      });

      it('should not support topP', () => {
        expect((provider as any).supportsParameter('topP')).toBe(false);
      });
    });
  });

  describe('Gemini Provider', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider({ ...baseConfig, command: 'gemini' });
    });

    describe('buildCLIArgs', () => {
      it('should include auto_edit approval mode (v5.6.5: sandbox write fix)', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt'
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toEqual(['--approval-mode', 'auto_edit']);
      });

      it('should include approval mode even with maxTokens parameter', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          maxTokens: 2048
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toEqual(['--approval-mode', 'auto_edit']);
      });

      it('should include approval mode even with temperature parameter', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          temperature: 0.7
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toEqual(['--approval-mode', 'auto_edit']);
      });

      it('should include approval mode with all parameters', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          maxTokens: 4096,
          temperature: 0.5
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toEqual(['--approval-mode', 'auto_edit']);
      });
    });

    describe('supportsParameter', () => {
      it('should not support maxTokens', () => {
        expect((provider as any).supportsParameter('maxTokens')).toBe(false);
      });

      it('should not support temperature', () => {
        expect((provider as any).supportsParameter('temperature')).toBe(false);
      });

      it('should not support topP', () => {
        expect((provider as any).supportsParameter('topP')).toBe(false);
      });
    });
  });

  describe('Claude Provider', () => {
    let provider: ClaudeProvider;

    beforeEach(() => {
      provider = new ClaudeProvider({ ...baseConfig, command: 'claude' });
    });

    describe('buildCLIArgs', () => {
      it('should return --print flag with tools and directory access', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt'
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('--print');
        expect(args).toContain('--allowedTools');
        expect(args).toContain('Read Write Edit Bash Glob Grep');
        expect(args).toContain('--add-dir');
        expect(args).toContain(process.cwd());
      });

      it('should ignore maxTokens parameter', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          maxTokens: 2048
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('--print');
        expect(args).toContain('--allowedTools');
        expect(args).toContain('Read Write Edit Bash Glob Grep');
      });

      it('should ignore temperature parameter', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          temperature: 0.7
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('--print');
        expect(args).toContain('--allowedTools');
        expect(args).toContain('Read Write Edit Bash Glob Grep');
      });

      it('should ignore all parameters', () => {
        const request: ExecutionRequest = {
          prompt: 'test prompt',
          maxTokens: 4096,
          temperature: 0.5
        };

        const args = (provider as any).buildCLIArgs(request);

        expect(args).toContain('--print');
        expect(args).toContain('--allowedTools');
        expect(args).toContain('Read Write Edit Bash Glob Grep');
      });
    });

    describe('supportsParameter', () => {
      it('should not support maxTokens', () => {
        expect((provider as any).supportsParameter('maxTokens')).toBe(false);
      });

      it('should not support temperature', () => {
        expect((provider as any).supportsParameter('temperature')).toBe(false);
      });

      it('should not support topP', () => {
        expect((provider as any).supportsParameter('topP')).toBe(false);
      });
    });
  });

  describe('Parameter Edge Cases', () => {
    let openaiProvider: OpenAIProvider;

    beforeEach(() => {
      openaiProvider = new OpenAIProvider({ ...baseConfig, command: 'codex' });
    });

    it('should handle temperature = 0', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        temperature: 0
      };

      const args = (openaiProvider as any).buildCLIArgs(request);

      expect(args).toContain('temperature=0');
    });

    it('should handle maxTokens = 1', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        maxTokens: 1
      };

      const args = (openaiProvider as any).buildCLIArgs(request);

      expect(args).toContain('max_tokens=1');
    });


    it('should not include undefined parameters', () => {
      const request: ExecutionRequest = {
        prompt: 'test',
        temperature: undefined,
        maxTokens: undefined
      };

      const args = (openaiProvider as any).buildCLIArgs(request);

      expect(args).not.toContain('temperature');
      expect(args).not.toContain('max_tokens');
    });
  });
});
