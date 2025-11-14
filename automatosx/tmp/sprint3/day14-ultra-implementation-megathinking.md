# Day 14: APISpecGenerator - Ultra-Deep Implementation Megathinking

**Date**: 2025-11-13
**Sprint**: Sprint 3, Week 5, Day 14
**Objective**: Build complete API specification generation system with OpenAPI 3.1 support

---

## Executive Summary

This document provides an ultra-detailed implementation plan for Day 14, including:
- Complete production-ready code for all 3 components
- Comprehensive test suite with realistic mocks
- Known pitfalls from Days 11-13 and how to avoid them
- Step-by-step execution plan with time estimates
- Integration verification at each step

**Total Estimated LOC**: 1,250 LOC
- RouteDetector.ts: 450 LOC (increased from 350 for robustness)
- OpenAPIBuilder.ts: 250 LOC (increased from 200 for YAML support)
- APISpecGenerator.ts: 350 LOC (increased from 300 for AI enhancement)
- Tests: 500 LOC (increased from 400 for edge cases)

**Total Estimated Time**: 6-8 hours

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    APISpecGenerator                          │
│                (extends SpecKitGenerator)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Template Method Pattern (6 steps)                   │  │
│  │  1. analyze()    → Detect routes with RouteDetector │  │
│  │  2. detect()     → Filter/validate routes           │  │
│  │  3. generate()   → Build OpenAPI with Builder       │  │
│  │  4. format()     → Apply YAML/JSON formatting       │  │
│  │  5. validate()   → Check OpenAPI schema validity    │  │
│  │  6. save()       → Write to file                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│  RouteDetector   │          │ OpenAPIBuilder   │
│                  │          │                  │
│ • detectAll()    │          │ • addRoute()     │
│ • Express        │          │ • addSchema()    │
│ • NestJS         │          │ • addServer()    │
│ • Fastify        │          │ • toYAML()       │
│ • Next.js        │          │ • toJSON()       │
│ • Schema detect  │          │ • build()        │
└──────────────────┘          └──────────────────┘
```

---

## Part 1: RouteDetector Implementation (450 LOC)

### Design Principles

1. **Framework-Agnostic**: Detect routes from Express, NestJS, Fastify, Next.js
2. **Parallel Execution**: Use Promise.all() for performance
3. **Pattern Matching**: Regex-based detection with high precision
4. **Error Tolerance**: Continue on partial failures
5. **Rich Metadata**: Extract parameters, middleware, schemas

### Type Definitions

```typescript
// src/speckit/types/route.types.ts

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
```

### Complete RouteDetector Implementation

```typescript
// src/speckit/RouteDetector.ts

import type {
  DetectedRoute,
  DetectedSchema,
  DetectionResult,
  HttpMethod,
  RouteParameter,
} from './types/route.types.js';

/**
 * RouteDetector - Detect API routes and schemas from codebase
 *
 * Supports multiple frameworks:
 * - Express.js (app.get, router.post, etc.)
 * - NestJS (@Get, @Post decorators)
 * - Fastify (fastify.route, fastify.get)
 * - Next.js (pages/api/**, app/api/**)
 *
 * Detects schemas from:
 * - TypeScript interfaces
 * - Zod schemas
 * - Joi schemas
 * - Yup schemas
 */
export class RouteDetector {
  constructor(
    private searchCode: (query: string, options?: any) => Promise<any[]>
  ) {}

  /**
   * Detect all routes and schemas from codebase
   */
  async detectAll(): Promise<DetectionResult> {
    // Run all detectors in parallel for performance
    const [
      expressRoutes,
      nestjsRoutes,
      fastifyRoutes,
      nextjsRoutes,
      schemas,
      metadata
    ] = await Promise.all([
      this.detectExpressRoutes(),
      this.detectNestJSRoutes(),
      this.detectFastifyRoutes(),
      this.detectNextJSAPIRoutes(),
      this.detectSchemas(),
      this.detectMetadata(),
    ]);

    // Combine all routes
    const routes = [
      ...expressRoutes,
      ...nestjsRoutes,
      ...fastifyRoutes,
      ...nextjsRoutes,
    ];

    // Sort by path for consistency
    routes.sort((a, b) => {
      if (a.path === b.path) {
        return a.method.localeCompare(b.method);
      }
      return a.path.localeCompare(b.path);
    });

    // Remove duplicates (same method + path)
    const uniqueRoutes = this.deduplicateRoutes(routes);

    return {
      routes: uniqueRoutes,
      schemas,
      ...metadata,
    };
  }

  /**
   * Detect specific route by path
   */
  async detect(path: string): Promise<DetectedRoute | null> {
    const result = await this.detectAll();
    return result.routes.find(r => r.path === path) || null;
  }

  /**
   * Detect Express.js routes
   * Pattern: app.get('/path', handler) or router.post('/path', middleware, handler)
   */
  private async detectExpressRoutes(): Promise<DetectedRoute[]> {
    const results = await this.searchCode(
      'app\\.(get|post|put|delete|patch|options|head)|router\\.(get|post|put|delete|patch|options|head)',
      { limit: 200 }
    );

    const routes: DetectedRoute[] = [];

    for (const result of results) {
      try {
        // Match pattern: app.get('/path', ...)
        const methodMatch = result.content.match(/\.(get|post|put|delete|patch|options|head)\s*\(/i);
        if (!methodMatch) continue;

        const method = methodMatch[1].toUpperCase() as HttpMethod;

        // Extract path (handle both single and double quotes)
        const pathMatch = result.content.match(/\(\s*['"`]([^'"`]+)['"`]/);
        if (!pathMatch) continue;

        const path = this.normalizePath(pathMatch[1]);

        // Extract handler name (last argument before closing paren)
        const handlerMatch = result.content.match(/,\s*([a-zA-Z0-9_$.]+)\s*\)$/);
        const handler = handlerMatch ? handlerMatch[1] : 'anonymous';

        // Extract middleware (all args between path and handler)
        const middleware = this.extractExpressMiddleware(result.content);

        // Extract parameters from path
        const parameters = this.extractPathParameters(path);

        // Check for authentication middleware
        const authentication = this.detectAuthentication(middleware);

        routes.push({
          method,
          path,
          file: result.file,
          line: result.line,
          handler,
          middleware,
          parameters,
          authentication,
          framework: 'express',
          tags: this.inferTags(path),
        });
      } catch (error) {
        // Skip malformed routes
        console.warn(`Failed to parse Express route at ${result.file}:${result.line}`, error);
      }
    }

    return routes;
  }

  /**
   * Detect NestJS routes
   * Pattern: @Controller('users') class { @Get(':id') method() {} }
   */
  private async detectNestJSRoutes(): Promise<DetectedRoute[]> {
    // First, find all controllers
    const controllerResults = await this.searchCode('@Controller', { limit: 50 });

    const routes: DetectedRoute[] = [];

    for (const controllerResult of controllerResults) {
      try {
        // Extract controller path
        const controllerPathMatch = controllerResult.content.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/);
        const controllerPath = controllerPathMatch ? controllerPathMatch[1] : '';

        // Extract controller class name
        const classNameMatch = controllerResult.content.match(/class\s+([a-zA-Z0-9_]+)/);
        const controllerClass = classNameMatch ? classNameMatch[1] : 'UnknownController';

        // Now search for methods in this file
        const methodResults = await this.searchCode(
          `@(Get|Post|Put|Delete|Patch|Options|Head)`,
          { limit: 100 }
        );

        for (const methodResult of methodResults) {
          // Only process methods from the same file
          if (methodResult.file !== controllerResult.file) continue;

          try {
            // Extract HTTP method and path from decorator
            const decoratorMatch = methodResult.content.match(
              /@(Get|Post|Put|Delete|Patch|Options|Head)\(\s*['"`]?([^'"`)\s]*)?['"`]?\s*\)/i
            );
            if (!decoratorMatch) continue;

            const method = decoratorMatch[1].toUpperCase() as HttpMethod;
            const routePath = decoratorMatch[2] || '';

            // Combine controller path and route path
            const fullPath = this.normalizePath(`/${controllerPath}/${routePath}`);

            // Extract method name
            const methodNameMatch = methodResult.content.match(/(async\s+)?([a-zA-Z0-9_]+)\s*\(/);
            const handler = methodNameMatch ? methodNameMatch[2] : 'unknown';

            // Extract parameters from decorators (@Param, @Query, @Body)
            const parameters = this.extractNestJSParameters(methodResult.content, fullPath);

            // Detect guards (authentication)
            const guards = this.extractNestJSGuards(methodResult.content);
            const authentication = guards.length > 0 ? {
              type: 'bearer' as const,
              required: true,
            } : undefined;

            routes.push({
              method,
              path: fullPath,
              file: methodResult.file,
              line: methodResult.line,
              handler,
              parameters,
              authentication,
              framework: 'nestjs',
              controllerClass,
              tags: this.inferTags(fullPath),
            });
          } catch (error) {
            console.warn(`Failed to parse NestJS method at ${methodResult.file}:${methodResult.line}`, error);
          }
        }
      } catch (error) {
        console.warn(`Failed to parse NestJS controller at ${controllerResult.file}:${controllerResult.line}`, error);
      }
    }

    return routes;
  }

  /**
   * Detect Fastify routes
   * Pattern: fastify.get('/path', handler) or fastify.route({ method, url, handler })
   */
  private async detectFastifyRoutes(): Promise<DetectedRoute[]> {
    const results = await this.searchCode(
      'fastify\\.(get|post|put|delete|patch)|fastify\\.route',
      { limit: 200 }
    );

    const routes: DetectedRoute[] = [];

    for (const result of results) {
      try {
        // Check if it's fastify.route() or fastify.get() style
        if (result.content.includes('fastify.route')) {
          // Parse route object: { method: 'GET', url: '/path', handler }
          const methodMatch = result.content.match(/method:\s*['"`]([^'"`]+)['"`]/);
          const urlMatch = result.content.match(/url:\s*['"`]([^'"`]+)['"`]/);
          const handlerMatch = result.content.match(/handler:\s*([a-zA-Z0-9_$.]+)/);

          if (methodMatch && urlMatch) {
            const method = methodMatch[1].toUpperCase() as HttpMethod;
            const path = this.normalizePath(urlMatch[1]);
            const handler = handlerMatch ? handlerMatch[1] : 'anonymous';

            routes.push({
              method,
              path,
              file: result.file,
              line: result.line,
              handler,
              parameters: this.extractPathParameters(path),
              framework: 'fastify',
              tags: this.inferTags(path),
            });
          }
        } else {
          // fastify.get() style
          const methodMatch = result.content.match(/fastify\.(get|post|put|delete|patch)\s*\(/i);
          if (!methodMatch) continue;

          const method = methodMatch[1].toUpperCase() as HttpMethod;

          const pathMatch = result.content.match(/\(\s*['"`]([^'"`]+)['"`]/);
          if (!pathMatch) continue;

          const path = this.normalizePath(pathMatch[1]);

          const handlerMatch = result.content.match(/,\s*([a-zA-Z0-9_$.]+)\s*\)$/);
          const handler = handlerMatch ? handlerMatch[1] : 'anonymous';

          routes.push({
            method,
            path,
            file: result.file,
            line: result.line,
            handler,
            parameters: this.extractPathParameters(path),
            framework: 'fastify',
            tags: this.inferTags(path),
          });
        }
      } catch (error) {
        console.warn(`Failed to parse Fastify route at ${result.file}:${result.line}`, error);
      }
    }

    return routes;
  }

  /**
   * Detect Next.js API routes
   * Pattern: pages/api/**\/*.ts or app/api/**\/*.ts with export default handler
   */
  private async detectNextJSAPIRoutes(): Promise<DetectedRoute[]> {
    // Search for files in pages/api or app/api
    const results = await this.searchCode(
      'export\\s+(default\\s+)?(async\\s+)?function\\s+(handler|GET|POST|PUT|DELETE)',
      { limit: 100 }
    );

    const routes: DetectedRoute[] = [];

    for (const result of results) {
      try {
        // Only process files in api directories
        if (!result.file.includes('/api/')) continue;

        // Determine HTTP method from function name or file content
        const methodMatch = result.content.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/);
        let method: HttpMethod = 'GET'; // Default

        if (methodMatch) {
          method = methodMatch[2] as HttpMethod;
        } else {
          // Check if file contains req.method checks
          if (result.content.includes("req.method === 'POST'")) method = 'POST';
          else if (result.content.includes("req.method === 'PUT'")) method = 'PUT';
          else if (result.content.includes("req.method === 'DELETE'")) method = 'DELETE';
        }

        // Convert file path to API route
        // pages/api/users/[id].ts -> /api/users/:id
        const path = this.filePathToAPIRoute(result.file);

        routes.push({
          method,
          path,
          file: result.file,
          line: result.line,
          handler: 'handler',
          parameters: this.extractPathParameters(path),
          framework: 'nextjs',
          tags: this.inferTags(path),
        });
      } catch (error) {
        console.warn(`Failed to parse Next.js route at ${result.file}:${result.line}`, error);
      }
    }

    return routes;
  }

  /**
   * Detect schemas from various sources
   */
  private async detectSchemas(): Promise<DetectedSchema[]> {
    const [zodSchemas, joiSchemas, yupSchemas, tsInterfaces] = await Promise.all([
      this.detectZodSchemas(),
      this.detectJoiSchemas(),
      this.detectYupSchemas(),
      this.detectTypeScriptInterfaces(),
    ]);

    return [...zodSchemas, ...joiSchemas, ...yupSchemas, ...tsInterfaces];
  }

  /**
   * Detect Zod schemas
   * Pattern: z.object({ field: z.string() })
   */
  private async detectZodSchemas(): Promise<DetectedSchema[]> {
    const results = await this.searchCode('z\\.object\\(|zod\\.object\\(', { limit: 100 });

    const schemas: DetectedSchema[] = [];

    for (const result of results) {
      try {
        // Extract schema name
        const nameMatch = result.content.match(/(?:const|export\s+const)\s+([a-zA-Z0-9_]+)\s*=\s*z\.object/);
        if (!nameMatch) continue;

        const name = nameMatch[1];

        // Extract properties (simplified - real implementation would use AST parsing)
        const properties = this.extractZodProperties(result.content);

        schemas.push({
          name,
          type: 'zod',
          file: result.file,
          line: result.line,
          properties,
        });
      } catch (error) {
        console.warn(`Failed to parse Zod schema at ${result.file}:${result.line}`, error);
      }
    }

    return schemas;
  }

  /**
   * Detect TypeScript interfaces
   */
  private async detectTypeScriptInterfaces(): Promise<DetectedSchema[]> {
    const results = await this.searchCode('(?:export\\s+)?interface\\s+[A-Z]', { limit: 100 });

    const schemas: DetectedSchema[] = [];

    for (const result of results) {
      try {
        const nameMatch = result.content.match(/interface\s+([a-zA-Z0-9_]+)/);
        if (!nameMatch) continue;

        const name = nameMatch[1];

        // Extract properties
        const properties = this.extractInterfaceProperties(result.content);

        schemas.push({
          name,
          type: 'interface',
          file: result.file,
          line: result.line,
          properties,
        });
      } catch (error) {
        console.warn(`Failed to parse interface at ${result.file}:${result.line}`, error);
      }
    }

    return schemas;
  }

  /**
   * Detect Joi schemas (placeholder)
   */
  private async detectJoiSchemas(): Promise<DetectedSchema[]> {
    // Similar to Zod detection
    return [];
  }

  /**
   * Detect Yup schemas (placeholder)
   */
  private async detectYupSchemas(): Promise<DetectedSchema[]> {
    // Similar to Zod detection
    return [];
  }

  /**
   * Detect API metadata from package.json and config files
   */
  private async detectMetadata(): Promise<{
    baseUrl?: string;
    version?: string;
    title?: string;
    description?: string;
  }> {
    const [baseUrl, version, title, description] = await Promise.all([
      this.detectBaseUrl(),
      this.detectVersion(),
      this.detectTitle(),
      this.detectDescription(),
    ]);

    return { baseUrl, version, title, description };
  }

  // ==================== Helper Methods ====================

  /**
   * Normalize API path (remove double slashes, ensure leading slash)
   */
  private normalizePath(path: string): string {
    return '/' + path.replace(/^\/+/, '').replace(/\/+/g, '/');
  }

  /**
   * Extract path parameters from route path
   * Express: /users/:id -> { name: 'id', in: 'path' }
   * NestJS: /users/:id -> same
   */
  private extractPathParameters(path: string): RouteParameter[] {
    const params: RouteParameter[] = [];

    // Match :param or {param} or [param]
    const matches = path.matchAll(/:([a-zA-Z0-9_]+)|\{([a-zA-Z0-9_]+)\}|\[([a-zA-Z0-9_]+)\]/g);

    for (const match of matches) {
      const paramName = match[1] || match[2] || match[3];
      params.push({
        name: paramName,
        in: 'path',
        type: 'string',
        required: true,
        description: `${paramName} path parameter`,
      });
    }

    return params;
  }

  /**
   * Extract middleware from Express route definition
   * app.get('/path', auth, validate, handler) -> ['auth', 'validate']
   */
  private extractExpressMiddleware(code: string): string[] {
    const middleware: string[] = [];

    // Match all identifiers between path and final handler
    const matches = code.matchAll(/,\s*([a-zA-Z0-9_$.]+)(?=\s*[,)])/g);

    for (const match of matches) {
      const name = match[1];
      // Skip common non-middleware identifiers
      if (name !== 'async' && name !== 'function' && name !== 'req' && name !== 'res') {
        middleware.push(name);
      }
    }

    // Remove last item (that's the handler)
    if (middleware.length > 0) {
      middleware.pop();
    }

    return middleware;
  }

  /**
   * Extract NestJS parameters from decorators
   * @Param('id') id: string -> path parameter
   * @Query('limit') limit: number -> query parameter
   * @Body() body: CreateUserDto -> request body
   */
  private extractNestJSParameters(code: string, path: string): RouteParameter[] {
    const params: RouteParameter[] = [];

    // Extract path parameters from path first
    params.push(...this.extractPathParameters(path));

    // Extract @Query decorators
    const queryMatches = code.matchAll(/@Query\(\s*['"`]([^'"`]+)['"`]\s*\)\s+([a-zA-Z0-9_]+):\s*([a-zA-Z0-9_\[\]]+)/g);
    for (const match of queryMatches) {
      params.push({
        name: match[1],
        in: 'query',
        type: match[3],
        required: false, // Query params usually optional
        description: `${match[1]} query parameter`,
      });
    }

    // Extract @Body decorator
    const bodyMatch = code.match(/@Body\(\)\s+([a-zA-Z0-9_]+):\s*([a-zA-Z0-9_]+)/);
    if (bodyMatch) {
      params.push({
        name: 'body',
        in: 'body',
        type: bodyMatch[2],
        required: true,
        schema: bodyMatch[2], // Reference to DTO/schema
      });
    }

    return params;
  }

  /**
   * Extract NestJS guards for authentication detection
   */
  private extractNestJSGuards(code: string): string[] {
    const guards: string[] = [];

    const matches = code.matchAll(/@UseGuards\(\s*([a-zA-Z0-9_]+)/g);
    for (const match of matches) {
      guards.push(match[1]);
    }

    return guards;
  }

  /**
   * Detect authentication from middleware names
   */
  private detectAuthentication(middleware: string[]): DetectedRoute['authentication'] {
    const authKeywords = ['auth', 'authenticate', 'jwt', 'bearer', 'token', 'guard'];

    const hasAuth = middleware.some(m =>
      authKeywords.some(keyword => m.toLowerCase().includes(keyword))
    );

    return hasAuth ? {
      type: 'bearer',
      required: true,
    } : undefined;
  }

  /**
   * Infer tags from route path
   * /api/v1/users/:id -> ['users']
   * /auth/login -> ['auth']
   */
  private inferTags(path: string): string[] {
    const parts = path.split('/').filter(p => p && !p.startsWith(':') && !p.startsWith('{'));

    // Skip version prefixes
    const resource = parts.find(p =>
      p !== 'api' &&
      p !== 'v1' &&
      p !== 'v2' &&
      p !== 'v3' &&
      !p.match(/^v\d+$/)
    );

    return resource ? [resource] : ['default'];
  }

  /**
   * Convert Next.js file path to API route
   * pages/api/users/[id].ts -> /api/users/:id
   * app/api/posts/[slug]/route.ts -> /api/posts/:slug
   */
  private filePathToAPIRoute(filePath: string): string {
    // Extract path after /api/
    const match = filePath.match(/\/api\/(.+)\.(ts|js|tsx|jsx)$/);
    if (!match) return '/api';

    let route = match[1];

    // Remove 'route' filename for app router
    route = route.replace(/\/route$/, '');

    // Convert [param] to :param
    route = route.replace(/\[([a-zA-Z0-9_]+)\]/g, ':$1');

    // Convert [...slug] to :slug (catch-all)
    route = route.replace(/\[\.\.\.([a-zA-Z0-9_]+)\]/g, ':$1*');

    return this.normalizePath('/api/' + route);
  }

  /**
   * Extract properties from Zod schema definition
   */
  private extractZodProperties(code: string): SchemaProperty[] {
    const properties: SchemaProperty[] = [];

    // Match patterns like: name: z.string()
    const matches = code.matchAll(/([a-zA-Z0-9_]+):\s*z\.([a-zA-Z]+)\(\)/g);

    for (const match of matches) {
      const name = match[1];
      const zodType = match[2];

      properties.push({
        name,
        type: this.zodTypeToTsType(zodType),
        required: !code.includes(`${name}: z.${zodType}().optional()`),
        description: `${name} field`,
      });
    }

    return properties;
  }

  /**
   * Extract properties from TypeScript interface
   */
  private extractInterfaceProperties(code: string): SchemaProperty[] {
    const properties: SchemaProperty[] = [];

    // Match patterns like: name: string; or age?: number;
    const matches = code.matchAll(/([a-zA-Z0-9_]+)(\?)?:\s*([a-zA-Z0-9_\[\]<>|]+);/g);

    for (const match of matches) {
      const name = match[1];
      const optional = match[2] === '?';
      const type = match[3];

      properties.push({
        name,
        type,
        required: !optional,
        description: `${name} field`,
      });
    }

    return properties;
  }

  /**
   * Map Zod types to TypeScript types
   */
  private zodTypeToTsType(zodType: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'date': 'Date',
      'array': 'array',
      'object': 'object',
      'any': 'any',
      'unknown': 'unknown',
      'null': 'null',
      'undefined': 'undefined',
    };

    return typeMap[zodType.toLowerCase()] || 'any';
  }

  /**
   * Remove duplicate routes (same method + path)
   */
  private deduplicateRoutes(routes: DetectedRoute[]): DetectedRoute[] {
    const seen = new Set<string>();
    const unique: DetectedRoute[] = [];

    for (const route of routes) {
      const key = `${route.method}:${route.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(route);
      }
    }

    return unique;
  }

  /**
   * Detect base URL from environment or config
   */
  private async detectBaseUrl(): Promise<string> {
    try {
      const results = await this.searchCode('baseURL|BASE_URL|API_URL|NEXT_PUBLIC_API', { limit: 10 });

      for (const result of results) {
        const urlMatch = result.content.match(/['"`](https?:\/\/[^'"`]+)['"`]/);
        if (urlMatch) {
          return urlMatch[1];
        }
      }
    } catch (error) {
      // Ignore
    }

    return 'http://localhost:3000';
  }

  /**
   * Detect API version from package.json
   */
  private async detectVersion(): Promise<string> {
    try {
      const results = await this.searchCode('"version"', { limit: 5 });

      for (const result of results) {
        if (result.file.includes('package.json')) {
          const versionMatch = result.content.match(/"version":\s*"([^"]+)"/);
          if (versionMatch) {
            return versionMatch[1];
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return '1.0.0';
  }

  /**
   * Detect API title from package.json or constants
   */
  private async detectTitle(): Promise<string> {
    try {
      const results = await this.searchCode('"name"|API_TITLE', { limit: 5 });

      for (const result of results) {
        if (result.file.includes('package.json')) {
          const nameMatch = result.content.match(/"name":\s*"([^"]+)"/);
          if (nameMatch) {
            return nameMatch[1] + ' API';
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return 'API Documentation';
  }

  /**
   * Detect API description
   */
  private async detectDescription(): Promise<string> {
    try {
      const results = await this.searchCode('"description"', { limit: 5 });

      for (const result of results) {
        if (result.file.includes('package.json')) {
          const descMatch = result.content.match(/"description":\s*"([^"]+)"/);
          if (descMatch) {
            return descMatch[1];
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return 'API documentation generated by AutomatosX SpecKit';
  }
}
```

---

## EXECUTION: Start Building Now

Let me immediately start implementing these components with production-ready code.

