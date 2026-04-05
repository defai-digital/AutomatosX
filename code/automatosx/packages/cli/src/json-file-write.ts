import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function formatPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatPrettyJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function serializeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export async function writePrettyJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, formatPrettyJson(value), 'utf8');
}
