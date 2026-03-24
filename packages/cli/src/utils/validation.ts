export interface ParseResult<T> {
  value: T;
  error?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonInput(input: string | undefined, options?: { allowEmpty?: boolean }): ParseResult<Record<string, unknown>> {
  const allowEmpty = options?.allowEmpty ?? false;
  
  if (input === undefined) {
    return allowEmpty 
      ? { value: {} } 
      : { value: {}, error: 'Command requires --input <json-object>' };
  }

  try {
    const parsed = JSON.parse(input);
    if (!isRecord(parsed)) {
      return { value: {}, error: 'Input must be a JSON object.' };
    }
    return { value: parsed };
  } catch {
    return { value: {}, error: 'Invalid JSON input. Please provide a valid JSON object.' };
  }
}

export function parseOptionalJsonInput(input: string | undefined, context?: string): ParseResult<Record<string, unknown> | undefined> {
  if (input === undefined) {
    return { value: undefined };
  }

  try {
    const parsed = JSON.parse(input);
    if (!isRecord(parsed)) {
      return { 
        value: undefined, 
        error: context ? `${context} input must be a JSON object.` : 'Input must be a JSON object.' 
      };
    }
    return { value: parsed };
  } catch {
    return { value: undefined, error: 'Invalid JSON input. Please provide a valid JSON object.' };
  }
}

export function asString(value: unknown, field: string): ParseResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return { value: '', error: `Input requires "${field}".` };
  }
  return { value };
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
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
  return isRecord(value) ? value : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

export function findUnexpectedFlag(args: string[], startIndex = 0): string | undefined {
  return args.slice(startIndex).find((entry) => entry.startsWith('--'));
}

export function splitCommaList(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}
