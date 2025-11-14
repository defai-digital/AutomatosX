/**
 * APIAgent.ts
 * API design and documentation specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class APIAgent extends AgentBase {
    constructor() {
        super({
            type: 'api',
            name: 'API Specialist (Alex)',
            description: 'Expert in API design, REST, GraphQL, API documentation, and versioning. Specializes in building robust, well-documented APIs.',
            capabilities: [
                { name: 'REST API Design', description: 'Design RESTful APIs', keywords: ['rest', 'restful', 'http', 'endpoint', 'resource'] },
                { name: 'GraphQL Design', description: 'Design GraphQL schemas and resolvers', keywords: ['graphql', 'schema', 'resolver', 'query', 'mutation'] },
                { name: 'API Documentation', description: 'Create OpenAPI/Swagger docs', keywords: ['documentation', 'openapi', 'swagger', 'api docs'] },
                { name: 'API Versioning', description: 'Implement API versioning strategies', keywords: ['versioning', 'version', 'v1', 'v2', 'deprecation'] },
                { name: 'API Security', description: 'Secure APIs with auth and rate limiting', keywords: ['security', 'authentication', 'rate limit', 'api key'] },
            ],
            specializations: ['REST', 'GraphQL', 'OpenAPI', 'Swagger', 'API Gateway', 'Rate Limiting', 'API Versioning', 'WebSockets', 'gRPC'],
            temperature: 0.7,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside API specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `API agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('api endpoint route controller');
            const pastSolutions = await context.memory.search('api design rest graphql');
            const prompt = this.buildAPIPrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parseAPIArtifacts(response);
            await context.memory.store({ type: 'api_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'api-design' } };
        }
        catch (error) {
            context.monitoring.log('error', `API agent failed: ${error}`);
            throw error;
        }
    }
    buildAPIPrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide complete API solution with:\n1. API design (REST/GraphQL endpoints/schema)\n2. Request/response formats with examples\n3. OpenAPI/Swagger documentation\n4. Authentication and authorization\n5. Error handling and status codes\n6. Versioning strategy\n7. Rate limiting and pagination';
        return prompt;
    }
    parseAPIArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'api-code';
            if (language === 'yaml' || language === 'json') {
                if (content.includes('openapi') || content.includes('swagger'))
                    name = 'openapi-spec';
                else if (content.includes('paths:') || content.includes('endpoints'))
                    name = 'api-spec';
            }
            else if (language === 'graphql' || content.includes('type Query') || content.includes('type Mutation')) {
                name = 'graphql-schema';
            }
            artifacts.push({ type: 'code', name, content, metadata: { language, category: 'api' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nAPI Design Context:\n- Follow RESTful principles or GraphQL best practices\n- Use proper HTTP methods and status codes\n- Design for backwards compatibility\n- Include comprehensive error handling\n- Document with OpenAPI/Swagger\n- Implement authentication and rate limiting\n- Consider API versioning from the start';
    }
}
//# sourceMappingURL=APIAgent.js.map