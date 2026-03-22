import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { success } from '../utils/formatters.js';
import { listProviderClientStatuses } from '../utils/provider-detection.js';
const DEFAULT_AGENTS = [
    {
        agentId: 'architect',
        name: 'Architect',
        capabilities: ['adr', 'architecture', 'planning'],
    },
    {
        agentId: 'quality',
        name: 'Quality',
        capabilities: ['bug-hunting', 'qa', 'review'],
    },
    {
        agentId: 'bug-hunter',
        name: 'Bug Hunter',
        capabilities: ['debugging', 'regression-analysis'],
    },
    {
        agentId: 'release-manager',
        name: 'Release Manager',
        capabilities: ['changelog', 'release', 'rollout'],
    },
];
const DEFAULT_POLICIES = [
    {
        policyId: 'workflow-artifact-contract',
        name: 'Workflow Artifact Contract',
        enabled: true,
        metadata: {
            artifactDir: '.automatosx/workflows',
            traceDir: '.automatosx/runtime',
        },
    },
];
export async function ensureWorkspaceSetup(basePath, provider) {
    const automatosxDir = join(basePath, '.automatosx');
    const contextDir = join(automatosxDir, 'context');
    const runtimeDir = join(automatosxDir, 'runtime');
    const artifactDir = join(automatosxDir, 'workflows');
    const configPath = join(automatosxDir, 'config.json');
    const environmentPath = join(automatosxDir, 'environment.json');
    await mkdir(contextDir, { recursive: true });
    await mkdir(runtimeDir, { recursive: true });
    await mkdir(artifactDir, { recursive: true });
    const writtenFiles = [];
    await writeJsonIfMissing(configPath, {
        schemaVersion: 1,
        productVersion: '14.0.0',
        defaultProvider: provider ?? 'claude',
        workflowArtifactDir: '.automatosx/workflows',
        runtimeStoreDir: '.automatosx/runtime',
        createdBy: 'ax setup',
    }, writtenFiles);
    const runtime = createSharedRuntimeService({ basePath });
    const registeredAgents = [];
    for (const agent of DEFAULT_AGENTS) {
        await runtime.registerAgent(agent);
        registeredAgents.push(agent.agentId);
    }
    const registeredPolicies = [];
    for (const policy of DEFAULT_POLICIES) {
        await runtime.registerPolicy(policy);
        registeredPolicies.push(policy.policyId);
    }
    const detectedProviders = listProviderClientStatuses();
    await writeFile(environmentPath, `${JSON.stringify({
        schemaVersion: 1,
        generatedBy: 'ax setup',
        generatedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        mcp: {
            serverId: 'automatosx',
            transport: 'stdio',
            command: 'ax',
            args: ['mcp', 'serve'],
            toolPrefix: process.env.AX_MCP_TOOL_PREFIX ?? undefined,
        },
        providers: detectedProviders,
    }, null, 2)}\n`, 'utf8');
    return {
        basePath,
        automatosxDir,
        contextDir,
        runtimeDir,
        artifactDir,
        configPath,
        environmentPath,
        writtenFiles,
        registeredAgents,
        registeredPolicies,
        detectedProviders,
    };
}
export async function setupCommand(_args, options) {
    const basePath = options.outputDir ?? process.cwd();
    const result = await ensureWorkspaceSetup(basePath, options.provider);
    return success([
        `Workspace setup completed in ${result.automatosxDir}.`,
        `Registered agents: ${result.registeredAgents.join(', ')}.`,
        `Registered policies: ${result.registeredPolicies.join(', ')}.`,
        `Detected provider clients: ${formatDetectedProviders(result.detectedProviders)}.`,
        `Wrote environment baseline: ${result.environmentPath}.`,
    ].join('\n'), result);
}
function formatDetectedProviders(providers) {
    const installed = providers.filter((provider) => provider.installed).map((provider) => provider.providerId);
    return installed.length > 0 ? installed.join(', ') : 'none';
}
async function writeJsonIfMissing(filePath, value, writtenFiles) {
    if (await exists(filePath)) {
        return;
    }
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    writtenFiles.push(filePath);
}
async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
