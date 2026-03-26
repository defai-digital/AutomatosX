import { z } from 'zod';

export interface ParseResult<T> {
  value: T;
  error?: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonObjectSchema = z.record(z.string(), z.unknown());
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));
const nonEmptyStringSchema = z.string().min(1);
const stringValueSchema = z.string();
const booleanSchema = z.boolean();
const finiteNumberSchema = z.number().finite();
const stringArraySchema = z.array(nonEmptyStringSchema);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return jsonObjectSchema.safeParse(value).success;
}

export function parseJsonObjectString(
  input: string,
  context?: string,
): ParseResult<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(input);
    const result = jsonObjectSchema.safeParse(parsed);
    if (!result.success) {
      return {
        value: {},
        error: context ? `${context} input must be a JSON object.` : 'Input must be a JSON object.',
      };
    }
    return { value: result.data };
  } catch {
    return { value: {}, error: 'Invalid JSON input. Please provide a valid JSON object.' };
  }
}

export function parseJsonValueString(
  input: string,
  options?: { invalidJsonMessage?: string; invalidValueMessage?: string },
): ParseResult<JsonValue> {
  try {
    const parsed = JSON.parse(input);
    const result = jsonValueSchema.safeParse(parsed);
    if (!result.success) {
      return {
        value: null,
        error: options?.invalidValueMessage ?? 'Input must be a valid JSON value.',
      };
    }
    return { value: result.data };
  } catch {
    return {
      value: null,
      error: options?.invalidJsonMessage ?? 'Invalid JSON input. Please provide a valid JSON value.',
    };
  }
}

export function parseJsonInput(input: string | undefined, options?: { allowEmpty?: boolean }): ParseResult<Record<string, unknown>> {
  const allowEmpty = options?.allowEmpty ?? false;
  
  if (input === undefined) {
    return allowEmpty 
      ? { value: {} } 
      : { value: {}, error: 'Command requires --input <json-object>' };
  }

  return parseJsonObjectString(input);
}

export function parseOptionalJsonInput(input: string | undefined, context?: string): ParseResult<Record<string, unknown> | undefined> {
  if (input === undefined) {
    return { value: undefined };
  }

  const parsed = parseJsonObjectString(input, context);
  if (parsed.error !== undefined) {
    return { value: undefined, error: parsed.error };
  }

  return { value: parsed.value };
}

export function asString(value: unknown, field: string): ParseResult<string> {
  const result = nonEmptyStringSchema.safeParse(value);
  if (!result.success) {
    return { value: '', error: `Input requires "${field}".` };
  }
  return { value: result.data };
}

export function asOptionalString(value: unknown): string | undefined {
  const result = nonEmptyStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asStringValue(value: unknown): string | undefined {
  const result = stringValueSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  const result = booleanSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
  const result = finiteNumberSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalInteger(
  value: unknown,
  field: string,
  options?: { min?: number },
): ParseResult<number | undefined> {
  if (value === undefined) {
    return { value: undefined };
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { value: undefined, error: `Input requires "${field}" to be an integer.` };
  }

  if (options?.min !== undefined && value < options.min) {
    const qualifier = options.min === 0 ? 'a non-negative integer' : `an integer >= ${String(options.min)}`;
    return { value: undefined, error: `Input requires "${field}" to be ${qualifier}.` };
  }

  return { value };
}

export function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  const result = jsonObjectSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  const result = stringArraySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function findUnexpectedFlag(args: string[], startIndex = 0): string | undefined {
  return args.slice(startIndex).find((entry) => entry.startsWith('--'));
}

export function splitCommaList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
