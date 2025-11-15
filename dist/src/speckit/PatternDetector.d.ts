/**
 * PatternDetector - Detect design patterns and architectural patterns in code
 * Used by ADRGenerator to identify patterns worth documenting
 */
export interface DetectedPattern {
    name: string;
    type: 'design' | 'architectural' | 'integration';
    files: string[];
    examples: Array<{
        file: string;
        line: number;
        code: string;
        context?: string;
    }>;
    confidence: number;
    description?: string;
    benefits?: string[];
    tradeoffs?: string[];
}
/**
 * PatternDetector - Utility for detecting design patterns in codebases
 */
export declare class PatternDetector {
    private searchCode;
    constructor(searchCode: (query: string, options?: any) => Promise<any[]>);
    /**
     * Detect all supported patterns
     */
    detectAll(): Promise<DetectedPattern[]>;
    /**
     * Detect specific pattern by name
     */
    detect(patternName: string): Promise<DetectedPattern | null>;
    /**
     * Detect Singleton pattern
     */
    private detectSingleton;
    /**
     * Detect Factory pattern
     */
    private detectFactory;
    /**
     * Detect Dependency Injection pattern
     */
    private detectDependencyInjection;
    /**
     * Detect Observer pattern
     */
    private detectObserver;
    /**
     * Detect Strategy pattern
     */
    private detectStrategy;
    /**
     * Detect Repository pattern
     */
    private detectRepository;
    /**
     * Detect Adapter pattern
     */
    private detectAdapter;
    /**
     * Detect Decorator pattern
     */
    private detectDecorator;
    /**
     * Detect Builder pattern
     */
    private detectBuilder;
    /**
     * Detect Layered Architecture
     */
    private detectLayeredArchitecture;
    /**
     * Detect Event-Driven Architecture
     */
    private detectEventDriven;
    /**
     * Detect Microservices Architecture
     */
    private detectMicroservices;
    /**
     * Detect CQRS pattern
     */
    private detectCQRS;
}
//# sourceMappingURL=PatternDetector.d.ts.map