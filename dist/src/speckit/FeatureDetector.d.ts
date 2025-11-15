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
export interface DetectedFeature {
    name: string;
    type: 'core' | 'enhancement' | 'integration' | 'utility';
    category: 'auth' | 'api' | 'ui' | 'data' | 'integration' | 'security' | 'payment' | 'notification' | 'search' | 'analytics';
    files: string[];
    endpoints?: Array<{
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        path: string;
        file: string;
        line: number;
        description?: string;
    }>;
    components?: Array<{
        name: string;
        type: 'page' | 'component' | 'widget' | 'layout';
        file: string;
        props?: string[];
    }>;
    dependencies: string[];
    dataModels?: Array<{
        name: string;
        file: string;
        fields: string[];
    }>;
    description: string;
    userStories: string[];
    acceptance: string[];
    confidence: number;
    priority?: 'P0' | 'P1' | 'P2' | 'P3';
    complexity?: 'low' | 'medium' | 'high';
}
export declare class FeatureDetector {
    private searchCode;
    constructor(searchCode: (query: string, options?: any) => Promise<any[]>);
    /**
     * Detect all features in codebase
     */
    detectAll(): Promise<DetectedFeature[]>;
    /**
     * Detect specific feature by name
     */
    detect(featureName: string): Promise<DetectedFeature | null>;
    /**
     * Detect authentication/authorization features
     */
    private detectAuthFeatures;
    /**
     * Detect API/REST endpoints
     */
    private detectAPIFeatures;
    /**
     * Detect UI components and pages
     */
    private detectUIFeatures;
    /**
     * Detect data models and schemas
     */
    private detectDataFeatures;
    /**
     * Detect third-party integrations
     */
    private detectIntegrationFeatures;
    /**
     * Detect security features
     */
    private detectSecurityFeatures;
    /**
     * Extract API endpoints from search results
     */
    private extractEndpoints;
    /**
     * Extract React/Vue components
     */
    private extractComponents;
    /**
     * Extract npm/yarn dependencies
     */
    private extractDependencies;
    /**
     * Group endpoints by resource name
     */
    private groupEndpointsByResource;
    /**
     * Group components by feature/domain
     */
    private groupComponentsByFeature;
    /**
     * Infer component type from name and file path
     */
    private inferComponentType;
    /**
     * Extract resource name from API path
     */
    private extractResource;
    /**
     * Extract common prefix from component name
     */
    private extractPrefix;
    /**
     * Capitalize first letter
     */
    private capitalize;
}
//# sourceMappingURL=FeatureDetector.d.ts.map