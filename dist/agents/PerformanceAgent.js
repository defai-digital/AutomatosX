/**
 * PerformanceAgent.ts
 * Performance optimization and profiling specialist
 * Phase 7: Agent System Implementation - Day 3
 */
import { AgentBase } from './AgentBase.js';
export class PerformanceAgent extends AgentBase {
    constructor() {
        super({
            type: 'performance',
            name: 'Performance Specialist (Percy)',
            description: 'Expert in performance optimization, profiling, caching, and load testing. Specializes in identifying and fixing performance bottlenecks.',
            capabilities: [
                { name: 'Performance Profiling', description: 'Profile and analyze performance', keywords: ['profiling', 'profile', 'performance', 'bottleneck', 'flamegraph'] },
                { name: 'Optimization', description: 'Optimize code and queries', keywords: ['optimize', 'optimization', 'speed', 'latency', 'throughput'] },
                { name: 'Caching Strategy', description: 'Design caching solutions', keywords: ['cache', 'caching', 'redis', 'memcached', 'cdn'] },
                { name: 'Load Testing', description: 'Design and run load tests', keywords: ['load test', 'stress test', 'benchmark', 'k6', 'jmeter'] },
                { name: 'Resource Optimization', description: 'Optimize memory and CPU usage', keywords: ['memory', 'cpu', 'resource', 'heap', 'garbage collection'] },
            ],
            specializations: ['Profiling', 'Benchmarking', 'Caching', 'Load Testing', 'k6', 'Apache Bench', 'Lighthouse', 'Web Vitals', 'CDN', 'Redis'],
            temperature: 0.6,
            maxTokens: 4000,
        });
    }
    async executeTask(task, context, options) {
        const capability = this.canHandle(task);
        if (capability < 0.3) {
            return { success: false, message: `Outside performance specialization. Consider @${this.suggestDelegation(task)} agent.`, metadata: { capabilityScore: capability } };
        }
        context.monitoring.log('info', `Performance agent handling: ${task.description}`);
        try {
            const relevantCode = await context.codeIntelligence.searchCode('performance optimization cache benchmark');
            const pastSolutions = await context.memory.search('performance optimization profiling');
            const prompt = this.buildPerformancePrompt(task, context, relevantCode.slice(0, 5), pastSolutions.slice(0, 3));
            const response = await this.callProvider(prompt, context, options);
            const artifacts = this.parsePerformanceArtifacts(response);
            await context.memory.store({ type: 'performance_solution', agent: this.metadata.type, task: task.description, response, artifacts, timestamp: Date.now() });
            return { success: true, data: response, artifacts, metadata: { agent: this.metadata.type, category: 'performance' } };
        }
        catch (error) {
            context.monitoring.log('error', `Performance agent failed: ${error}`);
            throw error;
        }
    }
    buildPerformancePrompt(task, context, codeContext, pastSolutions) {
        let prompt = this.buildPrompt(task, context);
        prompt += '\n\nProvide complete performance solution with:\n1. Performance analysis and bottleneck identification\n2. Optimization recommendations with code examples\n3. Caching strategy (Redis, CDN, in-memory)\n4. Load testing script (k6, Apache Bench, or similar)\n5. Monitoring and metrics to track\n6. Before/after performance comparison\n7. Resource optimization tips';
        return prompt;
    }
    parsePerformanceArtifacts(response) {
        const artifacts = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1] || 'text';
            const content = match[2].trim();
            let name = 'performance-code';
            if (language === 'javascript' || language === 'typescript') {
                if (content.includes('k6') || content.includes('import http from'))
                    name = 'k6-load-test';
                else if (content.includes('cache') || content.includes('Redis'))
                    name = 'caching-implementation';
                else if (content.includes('benchmark') || content.includes('performance.now()'))
                    name = 'benchmark-script';
            }
            else if (language === 'bash' || language === 'sh') {
                if (content.includes('ab ') || content.includes('apache bench'))
                    name = 'apache-bench-test';
                else if (content.includes('wrk') || content.includes('hey'))
                    name = 'load-test-command';
            }
            artifacts.push({ type: 'code', name, content, metadata: { language, category: 'performance' } });
        }
        return artifacts;
    }
    getContextPrompt() {
        return '\nPerformance Context:\n- Identify bottlenecks using profiling tools\n- Optimize database queries with proper indexes\n- Implement caching at appropriate layers\n- Use CDN for static assets\n- Apply lazy loading and code splitting\n- Monitor with metrics (p50, p95, p99 latencies)\n- Consider resource usage (memory, CPU, network)\n- Test under realistic load conditions';
    }
}
//# sourceMappingURL=PerformanceAgent.js.map