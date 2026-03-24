import { createMcpServerSurface, createMcpStdioServer } from '@defai.digital/mcp-server';
import { failure, success, usageError } from '../utils/formatters.js';
import { parseOptionalJsonInput } from '../utils/validation.js';
export async function mcpCommand(args, options) {
    const subcommand = args[0] ?? 'tools';
    const basePath = options.outputDir ?? process.cwd();
    const surface = createMcpServerSurface({ basePath });
    switch (subcommand) {
        case 'tools': {
            const tools = surface.listToolDefinitions();
            const lines = [
                'Available MCP tools:',
                ...tools.map((tool) => `- ${tool.name}: ${tool.description}`),
            ];
            return success(lines.join('\n'), tools);
        }
        case 'describe': {
            const toolName = args[1];
            if (toolName === undefined || toolName.length === 0) {
                return usageError('ax mcp describe <tool-name>');
            }
            const tool = surface.listToolDefinitions().find((entry) => entry.name === toolName);
            if (tool === undefined) {
                return failure(`Unknown MCP tool: ${toolName}`);
            }
            return success([
                `MCP tool: ${tool.name}`,
                tool.description,
                '',
                JSON.stringify(tool.inputSchema, null, 2),
            ].join('\n'), tool);
        }
        case 'resources': {
            const resources = surface.listResources();
            const lines = [
                'Available MCP resources:',
                ...resources.map((resource) => `- ${resource.uri} (${resource.mimeType}): ${resource.description}`),
            ];
            return success(lines.join('\n'), resources);
        }
        case 'read': {
            const uri = args[1];
            if (uri === undefined || uri.length === 0) {
                return usageError('ax mcp read <resource-uri>');
            }
            let resource;
            try {
                resource = await surface.readResource(uri);
            }
            catch (error) {
                return failure(error instanceof Error ? error.message : String(error));
            }
            return success([
                `Resource: ${resource.uri}`,
                `Mime-Type: ${resource.mimeType}`,
                '',
                resource.text,
            ].join('\n'), resource);
        }
        case 'prompts': {
            const prompts = surface.listPrompts();
            const lines = [
                'Available MCP prompts:',
                ...prompts.map((prompt) => `- ${prompt.name}: ${prompt.description}`),
            ];
            return success(lines.join('\n'), prompts);
        }
        case 'prompt': {
            const promptName = args[1];
            if (promptName === undefined || promptName.length === 0) {
                return usageError('ax mcp prompt <prompt-name> [--input <json-object>]');
            }
            const parsed = parseOptionalJsonInput(options.input, 'MCP');
            if (parsed.error !== undefined) {
                return failure(parsed.error);
            }
            let prompt;
            try {
                prompt = await surface.getPrompt(promptName, parsed.value ?? {});
            }
            catch (error) {
                return failure(error instanceof Error ? error.message : String(error));
            }
            return success([
                `Prompt: ${promptName}`,
                prompt.description,
                '',
                ...prompt.messages.map((message) => `[${message.role}] ${message.content.text}`),
            ].join('\n'), prompt);
        }
        case 'serve': {
            const server = createMcpStdioServer({ basePath });
            await server.serve();
            return success('MCP stdio server closed.');
        }
        case 'call':
        case 'invoke': {
            const toolName = args[1];
            if (toolName === undefined || toolName.length === 0) {
                return usageError('ax mcp call <tool-name> [--input <json-object>]');
            }
            const parsed = parseOptionalJsonInput(options.input, 'MCP');
            if (parsed.error !== undefined) {
                return failure(parsed.error);
            }
            const result = await surface.invokeTool(toolName, parsed.value ?? {});
            if (!result.success) {
                return failure(`MCP tool failed: ${result.error ?? 'Unknown MCP error'}`, result);
            }
            return success(`MCP tool ${toolName} completed successfully.`, result.data);
        }
        default:
            return usageError('ax mcp [tools|describe|resources|read|prompts|prompt|call|serve]');
    }
}
