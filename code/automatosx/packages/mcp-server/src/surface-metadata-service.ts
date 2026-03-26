import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  McpPromptDefinition,
  McpPromptResult,
  McpResourceContent,
  McpResourceDefinition,
  McpToolDefinition,
} from './surface-types.js';
import type { SharedRuntimeService } from '@defai.digital/shared-runtime';

const DEFAULT_TOOL_PREFIX = 'ax_';
const nonEmptyStringSchema = z.string().min(1);

const RESOURCE_URIS = {
  workspaceConfig: 'ax://workspace/config',
  workspaceMcp: 'ax://workspace/mcp',
  workspaceContext: 'ax://workspace/ax-md',
  workflowCatalog: 'ax://workflow/catalog',
  recentTraces: 'ax://trace/recent',
} as const;

const PROMPT_DEFINITIONS: McpPromptDefinition[] = [
  {
    name: 'workflow_run',
    description: 'Guide a client to call the v14 workflow runtime with explicit workflow and input context.',
    arguments: [
      { name: 'workflowId', description: 'Workflow id to execute.', required: true },
      { name: 'goal', description: 'Goal or request for the workflow run.', required: true },
    ],
  },
  {
    name: 'workflow_architect',
    description: 'Prepare an architecture-planning request for the architect workflow.',
    arguments: [
      { name: 'requirement', description: 'Architecture requirement or change request.', required: true },
    ],
  },
  {
    name: 'review_analyze',
    description: 'Prepare a deterministic v14 review request for one or more paths.',
    arguments: [
      { name: 'paths', description: 'Comma-separated file or directory paths.', required: true },
      { name: 'focus', description: 'Review focus such as security or correctness.' },
    ],
  },
  {
    name: 'discuss_synthesize',
    description: 'Prepare a top-level discussion request with topic, providers, and optional context.',
    arguments: [
      { name: 'topic', description: 'Discussion topic.', required: true },
      { name: 'providers', description: 'Comma-separated providers to use.' },
      { name: 'context', description: 'Optional discussion context.' },
    ],
  },
];

export interface McpSurfaceMetadataService {
  listTools(): string[];
  listToolDefinitions(): McpToolDefinition[];
  resolveCanonicalToolName(toolName: string): string;
  getToolDefinition(toolName: string): McpToolDefinition | undefined;
  listResources(): McpResourceDefinition[];
  readResource(uri: string): Promise<McpResourceContent>;
  listPrompts(): McpPromptDefinition[];
  getPrompt(name: string, args?: Record<string, unknown>): Promise<McpPromptResult>;
}

export function createMcpSurfaceMetadataService(config: {
  basePath: string;
  runtimeService: SharedRuntimeService;
  toolDefinitions: McpToolDefinition[];
  toolPrefix?: string;
}): McpSurfaceMetadataService {
  const requestedToolPrefix = resolveToolPrefix(config.toolPrefix);
  const aliasDefinitions = requestedToolPrefix === undefined
    ? []
    : config.toolDefinitions.map((definition) => ({
      ...definition,
      name: toPrefixedToolName(definition.name, requestedToolPrefix),
      description: `${definition.description} Alias for ${definition.name}.`,
    }));
  const toolDefinitions = [...config.toolDefinitions, ...aliasDefinitions];
  const canonicalToolDefinitionMap = new Map(
    config.toolDefinitions.map((definition) => [definition.name, definition] as const),
  );
  const aliasToCanonicalMap = new Map<string, string>();

  for (const definition of config.toolDefinitions) {
    aliasToCanonicalMap.set(
      toPrefixedToolName(definition.name, DEFAULT_TOOL_PREFIX),
      definition.name,
    );
    if (requestedToolPrefix !== undefined) {
      aliasToCanonicalMap.set(
        toPrefixedToolName(definition.name, requestedToolPrefix),
        definition.name,
      );
    }
  }

  return {
    listTools() {
      return toolDefinitions.map((definition) => definition.name);
    },

    listToolDefinitions() {
      return toolDefinitions.map((definition) => ({ ...definition }));
    },

    resolveCanonicalToolName(toolName: string) {
      return aliasToCanonicalMap.get(toolName) ?? toolName;
    },

    getToolDefinition(toolName: string) {
      return canonicalToolDefinitionMap.get(toolName);
    },

    listResources() {
      return [
        {
          uri: RESOURCE_URIS.workspaceConfig,
          name: 'Workspace Config',
          description: 'The local AutomatosX workspace configuration file.',
          mimeType: 'application/json',
        },
        {
          uri: RESOURCE_URIS.workspaceMcp,
          name: 'Local MCP Config',
          description: 'The local AutomatosX MCP metadata file.',
          mimeType: 'application/json',
        },
        {
          uri: RESOURCE_URIS.workspaceContext,
          name: 'Project Agent Instructions',
          description: 'The AGENTS.md project instruction file written by ax setup.',
          mimeType: 'text/markdown',
        },
        {
          uri: RESOURCE_URIS.workflowCatalog,
          name: 'Workflow Catalog',
          description: 'Shared-runtime view of discovered workflows.',
          mimeType: 'application/json',
        },
        {
          uri: RESOURCE_URIS.recentTraces,
          name: 'Recent Traces',
          description: 'Recent trace summary from the shared trace store.',
          mimeType: 'application/json',
        },
      ];
    },

    async readResource(uri) {
      switch (uri) {
        case RESOURCE_URIS.workspaceConfig:
          return {
            uri,
            mimeType: 'application/json',
            text: await readWorkspaceFile(join(config.basePath, '.automatosx', 'config.json')),
          };
        case RESOURCE_URIS.workspaceMcp:
          return {
            uri,
            mimeType: 'application/json',
            text: await readWorkspaceFile(join(config.basePath, '.automatosx', 'mcp.json')),
          };
        case RESOURCE_URIS.workspaceContext:
          return {
            uri,
            mimeType: 'text/markdown',
            text: await readWorkspaceFile(join(config.basePath, 'AGENTS.md')),
          };
        case RESOURCE_URIS.workflowCatalog:
          return {
            uri,
            mimeType: 'application/json',
            text: `${JSON.stringify(await config.runtimeService.listWorkflows({ basePath: config.basePath }), null, 2)}\n`,
          };
        case RESOURCE_URIS.recentTraces:
          return {
            uri,
            mimeType: 'application/json',
            text: `${JSON.stringify(await config.runtimeService.listTraces(10), null, 2)}\n`,
          };
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    },

    listPrompts() {
      return PROMPT_DEFINITIONS.map((prompt) => ({
        ...prompt,
        arguments: prompt.arguments?.map((argument) => ({ ...argument })),
      }));
    },

    async getPrompt(name, args = {}) {
      switch (name) {
        case 'workflow_run': {
          const workflowId = asString(args.workflowId, 'workflowId');
          const goal = asString(args.goal, 'goal');
          return {
            description: 'Prompt a client to run a v14 workflow with explicit runtime context.',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: [
                    `Run workflow "${workflowId}" through the v14 shared runtime.`,
                    `Goal: ${goal}`,
                    'Use the workflow_run tool and pass a structured input object.',
                  ].join('\n'),
                },
              },
            ],
          };
        }
        case 'workflow_architect': {
          const requirement = asString(args.requirement, 'requirement');
          return {
            description: 'Prompt a client to plan architecture work through the architect workflow.',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: [
                    'Prepare an architecture plan using the architect workflow.',
                    `Requirement: ${requirement}`,
                    'Include decision framing, boundaries, risks, and implementation sequencing.',
                  ].join('\n'),
                },
              },
            ],
          };
        }
        case 'review_analyze': {
          const paths = asString(args.paths, 'paths');
          const focus = asOptionalString(args.focus) ?? 'all';
          return {
            description: 'Prompt a client to run a deterministic v14 review.',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: [
                    'Run a deterministic review with the v14 review surface.',
                    `Paths: ${paths}`,
                    `Focus: ${focus}`,
                    'Persist findings and review artifacts.',
                  ].join('\n'),
                },
              },
            ],
          };
        }
        case 'discuss_synthesize': {
          const topic = asString(args.topic, 'topic');
          const providers = asOptionalString(args.providers) ?? 'default providers';
          const context = asOptionalString(args.context);
          return {
            description: 'Prompt a client to run a top-level multi-provider discussion.',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: [
                    'Run a v14 discussion and synthesize the result.',
                    `Topic: ${topic}`,
                    `Providers: ${providers}`,
                    context === undefined ? undefined : `Context: ${context}`,
                  ].filter((line): line is string => line !== undefined).join('\n'),
                },
              },
            ],
          };
        }
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    },
  };
}

function resolveToolPrefix(explicitPrefix: string | undefined): string | undefined {
  if (typeof explicitPrefix === 'string') {
    return explicitPrefix.trim().length > 0 ? explicitPrefix : undefined;
  }
  const envPrefix = process.env.AX_MCP_TOOL_PREFIX;
  return typeof envPrefix === 'string' && envPrefix.trim().length > 0 ? envPrefix : undefined;
}

function toPrefixedToolName(toolName: string, prefix: string): string {
  return `${prefix}${toolName.replace(/[.]/g, '_')}`;
}

async function readWorkspaceFile(path: string): Promise<string> {
  await access(path);
  return readFile(path, 'utf8');
}

function asString(value: unknown, field: string): string {
  const result = nonEmptyStringSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${field} is required`);
  }
  return result.data;
}

function asOptionalString(value: unknown): string | undefined {
  const result = nonEmptyStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
