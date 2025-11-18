# AutomatosX Model Context Protocol (MCP) Documentation

## 1. Executive Summary

The Model Context Protocol (MCP) is a JSON-RPC 2.0 based protocol that serves as a communication layer between the AutomatosX platform and external clients, such as the "Claude Code" IDE extension. MCP exposes core AutomatosX functionalities, like agent execution and memory management, as a set of remotely callable "tools".

A key architectural aspect of AutomatosX is that the AI providers (Claude, Gemini, OpenAI) are implemented as simple wrappers around their respective command-line interface (CLI) tools and have **no direct knowledge of or integration with MCP**. The `McpServer` initializes and uses these providers, but the providers themselves are decoupled and unaware of the MCP layer. The integration is achieved by the providers launching the CLI tools with specific arguments to produce structured JSON output, which is then consumed by the AutomatosX backend.

## 2. What is MCP and its purpose?

MCP is a formal protocol for client-server communication, defined in `src/mcp/types.ts`. It is built on the JSON-RPC 2.0 standard and is designed to be used over `stdio`. Its primary purpose is to allow external clients to programmatically access and control AutomatosX features.

The protocol defines several methods, including:

*   `initialize`: To set up the connection between the client and the server.
*   `tools/list`: To get a list of available tools.
*   `tools/call`: To execute a specific tool with given arguments.

MCP also defines the schemas for the available tools, such as:

*   `run_agent`: To execute an agent with a task.
*   `list_agents`: To list all available agents.
*   `search_memory`: To search the agent memory.
*   `get_status`: To get the system status.

The protocol is clearly designed for machine-to-machine communication, enabling integrations with IDEs and other development tools.

## 3. Provider Support for MCP

The providers (Claude, Gemini, OpenAI) **do not directly support or integrate with MCP**. They are architected as simple wrappers around their respective command-line interface (CLI) tools. The `McpServer` initializes and uses these providers, but the providers themselves are unaware of the MCP layer.

## 4. AutomatosX Implementation of MCP

The MCP server is implemented in `src/mcp/server.ts`. The `McpServer` class is responsible for:

1.  **Initializing Services:** It initializes all the necessary AutomatosX services, including the `Router`, `MemoryManager`, and all the configured providers.
2.  **Registering Tools:** It registers all the available MCP tools and their handlers. For example, it maps the `run_agent` tool to the `createRunAgentHandler` function.
3.  **Handling Requests:** It listens for JSON-RPC requests on `stdio`, parses them, and routes them to the appropriate tool handlers.
4.  **Sending Responses:** It sends JSON-RPC responses back to the client over `stdio`.

The server acts as the central hub that connects the MCP protocol to the underlying AutomatosX functionalities.

## 5. MCP Integration with Providers

The integration between the MCP server and the providers is indirect. The `McpServer` uses the `Router` to select a provider, and then the `run_agent` tool handler calls the `execute` method of the selected provider.

The providers, in turn, are implemented as subclasses of `BaseProvider` (defined in `src/providers/base-provider.ts`). The `BaseProvider` class defines the core logic for executing a CLI command. The concrete provider classes (`ClaudeProvider`, `GeminiProvider`, `OpenAIProvider`) simply provide the specific command and arguments for their respective CLI tools.

The key to the integration is the use of special command-line arguments that instruct the CLI tools to output structured JSON data.

### Claude Integration

The `ClaudeProvider` (in `src/providers/claude-provider.ts`) uses the `claude` CLI tool with the following arguments:

```typescript
protected override getCLIArgs(): string[] {
  return [
    '--print',  // Non-interactive mode
    '--output-format', 'stream-json'  // Enable streaming JSON output
  ];
}
```

The `--output-format stream-json` argument is the crucial piece that enables the "Claude Code" integration. It makes the `claude` CLI tool output a stream of JSON objects that the AutomatosX backend can parse.

### Gemini Integration

The `GeminiProvider` (in `src/providers/gemini-provider.ts`) follows a similar pattern, using the `gemini` CLI tool with:

```typescript
protected override getCLIArgs(): string[] {
  return [
    '--approval-mode', 'auto_edit',  // Auto-approve file edit operations
    '--output-format', 'stream-json'  // Enable streaming JSON output
  ];
}
```

### OpenAI Integration

The `OpenAIProvider` (in `src/providers/openai-provider.ts`) uses the `codex exec` command with the `--json` flag:

```typescript
protected override getCLIArgs(): string[] {
  return ['--json'];  // Output events as JSONL (streaming JSON)
}
```

This produces JSONL (newline-delimited JSON), which is another form of streaming JSON that can be parsed by the backend.

## 6. Code Locations and Implementation Details

Here is a summary of the key files and their roles in the MCP implementation:

*   **`src/mcp/types.ts`**: Defines the MCP protocol, including all the JSON-RPC messages and tool schemas.
*   **`src/mcp/server.ts`**: Implements the MCP server, which initializes services, registers tools, and handles requests.
*   **`src/providers/base-provider.ts`**: Defines the `BaseProvider` class, which is the foundation for all the CLI-based providers.
*   **`src/providers/claude-provider.ts`**: The concrete implementation for the Claude provider.
*   **`src/providers/gemini-provider.ts`**: The concrete implementation for the Gemini provider.
*   **`src/providers/openai-provider.ts`**: The concrete implementation for the OpenAI provider.
