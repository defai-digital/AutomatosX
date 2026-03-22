import { spawnSync } from 'node:child_process';
export const PROVIDER_CLIENT_IDS = ['claude', 'cursor', 'gemini', 'codex', 'grok'];
export const PROVIDER_CLIENT_COMMANDS = {
    claude: 'claude',
    cursor: 'cursor',
    gemini: 'gemini',
    codex: 'codex',
    grok: 'ax-grok',
};
export function detectProviderClients(env = process.env) {
    const override = env.AUTOMATOSX_AVAILABLE_CLIENTS ?? env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
    if (typeof override === 'string' && override.trim().length > 0) {
        const available = new Set(override
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => PROVIDER_CLIENT_IDS.includes(entry)));
        return Object.fromEntries(PROVIDER_CLIENT_IDS.map((providerId) => [providerId, available.has(providerId)]));
    }
    const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
    const result = {};
    for (const providerId of PROVIDER_CLIENT_IDS) {
        const cli = PROVIDER_CLIENT_COMMANDS[providerId];
        const detection = spawnSync(lookupCommand, [cli], { stdio: 'ignore' });
        result[providerId] = detection.status === 0;
    }
    return result;
}
export function listProviderClientStatuses(env = process.env) {
    const detected = detectProviderClients(env);
    return PROVIDER_CLIENT_IDS.map((providerId) => ({
        providerId,
        cli: PROVIDER_CLIENT_COMMANDS[providerId],
        installed: detected[providerId],
    }));
}
