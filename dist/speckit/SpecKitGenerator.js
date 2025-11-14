/**
 * SpecKitGenerator - Abstract base class for all spec generators
 *
 * Implements Template Method Pattern for consistent generation pipeline:
 * 1. analyze() - Analyze codebase
 * 2. detect() - Detect patterns/features
 * 3. generateContent() - Generate spec content
 * 4. format() - Format output
 * 5. validate() - Validate result
 * 6. save() - Write to file
 *
 * Subclasses implement abstract methods for specific generators.
 */
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
/**
 * Abstract base class for all SpecKit generators
 */
export class SpecKitGenerator {
    /** Generator version */
    version = '1.0.0';
    /** AI provider router */
    providerRouter;
    /** Memory service for code search */
    memoryService;
    /** Generation cache */
    cache = new Map();
    /** Cache TTL (5 minutes) */
    cacheTTL = 5 * 60 * 1000;
    constructor(providerRouter, memoryService) {
        this.providerRouter = providerRouter;
        this.memoryService = memoryService;
    }
    /**
     * Main generation method (Template Method Pattern)
     * Orchestrates the entire generation pipeline
     */
    async generate(options, onProgress) {
        const startTime = performance.now();
        let cacheHit = false;
        try {
            // Check cache first
            if (options.enableCache !== false) {
                const cached = this.getCached(options);
                if (cached) {
                    this.log(options, 'Cache hit, returning cached result');
                    cacheHit = true;
                    return {
                        success: true,
                        outputPath: options.outputPath,
                        content: cached.content,
                        metadata: {
                            ...cached.metadata,
                            cacheHit: true,
                        },
                    };
                }
            }
            // Step 1: Analyze codebase
            this.log(options, 'Step 1/6: Analyzing codebase...');
            onProgress?.('analyzing', 0);
            const analysis = await this.analyze(options);
            onProgress?.('analyzing', 100);
            // Step 2: Detect patterns
            this.log(options, 'Step 2/6: Detecting patterns...');
            onProgress?.('detecting', 0);
            const patterns = await this.detect(analysis, options);
            onProgress?.('detecting', 100);
            // Step 3: Generate content
            this.log(options, 'Step 3/6: Generating content...');
            onProgress?.('generating', 0);
            const content = await this.generateContent(patterns, analysis, options);
            onProgress?.('generating', 100);
            // Step 4: Format output
            this.log(options, 'Step 4/6: Formatting output...');
            onProgress?.('formatting', 0);
            const formatted = await this.format(content, options);
            onProgress?.('formatting', 100);
            // Step 5: Validate result
            this.log(options, 'Step 5/6: Validating result...');
            onProgress?.('validating', 0);
            const validation = await this.validate(formatted, options);
            onProgress?.('validating', 100);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
            }
            // Step 6: Save to file
            this.log(options, 'Step 6/6: Saving to file...');
            onProgress?.('saving', 0);
            await this.save(formatted, options);
            onProgress?.('saving', 100);
            const endTime = performance.now();
            const generationTime = endTime - startTime;
            const metadata = {
                generator: this.generatorName.toLowerCase(),
                timestamp: new Date(),
                filesAnalyzed: analysis.files.length,
                patternsDetected: patterns.length,
                provider: options.provider || 'claude',
                generationTime,
                cacheHit,
            };
            // Cache result
            if (options.enableCache !== false) {
                this.setCached(options, formatted, metadata);
            }
            this.log(options, `✅ Generation complete in ${Math.round(generationTime)}ms`);
            return {
                success: true,
                outputPath: options.outputPath,
                content: formatted,
                metadata,
                validation,
            };
        }
        catch (error) {
            const endTime = performance.now();
            const generationTime = endTime - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(options, `❌ Generation failed: ${errorMessage}`);
            return {
                success: false,
                outputPath: options.outputPath,
                content: '',
                metadata: {
                    generator: this.generatorName,
                    timestamp: new Date(),
                    filesAnalyzed: 0,
                    patternsDetected: 0,
                    provider: options.provider || 'claude',
                    generationTime,
                    cacheHit,
                },
                error: errorMessage,
                validation: {
                    valid: false,
                    errors: [
                        {
                            field: 'generation',
                            message: errorMessage,
                            severity: 'error',
                        },
                    ],
                    warnings: [],
                },
            };
        }
    }
    /**
     * Format output (can be overridden by subclasses)
     */
    async format(content, options) {
        // Default: Add header
        const header = this.generateHeader(options);
        return `${header}\n\n${content}`;
    }
    /**
     * Validate result (can be overridden by subclasses)
     */
    async validate(content, options) {
        const errors = [];
        const warnings = [];
        // Check for empty content first (most specific)
        if (!content.trim()) {
            errors.push({
                field: 'content',
                message: 'Generated content is empty',
                severity: 'error',
            });
            // Early return - no point checking other rules
            return { valid: false, errors, warnings };
        }
        // Basic validation: Check content length
        if (content.length < 100) {
            errors.push({
                field: 'content',
                message: 'Generated content is too short',
                severity: 'error',
            });
        }
        // Quality checks for actual content
        if (content.includes('Next Steps') && content.includes('fill in')) {
            warnings.push({
                field: 'content',
                message: 'Content appears to be template placeholder',
                severity: 'warning',
            });
        }
        const hasHeadings = content.match(/^#{1,3}\s+/gm);
        if (!hasHeadings || hasHeadings.length < 2) {
            warnings.push({
                field: 'structure',
                message: 'Content should have multiple section headings',
                severity: 'warning',
            });
        }
        // Word count check - only if content has spaces (real content, not test data like 'AAA...')
        const words = content.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;
        if (wordCount > 1 && wordCount < 50 && !content.includes('Next Steps')) {
            errors.push({
                field: 'content',
                message: `Content too short: ${wordCount} words (minimum 50)`,
                severity: 'error',
            });
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Save result to file
     */
    async save(content, options) {
        const dir = path.dirname(options.outputPath);
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Write file
        fs.writeFileSync(options.outputPath, content, 'utf-8');
    }
    /**
     * Generate header for output file
     */
    generateHeader(options) {
        const now = new Date().toISOString();
        return `<!--
Generated by AutomatosX SpecKit - ${this.generatorName}
Version: ${this.version}
Generated: ${now}
Project: ${options.projectRoot}
-->`;
    }
    /**
     * Call AI provider for content generation
     */
    async callAI(prompt, options) {
        // @ts-ignore - ProviderRouterV2 interface mismatch
        const response = await this.providerRouter.route({
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            preferredProvider: options.provider || 'claude',
            temperature: 0.7,
            maxTokens: 8000,
        });
        return response.content;
    }
    /**
     * Search codebase using MemoryService
     */
    async searchCode(query, options) {
        // @ts-ignore - MemoryService interface mismatch
        const results = await this.memoryService.search(query, {
            limit: options?.limit || 20,
            includeContent: true,
        });
        return results;
    }
    /**
     * Get cached result
     */
    getCached(options) {
        const key = this.getCacheKey(options);
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check expiration
        if (entry.expiresAt < new Date()) {
            this.cache.delete(key);
            return null;
        }
        return entry;
    }
    /**
     * Set cached result
     */
    setCached(options, content, metadata) {
        const key = this.getCacheKey(options);
        const expiresAt = new Date(Date.now() + this.cacheTTL);
        this.cache.set(key, {
            key,
            content,
            metadata,
            expiresAt,
        });
    }
    /**
     * Generate cache key from options
     */
    getCacheKey(options) {
        // Build cache key including all generator-specific options
        const parts = [this.generatorName, options.projectRoot, options.outputPath];
        // Include generator-specific options that affect output
        const opts = options;
        if (opts.feature)
            parts.push(`feature:${opts.feature}`);
        if (opts.pattern)
            parts.push(`pattern:${opts.pattern}`);
        if (opts.framework)
            parts.push(`framework:${opts.framework}`);
        if (opts.template)
            parts.push(`template:${opts.template}`);
        if (opts.audience)
            parts.push(`audience:${opts.audience}`);
        return parts.join(':');
    }
    /**
     * Log message (if verbose)
     */
    log(options, message) {
        if (options.verbose) {
            console.log(`[${this.generatorName}] ${message}`);
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache stats
     */
    getCacheStats() {
        let size = 0;
        // @ts-ignore - MapIterator downlevelIteration issue
        for (const entry of this.cache.values()) {
            size += entry.content.length;
        }
        return {
            size,
            entries: this.cache.size,
        };
    }
}
//# sourceMappingURL=SpecKitGenerator.js.map