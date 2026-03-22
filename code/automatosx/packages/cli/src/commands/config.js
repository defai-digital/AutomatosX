import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { failure, success, usageError } from '../utils/formatters.js';
export async function configCommand(args, options) {
    const subcommand = args[0] ?? 'show';
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createSharedRuntimeService({ basePath });
    switch (subcommand) {
        case 'show': {
            const config = await runtime.showConfig();
            return success([
                'Workspace config:',
                JSON.stringify(config, null, 2),
            ].join('\n'), config);
        }
        case 'get': {
            const path = args[1];
            if (path === undefined || path.length === 0) {
                return usageError('ax config get <path>');
            }
            const value = await runtime.getConfig(path);
            return success([
                `Config value: ${path}`,
                JSON.stringify(value, null, 2),
            ].join('\n'), value);
        }
        case 'set': {
            const path = args[1];
            if (path === undefined || path.length === 0) {
                return usageError('ax config set <path> <value>|--input <json-value>');
            }
            const parsed = parseConfigValue(args.slice(2), options.input);
            if (parsed.error !== undefined) {
                return failure(parsed.error);
            }
            const config = await runtime.setConfig(path, parsed.value);
            return success(`Updated config path: ${path}`, config);
        }
        default:
            return usageError('ax config [show|get|set]');
    }
}
function parseConfigValue(args, input) {
    const source = input ?? args.join(' ').trim();
    if (source.length === 0) {
        return { value: undefined, error: 'Config set requires a value via --input <json-value> or a trailing argument.' };
    }
    try {
        return { value: JSON.parse(source) };
    }
    catch {
        return { value: source };
    }
}
