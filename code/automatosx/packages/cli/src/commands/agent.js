import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseOptionalJsonInput, asOptionalString, asOptionalRecord, asStringArray } from '../utils/validation.js';
export async function agentCommand(args, options) {
    const subcommand = args[0] ?? 'list';
    const runtime = createRuntime(options);
    switch (subcommand) {
        case 'list': {
            const agents = await runtime.listAgents();
            if (agents.length === 0) {
                return success('No agents registered.', agents);
            }
            const lines = [
                'Registered agents:',
                ...agents.map((agent) => (`- ${agent.agentId}: ${agent.name}${agent.capabilities.length > 0 ? ` [${agent.capabilities.join(', ')}]` : ''}`)),
            ];
            return success(lines.join('\n'), agents);
        }
        case 'get': {
            const agentId = args[1] ?? options.agent;
            if (agentId === undefined || agentId.length === 0) {
                return usageError('ax agent get <agent-id>');
            }
            const agent = await runtime.getAgent(agentId);
            if (agent === undefined) {
                return failure(`Agent not found: ${agentId}`);
            }
            const lines = [
                `Agent: ${agent.agentId}`,
                `Name: ${agent.name}`,
                `Capabilities: ${agent.capabilities.length > 0 ? agent.capabilities.join(', ') : 'none'}`,
                `Registered: ${agent.registeredAt}`,
                `Updated: ${agent.updatedAt}`,
            ];
            return success(lines.join('\n'), agent);
        }
        case 'register': {
            const parsed = parseRegistrationInput(options.input);
            if (parsed.error !== undefined) {
                return failure(parsed.error);
            }
            const registered = await runtime.registerAgent(parsed.value);
            return success(`Agent registered: ${registered.agentId}`, registered);
        }
        case 'remove': {
            const agentId = args[1] ?? options.agent;
            if (agentId === undefined || agentId.length === 0) {
                return usageError('ax agent remove <agent-id>');
            }
            const removed = await runtime.removeAgent(agentId);
            if (!removed) {
                return failure(`Agent not found: ${agentId}`);
            }
            return success(`Agent removed: ${agentId}`, { removed: true, agentId });
        }
        case 'capabilities': {
            const capabilities = await runtime.listAgentCapabilities();
            if (capabilities.length === 0) {
                return success('No agent capabilities registered.', capabilities);
            }
            return success([
                'Agent capabilities:',
                ...capabilities.map((capability) => `- ${capability}`),
            ].join('\n'), capabilities);
        }
        case 'run': {
            const agentId = args[1] ?? options.agent;
            if (agentId === undefined || agentId.length === 0) {
                return usageError('ax agent run <agent-id> --task <text> [--input <json-object>]');
            }
            const parsed = parseOptionalJsonInput(options.input, 'Agent run');
            if (parsed.error !== undefined) {
                return failure(parsed.error);
            }
            const result = await runtime.runAgent({
                agentId,
                task: options.task,
                input: parsed.value,
                provider: options.provider,
                traceId: options.traceId,
                surface: 'cli',
            });
            const lines = [
                `Agent run: ${result.agentId}`,
                `Trace: ${result.traceId}`,
                `Provider: ${result.provider}`,
                `Mode: ${result.executionMode}`,
                `Success: ${result.success ? 'yes' : 'no'}`,
                result.content.length > 0 ? `Output:\n${result.content}` : undefined,
                result.error?.message ? `Error: ${result.error.message}` : undefined,
                ...(result.warnings.map((warning) => `Warning: ${warning}`)),
            ].filter((value) => value !== undefined);
            return result.success
                ? success(lines.join('\n'), result)
                : failure(lines.join('\n'), result);
        }
        case 'recommend': {
            const task = options.task ?? args.slice(1).join(' ').trim();
            if (task.length === 0) {
                return usageError('ax agent recommend --task <text>');
            }
            const recommendations = await runtime.recommendAgents({
                task,
                limit: options.limit,
            });
            if (recommendations.length === 0) {
                return success('No matching agents found.', recommendations);
            }
            const lines = [
                `Agent recommendations for: ${task}`,
                ...recommendations.map((entry) => (`- ${entry.agentId}: ${entry.name} (confidence ${entry.confidence.toFixed(2)})${entry.reasons.length > 0 ? ` — ${entry.reasons.join('; ')}` : ''}`)),
            ];
            return success(lines.join('\n'), recommendations);
        }
        default:
            return usageError('ax agent [list|get|register|remove|capabilities|run|recommend]');
    }
}
function parseRegistrationInput(input) {
    if (input === undefined) {
        return {
            value: { agentId: '', name: '' },
            error: 'Usage: ax agent register --input <json-object>',
        };
    }
    const parsed = parseOptionalJsonInput(input, 'Agent register');
    if (parsed.error !== undefined) {
        return { value: { agentId: '', name: '' }, error: parsed.error };
    }
    const value = parsed.value ?? {};
    const agentId = asOptionalString(value.agentId);
    const name = asOptionalString(value.name);
    if (agentId === undefined) {
        return { value: { agentId: '', name: '' }, error: 'Agent register input requires "agentId".' };
    }
    if (name === undefined) {
        return { value: { agentId, name: '' }, error: 'Agent register input requires "name".' };
    }
    return {
        value: {
            agentId,
            name,
            capabilities: asStringArray(value.capabilities),
            metadata: asOptionalRecord(value.metadata),
        },
    };
}
