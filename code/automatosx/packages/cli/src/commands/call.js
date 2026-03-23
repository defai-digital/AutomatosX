import { readFile } from 'node:fs/promises';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { splitCommaList } from '../utils/validation.js';
export async function callCommand(args, options) {
    const parsed = parseCallArgs(args);
    if (parsed.error !== undefined) {
        return failure(parsed.error);
    }
    if (parsed.prompt === undefined || parsed.prompt.length === 0) {
        return usageError('ax call <prompt>');
    }
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createRuntime(options);
    const prompt = await buildPrompt(parsed.prompt, parsed.files);
    if (parsed.autonomous || parsed.goal !== undefined || parsed.intent !== undefined) {
        return runAutonomousCall(runtime, {
            ...parsed,
            prompt,
            basePath,
            options,
        });
    }
    const result = await runtime.callProvider({
        prompt,
        systemPrompt: parsed.systemPrompt,
        traceId: options.traceId,
        sessionId: options.sessionId,
        basePath,
        provider: options.provider,
        maxTokens: parsed.maxTokens,
        temperature: parsed.temperature,
        surface: 'cli',
    });
    if (!result.success) {
        return failure(`Provider call failed: ${result.error?.message ?? 'Unknown error'}`, result);
    }
    const warningText = result.warnings.length === 0
        ? ''
        : `\nWarnings:\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`;
    return success([
        `Call completed with trace ${result.traceId}.`,
        `Provider: ${result.provider}`,
        `Execution mode: ${result.executionMode}`,
        '',
        result.content,
    ].join('\n') + warningText, result);
}
function parseCallArgs(args) {
    const parsed = {
        files: [],
        autonomous: false,
        requireReal: false,
    };
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (token === undefined) {
            continue;
        }
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }
        const name = token.slice(2);
        if (name === 'autonomous') {
            parsed.autonomous = true;
            continue;
        }
        if (name === 'require-real') {
            parsed.requireReal = true;
            continue;
        }
        const value = args[index + 1];
        if (value === undefined || value.startsWith('--')) {
            return { ...parsed, error: `Missing value for --${name}.` };
        }
        index += 1;
        switch (name) {
            case 'files':
                parsed.files = splitCommaList(value);
                break;
            case 'system':
                parsed.systemPrompt = value;
                break;
            case 'max-tokens': {
                const maxTokens = Number.parseInt(value, 10);
                if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
                    return { ...parsed, error: 'Call max-tokens must be a positive integer.' };
                }
                parsed.maxTokens = maxTokens;
                break;
            }
            case 'temperature': {
                const temperature = Number.parseFloat(value);
                if (!Number.isFinite(temperature) || temperature < 0) {
                    return { ...parsed, error: 'Call temperature must be a non-negative number.' };
                }
                parsed.temperature = temperature;
                break;
            }
            case 'goal':
                parsed.goal = value;
                break;
            case 'intent':
                if (value !== 'query' && value !== 'analysis' && value !== 'code') {
                    return { ...parsed, error: 'Call intent must be one of: query, analysis, code.' };
                }
                parsed.intent = value;
                break;
            case 'max-rounds': {
                const maxRounds = Number.parseInt(value, 10);
                if (!Number.isFinite(maxRounds) || maxRounds < 1 || maxRounds > 6) {
                    return { ...parsed, error: 'Call max-rounds must be an integer between 1 and 6.' };
                }
                parsed.maxRounds = maxRounds;
                break;
            }
            default:
                return { ...parsed, error: `Unknown call flag: --${name}.` };
        }
    }
    parsed.prompt = positionals.join(' ').trim();
    return parsed;
}
async function buildPrompt(prompt, files) {
    if (files.length === 0) {
        return prompt;
    }
    const contexts = await Promise.all(files.map(async (filePath) => {
        try {
            const content = await readFile(filePath, 'utf8');
            return `File: ${filePath}\n${content}`;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return `File: ${filePath}\n<unreadable: ${message}>`;
        }
    }));
    return [
        prompt,
        '',
        'Attached file context:',
        ...contexts,
    ].join('\n');
}
async function runAutonomousCall(runtime, request) {
    const intent = request.intent ?? classifyIntent(request.prompt, request.files);
    const phases = selectAutonomyPhases(intent, request.maxRounds);
    const rounds = [];
    let previousContent = '';
    for (let index = 0; index < phases.length; index += 1) {
        const phase = phases[index];
        const roundPrompt = buildAutonomyPrompt({
            intent,
            goal: request.goal,
            basePrompt: request.prompt,
            phase,
            previousContent,
        });
        const result = await runtime.callProvider({
            prompt: roundPrompt,
            systemPrompt: buildAutonomySystemPrompt(request.systemPrompt, intent, phase),
            traceId: request.options.traceId === undefined ? undefined : `${request.options.traceId}-r${index + 1}`,
            sessionId: request.options.sessionId,
            basePath: request.basePath,
            provider: request.options.provider,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
            surface: 'cli',
        });
        if (!result.success) {
            return failure(`Autonomous call failed during ${phase}: ${result.error?.message ?? 'Unknown error'}`, {
                intent,
                phase,
                rounds,
                failedRound: index + 1,
                error: result.error,
            });
        }
        rounds.push({
            phase,
            traceId: result.traceId,
            executionMode: result.executionMode,
            content: result.content,
            warnings: result.warnings,
        });
        previousContent = result.content;
    }
    if (request.requireReal && rounds.some((round) => round.executionMode !== 'subprocess')) {
        return failure('Autonomous call required real provider execution, but at least one round fell back to simulation.', {
            intent,
            rounds,
        });
    }
    const finalRound = rounds.at(-1);
    return success([
        `Autonomous call completed with ${rounds.length} round${rounds.length === 1 ? '' : 's'}.`,
        `Intent: ${intent}`,
        `Provider: ${request.options.provider ?? 'claude'}`,
        `Execution modes: ${Array.from(new Set(rounds.map((round) => round.executionMode))).join(', ')}`,
        'Rounds:',
        ...rounds.map((round, index) => `- ${index + 1}. ${round.phase} (${round.traceId}, ${round.executionMode})`),
        '',
        finalRound?.content ?? '',
        ...renderAutonomyWarnings(rounds),
    ].join('\n'), {
        intent,
        goal: request.goal,
        rounds,
        finalContent: finalRound?.content ?? '',
    });
}
function classifyIntent(prompt, files) {
    const normalized = prompt.toLowerCase();
    if (files.length > 0
        || /\b(fix|implement|patch|refactor|write|code|test|bug)\b/.test(normalized)) {
        return 'code';
    }
    if (/\b(analyze|review|compare|risk|explain|investigate|diagnose|audit)\b/.test(normalized)) {
        return 'analysis';
    }
    return 'query';
}
function selectAutonomyPhases(intent, maxRounds) {
    const phasesByIntent = {
        query: ['understand', 'answer'],
        analysis: ['frame', 'analyze', 'conclude'],
        code: ['plan', 'implement', 'self-review'],
    };
    const phases = phasesByIntent[intent];
    return phases.slice(0, maxRounds ?? phases.length);
}
function buildAutonomySystemPrompt(systemPrompt, intent, phase) {
    const autonomyPrompt = `You are operating in AutomatosX autonomous call mode. Intent=${intent}. Phase=${phase}. Keep the output concise, actionable, and grounded in the prompt context.`;
    return systemPrompt === undefined || systemPrompt.length === 0
        ? autonomyPrompt
        : `${systemPrompt}\n\n${autonomyPrompt}`;
}
function buildAutonomyPrompt(request) {
    return [
        request.goal === undefined ? undefined : `Goal: ${request.goal}`,
        `Intent: ${request.intent}`,
        `Phase: ${request.phase}`,
        'Task:',
        request.basePrompt,
        request.previousContent.length === 0
            ? undefined
            : `Previous round output:\n${request.previousContent}`,
        `Phase directive: ${phaseDirective(request.intent, request.phase)}`,
    ].filter((value) => value !== undefined && value.length > 0).join('\n\n');
}
function phaseDirective(intent, phase) {
    const directives = {
        query: {
            understand: 'Clarify the user request and identify the most important constraints.',
            answer: 'Provide the direct answer with only the necessary supporting detail.',
        },
        analysis: {
            frame: 'Frame the problem, assumptions, and evaluation criteria.',
            analyze: 'Do the substantive analysis and compare the main options or risks.',
            conclude: 'Deliver the conclusion, recommended action, and key tradeoffs.',
        },
        code: {
            plan: 'Produce a concrete implementation plan with likely risks and edge cases.',
            implement: 'Produce the implementation-oriented answer with precise steps or code guidance.',
            'self-review': 'Review the proposed implementation for bugs, missing tests, and regressions.',
        },
    };
    return directives[intent][phase] ?? 'Advance the task toward completion.';
}
function renderAutonomyWarnings(rounds) {
    const warnings = Array.from(new Set(rounds.flatMap((round) => round.warnings)));
    return warnings.length === 0
        ? []
        : [
            '',
            'Warnings:',
            ...warnings.map((warning) => `- ${warning}`),
        ];
}
