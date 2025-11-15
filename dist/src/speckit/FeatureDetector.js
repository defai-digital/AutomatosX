/**
 * FeatureDetector - Detect product features and capabilities from codebase
 *
 * Detection Strategy:
 * 1. Search for feature-specific keywords
 * 2. Analyze file structure and naming patterns
 * 3. Extract API endpoints, components, data models
 * 4. Infer user stories and acceptance criteria
 * 5. Calculate confidence score based on evidence strength
 */
export class FeatureDetector {
    searchCode;
    constructor(searchCode) {
        this.searchCode = searchCode;
    }
    /**
     * Detect all features in codebase
     */
    async detectAll() {
        const features = [];
        // Run all detectors in parallel for speed
        const [auth, api, ui, data, integration, security,] = await Promise.all([
            this.detectAuthFeatures(),
            this.detectAPIFeatures(),
            this.detectUIFeatures(),
            this.detectDataFeatures(),
            this.detectIntegrationFeatures(),
            this.detectSecurityFeatures(),
        ]);
        features.push(...auth, ...api, ...ui, ...data, ...integration, ...security);
        // Filter by confidence threshold
        return features.filter(f => f.confidence > 0.5);
    }
    /**
     * Detect specific feature by name
     */
    async detect(featureName) {
        const normalized = featureName.toLowerCase().replace(/\s+/g, '');
        const methodMap = {
            auth: () => this.detectAuthFeatures(),
            authentication: () => this.detectAuthFeatures(),
            api: () => this.detectAPIFeatures(),
            ui: () => this.detectUIFeatures(),
            data: () => this.detectDataFeatures(),
            integration: () => this.detectIntegrationFeatures(),
            security: () => this.detectSecurityFeatures(),
        };
        const method = methodMap[normalized];
        if (!method)
            return null;
        const results = await method();
        return results.length > 0 ? results[0] : null;
    }
    /**
     * Detect authentication/authorization features
     */
    async detectAuthFeatures() {
        const results = await this.searchCode('auth|login|signup|password|token|session|jwt');
        const authFiles = results.filter(r => {
            const content = r.content?.toLowerCase() || '';
            return (content.includes('login') ||
                content.includes('signup') ||
                content.includes('register') ||
                content.includes('password') ||
                content.includes('token') ||
                content.includes('session') ||
                content.includes('authenticate'));
        });
        if (authFiles.length === 0)
            return [];
        // Extract endpoints
        const endpoints = this.extractEndpoints(authFiles, [
            'login',
            'logout',
            'signup',
            'register',
            'reset-password',
        ]);
        // Extract dependencies
        const dependencies = this.extractDependencies(authFiles, [
            'jwt',
            'bcrypt',
            'passport',
            'jsonwebtoken',
            'next-auth',
        ]);
        // Calculate confidence
        const confidence = Math.min((authFiles.length / 10) * 0.6 + (endpoints.length / 5) * 0.4, 1);
        return [
            {
                name: 'User Authentication',
                type: 'core',
                category: 'auth',
                files: [...new Set(authFiles.map(f => f.file))],
                endpoints,
                dependencies,
                description: 'User registration, login, logout, and session management',
                userStories: [
                    'As a new user, I want to create an account so that I can access the platform',
                    'As a registered user, I want to log in with my credentials',
                    'As a user, I want to reset my password if I forget it',
                    'As a user, I want to log out securely',
                ],
                acceptance: [
                    'Users can register with email and password',
                    'Passwords are hashed securely',
                    'JWT tokens are issued upon successful login',
                    'Invalid credentials show appropriate error',
                    'Session management with secure cookies',
                ],
                confidence,
                priority: 'P0',
                complexity: 'high',
            },
        ];
    }
    /**
     * Detect API/REST endpoints
     */
    async detectAPIFeatures() {
        const results = await this.searchCode('router\\.|@Get\\(|@Post\\(|api/');
        const endpointFiles = results.filter(r => {
            const content = r.content || '';
            return (content.includes('router.') ||
                content.includes('@Get') ||
                content.includes('@Post') ||
                content.includes('app.get') ||
                content.includes('app.post'));
        });
        if (endpointFiles.length < 3)
            return [];
        // Extract all endpoints
        const endpoints = this.extractEndpoints(endpointFiles, []);
        const grouped = this.groupEndpointsByResource(endpoints);
        // Create feature for each resource
        return Object.entries(grouped).map(([resource, eps]) => {
            const resourceFiles = [...new Set(eps.map(e => e.file))];
            const confidence = Math.min(eps.length / 5, 1);
            return {
                name: `${this.capitalize(resource)} API`,
                type: 'core',
                category: 'api',
                files: resourceFiles,
                endpoints: eps,
                dependencies: this.extractDependencies(endpointFiles.filter(f => resourceFiles.includes(f.file)), ['express', 'fastify', '@nestjs/common']),
                description: `RESTful API endpoints for ${resource} management`,
                userStories: [
                    `As a client application, I want to retrieve ${resource} data`,
                    `As a client application, I want to create new ${resource}`,
                    `As a client application, I want to update existing ${resource}`,
                ],
                acceptance: [
                    `GET /${resource} returns list of ${resource}`,
                    `POST /${resource} creates new ${resource}`,
                    `PUT /${resource}/:id updates ${resource}`,
                    'Proper HTTP status codes (200, 201, 400, 404, 500)',
                    'Input validation on all endpoints',
                ],
                confidence,
                priority: 'P0',
                complexity: 'medium',
            };
        });
    }
    /**
     * Detect UI components and pages
     */
    async detectUIFeatures() {
        const results = await this.searchCode('component|page|export default|function');
        const uiFiles = results.filter(r => (r.file.includes('component') || r.file.includes('page')) &&
            (r.content?.includes('export default') || r.content?.includes('export function')));
        if (uiFiles.length < 5)
            return [];
        const components = this.extractComponents(uiFiles, []);
        const grouped = this.groupComponentsByFeature(components);
        return grouped.map(feature => ({
            name: feature.name,
            type: 'core',
            category: 'ui',
            files: feature.files,
            components: feature.components,
            dependencies: ['react', 'next'],
            description: feature.description,
            userStories: feature.userStories,
            acceptance: feature.acceptance,
            confidence: feature.confidence,
            priority: feature.priority,
            complexity: feature.complexity,
        }));
    }
    /**
     * Detect data models and schemas
     */
    async detectDataFeatures() {
        const results = await this.searchCode('schema|model|interface');
        const dataFiles = results.filter(r => {
            const content = r.content || '';
            return (content.includes('schema') ||
                content.includes('model') ||
                content.includes('interface'));
        });
        if (dataFiles.length < 3)
            return [];
        return [
            {
                name: 'Data Management',
                type: 'core',
                category: 'data',
                files: [...new Set(dataFiles.map(f => f.file))],
                dependencies: this.extractDependencies(dataFiles, ['mongoose', 'sequelize', 'prisma']),
                description: 'Data models and schemas',
                userStories: [
                    'As the system, I want to persist data',
                    'As the system, I want to validate data before storage',
                ],
                acceptance: [
                    'Data models are properly typed',
                    'Required fields are enforced',
                    'Data validation rules are implemented',
                ],
                confidence: Math.min(dataFiles.length / 5, 1),
                priority: 'P0',
                complexity: 'medium',
            },
        ];
    }
    /**
     * Detect third-party integrations
     */
    async detectIntegrationFeatures() {
        const integrations = [
            { name: 'Stripe', keywords: ['stripe', 'payment'], category: 'payment' },
            { name: 'SendGrid', keywords: ['sendgrid', 'email'], category: 'notification' },
            { name: 'AWS S3', keywords: ['s3', 'aws-sdk'], category: 'integration' },
        ];
        const features = [];
        for (const integration of integrations) {
            const results = await this.searchCode(integration.keywords.join('|'));
            const files = results.filter(r => integration.keywords.some(k => r.content?.toLowerCase().includes(k.toLowerCase())));
            if (files.length > 0) {
                features.push({
                    name: `${integration.name} Integration`,
                    type: 'integration',
                    category: integration.category,
                    files: [...new Set(files.map(f => f.file))],
                    dependencies: integration.keywords,
                    description: `Integration with ${integration.name} service`,
                    userStories: [
                        `As the system, I want to integrate with ${integration.name}`,
                    ],
                    acceptance: [
                        'API credentials are securely stored',
                        'API calls have proper error handling',
                        'Rate limiting is respected',
                    ],
                    confidence: Math.min(files.length / 5, 1),
                    priority: 'P1',
                    complexity: 'medium',
                });
            }
        }
        return features;
    }
    /**
     * Detect security features
     */
    async detectSecurityFeatures() {
        const results = await this.searchCode('csrf|xss|cors|helmet|sanitize');
        const securityFiles = results.filter(r => {
            const content = r.content?.toLowerCase() || '';
            return (content.includes('csrf') ||
                content.includes('cors') ||
                content.includes('helmet'));
        });
        if (securityFiles.length === 0)
            return [];
        return [
            {
                name: 'Security Features',
                type: 'core',
                category: 'security',
                files: [...new Set(securityFiles.map(f => f.file))],
                dependencies: ['helmet', 'cors'],
                description: 'Security features (CSRF, CORS, XSS protection)',
                userStories: [
                    'As the system, I want to prevent CSRF attacks',
                    'As the system, I want to prevent XSS attacks',
                ],
                acceptance: [
                    'CSRF tokens are validated',
                    'CORS is properly configured',
                    'Security headers are set',
                ],
                confidence: 0.8,
                priority: 'P0',
                complexity: 'low',
            },
        ];
    }
    // ============================================================
    // HELPER METHODS
    // ============================================================
    /**
     * Extract API endpoints from search results
     */
    extractEndpoints(results, keywords) {
        const endpoints = [];
        for (const result of results) {
            const content = result.content || '';
            // Express-style routes
            const expressMatches = content.matchAll(/router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi);
            for (const match of expressMatches) {
                endpoints.push({
                    method: match[1].toUpperCase(),
                    path: match[2],
                    file: result.file,
                    line: result.line || 0,
                });
            }
            // NestJS decorators
            const nestMatches = content.matchAll(/@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]?([^'")\s]*)/gi);
            for (const match of nestMatches) {
                endpoints.push({
                    method: match[1].toUpperCase(),
                    path: match[2] || '/',
                    file: result.file,
                    line: result.line || 0,
                });
            }
        }
        // Filter by keywords if provided
        if (keywords.length > 0) {
            return endpoints.filter(ep => keywords.some(k => ep.path.toLowerCase().includes(k.toLowerCase())));
        }
        return endpoints;
    }
    /**
     * Extract React/Vue components
     */
    extractComponents(results, keywords) {
        const components = [];
        for (const result of results) {
            const content = result.content || '';
            // React functional components
            const matches = content.matchAll(/export\s+(?:default\s+)?function\s+(\w+)/gi);
            for (const match of matches) {
                components.push({
                    name: match[1],
                    type: this.inferComponentType(match[1], result.file),
                    file: result.file,
                });
            }
        }
        if (keywords.length > 0) {
            return components.filter(c => keywords.some(k => c.name.toLowerCase().includes(k.toLowerCase())));
        }
        return components;
    }
    /**
     * Extract npm/yarn dependencies
     */
    extractDependencies(results, libs) {
        const dependencies = new Set();
        for (const result of results) {
            const content = result.content?.toLowerCase() || '';
            for (const lib of libs) {
                if (content.includes(lib.toLowerCase())) {
                    dependencies.add(lib);
                }
            }
        }
        return Array.from(dependencies);
    }
    /**
     * Group endpoints by resource name
     */
    groupEndpointsByResource(endpoints) {
        const groups = {};
        for (const endpoint of endpoints) {
            const resource = this.extractResource(endpoint.path);
            if (!groups[resource]) {
                groups[resource] = [];
            }
            groups[resource].push(endpoint);
        }
        return groups;
    }
    /**
     * Group components by feature/domain
     */
    groupComponentsByFeature(components) {
        const groups = {};
        for (const component of components) {
            const prefix = this.extractPrefix(component.name);
            if (!groups[prefix]) {
                groups[prefix] = [];
            }
            groups[prefix].push(component);
        }
        return Object.entries(groups)
            .filter(([_, comps]) => comps.length >= 2)
            .map(([prefix, comps]) => ({
            name: `${this.capitalize(prefix)} UI`,
            files: [...new Set(comps.map((c) => c.file))],
            components: comps,
            description: `User interface for ${prefix} functionality`,
            userStories: [
                `As a user, I want to interact with ${prefix} features`,
            ],
            acceptance: [
                'UI is responsive on all screen sizes',
                'UI follows design system guidelines',
            ],
            confidence: Math.min(comps.length / 5, 1),
            priority: 'P0',
            complexity: 'medium',
        }));
    }
    /**
     * Infer component type from name and file path
     */
    inferComponentType(name, file) {
        const lowerName = name.toLowerCase();
        const lowerFile = file.toLowerCase();
        if (lowerFile.includes('page') || lowerName.includes('page'))
            return 'page';
        if (lowerFile.includes('layout') || lowerName.includes('layout'))
            return 'layout';
        if (lowerFile.includes('widget') || lowerName.includes('widget'))
            return 'widget';
        return 'component';
    }
    /**
     * Extract resource name from API path
     */
    extractResource(path) {
        const segments = path.split('/').filter(s => s && !s.startsWith(':') && !s.startsWith('{'));
        return segments[segments.length - 1] || 'default';
    }
    /**
     * Extract common prefix from component name
     */
    extractPrefix(name) {
        const match = name.match(/^([a-z]+)[A-Z]/);
        if (match)
            return match[1];
        return name.split(/(?=[A-Z])/)[0].toLowerCase();
    }
    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
//# sourceMappingURL=FeatureDetector.js.map