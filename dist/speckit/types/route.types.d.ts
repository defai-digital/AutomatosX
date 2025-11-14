/**
 * Type definitions for API route detection and OpenAPI generation
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
export interface RouteParameter {
    name: string;
    in: 'query' | 'path' | 'body' | 'header' | 'cookie';
    type: string;
    required: boolean;
    description?: string;
    example?: any;
    schema?: string;
}
export interface RouteRequestBody {
    contentType: string;
    schema: string;
    required: boolean;
    example?: any;
}
export interface RouteResponse {
    status: number;
    description: string;
    contentType?: string;
    schema?: string;
    example?: any;
}
export interface DetectedRoute {
    method: HttpMethod;
    path: string;
    file: string;
    line: number;
    handler: string;
    description?: string;
    summary?: string;
    operationId?: string;
    tags?: string[];
    deprecated?: boolean;
    parameters?: RouteParameter[];
    requestBody?: RouteRequestBody;
    responses?: RouteResponse[];
    middleware?: string[];
    authentication?: {
        type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
        required: boolean;
    };
    rateLimit?: {
        requests: number;
        window: string;
    };
    framework?: 'express' | 'nestjs' | 'fastify' | 'nextjs';
    controllerClass?: string;
}
export interface SchemaProperty {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    example?: any;
    format?: string;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    enum?: any[];
}
export interface DetectedSchema {
    name: string;
    type: 'interface' | 'type' | 'class' | 'zod' | 'joi' | 'yup';
    file: string;
    line: number;
    description?: string;
    properties: SchemaProperty[];
    required?: string[];
    example?: any;
    discriminator?: {
        propertyName: string;
        mapping?: Record<string, string>;
    };
}
export interface DetectionResult {
    routes: DetectedRoute[];
    schemas: DetectedSchema[];
    baseUrl?: string;
    version?: string;
    title?: string;
    description?: string;
}
//# sourceMappingURL=route.types.d.ts.map