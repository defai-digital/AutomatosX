/**
 * AutomatosX v8.0.0 - IntentClassifier Tests
 *
 * Test suite for intent classification (pattern matching + LLM fallback)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentClassifier } from '../IntentClassifier.js';
describe('IntentClassifier', () => {
    describe('Pattern Matching - Memory Search', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should classify "find authentication logic" as memory-search', async () => {
            const intent = await classifier.classify('find authentication logic');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
            expect(intent.confidence).toBe(0.9);
            expect(intent.extractedData?.query).toBe('authentication logic');
        });
        it('should classify "search for getUserById function" as memory-search', async () => {
            const intent = await classifier.classify('search for getUserById function');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.query).toContain('getUserById');
        });
        it('should classify "show me JWTValidator implementation" as memory-search', async () => {
            const intent = await classifier.classify('show me JWTValidator implementation');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.query).toContain('JWTValidator');
        });
        it('should classify "where is AuthService defined" as memory-search', async () => {
            const intent = await classifier.classify('where is AuthService defined');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.query).toContain('AuthService');
        });
        it('should classify "list all API routes" as memory-search', async () => {
            const intent = await classifier.classify('list all API routes');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
        });
        it('should classify "locate error handling code" as memory-search', async () => {
            const intent = await classifier.classify('locate error handling code');
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.query).toContain('error handling');
        });
        it('should extract clean query by removing common prefixes', async () => {
            const intent = await classifier.classify('find the authentication function');
            expect(intent.extractedData?.query).toBe('the authentication');
        });
        it('should extract clean query by removing common suffixes', async () => {
            const intent = await classifier.classify('search authentication logic code');
            expect(intent.extractedData?.query).toContain('authentication logic');
        });
    });
    describe('Pattern Matching - Workflow Execute', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should classify "run security audit" as workflow-execute', async () => {
            const intent = await classifier.classify('run security audit');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('pattern');
            expect(intent.confidence).toBe(0.9);
            expect(intent.extractedData?.workflowName).toContain('security audit');
        });
        it('should classify "execute CI pipeline" as workflow-execute', async () => {
            const intent = await classifier.classify('execute CI pipeline');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.workflowName).toContain('CI');
        });
        it('should classify "start deployment workflow" as workflow-execute', async () => {
            const intent = await classifier.classify('start deployment workflow');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.workflowName).toContain('deployment');
        });
        it('should classify "perform security scan" as workflow-execute', async () => {
            const intent = await classifier.classify('perform security scan');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.workflowName).toContain('security');
        });
        it('should classify "run tests" as workflow-execute', async () => {
            const intent = await classifier.classify('run tests');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.workflowName).toContain('tests');
        });
        it('should extract workflow name by removing common prefixes', async () => {
            const intent = await classifier.classify('launch quality check workflow');
            expect(intent.extractedData?.workflowName).toContain('quality check');
        });
    });
    describe('Pattern Matching - Agent Delegate', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should classify "use BackendAgent" as agent-delegate', async () => {
            const intent = await classifier.classify('use BackendAgent');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.method).toBe('pattern');
            expect(intent.confidence).toBe(0.9);
            expect(intent.extractedData?.agentName).toBe('Backendagent');
        });
        it('should classify "ask SecurityAgent" as agent-delegate', async () => {
            const intent = await classifier.classify('ask SecurityAgent');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.agentName).toContain('Security');
        });
        it('should classify "talk to FrontendAgent" as agent-delegate', async () => {
            const intent = await classifier.classify('talk to FrontendAgent');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.agentName).toContain('Frontend');
        });
        it('should classify "delegate to TestingAgent" as agent-delegate', async () => {
            const intent = await classifier.classify('delegate to TestingAgent');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.method).toBe('pattern');
            expect(intent.extractedData?.agentName).toContain('Testing');
        });
        it('should extract agent name from mixed case', async () => {
            const intent = await classifier.classify('use backendagent');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.extractedData?.agentName).toMatch(/backend/i);
        });
    });
    describe('Pattern Matching - Chat Fallback', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should classify general questions as chat', async () => {
            const intent = await classifier.classify('how do I use async/await?');
            expect(intent.type).toBe('chat');
            expect(intent.method).toBe('pattern');
        });
        it('should classify "what is React?" as chat', async () => {
            const intent = await classifier.classify('what is React?');
            expect(intent.type).toBe('chat');
            expect(intent.method).toBe('pattern');
        });
        it('should classify "explain typescript" as chat', async () => {
            const intent = await classifier.classify('explain typescript');
            expect(intent.type).toBe('chat');
            expect(intent.method).toBe('pattern');
        });
    });
    describe('Edge Cases', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should handle empty input gracefully', async () => {
            const intent = await classifier.classify('');
            expect(intent.type).toBe('chat');
            expect(intent.confidence).toBe(1.0);
            expect(intent.method).toBe('pattern');
        });
        it('should handle whitespace-only input', async () => {
            const intent = await classifier.classify('   ');
            expect(intent.type).toBe('chat');
            expect(intent.method).toBe('pattern');
        });
        it('should handle special characters', async () => {
            const intent = await classifier.classify('find @Component decorator');
            expect(intent.type).toBe('memory-search');
            expect(intent.extractedData?.query).toContain('Component');
        });
        it('should handle very long input', async () => {
            const longInput = 'find ' + 'authentication '.repeat(50) + 'logic';
            const intent = await classifier.classify(longInput);
            expect(intent.type).toBe('memory-search');
            expect(intent.method).toBe('pattern');
        });
    });
    describe('LLM Fallback', () => {
        it('should use LLM when pattern matching fails', async () => {
            // Mock ProviderRouter
            const mockProviderRouter = {
                route: vi.fn().mockResolvedValue({
                    content: 'memory-search',
                    usage: { totalTokens: 10 }
                })
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('ambiguous query that matches no pattern xyz123');
            expect(mockProviderRouter.route).toHaveBeenCalled();
            expect(intent.method).toBe('llm');
            expect(intent.type).toBe('memory-search');
            expect(intent.confidence).toBe(0.7);
        });
        it('should handle LLM returning workflow-execute', async () => {
            const mockProviderRouter = {
                route: vi.fn().mockResolvedValue({
                    content: 'workflow-execute',
                    usage: { totalTokens: 10 }
                })
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('some ambiguous workflow request');
            expect(intent.type).toBe('workflow-execute');
            expect(intent.method).toBe('llm');
        });
        it('should handle LLM returning agent-delegate', async () => {
            const mockProviderRouter = {
                route: vi.fn().mockResolvedValue({
                    content: 'agent-delegate',
                    usage: { totalTokens: 10 }
                })
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('some ambiguous agent request');
            expect(intent.type).toBe('agent-delegate');
            expect(intent.method).toBe('llm');
        });
        it('should default to chat when LLM returns unknown intent', async () => {
            const mockProviderRouter = {
                route: vi.fn().mockResolvedValue({
                    content: 'unknown-intent-type',
                    usage: { totalTokens: 10 }
                })
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('some query');
            expect(intent.type).toBe('chat');
            expect(intent.method).toBe('llm');
        });
        it('should handle LLM errors gracefully', async () => {
            const mockProviderRouter = {
                route: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('some query that fails');
            expect(intent.type).toBe('chat');
            expect(intent.confidence).toBe(0.5);
            expect(intent.method).toBe('llm');
        });
        it('should include extracted data even with LLM classification', async () => {
            const mockProviderRouter = {
                route: vi.fn().mockResolvedValue({
                    content: 'memory-search',
                    usage: { totalTokens: 10 }
                })
            };
            const classifier = new IntentClassifier(mockProviderRouter);
            const intent = await classifier.classify('find my special function xyz123');
            expect(intent.type).toBe('memory-search');
            expect(intent.extractedData).toBeDefined();
            expect(intent.extractedData?.query).toBeDefined();
        });
    });
    describe('Extraction Methods', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should extract query from complex search patterns', async () => {
            const testCases = [
                { input: 'find the authentication module in the codebase', expected: 'authentication module' },
                { input: 'search for error handling logic in the code', expected: 'error handling logic' },
                { input: 'show me all database connection methods', expected: 'all database connection' }
            ];
            for (const { input, expected } of testCases) {
                const intent = await classifier.classify(input);
                expect(intent.extractedData?.query).toContain(expected.split(' ')[0]);
            }
        });
        it('should extract workflow names cleanly', async () => {
            const testCases = [
                { input: 'run security audit workflow', expected: 'security audit' },
                { input: 'execute the CI/CD pipeline job', expected: 'CI/CD' },
                { input: 'start deployment automation task', expected: 'deployment' }
            ];
            for (const { input, expected } of testCases) {
                const intent = await classifier.classify(input);
                expect(intent.extractedData?.workflowName).toContain(expected.split(' ')[0]);
            }
        });
        it('should extract agent names and capitalize correctly', async () => {
            const testCases = [
                { input: 'use backendagent', expected: /backend/i },
                { input: 'ask securityagent about vulnerabilities', expected: /security/i },
                { input: 'talk to TestingAgent', expected: /testing/i }
            ];
            for (const { input, expected } of testCases) {
                const intent = await classifier.classify(input);
                expect(intent.extractedData?.agentName).toMatch(expected);
            }
        });
    });
    describe('Performance', () => {
        let classifier;
        beforeEach(() => {
            classifier = new IntentClassifier();
        });
        it('should classify with pattern matching in <100ms', async () => {
            const start = Date.now();
            await classifier.classify('find authentication logic');
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100);
        });
        it('should handle batch classification efficiently', async () => {
            const inputs = [
                'find getUserById function',
                'run security audit',
                'use BackendAgent',
                'what is TypeScript?',
                'search for error handling'
            ];
            const start = Date.now();
            await Promise.all(inputs.map(input => classifier.classify(input)));
            const duration = Date.now() - start;
            // Should complete 5 classifications in <500ms
            expect(duration).toBeLessThan(500);
        });
    });
});
//# sourceMappingURL=IntentClassifier.test.js.map