/**
 * Design Contract Tests
 *
 * Validates design schemas and contract invariants.
 */
import { describe, it, expect } from 'vitest';
import { DesignTypeSchema, DesignFormatSchema, DesignStatusSchema, DesignArtifactSchema, HttpMethodSchema, ApiEndpointSchema, ComponentDesignRequestSchema, SchemaDesignRequestSchema, ArchitectureDesignRequestSchema, validateApiDesignRequest, safeValidateApiDesignRequest, } from '@defai.digital/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();
describe('Design Contract', () => {
    describe('DesignTypeSchema', () => {
        it('should accept valid design types', () => {
            const types = ['api', 'component', 'schema', 'architecture', 'flow', 'data-model', 'interface', 'other'];
            for (const type of types) {
                const result = DesignTypeSchema.safeParse(type);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('DesignFormatSchema', () => {
        it('should accept valid formats', () => {
            const formats = ['openapi', 'asyncapi', 'graphql', 'json-schema', 'typescript', 'mermaid', 'plantuml', 'markdown', 'other'];
            for (const format of formats) {
                const result = DesignFormatSchema.safeParse(format);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('DesignStatusSchema', () => {
        it('should accept valid statuses', () => {
            const statuses = ['draft', 'review', 'approved', 'implemented', 'deprecated'];
            for (const status of statuses) {
                const result = DesignStatusSchema.safeParse(status);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('HttpMethodSchema', () => {
        it('should accept valid HTTP methods', () => {
            const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
            for (const method of methods) {
                const result = HttpMethodSchema.safeParse(method);
                expect(result.success).toBe(true);
            }
        });
    });
    describe('ApiEndpointSchema', () => {
        it('should validate an API endpoint', () => {
            const endpoint = {
                path: '/api/users',
                method: 'GET',
                summary: 'List all users',
            };
            const result = ApiEndpointSchema.safeParse(endpoint);
            expect(result.success).toBe(true);
        });
    });
    describe('ApiDesignRequestSchema', () => {
        it('should validate API design request', () => {
            const request = {
                name: 'User API',
                description: 'API for user management',
                endpoints: [
                    { path: '/api/users', method: 'GET', summary: 'List users' },
                ],
            };
            const result = validateApiDesignRequest(request);
            expect(result.name).toBe('User API');
        });
        it('should handle safe validation', () => {
            const request = {
                name: 'Test API',
                description: 'Test',
                endpoints: [
                    { path: '/api/test', method: 'GET', summary: 'Test endpoint' },
                ],
            };
            const result = safeValidateApiDesignRequest(request);
            expect(result.success).toBe(true);
        });
    });
    describe('ComponentDesignRequestSchema', () => {
        it('should validate component design request', () => {
            const request = {
                name: 'UserCard',
                type: 'component',
                description: 'Displays user info',
            };
            const result = ComponentDesignRequestSchema.safeParse(request);
            expect(result.success).toBe(true);
        });
    });
    describe('SchemaDesignRequestSchema', () => {
        it('should validate schema design request', () => {
            const request = {
                name: 'User',
                description: 'User entity schema',
                fields: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'name', type: 'string', required: true },
                ],
            };
            const result = SchemaDesignRequestSchema.safeParse(request);
            expect(result.success).toBe(true);
        });
    });
    describe('ArchitectureDesignRequestSchema', () => {
        it('should validate architecture design request', () => {
            const request = {
                name: 'Microservices Architecture',
                description: 'Service-based architecture',
                pattern: 'microservices',
                components: [
                    { id: 'api-gateway', name: 'API Gateway', type: 'service' },
                ],
            };
            const result = ArchitectureDesignRequestSchema.safeParse(request);
            expect(result.success).toBe(true);
        });
    });
    describe('DesignArtifactSchema', () => {
        it('should validate design artifact', () => {
            const artifact = {
                designId: uuid(),
                type: 'api',
                name: 'Test Design',
                format: 'typescript',
                content: 'interface Test {}',
                status: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const result = DesignArtifactSchema.safeParse(artifact);
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=design.test.js.map