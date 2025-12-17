import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';

/**
 * API design tool definition
 */
export const designApiTool: MCPTool = {
  name: 'design_api',
  description: 'Generate API design artifacts (OpenAPI/AsyncAPI specifications)',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'API name',
      },
      description: {
        type: 'string',
        description: 'API description',
      },
      endpoints: {
        type: 'array',
        description: 'List of API endpoints',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            },
            summary: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['path', 'method', 'summary'],
        },
      },
      baseUrl: {
        type: 'string',
        description: 'Base URL for the API',
      },
      version: {
        type: 'string',
        description: 'API version',
        default: '1.0.0',
      },
      format: {
        type: 'string',
        description: 'Output format (openapi, asyncapi)',
        enum: ['openapi', 'asyncapi'],
        default: 'openapi',
      },
      outputPath: {
        type: 'string',
        description: 'Optional file path to write the design',
      },
    },
    required: ['name', 'endpoints'],
  },
};

/**
 * Component design tool definition
 */
export const designComponentTool: MCPTool = {
  name: 'design_component',
  description: 'Generate component design (interface, implementation skeleton)',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Component name',
      },
      type: {
        type: 'string',
        description: 'Component type',
        enum: [
          'function',
          'class',
          'module',
          'service',
          'controller',
          'repository',
          'factory',
          'adapter',
          'hook',
          'component',
          'other',
        ],
      },
      description: {
        type: 'string',
        description: 'Component description and purpose',
      },
      inputs: {
        type: 'array',
        description: 'Input parameters',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' },
            required: { type: 'boolean', default: true },
          },
          required: ['name', 'type'],
        },
      },
      outputs: {
        type: 'array',
        description: 'Output values',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'type'],
        },
      },
      dependencies: {
        type: 'array',
        description: 'Dependencies (packages, services)',
        items: { type: 'string' },
      },
      patterns: {
        type: 'array',
        description: 'Design patterns to apply',
        items: { type: 'string' },
      },
      language: {
        type: 'string',
        description: 'Programming language',
        enum: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'other'],
        default: 'typescript',
      },
      outputPath: {
        type: 'string',
        description: 'Optional file path to write the design',
      },
    },
    required: ['name', 'type', 'description'],
  },
};

/**
 * Schema design tool definition
 */
export const designSchemaTool: MCPTool = {
  name: 'design_schema',
  description: 'Generate data schema design (Zod, JSON Schema, TypeScript types)',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Schema name',
      },
      description: {
        type: 'string',
        description: 'Schema description',
      },
      fields: {
        type: 'array',
        description: 'Schema fields',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'string',
                'number',
                'integer',
                'boolean',
                'array',
                'object',
                'null',
                'date',
                'datetime',
                'uuid',
                'email',
                'url',
                'enum',
                'ref',
              ],
            },
            description: { type: 'string' },
            required: { type: 'boolean', default: false },
            nullable: { type: 'boolean', default: false },
            enumValues: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['name', 'type'],
        },
      },
      format: {
        type: 'string',
        description: 'Output format',
        enum: ['zod', 'json-schema', 'typescript', 'prisma', 'drizzle'],
        default: 'zod',
      },
      outputPath: {
        type: 'string',
        description: 'Optional file path to write the schema',
      },
    },
    required: ['name', 'fields'],
  },
};

/**
 * Architecture design tool definition
 */
export const designArchitectureTool: MCPTool = {
  name: 'design_architecture',
  description: 'Generate architecture design diagrams and documentation',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Architecture name',
      },
      description: {
        type: 'string',
        description: 'Architecture description',
      },
      pattern: {
        type: 'string',
        description: 'Architecture pattern',
        enum: [
          'hexagonal',
          'clean',
          'layered',
          'microservices',
          'event-driven',
          'cqrs',
          'ddd',
          'mvc',
          'mvvm',
          'pipe-filter',
          'other',
        ],
      },
      components: {
        type: 'array',
        description: 'Architecture components',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'domain',
                'application',
                'infrastructure',
                'presentation',
                'adapter',
                'port',
                'service',
                'database',
                'queue',
                'cache',
                'external',
              ],
            },
            description: { type: 'string' },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['id', 'name', 'type'],
        },
      },
      format: {
        type: 'string',
        description: 'Output format for diagram',
        enum: ['mermaid', 'plantuml', 'markdown', 'c4'],
        default: 'mermaid',
      },
      outputPath: {
        type: 'string',
        description: 'Optional file path to write the design',
      },
    },
    required: ['name', 'description', 'pattern', 'components'],
  },
};

/**
 * Design list tool definition
 */
export const designListTool: MCPTool = {
  name: 'design_list',
  description: 'List generated design artifacts',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Filter by design type',
        enum: ['api', 'component', 'schema', 'architecture', 'flow', 'data-model', 'interface', 'other'],
      },
      status: {
        type: 'string',
        description: 'Filter by status',
        enum: ['draft', 'review', 'approved', 'implemented', 'deprecated'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 50,
      },
    },
  },
};

// In-memory storage for design artifacts
const designStore = new Map<string, DesignRecord>();

interface DesignRecord {
  designId: string;
  type: string;
  format: string;
  name: string;
  description?: string;
  content: string;
  status: string;
  createdAt: string;
}

/**
 * Handler for design_api tool
 */
export const handleDesignApi: ToolHandler = async (args) => {
  const name = args.name as string;
  const description = (args.description as string) ?? '';
  const endpoints = args.endpoints as Array<{
    path: string;
    method: string;
    summary: string;
    description?: string;
  }>;
  const baseUrl = (args.baseUrl as string) ?? 'http://localhost:3000';
  const version = (args.version as string) ?? '1.0.0';
  const format = (args.format as string) ?? 'openapi';

  try {
    const designId = randomUUID();

    // Generate OpenAPI spec
    const openApiSpec = {
      openapi: '3.0.3',
      info: {
        title: name,
        description,
        version,
      },
      servers: [{ url: baseUrl }],
      paths: endpoints.reduce(
        (acc, endpoint) => {
          const path = endpoint.path;
          if (acc[path] === undefined) {
            acc[path] = {};
          }
          acc[path][endpoint.method.toLowerCase()] = {
            summary: endpoint.summary,
            description: endpoint.description,
            responses: {
              '200': { description: 'Successful response' },
            },
          };
          return acc;
        },
        {} as Record<string, Record<string, unknown>>
      ),
    };

    const content = JSON.stringify(openApiSpec, null, 2);

    // Store design
    designStore.set(designId, {
      designId,
      type: 'api',
      format,
      name,
      description,
      content,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              designId,
              name,
              format,
              content,
              createdAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'GENERATION_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for design_component tool
 */
export const handleDesignComponent: ToolHandler = async (args) => {
  const name = args.name as string;
  const type = args.type as string;
  const description = args.description as string;
  const inputs = (args.inputs as Array<{ name: string; type: string; description?: string; required?: boolean }>) ?? [];
  const outputs = (args.outputs as Array<{ name: string; type: string; description?: string }>) ?? [];
  const language = (args.language as string) ?? 'typescript';

  try {
    const designId = randomUUID();

    // Generate TypeScript interface
    const inputTypes = inputs.map((i) => `  ${i.name}${i.required === false ? '?' : ''}: ${i.type};`).join('\n');
    const outputType = outputs.length > 0 ? outputs[0]?.type ?? 'void' : 'void';

    const interfaceCode = `/**
 * ${description}
 */
export interface ${name}Input {
${inputTypes || '  // No inputs defined'}
}

export interface ${name}Output {
${outputs.map((o) => `  ${o.name}: ${o.type};`).join('\n') || '  // No outputs defined'}
}

export interface I${name} {
  execute(input: ${name}Input): Promise<${outputType}>;
}`;

    const implementationCode = `import type { I${name}, ${name}Input, ${name}Output } from './${name}.interface.js';

/**
 * ${description}
 *
 * TODO: Implement the business logic for this component.
 */
export class ${name} implements I${name} {
  async execute(input: ${name}Input): Promise<${outputType}> {
    // TODO: Replace this placeholder with actual implementation
    console.warn('[${name}] Using placeholder implementation - real logic needed');

    // Return a placeholder response indicating implementation is needed
    // Remove this and implement actual business logic
    return {
      success: false,
      message: '${name} implementation required',
      input,
    } as unknown as ${outputType};
  }
}`;

    const content = `// Interface\n${interfaceCode}\n\n// Implementation\n${implementationCode}`;

    // Store design
    designStore.set(designId, {
      designId,
      type: 'component',
      format: language,
      name,
      description,
      content,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              designId,
              name,
              type,
              interface: interfaceCode,
              implementation: implementationCode,
              createdAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'GENERATION_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for design_schema tool
 */
export const handleDesignSchema: ToolHandler = async (args) => {
  const name = args.name as string;
  const description = (args.description as string) ?? '';
  const fields = args.fields as Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    nullable?: boolean;
    enumValues?: string[];
  }>;
  const format = (args.format as string) ?? 'zod';

  try {
    const designId = randomUUID();

    // Generate Zod schema
    const zodFieldMap: Record<string, string> = {
      string: 'z.string()',
      number: 'z.number()',
      integer: 'z.number().int()',
      boolean: 'z.boolean()',
      array: 'z.array(z.unknown())',
      object: 'z.object({})',
      null: 'z.null()',
      date: 'z.date()',
      datetime: 'z.string().datetime()',
      uuid: 'z.string().uuid()',
      email: 'z.string().email()',
      url: 'z.string().url()',
      enum: 'z.enum([])',
      ref: 'z.lazy(() => Schema)',
    };

    const schemaFields = fields
      .map((f) => {
        let zodType = zodFieldMap[f.type] ?? 'z.unknown()';

        if (f.type === 'enum' && f.enumValues !== undefined && f.enumValues.length > 0) {
          zodType = `z.enum([${f.enumValues.map((v) => `'${v}'`).join(', ')}])`;
        }

        if (f.nullable === true) {
          zodType += '.nullable()';
        }

        if (f.required === false) {
          zodType += '.optional()';
        }

        return `  ${f.name}: ${zodType},`;
      })
      .join('\n');

    const content = `import { z } from 'zod';

/**
 * ${description}
 */
export const ${name}Schema = z.object({
${schemaFields}
});

export type ${name} = z.infer<typeof ${name}Schema>;`;

    // Store design
    designStore.set(designId, {
      designId,
      type: 'schema',
      format,
      name,
      description,
      content,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              designId,
              name,
              format,
              content,
              createdAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'GENERATION_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for design_architecture tool
 */
export const handleDesignArchitecture: ToolHandler = async (args) => {
  const name = args.name as string;
  const description = args.description as string;
  const pattern = args.pattern as string;
  const components = args.components as Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
    dependencies?: string[];
  }>;
  const format = (args.format as string) ?? 'mermaid';

  try {
    const designId = randomUUID();

    // Generate Mermaid diagram
    const componentLines = components.map((c) => `  ${c.id}[${c.name}]`).join('\n');
    const dependencyLines = components
      .flatMap((c) =>
        (c.dependencies ?? []).map((dep) => `  ${c.id} --> ${dep}`)
      )
      .join('\n');

    const diagram = `graph TD
  subgraph ${name}
${componentLines}
  end

${dependencyLines}`;

    const documentation = `# ${name}

## Overview
${description}

## Architecture Pattern
**${pattern}**

## Components

${components.map((c) => `### ${c.name}
- **Type**: ${c.type}
- **Description**: ${c.description ?? 'N/A'}
- **Dependencies**: ${(c.dependencies ?? []).join(', ') || 'None'}
`).join('\n')}

## Diagram

\`\`\`mermaid
${diagram}
\`\`\`
`;

    // Store design
    designStore.set(designId, {
      designId,
      type: 'architecture',
      format,
      name,
      description,
      content: documentation,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              designId,
              name,
              pattern,
              diagram,
              documentation,
              createdAt: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'GENERATION_FAILED',
            message,
            name,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for design_list tool
 */
export const handleDesignList: ToolHandler = async (args) => {
  const type = args.type as string | undefined;
  const status = args.status as string | undefined;
  const limit = (args.limit as number) ?? 50;

  try {
    let designs = Array.from(designStore.values());

    if (type !== undefined) {
      designs = designs.filter((d) => d.type === type);
    }
    if (status !== undefined) {
      designs = designs.filter((d) => d.status === status);
    }

    designs = designs.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              designs: designs.map((d) => ({
                designId: d.designId,
                type: d.type,
                format: d.format,
                name: d.name,
                status: d.status,
                createdAt: d.createdAt,
              })),
              total: designs.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};
