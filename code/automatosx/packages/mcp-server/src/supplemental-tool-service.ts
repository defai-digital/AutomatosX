import type { SharedRuntimeService } from '@defai.digital/shared-runtime';
import { z } from 'zod';

const nonEmptyStringSchema = z.string().min(1);

export interface SupplementalToolService {
  queryResearch(input: {
    query: string;
    provider?: string;
    sessionId?: string;
  }): Promise<{ success: true; data: { query: string; answer: string; provider: string; timestamp: string } }>;
  fetchResearch(input: {
    url: string;
  }): Promise<{ success: true; data: { url: string; content: string; status: number; contentType: string | null } }>;
  synthesizeResearch(input: {
    topic: string;
    sources: Array<Record<string, unknown>>;
    provider?: string;
    sessionId?: string;
  }): Promise<{ success: true; data: { topic: string; synthesis: string; sourceCount: number; provider: string } }>;
  generateDesign(input: {
    designType: string;
    prompt: string;
    domain: string;
    sessionId?: string;
  }): Promise<{ success: true; data: { type: string; design: string; provider: string } }>;
}

export function createSupplementalToolService(config: {
  runtimeService: SharedRuntimeService;
  onDesignArtifact: (artifact: {
    type: string;
    domain: string;
    content: string;
    createdAt: string;
  }) => void;
}): SupplementalToolService {
  return {
    async queryResearch(input) {
      const result = await config.runtimeService.callProvider({
        provider: input.provider,
        prompt: `Research query: ${input.query}\n\nProvide a thorough, sourced answer with key findings and confidence assessment.`,
        systemPrompt: 'You are a research assistant. Provide accurate, well-structured answers with clear confidence indicators.',
        maxTokens: 2000,
        sessionId: input.sessionId,
        surface: 'mcp',
      });
      return {
        success: true,
        data: {
          query: input.query,
          answer: result.content,
          provider: result.provider,
          timestamp: new Date().toISOString(),
        },
      };
    },

    async fetchResearch(input) {
      if (!/^https?:\/\//i.test(input.url)) {
        throw new Error('Only http/https URLs are allowed');
      }
      const response = await fetch(input.url, { signal: AbortSignal.timeout(10_000) }).catch((error: unknown) => {
        throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      const text = await response.text();
      const content = text.length > 8000 ? `${text.slice(0, 8000)}\n[truncated]` : text;
      return {
        success: true,
        data: {
          url: input.url,
          content,
          status: response.status,
          contentType: response.headers.get('content-type'),
        },
      };
    },

    async synthesizeResearch(input) {
      const sourceSummary = input.sources
        .map((source, index) => `Source ${index + 1}: ${asOptionalString(source['content']) ?? ''}`)
        .join('\n\n');
      const result = await config.runtimeService.callProvider({
        provider: input.provider,
        prompt: `Synthesize the following sources on the topic: "${input.topic}"\n\n${sourceSummary}\n\nProvide a coherent synthesis with key insights.`,
        systemPrompt: 'You are a research synthesizer. Create clear, accurate syntheses that fairly represent all provided sources.',
        maxTokens: 2000,
        sessionId: input.sessionId,
        surface: 'mcp',
      });
      return {
        success: true,
        data: {
          topic: input.topic,
          synthesis: result.content,
          sourceCount: input.sources.length,
          provider: result.provider,
        },
      };
    },

    async generateDesign(input) {
      const result = await config.runtimeService.callProvider({
        prompt: input.prompt,
        systemPrompt: 'You are a senior software architect. Produce concise, opinionated design specifications with clear rationale.',
        maxTokens: 2000,
        sessionId: input.sessionId,
        surface: 'mcp',
      });
      config.onDesignArtifact({
        type: input.designType,
        domain: input.domain,
        content: result.content,
        createdAt: new Date().toISOString(),
      });
      return {
        success: true,
        data: {
          type: input.designType,
          design: result.content,
          provider: result.provider,
        },
      };
    },
  };
}

function asOptionalString(value: unknown): string | undefined {
  const result = nonEmptyStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
