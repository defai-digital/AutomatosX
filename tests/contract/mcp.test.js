import { describe, it, expect } from 'vitest';
import { McpToolSchema, ToolResultSchema, ToolErrorSchema, ErrorCodeSchema, validateMcpTool, safeValidateMcpTool, createSuccessResult, createErrorResult, StandardErrorCodes, } from '@defai.digital/contracts';
describe('MCP Tool Contract V1', () => {
    describe('Schema Validation', () => {
        it('should validate a minimal valid tool', () => {
            const tool = {
                name: 'read_file',
                description: 'Reads contents of a file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                    },
                    required: ['path'],
                },
            };
            const result = safeValidateMcpTool(tool);
            expect(result.success).toBe(true);
        });
        it('should validate a complete tool with all fields', () => {
            const tool = {
                name: 'write_file',
                description: 'Writes content to a file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        content: { type: 'string' },
                    },
                    required: ['path', 'content'],
                },
                outputSchema: {
                    type: 'object',
                    properties: {
                        bytesWritten: { type: 'number' },
                    },
                },
                errorCodes: [
                    {
                        code: 'FILE_NOT_FOUND',
                        description: 'The specified file does not exist',
                        retryable: false,
                    },
                    {
                        code: 'PERMISSION_DENIED',
                        description: 'No write permission',
                        retryable: false,
                    },
                ],
                metadata: {
                    category: 'filesystem',
                    version: '1.0.0',
                },
            };
            const result = validateMcpTool(tool);
            expect(result.name).toBe('write_file');
            expect(result.errorCodes).toHaveLength(2);
        });
        it('should reject tool without required fields', () => {
            const invalid = {
                name: 'test_tool',
                // missing description and inputSchema
            };
            const result = safeValidateMcpTool(invalid);
            expect(result.success).toBe(false);
        });
    });
    describe('INV-MCP-001: Schema Conformance', () => {
        it('should accept valid tool name format', () => {
            const validNames = ['read_file', 'search', 'get_weather', 'a123_test'];
            for (const name of validNames) {
                const tool = {
                    name,
                    description: 'Test tool',
                    inputSchema: {},
                };
                const result = McpToolSchema.safeParse(tool);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid tool name format', () => {
            const invalidNames = [
                'ReadFile', // uppercase
                '123_tool', // starts with number
                'tool-name', // hyphen not allowed
                '', // empty
            ];
            for (const name of invalidNames) {
                const tool = {
                    name,
                    description: 'Test tool',
                    inputSchema: {},
                };
                const result = McpToolSchema.safeParse(tool);
                expect(result.success).toBe(false);
            }
        });
    });
    describe('INV-MCP-003: Standardized Error Codes', () => {
        it('should accept valid error code format', () => {
            const validCodes = [
                { code: 'INVALID_INPUT', description: 'Invalid input' },
                { code: 'RESOURCE_NOT_FOUND', description: 'Resource not found' },
                { code: 'A123_ERROR', description: 'Error with numbers' },
            ];
            for (const errorCode of validCodes) {
                const result = ErrorCodeSchema.safeParse(errorCode);
                expect(result.success).toBe(true);
            }
        });
        it('should reject invalid error code format', () => {
            const invalidCodes = [
                { code: 'invalid_input', description: 'lowercase' },
                { code: '123_ERROR', description: 'starts with number' },
                { code: 'INVALID-INPUT', description: 'hyphen' },
            ];
            for (const errorCode of invalidCodes) {
                const result = ErrorCodeSchema.safeParse(errorCode);
                expect(result.success).toBe(false);
            }
        });
        it('should validate all standard error codes exist', () => {
            const expectedCodes = [
                'INVALID_INPUT',
                'RESOURCE_NOT_FOUND',
                'PERMISSION_DENIED',
                'RATE_LIMITED',
                'INTERNAL_ERROR',
                'TIMEOUT',
                'NOT_IMPLEMENTED',
            ];
            for (const code of expectedCodes) {
                expect(Object.values(StandardErrorCodes)).toContain(code);
            }
        });
    });
    describe('Tool Result Validation', () => {
        it('should validate success result', () => {
            const successResult = {
                success: true,
                data: { message: 'Operation completed' },
            };
            const result = ToolResultSchema.safeParse(successResult);
            expect(result.success).toBe(true);
        });
        it('should validate error result', () => {
            const errorResult = {
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required field',
                    details: { field: 'path' },
                },
            };
            const result = ToolResultSchema.safeParse(errorResult);
            expect(result.success).toBe(true);
        });
        it('should reject invalid result (success with error)', () => {
            const invalid = {
                success: true,
                error: { code: 'ERROR', message: 'This should not exist' },
            };
            // Discriminated union should reject this
            const result = ToolResultSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });
    describe('Result Helpers', () => {
        it('should create success result correctly', () => {
            const result = createSuccessResult({ id: 123 });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ id: 123 });
            }
        });
        it('should create error result correctly', () => {
            const result = createErrorResult('INVALID_INPUT', 'Path is required', { field: 'path' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_INPUT');
                expect(result.error.message).toBe('Path is required');
                expect(result.error.details).toEqual({ field: 'path' });
            }
        });
    });
    describe('Tool Error Validation', () => {
        it('should validate complete tool error', () => {
            const error = {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                details: {
                    timestamp: '2024-12-14T00:00:00Z',
                    requestId: 'abc123',
                },
            };
            const result = ToolErrorSchema.safeParse(error);
            expect(result.success).toBe(true);
        });
        it('should reject error without required fields', () => {
            const invalid = {
                code: 'ERROR',
                // missing message
            };
            const result = ToolErrorSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=mcp.test.js.map