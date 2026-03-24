import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { splitCommaList } from '../utils/validation.js';
export async function discussCommand(args, options) {
    const parsed = parseDiscussArgs(args);
    if (parsed.error !== undefined) {
        return failure(parsed.error);
    }
    if (parsed.value.topic === undefined || parsed.value.topic.length === 0) {
        return usageError('ax discuss <topic>');
    }
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createRuntime(options);
    const providers = parsed.value.providers ?? (options.provider !== undefined ? [options.provider] : undefined);
    const variant = parsed.value.variant ?? 'run';
    const commonRequest = {
        topic: parsed.value.topic,
        traceId: options.traceId,
        sessionId: options.sessionId,
        basePath,
        provider: options.provider,
        surface: 'cli',
        providers,
        pattern: parsed.value.pattern,
        rounds: parsed.value.rounds,
        consensusMethod: parsed.value.consensusMethod,
        context: parsed.value.context,
        minProviders: Math.min(2, Math.max(1, providers?.length ?? 0)),
        verbose: options.verbose,
    };
    const result = variant === 'quick'
        ? await runtime.runDiscussionQuick(commonRequest)
        : variant === 'recursive'
            ? await runtime.runDiscussionRecursive({
                ...commonRequest,
                subtopics: parsed.value.subtopics ?? [],
            })
            : await runtime.runDiscussion(commonRequest);
    if (!result.success) {
        return failure(`Discussion failed: ${result.error?.message ?? 'Unknown error'}`, result);
    }
    const warningText = result.warnings.length === 0
        ? ''
        : `\nWarnings:\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`;
    const variantText = variant === 'run' ? 'Discussion' : `Discussion (${variant})`;
    const providerText = 'providers' in result ? result.providers.join(', ') : result.root.providers.join(', ');
    const subtopicText = variant === 'recursive' && 'subtopics' in result
        ? `\nSubtopics:\n${result.subtopics.map((entry) => `- ${entry}`).join('\n')}`
        : '';
    return success(`${variantText} completed with trace ${result.traceId} using ${providerText}.${subtopicText}${warningText}`, result);
}
function parseDiscussArgs(args) {
    const parsed = {};
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === undefined) {
            continue;
        }
        if ((token === 'quick' || token === 'recursive') && positionals.length === 0 && parsed.variant === undefined) {
            parsed.variant = token;
            continue;
        }
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }
        const name = token.slice(2);
        const value = args[index + 1];
        if (value === undefined || value.startsWith('--')) {
            return { value: parsed, error: `Missing value for --${name}.` };
        }
        index += 1;
        switch (name) {
            case 'providers':
                parsed.providers = splitCommaList(value);
                break;
            case 'pattern':
                parsed.pattern = value;
                break;
            case 'rounds': {
                const rounds = Number.parseInt(value, 10);
                if (!Number.isFinite(rounds) || rounds < 1) {
                    return { value: parsed, error: 'Rounds must be a positive integer.' };
                }
                parsed.rounds = rounds;
                break;
            }
            case 'consensus':
                parsed.consensusMethod = value;
                break;
            case 'context':
                parsed.context = value;
                break;
            case 'topic':
                parsed.topic = value;
                break;
            case 'subtopics':
                parsed.subtopics = splitCommaList(value);
                break;
            default:
                return { value: parsed, error: `Unknown discuss flag: --${name}.` };
        }
    }
    if (parsed.topic === undefined && positionals.length > 0) {
        parsed.topic = positionals.join(' ');
    }
    if (parsed.variant === 'recursive' && (parsed.subtopics === undefined || parsed.subtopics.length === 0)) {
        return { value: parsed, error: 'Recursive discussions require --subtopics <a,b,c>.' };
    }
    return { value: parsed };
}
