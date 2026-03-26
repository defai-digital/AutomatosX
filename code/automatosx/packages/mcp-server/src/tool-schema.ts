import { z } from 'zod';

export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
  description?: string;
}

export function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  additionalProperties = false,
): JsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties,
  };
}

export function validateInput(value: unknown, schema: JsonSchema): string | undefined {
  const result = buildValidator(schema).safeParse(value);
  if (result.success) {
    return undefined;
  }
  return formatSchemaIssue(result.error.issues[0]);
}

function buildValidator(schema: JsonSchema): z.ZodType<unknown> {
  switch (schema.type) {
    case 'object':
      return buildObjectValidator(schema);
    case 'array':
      return z.array(schema.items !== undefined ? buildValidator(schema.items) : z.unknown());
    case 'string':
      return schema.enum !== undefined && schema.enum.length > 0
        ? z.enum(schema.enum as [string, ...string[]])
        : z.string();
    case 'number':
      return z.number().finite();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
  }
}

function buildObjectValidator(schema: JsonSchema): z.ZodType<unknown> {
  const shape = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, childSchema]) => {
      const validator = buildValidator(childSchema);
      const isRequired = (schema.required ?? []).includes(key);
      return [key, isRequired ? validator : validator.optional()];
    }),
  );
  const object = z.object(shape);
  return schema.additionalProperties === false ? object.strict() : object.catchall(z.unknown());
}

function formatSchemaIssue(issue: z.ZodIssue | undefined): string {
  if (issue === undefined) {
    return 'Invalid arguments';
  }

  if (issue.code === 'invalid_type' && issue.received === 'undefined' && issue.path.length > 0) {
    return `${String(issue.path[issue.path.length - 1])} is required`;
  }

  if (issue.code === 'unrecognized_keys' && issue.keys.length > 0) {
    return `${issue.keys[0]} is not allowed`;
  }

  const path = issue.path.length > 0
    ? `arguments.${issue.path.map((segment) => typeof segment === 'number' ? `[${String(segment)}]` : segment).join('.')}`.replace('.[', '[')
    : 'arguments';

  switch (issue.code) {
    case 'invalid_type':
      return `${path} must be ${issue.expected === 'array' ? 'an array' : issue.expected === 'object' ? 'an object' : `a ${issue.expected}`}`;
    case 'invalid_enum_value':
      return `${path} must be one of: ${issue.options.join(', ')}`;
    case 'too_small':
      return `${path} is required`;
    default:
      return issue.message;
  }
}
