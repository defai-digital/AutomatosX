import { spawnSync } from 'node:child_process';

export const PROVIDER_CLIENT_IDS = ['claude', 'cursor', 'gemini', 'codex', 'grok'] as const;
export type ProviderClientId = typeof PROVIDER_CLIENT_IDS[number];

export const PROVIDER_CLIENT_COMMANDS: Record<ProviderClientId, string> = {
  claude: 'claude',
  cursor: 'cursor',
  gemini: 'gemini',
  codex: 'codex',
  grok: 'ax-grok',
};

export interface ProviderClientStatus {
  providerId: ProviderClientId;
  cli: string;
  installed: boolean;
}

export function detectProviderClients(env: NodeJS.ProcessEnv = process.env): Record<ProviderClientId, boolean> {
  const override = env.AUTOMATOSX_AVAILABLE_CLIENTS ?? env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
  if (typeof override === 'string' && override.trim().length > 0) {
    const available = new Set(
      override
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is ProviderClientId => PROVIDER_CLIENT_IDS.includes(entry as ProviderClientId)),
    );
    return Object.fromEntries(
      PROVIDER_CLIENT_IDS.map((providerId) => [providerId, available.has(providerId)]),
    ) as Record<ProviderClientId, boolean>;
  }

  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = {} as Record<ProviderClientId, boolean>;

  for (const providerId of PROVIDER_CLIENT_IDS) {
    const cli = PROVIDER_CLIENT_COMMANDS[providerId];
    const detection = spawnSync(lookupCommand, [cli], { stdio: 'ignore' });
    result[providerId] = detection.status === 0;
  }

  return result;
}

export function listProviderClientStatuses(env: NodeJS.ProcessEnv = process.env): ProviderClientStatus[] {
  const detected = detectProviderClients(env);
  return PROVIDER_CLIENT_IDS.map((providerId) => ({
    providerId,
    cli: PROVIDER_CLIENT_COMMANDS[providerId],
    installed: detected[providerId],
  }));
}
