import { readFile } from 'node:fs/promises';
import { parseJsonObjectString } from './utils/validation.js';

export async function readJsonObjectFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseJsonObjectString(raw);
    return parsed.error === undefined ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}
