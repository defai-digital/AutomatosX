import type { MpcToolResult } from './surface-types.js';
import {
  asRecordArray,
  asOptionalString,
  asString,
  asStringArray,
} from './tool-argument-parsers.js';
import type { SupplementalToolService } from './supplemental-tool-service.js';

export interface SupplementalSurfaceToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createSupplementalSurfaceToolService(config: {
  supplementalToolService: SupplementalToolService;
}): SupplementalSurfaceToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'research_query':
          return config.supplementalToolService.queryResearch({
            query: asString(args.query, 'query'),
            provider: asOptionalString(args.provider),
            sessionId: asOptionalString(args.sessionId),
          });
        case 'research_fetch':
          return config.supplementalToolService.fetchResearch({
            url: asString(args.url, 'url'),
          });
        case 'research_synthesize':
          return config.supplementalToolService.synthesizeResearch({
            topic: asString(args.topic, 'topic'),
            sources: asRecordArray(args.sources) ?? [],
            provider: asOptionalString(args.provider),
            sessionId: asOptionalString(args.sessionId),
          });
        case 'design_api':
        case 'design_architecture':
        case 'design_component':
        case 'design_schema': {
          const designType = toolName.split('_')[1]!;
          const prompts: Record<string, string> = {
            api: `Design a ${asOptionalString(args.style) ?? 'REST'} API for the "${asString(args.domain ?? args.name, 'domain')}" domain.\nRequirements: ${asString(args.requirements ?? args.purpose, 'requirements')}`,
            architecture: `Design the architecture for: ${asString(args.system, 'system')}${args.constraints ? `\nConstraints: ${asString(args.constraints, 'constraints')}` : ''}${args.pattern ? `\nPreferred pattern: ${asString(args.pattern, 'pattern')}` : ''}`,
            component: `Design the "${asString(args.name, 'name')}" component.\nPurpose: ${asString(args.purpose, 'purpose')}${args.dependencies ? `\nDependencies: ${(asStringArray(args.dependencies) ?? []).join(', ')}` : ''}`,
            schema: `Design a data schema for "${asString(args.entity, 'entity')}".\nFields: ${asString(args.fields, 'fields')}${args.constraints ? `\nConstraints: ${asString(args.constraints, 'constraints')}` : ''}`,
          };
          return config.supplementalToolService.generateDesign({
            designType,
            prompt: prompts[designType] ?? `Design: ${JSON.stringify(args)}`,
            domain: asOptionalString(args.domain ?? args.entity ?? args.name) ?? 'unknown',
            sessionId: asOptionalString(args.sessionId),
          });
        }
        default:
          return undefined;
      }
    },
  };
}
