import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;
const PROVIDER_NATIVE_COMMANDS = {
    claude: { command: 'claude', protocol: 'raw-stdin' },
    gemini: { command: 'gemini', protocol: 'raw-stdin' },
    codex: { command: 'codex', protocol: 'raw-stdin' },
    grok: { command: 'ax-grok', protocol: 'raw-stdin' },
};
export function createProviderBridge(config) {
    const env = config.env ?? process.env;
    const executionMode = resolveExecutionMode(env);
    return {
        getExecutionMode() {
            return executionMode;
        },
        async executePrompt(request) {
            const providerConfig = await resolveProviderCommand(config.basePath, request.provider, env);
            if (providerConfig === undefined) {
                if (executionMode === 'require-real') {
                    return {
                        type: 'failure',
                        response: {
                            success: false,
                            provider: request.provider,
                            model: request.model,
                            latencyMs: 0,
                            errorCode: 'PROVIDER_EXECUTOR_NOT_CONFIGURED',
                            error: `No provider executor configured for "${request.provider}". Set .automatosx/config.json or AUTOMATOSX_PROVIDER_<PROVIDER>_CMD.`,
                            mode: 'subprocess',
                        },
                    };
                }
                return {
                    type: 'unavailable',
                    error: `No provider executor configured for "${request.provider}".`,
                };
            }
            return executeProviderSubprocess(providerConfig, request, config.basePath, env);
        },
    };
}
async function resolveProviderCommand(basePath, provider, env) {
    const providerIds = getProviderLookupOrder(provider);
    const workspaceConfig = await readWorkspaceConfig(basePath);
    for (const providerId of providerIds) {
        const configured = getConfiguredProviderCommand(workspaceConfig, providerId);
        if (configured !== undefined) {
            return configured;
        }
    }
    for (const providerId of providerIds) {
        const configured = getEnvProviderCommand(env, providerId);
        if (configured !== undefined) {
            return configured;
        }
    }
    if (nativeAdaptersEnabled(workspaceConfig, env)) {
        for (const providerId of providerIds) {
            const configured = getNativeProviderCommand(env, providerId);
            if (configured !== undefined) {
                return configured;
            }
        }
    }
    return undefined;
}
async function executeProviderSubprocess(providerConfig, request, basePath, env) {
    const startedAt = Date.now();
    const timeoutMs = request.timeoutMs ?? providerConfig.timeoutMs;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    return new Promise((resolve) => {
        const child = spawn(providerConfig.command, buildProviderSpawnArgs(providerConfig, request), {
            cwd: basePath,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', (error) => {
            clearTimeout(timer);
            child.stdin?.destroy();
            resolve({
                type: 'failure',
                response: {
                    success: false,
                    provider: request.provider,
                    model: request.model,
                    latencyMs: Date.now() - startedAt,
                    errorCode: 'PROVIDER_PROCESS_ERROR',
                    error: error.message,
                    mode: 'subprocess',
                },
            });
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (timedOut) {
                resolve({
                    type: 'failure',
                    response: {
                        success: false,
                        provider: request.provider,
                        model: request.model,
                        latencyMs: Date.now() - startedAt,
                        errorCode: 'PROVIDER_TIMEOUT',
                        error: `Provider "${request.provider}" exceeded timeout (${timeoutMs}ms).`,
                        mode: 'subprocess',
                    },
                });
                return;
            }
            if (code !== 0) {
                resolve({
                    type: 'failure',
                    response: {
                        success: false,
                        provider: request.provider,
                        model: request.model,
                        latencyMs: Date.now() - startedAt,
                        errorCode: 'PROVIDER_EXIT_NON_ZERO',
                        error: stderr.trim() || `Provider "${request.provider}" exited with code ${code}.`,
                        mode: 'subprocess',
                    },
                });
                return;
            }
            resolve({
                type: 'response',
                response: normalizeProviderOutput(stdout, request, Date.now() - startedAt),
            });
        });
        try {
            if (providerConfig.protocol === 'argv-last') {
                child.stdin.end();
            }
            else {
                child.stdin.write(buildProviderStdinPayload(providerConfig, request, timeoutMs), 'utf8');
                child.stdin.end();
            }
        }
        catch (writeError) {
            clearTimeout(timer);
            child.stdin?.destroy();
            resolve({
                type: 'failure',
                response: {
                    success: false,
                    provider: request.provider,
                    model: request.model,
                    latencyMs: Date.now() - startedAt,
                    errorCode: 'PROVIDER_STDIN_ERROR',
                    error: writeError instanceof Error ? writeError.message : String(writeError),
                    mode: 'subprocess',
                },
            });
        }
    });
}
function normalizeProviderOutput(stdout, request, latencyMs) {
    const trimmed = stdout.trim();
    if (trimmed.length === 0) {
        return {
            success: false,
            provider: request.provider,
            model: request.model,
            latencyMs,
            errorCode: 'PROVIDER_EMPTY_RESPONSE',
            error: `Provider "${request.provider}" returned no output.`,
            mode: 'subprocess',
        };
    }
    try {
        const parsed = JSON.parse(trimmed);
        const content = firstString(parsed.content, parsed.text, typeof parsed.output === 'string' ? parsed.output : undefined);
        return {
            success: parsed.success !== false,
            content: content ?? trimmed,
            provider: firstString(parsed.provider, request.provider) ?? request.provider,
            model: firstString(parsed.model, request.model),
            latencyMs: asNumber(parsed.latencyMs) ?? latencyMs,
            usage: normalizeUsage(parsed.usage, request.prompt, content ?? trimmed),
            error: typeof parsed.error === 'string' ? parsed.error : undefined,
            errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : undefined,
            mode: 'subprocess',
        };
    }
    catch {
        return {
            success: true,
            content: trimmed,
            provider: request.provider,
            model: request.model,
            latencyMs,
            usage: {
                inputTokens: tokenize(request.prompt),
                outputTokens: tokenize(trimmed),
                totalTokens: tokenize(request.prompt) + tokenize(trimmed),
            },
            mode: 'subprocess',
        };
    }
}
function normalizeUsage(value, prompt, content) {
    if (typeof value !== 'object' || value === null) {
        return {
            inputTokens: tokenize(prompt),
            outputTokens: tokenize(content),
            totalTokens: tokenize(prompt) + tokenize(content),
        };
    }
    const usage = value;
    const inputTokens = asNumber(usage.inputTokens) ?? tokenize(prompt);
    const outputTokens = asNumber(usage.outputTokens) ?? tokenize(content);
    const totalTokens = asNumber(usage.totalTokens) ?? (inputTokens + outputTokens);
    return {
        inputTokens,
        outputTokens,
        totalTokens,
    };
}
function getConfiguredProviderCommand(config, providerId) {
    const providers = asRecord(config.providers);
    const executors = asRecord(providers?.executors);
    const executor = asRecord(executors?.[providerId]);
    const command = typeof executor?.command === 'string' ? executor.command : undefined;
    if (command === undefined || command.trim().length === 0) {
        return undefined;
    }
    return {
        command,
        args: normalizeArgs(executor?.args),
        timeoutMs: asNumber(executor?.timeoutMs) ?? DEFAULT_PROVIDER_TIMEOUT_MS,
        protocol: normalizeProtocol(executor?.protocol) ?? 'json-stdio',
        adapterSource: 'config',
    };
}
function getEnvProviderCommand(env, providerId) {
    const prefix = `AUTOMATOSX_PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    const command = env[`${prefix}_CMD`];
    if (typeof command !== 'string' || command.trim().length === 0) {
        return undefined;
    }
    return {
        command,
        args: parseArgs(env[`${prefix}_ARGS`]),
        timeoutMs: parseTimeout(env[`${prefix}_TIMEOUT_MS`]),
        protocol: normalizeProtocol(env[`${prefix}_PROTOCOL`]) ?? 'json-stdio',
        adapterSource: 'env',
    };
}
function getNativeProviderCommand(env, providerId) {
    const preset = PROVIDER_NATIVE_COMMANDS[providerId];
    if (preset === undefined) {
        return undefined;
    }
    const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
    const detection = spawnSync(lookupCommand, [preset.command], {
        env,
        stdio: 'ignore',
    });
    if (detection.status !== 0) {
        return undefined;
    }
    return {
        command: preset.command,
        args: preset.args ?? [],
        timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
        protocol: preset.protocol,
        adapterSource: 'native',
    };
}
function resolveExecutionMode(env) {
    const value = env.AUTOMATOSX_PROVIDER_EXECUTION_MODE;
    if (value === 'simulate' || value === 'require-real' || value === 'auto') {
        return value;
    }
    return 'auto';
}
function normalizeProtocol(value) {
    return value === 'json-stdio' || value === 'raw-stdin' || value === 'argv-last'
        ? value
        : undefined;
}
function nativeAdaptersEnabled(config, env) {
    const envValue = env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS;
    if (envValue === '1' || envValue === 'true' || envValue === 'enabled') {
        return true;
    }
    if (envValue === '0' || envValue === 'false' || envValue === 'disabled') {
        return false;
    }
    const providers = asRecord(config.providers);
    return providers?.nativeAdapters === true;
}
async function readWorkspaceConfig(basePath) {
    const configPath = join(basePath, '.automatosx', 'config.json');
    try {
        const raw = await readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return asRecord(parsed) ?? {};
    }
    catch {
        return {};
    }
}
function parseArgs(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return [];
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            return normalizeArgs(parsed);
        }
        catch {
            return [];
        }
    }
    return trimmed.split(/\s+/).filter((entry) => entry.length > 0);
}
function buildProviderSpawnArgs(providerConfig, request) {
    if (providerConfig.protocol !== 'argv-last') {
        return providerConfig.args;
    }
    return [
        ...providerConfig.args,
        [
            typeof request.systemPrompt === 'string' && request.systemPrompt.length > 0
                ? `System: ${request.systemPrompt}`
                : undefined,
            request.prompt,
        ].filter((value) => typeof value === 'string' && value.length > 0).join('\n\n'),
    ];
}
function buildProviderStdinPayload(providerConfig, request, timeoutMs) {
    if (providerConfig.protocol === 'raw-stdin') {
        return [
            typeof request.systemPrompt === 'string' && request.systemPrompt.length > 0
                ? `System: ${request.systemPrompt}`
                : undefined,
            request.prompt,
        ].filter((value) => typeof value === 'string' && value.length > 0).join('\n\n');
    }
    return `${JSON.stringify({
        provider: request.provider,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        timeoutMs,
    })}\n`;
}
function normalizeArgs(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry.length > 0)
        : [];
}
function parseTimeout(value) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROVIDER_TIMEOUT_MS;
}
function getProviderLookupOrder(provider) {
    const normalized = provider.trim().toLowerCase();
    if (normalized === 'openai') {
        return ['openai', 'codex'];
    }
    if (normalized === 'codex') {
        return ['codex', 'openai'];
    }
    return [normalized];
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function firstString(...values) {
    return values.find((value) => typeof value === 'string' && value.length > 0);
}
function tokenize(value) {
    const trimmed = value.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
