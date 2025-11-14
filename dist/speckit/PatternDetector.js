/**
 * PatternDetector - Detect design patterns and architectural patterns in code
 * Used by ADRGenerator to identify patterns worth documenting
 */
/**
 * PatternDetector - Utility for detecting design patterns in codebases
 */
export class PatternDetector {
    searchCode;
    constructor(searchCode) {
        this.searchCode = searchCode;
    }
    /**
     * Detect all supported patterns
     */
    async detectAll() {
        const patterns = [];
        // Design Patterns
        patterns.push(...(await this.detectSingleton()));
        patterns.push(...(await this.detectFactory()));
        patterns.push(...(await this.detectDependencyInjection()));
        patterns.push(...(await this.detectObserver()));
        patterns.push(...(await this.detectStrategy()));
        patterns.push(...(await this.detectRepository()));
        patterns.push(...(await this.detectAdapter()));
        patterns.push(...(await this.detectDecorator()));
        patterns.push(...(await this.detectBuilder()));
        // Architectural Patterns
        patterns.push(...(await this.detectLayeredArchitecture()));
        patterns.push(...(await this.detectEventDriven()));
        patterns.push(...(await this.detectMicroservices()));
        patterns.push(...(await this.detectCQRS()));
        return patterns.filter((p) => p.confidence > 0.5);
    }
    /**
     * Detect specific pattern by name
     */
    async detect(patternName) {
        const methodName = `detect${patternName.replace(/\s+/g, '')}`;
        const method = this[methodName];
        if (typeof method === 'function') {
            const results = await method.call(this);
            return results.length > 0 ? results[0] : null;
        }
        return null;
    }
    /**
     * Detect Singleton pattern
     */
    async detectSingleton() {
        const results = await this.searchCode('static instance');
        const singletons = results.filter((r) => r.content.includes('getInstance') ||
            r.content.includes('static instance') ||
            r.content.includes('private constructor'));
        if (singletons.length === 0)
            return [];
        return [
            {
                name: 'Singleton',
                type: 'design',
                files: [...new Set(singletons.map((s) => s.file))],
                examples: singletons.slice(0, 3).map((s) => ({
                    file: s.file,
                    line: s.line || 1,
                    code: s.content,
                })),
                confidence: Math.min(singletons.length / 5, 1),
                description: 'Ensures a class has only one instance and provides global access',
                benefits: [
                    'Controlled access to single instance',
                    'Lazy initialization',
                    'Global access point',
                ],
                tradeoffs: [
                    'Can make unit testing difficult',
                    'Violates Single Responsibility Principle',
                    'Can create tight coupling',
                ],
            },
        ];
    }
    /**
     * Detect Factory pattern
     */
    async detectFactory() {
        const results = await this.searchCode('factory');
        const factories = results.filter((r) => (r.content.includes('create') || r.content.includes('build')) &&
            (r.content.includes('Factory') || r.content.includes('factory')));
        if (factories.length === 0)
            return [];
        return [
            {
                name: 'Factory',
                type: 'design',
                files: [...new Set(factories.map((f) => f.file))],
                examples: factories.slice(0, 3).map((f) => ({
                    file: f.file,
                    line: f.line || 1,
                    code: f.content,
                })),
                confidence: Math.min(factories.length / 5, 1),
                description: 'Creates objects without specifying exact class',
                benefits: [
                    'Decouples object creation',
                    'Easy to extend with new types',
                    'Centralizes object creation logic',
                ],
                tradeoffs: [
                    'Can add complexity',
                    'May create many small classes',
                ],
            },
        ];
    }
    /**
     * Detect Dependency Injection pattern
     */
    async detectDependencyInjection() {
        const results = await this.searchCode('constructor');
        const diPatterns = results.filter((r) => r.content.includes('constructor(') &&
            (r.content.includes('private') ||
                r.content.includes('readonly') ||
                r.content.includes('@inject')));
        if (diPatterns.length === 0)
            return [];
        return [
            {
                name: 'Dependency Injection',
                type: 'design',
                files: [...new Set(diPatterns.map((d) => d.file))],
                examples: diPatterns.slice(0, 3).map((d) => ({
                    file: d.file,
                    line: d.line || 1,
                    code: d.content,
                })),
                confidence: Math.min(diPatterns.length / 10, 1),
                description: 'Injects dependencies rather than creating them',
                benefits: [
                    'Loose coupling',
                    'Easy testing with mocks',
                    'Better separation of concerns',
                ],
                tradeoffs: [
                    'Requires DI container or manual wiring',
                    'Can be complex to set up',
                ],
            },
        ];
    }
    /**
     * Detect Observer pattern
     */
    async detectObserver() {
        const results = await this.searchCode('addEventListener');
        const observers = results.filter((r) => r.content.includes('addEventListener') ||
            r.content.includes('subscribe') ||
            r.content.includes('on(') ||
            r.content.includes('emit'));
        if (observers.length === 0)
            return [];
        return [
            {
                name: 'Observer',
                type: 'design',
                files: [...new Set(observers.map((o) => o.file))],
                examples: observers.slice(0, 3).map((o) => ({
                    file: o.file,
                    line: o.line || 1,
                    code: o.content,
                })),
                confidence: Math.min(observers.length / 10, 1),
                description: 'Defines one-to-many dependency between objects',
                benefits: [
                    'Loose coupling between publisher and subscribers',
                    'Dynamic subscription',
                    'Supports event-driven architecture',
                ],
                tradeoffs: [
                    'Memory leaks if not unsubscribed',
                    'Difficult to debug event chains',
                ],
            },
        ];
    }
    /**
     * Detect Strategy pattern
     */
    async detectStrategy() {
        const results = await this.searchCode('strategy');
        const strategies = results.filter((r) => r.content.includes('Strategy') ||
            (r.content.includes('interface') && r.content.includes('execute')));
        if (strategies.length === 0)
            return [];
        return [
            {
                name: 'Strategy',
                type: 'design',
                files: [...new Set(strategies.map((s) => s.file))],
                examples: strategies.slice(0, 3).map((s) => ({
                    file: s.file,
                    line: s.line || 1,
                    code: s.content,
                })),
                confidence: Math.min(strategies.length / 5, 1),
                description: 'Defines family of algorithms, encapsulates each one',
                benefits: [
                    'Easy to switch algorithms',
                    'Open/Closed Principle',
                    'Eliminates conditional logic',
                ],
                tradeoffs: [
                    'Increases number of classes',
                    'Client must know strategies',
                ],
            },
        ];
    }
    /**
     * Detect Repository pattern
     */
    async detectRepository() {
        const results = await this.searchCode('repository');
        const repositories = results.filter((r) => r.content.includes('Repository') ||
            r.content.includes('DAO') ||
            (r.content.includes('find') && r.content.includes('save')));
        if (repositories.length === 0)
            return [];
        return [
            {
                name: 'Repository',
                type: 'design',
                files: [...new Set(repositories.map((r) => r.file))],
                examples: repositories.slice(0, 3).map((r) => ({
                    file: r.file,
                    line: r.line || 1,
                    code: r.content,
                })),
                confidence: Math.min(repositories.length / 5, 1),
                description: 'Mediates between domain and data mapping layers',
                benefits: [
                    'Separates data access logic',
                    'Centralizes data access',
                    'Easy to test domain logic',
                ],
                tradeoffs: [
                    'Can become anemic',
                    'Extra layer of abstraction',
                ],
            },
        ];
    }
    /**
     * Detect Adapter pattern
     */
    async detectAdapter() {
        const results = await this.searchCode('adapter');
        const adapters = results.filter((r) => r.content.includes('Adapter') ||
            r.content.includes('adapt') ||
            r.content.includes('wrap'));
        if (adapters.length === 0)
            return [];
        return [
            {
                name: 'Adapter',
                type: 'design',
                files: [...new Set(adapters.map((a) => a.file))],
                examples: adapters.slice(0, 3).map((a) => ({
                    file: a.file,
                    line: a.line || 1,
                    code: a.content,
                })),
                confidence: Math.min(adapters.length / 5, 1),
                description: 'Converts interface of class into another interface',
                benefits: [
                    'Allows incompatible interfaces to work together',
                    'Reuse existing classes',
                    'Single Responsibility',
                ],
                tradeoffs: [
                    'Increases overall complexity',
                    'Extra indirection',
                ],
            },
        ];
    }
    /**
     * Detect Decorator pattern
     */
    async detectDecorator() {
        const results = await this.searchCode('decorator');
        const decorators = results.filter((r) => r.content.includes('@') ||
            r.content.includes('Decorator') ||
            r.content.includes('wrap'));
        if (decorators.length === 0)
            return [];
        return [
            {
                name: 'Decorator',
                type: 'design',
                files: [...new Set(decorators.map((d) => d.file))],
                examples: decorators.slice(0, 3).map((d) => ({
                    file: d.file,
                    line: d.line || 1,
                    code: d.content,
                })),
                confidence: Math.min(decorators.length / 5, 1),
                description: 'Attaches additional responsibilities to object dynamically',
                benefits: [
                    'More flexible than inheritance',
                    'Responsibilities can be added/removed at runtime',
                    'Open/Closed Principle',
                ],
                tradeoffs: [
                    'Many small objects',
                    'Can be hard to debug',
                ],
            },
        ];
    }
    /**
     * Detect Builder pattern
     */
    async detectBuilder() {
        const results = await this.searchCode('builder');
        const builders = results.filter((r) => r.content.includes('Builder') ||
            (r.content.includes('build()') && r.content.includes('with')));
        if (builders.length === 0)
            return [];
        return [
            {
                name: 'Builder',
                type: 'design',
                files: [...new Set(builders.map((b) => b.file))],
                examples: builders.slice(0, 3).map((b) => ({
                    file: b.file,
                    line: b.line || 1,
                    code: b.content,
                })),
                confidence: Math.min(builders.length / 5, 1),
                description: 'Separates construction of complex object from representation',
                benefits: [
                    'Step-by-step construction',
                    'Different representations',
                    'Immutable objects',
                ],
                tradeoffs: [
                    'More code complexity',
                    'Increases number of classes',
                ],
            },
        ];
    }
    /**
     * Detect Layered Architecture
     */
    async detectLayeredArchitecture() {
        const results = await this.searchCode('service');
        const layers = results.filter((r) => r.content.includes('Service') ||
            r.content.includes('Controller') ||
            r.content.includes('Repository'));
        if (layers.length < 3)
            return [];
        return [
            {
                name: 'Layered Architecture',
                type: 'architectural',
                files: [...new Set(layers.map((l) => l.file))],
                examples: layers.slice(0, 3).map((l) => ({
                    file: l.file,
                    line: l.line || 1,
                    code: l.content,
                })),
                confidence: Math.min(layers.length / 15, 1),
                description: 'Organizes system into layers (presentation, business, data)',
                benefits: [
                    'Separation of concerns',
                    'Independent layer development',
                    'Easy to maintain',
                ],
                tradeoffs: [
                    'Can become monolithic',
                    'Performance overhead',
                ],
            },
        ];
    }
    /**
     * Detect Event-Driven Architecture
     */
    async detectEventDriven() {
        const results = await this.searchCode('event');
        const events = results.filter((r) => r.content.includes('EventEmitter') ||
            r.content.includes('EventBus') ||
            r.content.includes('publish'));
        if (events.length === 0)
            return [];
        return [
            {
                name: 'Event-Driven Architecture',
                type: 'architectural',
                files: [...new Set(events.map((e) => e.file))],
                examples: events.slice(0, 3).map((e) => ({
                    file: e.file,
                    line: e.line || 1,
                    code: e.content,
                })),
                confidence: Math.min(events.length / 10, 1),
                description: 'Components communicate through events',
                benefits: [
                    'Loose coupling',
                    'Scalable',
                    'Responsive',
                ],
                tradeoffs: [
                    'Difficult to debug',
                    'Eventual consistency',
                ],
            },
        ];
    }
    /**
     * Detect Microservices Architecture
     */
    async detectMicroservices() {
        const results = await this.searchCode('service');
        const services = results.filter((r) => r.content.includes('microservice') ||
            r.content.includes('API Gateway') ||
            r.content.includes('service mesh'));
        if (services.length === 0)
            return [];
        return [
            {
                name: 'Microservices',
                type: 'architectural',
                files: [...new Set(services.map((s) => s.file))],
                examples: services.slice(0, 3).map((s) => ({
                    file: s.file,
                    line: s.line || 1,
                    code: s.content,
                })),
                confidence: Math.min(services.length / 5, 1),
                description: 'Application composed of small, independent services',
                benefits: [
                    'Independent deployment',
                    'Technology diversity',
                    'Fault isolation',
                ],
                tradeoffs: [
                    'Distributed complexity',
                    'Network overhead',
                ],
            },
        ];
    }
    /**
     * Detect CQRS pattern
     */
    async detectCQRS() {
        const results = await this.searchCode('command');
        const cqrs = results.filter((r) => (r.content.includes('Command') && r.content.includes('Query')) ||
            r.content.includes('CommandHandler') ||
            r.content.includes('QueryHandler'));
        if (cqrs.length === 0)
            return [];
        return [
            {
                name: 'CQRS',
                type: 'architectural',
                files: [...new Set(cqrs.map((c) => c.file))],
                examples: cqrs.slice(0, 3).map((c) => ({
                    file: c.file,
                    line: c.line || 1,
                    code: c.content,
                })),
                confidence: Math.min(cqrs.length / 5, 1),
                description: 'Separates read and write operations',
                benefits: [
                    'Optimized read/write models',
                    'Scalable',
                    'Clear separation',
                ],
                tradeoffs: [
                    'Increased complexity',
                    'Eventual consistency',
                ],
            },
        ];
    }
}
//# sourceMappingURL=PatternDetector.js.map