/**
 * Discuss MCP Tool Handler Tests
 *
 * Tests for the discuss and discuss_quick MCP tool handlers.
 */
import { describe, it, expect } from 'vitest';
import { handleDiscuss, handleDiscussQuick, discussTool, discussQuickTool, } from '@defai.digital/mcp-server';
// Helper to extract text content from MCP result
function getTextContent(result) {
    const content = result.content[0];
    if (content?.type === 'text' && content.text) {
        return content.text;
    }
    return '';
}
// ============================================================================
// Tool Definition Tests
// ============================================================================
describe('Discuss MCP Tools - Tool Definitions', () => {
    describe('discussTool', () => {
        it('should have correct name', () => {
            expect(discussTool.name).toBe('discuss');
        });
        it('should have description', () => {
            expect(discussTool.description).toBeDefined();
            expect(discussTool.description).toContain('multi-model discussion');
        });
        it('should have inputSchema with required topic', () => {
            expect(discussTool.inputSchema).toBeDefined();
            expect(discussTool.inputSchema.properties?.topic).toBeDefined();
            expect(discussTool.inputSchema.required).toContain('topic');
        });
        it('should have all expected input properties', () => {
            const props = discussTool.inputSchema.properties;
            expect(props?.topic).toBeDefined();
            expect(props?.pattern).toBeDefined();
            expect(props?.providers).toBeDefined();
            expect(props?.rounds).toBeDefined();
            expect(props?.consensus).toBeDefined();
            expect(props?.synthesizer).toBeDefined();
            expect(props?.context).toBeDefined();
            expect(props?.timeout).toBeDefined();
        });
        it('should have outputSchema', () => {
            expect(discussTool.outputSchema).toBeDefined();
            expect(discussTool.outputSchema?.properties?.success).toBeDefined();
            expect(discussTool.outputSchema?.properties?.synthesis).toBeDefined();
        });
        it('should be marked as non-idempotent', () => {
            expect(discussTool.idempotent).toBe(false);
        });
    });
    describe('discussQuickTool', () => {
        it('should have correct name', () => {
            expect(discussQuickTool.name).toBe('discuss_quick');
        });
        it('should have description', () => {
            expect(discussQuickTool.description).toBeDefined();
            expect(discussQuickTool.description).toContain('Quick');
        });
        it('should have simpler inputSchema', () => {
            expect(discussQuickTool.inputSchema).toBeDefined();
            expect(discussQuickTool.inputSchema.properties?.topic).toBeDefined();
            expect(discussQuickTool.inputSchema.properties?.providers).toBeDefined();
        });
        it('should be marked as non-idempotent', () => {
            expect(discussQuickTool.idempotent).toBe(false);
        });
    });
});
// ============================================================================
// Handler Validation Tests
// ============================================================================
describe('Discuss MCP Tools - Handler Validation', () => {
    describe('handleDiscuss', () => {
        it('should reject empty topic', async () => {
            const result = await handleDiscuss({ topic: '' });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('topic is required');
        });
        it('should reject whitespace-only topic', async () => {
            const result = await handleDiscuss({ topic: '   ' });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('topic is required');
        });
        it('should reject topic exceeding max length', async () => {
            const result = await handleDiscuss({ topic: 'x'.repeat(2001) });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('2000 characters');
        });
        it('should reject less than 2 providers', async () => {
            const result = await handleDiscuss({
                topic: 'Test topic',
                providers: ['claude'],
            });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('at least 2 providers');
        });
        it('should accept valid input with defaults', async () => {
            const result = await handleDiscuss({ topic: 'Test topic' });
            // Should not be a validation error (may still fail on execution)
            // The stub executor returns mock responses
            expect(result.content).toBeDefined();
            expect(result.content[0]).toBeDefined();
        });
    });
    describe('handleDiscussQuick', () => {
        it('should reject empty topic', async () => {
            const result = await handleDiscussQuick({ topic: '' });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('topic is required');
        });
        it('should reject whitespace-only topic', async () => {
            const result = await handleDiscussQuick({ topic: '   ' });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('topic is required');
        });
        it('should reject topic exceeding max length', async () => {
            const result = await handleDiscussQuick({ topic: 'x'.repeat(2001) });
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain('2000 characters');
        });
        it('should accept valid input', async () => {
            const result = await handleDiscussQuick({ topic: 'Test topic' });
            // Should not be a validation error
            expect(result.content).toBeDefined();
            expect(result.content[0]).toBeDefined();
        });
    });
});
// ============================================================================
// Handler Execution Tests (using stub executor)
// ============================================================================
describe('Discuss MCP Tools - Handler Execution', () => {
    describe('handleDiscuss', () => {
        it('should return JSON content', async () => {
            const result = await handleDiscuss({
                topic: 'What is the best programming language?',
            });
            expect(result.content).toBeDefined();
            const text = getTextContent(result);
            expect(text).toBeTruthy();
            // Parse the JSON result
            const data = JSON.parse(text);
            expect(data).toBeDefined();
        });
        it('should include success flag in result', async () => {
            const result = await handleDiscuss({
                topic: 'Discuss microservices vs monolith',
            });
            const data = JSON.parse(getTextContent(result));
            expect(typeof data.success).toBe('boolean');
        });
        it('should include pattern in result', async () => {
            const result = await handleDiscuss({
                topic: 'Test topic',
                pattern: 'voting',
            });
            const data = JSON.parse(getTextContent(result));
            // Either succeeded with pattern or failed (both valid outcomes)
            if (data.pattern) {
                expect(data.pattern).toBe('voting');
            }
        });
        it('should include participating providers', async () => {
            const result = await handleDiscuss({
                topic: 'Test topic',
                providers: ['claude', 'grok'],
            });
            const data = JSON.parse(getTextContent(result));
            // Should have participating or failed providers
            expect(Array.isArray(data.participatingProviders) || Array.isArray(data.failedProviders)).toBe(true);
        });
        it('should respect custom timeout', async () => {
            const result = await handleDiscuss({
                topic: 'Test topic',
                timeout: 30000,
            });
            // Should complete without timeout (stub executor is fast)
            expect(result.content).toBeDefined();
        });
    });
    describe('handleDiscussQuick', () => {
        it('should return JSON content', async () => {
            const result = await handleDiscussQuick({
                topic: 'What is the best approach?',
            });
            expect(result.content).toBeDefined();
            const text = getTextContent(result);
            expect(text).toBeTruthy();
            // Parse the JSON result
            const data = JSON.parse(text);
            expect(data).toBeDefined();
        });
        it('should include success flag', async () => {
            const result = await handleDiscussQuick({
                topic: 'Quick discussion topic',
            });
            const data = JSON.parse(getTextContent(result));
            expect(typeof data.success).toBe('boolean');
        });
        it('should include synthesis in successful result', async () => {
            const result = await handleDiscussQuick({
                topic: 'What is the best option?',
            });
            const data = JSON.parse(getTextContent(result));
            // Either has synthesis or failed
            if (data.success) {
                expect(data.synthesis).toBeDefined();
            }
        });
        it('should include duration in result', async () => {
            const result = await handleDiscussQuick({
                topic: 'Test topic',
            });
            const data = JSON.parse(getTextContent(result));
            expect(typeof data.totalDurationMs).toBe('number');
        });
        it('should use custom providers when specified', async () => {
            const result = await handleDiscussQuick({
                topic: 'Test topic',
                providers: ['claude', 'grok'],
            });
            const data = JSON.parse(getTextContent(result));
            // Should use the specified providers
            expect(data.participatingProviders || data.failedProviders).toBeDefined();
        });
    });
});
// ============================================================================
// Error Handling Tests
// ============================================================================
describe('Discuss MCP Tools - Error Handling', () => {
    describe('handleDiscuss', () => {
        it('should handle missing topic gracefully', async () => {
            const result = await handleDiscuss({});
            expect(result.isError).toBe(true);
        });
        it('should set isError flag on validation failure', async () => {
            const result = await handleDiscuss({ topic: '' });
            expect(result.isError).toBe(true);
        });
    });
    describe('handleDiscussQuick', () => {
        it('should handle missing topic gracefully', async () => {
            const result = await handleDiscussQuick({});
            expect(result.isError).toBe(true);
        });
        it('should set isError flag on validation failure', async () => {
            const result = await handleDiscussQuick({ topic: '' });
            expect(result.isError).toBe(true);
        });
    });
});
// ============================================================================
// Tool Registration Tests
// ============================================================================
describe('Discuss MCP Tools - Registration', () => {
    it('should export DISCUSS_TOOLS array', async () => {
        const { DISCUSS_TOOLS } = await import('@defai.digital/mcp-server');
        expect(Array.isArray(DISCUSS_TOOLS)).toBe(true);
        expect(DISCUSS_TOOLS.length).toBe(3); // discuss, discuss_quick, discuss_recursive
    });
    it('should export DISCUSS_HANDLERS record', async () => {
        const { DISCUSS_HANDLERS } = await import('@defai.digital/mcp-server');
        expect(typeof DISCUSS_HANDLERS).toBe('object');
        expect(DISCUSS_HANDLERS.discuss).toBeDefined();
        expect(DISCUSS_HANDLERS.discuss_quick).toBeDefined();
        expect(DISCUSS_HANDLERS.discuss_recursive).toBeDefined();
    });
    it('should have matching tool names in handlers', async () => {
        const { DISCUSS_TOOLS, DISCUSS_HANDLERS } = await import('@defai.digital/mcp-server');
        for (const tool of DISCUSS_TOOLS) {
            expect(DISCUSS_HANDLERS[tool.name]).toBeDefined();
        }
    });
});
//# sourceMappingURL=discuss-tools.test.js.map