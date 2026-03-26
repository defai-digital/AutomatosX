import type { ReviewFocus } from '@defai.digital/shared-runtime';
import { z } from 'zod';

export interface McpParallelTaskInput {
  taskId: string;
  agentId: string;
  task?: string | undefined;
  input?: Record<string, unknown> | undefined;
  dependencies?: string[] | undefined;
  priority?: number | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  timeoutMs?: number | undefined;
}

const recordSchema = z.record(z.string(), z.unknown());
const nonEmptyStringSchema = z.string().min(1);
const finiteNumberSchema = z.number().finite();
const booleanSchema = z.boolean();
const stringArraySchema = z.array(nonEmptyStringSchema);
const recordArraySchema = z.array(recordSchema);
const parallelTaskInputSchema = z.object({
  taskId: nonEmptyStringSchema,
  agentId: nonEmptyStringSchema,
  task: nonEmptyStringSchema.optional(),
  input: recordSchema.optional(),
  dependencies: stringArraySchema.optional(),
  priority: finiteNumberSchema.optional(),
  provider: nonEmptyStringSchema.optional(),
  model: nonEmptyStringSchema.optional(),
  timeoutMs: finiteNumberSchema.optional(),
});
const parallelTaskArraySchema = z.array(parallelTaskInputSchema);

export function asString(value: unknown, field: string): string {
  const result = nonEmptyStringSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${field} is required`);
  }
  return result.data;
}

export function asOptionalString(value: unknown): string | undefined {
  const result = nonEmptyStringSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalNumber(value: unknown): number | undefined {
  const result = finiteNumberSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalFloat(value: unknown): number | undefined {
  const result = finiteNumberSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  const result = booleanSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asInput(value: unknown): Record<string, unknown> | undefined {
  const result = recordSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] | undefined {
  const result = recordArraySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asStringArray(value: unknown): string[] | undefined {
  const result = stringArraySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function asParallelTasks(value: unknown): McpParallelTaskInput[] {
  const result = parallelTaskArraySchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  if (!Array.isArray(value)) {
    throw new Error('tasks must be an array');
  }
  const issue = result.error.issues[0];
  const path = issue?.path.length
    ? issue.path.map((segment) => typeof segment === 'number' ? `[${String(segment)}]` : `.${segment}`).join('').replace(/^\./, '')
    : 'tasks';
  const formattedPath = path.startsWith('[') ? `tasks${path}` : path === 'tasks' ? path : `tasks.${path}`;
  if (issue?.code === 'invalid_type' && issue.path.length === 1) {
    throw new Error(`${formattedPath} must be ${issue.expected}`);
  }
  throw new Error(`${formattedPath} is invalid`);
}

export function asParallelFailureStrategy(value: unknown): 'failFast' | 'failSafe' | undefined {
  return value === 'failFast' || value === 'failSafe' ? value : undefined;
}

export function asParallelAggregation(value: unknown): 'list' | 'merge' | undefined {
  return value === 'list' || value === 'merge' ? value : undefined;
}

export function asOptionalRole(value: unknown): 'initiator' | 'collaborator' | 'delegate' | undefined {
  return value === 'initiator' || value === 'collaborator' || value === 'delegate'
    ? value
    : undefined;
}

export function asOptionalReviewFocus(value: unknown): ReviewFocus | undefined {
  return value === 'all' || value === 'security' || value === 'correctness' || value === 'maintainability'
    ? value
    : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return recordSchema.safeParse(value).success;
}
