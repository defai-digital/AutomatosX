import type { StateStore } from '@defai.digital/state-store';
import type { TraceSurface } from '@defai.digital/trace-store';

interface EnsureSessionRecordRequest {
  sessionId?: string;
  task: string;
  initiator: string;
  workspace?: string;
  surface?: TraceSurface;
  metadata?: Record<string, unknown>;
}

const SESSION_TASK_MAX_LENGTH = 160;

export async function ensureSessionRecord(
  stateStore: StateStore,
  request: EnsureSessionRecordRequest,
): Promise<void> {
  const sessionId = normalizeText(request.sessionId);
  if (sessionId === undefined) {
    return;
  }

  const existing = await stateStore.getSession(sessionId);
  if (existing !== undefined) {
    return;
  }

  await stateStore.createSession({
    sessionId,
    task: buildSessionTask(request.task),
    initiator: buildSessionInitiator(request.initiator, request.surface),
    workspace: normalizeText(request.workspace),
    metadata: {
      autoCreated: true,
      surface: request.surface,
      ...request.metadata,
    },
  });
}

export function buildSessionTask(label: string, detail?: string): string {
  const normalizedLabel = normalizeText(label) ?? 'Session activity';
  const normalizedDetail = normalizeText(detail);
  const combined = normalizedDetail === undefined
    ? normalizedLabel
    : `${normalizedLabel}: ${normalizedDetail}`;
  return truncateText(combined, SESSION_TASK_MAX_LENGTH);
}

function buildSessionInitiator(initiator: string, surface?: TraceSurface): string {
  return normalizeText(initiator) ?? surface ?? 'cli';
}

function normalizeText(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
