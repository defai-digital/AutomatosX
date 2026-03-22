import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { failure, success, usageError } from '../utils/formatters.js';
export async function reviewCommand(args, options) {
    const parsed = parseReviewArgs(args);
    if (parsed.error !== undefined) {
        return failure(parsed.error);
    }
    switch (parsed.subcommand) {
        case 'help':
            return success([
                'AX Review',
                '',
                'Usage:',
                '  ax review analyze <paths...> [--focus security|correctness|maintainability|all] [--max-files <n>]',
                '  ax review list',
            ].join('\n'));
        case 'list':
            return listReviews(options);
        case 'analyze':
            if (parsed.paths.length === 0) {
                return usageError('ax review analyze <paths...>');
            }
            return analyzeReview(parsed, options);
    }
}
function parseReviewArgs(args) {
    const subcommand = (args[0] === 'list' || args[0] === 'help' || args[0] === 'analyze')
        ? args[0]
        : 'analyze';
    const startIndex = args[0] === subcommand ? 1 : 0;
    const paths = [];
    let focus = 'all';
    let maxFiles = 25;
    for (let index = startIndex; index < args.length; index += 1) {
        const token = args[index];
        if (token === '--focus' && args[index + 1] !== undefined) {
            const next = args[index + 1];
            if (next === 'all' || next === 'security' || next === 'correctness' || next === 'maintainability') {
                focus = next;
            }
            else {
                return {
                    subcommand,
                    paths,
                    focus,
                    maxFiles,
                    error: 'Review focus must be one of: all, security, correctness, maintainability.',
                };
            }
            index += 1;
        }
        else if (token === '--focus') {
            return {
                subcommand,
                paths,
                focus,
                maxFiles,
                error: 'Missing value for --focus.',
            };
        }
        else if (token === '--max-files' && args[index + 1] !== undefined) {
            const parsedMax = Number.parseInt(args[index + 1] ?? '', 10);
            if (Number.isFinite(parsedMax) && parsedMax > 0) {
                maxFiles = parsedMax;
            }
            else {
                return {
                    subcommand,
                    paths,
                    focus,
                    maxFiles,
                    error: 'Review max-files must be a positive integer.',
                };
            }
            index += 1;
        }
        else if (token === '--max-files') {
            return {
                subcommand,
                paths,
                focus,
                maxFiles,
                error: 'Missing value for --max-files.',
            };
        }
        else if (token !== undefined && !token.startsWith('--')) {
            paths.push(token);
        }
    }
    return {
        subcommand,
        paths,
        focus,
        maxFiles,
    };
}
async function analyzeReview(parsed, options) {
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createSharedRuntimeService({ basePath });
    const result = await runtime.analyzeReview({
        paths: parsed.paths,
        focus: parsed.focus,
        maxFiles: parsed.maxFiles,
        traceId: options.traceId,
        sessionId: options.sessionId,
        basePath,
        surface: 'cli',
    });
    if (!result.success) {
        return failure(`Review failed: ${result.error?.message ?? 'Unknown error'}`, result);
    }
    return success(`Review completed with trace ${result.traceId}. Files scanned: ${result.filesScanned}. Findings: ${result.findings.length}.`, result);
}
async function listReviews(options) {
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createSharedRuntimeService({ basePath });
    const reviews = await runtime.listReviewTraces(options.limit);
    if (reviews.length === 0) {
        return success('No review traces found.', reviews);
    }
    const lines = [
        'Review traces:',
        ...reviews.map((trace) => `- ${trace.traceId} ${trace.status} ${trace.startedAt}`),
    ];
    return success(lines.join('\n'), reviews);
}
