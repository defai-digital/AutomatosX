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
  schema?: string; // Reference to schema name
}

export interface RouteRequestBody {
  contentType: string;
  schema: string; // Schema name or inline schema
  required: boolean;
  example?: any;
}

export interface RouteResponse {
  status: number;
  description: string;
  contentType?: string;
  schema?: string; // Schema name or inline schema
  example?: any;
}

export interface DetectedRoute {
  method: HttpMethod;
  path: string;
  file: string;
  line: number;
  handler: string;

  // Optional metadata
  description?: string;
  summary?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;

  // Parameters
  parameters?: RouteParameter[];
  requestBody?: RouteRequestBody;
  responses?: RouteResponse[];

  // Security & Performance
  middleware?: string[];
  authentication?: {
    type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
    required: boolean;
  };
  rateLimit?: {
    requests: number;
    window: string; // e.g., "1m", "1h"
  };

  // Framework context
  framework?: 'express' | 'nestjs' | 'fastify' | 'nextjs';
  controllerClass?: string; // For NestJS
}

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: any;
  format?: string; // e.g., "email", "uuid", "date-time"
  pattern?: string; // Regex pattern
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
  required?: string[]; // Required property names
  example?: any;

  // For discriminated unions
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
